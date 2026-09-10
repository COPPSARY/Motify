import { repairGeneratedMarkup } from "./auto-repair";
import {
  analyzeMotionQuality,
  buildMotionlyUserMessage,
  editIdsIn,
  userEditedIds,
  type GeneratedComposition,
  type GenerationFiles,
  type MotionQualityReport,
} from "./generation-guidance";
import {
  buildDirectionUserMessage,
  DIRECTION_SYSTEM_PROMPT,
  formatDirectionBrief,
  parseDirectionResponse,
  type FilmDirection,
} from "./direction-pass";
import { MOTIONLY_SYSTEM_PROMPT } from "./prompt";
import { buildQualityRepairPrompt } from "./repair-prompt";

export type DirectAiResult = GeneratedComposition;

/**
 * The film this app produces is a ~9KB markup document plus a ~8KB timeline,
 * written against a 32KB system prompt and a ~70KB user message. The lite tier
 * cannot hold that and still write dense motion: on the identical request it
 * returns roughly a third of the timeline code, drops the HyperFrames
 * adaptations entirely, and leaves multi-second stretches with nothing
 * scheduled -- the "nothing is animating" report. The same prompt on the
 * standard flash tier scored 73 against 16, with no dead stretch at all.
 *
 * Override per deployment with VITE_GEMINI_MODEL / GEMINI_MODEL.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

export function normalizeGeminiModel(rawModel: string): string {
  let model = rawModel.trim().replace(/^models\//, "");
  model = model.replace(/\s+/g, "-");
  if (!model.startsWith("gemini-") && !model.startsWith("gemma-")) {
    model = `gemini-${model}`;
  }
  model = model.replace(/gemini-(\d+)-(\d+)/g, "gemini-$1.$2");
  return !model || model === "gemini-" ? DEFAULT_GEMINI_MODEL : model;
}

export function getClientGeminiApiKey(): string {
  if (typeof window !== "undefined") {
    const customKey = localStorage.getItem("motionly_gemini_api_key");
    if (customKey?.trim()) return customKey.trim();
  }
  const env = import.meta.env as Record<string, string | undefined>;
  return (env["VITE_GEMINI_API_KEY"] ?? "").trim();
}

/**
 * The direction turn, off switch included.
 *
 * It adds a round trip and a whole extra set of decisions upstream of the
 * build, so when output quality moves it is the first thing worth ruling in or
 * out. Set `motionly_direction_pass` to "off" in localStorage to generate the
 * way this app did before it existed.
 */
export function directionPassEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("motionly_direction_pass") !== "off";
}

export function getClientGeminiModel(): string {
  if (typeof window !== "undefined") {
    const customModel = localStorage.getItem("motionly_gemini_model");
    if (customModel?.trim()) return customModel.trim();
  }
  const env = import.meta.env as Record<string, string | undefined>;
  return (env["VITE_GEMINI_MODEL"] ?? "").trim() || DEFAULT_GEMINI_MODEL;
}

export function parseAiResponseText(rawText: string): DirectAiResult {
  let cleaned = rawText.trim();
  const jsonBlockMatch = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(cleaned);
  if (jsonBlockMatch?.[1]) {
    cleaned = jsonBlockMatch[1].trim();
  } else {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();
    }
  }

  let parsed: Partial<DirectAiResult>;
  try {
    parsed = JSON.parse(cleaned) as Partial<DirectAiResult>;
  } catch {
    try {
      parsed = JSON.parse(
        cleaned.replace(/,\s*([}\]])/g, "$1"),
      ) as Partial<DirectAiResult>;
    } catch {
      const titleMatch = /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/.exec(
        cleaned,
      );
      const durationMatch = /"duration"\s*:\s*([\d.]+)/.exec(cleaned);
      const htmlMatch =
        /"compositionHtml"\s*:\s*"([\s\S]*?)(?:",\s*"timelineJs"|",\s*"reply"|"$|\}\s*$)/.exec(
          cleaned,
        );
      const jsMatch =
        /"timelineJs"\s*:\s*"([\s\S]*?)(?:",\s*"reply"|"$|\}\s*$)/.exec(
          cleaned,
        );
      const replyMatch = /"reply"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/.exec(
        cleaned,
      );
      const unescapeJsonString = (value: string): string =>
        value
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");

      if (!htmlMatch?.[1] || !jsMatch?.[1]) {
        throw new Error("Failed to parse AI response into valid JSON.");
      }
      parsed = {
        title: titleMatch?.[1] ?? "AI Generated Video",
        duration: durationMatch?.[1] ? parseFloat(durationMatch[1]) : 20,
        compositionHtml: unescapeJsonString(htmlMatch[1]),
        timelineJs: unescapeJsonString(jsMatch[1]),
        reply: replyMatch?.[1] ?? "Updated composition with Motionly AI.",
      };
    }
  }

  if (!parsed.compositionHtml || !parsed.timelineJs) {
    throw new Error(
      "AI response was missing compositionHtml or timelineJs code.",
    );
  }

  return {
    title: parsed.title,
    duration: parsed.duration,
    skills: parsed.skills,
    scenes: parsed.scenes,
    direction: parsed.direction,
    seams: parsed.seams,
    techniques: parsed.techniques,
    compositionHtml: parsed.compositionHtml,
    timelineJs: parsed.timelineJs,
    reply: parsed.reply ?? "I updated your composition.",
  };
}

interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

/**
 * One Gemini call, returning raw text. Both turns use it: the direction turn
 * parses a small plan out of it, the build turn a whole composition.
 */
async function callClientGemini(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  temperature: number,
  imageParts: readonly unknown[],
): Promise<string> {
  const model = normalizeGeminiModel(getClientGeminiModel());
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig: Record<string, unknown> = {
    response_mime_type: "application/json",
    temperature,
    maxOutputTokens: 65536,
  };
  if (model.includes("3.7")) {
    generationConfig["thinking_config"] = { thinking_budget: 0 };
  }
  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        { role: "user", parts: [{ text: userMessage }, ...imageParts] },
      ],
      generationConfig,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    let message = `Gemini API error (${response.status})`;
    try {
      const errorBody = JSON.parse(errorText) as {
        error?: { message?: string };
      };
      message = errorBody.error?.message ?? message;
    } catch {
      if (errorText) message = errorText;
    }
    throw new Error(message);
  }
  const data = (await response.json()) as GeminiResponseBody;
  const rawText = data.candidates?.[0]?.content?.parts?.find(
    (part) => typeof part.text === "string",
  )?.text;
  if (!rawText) throw new Error("Empty response received from Gemini.");
  return rawText;
}

function assetImageParts(currentFiles: GenerationFiles): unknown[] {
  return (currentFiles.assets ?? []).map((asset) => ({
    inline_data: { mime_type: asset.mimeType, data: asset.dataBase64 },
  }));
}

async function requestClientGemini(
  apiKey: string,
  userPrompt: string,
  currentFiles: GenerationFiles,
  repairAttempt: boolean,
): Promise<DirectAiResult> {
  return parseAiResponseText(
    await callClientGemini(
      apiKey,
      MOTIONLY_SYSTEM_PROMPT,
      await buildMotionlyUserMessage(userPrompt, currentFiles),
      repairAttempt ? 0.35 : 0.65,
      assetImageParts(currentFiles),
    ),
  );
}

async function requestBackend(
  userPrompt: string,
  currentFiles: GenerationFiles,
  repairAttempt: boolean,
): Promise<DirectAiResult> {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userPrompt, currentFiles, repairAttempt }),
  });
  if (!response.ok) {
    let message = `Server error (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(message);
  }
  return parseAiResponseText(JSON.stringify(await response.json()));
}

/**
 * The direction turn, over whichever transport this deployment uses.
 *
 * Its failures are deliberately swallowed by the caller: a film built without
 * a direction pass is the film this app shipped before there was one, and that
 * is a far better outcome than an error where a video should be.
 */
async function requestDirection(
  apiKey: string,
  userPrompt: string,
  currentFiles: GenerationFiles,
): Promise<FilmDirection | null> {
  const message = buildDirectionUserMessage({
    userPrompt,
    conversation: currentFiles.conversation,
    assetNames: (currentFiles.assets ?? []).map((asset) => asset.name),
  });
  const rawText = apiKey
    ? await callClientGemini(
        apiKey,
        DIRECTION_SYSTEM_PROMPT,
        message,
        0.85,
        assetImageParts(currentFiles),
      )
    : await requestBackendDirection(message);
  return parseDirectionResponse(rawText);
}

async function requestBackendDirection(userMessage: string): Promise<string> {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "direction", directionMessage: userMessage }),
  });
  if (!response.ok) throw new Error(`Server error (${response.status})`);
  const body = (await response.json()) as { text?: string };
  if (!body.text) throw new Error("Empty direction response.");
  return body.text;
}

/**
 * Model round trips spent trying to lift a weak generation. Two is where the
 * curve flattens: the first pass fixes most named failures, the second catches
 * what it traded away, and a third mostly re-rolls work that was already fine.
 */
const MAX_REPAIR_PASSES = 3;

/**
 * What mounting and seeking the candidate revealed.
 *
 * The render checks are the strongest ones this pipeline has — they watch real
 * frames instead of reading source — and they used to run after generation had
 * already returned, so their findings reached the user as a raw error with a
 * Fix button rather than as one more thing the repair loop knows how to work
 * on. Folding them in makes the checks that matter most the ones that actually
 * drive a repair.
 */
export type RenderVerdict =
  | { ok: true }
  | {
      ok: false;
      message: string;
      /**
       * Whether shipping this anyway would leave the user with nothing usable —
       * a composition that renders no frame, or an edit that would destroy
       * layers they shaped by hand. Everything else is a film they can watch,
       * judge and ask us to change, which is worth more than an empty canvas.
       */
      fatal: boolean;
    };

export type RenderCheck = (
  candidate: DirectAiResult,
) => Promise<RenderVerdict> | RenderVerdict;

/** Applies the deterministic markup repairs before anything is scored. */
function graded(result: DirectAiResult): DirectAiResult {
  return repairGeneratedMarkup(result).result;
}

/**
 * A repair pass is only kept if it actually helps. Clearing a blocking failure
 * outranks a higher score, because score rewards breadth while blocking issues
 * are the ones that make a film unusable.
 */
function isImprovement(
  candidate: MotionQualityReport,
  incumbent: MotionQualityReport,
): boolean {
  if (candidate.blockingIssues.length !== incumbent.blockingIssues.length) {
    return candidate.blockingIssues.length < incumbent.blockingIssues.length;
  }
  return candidate.score > incumbent.score;
}

/**
 * Shipping an imperfect film with an honest note beats handing the user an
 * error and an empty canvas: they can watch it, edit it, or ask for a change,
 * and every one of those is further along than a blocked generation.
 */
function withQualityNote(reply: string, report: MotionQualityReport): string {
  const remaining = [
    ...report.blockingIssues,
    ...report.issues.filter((issue) => !report.blockingIssues.includes(issue)),
  ].slice(0, 3);
  if (remaining.length === 0) return reply;
  return `${reply}\n\nStill worth a look: ${remaining.join("; ")}. Tell me which one to take on and I will rework that part.`;
}

export async function generateWithDirectAi(
  userPrompt: string,
  currentFiles: GenerationFiles,
  onProgress?: (status: string) => void,
  checkRender?: RenderCheck,
): Promise<DirectAiResult> {
  const clientApiKey = getClientGeminiApiKey();
  const request = clientApiKey
    ? (prompt: string, files: GenerationFiles, repair: boolean) =>
        requestClientGemini(clientApiKey, prompt, files, repair)
    : requestBackend;
  const directionPrompt =
    currentFiles.directionPrompt ??
    [currentFiles.previousPlan?.subject, userPrompt].filter(Boolean).join("\n");
  const qualityContext = {
    prompt: directionPrompt,
    requiredAssetTokens: (currentFiles.assets ?? []).map(
      (asset) => asset.token,
    ),
    // The bundled foundation's layers are scaffolding meant to be replaced, so
    // nothing on screen is worth protecting until the user's own film exists.
    protectedEditIds:
      currentFiles.generationProfile === "claude-foundation-v1"
        ? []
        : userEditedIds(currentFiles.editorState),
    previousEditIds:
      currentFiles.generationProfile === "claude-foundation-v1"
        ? []
        : editIdsIn(currentFiles.compositionHtml ?? ""),
  };

  /**
   * The direction turn runs for a new film, not for an edit. A follow-up
   * already has an accepted film on screen and carries it forward through
   * `previousPlan`; re-directing it would re-cut beats the user has kept.
   */
  let buildFiles = currentFiles;
  if (
    currentFiles.generationProfile === "claude-foundation-v1" &&
    directionPassEnabled()
  ) {
    onProgress?.("Writing the creative direction: story, ground, and seams...");
    try {
      const direction = await requestDirection(
        clientApiKey,
        userPrompt,
        currentFiles,
      );
      if (direction) {
        buildFiles = {
          ...currentFiles,
          directionBrief: formatDirectionBrief(direction),
        };
      }
    } catch {
      // No direction is a weaker film, not a failed one. Build it anyway.
    }
  }

  onProgress?.(
    buildFiles.directionBrief
      ? "Building the film from the accepted direction..."
      : "Planning scenes, spatial regions, and the camera path before animation...",
  );
  /**
   * A candidate's full verdict: what the source says about it, and what
   * mounting it actually showed. A render failure is folded in as a blocking
   * issue so it forces a repair pass and lands at the top of the repair prompt,
   * where the model reads the concrete frame-level complaint first.
   */
  const assess = async (
    candidate: DirectAiResult,
  ): Promise<{ report: MotionQualityReport; render: RenderVerdict }> => {
    const report = analyzeMotionQuality(candidate, qualityContext);
    const render: RenderVerdict = checkRender
      ? await checkRender(candidate)
      : { ok: true };
    if (render.ok) return { report, render };
    return {
      report: {
        ...report,
        issues: [render.message, ...report.issues],
        blockingIssues: [render.message, ...report.blockingIssues],
        requiresRepair: true,
      },
      render,
    };
  };

  let best = graded(await request(userPrompt, buildFiles, false));
  let assessment = await assess(best);
  let bestReport = assessment.report;
  let bestRender = assessment.render;

  for (
    let pass = 1;
    pass <= MAX_REPAIR_PASSES && bestReport.requiresRepair;
    pass += 1
  ) {
    onProgress?.(
      bestRender.ok
        ? pass === 1
          ? "Repairing scene composition, camera causality, and continuity..."
          : `Pass ${pass} on the checks that are still open...`
        : `Watching the film back and repairing what it shows (pass ${pass})...`,
    );
    let candidate: DirectAiResult;
    try {
      candidate = graded(
        await request(
          buildQualityRepairPrompt(userPrompt, best, bestReport),
          {
            ...buildFiles,
            directionPrompt,
            generationProfile: "existing",
            compositionHtml: best.compositionHtml,
            timelineJs: best.timelineJs,
          },
          true,
        ),
      );
    } catch {
      // The repair round trip failed. The pass we already hold still ships.
      break;
    }
    const candidateAssessment = await assess(candidate);
    const improved = isImprovement(candidateAssessment.report, bestReport);
    if (improved) {
      best = candidate;
      bestReport = candidateAssessment.report;
      bestRender = candidateAssessment.render;
    }
    /**
     * A pass that did not move the report will not be rescued by another one —
     * unless what is still open is a render failure, where the previous prompt
     * carried a frame-level complaint the model may simply have missed. Those
     * are worth the remaining passes; a stalled source-only report is not.
     */
    if (!improved && bestRender.ok) break;
  }

  // Everything the loop could do is done. A film that still cannot render at
  // all is an error; one that renders but falls short is shipped with the
  // complaint attached, because the user can watch that one and tell us which
  // part to take on.
  if (!bestRender.ok && bestRender.fatal) {
    throw new Error(bestRender.message);
  }

  onProgress?.(
    bestReport.issues.length === 0
      ? "Quality gate passed. Applying composition..."
      : "Applying the strongest pass...",
  );
  return {
    ...best,
    quality: bestReport,
    reply: withQualityNote(best.reply, bestReport),
  };
}

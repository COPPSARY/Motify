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
import { buildQualityRepairPrompt, targetedIssues } from "./repair-prompt";
import {
  MAX_EVIDENCE_FRAMES,
  NO_OBSERVATION,
  type FilmObservation,
  type FrameEvidence,
} from "./frame-evidence";
import { isFatalRenderFailure } from "./validate-generation";
import { ProjectsApi } from "../cloud/projects-api";
import {
  callAiProvider,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  normalizeAiProvider,
  normalizeGeminiModel,
  type AiProvider,
} from "./provider";

export {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  normalizeGeminiModel,
};
export type { AiProvider };

export type DirectAiResult = GeneratedComposition & {
  backendProjectId?: string;
};

export class BackendConversationResponse extends Error {
  constructor(
    readonly type: "chat" | "plan",
    readonly response: string,
    readonly projectId?: string,
  ) {
    super(response);
    this.name = "BackendConversationResponse";
  }
}

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
export interface ClientAiSettings {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

function clientEnv(): Record<string, string | undefined> {
  return import.meta.env as Record<string, string | undefined>;
}

export function getClientAiSettings(): ClientAiSettings {
  const env = clientEnv();
  const provider = normalizeAiProvider(env["VITE_AI_PROVIDER"]);
  if (provider === "openai-compatible") {
    return {
      provider,
      apiKey: (env["VITE_OPENAI_COMPATIBLE_API_KEY"] ?? "").trim(),
      model:
        (env["VITE_OPENAI_COMPATIBLE_MODEL"] ?? "").trim() ||
        DEFAULT_OPENAI_COMPATIBLE_MODEL,
      baseUrl: (env["VITE_OPENAI_COMPATIBLE_BASE_URL"] ?? "").trim(),
    };
  }
  return {
    provider,
    apiKey: getClientGeminiApiKey(),
    model: getClientGeminiModel(),
    baseUrl: "",
  };
}

export function getClientGeminiApiKey(): string {
  const env = clientEnv();
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
  const env = clientEnv();
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
        reply: replyMatch?.[1] ?? "Updated the composition.",
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

/**
 * One provider call, returning raw text. Both turns use it: the direction turn
 * parses a small plan out of it, the build turn a whole composition.
 */
async function callClientProvider(
  settings: ClientAiSettings,
  systemPrompt: string,
  userMessage: string,
  temperature: number,
  currentFiles: GenerationFiles,
): Promise<string> {
  return callAiProvider({
    provider: settings.provider,
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl || undefined,
    systemPrompt,
    userMessage,
    temperature,
    // The user's own images first, then the frames of the candidate being
    // repaired. The repair prompt introduces them by that position.
    assets: [
      ...(currentFiles.assets ?? []),
      ...(currentFiles.evidenceFrames ?? []),
    ],
  });
}

async function requestClientProvider(
  settings: ClientAiSettings,
  userPrompt: string,
  currentFiles: GenerationFiles,
  repairAttempt: boolean,
): Promise<DirectAiResult> {
  return parseAiResponseText(
    await callClientProvider(
      settings,
      MOTIONLY_SYSTEM_PROMPT,
      await buildMotionlyUserMessage(userPrompt, currentFiles),
      repairAttempt ? 0.35 : 0.65,
      currentFiles,
    ),
  );
}

async function requestBackend(
  userPrompt: string,
  currentFiles: GenerationFiles,
  repairAttempt: boolean,
): Promise<DirectAiResult> {
  const userMessage = await buildMotionlyUserMessage(userPrompt, currentFiles);
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPrompt,
      currentFiles,
      repairAttempt,
      localProviderRequest: {
        systemPrompt: MOTIONLY_SYSTEM_PROMPT,
        userMessage,
        temperature: repairAttempt ? 0.35 : 0.65,
        assets: currentFiles.assets,
      },
    }),
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
  const body = (await response.json()) as { rawText?: string };
  return parseAiResponseText(body.rawText ?? JSON.stringify(body));
}

async function requestBackendProject(
  projectId: string,
  userPrompt: string,
  assets: GenerationFiles["assets"],
  frames: readonly FrameEvidence[] = [],
  audioTrackIds: GenerationFiles["audioTrackIds"] = [],
): Promise<DirectAiResult> {
  const api = new ProjectsApi();
  const uploadedAssets = (assets ?? []).flatMap((asset) =>
    asset.uploadId
      ? [
          {
            assetId: asset.uploadId,
            role:
              asset.intent === "reference"
                ? ("reference" as const)
                : ("asset" as const),
          },
        ]
      : [],
  );
  const result = await api.sendMotionMessage(projectId, {
    message: userPrompt,
    ...(uploadedAssets.length > 0 ? { assets: uploadedAssets } : {}),
    ...(frames.length > 0
      ? {
          frames: frames.map((frame) => ({
            capturedAtSeconds: frame.time,
            mediaType: frame.mimeType as "image/jpeg",
            dataBase64: frame.dataBase64,
          })),
        }
      : {}),
    ...(audioTrackIds.length > 0
      ? { audio: audioTrackIds.map((trackId) => ({ trackId })) }
      : {}),
  });
  if (result.type !== "generation") {
    throw new BackendConversationResponse(
      result.type,
      result.response,
      result.projectId ?? projectId,
    );
  }
  const files = await api.getSource(result.projectId ?? projectId);
  const project = await api.getProject(result.projectId ?? projectId);
  return {
    title: project.name,
    duration: project.duration,
    scenes: project.scenes,
    compositionHtml: files["composition.html"],
    timelineJs: files["timeline.js"],
    reply: result.response,
    backendProjectId: project.id,
  };
}

/**
 * The direction turn, over whichever transport this deployment uses.
 *
 * Its failures are deliberately swallowed by the caller: a film built without
 * a direction pass is the film this app shipped before there was one, and that
 * is a far better outcome than an error where a video should be.
 */
async function requestDirection(
  settings: ClientAiSettings,
  userPrompt: string,
  currentFiles: GenerationFiles,
): Promise<FilmDirection | null> {
  const message = buildDirectionUserMessage({
    userPrompt,
    conversation: currentFiles.conversation,
    assetNames: (currentFiles.assets ?? []).map((asset) => asset.name),
  });
  const rawText = settings.apiKey
    ? await callClientProvider(
        settings,
        DIRECTION_SYSTEM_PROMPT,
        message,
        0.85,
        currentFiles,
      )
    : await requestBackendDirection(message);
  return parseDirectionResponse(rawText);
}

async function requestBackendDirection(userMessage: string): Promise<string> {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "direction",
      directionMessage: userMessage,
      localProviderRequest: {
        systemPrompt: DIRECTION_SYSTEM_PROMPT,
        userMessage,
        temperature: 0.85,
      },
    }),
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
 * A cloud repair is a whole backend generation - another model call, another
 * half minute - where a local one is a client round trip. The first pass is
 * where nearly all of the improvement is, so cloud projects get that one and
 * ship whatever it produces.
 */
const MAX_BACKEND_REPAIR_PASSES = 1;

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
       * a composition with no rendered frame or an empty declared scene, or an
       * edit that would destroy layers they shaped by hand. Everything else is
       * a film they can watch, judge and ask us to change.
       */
      fatal: boolean;
    };

export type RenderCheck = (
  candidate: DirectAiResult,
) => Promise<RenderVerdict> | RenderVerdict;

/**
 * Mounts the candidate a repair is about and reports what it shows.
 *
 * Separate from `RenderCheck` because the two run on different schedules:
 * every candidate is checked, but only a candidate that is about to be
 * repaired is looked at, and only then is the complaint list it should be
 * looked at against known. Mounting and measuring need a DOM, so the editor
 * supplies this.
 *
 * It returns both halves: the measurements, which ride the prompt text, and
 * the rendered frames, which ride as images. Every transport this editor
 * speaks can carry both.
 */
export type FilmObserver = (
  candidate: DirectAiResult,
  complaints: readonly string[],
) => Promise<FilmObservation>;

/** Applies the deterministic markup repairs before anything is scored. */
function graded(result: DirectAiResult): DirectAiResult {
  return repairGeneratedMarkup(result).result;
}

/**
 * A repair pass is only kept if it actually helps. Clearing a blocking failure
 * outranks a higher score, because score rewards breadth while blocking issues
 * are the ones that make a film unusable.
 */
/**
 * Blocking issues that leave the film unusable rather than merely flawed: it
 * does not parse, renders no frame, or holds an empty declared beat.
 */
function fatalCount(report: MotionQualityReport): number {
  return report.blockingIssues.filter(isFatalRenderFailure).length;
}

export function isImprovement(
  candidate: MotionQualityReport,
  incumbent: MotionQualityReport,
): boolean {
  /**
   * Severity before count. Comparing only how many blocking issues each pass
   * carries let a film that does not run displace one that does: a candidate
   * whose single blocking issue was "timeline.js does not parse as JavaScript"
   * beat an incumbent holding two lesser complaints, because one is fewer than
   * two. A live flash-lite run degraded 73 -> 31 exactly this way. A pass that
   * is fatal in a way the incumbent is not can never be an improvement, however
   * short its list.
   */
  const candidateFatal = fatalCount(candidate);
  const incumbentFatal = fatalCount(incumbent);
  if (candidateFatal !== incumbentFatal) return candidateFatal < incumbentFatal;
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
  observeFilm?: FilmObserver,
): Promise<DirectAiResult> {
  const settings = getClientAiSettings();
  const backendProjectId = currentFiles.backendProjectId;
  const request = backendProjectId
    ? (prompt: string, files: GenerationFiles) =>
        requestBackendProject(
          backendProjectId,
          prompt,
          currentFiles.assets,
          files.evidenceFrames,
          currentFiles.audioTrackIds,
        )
    : settings.apiKey
      ? (prompt: string, files: GenerationFiles, repair: boolean) =>
          requestClientProvider(settings, prompt, files, repair)
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
    !currentFiles.backendProjectId &&
    currentFiles.generationProfile === "claude-foundation-v1" &&
    directionPassEnabled()
  ) {
    onProgress?.("Writing the creative direction: story, ground, and seams...");
    try {
      const direction = await requestDirection(
        settings,
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

  /**
   * What mounting the candidate showed.
   *
   * Every transport carries both halves. The measurements ride the prompt, so
   * they reach a model however the request is routed; the frames ride as
   * images, which the client providers take directly and the cloud takes as
   * inline frames on the project message. An observation that fails is not a
   * failed generation: the repair goes out with its sentences, exactly as it
   * did before there was anything to look at.
   */
  const observe = async (
    candidate: DirectAiResult,
    complaints: readonly string[],
  ): Promise<FilmObservation> => {
    if (!observeFilm) return NO_OBSERVATION;
    try {
      const observed = await observeFilm(candidate, complaints);
      return {
        account: observed.account,
        frames: observed.frames.slice(0, MAX_EVIDENCE_FRAMES),
      };
    } catch {
      return NO_OBSERVATION;
    }
  };

  const initial = await request(userPrompt, buildFiles, false);
  const maxPasses = backendProjectId
    ? MAX_BACKEND_REPAIR_PASSES
    : MAX_REPAIR_PASSES;

  let best = graded(initial);
  let assessment = await assess(best);
  let bestReport = assessment.report;
  let bestRender = assessment.render;

  for (
    let pass = 1;
    pass <= maxPasses && bestReport.requiresRepair;
    pass += 1
  ) {
    onProgress?.(
      bestRender.ok
        ? pass === 1
          ? "Repairing scene composition, camera causality, and continuity..."
          : `Pass ${pass} on the checks that are still open...`
        : `Watching the film back and repairing what it shows (pass ${pass})...`,
    );
    const complaints = targetedIssues(bestReport);
    const observation = await observe(best, complaints);
    let candidate: DirectAiResult;
    try {
      candidate = graded(
        await request(
          buildQualityRepairPrompt(userPrompt, best, bestReport, observation),
          {
            ...buildFiles,
            directionPrompt,
            generationProfile: "existing",
            compositionHtml: best.compositionHtml,
            timelineJs: best.timelineJs,
            evidenceFrames: observation.frames,
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

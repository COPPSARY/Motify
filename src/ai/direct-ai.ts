import { repairGeneratedMarkup } from "./auto-repair";
import {
  analyzeMotionQuality,
  buildMotionlyUserMessage,
  buildQualityRepairPrompt,
  type GeneratedComposition,
  type GenerationFiles,
  type MotionQualityReport,
} from "./generation-guidance";
import { MOTIONLY_SYSTEM_PROMPT } from "./prompt";

export type DirectAiResult = GeneratedComposition;

export function normalizeGeminiModel(rawModel: string): string {
  let model = rawModel.trim().replace(/^models\//, "");
  model = model.replace(/\s+/g, "-");
  if (!model.startsWith("gemini-") && !model.startsWith("gemma-")) {
    model = `gemini-${model}`;
  }
  model = model.replace(/gemini-(\d+)-(\d+)/g, "gemini-$1.$2");
  return !model || model === "gemini-" ? "gemini-3.5-flash-lite" : model;
}

export function getClientGeminiApiKey(): string {
  if (typeof window !== "undefined") {
    const customKey = localStorage.getItem("motionly_gemini_api_key");
    if (customKey?.trim()) return customKey.trim();
  }
  const env = import.meta.env as Record<string, string | undefined>;
  return (env["VITE_GEMINI_API_KEY"] ?? "").trim();
}

export function getClientGeminiModel(): string {
  if (typeof window !== "undefined") {
    const customModel = localStorage.getItem("motionly_gemini_model");
    if (customModel?.trim()) return customModel.trim();
  }
  const env = import.meta.env as Record<string, string | undefined>;
  return (env["VITE_GEMINI_MODEL"] ?? "").trim() || "gemini-3.5-flash-lite";
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
    scenes: parsed.scenes,
    direction: parsed.direction,
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

async function requestClientGemini(
  apiKey: string,
  userPrompt: string,
  currentFiles: GenerationFiles,
  repairAttempt: boolean,
): Promise<DirectAiResult> {
  const model = normalizeGeminiModel(getClientGeminiModel());
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig: Record<string, unknown> = {
    response_mime_type: "application/json",
    temperature: repairAttempt ? 0.35 : 0.65,
    maxOutputTokens: 24576,
  };
  if (model.includes("3.7")) {
    generationConfig["thinking_config"] = { thinking_budget: 0 };
  }

  const imageParts = (currentFiles.assets ?? []).map((asset) => ({
    inline_data: {
      mime_type: asset.mimeType,
      data: asset.dataBase64,
    },
  }));
  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: MOTIONLY_SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: buildMotionlyUserMessage(userPrompt, currentFiles) },
            ...imageParts,
          ],
        },
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
  return parseAiResponseText(rawText);
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
 * Model round trips spent trying to lift a weak generation. Two is where the
 * curve flattens: the first pass fixes most named failures, the second catches
 * what it traded away, and a third mostly re-rolls work that was already fine.
 */
const MAX_REPAIR_PASSES = 2;

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
): Promise<DirectAiResult> {
  const clientApiKey = getClientGeminiApiKey();
  const request = clientApiKey
    ? (prompt: string, files: GenerationFiles, repair: boolean) =>
        requestClientGemini(clientApiKey, prompt, files, repair)
    : requestBackend;
  const qualityContext = {
    prompt: userPrompt,
    requiredAssetTokens: (currentFiles.assets ?? []).map(
      (asset) => asset.token,
    ),
  };

  onProgress?.(
    "Planning scenes, spatial regions, and the camera path before animation...",
  );
  let best = graded(await request(userPrompt, currentFiles, false));
  let bestReport = analyzeMotionQuality(best, qualityContext);

  for (
    let pass = 1;
    pass <= MAX_REPAIR_PASSES && bestReport.requiresRepair;
    pass += 1
  ) {
    onProgress?.(
      pass === 1
        ? "Repairing scene composition, camera causality, and continuity..."
        : "Second pass on the checks that are still open...",
    );
    let candidate: DirectAiResult;
    try {
      candidate = graded(
        await request(
          buildQualityRepairPrompt(userPrompt, best, bestReport),
          {
            ...currentFiles,
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
    const candidateReport = analyzeMotionQuality(candidate, qualityContext);
    const improved = isImprovement(candidateReport, bestReport);
    if (improved) {
      best = candidate;
      bestReport = candidateReport;
    }
    // A pass that did not move the report will not be rescued by another one.
    if (!improved) break;
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

import {
  analyzeMotionQuality,
  buildMotionlyUserMessage,
  buildQualityRepairPrompt,
  type GeneratedComposition,
  type GenerationFiles,
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

  onProgress?.(
    "Planning scenes, spatial regions, and the camera path before animation...",
  );
  const first = await request(userPrompt, currentFiles, false);
  const firstReport = analyzeMotionQuality(first);
  if (!firstReport.requiresRepair) {
    onProgress?.("Quality gate passed. Applying composition...");
    return first;
  }

  onProgress?.(
    "Repairing scene composition, camera causality, and continuity...",
  );
  try {
    const repairPrompt = buildQualityRepairPrompt(
      userPrompt,
      first,
      firstReport,
    );
    const repaired = await request(
      repairPrompt,
      {
        ...currentFiles,
        compositionHtml: first.compositionHtml,
        timelineJs: first.timelineJs,
      },
      true,
    );
    const repairedReport = analyzeMotionQuality(repaired);
    return repairedReport.score >= firstReport.score ? repaired : first;
  } catch {
    // A usable first generation is better than failing the whole request because
    // the optional quality-repair pass was unavailable.
    return first;
  }
}

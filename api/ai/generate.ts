export const maxDuration = 60;

import { DIRECTION_SYSTEM_PROMPT } from "../../src/ai/direction-pass";
import { buildMotionlyUserMessage } from "../../src/ai/generation-guidance";
import {
  callAiProvider,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  normalizeAiProvider,
  type AiProvider,
} from "../../src/ai/provider";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import {
  requireMotifySession,
  UnauthenticatedGenerationError,
} from "../../src/ai/require-session";

interface GenerateBody {
  userPrompt?: string;
  repairAttempt?: boolean;
  mode?: "direction";
  directionMessage?: string;
  currentFiles?: {
    compositionHtml?: string;
    timelineJs?: string;
    stylesCss?: string;
    indexTs?: string;
    conversation?: readonly { role: "user" | "assistant"; text: string }[];
    editorState?: Record<string, unknown>;
    assets?: readonly {
      id: string;
      name: string;
      mimeType: string;
      dataBase64: string;
      token: string;
    }[];
    /**
     * Frames of the candidate a repair pass is fixing, rendered by the editor.
     * They follow the user's own images, which is the position the repair
     * prompt introduces them by.
     */
    evidenceFrames?: readonly {
      time: number;
      mimeType: string;
      dataBase64: string;
    }[];
  };
}

function providerConfig(): {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
} {
  const provider = normalizeAiProvider(process.env["AI_PROVIDER"]);
  if (provider === "openai-compatible") {
    return {
      provider,
      apiKey: (
        process.env["OPENAI_COMPATIBLE_API_KEY"] ??
        process.env["CODECRAFT_API_KEY"] ??
        ""
      ).trim(),
      model:
        process.env["OPENAI_COMPATIBLE_MODEL"]?.trim() ||
        DEFAULT_OPENAI_COMPATIBLE_MODEL,
      baseUrl: process.env["OPENAI_COMPATIBLE_BASE_URL"]?.trim(),
    };
  }
  return {
    provider,
    apiKey: (process.env["GEMINI_API_KEY"] ?? "").trim(),
    model: process.env["GEMINI_MODEL"]?.trim() || DEFAULT_GEMINI_MODEL,
  };
}

function parseComposition(rawText: string): unknown {
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

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    try {
      return JSON.parse(cleaned.replace(/,\s*([}\]])/g, "$1")) as unknown;
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
        throw new Error("Failed to parse AI response JSON.");
      }
      return {
        title: titleMatch?.[1] ?? "AI Generated Video",
        duration: durationMatch?.[1] ? parseFloat(durationMatch[1]) : 20,
        compositionHtml: unescapeJsonString(htmlMatch[1]),
        timelineJs: unescapeJsonString(jsMatch[1]),
        reply:
          replyMatch?.[1] ??
          "Updated composition with full-span temporal choreography.",
      };
    }
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    await requireMotifySession(
      req.headers.get("cookie") ?? undefined,
      process.env as Record<string, string | undefined>,
    );

    const body = (await req.json()) as GenerateBody;
    const currentFiles = body.currentFiles ?? {};
    const isDirection = body.mode === "direction";
    const userMessage = isDirection
      ? (body.directionMessage ?? "")
      : await buildMotionlyUserMessage(body.userPrompt ?? "", currentFiles);
    if (isDirection && !userMessage) {
      return Response.json(
        { error: "Missing directionMessage." },
        { status: 400 },
      );
    }

    const config = providerConfig();
    if (!config.apiKey) {
      const variable =
        config.provider === "gemini"
          ? "GEMINI_API_KEY"
          : "OPENAI_COMPATIBLE_API_KEY";
      return Response.json(
        { error: `Missing ${variable} in Vercel environment variables.` },
        { status: 400 },
      );
    }

    const rawText = await callAiProvider({
      ...config,
      systemPrompt: isDirection
        ? DIRECTION_SYSTEM_PROMPT
        : MOTIONLY_SYSTEM_PROMPT,
      userMessage,
      temperature: isDirection ? 0.85 : body.repairAttempt ? 0.35 : 0.65,
      assets: [
        ...(currentFiles.assets ?? []),
        ...(currentFiles.evidenceFrames ?? []),
      ],
    });

    return Response.json(
      isDirection ? { text: rawText } : parseComposition(rawText),
    );
  } catch (error: unknown) {
    if (error instanceof UnauthenticatedGenerationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal AI generation error",
      },
      { status: 500 },
    );
  }
}

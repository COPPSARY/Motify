import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import type { Connect } from "vite";
import { DIRECTION_SYSTEM_PROMPT } from "./direction-pass";
import { buildMotionlyUserMessage } from "./generation-guidance";
import {
  callAiProvider,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  normalizeAiProvider,
} from "./provider";
import { MOTIONLY_SYSTEM_PROMPT } from "./prompt";
import {
  requireMotifySession,
  UnauthenticatedGenerationError,
} from "./require-session";

export function loadSkillsPrompt(): string {
  return MOTIONLY_SYSTEM_PROMPT;
}

export { MOTIONLY_SYSTEM_PROMPT };

function getLiveEnv(
  fallbackEnv: Record<string, string>,
): Record<string, string> {
  const envMap: Record<string, string> = {};
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    try {
      for (const line of readFileSync(envPath, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const equals = trimmed.indexOf("=");
        if (equals === -1) continue;
        const key = trimmed.slice(0, equals).trim();
        let value = trimmed.slice(equals + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        envMap[key] = value;
      }
    } catch {
      // Keep the environment Vite loaded at startup.
    }
  }
  return { ...process.env, ...fallbackEnv, ...envMap } as Record<
    string,
    string
  >;
}

interface RequestLike {
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  on?: (event: string, callback: (chunk?: unknown) => void) => void;
  url?: string;
  method?: string;
}

interface ResponseLike {
  status?: (code: number) => ResponseLike;
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
  json?: (data: unknown) => void;
  end?: (data?: string) => void;
}

interface RequestPayload {
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

function sendJson(res: ResponseLike, status: number, data: unknown): void {
  if (typeof res.status === "function") res.status(status);
  else res.statusCode = status;
  res.setHeader?.("Content-Type", "application/json");
  if (typeof res.json === "function") res.json(data);
  else res.end?.(JSON.stringify(data));
}

async function readBody(req: RequestLike): Promise<RequestPayload> {
  if (req.body && typeof req.body === "object") {
    return req.body as RequestPayload;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body) as RequestPayload;
    } catch {
      return {};
    }
  }
  if (typeof req.on !== "function") return {};
  const raw = await new Promise<string>((done) => {
    let value = "";
    req.on?.("data", (chunk: unknown) => {
      value += String(chunk);
    });
    req.on?.("end", () => done(value));
  });
  try {
    return raw.trim() ? (JSON.parse(raw) as RequestPayload) : {};
  } catch {
    return {};
  }
}

function parseComposition(rawText: string): unknown {
  let cleaned = rawText.trim();
  const block = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(cleaned);
  if (block?.[1]) cleaned = block[1].trim();
  else {
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

export async function handleAiGenerateRequest(
  req: RequestLike,
  res: ResponseLike,
  initialEnv: Record<string, string> = {},
): Promise<void> {
  const startedAt = Date.now();
  try {
    const env = getLiveEnv(initialEnv);
    const cookieHeader = req.headers?.["cookie"];
    await requireMotifySession(
      Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader,
      env,
    );

    const body = await readBody(req);
    const currentFiles = body.currentFiles ?? {};
    const provider = normalizeAiProvider(env["AI_PROVIDER"]);
    const apiKey =
      (provider === "gemini"
        ? env["GEMINI_API_KEY"]
        : env["OPENAI_COMPATIBLE_API_KEY"] || env["CODECRAFT_API_KEY"]
      )?.trim() ?? "";
    const model =
      provider === "gemini"
        ? env["GEMINI_MODEL"]?.trim() || DEFAULT_GEMINI_MODEL
        : env["OPENAI_COMPATIBLE_MODEL"]?.trim() ||
          DEFAULT_OPENAI_COMPATIBLE_MODEL;
    const baseUrl =
      provider === "openai-compatible"
        ? env["OPENAI_COMPATIBLE_BASE_URL"]?.trim()
        : undefined;

    if (!apiKey) {
      sendJson(res, 400, {
        error: `Missing ${provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_COMPATIBLE_API_KEY"} in .env or deployment environment variables.`,
      });
      return;
    }

    const isDirection = body.mode === "direction";
    const userMessage = isDirection
      ? (body.directionMessage ?? "")
      : await buildMotionlyUserMessage(body.userPrompt ?? "", currentFiles);
    if (isDirection && !userMessage) {
      sendJson(res, 400, { error: "Missing directionMessage." });
      return;
    }

    console.warn(`[Motify AI] Request dispatched to ${provider} (${model})`);
    const rawText = await callAiProvider({
      provider,
      apiKey,
      model,
      baseUrl,
      systemPrompt: isDirection ? DIRECTION_SYSTEM_PROMPT : loadSkillsPrompt(),
      userMessage,
      temperature: isDirection ? 0.85 : body.repairAttempt ? 0.35 : 0.65,
      assets: [
        ...(currentFiles.assets ?? []),
        ...(currentFiles.evidenceFrames ?? []),
      ],
    });
    sendJson(
      res,
      200,
      isDirection ? { text: rawText } : parseComposition(rawText),
    );
    console.warn(
      `[Motify AI] Completed ${provider} generation in ${Date.now() - startedAt}ms`,
    );
  } catch (error: unknown) {
    if (error instanceof UnauthenticatedGenerationError) {
      sendJson(res, error.status, { error: error.message });
      return;
    }
    console.error("[Motify AI] Error:", error);
    sendJson(res, 500, {
      error:
        error instanceof Error ? error.message : "Internal AI generation error",
    });
  }
}

export function createAiMiddleware(
  initialEnv: Record<string, string>,
): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/ai/generate") {
      next();
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method Not Allowed" });
      return;
    }
    await handleAiGenerateRequest(req, res, initialEnv);
  };
}

/** Kept for integrations that imported the original middleware name. */
export const createGeminiMiddleware = createAiMiddleware;

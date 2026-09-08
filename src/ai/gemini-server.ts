import type { Connect } from "vite";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { buildMotionlyUserMessage } from "./generation-guidance";
import { MOTIONLY_SYSTEM_PROMPT } from "./prompt";

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
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          envMap[key] = val;
        }
      }
    } catch {
      // fallback
    }
  }
  return { ...process.env, ...fallbackEnv, ...envMap } as Record<
    string,
    string
  >;
}

function normalizeGeminiModel(rawModel: string): string {
  let model = rawModel.trim().replace(/^models\//, "");
  model = model.replace(/\s+/g, "-");
  if (!model.startsWith("gemini-") && !model.startsWith("gemma-")) {
    model = `gemini-${model}`;
  }
  // Correct hyphen typos to dots (e.g. gemini-3-5-flash-lite -> gemini-3.5-flash-lite)
  model = model.replace(/gemini-(\d+)-(\d+)/g, "gemini-$1.$2");
  if (!model || model === "gemini-") {
    return "gemini-3.5-flash";
  }
  return model;
}

interface RequestLike {
  body?: unknown;
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

function sendJson(res: ResponseLike, status: number, data: unknown): void {
  if (typeof res.status === "function") {
    res.status(status);
  } else {
    res.statusCode = status;
  }
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json");
  }
  if (typeof res.json === "function") {
    res.json(data);
  } else if (typeof res.end === "function") {
    res.end(JSON.stringify(data));
  }
}

export async function handleAiGenerateRequest(
  req: RequestLike,
  res: ResponseLike,
  initialEnv: Record<string, string> = {},
): Promise<void> {
  const startTime = Date.now();
  try {
    interface RequestPayload {
      userPrompt?: string;
      model?: string;
      repairAttempt?: boolean;
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
      };
    }
    let bodyObj: RequestPayload | null = null;

    if (req.body && typeof req.body === "object") {
      bodyObj = req.body as RequestPayload;
    } else if (typeof req.body === "string" && req.body.trim()) {
      try {
        bodyObj = JSON.parse(req.body) as RequestPayload;
      } catch {
        // fallback
      }
    }

    if (!bodyObj && typeof req.on === "function") {
      const raw = await new Promise<string>((resolve) => {
        let text = "";
        req.on?.("data", (chunk: unknown) => {
          text += String(chunk);
        });
        req.on?.("end", () => resolve(text));
      });
      if (raw.trim()) {
        try {
          bodyObj = JSON.parse(raw) as RequestPayload;
        } catch {
          // fallback
        }
      }
    }

    const userPrompt = bodyObj?.userPrompt ?? "";
    const currentFiles = bodyObj?.currentFiles ?? {};

    const env = getLiveEnv(initialEnv);
    const apiKey = (
      env["GEMINI_API_KEY"] ||
      process.env["GEMINI_API_KEY"] ||
      ""
    ).trim();
    const rawModel = (
      bodyObj?.model ||
      env["GEMINI_MODEL"] ||
      process.env["GEMINI_MODEL"] ||
      "gemini-3.5-flash"
    ).trim();
    const model = normalizeGeminiModel(rawModel);

    if (!apiKey) {
      sendJson(res, 400, {
        error:
          "Missing GEMINI_API_KEY in .env. Please set GEMINI_API_KEY=your_key in your .env or Vercel environment variables.",
      });
      return;
    }

    const userMessage = await buildMotionlyUserMessage(
      userPrompt,
      currentFiles,
    );

    const systemPrompt = loadSkillsPrompt();
    console.warn(
      `[Motionly AI] 🚀 Request dispatched to Google Gemini (${model})`,
    );

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const generationConfig: Record<string, unknown> = {
      response_mime_type: "application/json",
      temperature: bodyObj?.repairAttempt ? 0.35 : 0.65,
      maxOutputTokens: 65536,
    };

    if (model.includes("3.7")) {
      generationConfig["thinking_config"] = { thinking_budget: 0 };
    }

    // Attempt primary request with system_instruction and JSON mode
    const imageParts = (currentFiles.assets ?? []).map((asset) => ({
      inline_data: {
        mime_type: asset.mimeType,
        data: asset.dataBase64,
      },
    }));
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }, ...imageParts],
          },
        ],
        generationConfig,
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error(
        `[Motionly AI] ❌ Gemini error (${geminiResponse.status}): ${errText}`,
      );
      sendJson(res, geminiResponse.status, {
        error: `Gemini API error: ${errText}`,
      });
      return;
    }

    const data = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const part = data?.candidates?.[0]?.content?.parts?.find(
      (p) => typeof p.text === "string",
    );
    const rawText = part?.text ?? "";

    if (!rawText) {
      sendJson(res, 500, {
        error: "Empty response received from Gemini model.",
      });
      return;
    }

    let cleaned = rawText.trim();
    const jsonBlockMatch = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(cleaned);
    if (jsonBlockMatch?.[1]) {
      cleaned = jsonBlockMatch[1].trim();
    } else {
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();
      }
    }

    let parsed: {
      title?: string;
      duration?: number;
      scenes?: Array<{
        id: string;
        label: string;
        start: number;
        duration: number;
        accent: string;
      }>;
      compositionHtml?: string;
      timelineJs?: string;
      reply?: string;
    };

    try {
      parsed = JSON.parse(cleaned);
    } catch (initialErr) {
      try {
        const stripped = cleaned.replace(/,\s*([}\]])/g, "$1");
        parsed = JSON.parse(stripped);
      } catch {
        // Robust regex extraction fallback if JSON parsing has an unescaped character
        console.warn(
          "[Motionly AI] ⚠️ Standard JSON.parse failed, recovering via robust parser...",
        );
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

        function unescapeJsonStr(str: string): string {
          return str
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
        }

        if (htmlMatch?.[1] && jsMatch?.[1]) {
          parsed = {
            title: titleMatch?.[1] ?? "AI Generated Video",
            duration: durationMatch?.[1] ? parseFloat(durationMatch[1]) : 20.0,
            compositionHtml: unescapeJsonStr(htmlMatch[1]),
            timelineJs: unescapeJsonStr(jsMatch[1]),
            reply:
              replyMatch?.[1] ??
              "Updated composition with full-span temporal choreography.",
          };
        } else {
          throw initialErr;
        }
      }
    }

    console.warn(
      `[Motionly AI] ✅ Completed Gemini generation in ${Date.now() - startTime}ms`,
    );
    sendJson(res, 200, parsed);
  } catch (err: unknown) {
    console.error("[Motionly AI] Error:", err);
    sendJson(res, 500, {
      error:
        err instanceof Error ? err.message : "Internal AI generation error",
    });
  }
}

export function createGeminiMiddleware(
  initialEnv: Record<string, string>,
): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url?.split("?")[0];
    if (url !== "/api/ai/generate") {
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

export const createAiMiddleware = createGeminiMiddleware;

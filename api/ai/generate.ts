export const maxDuration = 60;
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import { buildMotionlyUserMessage } from "../../src/ai/generation-guidance";
import { DIRECTION_SYSTEM_PROMPT } from "../../src/ai/direction-pass";

function normalizeGeminiModel(rawModel: string): string {
  let model = rawModel.trim().replace(/^models\//, "");
  model = model.replace(/\s+/g, "-");
  if (!model.startsWith("gemini-") && !model.startsWith("gemma-")) {
    model = `gemini-${model}`;
  }
  model = model.replace(/gemini-(\d+)-(\d+)/g, "gemini-$1.$2");
  if (!model || model === "gemini-") {
    return "gemini-3.5-flash";
  }
  return model;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as {
      userPrompt?: string;
      model?: string;
      repairAttempt?: boolean;
      /** "direction" runs the planning turn and returns its raw text. */
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
      };
    };

    const userPrompt = body.userPrompt ?? "";
    const currentFiles = body.currentFiles ?? {};

    const apiKey = (process.env["GEMINI_API_KEY"] ?? "").trim();
    const rawModel = (
      body.model ||
      process.env["GEMINI_MODEL"] ||
      "gemini-3.5-flash"
    ).trim();
    const model = normalizeGeminiModel(rawModel);

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Missing GEMINI_API_KEY in Vercel environment variables. Please add GEMINI_API_KEY in your Vercel Project Settings.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // The direction turn plans the film and writes no code, so it answers with
    // its raw text and skips the composition system prompt entirely.
    const isDirection = body.mode === "direction";
    const systemPrompt = isDirection
      ? DIRECTION_SYSTEM_PROMPT
      : MOTIONLY_SYSTEM_PROMPT;
    const userMessage = isDirection
      ? (body.directionMessage ?? "")
      : await buildMotionlyUserMessage(userPrompt, currentFiles);
    if (isDirection && !userMessage) {
      return new Response(
        JSON.stringify({ error: "Missing directionMessage." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const generationConfig: Record<string, unknown> = {
      response_mime_type: "application/json",
      temperature: isDirection ? 0.85 : body.repairAttempt ? 0.35 : 0.65,
      maxOutputTokens: 65536,
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
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${errText}` }),
        {
          status: geminiResponse.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const part = data.candidates?.[0]?.content?.parts?.find(
      (p) => typeof p.text === "string",
    );
    const rawText = part?.text ?? "";

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: "Empty response received from Gemini model." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // The direction turn's caller does its own parsing and tolerates a plan
    // that comes back short, so the raw text goes straight back.
    if (isDirection) {
      return new Response(JSON.stringify({ text: rawText }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      try {
        const stripped = cleaned.replace(/,\s*([}\]])/g, "$1");
        parsed = JSON.parse(stripped);
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
          return new Response(
            JSON.stringify({ error: "Failed to parse AI response JSON." }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error ? err.message : "Internal AI generation error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

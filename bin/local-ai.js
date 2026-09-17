import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_OPENAI_MODEL = "claude-opus-4.8";
const MAX_REQUEST_BYTES = 30 * 1024 * 1024;

async function requestJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.byteLength;
    if (size > MAX_REQUEST_BYTES) throw new Error("AI request is too large");
    chunks.push(chunk);
  }
  const source = Buffer.concat(chunks).toString("utf8");
  return source ? JSON.parse(source) : {};
}

async function readEnvironment(projectRoot) {
  const fromFile = {};
  try {
    const source = await readFile(join(projectRoot, ".env"), "utf8");
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equals = trimmed.indexOf("=");
      if (equals < 1) continue;
      const key = trimmed.slice(0, equals).trim();
      let value = trimmed.slice(equals + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      fromFile[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { ...process.env, ...fromFile };
}

function normalizeProvider(value) {
  return /^(?:openai|openai-compatible|codecraft)$/i.test(value ?? "")
    ? "openai-compatible"
    : "gemini";
}

function outputTokens(env, fallback) {
  const value = Number(env.AI_MAX_OUTPUT_TOKENS);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function responseError(response, label) {
  const fallback = `${label} API error (${response.status})`;
  const source = await response.text();
  if (!source) return fallback;
  try {
    const body = JSON.parse(source);
    return typeof body.error === "string"
      ? body.error
      : (body.error?.message ?? body.message ?? fallback);
  } catch {
    return source;
  }
}

async function callGemini(prepared, env) {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey)
    throw new Error("Missing GEMINI_API_KEY in the local project's .env file.");
  const model = (env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL)
    .trim()
    .replace(/^models\//, "");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: prepared.systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: prepared.userMessage },
              ...(prepared.assets ?? []).map((asset) => ({
                inline_data: {
                  mime_type: asset.mimeType,
                  data: asset.dataBase64,
                },
              })),
            ],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: prepared.temperature,
          maxOutputTokens: outputTokens(env, 65536),
        },
      }),
    },
  );
  if (!response.ok) throw new Error(await responseError(response, "Gemini"));
  const body = await response.json();
  const candidate = body.candidates?.[0];
  if (/^MAX_TOKENS$/i.test(candidate?.finishReason ?? "")) {
    throw new Error(
      `The model ran out of output room while writing the composition (${model}).`,
    );
  }
  const text = candidate?.content?.parts?.find(
    (part) => typeof part.text === "string",
  )?.text;
  if (!text) throw new Error("Empty response received from Gemini.");
  return text;
}

function openAiContent(prepared) {
  if (!prepared.assets?.length) return prepared.userMessage;
  return [
    { type: "text", text: prepared.userMessage },
    ...prepared.assets.map((asset) => ({
      type: "image_url",
      image_url: { url: `data:${asset.mimeType};base64,${asset.dataBase64}` },
    })),
  ];
}

async function callOpenAiCompatible(prepared, env) {
  const apiKey = (
    env.OPENAI_COMPATIBLE_API_KEY || env.CODECRAFT_API_KEY
  )?.trim();
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_COMPATIBLE_API_KEY in the local project's .env file.",
    );
  }
  const model = (env.OPENAI_COMPATIBLE_MODEL || DEFAULT_OPENAI_MODEL).trim();
  const baseUrl = (env.OPENAI_COMPATIBLE_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "");
  if (!baseUrl) {
    throw new Error(
      "Missing OPENAI_COMPATIBLE_BASE_URL in the local project's .env file.",
    );
  }
  const payload = {
    model,
    messages: [
      { role: "system", content: prepared.systemPrompt },
      { role: "user", content: openAiContent(prepared) },
    ],
    temperature: prepared.temperature,
    max_tokens: outputTokens(env, 32768),
    response_format: { type: "json_object" },
  };
  let response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await responseError(response, "OpenAI-compatible");
    if (
      (response.status === 400 || response.status === 422) &&
      /response[_ -]?format|json[_ -]?mode|json_object/i.test(message)
    ) {
      const { response_format: _responseFormat, ...fallbackPayload } = payload;
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(fallbackPayload),
      });
    } else {
      throw new Error(message);
    }
  }
  if (!response.ok)
    throw new Error(await responseError(response, "OpenAI-compatible"));
  const body = await response.json();
  const choice = body.choices?.[0];
  if (/^length$/i.test(choice?.finish_reason ?? "")) {
    throw new Error(
      `The model ran out of output room while writing the composition (${model}).`,
    );
  }
  const content = choice?.message?.content;
  const text = Array.isArray(content)
    ? content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
    : content;
  if (!text)
    throw new Error(
      "Empty response received from the OpenAI-compatible model.",
    );
  return text;
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

export async function handleLocalAiRequest(request, response, projectRoot) {
  const pathname = new URL(request.url ?? "/", "http://motionly.local")
    .pathname;
  if (pathname !== "/api/ai/generate") return false;
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method Not Allowed" });
    return true;
  }
  try {
    const body = await requestJson(request);
    const prepared = body.localProviderRequest;
    if (
      !prepared ||
      typeof prepared.systemPrompt !== "string" ||
      typeof prepared.userMessage !== "string"
    ) {
      sendJson(response, 400, {
        error: "This Motify client is too old for the local AI server.",
      });
      return true;
    }
    const env = await readEnvironment(projectRoot);
    const provider = normalizeProvider(env.AI_PROVIDER);
    const text =
      provider === "openai-compatible"
        ? await callOpenAiCompatible(prepared, env)
        : await callGemini(prepared, env);
    sendJson(
      response,
      200,
      body.mode === "direction" ? { text } : { rawText: text },
    );
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return true;
}

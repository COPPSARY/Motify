export type AiProvider = "gemini" | "openai-compatible";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const DEFAULT_OPENAI_COMPATIBLE_MODEL = "claude-opus-4.8";

export interface AiImageAsset {
  mimeType: string;
  dataBase64: string;
}

export interface AiProviderRequest {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  assets?: readonly AiImageAsset[];
}

export function normalizeAiProvider(value: string | undefined): AiProvider {
  const provider = value?.trim().toLowerCase();
  return provider === "openai" ||
    provider === "openai-compatible" ||
    provider === "codecraft"
    ? "openai-compatible"
    : "gemini";
}

export function normalizeGeminiModel(rawModel: string): string {
  let model = rawModel.trim().replace(/^models\//, "");
  model = model.replace(/\s+/g, "-");
  if (!model.startsWith("gemini-") && !model.startsWith("gemma-")) {
    model = `gemini-${model}`;
  }
  model = model.replace(/gemini-(\d+)-(\d+)/g, "gemini-$1.$2");
  return !model || model === "gemini-" ? DEFAULT_GEMINI_MODEL : model;
}

export function normalizeOpenAiCompatibleBaseUrl(rawUrl: string): string {
  let value = rawUrl.trim();
  if (!value) {
    throw new Error(
      "Missing OPENAI_COMPATIBLE_BASE_URL in .env or deployment environment variables.",
    );
  }
  value = value.replace(/\/+$/, "");
  value = value.replace(/\/chat\/completions$/i, "");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("OpenAI-compatible base URL must be a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("OpenAI-compatible base URL must use HTTP or HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
}

interface OpenAiResponseBody {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
    finish_reason?: string;
  }>;
  error?: { message?: string; code?: string };
}

/**
 * Raised when the model was still writing when its output budget ran out.
 *
 * This used to pass silently. Both response parsers carry a regex salvage path
 * whose terminators include end-of-string precisely so a half-written JSON
 * object still yields a composition, and nothing upstream distinguished that
 * from a complete one. A truncated `timelineJs` is usually caught downstream by
 * the syntax check, but a truncated `compositionHtml` is not parsed at all: it
 * ships with its closing markup and scoped CSS missing, and every tween written
 * against a layer that never made it into the DOM animates the detached
 * stand-in instead. That is the film that renders half-built for no stated
 * reason, so the truncation is named here rather than inferred from the wreck.
 */
export class AiTruncationError extends Error {
  constructor(model: string) {
    super(
      `The model ran out of output room while writing the composition (${model}), so the film came back unfinished. Ask for a shorter film or fewer scenes, or raise AI_MAX_OUTPUT_TOKENS.`,
    );
    this.name = "AiTruncationError";
  }
}

/** Gemini reports `MAX_TOKENS`; OpenAI-compatible endpoints report `length`. */
function isTruncated(reason: string | undefined): boolean {
  if (!reason) return false;
  return /^(?:MAX_TOKENS|length)$/i.test(reason.trim());
}

/**
 * Output ceiling, overridable because it is the one knob that decides whether a
 * rich film fits. Defaults hold the values each transport shipped with.
 */
function maxOutputTokens(fallback: number): number {
  const raw = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.["AI_MAX_OUTPUT_TOKENS"];
  const parsed = Number(raw?.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function readErrorMessage(
  response: Response,
  providerName: string,
): Promise<string> {
  const fallback = `${providerName} API error (${response.status})`;
  const text = await response.text();
  if (!text) return fallback;
  try {
    const body = JSON.parse(text) as {
      error?: string | { message?: string };
      message?: string;
    };
    if (typeof body.error === "string") return body.error;
    return body.error?.message ?? body.message ?? fallback;
  } catch {
    return text;
  }
}

async function callGemini(request: AiProviderRequest): Promise<string> {
  const model = normalizeGeminiModel(request.model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${request.apiKey}`;
  const generationConfig: Record<string, unknown> = {
    response_mime_type: "application/json",
    temperature: request.temperature,
    maxOutputTokens: maxOutputTokens(65536),
  };
  if (model.includes("3.7")) {
    generationConfig["thinking_config"] = { thinking_budget: 0 };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: request.systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: request.userMessage },
            ...(request.assets ?? []).map((asset) => ({
              inline_data: {
                mime_type: asset.mimeType,
                data: asset.dataBase64,
              },
            })),
          ],
        },
      ],
      generationConfig,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Gemini"));
  }

  const body = (await response.json()) as GeminiResponseBody;
  const candidate = body.candidates?.[0];
  const rawText = candidate?.content?.parts?.find(
    (part) => typeof part.text === "string",
  )?.text;
  if (isTruncated(candidate?.finishReason)) throw new AiTruncationError(model);
  if (!rawText) throw new Error("Empty response received from Gemini.");
  return rawText;
}

function openAiMessages(request: AiProviderRequest): unknown[] {
  const assets = request.assets ?? [];
  const content =
    assets.length === 0
      ? request.userMessage
      : [
          { type: "text", text: request.userMessage },
          ...assets.map((asset) => ({
            type: "image_url",
            image_url: {
              url: `data:${asset.mimeType};base64,${asset.dataBase64}`,
            },
          })),
        ];
  return [
    { role: "system", content: request.systemPrompt },
    { role: "user", content },
  ];
}

function shouldRetryWithoutJsonMode(status: number, message: string): boolean {
  return (
    (status === 400 || status === 422) &&
    /response[_ -]?format|json[_ -]?mode|json_object/i.test(message)
  );
}

async function callOpenAiCompatible(
  request: AiProviderRequest,
): Promise<string> {
  const baseUrl = normalizeOpenAiCompatibleBaseUrl(request.baseUrl ?? "");
  const url = `${baseUrl}/chat/completions`;
  const basePayload = {
    model: request.model.trim() || DEFAULT_OPENAI_COMPATIBLE_MODEL,
    messages: openAiMessages(request),
    temperature: request.temperature,
    max_tokens: maxOutputTokens(32768),
  };
  const makeRequest = (jsonMode: boolean) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        ...basePayload,
        ...(jsonMode
          ? { response_format: { type: "json_object" } }
          : undefined),
      }),
    });

  let response = await makeRequest(true);
  if (!response.ok) {
    const message = await readErrorMessage(response, "OpenAI-compatible");
    if (!shouldRetryWithoutJsonMode(response.status, message)) {
      throw new Error(message);
    }
    response = await makeRequest(false);
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "OpenAI-compatible"));
    }
  }

  const body = (await response.json()) as OpenAiResponseBody;
  const choice = body.choices?.[0];
  const content = choice?.message?.content;
  const rawText = Array.isArray(content)
    ? content
        .filter((part) => part.type === "text" && part.text)
        .map((part) => part.text)
        .join("\n")
    : content;
  if (isTruncated(choice?.finish_reason)) {
    throw new AiTruncationError(basePayload.model);
  }
  if (!rawText) {
    throw new Error("Empty response received from OpenAI-compatible model.");
  }
  return rawText;
}

export async function callAiProvider(
  request: AiProviderRequest,
): Promise<string> {
  if (!request.apiKey.trim()) {
    throw new Error(
      request.provider === "gemini"
        ? "Missing Gemini API key."
        : "Missing OpenAI-compatible API key.",
    );
  }
  return request.provider === "openai-compatible"
    ? callOpenAiCompatible(request)
    : callGemini(request);
}

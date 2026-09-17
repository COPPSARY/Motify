import { afterEach, describe, expect, it, vi } from "vitest";
import {
  callAiProvider,
  normalizeAiProvider,
  normalizeOpenAiCompatibleBaseUrl,
} from "../../src/ai/provider";

describe("AI provider transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts CodeCraft aliases and normalizes a pasted completion endpoint", () => {
    expect(normalizeAiProvider("codecraft")).toBe("openai-compatible");
    expect(
      normalizeOpenAiCompatibleBaseUrl(
        "https://codecraftapi.com/v1/chat/completions/",
      ),
    ).toBe("https://codecraftapi.com/v1");
  });

  it("requires an OpenAI-compatible base URL instead of selecting a provider host", () => {
    expect(() => normalizeOpenAiCompatibleBaseUrl(" ")).toThrow(
      "Missing OPENAI_COMPATIBLE_BASE_URL",
    );
  });

  it("retries without JSON mode when the selected model rejects it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: "response_format json_mode is unsupported" },
          }),
          { status: 422 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAiProvider({
      provider: "openai-compatible",
      apiKey: "cc_test",
      model: "model-without-json-mode",
      baseUrl: "https://codecraftapi.com/v1",
      systemPrompt: "Return JSON",
      userMessage: "Build it",
      temperature: 0.5,
    });

    expect(result).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(retryPayload.response_format).toBeUndefined();
  });

  it("surfaces the OpenAI error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: "Invalid CodeCraft API key" } }),
            { status: 401 },
          ),
        ),
    );

    await expect(
      callAiProvider({
        provider: "openai-compatible",
        apiKey: "bad-key",
        model: "claude-opus-4.8",
        baseUrl: "https://codecraftapi.com/v1",
        systemPrompt: "Return JSON",
        userMessage: "Build it",
        temperature: 0.5,
      }),
    ).rejects.toThrow("Invalid CodeCraft API key");
  });
});

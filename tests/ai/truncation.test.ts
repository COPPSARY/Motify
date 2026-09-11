import { afterEach, describe, expect, it, vi } from "vitest";

import { AiTruncationError, callAiProvider } from "../../src/ai/provider";

/**
 * A film cut off mid-write used to reach the user as a broken render with no
 * explanation: the JSON salvage path reconstructs a composition from a half
 * written object, and `compositionHtml` is never syntax-checked, so the missing
 * markup only shows up as layers that do not animate.
 */
describe("truncated generations are named, not salvaged", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a Gemini candidate that stopped at MAX_TOKENS", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              content: { parts: [{ text: '{"compositionHtml":"<templ' }] },
              finishReason: "MAX_TOKENS",
            },
          ],
        }),
      ),
    );

    await expect(
      callAiProvider({
        provider: "gemini",
        apiKey: "k",
        model: "gemini-3.5-flash",
        systemPrompt: "s",
        userMessage: "u",
        temperature: 0.6,
      }),
    ).rejects.toBeInstanceOf(AiTruncationError);
  });

  it("rejects an OpenAI-compatible choice that stopped at length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          choices: [
            {
              message: { content: '{"compositionHtml":"<templ' },
              finish_reason: "length",
            },
          ],
        }),
      ),
    );

    await expect(
      callAiProvider({
        provider: "openai-compatible",
        apiKey: "k",
        model: "claude-opus-4.8",
        baseUrl: "https://codecraftapi.com/v1",
        systemPrompt: "s",
        userMessage: "u",
        temperature: 0.6,
      }),
    ).rejects.toBeInstanceOf(AiTruncationError);
  });

  it("names the model and an action the user can take", async () => {
    const error = new AiTruncationError("gemini-3.5-flash");
    expect(error.message).toContain("gemini-3.5-flash");
    expect(error.message).toContain("shorter film");
    expect(error.message).toContain("AI_MAX_OUTPUT_TOKENS");
  });

  it("passes a complete response through untouched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              content: { parts: [{ text: '{"ok":true}' }] },
              finishReason: "STOP",
            },
          ],
        }),
      ),
    );

    await expect(
      callAiProvider({
        provider: "gemini",
        apiKey: "k",
        model: "gemini-3.5-flash",
        systemPrompt: "s",
        userMessage: "u",
        temperature: 0.6,
      }),
    ).resolves.toBe('{"ok":true}');
  });

  it("honours AI_MAX_OUTPUT_TOKENS when set", async () => {
    vi.stubEnv("AI_MAX_OUTPUT_TOKENS", "120000");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          { content: { parts: [{ text: "{}" }] }, finishReason: "STOP" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callAiProvider({
      provider: "gemini",
      apiKey: "k",
      model: "gemini-3.5-flash",
      systemPrompt: "s",
      userMessage: "u",
      temperature: 0.6,
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(payload.generationConfig.maxOutputTokens).toBe(120000);
    vi.unstubAllEnvs();
  });
});

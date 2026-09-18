import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import generateHandler from "../../api/ai/generate";
import {
  foundationHtml,
  foundationTimeline,
} from "../../src/ai/generation-foundation";

function generateRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/ai/generate", {
    method: "POST",
    body: JSON.stringify({ userPrompt: "A launch film", currentFiles: {} }),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function geminiResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  } as unknown as Response;
}

describe("generation account gate", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    vi.stubEnv("MOTIFY_API_URL", "https://api.motify.test");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("refuses a generation that carries no session cookie", async () => {
    const response = await generateHandler(generateRequest());

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a generation whose session the API rejects", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));

    const response = await generateHandler(
      generateRequest({ Cookie: "motify_session=stale" }),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.motify.test/v1/auth/me",
    );
    // Nothing reached the model provider.
    expect(fetchMock.mock.calls).toHaveLength(1);
  });

  it("generates once the API confirms the session", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ data: { user: { id: "u1" }, csrfToken: "c1" } }),
      )
      .mockResolvedValueOnce(
        geminiResponse({
          title: "Launch film",
          duration: 20,
          compositionHtml: foundationHtml,
          timelineJs: foundationTimeline,
          reply: "Done.",
        }),
      );

    const response = await generateHandler(
      generateRequest({ Cookie: "motify_session=valid" }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.motify.test/v1/auth/me",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.Cookie).toBe(
      "motify_session=valid",
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "generativelanguage.googleapis.com",
    );
  });
});

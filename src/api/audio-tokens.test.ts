import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearAudioBlobCache, hydrateAudioTokens } from "./audio-tokens";

const id = "11111111-1111-4111-8111-111111111111";

vi.mock("./client", () => ({
  fetchApi: vi.fn(async (path: string) => {
    if (path.endsWith("/access")) {
      return new Response(
        JSON.stringify({ data: { url: "https://storage.example/song" } }),
      );
    }
    throw new Error(`unexpected ${path}`);
  }),
}));

/** jsdom's Blob cannot be wrapped in a Response, so the download is stubbed. */
const song = () => ({
  ok: true,
  status: 200,
  blob: async () => new Blob(["song"]),
});
const failure = (status: number) => ({
  ok: false,
  status,
  blob: async () => new Blob([]),
});

beforeEach(() => {
  clearAudioBlobCache();
  let counter = 0;
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => `blob:song-${++counter}`,
    revokeObjectURL: () => undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hydrateAudioTokens", () => {
  it("replaces every occurrence of a token with a playable URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => song()),
    );

    const result = await hydrateAudioTokens(
      `<audio src="motify-audio://${id}"></audio><i data-a="motify-audio://${id}"></i>`,
    );

    expect(result.source).not.toContain("motify-audio://");
    expect(result.source).toContain('src="blob:song-1"');
    expect(result.objectUrls).toEqual(["blob:song-1"]);
  });

  it("downloads a track once however many times it is hydrated", async () => {
    const fetchMock = vi.fn(async () => song());
    vi.stubGlobal("fetch", fetchMock);
    const source = `<audio src="motify-audio://${id}"></audio>`;

    await hydrateAudioTokens(source);
    await hydrateAudioTokens(source);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the token when a track cannot be downloaded", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => failure(404)),
    );
    const source = `<audio src="motify-audio://${id}"></audio>`;

    const result = await hydrateAudioTokens(source);

    expect(result.source).toBe(source);
    expect(result.objectUrls).toEqual([]);
  });

  it("retries a failed download instead of caching the failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failure(503))
      .mockResolvedValueOnce(song());
    vi.stubGlobal("fetch", fetchMock);
    const source = `<audio src="motify-audio://${id}"></audio>`;

    await hydrateAudioTokens(source);
    const second = await hydrateAudioTokens(source);

    expect(second.source).toContain("blob:song");
  });
});

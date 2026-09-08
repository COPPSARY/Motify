import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithDirectAi } from "../../src/ai/direct-ai";
import {
  foundationHtml,
  foundationTimeline,
} from "../../src/ai/generation-foundation";

/** A film that clears every blocking check: the shape a good pass returns. */
function soundComposition(reply: string) {
  return {
    title: "Launch film",
    duration: 20,
    compositionHtml: foundationHtml,
    timelineJs: foundationTimeline,
    reply,
  };
}

/** Fails "nothing moves" and drops both markup markers. */
function brokenComposition(reply: string) {
  return {
    title: "Launch film",
    duration: 8,
    compositionHtml: `<template><main data-edit="stage"><h1 data-edit="headline">Ship faster</h1></main></template>`,
    timelineJs: `export function buildTimeline({ timeline }) {
      timeline.set(headline, { autoAlpha: 0 }, 0);
      timeline.to(headline, { autoAlpha: 1, duration: 1 }, 0.4);
    }`,
    reply,
  };
}

function geminiResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  } as unknown as Response;
}

describe("directed generation with self-repair", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.setItem("motionly_gemini_api_key", "test-key");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    localStorage.removeItem("motionly_gemini_api_key");
    vi.unstubAllGlobals();
  });

  it("ships a sound first pass without spending a repair round trip", async () => {
    fetchMock.mockResolvedValue(geminiResponse(soundComposition("All set.")));

    const result = await generateWithDirectAi("make a launch film", {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.quality?.blockingIssues).toEqual([]);
    expect(result.reply).toContain("All set.");
  });

  it("keeps a repair pass that clears the blocking failures", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(brokenComposition("First try.")))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Repaired.")));

    const result = await generateWithDirectAi("make a launch film", {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.quality?.blockingIssues).toEqual([]);
    expect(result.reply).toContain("Repaired.");
  });

  it("ships the best pass with a note instead of throwing when repairs fail", async () => {
    fetchMock.mockResolvedValue(geminiResponse(brokenComposition("Best I go")));

    const result = await generateWithDirectAi("make a launch film", {});

    // The user gets a film they can watch and edit, never an empty canvas.
    expect(result.compositionHtml).toContain("data-edit=");
    expect(result.quality?.blockingIssues.join(" ")).toContain("nothing moves");
    expect(result.reply).toContain("Still worth a look");
  });

  it("ships the first pass when the repair round trip itself fails", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(brokenComposition("First try.")))
      .mockRejectedValueOnce(new Error("network down"));

    const result = await generateWithDirectAi("make a launch film", {});

    expect(result.reply).toContain("First try.");
  });

  it("applies the deterministic markup repairs to whatever ships", async () => {
    fetchMock.mockResolvedValue(geminiResponse(brokenComposition("Best I go")));

    const result = await generateWithDirectAi("make a launch film", {});

    expect(result.compositionHtml).toContain("data-transition-carrier");
    expect(result.compositionHtml).toContain(
      'data-motionly-generation-profile="claude-foundation-v1"',
    );
  });

  it("stops paying for repairs once a pass stops improving the report", async () => {
    fetchMock.mockResolvedValue(geminiResponse(brokenComposition("Weak.")));

    await generateWithDirectAi("make a launch film", {});

    // One generation, one repair that changed nothing, then no more spending.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

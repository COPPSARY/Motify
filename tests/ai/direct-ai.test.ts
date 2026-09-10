import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithDirectAi } from "../../src/ai/direct-ai";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import generateHandler from "../../api/ai/generate";
import {
  foundationHtml,
  foundationTimeline,
} from "../../src/ai/generation-foundation";

/** A film that clears every blocking check: the shape a good pass returns. */
function soundComposition(reply: string) {
  return {
    title: "Launch film",
    duration: 20,
    skills: ["write-motionly"],
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

/** What the direction turn returns: a plan, and not one line of code. */
function filmDirection() {
  return {
    shape: "transformation",
    subject: "A tracker that turns scattered reports into filed work",
    ground: "warm off-white, one accent, generous negative space",
    typeTreatment: "one full-size sentence per beat, entering cropped",
    chain: ["reports scattered", "one is captured", "the work is filed"],
    beats: [
      {
        id: "scene-01",
        label: "01 - scattered",
        start: 0,
        duration: 10,
        shot: "reports crowding the frame",
        camera: "wide, drifting in",
        primary: "the pile converges",
      },
      {
        id: "scene-02",
        label: "02 - filed",
        start: 10,
        duration: 10,
        shot: "one filed issue at reading size",
        camera: "close, pulling back",
        primary: "the issue resolves",
      },
    ],
    seams: [
      {
        from: "scene-01",
        to: "scene-02",
        at: 9.4,
        duration: 1.2,
        carrier: "story-carrier",
        mechanism: "morph",
        becomes: "the pile becomes the filed issue",
      },
    ],
    close: "the mark on open ground",
    avoid: "a dashboard with feature cards",
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
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("ships a sound first pass without spending a repair round trip", async () => {
    fetchMock.mockResolvedValue(geminiResponse(soundComposition("All set.")));

    const result = await generateWithDirectAi("make a product tour", {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.quality?.blockingIssues).toEqual([]);
    expect(result.reply).toContain("All set.");
    expect(result.skills).toEqual(["write-motionly"]);
  });

  it("sends the bundled skill as system context and project assets as user context", async () => {
    fetchMock.mockResolvedValue(geminiResponse(soundComposition("All set.")));
    await generateWithDirectAi("Keep my accepted product identity", {
      conversation: [{ role: "user", text: "Use our paper-white palette" }],
    });
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.system_instruction.parts).toEqual([
      { text: MOTIONLY_SYSTEM_PROMPT },
    ]);
    expect(payload.contents[0].parts[0].text).toContain(
      "Use our paper-white palette",
    );
    expect(payload.contents[0].parts[0].text).not.toContain(
      "## Creative direction",
    );
    expect(payload.system_instruction.parts[0].text).not.toContain(
      "Use our paper-white palette",
    );
  });

  it("uses the same bundled system prompt in the deployed Vercel route", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    fetchMock.mockResolvedValue(
      geminiResponse(soundComposition("Server result.")),
    );
    const response = await generateHandler(
      new Request("http://localhost/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({ userPrompt: "A launch film", currentFiles: {} }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.system_instruction.parts).toEqual([
      { text: MOTIONLY_SYSTEM_PROMPT },
    ]);
    expect((await response.json()).skills).toEqual(["write-motionly"]);
  });

  it("repairs a foundation-generated result as existing work without replacing the system skill", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(filmDirection()))
      .mockResolvedValueOnce(geminiResponse(brokenComposition("First try.")))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Fixed.")));
    await generateWithDirectAi("Make a product tour", {
      generationProfile: "claude-foundation-v1",
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
    });
    const first = JSON.parse(fetchMock.mock.calls[1]![1].body);
    const repair = JSON.parse(fetchMock.mock.calls[2]![1].body);
    expect(repair.system_instruction).toEqual(first.system_instruction);
    const message = repair.contents[0].parts[0].text;
    expect(message).toContain("REPAIR REQUEST");
    expect(message).toContain("nothing moves");
    expect(message).toContain("EDIT the existing composition");
    expect(message).not.toContain("CREATE a new composition from scratch");
  });

  it("directs the film before building it, and builds what it directed", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(filmDirection()))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Built.")));

    await generateWithDirectAi("Make an ad for my issue tracker", {
      generationProfile: "claude-foundation-v1",
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
    });

    const direction = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(direction.system_instruction.parts[0].text).toContain(
      "You do not write code on this turn",
    );
    expect(direction.contents[0].parts[0].text).not.toContain("<template");

    const build = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(build.system_instruction.parts[0].text).toBe(MOTIONLY_SYSTEM_PROMPT);
    const message = build.contents[0].parts[0].text;
    expect(message).toContain("ACCEPTED CREATIVE DIRECTION");
    expect(message).toContain("warm off-white, one accent");
    expect(message).toContain("scene-01 to scene-02 at 9.4s for 1.2s: morph");
  });

  /** A failed plan costs the film its direction, never the film itself. */
  it("builds anyway when the direction turn fails", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("Gemini API error (503)"))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Built.")));

    const result = await generateWithDirectAi("Make an ad", {
      generationProfile: "claude-foundation-v1",
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
    });

    expect(result.reply).toContain("Built.");
    const build = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(build.contents[0].parts[0].text).not.toContain(
      "ACCEPTED CREATIVE DIRECTION",
    );
  });

  it("does not re-direct a follow-up edit", async () => {
    fetchMock.mockResolvedValue(geminiResponse(soundComposition("Edited.")));

    await generateWithDirectAi("make the ending longer", {
      generationProfile: "existing",
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
    });

    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(call[1].body);
      expect(body.system_instruction.parts[0].text).toBe(
        MOTIONLY_SYSTEM_PROMPT,
      );
    }
  });

  /**
   * The render checks watch real frames, so they are the strongest signal this
   * pipeline has. They used to run after generation returned, which meant the
   * user got a raw error and a Fix button instead of a repair pass.
   */
  it("repairs what the frames show instead of surfacing it as an error", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(soundComposition("First try.")))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Recomposed.")));
    let seen = 0;

    const result = await generateWithDirectAi(
      "make a product tour",
      {},
      undefined,
      () => {
        seen += 1;
        return seen === 1
          ? {
              ok: false as const,
              message: "Scene scene-01 is small cards floating in empty space.",
              fatal: false,
            }
          : { ok: true as const };
      },
    );

    expect(seen).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repair = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(repair.contents[0].parts[0].text).toContain(
      "small cards floating in empty space",
    );
    expect(result.reply).toContain("Recomposed.");
    expect(result.quality?.blockingIssues).toEqual([]);
  });

  it("ships the film with the complaint when repairs cannot clear it", async () => {
    fetchMock.mockResolvedValue(
      geminiResponse(soundComposition("Best I had.")),
    );
    const complaint = "Nothing survives the cut from scene-01 to scene-02.";

    const result = await generateWithDirectAi(
      "make a product tour",
      {},
      undefined,
      () => ({
        ok: false as const,
        message: complaint,
        fatal: false,
      }),
    );

    // Every repair pass was spent on it rather than one manual Fix click.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(2);
    expect(result.compositionHtml).toBeTruthy();
    expect(result.reply).toContain(complaint);
  });

  it("refuses only a film that cannot render at all", async () => {
    fetchMock.mockResolvedValue(geminiResponse(soundComposition("Blank.")));

    await expect(
      generateWithDirectAi("make a product tour", {}, undefined, () => ({
        ok: false as const,
        message: "Scene scene-01 renders no visible foreground around 1.25s.",
        fatal: true,
      })),
    ).rejects.toThrow(/renders no visible foreground/);
  });

  it("keeps a repair pass that clears the blocking failures", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(brokenComposition("First try.")))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Repaired.")));

    const result = await generateWithDirectAi("make a product tour", {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.quality?.blockingIssues).toEqual([]);
    expect(result.reply).toContain("Repaired.");
  });

  it("ships the best pass with a note instead of throwing when repairs fail", async () => {
    fetchMock.mockResolvedValue(geminiResponse(brokenComposition("Best I go")));

    const result = await generateWithDirectAi("make a product tour", {});

    // The user gets a film they can watch and edit, never an empty canvas.
    expect(result.compositionHtml).toContain("data-edit=");
    expect(result.quality?.blockingIssues.join(" ")).toContain("nothing moves");
    expect(result.reply).toContain("Still worth a look");
  });

  it("ships the first pass when the repair round trip itself fails", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(brokenComposition("First try.")))
      .mockRejectedValueOnce(new Error("network down"));

    const result = await generateWithDirectAi("make a product tour", {});

    expect(result.reply).toContain("First try.");
  });

  it("applies the deterministic markup repairs to whatever ships", async () => {
    fetchMock.mockResolvedValue(geminiResponse(brokenComposition("Best I go")));

    const result = await generateWithDirectAi("make a product tour", {});

    expect(result.compositionHtml).toContain("data-transition-carrier");
    expect(result.compositionHtml).toContain(
      'data-motionly-generation-profile="claude-foundation-v1"',
    );
  });

  it("stops paying for repairs once a pass stops improving the report", async () => {
    fetchMock.mockResolvedValue(geminiResponse(brokenComposition("Weak.")));

    await generateWithDirectAi("make a product tour", {});

    // One generation, one repair that changed nothing, then no more spending.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

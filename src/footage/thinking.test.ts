import { describe, expect, it } from "vitest";

import type { FootageStatus } from "./api";
import { CAPTION_LOOKS, FOOTAGE_PRESETS, captionLookJson } from "./presets";
import { thinkingLines, workProgress } from "./thinking";

function status(overrides: Partial<FootageStatus> = {}): FootageStatus {
  return {
    assetId: "a",
    status: "ready",
    stage: "ready" as FootageStatus["stage"],
    files: [],
    stripFrames: 0,
    scenes: [],
    silences: [],
    transcript: {
      language: "en",
      text: "Today I will show you why most small shops lose customers on Facebook.",
      words: [],
    },
    analysis: {
      summary: "A woman talking to camera in a bright shop.",
      shot: "person talking to camera",
      quality: 4,
      issues: [],
      moments: [
        {
          start: 2.4,
          end: 5,
          label: "the hook about lost customers",
          kind: "talking",
          score: 5,
        },
      ],
      avoid: [
        { start: 0, end: 1, reason: "silence" },
        { start: 30, end: 33, reason: "camera being set down" },
      ],
      model: true,
    },
    ...overrides,
  };
}

describe("what the AI shows while it works", () => {
  it("reads back what it found in the clips, then what it is deciding", () => {
    const lines = thinkingLines([status()], "cut");
    expect(lines.slice(0, 4)).toEqual([
      "Your clip: A woman talking to camera in a bright shop",
      "Hearing: “Today I will show you why most small shops lose customers on Facebook.”",
      "Strongest moment: the hook about lost customers at 2.4s",
      "Leaving out: camera being set down",
    ]);
    expect(lines).toContain(
      "Choosing a style: clean, studio explainer or paper documentary",
    );
  });

  it("numbers several clips, and skips what it has not read yet", () => {
    const lines = thinkingLines(
      [status(), undefined, status({ analysis: null, transcript: null })],
      "cut",
    );
    expect(lines[0]).toMatch(/^Clip 1: /);
    expect(lines.some((line) => line.startsWith("Clip 2"))).toBe(false);
    expect(lines.some((line) => line.startsWith("Clip 3"))).toBe(false);
  });

  it("starts an edit from the request itself", () => {
    expect(thinkingLines([status()], "edit", "make it Vox style")[0]).toBe(
      "Reading your request: “make it Vox style”",
    );
  });
});

describe("start presets", () => {
  it("starts a talking head on stacked captions", () => {
    const talking = FOOTAGE_PRESETS.find(
      (item) => item.label === "Talking head",
    )!;
    expect(talking.captions).toBe("stack");
    expect(JSON.parse(captionLookJson(talking.captions))).toEqual({
      style: "stack",
      animation: "blur",
    });
  });

  it("only offers caption looks it knows", () => {
    for (const item of FOOTAGE_PRESETS)
      expect(CAPTION_LOOKS.map((look) => look.value)).toContain(item.captions);
    expect(captionLookJson("")).toBe("");
  });
});

describe("the work's progress bar", () => {
  it("races to about 90% and then creeps, never reaching 100%", () => {
    expect(workProgress(0)).toBe(0);
    expect(workProgress(3)).toBeGreaterThan(0.5);
    expect(workProgress(10)).toBeGreaterThan(0.85);
    expect(workProgress(10)).toBeLessThan(0.92);
    expect(workProgress(60)).toBeGreaterThan(workProgress(20));
    expect(workProgress(10_000)).toBeLessThan(1);
  });
});

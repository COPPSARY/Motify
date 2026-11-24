import { describe, expect, it } from "vitest";

import { CANVAS_ASPECTS } from "./canvas-frame";
import { ASPECT_NAMES, aspectLabel, canvasShapeName } from "./aspect-names";

describe("aspect names", () => {
  it("names every canvas aspect in plain words, without the ratio", () => {
    for (const aspect of CANVAS_ASPECTS) {
      const entry = ASPECT_NAMES[aspect];
      expect(entry.name).not.toMatch(/\d+:\d+/);
      expect(entry.short).not.toMatch(/\d+:\d+/);
      expect(entry.short.length).toBeLessThanOrEqual(8);
    }
  });
  it("keeps the ratio in the full label", () => {
    expect(aspectLabel("9:16")).toBe("Reels & TikTok (9:16)");
    expect(aspectLabel("16:9")).toBe("YouTube (16:9)");
  });
  it("names the design's own size too", () => {
    expect(canvasShapeName("original")).toBe("Original size");
    expect(canvasShapeName("1:1")).toBe("Square post");
  });
});

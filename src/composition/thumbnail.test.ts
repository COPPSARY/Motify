import { describe, expect, it } from "vitest";
import { thumbnailTime } from "./thumbnail";

const scene = (start: number, duration: number) => ({
  id: `scene-${start}`,
  label: "Scene",
  start,
  duration,
  accent: "#1f45b0",
});

describe("thumbnailTime", () => {
  it("pictures the opening scene after its entrance has played", () => {
    expect(
      thumbnailTime({ duration: 12, scenes: [scene(0, 4), scene(4, 8)] }),
    ).toBeCloseTo(2.4);
  });

  it("falls back to a point early in a film without scenes", () => {
    expect(thumbnailTime({ duration: 10, scenes: [] })).toBeCloseTo(3);
  });

  it("stays within the film", () => {
    expect(thumbnailTime({ duration: 2, scenes: [scene(1, 10)] })).toBe(2);
  });
});

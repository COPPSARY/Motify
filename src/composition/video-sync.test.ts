import { describe, expect, it } from "vitest";

import { clipTime, filmVideos } from "./video-sync";

const clip = { start: 2, trim: 1, loop: false, duration: 6 };

describe("clip time", () => {
  it("holds the first frame before the clip starts", () => {
    expect(clipTime(clip, 0)).toBe(1);
    expect(clipTime(clip, 2)).toBe(1);
  });

  it("plays in real time from data-trim once the film reaches data-start", () => {
    expect(clipTime(clip, 3.5)).toBe(2.5);
  });

  it("holds its last frame after it ends, or loops from data-trim", () => {
    expect(clipTime(clip, 30)).toBeCloseTo(5.95);
    expect(clipTime({ ...clip, loop: true }, 2 + 5 + 1.5)).toBeCloseTo(2.5);
  });

  it("plays on from data-trim while the clip's length is not known yet", () => {
    expect(clipTime({ ...clip, duration: Number.NaN }, 4)).toBe(3);
  });
});

describe("film videos", () => {
  it("finds only clips the film placed", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<video data-motify-video src="blob:a"></video><video src="blob:b"></video>';

    expect(filmVideos(root)).toHaveLength(1);
  });
});

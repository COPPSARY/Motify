import { describe, expect, it } from "vitest";

import { VideoSync, catchUpRate, clipTime, filmVideos } from "./video-sync";

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

  it("skips a stock slot that has no clip yet", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<video data-motify-video data-motify-stock="video"></video><video data-motify-video data-motify-stock="video" src="blob:c"></video>';

    expect(filmVideos(root).map((video) => video.getAttribute("src"))).toEqual([
      "blob:c",
    ]);
  });
});

describe("catching up while playing", () => {
  it("plays at normal speed while in step", () => {
    expect(catchUpRate(0)).toBe(1);
    expect(catchUpRate(0.02)).toBe(1);
  });

  it("speeds up a clip that is behind and slows one that is ahead, within limits", () => {
    expect(catchUpRate(0.1)).toBeCloseTo(1.1);
    expect(catchUpRate(-0.1)).toBeCloseTo(0.9);
    expect(catchUpRate(0.8)).toBeCloseTo(1.15);
    expect(catchUpRate(-0.8)).toBeCloseTo(0.85);
  });

  function playingClip(currentTime: number) {
    const root = document.createElement("div");
    root.innerHTML =
      '<video data-motify-video src="blob:a" data-start="0"></video>';
    const video = root.querySelector("video")!;
    let seeks = 0;
    let time = currentTime;
    Object.defineProperties(video, {
      duration: { value: 10 },
      paused: { value: false },
      seeking: { value: false },
      currentTime: {
        get: () => time,
        set: (value: number) => {
          seeks += 1;
          time = value;
        },
      },
    });
    return { root, video, seeks: () => seeks };
  }

  it("does not seek a clip that is a little behind, it speeds it up", () => {
    const { root, video, seeks } = playingClip(2.6);
    new VideoSync(root).sync({ time: 3, playing: true });

    expect(seeks()).toBe(0);
    expect(video.playbackRate).toBeGreaterThan(1);
  });

  it("seeks a clip that is far out of step", () => {
    const { root, video, seeks } = playingClip(0.5);
    new VideoSync(root).sync({ time: 3, playing: true });

    expect(seeks()).toBe(1);
    expect(video.currentTime).toBe(3);
    expect(video.playbackRate).toBe(1);
  });
});

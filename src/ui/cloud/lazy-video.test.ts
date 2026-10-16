import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lazyVideo } from "./lazy-video";

/** The gallery shares one observer, so its callback outlives a single test. */
let notify: IntersectionObserverCallback | null = null;
const observed = new Set<Element>();

class FakeObserver {
  constructor(callback: IntersectionObserverCallback) {
    notify = callback;
  }
  observe(element: Element) {
    observed.add(element);
  }
  unobserve(element: Element) {
    observed.delete(element);
  }
  disconnect() {}
}

function scroll(video: HTMLVideoElement, isIntersecting: boolean) {
  notify?.(
    [{ target: video, isIntersecting } as unknown as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
}

function reducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduce })),
  );
}

function card() {
  const button = document.createElement("button");
  const video = document.createElement("video");
  button.append(video);
  document.body.append(button);
  let paused = true;
  Object.defineProperty(video, "paused", { get: () => paused });
  const play = vi.fn(async () => {
    paused = false;
  });
  const pause = vi.fn(() => {
    paused = true;
  });
  Object.assign(video, { play, pause });
  return { button, video, play, pause };
}

describe("lazyVideo", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    reducedMotion(false);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("downloads nothing until the video nears the screen", () => {
    const { video, play } = card();
    const action = lazyVideo(video, "/a.webm");
    expect(video.getAttribute("src")).toBeNull();
    expect(play).not.toHaveBeenCalled();

    scroll(video, true);
    expect(video.getAttribute("src")).toBe("/a.webm");
    expect(play).toHaveBeenCalledOnce();
    action.destroy();
    expect(observed.has(video)).toBe(false);
  });

  it("pauses off screen and resumes without downloading again", () => {
    const { video, play, pause } = card();
    lazyVideo(video, "/a.webm");
    scroll(video, true);
    scroll(video, false);
    expect(pause).toHaveBeenCalledOnce();
    expect(video.getAttribute("src")).toBe("/a.webm");
    scroll(video, true);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("marks the video ready once its first frame is in", () => {
    const { video } = card();
    lazyVideo(video, "/a.webm");
    scroll(video, true);
    expect(video.dataset["ready"]).toBeUndefined();
    video.dispatchEvent(new Event("loadeddata"));
    expect(video.dataset["ready"]).toBe("true");
  });

  it("with reduced motion, shows a still and plays only while hovered", () => {
    reducedMotion(true);
    const { button, video, play, pause } = card();
    lazyVideo(video, "/a.webm");
    scroll(video, true);
    expect(video.getAttribute("src")).toBe("/a.webm");
    expect(video.preload).toBe("metadata");
    expect(play).not.toHaveBeenCalled();

    button.dispatchEvent(new Event("pointerenter"));
    expect(play).toHaveBeenCalledOnce();
    button.dispatchEvent(new Event("pointerleave"));
    expect(pause).toHaveBeenCalledOnce();
  });

  it("plays at once where there is no IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { video, play } = card();
    lazyVideo(video, "/a.webm");
    expect(video.getAttribute("src")).toBe("/a.webm");
    expect(play).toHaveBeenCalledOnce();
  });
});

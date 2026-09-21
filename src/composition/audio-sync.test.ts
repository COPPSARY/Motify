import { afterEach, describe, expect, it, vi } from "vitest";

import { AudioSync } from "./audio-sync";

interface FakeAudio {
  element: HTMLAudioElement;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

/** jsdom has no media playback, so the element's transport is stubbed. */
function mount(
  attributes: Record<string, string> = {},
  options: { duration?: number; blockPlay?: boolean } = {},
): { root: HTMLElement; audio: FakeAudio } {
  const root = document.createElement("div");
  const element = document.createElement("audio");
  element.setAttribute("data-motify-audio", "");
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  let paused = true;
  let currentTime = 0;
  Object.defineProperty(element, "paused", { get: () => paused });
  Object.defineProperty(element, "currentTime", {
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });
  Object.defineProperty(element, "duration", {
    get: () => options.duration ?? Number.NaN,
  });
  const play = vi.fn(() => {
    if (options.blockPlay) return Promise.reject(new Error("blocked"));
    paused = false;
    return Promise.resolve();
  });
  const pause = vi.fn(() => {
    paused = true;
  });
  element.play = play;
  element.pause = pause;
  root.append(element);
  return { root, audio: { element, play, pause } };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AudioSync", () => {
  it("finds only the film's own audio elements and reads their settings", () => {
    const { root, audio } = mount({ "data-volume": "0.4", "data-start": "2" });
    const stray = document.createElement("audio");
    root.append(stray);
    stray.play = vi.fn();

    const sync = new AudioSync(root);

    expect(sync.trackCount).toBe(1);
    expect(audio.element.volume).toBeCloseTo(0.4);
    expect(audio.element.loop).toBe(false);
    expect(audio.element.controls).toBe(false);
    expect(audio.element.autoplay).toBe(false);
  });

  it("clamps volume and ignores a malformed start", () => {
    const { root, audio } = mount({ "data-volume": "9", "data-start": "soon" });
    const sync = new AudioSync(root);

    sync.sync({ time: 1, playing: true });

    expect(audio.element.volume).toBe(1);
    expect(audio.element.currentTime).toBe(1);
  });

  it("starts at the playhead position when the film plays", () => {
    const { root, audio } = mount();
    const sync = new AudioSync(root);

    sync.sync({ time: 3.5, playing: true });

    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.element.currentTime).toBe(3.5);
  });

  it("holds until the track's start time, then begins from zero", () => {
    const { root, audio } = mount({ "data-start": "4" });
    const sync = new AudioSync(root);

    sync.sync({ time: 2, playing: true });
    expect(audio.play).not.toHaveBeenCalled();

    sync.sync({ time: 4, playing: true });
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.element.currentTime).toBe(0);
  });

  it("stops after the track has finished", () => {
    const { root, audio } = mount({}, { duration: 10 });
    const sync = new AudioSync(root);

    sync.sync({ time: 2, playing: true });
    sync.sync({ time: 10.2, playing: true });

    expect(audio.pause).toHaveBeenCalled();
    expect(audio.element.paused).toBe(true);
  });

  it("pauses and parks at the scrubbed position", () => {
    const { root, audio } = mount();
    const sync = new AudioSync(root);
    sync.sync({ time: 1, playing: true });

    sync.sync({ time: 6, playing: false });

    expect(audio.element.paused).toBe(true);
    expect(audio.element.currentTime).toBe(6);
  });

  it("pulls playback back when it drifts from the timeline", () => {
    const { root, audio } = mount();
    const sync = new AudioSync(root);
    sync.sync({ time: 1, playing: true });

    audio.element.currentTime = 1.1;
    sync.sync({ time: 1.2, playing: true });
    expect(audio.element.currentTime).toBe(1.1);

    sync.sync({ time: 2, playing: true });
    expect(audio.element.currentTime).toBe(2);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("retries later when the browser blocks playback", () => {
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const { root, audio } = mount({}, { blockPlay: true });
    const sync = new AudioSync(root);

    sync.sync({ time: 0, playing: true });
    now += 100;
    sync.sync({ time: 0.1, playing: true });
    expect(audio.play).toHaveBeenCalledTimes(1);

    now += 600;
    sync.sync({ time: 0.7, playing: true });
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("silences everything on dispose", () => {
    const { root, audio } = mount();
    const sync = new AudioSync(root);
    sync.sync({ time: 0, playing: true });

    sync.dispose();

    expect(audio.element.paused).toBe(true);
    expect(sync.trackCount).toBe(0);
  });
});

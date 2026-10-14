import { afterEach, describe, expect, it, vi } from "vitest";
import { validateGeneratedComposition } from "../ai/validate-generation";
import {
  combineCompositionSource,
  splitCompositionSource,
} from "../cloud/project-source";
import { createDynamicComposition } from "./dynamic-compiler";
import {
  isRawFilm,
  mountRawFilm,
  prepareRawDocument,
  RAW_FILM_MARKER,
} from "./raw-film";
import type { CompositionContext } from "./types";

const RAW_TIMELINE = `${RAW_FILM_MARKER}\nexport function buildTimeline() {}\n`;
const FILM = `<!doctype html><html><head><style>html,body{margin:0;background:#0a0a0c}#word{font-family:Inter,sans-serif}</style></head>
<body><p id="word">Form</p>
<audio src="blob:soundtrack" data-motify-soundtrack></audio>
<script>window.DURATION = 4; window.seek = (t) => { document.getElementById("word").style.opacity = String(Math.min(1, t)); };</script>
</body></html>`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mountingContext(root: HTMLElement): CompositionContext {
  return {
    root,
    timeline: { fromTo: vi.fn() },
  } as unknown as CompositionContext;
}

describe("raw films", () => {
  it("are told apart by their timeline marker", () => {
    expect(isRawFilm(RAW_TIMELINE)).toBe(true);
    expect(isRawFilm("export function buildTimeline() {}")).toBe(false);
  });

  it("hand their audio to the editor and declare the bundled faces they name", () => {
    const { document, audio } = prepareRawDocument(FILM);

    expect(audio).toEqual([
      { src: "blob:soundtrack", start: "0", volume: "1" },
    ]);
    expect(document).not.toContain("<audio");
    expect(document).toContain('font-family:"Inter"');
    expect(document).toContain("window.seek");
  });

  it("keep their styles in the document through a source save", () => {
    const files = splitCompositionSource(FILM, RAW_TIMELINE, "index");

    expect(files["styles.css"]).toBe("");
    expect(files["composition.html"]).toContain("<style>html,body");
    expect(combineCompositionSource(files)).toBe(FILM);
  });

  it("compile to a composition whose timeline is the film's clock", () => {
    const composition = createDynamicComposition(FILM, RAW_TIMELINE, {
      width: 1920,
      height: 1080,
      duration: 4,
    });

    expect(composition.duration).toBe(4);
    expect(composition.adaptive).toBe(false);
    expect(composition.sourcePreview).toBe(FILM);
  });

  it("loads raw HTML through a same-origin sandboxed srcdoc", () => {
    const root = document.createElement("div");
    document.body.append(root);

    mountRawFilm(mountingContext(root), FILM, {
      width: 1920,
      height: 1080,
      duration: 4,
    });

    const frame = root.querySelector("iframe");
    expect(frame?.getAttribute("sandbox")).toBe(
      "allow-scripts allow-same-origin",
    );
    expect(frame?.srcdoc).toContain("window.seek");
    root.remove();
  });

  it("waits for iframe load before rendering a missing server soundtrack", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const fallbackFilm = FILM.replace(
      '<audio src="blob:soundtrack" data-motify-soundtrack></audio>',
      "<script>window.motifySoundtrack = () => undefined;</script>",
    );
    const samples = new Float32Array([0, 0.5, -0.25, 0]);
    const startRendering = vi.fn(async () => ({
      length: samples.length,
      duration: samples.length / 44_100,
      sampleRate: 44_100,
      numberOfChannels: 2,
      getChannelData: () => samples,
    }));
    vi.stubGlobal(
      "OfflineAudioContext",
      vi.fn(() => ({ startRendering })),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:rendered-soundtrack"),
      revokeObjectURL: vi.fn(),
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    mountRawFilm(mountingContext(root), fallbackFilm, {
      width: 1920,
      height: 1080,
      duration: 4,
    });
    const frame = root.querySelector("iframe");
    const audio = root.querySelector<HTMLAudioElement>(
      "audio[data-motify-audio]",
    );
    expect(frame).not.toBeNull();
    expect(audio).not.toBeNull();
    if (!frame?.contentWindow || !audio) return;
    audio.load = vi.fn();
    const soundtrack = vi.fn(async () => undefined);
    Object.defineProperty(frame.contentWindow, "motifySoundtrack", {
      value: soundtrack,
      configurable: true,
    });

    frame.dispatchEvent(new Event("load"));
    await vi.waitFor(() => expect(startRendering).toHaveBeenCalledTimes(1));

    expect(soundtrack).toHaveBeenCalledTimes(1);
    expect(audio.src).toContain("blob:rendered-soundtrack");
    expect(info).toHaveBeenCalledWith("[Audio] motifySoundtrack found");
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("[Audio] WAV rendered ("),
    );
    root.remove();
  });

  it("are accepted as the backend saved them, with their own scenes", () => {
    const scenes = [
      { id: "s1", label: "One", start: 0, duration: 2, accent: "#f30" },
      { id: "s2", label: "Two", start: 2, duration: 2, accent: "#f30" },
    ];
    const validated = validateGeneratedComposition(
      {
        compositionHtml: FILM,
        timelineJs: RAW_TIMELINE,
        duration: 4,
        scenes,
        reply: "Made it.",
      },
      {
        prompt: "make it",
        previousHtml: "<template></template>",
        previousDuration: 10,
        previousScenes: [],
      },
    );

    expect(validated).toMatchObject({ duration: 4, scenes, warnings: [] });
  });
});

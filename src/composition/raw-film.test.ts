import { describe, expect, it } from "vitest";
import { validateGeneratedComposition } from "../ai/validate-generation";
import {
  combineCompositionSource,
  splitCompositionSource,
} from "../cloud/project-source";
import { createDynamicComposition } from "./dynamic-compiler";
import { isRawFilm, prepareRawDocument, RAW_FILM_MARKER } from "./raw-film";

const RAW_TIMELINE = `${RAW_FILM_MARKER}\nexport function buildTimeline() {}\n`;
const FILM = `<!doctype html><html><head><style>html,body{margin:0;background:#0a0a0c}#word{font-family:Inter,sans-serif}</style></head>
<body><p id="word">Form</p>
<audio src="blob:soundtrack" data-motify-soundtrack></audio>
<script>window.DURATION = 4; window.seek = (t) => { document.getElementById("word").style.opacity = String(Math.min(1, t)); };</script>
</body></html>`;

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

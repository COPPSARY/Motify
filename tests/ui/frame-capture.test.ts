import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeCandidateFilm } from "../../src/ui/frame-capture";
import { renderCompositionFrame } from "../../src/composition/exporter";

vi.mock("../../src/composition/exporter", () => ({
  renderCompositionFrame: vi.fn(async () => document.createElement("canvas")),
}));

const rasterize = vi.mocked(renderCompositionFrame);

const html = `<template><main data-edit="stage"><h1 data-edit="headline">Ship faster</h1></main></template>`;

/** Animates well past the duration such a candidate usually declares. */
const timelineJs = `export function buildTimeline({ root, timeline }) {
  const headline = root.querySelector('[data-edit="headline"]');
  timeline.to(headline, { x: 120, duration: 20 });
}`;

const scenes = [
  { id: "scene-01", label: "One", start: 0, duration: 10, accent: "#fff" },
  { id: "scene-02", label: "Two", start: 10, duration: 10, accent: "#fff" },
];

/**
 * jsdom has no layout, so the measured account is driven by an explicit
 * `data-rect="left,top,width,height"` on the fixture, as the validator's own
 * tests do.
 */
function stubLayout(): () => void {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const raw = (this as HTMLElement).dataset?.["rect"];
    if (!raw) {
      if ((this as HTMLElement).style?.width === "1920px") {
        return new DOMRect(0, 0, 1920, 1080);
      }
      return new DOMRect(0, 0, 0, 0);
    }
    const [left = 0, top = 0, width = 0, height = 0] = raw
      .split(",")
      .map(Number);
    return new DOMRect(left, top, width, height);
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
}

/** jsdom paints nothing, so the 2D context and the encoder are stood in for. */
function stubCanvas(): () => void {
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  const toDataURL = vi
    .spyOn(HTMLCanvasElement.prototype, "toDataURL")
    .mockReturnValue("data:image/jpeg;base64,ZnJhbWU=");
  return () => {
    getContext.mockRestore();
    toDataURL.mockRestore();
  };
}

describe("photographing a candidate film", () => {
  let restoreCanvas: () => void;

  beforeEach(() => {
    rasterize.mockClear();
    restoreCanvas = stubCanvas();
  });

  afterEach(() => {
    restoreCanvas();
  });

  it("renders the moments the complaints point at", async () => {
    const observed = await observeCandidateFilm({
      renderedHtml: html,
      timelineJs,
      duration: 20,
      scenes,
      complaints: ["Scene scene-01 stacks duplicate text around 1.50s."],
    });

    expect(observed.frames[0]).toMatchObject({
      time: 1.5,
      mimeType: "image/jpeg",
    });
    expect(observed.frames[0]?.dataBase64).toBe("ZnJhbWU=");
    expect(observed.frames.length).toBeGreaterThan(1);
  });

  it("covers the film that plays, not the one that was declared", async () => {
    const observed = await observeCandidateFilm({
      renderedHtml: html,
      timelineJs,
      duration: 6,
      complaints: [],
    });

    // This candidate declared 6s and animated 20, which the validator extends
    // the composition to fit. Photographing only the declared window would
    // leave three quarters of the film unseen.
    expect(observed.frames.at(-1)?.time).toBeGreaterThan(6);
  });

  it("holds the frames to a budget", async () => {
    const observed = await observeCandidateFilm({
      renderedHtml: html,
      timelineJs,
      duration: 20,
      scenes,
      complaints: [
        "fault around 0.50s",
        "fault around 1.50s",
        "fault around 2.50s",
        "fault around 3.50s",
        "fault around 4.50s",
        "fault around 5.50s",
      ],
    });

    expect(observed.frames).toHaveLength(4);
  });

  it("costs the repair nothing when the browser cannot rasterize", async () => {
    rasterize.mockRejectedValue(new Error("canvas is unavailable"));

    const observed = await observeCandidateFilm({
      renderedHtml: html,
      timelineJs,
      duration: 20,
      scenes,
      complaints: ["fault around 1.50s"],
    });

    expect(observed.frames).toEqual([]);
  });

  it("leaves no mount behind, even when rasterizing throws", async () => {
    rasterize.mockRejectedValue(new Error("canvas is unavailable"));
    const before = document.body.childElementCount;

    await observeCandidateFilm({
      renderedHtml: html,
      timelineJs,
      duration: 20,
      scenes,
      complaints: ["fault around 1.50s"],
    });

    // A runtime left alive keeps its GSAP context ticking behind the editor's.
    expect(document.body.childElementCount).toBe(before);
  });
});

describe("measuring what a candidate puts on screen", () => {
  let restoreCanvas: () => void;
  let restoreLayout: () => void;

  /** A card that has settled with a third of itself past the right edge. */
  const clipped = `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="card" data-rect="1500,400,600,300">Plans</div></main></template>`;

  /** Moves whatever the fixture holds, so no beat is a frozen stage. */
  const movesTheCard = `export function buildTimeline({ root, timeline }) {
  const card = root.querySelector('[data-edit="card"]');
  if (card) timeline.to(card, { x: 120, duration: 20 });
  else timeline.to({}, { duration: 20 });
}`;

  beforeEach(() => {
    rasterize.mockClear();
    restoreCanvas = stubCanvas();
    restoreLayout = stubLayout();
  });

  afterEach(() => {
    restoreLayout();
    restoreCanvas();
  });

  it("writes down where every object actually landed", async () => {
    const observed = await observeCandidateFilm({
      renderedHtml: clipped,
      timelineJs: movesTheCard,
      duration: 20,
      scenes,
      complaints: ["fault around 5.00s"],
    });

    // This is the whole cloud story: the backend validates source and never
    // runs it, so the only account of the composed result is this one.
    const first = observed.account[0] ?? "";
    expect(first).toContain("5.00s");
    expect(first).toContain("card");
    expect(first).toContain("past the right");
  });

  it("measures even when not a single frame could be rendered", async () => {
    rasterize.mockRejectedValue(new Error("canvas is unavailable"));

    const observed = await observeCandidateFilm({
      renderedHtml: clipped,
      timelineJs: movesTheCard,
      duration: 20,
      scenes,
      complaints: ["fault around 5.00s"],
    });

    expect(observed.frames).toEqual([]);
    expect(observed.account.length).toBeGreaterThan(0);
  });

  it("says so plainly when a moment holds nothing", async () => {
    const observed = await observeCandidateFilm({
      renderedHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"></main></template>`,
      timelineJs: movesTheCard,
      duration: 20,
      scenes,
      complaints: ["fault around 5.00s"],
    });

    expect(observed.account[0]).toContain("nothing on screen");
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateGeneratedComposition } from "../../src/ai/validate-generation";

/**
 * The defect an exported film actually shipped with.
 *
 * At every boundary both scene layers switched off and the only thing left on
 * the canvas was the transition carrier — a small pill covering a fraction of a
 * percent of the frame, alone on an empty stage for about a fifth of a second.
 * Watched back it reads as a stray dot appearing between beats.
 *
 * It passed validation because scene frames are sampled at 0.25, 0.5 and 0.8 of
 * each beat: a seam at 2.0s running 0.8s sat between the 1.6s sample of the beat
 * before it and the 2.6s sample of the beat after, so the near-blank floor never
 * applied to the one stretch of film most likely to be empty.
 */
const scenes = [
  { id: "scene-01", label: "One", start: 0, duration: 2.5, accent: "#fff" },
  { id: "scene-02", label: "Two", start: 2.5, duration: 2.5, accent: "#fff" },
];

const seams = [
  {
    from: "scene-01",
    to: "scene-02",
    at: 2.1,
    duration: 0.8,
    carrier: "carrier",
    mechanism: "morph" as const,
    becomes: "the first surface becomes the second",
  },
];

/** jsdom has no layout; geometry comes from `data-rect`. */
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

const html = `<template><main data-edit="stage" data-scene="scene-01">
  <section data-edit="scene-01" data-scene="scene-01" data-rect="160,140,1600,800"><h1 data-edit="hook-copy" data-rect="200,200,1200,180">Feedback piles up faster than anyone reads it.</h1></section>
  <section data-edit="scene-02" data-scene="scene-02" data-rect="160,140,1600,800"><h1 data-edit="proof-copy" data-rect="200,200,1200,180">Every comment sorted into four themes.</h1></section>
  <div data-edit="carrier" data-transition-carrier data-rect="940,520,40,40"></div>
</main></template>`;

const options = {
  prompt: "Make a SaaS ad for a feedback tool",
  previousHtml: `<template><main data-edit="stage"><div data-edit="carrier"></div></main></template>`,
  previousDuration: 5,
  previousScenes: scenes,
};

function film(timelineJs: string) {
  return {
    duration: 5,
    scenes,
    seams,
    compositionHtml: html,
    timelineJs,
    reply: "Done",
  };
}

describe("transition frames are inspected, not skipped", () => {
  let restore: () => void;
  beforeEach(() => {
    restore = stubLayout();
  });
  afterEach(() => {
    restore();
  });

  it("rejects a handoff that leaves only the carrier on the canvas", () => {
    const strayDot = film(`export function buildTimeline({ root, timeline }) {
      const a = root.querySelector('[data-edit="scene-01"]');
      const b = root.querySelector('[data-edit="scene-02"]');
      const carrier = root.querySelector('[data-edit="carrier"]');
      timeline.set(a, { autoAlpha: 1 }, 0);
      timeline.set(b, { autoAlpha: 0 }, 0);
      timeline.set(carrier, { autoAlpha: 1 }, 0);
      timeline.to(a, { x: 4, duration: 2 }, 0);
      // Both beats are hidden for the length of the handoff.
      timeline.set(a, { autoAlpha: 0 }, 2.1);
      timeline.set(b, { autoAlpha: 1 }, 2.9);
      timeline.to(b, { x: 4, duration: 2 }, 2.9);
    }`);
    expect(() => validateGeneratedComposition(strayDot, options)).toThrow(
      /near-blank frame during the scene-01 to scene-02 handoff|no visible foreground during the scene-01 to scene-02 handoff/,
    );
  });

  it("accepts a handoff where a real surface covers the cut", () => {
    const carried = film(`export function buildTimeline({ root, timeline }) {
      const a = root.querySelector('[data-edit="scene-01"]');
      const b = root.querySelector('[data-edit="scene-02"]');
      timeline.set(a, { autoAlpha: 1 }, 0);
      timeline.set(b, { autoAlpha: 0 }, 0);
      timeline.to(a, { x: 4, duration: 2 }, 0);
      // The outgoing beat holds until the incoming one is already on screen.
      timeline.set(b, { autoAlpha: 1 }, 2.1);
      timeline.to(b, { x: 6, duration: 2 }, 2.1);
      timeline.set(a, { autoAlpha: 0 }, 2.9);
    }`);
    expect(() => validateGeneratedComposition(carried, options)).not.toThrow(
      /handoff/,
    );
  });
});

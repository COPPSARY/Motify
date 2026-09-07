import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateGeneratedComposition } from "../../src/ai/validate-generation";
import {
  foundationHtml,
  foundationScenes,
  foundationTimeline,
} from "../../src/ai/generation-foundation";

const scenes = [
  { id: "main", label: "Main", start: 0, duration: 2, accent: "#fff" },
];

const twoScenes = [
  { id: "scene-01", label: "One", start: 0, duration: 2, accent: "#fff" },
  { id: "scene-02", label: "Two", start: 2, duration: 2, accent: "#fff" },
];

function result(
  html: string,
  timeline = `export function buildTimeline({ root, timeline }) {
  const card = root.querySelector('[data-edit="card"]');
  timeline.to(card, { x: 20, duration: 1 });
}`,
) {
  return {
    duration: 2,
    scenes,
    compositionHtml: html,
    timelineJs: timeline,
    reply: "Done",
  };
}

/**
 * jsdom has no layout, so geometry-dependent rules (overlap, blank frames) are
 * driven by an explicit `data-rect="left,top,width,height"` on the fixture.
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

describe("generated composition validation", () => {
  it("accepts a runnable guarded edit that preserves ids and required assets", () => {
    const previousHtml = `<template><div data-edit="card"></div></template>`;
    const next = result(
      `<template><div data-edit="card"><img src="motionly-asset://photo" /></div></template>`,
    );
    expect(() =>
      validateGeneratedComposition(next, {
        prompt: "Change the card color",
        previousHtml,
        previousDuration: 2,
        previousScenes: scenes,
        requiredAssetTokens: ["motionly-asset://photo"],
      }),
    ).not.toThrow();
  });

  it("rejects unrelated layer deletion and ignored supplied images", () => {
    const previousHtml = `<template><div data-edit="card"></div><div data-edit="price"></div></template>`;
    expect(() =>
      validateGeneratedComposition(
        result(`<template><div data-edit="card"></div></template>`),
        {
          prompt: "Change the card color",
          previousHtml,
          previousDuration: 2,
          previousScenes: scenes,
          requiredAssetTokens: ["motionly-asset://photo"],
        },
      ),
    ).toThrow(/protected editable layers|did not use/);
  });

  it("rejects a supplied image that is mentioned but never rendered", () => {
    const previousHtml = `<template><div data-edit="card"></div></template>`;
    const next = result(
      `<template><div data-edit="card"><!-- motionly-asset://photo --></div></template>`,
    );
    expect(() =>
      validateGeneratedComposition(next, {
        prompt: "Use my product shot",
        previousHtml,
        previousDuration: 2,
        previousScenes: scenes,
        requiredAssetTokens: ["motionly-asset://photo"],
      }),
    ).toThrow(/without rendering it as a visible source/);
  });

  it("rejects a timeline that executes but hides the whole scene", () => {
    const hidden = result(
      `<template><main data-edit="card"><h1>Invisible result</h1></main></template>`,
      `export function buildTimeline({ root, timeline }) {
        const card = root.querySelector('[data-edit="card"]');
        timeline.set(card, { display: "none", autoAlpha: 0 }, 0);
        timeline.to({}, { duration: 2 }, 0);
      }`,
    );
    expect(() =>
      validateGeneratedComposition(hidden, {
        prompt: "Change the card color",
        previousHtml: `<template><main data-edit="card"></main></template>`,
        previousDuration: 2,
        previousScenes: scenes,
      }),
    ).toThrow(/no visible foreground/);
  });

  it("rejects a static beat that never changes", () => {
    const frozen = result(
      `<template><main data-edit="card"><h1>Still frame</h1></main></template>`,
      `export function buildTimeline({ root, timeline }) {
        const card = root.querySelector('[data-edit="card"]');
        timeline.set(card, { autoAlpha: 1 }, 0);
        timeline.to({}, { duration: 2 }, 0);
      }`,
    );
    expect(() =>
      validateGeneratedComposition(frozen, {
        prompt: "Change the card color",
        previousHtml: `<template><main data-edit="card"></main></template>`,
        previousDuration: 2,
        previousScenes: scenes,
      }),
    ).toThrow(/static slide/);
  });

  it("rejects scenes joined without a carrier handoff", () => {
    const slideshow = {
      duration: 4,
      scenes: twoScenes,
      compositionHtml: `<template><main data-edit="stage"><div data-edit="one">First</div><div data-edit="two">Second</div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const one = root.querySelector('[data-edit="one"]');
        const two = root.querySelector('[data-edit="two"]');
        timeline.set(two, { autoAlpha: 0 }, 0);
        timeline.to(one, { autoAlpha: 0, duration: 0.5 }, 1.8);
        timeline.to(two, { autoAlpha: 1, duration: 0.5 }, 2.2);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(slideshow, {
        prompt: "Polish the transition",
        previousHtml: `<template><main data-edit="stage"><div data-edit="one"></div><div data-edit="two"></div></main></template>`,
        previousDuration: 4,
        previousScenes: twoScenes,
      }),
    ).toThrow(/slideshow output is rejected/);
  });

  it("rejects a timeline that leaves the tail of the composition frozen", () => {
    const short = {
      duration: 4,
      scenes: twoScenes,
      compositionHtml: `<template><main data-edit="stage"><div data-edit="carrier" data-transition-carrier></div><div data-edit="one">First</div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const one = root.querySelector('[data-edit="one"]');
        const carrier = root.querySelector('[data-edit="carrier"]');
        timeline.to(one, { x: 12, duration: 0.6 }, 0);
        morph(timeline, carrier, { width: 300 }, { at: 0.6, duration: 0.4 });
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(short, {
        prompt: "Polish the transition",
        previousHtml: `<template><main data-edit="stage"><div data-edit="carrier"></div><div data-edit="one"></div></main></template>`,
        previousDuration: 4,
        previousScenes: twoScenes,
      }),
    ).toThrow(/leaves the rest of the/);
  });

  it("rejects a stale layer from an earlier beat", () => {
    const stale = {
      duration: 4,
      scenes: twoScenes,
      compositionHtml: `<template><main data-edit="stage"><div data-edit="carrier" data-transition-carrier></div><div data-edit="one" data-scene="scene-01">First beat</div><div data-edit="two" data-scene="scene-02">Second beat</div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const one = root.querySelector('[data-edit="one"]');
        const two = root.querySelector('[data-edit="two"]');
        const carrier = root.querySelector('[data-edit="carrier"]');
        timeline.set(two, { display: "none", autoAlpha: 0 }, 0);
        timeline.to(one, { x: 10, duration: 1 }, 0);
        morph(timeline, carrier, { width: 400 }, { at: 1.8, duration: 0.4 });
        timeline.set(two, { display: "block", autoAlpha: 1 }, 2);
        timeline.to(two, { x: 12, duration: 1.2 }, 2.2);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(stale, {
        prompt: "Polish the transition",
        previousHtml: `<template><main data-edit="stage"><div data-edit="carrier"></div><div data-edit="one"></div><div data-edit="two"></div></main></template>`,
        previousDuration: 4,
        previousScenes: twoScenes,
      }),
    ).toThrow(/stale layer from scene-01/);
  });

  describe("with layout geometry", () => {
    let restore: () => void = () => {};
    beforeEach(() => {
      restore = stubLayout();
    });
    afterEach(() => {
      restore();
    });

    it("rejects two settled text blocks stacked on each other", () => {
      const overlapping = result(
        `<template><main data-edit="stage"><h1 data-edit="hook" data-rect="200,300,900,200">Ship faster every week</h1><p data-edit="sub" data-rect="220,320,860,180">Ship faster every quarter</p></main></template>`,
        `export function buildTimeline({ root, timeline }) {
          const hook = root.querySelector('[data-edit="hook"]');
          timeline.set(hook, { autoAlpha: 1 }, 0);
          timeline.to(hook, { x: 4, duration: 1.8 }, 0);
        }`,
      );
      expect(() =>
        validateGeneratedComposition(overlapping, {
          prompt: "Tighten the hook",
          previousHtml: `<template><main data-edit="stage"><h1 data-edit="hook"></h1><p data-edit="sub"></p></main></template>`,
          previousDuration: 2,
          previousScenes: scenes,
        }),
      ).toThrow(/overlaps unrelated text/);
    });

    it("rejects a near-blank frame", () => {
      const blank = result(
        `<template><main data-edit="stage"><div data-edit="dot" data-rect="10,10,100,100">.</div><h1 data-edit="mark" data-rect="20,20,60,60">Hi</h1></main></template>`,
        `export function buildTimeline({ root, timeline }) {
          const dot = root.querySelector('[data-edit="dot"]');
          timeline.set(dot, { autoAlpha: 1 }, 0);
          timeline.to(dot, { x: 6, duration: 1.8 }, 0);
        }`,
      );
      expect(() =>
        validateGeneratedComposition(blank, {
          prompt: "Tighten the hook",
          previousHtml: `<template><main data-edit="stage"><div data-edit="dot"></div><h1 data-edit="mark"></h1></main></template>`,
          previousDuration: 2,
          previousScenes: scenes,
        }),
      ).toThrow(/near-blank frame/);
    });
  });

  it("accepts the generation foundation end to end", () => {
    expect(() =>
      validateGeneratedComposition(
        {
          title: "Foundation",
          duration: 20,
          scenes: foundationScenes,
          compositionHtml: foundationHtml,
          timelineJs: foundationTimeline,
          reply: "Foundation ready.",
        },
        {
          prompt: "rebuild the whole composition",
          previousHtml: foundationHtml,
          previousDuration: 20,
          previousScenes: foundationScenes,
        },
      ),
    ).not.toThrow();
  });
});

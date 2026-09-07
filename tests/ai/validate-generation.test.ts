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

  it("ships scenes joined without a carrier handoff but warns about it", () => {
    const slideshow = {
      duration: 4,
      scenes: twoScenes,
      compositionHtml: `<template><main data-edit="stage"><div data-edit="one">First</div><div data-edit="two">Second</div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const one = root.querySelector('[data-edit="one"]');
        const two = root.querySelector('[data-edit="two"]');
        timeline.set(two, { autoAlpha: 0 }, 0);
        timeline.to(one, { autoAlpha: 0, duration: 0.5 }, 1.8);
        timeline.to(two, { autoAlpha: 1, duration: 1.6 }, 2.2);
      }`,
      reply: "Done",
    };
    const validated = validateGeneratedComposition(slideshow, {
      prompt: "Polish the transition",
      previousHtml: `<template><main data-edit="stage"><div data-edit="one"></div><div data-edit="two"></div></main></template>`,
      previousDuration: 4,
      previousScenes: twoScenes,
    });
    expect(validated.warnings.join(" ")).toMatch(/slideshow/);
    expect(validated.warnings.join(" ")).toMatch(
      /no persistent transition carrier/i,
    );
  });

  it("reports no warnings when boundaries carry visual mass", () => {
    const carried = {
      duration: 4,
      scenes: twoScenes,
      compositionHtml: `<template><main data-edit="stage"><div data-edit="carrier" data-transition-carrier></div><div data-edit="one">First</div><div data-edit="two">Second</div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const one = root.querySelector('[data-edit="one"]');
        const two = root.querySelector('[data-edit="two"]');
        const carrier = root.querySelector('[data-edit="carrier"]');
        timeline.to(one, { x: 10, duration: 1 }, 0);
        morph(timeline, carrier, { width: 420 }, { at: 1.8, duration: 0.5 });
        timeline.to(two, { x: 12, duration: 1.2 }, 2.4);
      }`,
      reply: "Done",
    };
    expect(
      validateGeneratedComposition(carried, {
        prompt: "Polish the transition",
        previousHtml: `<template><main data-edit="stage"><div data-edit="carrier"></div><div data-edit="one"></div><div data-edit="two"></div></main></template>`,
        previousDuration: 4,
        previousScenes: twoScenes,
      }).warnings,
    ).toEqual([]);
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

  it("lets a first film replace the bundled foundation's scaffolding layers", () => {
    const film = {
      duration: 2,
      compositionHtml: `<template><main data-edit="product-shell"><h1 data-edit="hook">Ship faster</h1></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const hook = root.querySelector('[data-edit="hook"]');
        timeline.to(hook, { x: 20, duration: 1.6 }, 0);
      }`,
      reply: "Done",
    };
    // The foundation is scaffolding, so "make an ad for X" must not be judged
    // against the layers it happened to ship with.
    expect(() =>
      validateGeneratedComposition(film, {
        prompt: "Make a 20 second SaaS ad for my issue tracker",
        previousHtml: `<template><main data-edit="stage"><div data-edit="response-list"></div></main></template>`,
        previousDuration: 2,
        previousScenes: scenes,
        generationProfile: "claude-foundation-v1",
      }),
    ).not.toThrow();
  });

  it("still refuses an edit that drops a layer the user shaped by hand", () => {
    expect(() =>
      validateGeneratedComposition(
        result(`<template><div data-edit="card">Kept</div></template>`),
        {
          prompt: "Change the card color",
          previousHtml: `<template><div data-edit="card"></div><div data-edit="price"></div></template>`,
          previousDuration: 2,
          previousScenes: scenes,
          generationProfile: "existing",
          userEditedIds: ["price"],
        },
      ),
    ).toThrow(/layers you edited by hand: price/);
  });

  it("lets an edit re-cut the model's own layers and says so", () => {
    // Nobody touched "price" in the editor, so it is the model's own footage
    // and re-cutting it is a note, not a reason to withhold the whole edit.
    const validated = validateGeneratedComposition(
      result(`<template><div data-edit="card">Kept</div></template>`),
      {
        prompt: "Change the card color",
        previousHtml: `<template><div data-edit="card"></div><div data-edit="price"></div></template>`,
        previousDuration: 2,
        previousScenes: scenes,
        generationProfile: "existing",
        userEditedIds: ["card"],
      },
    );
    expect(validated.warnings.join(" ")).toMatch(/re-cut 1 layer.*price/);
  });

  it("rebuilds the storyboard from data-scene beats the model left unlisted", () => {
    const film = {
      duration: 4,
      compositionHtml: `<template><main data-edit="shell"><section data-scene="scene-01" data-edit="hook">Ask</section><section data-scene="scene-02" data-edit="proof">Answer</section></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const hook = root.querySelector('[data-edit="hook"]');
        const proof = root.querySelector('[data-edit="proof"]');
        timeline.to(hook, { x: 20, duration: 1.6 }, 0);
        timeline.to(proof, { x: 20, duration: 1.6 }, 2);
      }`,
      reply: "Done",
    };
    const validated = validateGeneratedComposition(film, {
      prompt: "Make a product film for Vault",
      previousHtml: `<template><main data-edit="shell"></main></template>`,
      previousDuration: 4,
      previousScenes: [],
      generationProfile: "claude-foundation-v1",
    });
    expect(validated.scenes.map((scene) => scene.id)).toEqual([
      "scene-01",
      "scene-02",
    ]);
    expect(validated.scenes[1]?.start).toBeCloseTo(2);
  });

  it("extends the composition to fit a longer authored timeline", () => {
    const longer = {
      duration: 2,
      compositionHtml: `<template><main data-edit="card">Hold on this</main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const card = root.querySelector('[data-edit="card"]');
        timeline.to(card, { x: 20, duration: 3.2 }, 0);
      }`,
      reply: "Held the close longer.",
    };
    // "hold the ending longer" is answered with a longer film, not an error.
    const validated = validateGeneratedComposition(longer, {
      prompt: "hold the closing brand moment longer",
      previousHtml: `<template><main data-edit="card"></main></template>`,
      previousDuration: 2,
      previousScenes: scenes,
      generationProfile: "existing",
    });
    expect(validated.duration).toBeCloseTo(3.2);
    expect(validated.warnings.join(" ")).toMatch(/extended to match/);
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

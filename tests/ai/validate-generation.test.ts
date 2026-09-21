import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isFatalRenderFailure,
  validateGeneratedComposition,
} from "../../src/ai/validate-generation";
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
  it("treats a blank handoff as a warning rather than a load-blocking failure", () => {
    expect(
      isFatalRenderFailure(
        "The film holds a blank frame from 13.8s: everything leaves the screen before the next beat arrives.",
      ),
    ).toBe(false);
  });

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

    it("rejects a resolve whose copy overflows the pill holding it", () => {
      // The shape of a real failure: a sentence sized for the canvas dropped
      // into a lockup sized for a word, so it spills out of both ends.
      const overflowing = result(
        `<template><main data-edit="stage"><div data-edit="brand-lockup" style="overflow:hidden;border-radius:80px;background:#16181d" data-rect="620,420,680,180"><p data-edit="final-copy" data-rect="540,470,840,80">Understand every voice. Decide with confidence.</p></div></main></template>`,
        `export function buildTimeline({ root, timeline }) {
          const copy = root.querySelector('[data-edit="final-copy"]');
          timeline.set(copy, { autoAlpha: 1 }, 0);
          timeline.to(copy, { y: 6, duration: 1.8 }, 0);
        }`,
      );
      expect(() =>
        validateGeneratedComposition(overflowing, {
          prompt: "Close on the brand",
          previousHtml: `<template><main data-edit="stage"><div data-edit="brand-lockup"><p data-edit="final-copy"></p></div></main></template>`,
          previousDuration: 2,
          previousScenes: scenes,
        }),
      ).toThrow(/escape its container/);
    });

    it("accepts copy that sits inside its carrier", () => {
      const fitting = result(
        `<template><main data-edit="stage"><div data-edit="brand-lockup" style="overflow:hidden;border-radius:80px;background:#16181d" data-rect="500,400,920,240"><p data-edit="final-copy" data-rect="560,460,800,120">Decide with confidence.</p></div></main></template>`,
        `export function buildTimeline({ root, timeline }) {
          const copy = root.querySelector('[data-edit="final-copy"]');
          timeline.set(copy, { autoAlpha: 1 }, 0);
          timeline.to(copy, { y: 6, duration: 1.8 }, 0);
        }`,
      );
      expect(() =>
        validateGeneratedComposition(fitting, {
          prompt: "Close on the brand",
          previousHtml: `<template><main data-edit="stage"><div data-edit="brand-lockup"><p data-edit="final-copy"></p></div></main></template>`,
          previousDuration: 2,
          previousScenes: scenes,
        }),
      ).not.toThrow();
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

  it("rejects storyboard scenes that have no authored scene layer", () => {
    const declared = [
      { id: "scene-01", label: "One", start: 0, duration: 2, accent: "#fff" },
      { id: "scene-02", label: "Two", start: 2, duration: 2, accent: "#fff" },
      { id: "scene-03", label: "Three", start: 4, duration: 2, accent: "#fff" },
    ];
    const film = {
      duration: 6,
      scenes: declared,
      compositionHtml: `<template><main data-edit="stage"><section data-scene="scene-01" data-edit="hook">Ask</section><section data-scene="scene-02" data-edit="proof">Answer</section></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        timeline.to(root.querySelector('[data-edit="hook"]'), { x: 20, duration: 3 }, 0);
        timeline.to(root.querySelector('[data-edit="proof"]'), { x: 20, duration: 3 }, 3);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(film, {
        prompt: "Make a product film for Vault",
        previousHtml: `<template><main data-edit="stage"></main></template>`,
        previousDuration: 6,
        previousScenes: [],
        generationProfile: "claude-foundation-v1",
        lenient: true,
      }),
    ).toThrow(/did not author data-scene layers for: scene-03/);
  });

  it("rejects a declared scene whose own content stays hidden", () => {
    const restore = stubLayout();
    try {
      const film = {
        duration: 4,
        scenes: twoScenes,
        compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="carrier" data-transition-carrier data-rect="200,200,1400,500">Persistent subject</div><section data-scene="scene-01" data-edit="one" data-rect="300,260,800,180">First beat</section><section data-scene="scene-02" data-edit="two" data-rect="300,260,800,180"><h2 data-edit="hidden-proof" data-rect="360,300,680,120" style="opacity:0">Missing beat</h2></section></main></template>`,
        timelineJs: `export function buildTimeline({ root, timeline }) {
          const carrier = root.querySelector('[data-edit="carrier"]');
          const one = root.querySelector('[data-edit="one"]');
          timeline.to(carrier, { x: 30, duration: 4 }, 0);
          timeline.set(one, { autoAlpha: 0 }, 2.1);
        }`,
        reply: "Done",
      };
      expect(() =>
        validateGeneratedComposition(film, {
          prompt: "Make a product film for Vault",
          previousHtml: `<template><main data-edit="stage"></main></template>`,
          previousDuration: 4,
          previousScenes: [],
          generationProfile: "claude-foundation-v1",
          lenient: true,
        }),
      ).toThrow(/scene-02 never renders visible scene content/i);
    } finally {
      restore();
    }
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

describe("dead air between beats", () => {
  it("reports a long frozen stretch without blocking the film", () => {
    const frozen = {
      duration: 10,
      scenes: [
        { id: "main", label: "Main", start: 0, duration: 10, accent: "#fff" },
      ],
      compositionHtml: `<template><main data-edit="stage"><h1 data-edit="hook">Ship faster</h1><p data-edit="close">Every week</p></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const hook = root.querySelector('[data-edit="hook"]');
        const close = root.querySelector('[data-edit="close"]');
        timeline.set(close, { autoAlpha: 0 }, 0);
        timeline.fromTo(hook, { y: 40 }, { y: 0, duration: 1 }, 0);
        timeline.to(close, { autoAlpha: 1, y: -10, duration: 0.8 }, 9);
      }`,
      reply: "Done",
    };
    const validated = validateGeneratedComposition(frozen, {
      prompt: "Make a teaser",
      previousHtml: `<template><main data-edit="stage"><h1 data-edit="hook"></h1><p data-edit="close"></p></main></template>`,
      previousDuration: 10,
      previousScenes: frozen.scenes,
    });
    expect(
      validated.warnings.some((warning) => /still frame for/.test(warning)),
    ).toBe(true);
  });
});

describe("seams at render time", () => {
  const seamScenes = [
    { id: "scene-01", label: "One", start: 0, duration: 2, accent: "#fff" },
    { id: "scene-02", label: "Two", start: 2, duration: 2, accent: "#fff" },
  ];
  const seams = [
    {
      from: "scene-01",
      to: "scene-02",
      at: 1.6,
      duration: 0.8,
      carrier: "story-carrier",
      mechanism: "morph" as const,
      becomes: "the first plate stretches into the second",
    },
  ];
  const previousHtml = `<template><main data-edit="stage"><div data-edit="story-carrier"></div><div data-edit="one"></div><div data-edit="two"></div></main></template>`;

  function film(timelineJs: string) {
    return {
      duration: 4,
      scenes: seamScenes,
      seams,
      compositionHtml: `<template><main data-edit="stage"><div data-edit="story-carrier" data-transition-carrier>Carrier</div><div data-edit="one" data-scene="scene-01">First beat</div><div data-edit="two" data-scene="scene-02">Second beat</div></main></template>`,
      timelineJs,
      reply: "Done",
    };
  }

  /**
   * The overlap a morph needs. Before seams existed this threw outright,
   * because the outgoing beat was still on screen after the cut — so the only
   * way past the check was to hide one beat and show the next.
   */
  it("lets the outgoing beat live through its own seam", () => {
    const overlapping =
      film(`export function buildTimeline({ root, timeline }) {
      const one = root.querySelector('[data-edit="one"]');
      const two = root.querySelector('[data-edit="two"]');
      const carrier = root.querySelector('[data-edit="story-carrier"]');
      timeline.set(two, { display: "none", autoAlpha: 0 }, 0);
      timeline.to(one, { x: 10, duration: 1 }, 0);
      timeline.set(two, { display: "block", autoAlpha: 1 }, 1.6);
      timeline.to(carrier, { width: 900, x: 300, duration: 0.8 }, 1.6);
      timeline.set(one, { display: "none", autoAlpha: 0 }, 2.4);
      timeline.to(two, { x: 12, duration: 1.2 }, 2.4);
    }`);
    expect(() =>
      validateGeneratedComposition(overlapping, {
        prompt: "Polish the transition",
        previousHtml,
        previousDuration: 4,
        previousScenes: seamScenes,
      }),
    ).not.toThrow();
  });

  it("still rejects an outgoing beat that outlives its seam", () => {
    const lingering = film(`export function buildTimeline({ root, timeline }) {
      const one = root.querySelector('[data-edit="one"]');
      const two = root.querySelector('[data-edit="two"]');
      const carrier = root.querySelector('[data-edit="story-carrier"]');
      timeline.set(two, { display: "none", autoAlpha: 0 }, 0);
      timeline.to(one, { x: 10, duration: 1 }, 0);
      timeline.set(two, { display: "block", autoAlpha: 1 }, 1.6);
      timeline.to(carrier, { width: 900, x: 300, duration: 0.8 }, 1.6);
      timeline.to(two, { x: 12, duration: 1.2 }, 2.4);
    }`);
    expect(() =>
      validateGeneratedComposition(lingering, {
        prompt: "Polish the transition",
        previousHtml,
        previousDuration: 4,
        previousScenes: seamScenes,
      }),
    ).toThrow(/stale layer from scene-01/);
  });

  /**
   * The check a `morph()` call cannot satisfy on its own: the carrier is hidden
   * for the whole boundary, so nothing visibly crosses it however the source
   * reads.
   */
  it("reports a seam whose carrier is never on screen", () => {
    const hiddenCarrier =
      film(`export function buildTimeline({ root, timeline }) {
      const one = root.querySelector('[data-edit="one"]');
      const two = root.querySelector('[data-edit="two"]');
      const carrier = root.querySelector('[data-edit="story-carrier"]');
      timeline.set(carrier, { autoAlpha: 0 }, 0);
      timeline.set(two, { display: "none", autoAlpha: 0 }, 0);
      timeline.to(one, { x: 10, duration: 1 }, 0);
      morph(timeline, carrier, { width: 900 }, { at: 1.6, duration: 0.8 });
      timeline.set(two, { display: "block", autoAlpha: 1 }, 1.6);
      timeline.set(one, { display: "none", autoAlpha: 0 }, 2.4);
      timeline.to(two, { x: 12, duration: 1.2 }, 2.4);
    }`);
    const validated = validateGeneratedComposition(hiddenCarrier, {
      prompt: "Polish the transition",
      previousHtml,
      previousDuration: 4,
      previousScenes: seamScenes,
    });
    expect(
      validated.warnings.some((warning) => /is a hard cut/.test(warning)),
    ).toBe(true);
  });

  it("reports a carrier that leaves before the beats have swapped", () => {
    const earlyExit = film(`export function buildTimeline({ root, timeline }) {
      const one = root.querySelector('[data-edit="one"]');
      const two = root.querySelector('[data-edit="two"]');
      const carrier = root.querySelector('[data-edit="story-carrier"]');
      timeline.set(two, { display: "none", autoAlpha: 0 }, 0);
      timeline.to(one, { x: 10, duration: 1 }, 0);
      timeline.set(two, { display: "block", autoAlpha: 1 }, 1.6);
      timeline.to(carrier, { width: 900, duration: 0.4 }, 1.6);
      timeline.set(carrier, { autoAlpha: 0 }, 2.0);
      timeline.set(one, { display: "none", autoAlpha: 0 }, 2.4);
      timeline.to(two, { x: 12, duration: 1.2 }, 2.4);
    }`);
    const validated = validateGeneratedComposition(earlyExit, {
      prompt: "Polish the transition",
      previousHtml,
      previousDuration: 4,
      previousScenes: seamScenes,
    });
    expect(
      validated.warnings.some((warning) =>
        /is not on screen after its seam/.test(warning),
      ),
    ).toBe(true);
  });
});

describe("empty painted plates", () => {
  let restore: () => void = () => {};
  beforeEach(() => {
    restore = stubLayout();
  });
  afterEach(() => {
    restore();
  });

  const plateScenes = [
    { id: "main", label: "Main", start: 0, duration: 2, accent: "#fff" },
  ];

  /**
   * The reported defect: the carrier keeps its own background lit through a
   * stretch where neither the outgoing nor the incoming face is on screen, and
   * the viewer watches a coloured rectangle sit in the middle of the frame.
   */
  it("rejects a painted carrier whose faces are all hidden", () => {
    const plate = {
      duration: 2,
      scenes: plateScenes,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="morph-card" data-rect="700,400,500,280" style="background:#5b9dff;border-radius:24px"><div data-edit="slot-a" data-rect="720,420,460,240">Bug report</div></div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const card = root.querySelector('[data-edit="morph-card"]');
        const slot = root.querySelector('[data-edit="slot-a"]');
        timeline.set(slot, { autoAlpha: 0 }, 0);
        timeline.to(card, { x: 40, duration: 1.6 }, 0);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(plate, {
        prompt: "Make an ad for my issue tracker",
        previousHtml: `<template><main data-edit="stage"><div data-edit="morph-card"><div data-edit="slot-a"></div></div></main></template>`,
        previousDuration: 2,
        previousScenes: plateScenes,
      }),
    ).toThrow(/shows an empty plate.*morph-card/s);
  });

  it("accepts the same plate once its face is on screen", () => {
    const filled = {
      duration: 2,
      scenes: plateScenes,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="morph-card" data-rect="700,400,500,280" style="background:#5b9dff;border-radius:24px"><div data-edit="slot-a" data-rect="720,420,460,240">Bug report</div></div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const card = root.querySelector('[data-edit="morph-card"]');
        timeline.to(card, { x: 40, duration: 1.6 }, 0);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(filled, {
        prompt: "Make an ad for my issue tracker",
        previousHtml: `<template><main data-edit="stage"><div data-edit="morph-card"><div data-edit="slot-a"></div></div></main></template>`,
        previousDuration: 2,
        previousScenes: plateScenes,
      }),
    ).not.toThrow();
  });

  /** A carrier with no surface of its own is the shape this rule steers toward. */
  it("accepts an unpainted carrier holding nothing", () => {
    const bare = {
      duration: 2,
      scenes: plateScenes,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="carrier" data-rect="700,400,500,280"><div data-edit="slot-a" data-rect="720,420,460,240">Bug report</div></div><h1 data-edit="hook" data-rect="200,120,900,120">Filing is instant</h1></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const carrier = root.querySelector('[data-edit="carrier"]');
        const slot = root.querySelector('[data-edit="slot-a"]');
        timeline.set(slot, { autoAlpha: 0 }, 0);
        timeline.to(carrier, { x: 40, duration: 1.6 }, 0);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(bare, {
        prompt: "Make an ad for my issue tracker",
        previousHtml: `<template><main data-edit="stage"><div data-edit="carrier"><div data-edit="slot-a"></div></div><h1 data-edit="hook"></h1></main></template>`,
        previousDuration: 2,
        previousScenes: plateScenes,
      }),
    ).not.toThrow();
  });
});

describe("a frame the viewer can read", () => {
  let restore: () => void = () => {};
  beforeEach(() => {
    restore = stubLayout();
  });
  afterEach(() => {
    restore();
  });

  const one = [
    { id: "main", label: "Main", start: 0, duration: 2, accent: "#fff" },
  ];
  const two = [
    { id: "scene-01", label: "One", start: 0, duration: 2, accent: "#fff" },
    { id: "scene-02", label: "Two", start: 2, duration: 2, accent: "#fff" },
  ];

  /** The reported film: four small cards adrift in a mostly empty frame. */
  it("rejects a beat whose largest object is a small card", () => {
    const adrift = {
      duration: 2,
      scenes: one,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="card-1" data-rect="200,200,260,90" style="background:#fff">Product Strategy</div><div data-edit="card-2" data-rect="1400,300,260,90" style="background:#fff">Launch Notes</div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        timeline.to(root.querySelector('[data-edit="card-1"]'), { x: 20, duration: 1.6 }, 0);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(adrift, {
        prompt: "make an ad",
        previousHtml: `<template><main data-edit="stage"><div data-edit="card-1"></div><div data-edit="card-2"></div></main></template>`,
        previousDuration: 2,
        previousScenes: one,
      }),
    ).toThrow(/small cards floating in empty space/);
  });

  it("accepts a beat composed around a subject at a readable size", () => {
    const composed = {
      duration: 2,
      scenes: one,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><h1 data-edit="hook" data-rect="200,300,1520,300" style="background:#fff">Filing is instant</h1></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        timeline.to(root.querySelector('[data-edit="hook"]'), { x: 20, duration: 1.6 }, 0);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(composed, {
        prompt: "make an ad",
        previousHtml: `<template><main data-edit="stage"><h1 data-edit="hook"></h1></main></template>`,
        previousDuration: 2,
        previousScenes: one,
      }),
    ).not.toThrow();
  });

  /**
   * The "why is each scene separate" report: both beats are individually well
   * made, and every object is replaced at the cut.
   */
  it("rejects a cut where every object on screen is replaced at once", () => {
    const unrelated = {
      duration: 4,
      scenes: two,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="one" data-scene="scene-01" data-rect="200,200,1400,500" style="background:#fff">Scattered work</div><div data-edit="two" data-scene="scene-02" data-rect="200,200,1400,500" style="background:#fff">A filed table</div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const one = root.querySelector('[data-edit="one"]');
        const two = root.querySelector('[data-edit="two"]');
        timeline.set(two, { display: "none", autoAlpha: 0 }, 0);
        timeline.to(one, { x: 20, duration: 1.5 }, 0);
        timeline.set(one, { display: "none", autoAlpha: 0 }, 2);
        timeline.set(two, { display: "block", autoAlpha: 1 }, 2);
        timeline.to(two, { x: 20, duration: 1.5 }, 2);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(unrelated, {
        prompt: "make an ad",
        previousHtml: `<template><main data-edit="stage"><div data-edit="one"></div><div data-edit="two"></div></main></template>`,
        previousDuration: 4,
        previousScenes: two,
      }),
    ).toThrow(/Nothing survives the cut from scene-01 to scene-02/);
  });

  it("accepts a cut that carries one object across it", () => {
    const carried = {
      duration: 4,
      scenes: two,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="carrier" data-rect="200,200,1400,500" style="background:#fff"><div data-edit="one" data-scene="scene-01" data-rect="300,260,600,120">Scattered</div><div data-edit="two" data-scene="scene-02" data-rect="300,450,600,120">Filed</div></div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const carrier = root.querySelector('[data-edit="carrier"]');
        const one = root.querySelector('[data-edit="one"]');
        const two = root.querySelector('[data-edit="two"]');
        timeline.set(two, { display: "none", autoAlpha: 0 }, 0);
        timeline.to(one, { x: 20, duration: 1.5 }, 0);
        timeline.set(one, { display: "none", autoAlpha: 0 }, 2);
        timeline.set(two, { display: "block", autoAlpha: 1 }, 2);
        timeline.to(carrier, { x: 40, scaleY: 1.2, duration: 1.5 }, 2);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(carried, {
        prompt: "make an ad",
        previousHtml: `<template><main data-edit="stage"><div data-edit="carrier"></div><div data-edit="one"></div><div data-edit="two"></div></main></template>`,
        previousDuration: 4,
        previousScenes: two,
      }),
    ).not.toThrow();
  });
});

describe("lenient validation of the pass that ships", () => {
  let restore: () => void = () => {};
  beforeEach(() => {
    restore = stubLayout();
  });
  afterEach(() => {
    restore();
  });

  const one = [
    { id: "main", label: "Main", start: 0, duration: 2, accent: "#fff" },
  ];
  const adrift = {
    duration: 2,
    scenes: one,
    compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="card-1" data-rect="200,200,260,90" style="background:#fff">Product Strategy</div><div data-edit="card-2" data-rect="1400,300,260,90" style="background:#fff">Launch Notes</div></main></template>`,
    timelineJs: `export function buildTimeline({ root, timeline }) {
      timeline.to(root.querySelector('[data-edit="card-1"]'), { x: 20, duration: 1.6 }, 0);
    }`,
    reply: "Done",
  };
  const options = {
    prompt: "make an ad",
    previousHtml: `<template><main data-edit="stage"><div data-edit="card-1"></div><div data-edit="card-2"></div></main></template>`,
    previousDuration: 2,
    previousScenes: one,
  };

  /**
   * What the user hit: the repair loop tolerated the weak beat, and then the
   * winning pass was validated a second time and that call threw, so the film
   * still arrived as an error with a Fix button.
   */
  it("hands back the film with a note instead of throwing", () => {
    const validated = validateGeneratedComposition(adrift, {
      ...options,
      lenient: true,
    });
    expect(validated.duration).toBe(2);
    expect(validated.scenes).toHaveLength(1);
    expect(
      validated.warnings.some((warning) =>
        /small cards floating in empty space/.test(warning),
      ),
    ).toBe(true);
  });

  it("still refuses a film that renders no frame at all", () => {
    const blank = {
      ...adrift,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const stage = root.querySelector('[data-edit="stage"]');
        timeline.set(stage, { display: "none" }, 0);
        timeline.to({}, { duration: 2 }, 0);
      }`,
    };
    expect(() =>
      validateGeneratedComposition(blank, { ...options, lenient: true }),
    ).toThrow(/no visible foreground/);
  });

  it("keeps throwing for the strict pass the repair loop runs on", () => {
    expect(() => validateGeneratedComposition(adrift, options)).toThrow(
      /small cards floating in empty space/,
    );
  });
});

describe("dissolving through nothing", () => {
  let restore: () => void = () => {};
  beforeEach(() => {
    restore = stubLayout();
  });
  afterEach(() => {
    restore();
  });

  const two = [
    { id: "scene-01", label: "One", start: 0, duration: 2, accent: "#fff" },
    { id: "scene-02", label: "Two", start: 2, duration: 2, accent: "#fff" },
  ];
  const markup = `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="one" data-scene="scene-01" data-rect="200,200,1400,500" style="background:#fff">Scattered work</div><div data-edit="two" data-scene="scene-02" data-rect="200,200,1400,500" style="background:#fff">A filed table</div></main></template>`;
  const previousHtml = `<template><main data-edit="stage"><div data-edit="one"></div><div data-edit="two"></div></main></template>`;

  /**
   * The reported "dead frame" dissolve: the outgoing beat is cleared before the
   * incoming one arrives, so the boundary passes through a blank screen.
   */
  it("rejects a cut that passes through an empty frame", () => {
    const dissolve = {
      duration: 4,
      scenes: two,
      compositionHtml: markup,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const one = root.querySelector('[data-edit="one"]');
        const two = root.querySelector('[data-edit="two"]');
        timeline.set(two, { autoAlpha: 0 }, 0);
        timeline.to(one, { x: 20, duration: 1.4 }, 0);
        timeline.set(one, { autoAlpha: 0 }, 1.6);
        timeline.set(two, { autoAlpha: 1 }, 2.4);
        timeline.to(two, { x: 20, duration: 1.2 }, 2.4);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(dissolve, {
        prompt: "make an ad",
        previousHtml,
        previousDuration: 4,
        previousScenes: two,
      }),
    ).toThrow(/empty frame|blank frame/);
  });

  it("accepts a boundary where the incoming material is already arriving", () => {
    const overlapped = {
      duration: 4,
      scenes: two,
      seams: [
        {
          from: "scene-01",
          to: "scene-02",
          at: 1.6,
          duration: 0.8,
          carrier: "one",
          mechanism: "morph" as const,
          becomes: "the pile becomes the table",
        },
      ],
      // Laid out apart, because the layout stub cannot apply the transform
      // that would carry the outgoing beat clear of the incoming one.
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="one" data-scene="scene-01" data-rect="200,80,1400,420" style="background:#fff">Scattered work</div><div data-edit="two" data-scene="scene-02" data-rect="200,580,1400,420" style="background:#fff">A filed table</div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const one = root.querySelector('[data-edit="one"]');
        const two = root.querySelector('[data-edit="two"]');
        timeline.set(two, { autoAlpha: 0 }, 0);
        timeline.to(one, { x: 20, duration: 1.4 }, 0);
        timeline.set(two, { autoAlpha: 1 }, 1.6);
        timeline.to(one, { x: 900, scaleY: 0.9, duration: 0.8 }, 1.6);
        timeline.set(one, { autoAlpha: 0 }, 2.4);
        timeline.to(two, { x: 20, duration: 1.2 }, 2.4);
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(overlapped, {
        prompt: "make an ad",
        previousHtml,
        previousDuration: 4,
        previousScenes: two,
      }),
    ).not.toThrow();
  });
});

describe("a film that states something", () => {
  let restore: () => void = () => {};
  beforeEach(() => {
    restore = stubLayout();
  });
  afterEach(() => {
    restore();
  });

  const scene = [
    { id: "main", label: "Main", start: 0, duration: 12, accent: "#fff" },
  ];
  const previousHtml = `<template><main data-edit="stage"><h1 data-edit="hook"></h1></main></template>`;

  function film(rect: string) {
    return {
      duration: 12,
      scenes: scene,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><h1 data-edit="hook" data-rect="${rect}" style="background:#f6f5f8">Filing is instant</h1></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        timeline.to(root.querySelector('[data-edit="hook"]'), { x: 30, duration: 10 }, 0);
      }`,
      reply: "Done",
    };
  }
  const options = {
    prompt: "make an ad",
    previousHtml,
    previousDuration: 12,
    previousScenes: scene,
  };

  /**
   * The reported defect: a 28px headline inside a pill. Every studied
   * reference puts a statement across 45-85% of the frame.
   */
  it("rejects a film whose largest line is a caption", () => {
    // 550px of 1920 is 29% of frame width, so this is too narrow to be a
    // statement — but tall enough (7.9% of the canvas) to clear the
    // small-objects check first, which isolates the rule under test.
    expect(() =>
      validateGeneratedComposition(film("690,390,550,300"), options),
    ).toThrow(/never states anything/);
  });

  it("accepts a film that puts a real statement on screen", () => {
    // 1180px of 1920 is 61% — inside the 45-85% the references use.
    expect(() =>
      validateGeneratedComposition(film("370,420,1180,150"), options),
    ).not.toThrow();
  });

  it("does not ask a two-second fragment for an editorial statement", () => {
    const fragment = {
      ...film("690,390,550,300"),
      duration: 2,
      // The timeline has to be short too: a composition adopts its timeline's
      // real length, so a 10s tween would make this a film after all.
      timelineJs: `export function buildTimeline({ root, timeline }) {
        timeline.to(root.querySelector('[data-edit="hook"]'), { x: 30, duration: 1.5 }, 0);
      }`,
      scenes: [
        { id: "main", label: "Main", start: 0, duration: 2, accent: "#fff" },
      ],
    };
    expect(() =>
      validateGeneratedComposition(fragment, {
        ...options,
        previousDuration: 2,
        previousScenes: fragment.scenes,
      }),
    ).not.toThrow();
  });
});

describe("the frame as the viewer sees it", () => {
  let restore: () => void = () => {};
  beforeEach(() => {
    restore = stubLayout();
  });
  afterEach(() => {
    restore();
  });

  const one = [
    { id: "main", label: "Main", start: 0, duration: 12, accent: "#fff" },
  ];
  const move = `export function buildTimeline({ root, timeline }) {
    timeline.to(root.querySelector('[data-edit="hook"]'), { x: 30, duration: 10 }, 0);
  }`;

  /**
   * The reported resolve: the lockup sat off-centre and the mark itself was
   * cut away by the right edge, reading "...workspace in Not".
   */
  it("rejects settled type that runs off the edge of the frame", () => {
    // The line sits comfortably inside its parent — a 4000px camera world —
    // and still runs off the right of the 1920px viewport. That is the real
    // shape of the defect, and the only check that sees it is this one.
    const clipped = {
      duration: 12,
      scenes: one,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="camera-world" data-camera-world data-rect="0,0,4000,1080"><h1 data-edit="hook" data-rect="700,420,1400,150">Build your company workspace in Notion</h1></div></main></template>`,
      timelineJs: move,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(clipped, {
        prompt: "make an ad",
        previousHtml: `<template><main data-edit="stage"><h1 data-edit="hook"></h1></main></template>`,
        previousDuration: 12,
        previousScenes: one,
      }),
    ).toThrow(/run \d+px outside the frame/);
  });

  /**
   * The same defect, in the objects the type check never looked at. Until
   * this existed only a clipped headline was caught, and the device mock,
   * card or logo beside it could settle anywhere it liked.
   */
  it("rejects a settled object that hangs off the edge of the frame", () => {
    const clipped = {
      duration: 12,
      scenes: one,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="hook" data-rect="300,80,1300,160">Plans that file themselves</div><img data-edit="card" data-rect="1500,500,600,300" src="card.png" alt="card" /></main></template>`,
      timelineJs: move,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(clipped, {
        prompt: "make an ad",
        previousHtml: `<template><main data-edit="stage"><div data-edit="hook"></div></main></template>`,
        previousDuration: 12,
        previousScenes: one,
      }),
    ).toThrow(/leaves "card" \d+% outside the frame/);
  });

  it("accepts an object that only bleeds a little past the edge", () => {
    // A shape kissing the edge is a composition, not a mistake; the check is
    // about an object with a third of itself gone.
    const bleeding = {
      duration: 12,
      scenes: one,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="hook" data-rect="300,80,1300,160">Plans that file themselves</div><img data-edit="card" data-rect="1340,500,540,300" src="card.png" alt="card" /></main></template>`,
      timelineJs: move,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(bleeding, {
        prompt: "make an ad",
        previousHtml: `<template><main data-edit="stage"><div data-edit="hook"></div></main></template>`,
        previousDuration: 12,
        previousScenes: one,
      }),
    ).not.toThrow(/outside the frame/);
  });

  it("accepts a wide world whose type is framed inside the viewport", () => {
    const framed = {
      duration: 12,
      scenes: one,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="camera-world" data-camera-world data-rect="0,0,4000,1080"><h1 data-edit="hook" data-rect="260,420,1400,150">Build your company workspace</h1></div></main></template>`,
      timelineJs: move,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(framed, {
        prompt: "make an ad",
        previousHtml: `<template><main data-edit="stage"><h1 data-edit="hook"></h1></main></template>`,
        previousDuration: 12,
        previousScenes: one,
      }),
    ).not.toThrow();
  });

  it("accepts a statement sized to sit inside the frame", () => {
    const fits = {
      duration: 12,
      scenes: one,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><h1 data-edit="hook" data-rect="260,420,1400,150">Build your company workspace</h1></main></template>`,
      timelineJs: move,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(fits, {
        prompt: "make an ad",
        previousHtml: `<template><main data-edit="stage"><h1 data-edit="hook"></h1></main></template>`,
        previousDuration: 12,
        previousScenes: one,
      }),
    ).not.toThrow();
  });

  /**
   * The reported film: five beats, each a headline on the upper third with a
   * small panel beneath it, camera never moving. Every beat is individually
   * well formed, which is why nothing in the source reveals it.
   */
  it("rejects a film that is one composition with the copy swapped", () => {
    const beats = [0, 1, 2, 3].map((index) => ({
      id: `scene-0${index + 1}`,
      label: `0${index + 1}`,
      start: index * 4,
      duration: 4,
      accent: "#fff",
    }));
    const panels = beats
      .map(
        (beat) =>
          `<div data-edit="panel-${beat.id}" data-scene="${beat.id}" data-rect="360,300,1200,480" style="background:#fff">Panel ${beat.id}</div>`,
      )
      .join("");
    const repeated = {
      duration: 16,
      scenes: beats,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><h1 data-edit="hook" data-rect="260,120,1400,140">One clear statement</h1>${panels}</main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const all = ${JSON.stringify(beats.map((b) => `panel-${b.id}`))};
        all.forEach((id, index) => {
          const el = root.querySelector('[data-edit="' + id + '"]');
          timeline.set(el, { autoAlpha: 0 }, 0);
          timeline.set(el, { autoAlpha: 1 }, index * 4);
          timeline.to(el, { x: 8, duration: 3.5 }, index * 4);
          if (index < 3) timeline.set(el, { autoAlpha: 0 }, index * 4 + 4);
        });
      }`,
      reply: "Done",
    };
    expect(() =>
      validateGeneratedComposition(repeated, {
        prompt: "make an ad",
        previousHtml: `<template><main data-edit="stage"><h1 data-edit="hook"></h1></main></template>`,
        previousDuration: 16,
        previousScenes: beats,
      }),
    ).toThrow(/one composition repeated/);
  });
});

describe("a carrier trapped inside its own beat", () => {
  const two = [
    { id: "scene-01", label: "One", start: 0, duration: 2, accent: "#fff" },
    { id: "scene-02", label: "Two", start: 2, duration: 2, accent: "#fff" },
  ];
  const seams = [
    {
      from: "scene-01",
      to: "scene-02",
      at: 1.6,
      duration: 0.8,
      carrier: "story-carrier",
      mechanism: "morph" as const,
      becomes: "the plate becomes the panel",
    },
  ];

  /**
   * The reported loop: five seams, every carrier "hidden on both sides", and
   * the complaint unchanged after each repair pass. The carrier obeyed the
   * placement rule as written — it carried no `data-scene` tag — but sat inside
   * a scene container, so clearing that beat cleared the carrier with it.
   */
  it("names the scene container that is clearing the carrier", () => {
    const trapped = {
      duration: 4,
      scenes: two,
      seams,
      compositionHtml: `<template><main data-edit="stage"><div data-edit="camera-world" data-camera-world><div data-edit="beat-one" data-scene="scene-01"><div data-edit="story-carrier" data-transition-carrier>Carrier</div></div><div data-edit="beat-two" data-scene="scene-02">Second beat</div></div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const one = root.querySelector('[data-edit="beat-one"]');
        const two = root.querySelector('[data-edit="beat-two"]');
        const carrier = root.querySelector('[data-edit="story-carrier"]');
        timeline.set(one, { autoAlpha: 0 }, 0);
        timeline.set(two, { autoAlpha: 0 }, 0);
        timeline.to(carrier, { x: 40, duration: 1.2 }, 0.2);
        timeline.set(two, { autoAlpha: 1 }, 1.6);
        timeline.to(two, { x: 20, duration: 1.2 }, 2.4);
      }`,
      reply: "Done",
    };
    const validated = validateGeneratedComposition(trapped, {
      prompt: "Polish the transition",
      previousHtml: `<template><main data-edit="stage"><div data-edit="story-carrier"></div></main></template>`,
      previousDuration: 4,
      previousScenes: two,
    });
    const note = validated.warnings.join(" ");
    expect(note).toMatch(/lives inside the scene container "scene-01"/);
    // The fix has to be actionable, or the repair pass cannot clear it.
    expect(note).toMatch(/Move the carrier out of every data-scene subtree/);
  });
});

describe("a beat holding nothing but its ground", () => {
  let restore: () => void = () => {};
  beforeEach(() => {
    restore = stubLayout();
  });
  afterEach(() => {
    restore();
  });

  const one = [
    { id: "main", label: "Main", start: 0, duration: 12, accent: "#fff" },
  ];
  const options = {
    prompt: "make an ad",
    previousHtml: `<template><main data-edit="stage"><div data-edit="hook"></div></main></template>`,
    previousDuration: 12,
    previousScenes: one,
  };
  const drift = `export function buildTimeline({ root, timeline }) {
    timeline.to(root.querySelector('[data-edit="ambient-glow"]'), { x: 30, duration: 10 }, 0);
  }`;

  /**
   * The reported blank scenes. A decorative bloom carries a `data-edit` id, is
   * painted, and covers plenty of the canvas, so it answered "yes, something is
   * on screen" to every emptiness check at once and the beat shipped empty.
   */
  it("rejects a beat whose only occupant is a decorative bloom", () => {
    const blank = {
      duration: 12,
      scenes: one,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="ambient-glow" data-rect="560,240,800,600" style="background:#eee"></div></main></template>`,
      timelineJs: drift,
      reply: "Done",
    };
    expect(() => validateGeneratedComposition(blank, options)).toThrow(
      /no visible foreground/,
    );
  });

  it("rejects a beat holding only an element tagged as a background role", () => {
    const blank = {
      duration: 12,
      scenes: one,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="signal-path" data-background-role="signal-path" data-rect="200,240,1500,600" style="background:#eee"></div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        timeline.to(root.querySelector('[data-edit="signal-path"]'), { x: 30, duration: 10 }, 0);
      }`,
      reply: "Done",
    };
    expect(() => validateGeneratedComposition(blank, options)).toThrow(
      /no visible foreground/,
    );
  });

  /** A sharp gradient sphere is a real shot, not atmosphere. */
  it("keeps treating an unblurred hero form as a subject", () => {
    const hero = {
      duration: 12,
      scenes: one,
      compositionHtml: `<template><main data-edit="stage" data-rect="0,0,1920,1080"><div data-edit="ambient-glow" data-rect="0,0,1900,1070" style="background:#f6f5f8"></div><div data-edit="hero-sphere" data-rect="660,290,600,500" style="background:#5b9dff">Sphere</div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        timeline.to(root.querySelector('[data-edit="hero-sphere"]'), { rotation: 30, duration: 10 }, 0);
      }`,
      reply: "Done",
    };
    expect(() => validateGeneratedComposition(hero, options)).not.toThrow();
  });
  /**
   * Six five-second beats declared against a 20s duration threw before the
   * frames were ever inspected, outside the lenient path, so the user got
   * "Scene scene-06 falls outside the composition duration" and an empty
   * canvas. Arithmetic is not a broken film.
   */
  it("extends the composition when the storyboard overruns its duration", () => {
    const restore = stubLayout();
    try {
      const six = [0, 1, 2, 3, 4, 5].map((index) => ({
        id: `scene-0${index + 1}`,
        label: `Beat ${index + 1}`,
        start: index * 5,
        duration: 5,
        accent: "#fff",
      }));
      const film = {
        duration: 20,
        scenes: six,
        compositionHtml: `<template><main data-edit="stage" style="width:1920px">${six
          .map(
            (scene) =>
              `<section data-edit="${scene.id}" data-scene="${scene.id}" data-rect="160,140,1600,800"><h1 data-edit="${scene.id}-copy" data-rect="200,200,1200,180">A complete sentence for this beat.</h1></section>`,
          )
          .join("")}</main></template>`,
        timelineJs: `export function buildTimeline({ root, timeline }) {
          const all = Array.from(root.querySelectorAll('[data-scene]'));
          all.forEach((el, i) => timeline.to(el, { x: 12, duration: 1.2 }, i * 5));
        }`,
        reply: "Done",
      };
      const validated = validateGeneratedComposition(film, {
        prompt: "Make a six beat SaaS ad",
        previousHtml: `<template><main data-edit="stage"></main></template>`,
        previousDuration: 20,
        previousScenes: six,
        lenient: true,
      });
      expect(validated.duration).toBeGreaterThanOrEqual(30);
      expect(validated.warnings.join(" ")).toContain(
        "extended to fit its beats",
      );
    } finally {
      restore();
    }
  });
});

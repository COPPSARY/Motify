import gsap from "gsap";
import { describe, expect, it } from "vitest";

import { createDynamicComposition } from "../../src/composition/dynamic-compiler";
import {
  DrawSVGPlugin,
  Flip,
  MorphSVGPlugin,
  MotionPathPlugin,
  SplitText,
  sharedElementHandoff,
  splitReveal,
} from "../../src/composition/presets";

const PROPS = ["x", "y", "scale", "rotation", "yPercent", "opacity"] as const;

/** Seeks the way `CompositionRuntime` does: rewinding to 0 before a backward seek. */
function seek(timeline: gsap.core.Timeline, t: number) {
  if (t < timeline.totalTime()) timeline.totalTime(0, false);
  timeline.totalTime(t, false);
}

/** Transform and opacity of every element under `root` at time `t`. */
function snapshot(timeline: gsap.core.Timeline, root: HTMLElement, t: number) {
  seek(timeline, t);
  return Array.from(root.querySelectorAll<HTMLElement>("*")).map((node) =>
    PROPS.map((prop) => Number(gsap.getProperty(node, prop)).toFixed(3)),
  );
}

/** Seeking out of order must land on the same frame as seeking straight there. */
function expectDeterministic(
  build: (timeline: gsap.core.Timeline, root: HTMLElement) => void,
  times: number[],
) {
  const make = () => {
    const root = document.createElement("div");
    root.innerHTML = `<h1 data-edit="title" style="position:absolute;left:1500px;top:160px;width:120px">Ship the seat.</h1>`;
    const timeline = gsap.timeline({ paused: true });
    build(timeline, root);
    // As the runtime does after mounting: render time 0 once, forced.
    timeline.render(0, false, true);
    return { root, timeline };
  };
  const reference = times.map((t) => {
    const { root, timeline } = make();
    return snapshot(timeline, root, t);
  });
  const { root, timeline } = make();
  const end = timeline.duration();
  for (const order of [[end, 0, ...times], [...times].reverse(), times]) {
    order.forEach((t) => snapshot(timeline, root, t));
    times.forEach((t, index) =>
      expect(snapshot(timeline, root, t)).toEqual(reference[index]),
    );
  }
}

describe("motion primitives", () => {
  it("registers the free GSAP plugins and puts them in a timeline's scope", () => {
    for (const plugin of [
      DrawSVGPlugin,
      Flip,
      MorphSVGPlugin,
      MotionPathPlugin,
      SplitText,
    ]) {
      expect(plugin).toBeDefined();
    }
    const root = document.createElement("div");
    const seen: string[] = [];
    (globalThis as Record<string, unknown>)["__seen"] = seen;
    createDynamicComposition(
      `<template><div data-edit="a"></div></template>`,
      `export function buildTimeline() { globalThis.__seen.push(typeof SplitText, typeof Flip, typeof MorphSVGPlugin, typeof DrawSVGPlugin, typeof MotionPathPlugin, typeof sharedElementHandoff, typeof splitReveal); }`,
      { duration: 2 },
    ).build({
      root,
      timeline: gsap.timeline({ paused: true }),
      register: () => undefined,
    } as never);
    expect(seen.every((kind) => kind !== "undefined")).toBe(true);
    expect(seen).toHaveLength(7);
  });

  it("sharedElementHandoff moves an object from its authored box to the next one", () => {
    const root = document.createElement("div");
    root.innerHTML = `<h1 data-edit="title">Ship</h1>`;
    const title = root.querySelector<HTMLElement>("h1")!;
    const timeline = gsap.timeline({ paused: true });
    sharedElementHandoff(timeline, title, {
      from: { left: 1500, top: 160, width: 120 },
      to: { left: 160, top: 420, width: 480 },
      at: 2,
      duration: 1,
    });
    seek(timeline, 3);
    expect(gsap.getProperty(title, "x")).toBe(-1340);
    expect(gsap.getProperty(title, "y")).toBe(260);
    expect(gsap.getProperty(title, "scale")).toBe(4);
    seek(timeline, 1);
    expect(gsap.getProperty(title, "x")).toBe(0);
  });

  it("sharedElementHandoff is deterministic under scrubbing", () => {
    expectDeterministic(
      (timeline, root) =>
        sharedElementHandoff(timeline, root.querySelector("h1"), {
          from: { left: 1500, top: 160, width: 120 },
          to: { left: 160, top: 420, width: 480 },
          at: 1,
          duration: 1,
        }),
      [0, 0.5, 1.3, 1.7, 2.5],
    );
  });

  it("splitReveal hides every piece until its reveal and is deterministic under scrubbing", () => {
    const root = document.createElement("div");
    root.innerHTML = `<h1>Ship the seat.</h1>`;
    const timeline = gsap.timeline({ paused: true });
    const pieces = splitReveal(timeline, root.querySelector("h1"), {
      at: 1,
      by: "words",
    });
    expect(pieces).toHaveLength(3);
    timeline.render(0, false, true);
    seek(timeline, 0.5);
    expect(
      pieces.every((piece) => gsap.getProperty(piece, "yPercent") === 110),
    ).toBe(true);
    seek(timeline, timeline.duration());
    expect(
      pieces.every((piece) => gsap.getProperty(piece, "yPercent") === 0),
    ).toBe(true);

    expectDeterministic(
      (tl, host) =>
        splitReveal(tl, host.querySelector("h1"), {
          at: 0.5,
          by: "chars",
          mask: false,
        }),
      [0, 0.6, 0.9, 1.4],
    );
  });
});

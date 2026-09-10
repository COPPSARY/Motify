import { describe, expect, it } from "vitest";

import {
  analyzeMotionQuality,
  type GeneratedComposition,
} from "../../src/ai/generation-guidance";

/**
 * Reproduces the boundary shape a live flash-lite draw actually emitted. The
 * plan declared a morph on a carrier at every boundary; the timeline switched
 * scene layers on and off, so each cut painted two stacked layouts for the
 * length of the outgoing fade. It scored 73 with no complaint about the
 * transitions at all, because the executable-handoff checks only ran when no
 * seam plan was declared, and the plan itself was sound on paper.
 */
const scenes = [0, 1, 2, 3].map((index) => ({
  id: `scene-0${index + 1}`,
  label: `Beat ${index + 1}`,
  start: index * 5,
  duration: 5,
  accent: "#5e6ad2",
}));

const seams = [0, 1, 2].map((index) => ({
  from: `scene-0${index + 1}`,
  to: `scene-0${index + 2}`,
  at: 4.6 + index * 5,
  duration: 0.8,
  carrier: "app-carrier",
  mechanism: "morph" as const,
  becomes: "the panel becomes the next surface",
}));

const html = `<template><main class="stage" data-edit="stage"><div data-edit="camera-world" data-camera-world>${scenes
  .map(
    (scene) =>
      `<section id="${scene.id}" data-scene="${scene.id}" data-edit="${scene.id}"><h2 data-edit="${scene.id}-copy">Beat copy that reads as a sentence.</h2></section>`,
  )
  .join(
    "",
  )}<div data-edit="app-carrier" data-transition-carrier></div></div></main></template>`;

function film(timelineJs: string): GeneratedComposition {
  return {
    duration: 20,
    scenes,
    seams,
    compositionHtml: html,
    timelineJs,
    reply: "",
  };
}

/** The observed defect: pop the next scene on while the last one still fades. */
const stackedSwap = film(`export function buildTimeline(context) {
  const { root, timeline: t } = context;
  const scene01 = root.querySelector('#scene-01');
  const scene02 = root.querySelector('#scene-02');
  t.set(scene01, { autoAlpha: 1 }, 0);
  t.set(scene02, { autoAlpha: 0 }, 0);
  t.to(scene01, { autoAlpha: 0, duration: 0.4 }, 4.6);
  t.set(scene02, { autoAlpha: 1 }, 4.6);
}`);

describe("scene boundaries are judged on what the timeline does", () => {
  it("blocks a scene switched on while the previous one is still fading", () => {
    const report = analyzeMotionQuality(stackedSwap, { prompt: "a saas ad" });
    const overlap = report.blockingIssues.find((issue) =>
      issue.includes("scene layers overlap"),
    );
    expect(overlap).toBeDefined();
    expect(overlap).toContain("scene02");
    expect(overlap).toContain("4.6s");
  });

  /**
   * The gate this whole fix exists for: a declared plan is a promise about the
   * timeline, not a substitute for it.
   */
  it("blocks a declared seam plan the timeline never executes", () => {
    const report = analyzeMotionQuality(stackedSwap, { prompt: "a saas ad" });
    expect(report.blockingIssues.join(" ")).toContain(
      "the seam plan declares 3 carrier handoffs but the timeline executes none",
    );
  });

  it("no longer credits the plan as though the transition were sound", () => {
    const report = analyzeMotionQuality(stackedSwap, { prompt: "a saas ad" });
    expect(report.strengths.join(" ")).not.toContain("bound to a real carrier");
  });

  it("clears both complaints once the handoff is really executed", () => {
    const repaired = film(`export function buildTimeline(context) {
      const { root, timeline: t } = context;
      const carrier = root.querySelector('[data-edit="app-carrier"]');
      const scene01 = root.querySelector('#scene-01');
      const scene02 = root.querySelector('#scene-02');
      t.set(scene01, { autoAlpha: 1 }, 0);
      morph(t, carrier, { width: 1500, height: 820 }, { at: 4.6, duration: 0.8, ease: EASE.material });
      matchCut(t, scene01, scene02, { at: 5.0, duration: 0.6 });
      cutTheCurve(t, { outgoing: scene01, incoming: scene02, at: 9.6, duration: 0.8 });
      t.to(scene01, { xPercent: -120, duration: 0.8, ease: EASE.depart }, 4.6);
    }`);
    const report = analyzeMotionQuality(repaired, { prompt: "a saas ad" });
    expect(report.blockingIssues.join(" ")).not.toContain(
      "scene layers overlap",
    );
    expect(report.blockingIssues.join(" ")).not.toContain(
      "the timeline executes none",
    );
  });

  /**
   * The other half of the same defect, seen in an exported film: the incoming
   * beat fades up on opacity alone while the outgoing one fades down, so the old
   * card stack ghosts through the new headline for the length of the crossover.
   * This is the cross-dissolve AGENTS.md bans.
   */
  it("blocks a plain cross-dissolve between two beats", () => {
    const dissolve =
      film(`export function buildTimeline({ root, timeline: t }) {
      const a = root.querySelector('[data-edit="scene-01"]');
      const b = root.querySelector('[data-edit="scene-02"]');
      t.set(a, { autoAlpha: 1 }, 0);
      t.to(a, { autoAlpha: 0, duration: 0.6 }, 4.6);
      t.to(b, { autoAlpha: 1, duration: 0.6 }, 4.6);
    }`);
    const report = analyzeMotionQuality(dissolve, { prompt: "a saas ad" });
    expect(report.blockingIssues.join(" ")).toContain(
      "ghosts through the new one",
    );
  });

  it("leaves a boundary alone when both sides actually animate", () => {
    // A reveal that tweens in is a technique, not the static stack; only an
    // instant `set` to full opacity mid-fade is the defect.
    const crossfade = film(`export function buildTimeline(context) {
      const { root, timeline: t } = context;
      const carrier = root.querySelector('[data-edit="app-carrier"]');
      const scene01 = root.querySelector('#scene-01');
      const scene02 = root.querySelector('#scene-02');
      morph(t, carrier, { width: 900 }, { at: 4.6, duration: 0.8, ease: EASE.material });
      matchCut(t, scene01, scene02, { at: 4.6, duration: 0.6 });
      zoomThrough(t, { outgoing: scene01, incoming: scene02, at: 9.6, duration: 0.7 });
      t.to(scene01, { autoAlpha: 0, duration: 0.4 }, 4.6);
      t.fromTo(scene02, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: EASE.arrive }, 4.6);
    }`);
    expect(
      analyzeMotionQuality(crossfade, {
        prompt: "a saas ad",
      }).blockingIssues.join(" "),
    ).not.toContain("scene layers overlap");
  });
});

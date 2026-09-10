import { describe, expect, it } from "vitest";
import { analyzeSeamPlan, seamsFromResult } from "../../src/ai/seam-plan";

const scenes = [
  { id: "scene-01", label: "One", start: 0, duration: 4, accent: "#fff" },
  { id: "scene-02", label: "Two", start: 4, duration: 4, accent: "#fff" },
];

const html = `<template><main data-edit="stage"><div data-edit="story-carrier" data-transition-carrier></div><div data-edit="one" data-scene="scene-01"></div><div data-edit="two" data-scene="scene-02"></div></main></template>`;

const timelineJs = `export function buildTimeline({ root, timeline }) {
  const carrier = root.querySelector('[data-edit="story-carrier"]');
  morph(timeline, carrier, { width: 900 }, { at: 3.5, duration: 1 });
}`;

/** A seam that straddles the cut at 4s and names an element that exists. */
const sound = {
  from: "scene-01",
  to: "scene-02",
  at: 3.5,
  duration: 1,
  carrier: "story-carrier",
  mechanism: "morph" as const,
  becomes: "the hook plate stretches into the product shell",
};

function analyze(seam: Partial<typeof sound>) {
  return analyzeSeamPlan({
    seams: [{ ...sound, ...seam }],
    scenes,
    html,
    timelineJs,
    duration: 8,
  });
}

describe("seam plan", () => {
  it("accepts a seam that straddles its cut on a real carrier", () => {
    const report = analyze({});
    expect(report.issues).toEqual([]);
    expect(report.planned).toBe(true);
    expect(report.strengths).toContain(
      "the seam plan budgets every scene boundary against a real carrier",
    );
  });

  it("blocks a carrier no element declares", () => {
    const report = analyze({ carrier: "imaginary-carrier" });
    expect(report.blocking).toHaveLength(1);
    expect(report.blocking[0]).toMatch(/no element declares/);
  });

  it("reports a carrier the timeline never names", () => {
    const report = analyzeSeamPlan({
      seams: [sound],
      scenes,
      html,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        timeline.to(root.querySelector('.something-else'), { x: 10 }, 3.5);
      }`,
      duration: 8,
    });
    expect(report.blocking).toEqual([]);
    expect(report.issues[0]).toMatch(/timeline\.js never names it/);
  });

  it("reports a handoff given no time to happen in", () => {
    const report = analyze({ at: 3.95, duration: 0.1 });
    expect(report.issues.some((issue) => /needs 0\.35-1\.8s/.test(issue))).toBe(
      true,
    );
  });

  /**
   * The failure the whole seam contract exists to catch: the handoff scheduled
   * at the cut rather than across it, so no frame holds both beats.
   */
  it("reports a seam that starts at the cut instead of straddling it", () => {
    const report = analyze({ at: 4, duration: 1 });
    expect(
      report.issues.some((issue) =>
        /does not straddle the cut at 4\.0s/.test(issue),
      ),
    ).toBe(true);
  });

  it("reports a seam that finishes before its cut", () => {
    const report = analyze({ at: 2.5, duration: 0.8 });
    expect(
      report.issues.some((issue) => /does not straddle the cut/.test(issue)),
    ).toBe(true);
  });

  it("asks for seams when a multi-beat film declares none", () => {
    const report = analyzeSeamPlan({
      seams: [],
      scenes,
      html,
      timelineJs,
      duration: 8,
    });
    expect(report.planned).toBe(false);
    expect(report.issues[0]).toMatch(/declares no seams/);
  });

  it("leaves a single-beat film alone", () => {
    const report = analyzeSeamPlan({
      seams: [],
      scenes: [scenes[0]!],
      html,
      timelineJs,
      duration: 4,
    });
    expect(report.issues).toEqual([]);
    expect(report.planned).toBe(false);
  });

  it("reports a chain that swaps carriers at every boundary", () => {
    const threeScenes = [
      ...scenes,
      { id: "scene-03", label: "Three", start: 8, duration: 4, accent: "#fff" },
      { id: "scene-04", label: "Four", start: 12, duration: 4, accent: "#fff" },
    ];
    const report = analyzeSeamPlan({
      seams: [
        { ...sound, carrier: "one" },
        { ...sound, from: "scene-02", to: "scene-03", at: 7.5, carrier: "two" },
        {
          ...sound,
          from: "scene-03",
          to: "scene-04",
          at: 11.5,
          carrier: "stage",
        },
      ],
      scenes: threeScenes,
      html,
      timelineJs: `${timelineJs}\n// one two stage`,
      duration: 16,
    });
    expect(
      report.issues.some((issue) => /no material persists/.test(issue)),
    ).toBe(true);
  });
});

describe("seam parsing", () => {
  it("drops entries that could not be rendered or repaired", () => {
    const seams = seamsFromResult([
      sound,
      { ...sound, at: "soon" },
      { ...sound, duration: 0 },
      { ...sound, carrier: "  " },
      { ...sound, mechanism: "cross-dissolve" },
      null,
    ]);
    expect(seams).toEqual([sound]);
  });

  it("orders seams by the moment they happen", () => {
    const seams = seamsFromResult([
      { ...sound, at: 9 },
      { ...sound, at: 3.5 },
    ]);
    expect(seams.map((seam) => seam.at)).toEqual([3.5, 9]);
  });

  it("treats a missing seam list as no plan rather than an error", () => {
    expect(seamsFromResult(undefined)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { repairGeneratedMarkup } from "../../src/ai/auto-repair";
import { analyzeMotionQuality } from "../../src/ai/generation-guidance";
import { createDynamicComposition } from "../../src/composition/dynamic-compiler";
import { CompositionRuntime } from "../../src/composition/runtime";

function composition(html: string) {
  return {
    duration: 8,
    compositionHtml: html,
    timelineJs: `export function buildTimeline({ timeline }) {
      timeline.set(headline, { autoAlpha: 0 }, 0);
      timeline.to(headline, { y: 0, autoAlpha: 1, duration: 1 }, 0.4);
    }`,
    reply: "Done",
  };
}

describe("deterministic markup repair", () => {
  it("mounts sibling CSS in cascade order instead of dropping the film's styling", () => {
    const original = {
      ...composition(`<style>.css-repair-subject { color: red; }</style>
        <template><style>.css-repair-subject { color: green; }</style>
        <main data-edit="stage"><h1 class="css-repair-subject" data-edit="headline">Ship it</h1></main></template>
        <style>.css-repair-subject { color: blue; font-size: 68px; }</style>`),
      timelineJs: "export function buildTimeline() {}",
    };
    const { result, applied } = repairGeneratedMarkup(original);
    expect(applied).toContain(
      "moved authored styles inside the mounted template",
    );
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(
      createDynamicComposition(result.compositionHtml, result.timelineJs),
      root,
    );
    try {
      const headline = root.querySelector("h1");
      if (!headline) throw new Error("Headline was not mounted");
      expect(getComputedStyle(headline).color).toBe("rgb(0, 0, 255)");
      expect(getComputedStyle(headline).fontSize).toBe("68px");
      // The film's own three stylesheets; the runtime's scene kit mounts beside them.
      expect(
        root.querySelectorAll("style:not([data-motionly-kit])"),
      ).toHaveLength(3);
      expect(repairGeneratedMarkup(result).applied).toEqual([]);
    } finally {
      runtime.destroy();
      root.remove();
    }
  });

  it("marks a declared carrier role rather than the outer stage", () => {
    const { result, applied } = repairGeneratedMarkup(
      composition(
        `<template><main data-edit="stage"><section data-edit="story-surface"><h1 data-edit="headline">Ship it</h1></section></main></template>`,
      ),
    );
    expect(applied).toContain("marked the persistent transition carrier");
    expect(result.compositionHtml).toContain(
      `<section data-transition-carrier data-edit="story-surface">`,
    );
  });

  it("prefers the camera world when no carrier role is authored", () => {
    const { result } = repairGeneratedMarkup(
      composition(
        `<template><main data-edit="root"><div data-edit="depth" data-camera-world><h1 data-edit="headline">Ship it</h1></div></main></template>`,
      ),
    );
    expect(result.compositionHtml).toContain(
      `<div data-transition-carrier data-edit="depth" data-camera-world>`,
    );
  });

  it("restores the generation foundation marker on the mounted root", () => {
    const { result, applied } = repairGeneratedMarkup(
      composition(
        `<template><main class="stage" data-edit="stage"><h1 data-edit="headline">Ship it</h1></main></template>`,
      ),
    );
    expect(applied).toContain("restored the generation foundation marker");
    expect(result.compositionHtml).toContain(
      `<main data-motionly-generation-profile="claude-foundation-v1"`,
    );
  });

  it("clears both markup complaints the quality gate would otherwise raise", () => {
    const raw = composition(
      `<template><main data-edit="stage"><section data-edit="surface"><h1 data-edit="headline">Ship it</h1></section></main></template>`,
    );
    const before = analyzeMotionQuality(raw).issues.join(" ");
    expect(before).toContain("no persistent transition carrier");
    expect(before).toContain("generation foundation marker");

    const after = analyzeMotionQuality(
      repairGeneratedMarkup(raw).result,
    ).issues.join(" ");
    expect(after).not.toContain("no persistent transition carrier");
    expect(after).not.toContain("generation foundation marker");
  });

  it("leaves a composition that already satisfies both markers untouched", () => {
    const compliant = composition(
      `<template><main data-edit="stage" data-motionly-generation-profile="claude-foundation-v1"><section data-edit="surface" data-transition-carrier><h1 data-edit="headline">Ship it</h1></section></main></template>`,
    );
    const { result, applied } = repairGeneratedMarkup(compliant);
    expect(applied).toEqual([]);
    expect(result).toBe(compliant);
  });

  it("does not confuse an attribute value for a real marker", () => {
    const { applied } = repairGeneratedMarkup(
      composition(
        `<template><main data-edit="stage" data-note="data-transition-carrier-pending"><h1 data-edit="headline">Ship it</h1></main></template>`,
      ),
    );
    expect(applied).toContain("marked the persistent transition carrier");
  });
});

describe("infinite loops are bounded before they reach the runtime", () => {
  it("converts repeat: -1 into a single pass and reports it", () => {
    const { result, applied } = repairGeneratedMarkup({
      compositionHtml: `<template><main data-edit="stage" data-transition-carrier data-motionly-generation-profile="claude-foundation-v1"></main></template>`,
      timelineJs: [
        "export function buildTimeline({ root, timeline }) {",
        "  timeline.to('.glow', { rotation: 360, duration: 8, repeat: -1, ease: 'none' }, 0);",
        "  timeline.to('.aurora', { x: 40, duration: 3, repeat:-1, yoyo: true }, 0);",
        "}",
      ].join("\n"),
      reply: "",
    });
    expect(result.timelineJs).not.toMatch(/repeat\s*:\s*-\s*1/);
    expect(result.timelineJs).toContain("repeat: 0");
    expect(applied.join(" ")).toContain("infinite ambient loop");
    // The tweens themselves survive; only their unboundedness is removed.
    expect(result.timelineJs).toContain("rotation: 360");
    expect(result.timelineJs).toContain("yoyo: true");
  });

  it("leaves a finite timeline untouched", () => {
    const timelineJs =
      "export function buildTimeline({ timeline }) { timeline.to('.a', { x: 1, duration: 1, repeat: 2 }, 0); }";
    const { result, applied } = repairGeneratedMarkup({
      compositionHtml: `<template><main data-edit="stage" data-transition-carrier data-motionly-generation-profile="claude-foundation-v1"></main></template>`,
      timelineJs,
      reply: "",
    });
    expect(result.timelineJs).toBe(timelineJs);
    expect(applied).toHaveLength(0);
  });
});

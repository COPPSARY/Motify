import { describe, expect, it } from "vitest";
import { repairGeneratedMarkup } from "../../src/ai/auto-repair";
import { analyzeMotionQuality } from "../../src/ai/generation-guidance";

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

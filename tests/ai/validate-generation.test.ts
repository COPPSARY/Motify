import { describe, expect, it } from "vitest";
import { validateGeneratedComposition } from "../../src/ai/validate-generation";

const scenes = [
  { id: "main", label: "Main", start: 0, duration: 2, accent: "#fff" },
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
});

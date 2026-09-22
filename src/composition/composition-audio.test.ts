import { describe, expect, it } from "vitest";

import {
  audioTrackIdsIn,
  removeAudioTrackFromComposition,
} from "./composition-audio";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";

const html = `<template><style>.title{color:white}</style><audio data-motify-audio src="motify-audio://${first}" data-start="0"></audio><audio data-motify-audio src="motify-audio://${second}"></audio><main class="title" data-edit="title">Launch</main></template>`;

describe("composition audio", () => {
  it("lists the tracks a composition plays", () => {
    expect(audioTrackIdsIn(html)).toEqual([first, second]);
    expect(audioTrackIdsIn("<template></template>")).toEqual([]);
  });

  it("removes only the audio element for the given track", () => {
    const result = removeAudioTrackFromComposition(html, first);

    expect(result).not.toContain(first);
    expect(result).toContain(`motify-audio://${second}`);
    expect(result).toContain('data-edit="title"');
    expect(result).toContain(".title{color:white}");
  });

  it("returns the source untouched when the track is not used", () => {
    expect(
      removeAudioTrackFromComposition(
        html,
        "33333333-3333-4333-8333-333333333333",
      ),
    ).toBe(html);
  });

  it("does not remove other elements that mention the token", () => {
    const source = `<template><div data-note="motify-audio://${first}"></div></template>`;

    expect(removeAudioTrackFromComposition(source, first)).toBe(source);
  });
});

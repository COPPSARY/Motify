import { describe, expect, it } from "vitest";
import { carryEditorState } from "./editor-state-carry";

const film = (title: string, titleCss = "font-size: 80px;", badge = "NEW") => `
<template>
  <style>
    .title { ${titleCss} }
    .badge { color: red; }
  </style>
  <main data-edit="stage">
    <h1 class="title" data-edit="title">${title}</h1>
    <span class="badge" data-edit="badge">${badge}</span>
  </main>
</template>`;

const timeline = `export function buildTimeline({ timeline, root }) {
  timeline.from(root.querySelector(".title"), { y: 40, duration: 0.6 }, 0);
  timeline.from(root.querySelector(".badge"), { opacity: 0 }, 0.4);
}`;

const handEdits = {
  elements: {
    title: { text: "Old hand-typed title", fontSize: 60 },
    badge: { color: "#00ff00" },
  },
  animations: { title: { speed: 2, ease: "power2.out" } },
  tweens: { "title:tween0": { duration: 1.2 }, "badge:tween0": { start: 0.5 } },
};

describe("carryEditorState", () => {
  it("drops hand edits on a layer whose text the AI changed", () => {
    const carried = carryEditorState(
      handEdits,
      { html: film("Hello"), timelineJs: timeline },
      { html: film("RECOVERY TEST 42"), timelineJs: timeline },
    );
    expect(carried?.elements).toEqual({ badge: { color: "#00ff00" } });
    expect(carried?.animations).toEqual({});
    expect(carried?.tweens).toEqual({ "badge:tween0": { start: 0.5 } });
  });

  it("drops hand edits when only the stylesheet rule reaching the layer changed", () => {
    const carried = carryEditorState(
      handEdits,
      { html: film("Hello"), timelineJs: timeline },
      { html: film("Hello", "font-size: 140px;"), timelineJs: timeline },
    );
    expect(Object.keys(carried?.elements ?? {})).toEqual(["badge"]);
  });

  it("drops hand edits when the timeline lines naming the layer changed", () => {
    const carried = carryEditorState(
      handEdits,
      { html: film("Hello"), timelineJs: timeline },
      {
        html: film("Hello"),
        timelineJs: timeline.replace(
          "opacity: 0 }",
          "opacity: 0, scale: 0.5 }",
        ),
      },
    );
    expect(Object.keys(carried?.elements ?? {})).toEqual(["title"]);
    expect(carried?.tweens).toEqual({ "title:tween0": { duration: 1.2 } });
  });

  it("keeps every hand edit when the AI left the layers alone", () => {
    const carried = carryEditorState(
      handEdits,
      { html: film("Hello"), timelineJs: timeline },
      { html: film("Hello"), timelineJs: timeline },
    );
    expect(carried).toEqual(handEdits);
  });

  it("drops hand edits for layers the AI removed", () => {
    const carried = carryEditorState(
      handEdits,
      { html: film("Hello"), timelineJs: timeline },
      {
        html: film("Hello").replace(/<span[^>]*>NEW<\/span>/, ""),
        timelineJs: timeline,
      },
    );
    expect(Object.keys(carried?.elements ?? {})).toEqual(["title"]);
  });

  it("passes through a missing editor state", () => {
    expect(
      carryEditorState(
        undefined,
        { html: "", timelineJs: "" },
        { html: "", timelineJs: "" },
      ),
    ).toBeUndefined();
  });
});

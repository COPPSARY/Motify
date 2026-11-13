import { gsap } from "gsap";
import { describe, expect, it } from "vitest";

import {
  addClip,
  appendClip,
  emptyEdit,
  trimSegment,
  type FootageEdit,
} from "../footage/edit";
import { footageFiles } from "../footage/render";
import { footageTimeline } from "./footage-runtime";
import type { CompositionContext } from "./types";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** One talking shot whose caption "hello world" is said at 0.5-1.2 and 1.2-2 on the video's clock. */
function talking(captions: Partial<FootageEdit["captions"]>): FootageEdit {
  let edit = emptyEdit("9:16");
  edit = addClip(edit, {
    assetId: A,
    name: "talk.mp4",
    duration: 10,
    width: 1080,
    height: 1920,
    hasAudio: true,
  });
  edit = appendClip(edit, A);
  edit = trimSegment(edit, edit.segments[0]!.id, { in: 2, out: 6 });
  return {
    ...edit,
    captions: {
      ...edit.captions,
      ...captions,
      cues: [
        {
          id: "c1",
          assetId: A,
          start: 2.5,
          end: 4,
          text: "hello world",
          words: [
            { text: "hello", start: 2.5, end: 3.2 },
            { text: "world", start: 3.2, end: 4 },
          ],
        },
      ],
    },
  };
}

function mount(edit: FootageEdit) {
  const root = document.createElement("div");
  const html = footageFiles(edit).files["composition.html"] as string;
  // The film's markup ships in a <template>; the player mounts its content.
  const holder = document.createElement("div");
  holder.innerHTML = html;
  root.append(holder.querySelector("template")!.content.cloneNode(true));
  document.body.append(root);
  const timeline = gsap.timeline({ paused: true });
  footageTimeline(
    {
      root,
      element: root,
      container: root,
      timeline,
      width: 1080,
      height: 1920,
    } as unknown as CompositionContext,
    edit,
  );
  const words = () =>
    Array.from(
      root.querySelectorAll<HTMLElement>(
        "#fx-cue-0 .fx-line .motionly-split-item",
      ),
    );
  return { root, timeline, words };
}

describe("footage captions on the timeline", () => {
  it("lights the word being said in karaoke, wherever the timeline is sought", () => {
    const { timeline, words } = mount(talking({ animation: "karaoke" }));
    expect(words().map((word) => word.textContent)).toEqual(["hello", "world"]);
    timeline.seek(0.8);
    expect(words().map((word) => word.getAttribute("data-on"))).toEqual([
      "1",
      null,
    ]);
    timeline.seek(1.5);
    expect(words().map((word) => word.getAttribute("data-on"))).toEqual([
      "0",
      "1",
    ]);
    // Back again: export seeks frames in any order.
    timeline.seek(0.8);
    expect(words().map((word) => word.getAttribute("data-on"))).toEqual([
      "1",
      "0",
    ]);
  });

  it("brings each word in as it is said, word by word", () => {
    const { timeline, words } = mount(talking({ animation: "words" }));
    timeline.seek(0.9);
    expect(words().map((word) => word.style.visibility)).toEqual([
      "inherit",
      "hidden",
    ]);
    timeline.seek(1.9);
    expect(words().map((word) => word.style.opacity)).toEqual(["1", "1"]);
  });

  it("leaves a plain caption as one line, sized by the edit", () => {
    const { root } = mount(talking({ size: 1.5 }));
    expect(
      root.querySelectorAll("#fx-cue-0 .motionly-split-item"),
    ).toHaveLength(0);
    expect(
      root.querySelector<HTMLElement>(".fx-captions")!.getAttribute("style"),
    ).toContain("--fx-caption-size:1.5");
  });
});

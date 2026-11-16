import { gsap } from "gsap";
import { afterEach, describe, expect, it } from "vitest";

import {
  addClip,
  appendClip,
  bubbleBox,
  chartGeometry,
  chartRises,
  cutawayFrame,
  drawnCard,
  emptyEdit,
  markTime,
  placementBoxes,
  placementOf,
  trimSegment,
  type FootageCutaway,
  type FootageEdit,
} from "../footage/edit";
import { footageFiles, pointRows } from "../footage/render";
import { chartTiming, footageTimeline } from "./footage-runtime";
import type { CompositionContext } from "./types";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** A talking shot (2-8 s of its clip) with a studio chart over its talk from 0.5 s for 4 s. */
function studio(overrides: Partial<FootageCutaway> = {}): FootageEdit {
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
  edit = trimSegment(edit, edit.segments[0]!.id, { in: 2, out: 8 });
  return {
    ...edit,
    direction: { idea: "", motion: "some", style: "studio" },
    captions: {
      ...edit.captions,
      cues: [
        {
          id: "c1",
          assetId: A,
          start: 2.5,
          end: 5,
          text: "why your marketing isn't working",
          words: [
            { text: "why", start: 2.5, end: 2.7 },
            { text: "your", start: 2.7, end: 2.9 },
            { text: "marketing", start: 2.9, end: 3.5 },
            { text: "isn't", start: 3.6, end: 3.9 },
            { text: "working", start: 3.9, end: 4.4 },
          ],
        },
      ],
    },
    cutaways: [
      {
        id: "k1",
        over: A,
        from: 2.5,
        duration: 4,
        kind: "card",
        assetId: "",
        in: 0,
        speaker: { ...bubbleBox("9:16"), front: true },
        card: {
          template: "chart",
          theme: "studio",
          title: "Why your marketing isn't working",
          mark: "isn't working",
          points: [80, 62, 66, 30],
          notes: [{ at: 0, text: "A year ago" }],
        },
        ...overrides,
      },
    ],
    titles: [
      {
        id: "p1",
        text: "Why it changed",
        start: 4.6,
        duration: 1.4,
        style: "point",
        position: "top",
      },
      {
        id: "p2",
        text: "Actionable tips",
        start: 5.2,
        duration: 0.8,
        style: "point",
        position: "top",
      },
    ],
  };
}

// Each film is its own document in the player; here they share one, so each test clears it.
afterEach(() => document.body.replaceChildren());

function mount(edit: FootageEdit) {
  const root = document.createElement("div");
  const holder = document.createElement("div");
  holder.innerHTML = footageFiles(edit).files["composition.html"] as string;
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
  // As the player seeks (composition/runtime.ts): callbacks fire, and a jump back replays from 0.
  const seek = (time: number) => {
    if (time < timeline.totalTime()) timeline.totalTime(0, false);
    timeline.totalTime(time, false);
  };
  return { root, timeline: { seek } };
}

describe("studio graphics in the edit", () => {
  it("puts the speaker in a round, square bubble that names itself", () => {
    const box = bubbleBox("16:9", "bottom-left", "medium");
    expect(box.w * 1920).toBeCloseTo(box.h * 1080, 0);
    expect(box.radius).toBe(0.5);
    const cut = {
      ...placementBoxes("16:9", {
        name: "speaker-bubble",
        corner: "bottom-left",
        size: "medium",
      }),
    };
    expect(placementOf("16:9", cut)).toEqual({
      name: "speaker-bubble",
      corner: "bottom-left",
      size: "medium",
    });
  });

  it("lets a card keep the speaker in front of it, but never a box of its own", () => {
    const speaker = { ...bubbleBox("9:16"), front: true };
    expect(cutawayFrame({ kind: "card", speaker })).toEqual({
      top: false,
      speaker,
    });
    expect(cutawayFrame({ kind: "card", box: bubbleBox("9:16") })).toEqual({
      top: false,
    });
  });

  it("lays a chart's points across its area, left to right, highest at the top", () => {
    const { area, points, path } = chartGeometry("9:16", [10, 40, 20]);
    expect(points.map((point) => point.x)).toEqual(
      [...points.map((point) => point.x)].sort((a, b) => a - b),
    );
    expect(points[0]!.x).toBeCloseTo(area.x, 0);
    expect(points[2]!.x).toBeCloseTo(area.x + area.w, 0);
    expect(points[1]!.y).toBeLessThan(points[2]!.y);
    expect(points[2]!.y).toBeLessThan(points[0]!.y);
    expect(path.startsWith(`M${points[0]!.x} ${points[0]!.y} C`)).toBe(true);
    // A flat line sits in the middle rather than dividing by nothing.
    expect(
      chartGeometry("1:1", [5, 5]).points.every((point) =>
        Number.isFinite(point.y),
      ),
    ).toBe(true);
  });

  it("knows a chart that climbs to its top, and which cards it draws itself", () => {
    expect(chartRises([10, 30, 20, 50])).toBe(true);
    expect(chartRises([10, 60, 50])).toBe(false);
    expect(chartRises([50, 10])).toBe(false);
    expect(drawnCard({ template: "chart", theme: "paper" })).toBe(true);
    // A studio statement is made by Motify's generator; only charts are drawn.
    expect(drawnCard({ template: "statement", theme: "studio" })).toBe(false);
    expect(drawnCard({ template: "statement", theme: "dark" })).toBe(false);
  });

  it("finds when a highlight's words are said", () => {
    const words = [
      { text: "it", start: 1, end: 1.2 },
      { text: "isn't", start: 1.3, end: 1.6 },
      { text: "working,", start: 1.6, end: 2 },
    ];
    expect(markTime(words, "Isn't working", 0, 5)).toEqual({
      start: 1.3,
      end: 2,
    });
    expect(markTime(words, "isn't working", 3, 5)).toBeNull();
    expect(markTime(words, "growing", 0, 5)).toBeNull();
  });
});

describe("studio graphics in the film", () => {
  it("writes a chart, its notes, the highlight and the checklist rows", () => {
    const html = footageFiles(studio()).files["composition.html"] as string;
    expect(html).toContain('class="fx-k-chart"');
    expect(html).toMatch(/<path class="fx-k-line" d="M[\d.]+ [\d.]+ C/);
    expect(html).toContain('<div class="fx-k-note" data-at="0"');
    expect(html).toContain(
      `<span class="fx-k-mark" style="background-size:0% 100%"><span class="fx-k-w">isn't</span>`,
    );
    expect(html).toContain('style="--fx-row:1"');
    // The speaker stands in front of the card, so the card goes under the shots.
    expect(html.indexOf('id="fx-cut-0"')).toBeLessThan(
      html.indexOf('class="fx-shots"'),
    );
  });

  it("stacks points that are on screen together, and reuses a row once it is free", () => {
    const point = (id: string, start: number, duration: number) => ({
      id,
      text: id,
      start,
      duration,
      style: "point" as const,
      position: "top" as const,
    });
    const rows = pointRows({
      titles: [
        point("a", 0, 5),
        point("b", 1, 4),
        point("c", 6, 2),
        point("d", 6.5, 1),
      ],
    });
    expect([...rows.entries()]).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0],
      ["d", 1],
    ]);
  });

  it("brings the title in, sweeps the highlight as it is said, and draws the line", () => {
    const { root, timeline } = mount(studio());
    // The card covers 0.5-4.5 on the film's clock; "isn't working" is said at 1.6-2.4.
    const words = Array.from(
      root.querySelectorAll<HTMLElement>("#fx-cut-0 .fx-k-w"),
    );
    const mark = root.querySelector<HTMLElement>("#fx-cut-0 .fx-k-mark")!;
    const line = root.querySelector<SVGPathElement>("#fx-cut-0 .fx-k-line")!;
    const pill = root.querySelector<HTMLElement>(
      "#fx-cut-0 .fx-k-note > span",
    )!;

    timeline.seek(0.55);
    expect(Number(words[words.length - 1]!.style.opacity || 1)).toBeLessThan(1);
    expect(line.style.opacity).toBe("0");

    timeline.seek(1.55);
    expect(words.every((word) => word.style.opacity === "1")).toBe(true);
    // Not swept yet: the stylesheet's 0% holds until the words are said.
    expect(mark.style.backgroundSize).not.toMatch(/^100%/);

    const { drawStart } = chartTiming(0.5, 4.5);
    timeline.seek(drawStart + 0.5);
    expect(line.style.opacity).toBe("1");
    expect(pill.style.visibility).toBe("inherit");

    timeline.seek(3);
    expect(mark.style.backgroundSize).toMatch(/^100%/);
    // Back again: nothing drawn, nothing highlighted.
    timeline.seek(0.2);
    expect(mark.style.backgroundSize).toMatch(/^0%/);
  });

  it("ticks each checklist point in and sweeps its words on", () => {
    const { root, timeline } = mount(studio());
    const icon = root.querySelector<HTMLElement>(
      "#fx-title-p1 .fx-title-icon",
    )!;
    const text = root.querySelector<HTMLElement>(
      "#fx-title-p1 .fx-title-text",
    )!;
    timeline.seek(4.6);
    expect(icon.style.transform).toContain("scale(0");
    timeline.seek(5.3);
    expect(icon.style.transform).not.toContain("scale(0");
    expect(text.style.clipPath).toContain("-2%");
  });
});

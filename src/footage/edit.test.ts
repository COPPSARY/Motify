import { describe, expect, it } from "vitest";
import {
  addCard,
  addCutaway,
  addPicture,
  updateCard,
  updateCutaway,
  placeCutaways,
  removeFillers,
  appendClip,
  addClip,
  editDuration,
  emptyEdit,
  moveSegment,
  placeCues,
  captionSize,
  captionKeywords,
  stackBreaks,
  cueWordTimes,
  placeSegments,
  placeSounds,
  removeSegment,
  removeSilences,
  splitAt,
  trimSegment,
  updateCue,
  updateSegment,
  trimCutawayStart,
  cleanBox,
  cutawayFrame,
  moveCutaway,
  placementBoxes,
  placementOf,
  windowBox,
  type FootageEdit,
  type FootageSegment,
} from "./edit";
import { footageFiles, isFootageTimeline, readFootageEdit } from "./render";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function twoClips(): FootageEdit {
  let edit = emptyEdit("9:16");
  edit = addClip(edit, {
    assetId: A,
    name: "talk.mp4",
    duration: 10,
    width: 1080,
    height: 1920,
    hasAudio: true,
  });
  edit = addClip(edit, {
    assetId: B,
    name: "latte.mov",
    duration: 6,
    width: 1920,
    height: 1080,
    hasAudio: true,
  });
  edit = appendClip(edit, A);
  edit = appendClip(edit, B);
  edit = trimSegment(edit, edit.segments[0]!.id, { in: 2, out: 6 });
  edit = trimSegment(edit, edit.segments[1]!.id, { in: 1, out: 4 });
  return {
    ...edit,
    captions: {
      ...edit.captions,
      cues: [
        {
          id: "c1",
          assetId: A,
          start: 2.5,
          end: 4,
          text: "កាហ្វេថ្មី",
          words: [
            { text: "កាហ្វេ", start: 2.5, end: 3.2 },
            { text: "ថ្មី", start: 3.2, end: 4 },
          ],
        },
        { id: "c2", assetId: A, start: 7, end: 8, text: "not in the cut" },
      ],
    },
  };
}

describe("footage edit", () => {
  it("places segments end to end", () => {
    const edit = twoClips();
    expect(placeSegments(edit).map(({ start, end }) => [start, end])).toEqual([
      [0, 4],
      [4, 7],
    ]);
    expect(editDuration(edit)).toBe(7);
  });

  it("keeps captions with their words through trims and moves", () => {
    let edit = twoClips();
    // Shown at source 2.5..4 of clip A, which plays from video time 0 at source 2.
    expect(
      placeCues(edit).map(({ cue, start, end }) => [cue.id, start, end]),
    ).toEqual([["c1", 0.5, 2]]);
    edit = moveSegment(edit, edit.segments[0]!.id, 1);
    // Clip A now plays second, from video time 3.
    expect(placeCues(edit)[0]).toMatchObject({
      start: 3.5,
      end: 5,
      words: [
        { start: 3.5, end: 4.2 },
        { start: 4.2, end: 5 },
      ],
    });
  });

  it("shows no captions for a muted shot", () => {
    const edit = twoClips();
    expect(
      placeCues(updateSegment(edit, edit.segments[0]!.id, { volume: 0 })),
    ).toEqual([]);
  });

  it("splits at the playhead into two segments of the same clip", () => {
    const edit = splitAt(twoClips(), 1.5);
    expect(
      edit.segments.map((segment) => [
        segment.assetId,
        segment.in,
        segment.out,
      ]),
    ).toEqual([
      [A, 2, 3.5],
      [A, 3.5, 6],
      [B, 1, 4],
    ]);
    expect(editDuration(edit)).toBe(7);
  });

  it("keeps trims inside the clip and at least a few frames long", () => {
    const edit = twoClips();
    const id = edit.segments[1]!.id;
    expect(trimSegment(edit, id, { out: 99 }).segments[1]!.out).toBe(6);
    expect(trimSegment(edit, id, { in: 3.95 }).segments[1]).toMatchObject({
      in: 3.7,
      out: 4,
    });
  });

  it("moves titles back inside a shorter video", () => {
    const edit = {
      ...twoClips(),
      titles: [
        {
          id: "t",
          text: "CTA",
          start: 6,
          duration: 1,
          style: "cta" as const,
          position: "bottom" as const,
        },
      ],
    };
    expect(removeSegment(edit, edit.segments[1]!.id).titles[0]!.start).toBe(3);
  });

  it("drops a typed-over caption's word timings", () => {
    const edit = updateCue(twoClips(), "c1", { text: "កាហ្វេ ទឹកដោះគោ" });
    expect(edit.captions.cues[0]!.words).toBeUndefined();
  });

  it("cuts long silences out of segments", () => {
    const edit = removeSilences(twoClips(), { [A]: [{ start: 3, end: 4.5 }] });
    expect(
      edit.segments
        .filter((segment) => segment.assetId === A)
        .map((segment) => [segment.in, segment.out]),
    ).toEqual([
      [2, 3.12],
      [4.38, 6],
    ]);
  });
});

/** The two clips with the first one's own sound off, as B-roll would be. */
function quietFirst(): FootageEdit {
  const edit = twoClips();
  return updateSegment(edit, edit.segments[0]!.id, { volume: 0 });
}

describe("cards", () => {
  const card = {
    template: "spotlight" as const,
    theme: "paper" as const,
    eyebrow: "ប្រើប្រាស់",
    title: "Claude",
    label: "OPUS",
    big: "5.5",
  };

  it("cuts a card in after a clip that plays no sound of its own", () => {
    const edit = addCard(quietFirst(), 1, card, 2);
    expect(
      edit.segments.map((segment) => (segment.card ? "card" : segment.assetId)),
    ).toEqual([A, "card", B]);
    expect(editDuration(edit)).toBe(9);
    expect(placeSounds(edit).map((sound) => sound.assetId)).toEqual([B]);
  });

  it("goes over the talk when the clip at the playhead is talking, so the voice never stops", () => {
    const edit = addCard(twoClips(), 1, card, 2);
    expect(edit.segments).toHaveLength(2);
    expect(edit.cutaways).toEqual([
      expect.objectContaining({
        kind: "card",
        over: A,
        from: 3,
        duration: 2,
        assetId: "",
        card,
      }),
    ]);
    expect(placeSounds(edit).map((sound) => sound.assetId)).toEqual([A, B]);
    expect(placeCues(edit).map(({ start }) => start)).toEqual([0.5]);
    // Its words change like a cut-in card's.
    const id = edit.cutaways![0]!.id;
    expect(
      updateCard(edit, id, { title: "Opus" }).cutaways![0]!.card,
    ).toMatchObject({ title: "Opus" });
  });

  it("is trimmed up to eight seconds but never split", () => {
    const edit = addCard(quietFirst(), 1, card, 2);
    const id = edit.segments[1]!.id;
    expect(trimSegment(edit, id, { out: 20 }).segments[1]!.out).toBe(8);
    expect(splitAt(edit, 5)).toBe(edit);
  });

  it("renders its words in a panel, cut in or over talk", () => {
    const words =
      '<div class="fx-k-anim fx-k-eyebrow fx-k-km">ប្រើប្រាស់</div><div class="fx-k-anim fx-k-title">Claude</div><div class="fx-k-anim fx-k-label">OPUS</div><div class="fx-k-anim fx-k-big">5.5</div>';
    const cutIn = footageFiles(addCard(quietFirst(), 1, card, 2)).files[
      "composition.html"
    ];
    expect(cutIn).toContain(
      'class="fx-shot fx-cardshot fx-k--spotlight fx-kt--paper"',
    );
    expect(cutIn).toContain(words);
    const over = footageFiles(addCard(twoClips(), 1, card, 2)).files[
      "composition.html"
    ];
    expect(over).toContain(
      'class="fx-cut-shot fx-cardshot fx-k--spotlight fx-kt--paper" id="fx-cut-0"',
    );
    expect(over).toContain(words);
    expect(over).toContain('src="motify-sfx://pop" data-start="1.1"');
  });
});

describe("pictures over talk", () => {
  const LOGO = "33333333-3333-4333-8333-333333333333";

  it("puts a picture in the top half above the speaker, at the playhead", () => {
    const edit = addPicture(twoClips(), 1, LOGO);
    expect(edit.cutaways).toEqual([
      expect.objectContaining({
        kind: "image",
        layout: "top",
        over: A,
        from: 3,
        duration: 3,
        assetId: LOGO,
      }),
    ]);
    const html = footageFiles(edit).files["composition.html"];
    expect(html).toContain(
      `<div class="fx-cut-shot fx-pic fx-cut--top" id="fx-cut-0"><img class="fx-pic-fill" src="motify-asset://${LOGO}" alt=""><img class="fx-pic-main" src="motify-asset://${LOGO}" alt=""></div>`,
    );
  });

  it("covers the whole frame in a wide video, or when set to full", () => {
    const wide = addPicture({ ...twoClips(), format: "16:9" }, 1, LOGO);
    expect(wide.cutaways![0]!.layout).toBeUndefined();
    const split = addPicture(twoClips(), 1, LOGO);
    const full = updateCutaway(split, split.cutaways![0]!.id, {
      layout: undefined,
    });
    expect(footageFiles(full).files["composition.html"]).toContain(
      '<div class="fx-cut-shot fx-pic" id="fx-cut-0">',
    );
  });

  it("frames B-roll in the top half in its own holder", () => {
    const edit = addCutaway(twoClips(), 1, B, 0.5, 2, { layout: "top" });
    expect(footageFiles(edit).files["composition.html"]).toContain(
      '<div class="fx-cut-shot fx-cut--top" id="fx-cut-0"><video data-motify-video',
    );
  });

  it("goes to the nearest clip when the playhead is on a card", () => {
    const withCard = addCard(
      quietFirst(),
      0,
      { template: "statement", theme: "dark", title: "Hi" },
      2,
    );
    const edit = addPicture(withCard, 0.5, LOGO);
    expect(edit.cutaways).toHaveLength(1);
    expect(placeCutaways(edit)[0]!.start).toBeCloseTo(2);
  });
});

describe("voice-over", () => {
  it("plays each line and shows it as captions instead of the clips' words", () => {
    const edit: FootageEdit = {
      ...twoClips(),
      voiceover: {
        voice: "Maly",
        volume: 1,
        lines: [
          {
            id: "v1",
            trackId: "44444444-4444-4444-8444-444444444444",
            text: "Fresh coffee every morning, made the way you like it.",
            start: 0.2,
            duration: 3,
          },
        ],
      },
    };
    const cues = placeCues(edit);
    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0]!.start).toBe(0.2);
    expect(cues[cues.length - 1]!.end).toBeCloseTo(3.2);
    expect(cues.map((cue) => cue.cue.text).join(" ")).toBe(
      "Fresh coffee every morning, made the way you like it.",
    );
    expect(footageFiles(edit).files["composition.html"]).toContain(
      '<audio data-motify-audio src="motify-audio://44444444-4444-4444-8444-444444444444" data-start="0.2" data-duration="3" data-volume="1"></audio>',
    );
  });
});

describe("B-roll over talk", () => {
  it("covers the picture while the talk keeps its sound and captions", () => {
    const edit = addCutaway(twoClips(), 1, B, 0.5, 2);
    expect(edit.cutaways).toEqual([
      {
        id: expect.any(String),
        over: A,
        from: 3,
        duration: 2,
        assetId: B,
        in: 0.5,
      },
    ]);
    expect(placeCutaways(edit)).toEqual([
      { cutaway: edit.cutaways![0], start: 1, end: 3, trim: 0.5 },
    ]);
    // Nothing about the talk changes: same segments, same sound, same captions.
    expect(edit.segments).toEqual(
      twoClips().segments.map((segment) =>
        expect.objectContaining({
          assetId: segment.assetId,
          in: segment.in,
          out: segment.out,
        }),
      ),
    );
    expect(placeSounds(edit).map((sound) => sound.assetId)).toEqual([A, B]);
    expect(placeCues(edit)).toHaveLength(1);
    const html = footageFiles(edit).files["composition.html"];
    expect(html).toContain(
      `<video class="fx-cutaway" id="fx-cut-0" data-motify-video src="motify-footage://${B}/video.mp4" data-start="1" data-trim="0.5" data-end="3"`,
    );
  });

  it("stays on its words when the talk is trimmed, split or moved", () => {
    let edit = addCutaway(twoClips(), 1, B, 0, 2);
    // Trimming 1 s off the talk's start moves it 1 s earlier on the video's clock.
    expect(
      placeCutaways(trimSegment(edit, edit.segments[0]!.id, { in: 3 }))[0],
    ).toMatchObject({ start: 0, end: 2 });
    // Splitting through it shows it across both pieces, unbroken.
    const split = splitAt(edit, 2);
    expect(placeCutaways(split).map(({ start, end }) => [start, end])).toEqual([
      [1, 3],
    ]);
    // Moving the talk to the end takes it along.
    edit = moveSegment(edit, edit.segments[0]!.id, 1);
    expect(placeCutaways(edit)[0]).toMatchObject({ start: 4, end: 6 });
  });

  it("runs on past the end of its scene, up to a card or the video's end", () => {
    // The talk is 0-4 s and the next clip 4-7 s; an overlay from 1 s runs 5 s.
    const edit = addCutaway(twoClips(), 1, B, 0, 5, { kind: "image" });
    expect(edit.cutaways![0]!.duration).toBe(5);
    expect(placeCutaways(edit)[0]).toMatchObject({ start: 1, end: 6 });
    // Asked for longer than the video, it stops at the end.
    const long = updateCutaway(edit, edit.cutaways![0]!.id, { duration: 20 });
    expect(placeCutaways(long)[0]).toMatchObject({ start: 1, end: 7 });
    // A card cut in after the talk fills the frame, so the overlay stops there.
    const card: FootageSegment = {
      id: "card",
      assetId: "",
      in: 0,
      out: 2,
      volume: 0,
      transition: "cut",
      audioLead: 0,
      audioTail: 0,
      zoom: 1,
      card: { template: "statement", theme: "dark", title: "Hi" },
    };
    const withCard = {
      ...edit,
      segments: [edit.segments[0]!, card, edit.segments[1]!],
    };
    expect(placeCutaways(withCard)[0]).toMatchObject({ start: 1, end: 4 });
  });

  it("can have its start pulled earlier or later while its end stays", () => {
    const edit = addCutaway(twoClips(), 2, B, 1, 3);
    const id = edit.cutaways![0]!.id;
    expect(placeCutaways(edit)[0]).toMatchObject({ start: 2, end: 5, trim: 1 });
    // Earlier shows more of the clip from before.
    const earlier = trimCutawayStart(edit, id, 1.5);
    expect(placeCutaways(earlier)[0]).toMatchObject({
      start: 1.5,
      end: 5,
      trim: 0.5,
    });
    // Not before the clip's first frame.
    expect(placeCutaways(trimCutawayStart(edit, id, 0))[0]).toMatchObject({
      start: 1,
      end: 5,
      trim: 0,
    });
    // Later shows less, and keeps its id.
    const later = trimCutawayStart(edit, id, 3);
    expect(placeCutaways(later)[0]).toMatchObject({
      start: 3,
      end: 5,
      trim: 2,
    });
    expect(later.cutaways![0]!.id).toBe(id);
  });

  it("is never laid over a card, or over its own clip", () => {
    const withCard = addCard(
      quietFirst(),
      0,
      { template: "statement", theme: "dark", title: "Hi" },
      2,
    );
    expect(addCutaway(withCard, 1, B)).toBe(withCard);
    const plain = twoClips();
    expect(addCutaway(plain, 1, A)).toBe(plain);
  });
});

describe("fillers and sound effects", () => {
  it("cuts hesitation words out of the talk", () => {
    const edit = removeFillers(twoClips(), {
      [A]: [
        { text: "អឺ", start: 3.4, end: 3.8 },
        { text: "um,", start: 5, end: 5.3 },
        { text: "coffee", start: 4, end: 4.6 },
      ],
    });
    expect(
      edit.segments
        .filter((segment) => segment.assetId === A)
        .map((segment) => [segment.in, segment.out, segment.punch ?? 1]),
    ).toEqual([
      [2, 3.38, 1],
      [3.82, 4.98, 1.08],
      [5.32, 6, 1],
    ]);
  });

  it("whooshes under moving transitions and pops on cards, unless turned off", () => {
    let edit = addCard(
      quietFirst(),
      1,
      { template: "statement", theme: "dark", title: "Hi" },
      2,
    );
    const html = footageFiles(edit).files["composition.html"];
    expect(html).toContain('src="motify-sfx://whoosh" data-start="3.82"');
    expect(html).toContain('src="motify-sfx://pop" data-start="4.1"');
    edit = { ...edit, sfx: false };
    expect(footageFiles(edit).files["composition.html"]).not.toContain(
      "motify-sfx://",
    );
  });
});

describe("J and L cuts", () => {
  it("starts a J-cut's sound early and stops the previous sound there", () => {
    let edit = twoClips();
    edit = updateSegment(edit, edit.segments[1]!.id, { audioLead: 0.8 });
    const [first, second] = placeSounds(edit);
    expect(first).toMatchObject({ start: 0, trim: 2, duration: 3.2 });
    expect(second).toMatchObject({ start: 3.2, trim: 0.2, duration: 3.8 });
  });

  it("runs an L-cut's sound on and delays the next one", () => {
    let edit = twoClips();
    edit = updateSegment(edit, edit.segments[0]!.id, { audioTail: 1 });
    const [first, second] = placeSounds(edit);
    expect(first).toMatchObject({ start: 0, trim: 2, duration: 5 });
    expect(second).toMatchObject({ start: 5, trim: 2, duration: 2 });
  });

  it("is silent for clips without sound or turned down", () => {
    let edit = twoClips();
    edit = updateSegment(edit, edit.segments[0]!.id, { volume: 0 });
    expect(placeSounds(edit).map((sound) => sound.assetId)).toEqual([B]);
  });
});

describe("footage project files", () => {
  it("round-trips the edit through timeline.js", () => {
    const edit = {
      ...twoClips(),
      music: {
        trackId: "33333333-3333-4333-8333-333333333333",
        title: "Song",
        volume: 0.3,
        duck: true,
      },
    };
    const built = footageFiles(edit, "p1");
    expect(built).toMatchObject({
      width: 1080,
      height: 1920,
      duration: 7,
      fps: 30,
    });
    expect(isFootageTimeline(built.files["timeline.js"])).toBe(true);
    expect(readFootageEdit(built.files["timeline.js"])).toEqual(edit);
    const html = built.files["composition.html"];
    expect(html).toContain(
      `<video class="fx-main" data-motify-video src="motify-footage://${A}/video.mp4" data-start="0" data-trim="2" data-end="4"`,
    );
    expect(html).toContain(
      `src="motify-footage://${B}/audio.m4a" data-start="4" data-trim="1" data-duration="3"`,
    );
    expect(html).toContain(
      'src="motify-audio://33333333-3333-4333-8333-333333333333" data-start="0" data-duration="7" data-volume="0.3"',
    );
    // Music dips under speech (0.5..2) and fades out at the end.
    expect(html).toMatch(/data-envelope="0:0 0\.4:1 0\.4\d*:1 0\.6\d*:0\.35/);
    expect(html).toContain(
      '<div class="fx-cue" id="fx-cue-0" data-km><span class="fx-line">កាហ្វេថ្មី</span></div>',
    );
  });

  it("puts another clip on top of a split segment, for the segment's length", () => {
    const base = twoClips();
    const edit = updateSegment(base, base.segments[0]!.id, {
      layout: "split",
      overlay: { assetId: B, in: 1.5 },
    });
    const html = footageFiles(edit).files["composition.html"];
    expect(html).toContain(
      `<div class="fx-shot fx-shot--split" id="fx-shot-${edit.segments[0]!.id}"><div class="fx-half fx-half--a"><video data-motify-video src="motify-footage://${B}/video.mp4" data-start="0" data-trim="1.5" data-end="4"`,
    );
    expect(html).toContain(
      `<div class="fx-half fx-half--b"><video class="fx-main" data-motify-video src="motify-footage://${A}/video.mp4"`,
    );
    // The speaker's sound plays; the top clip is picture only.
    expect(placeSounds(edit).map((sound) => sound.assetId)).toEqual([A, B]);
  });

  it("escapes text", () => {
    const edit = {
      ...twoClips(),
      titles: [
        {
          id: "t",
          text: '<b>"Hi"</b>',
          start: 0,
          duration: 1,
          style: "headline" as const,
          position: "top" as const,
        },
      ],
    };
    expect(footageFiles(edit).files["composition.html"]).toContain(
      "&lt;b&gt;&quot;Hi&quot;&lt;/b&gt;",
    );
  });

  it("is not read from other films", () => {
    expect(readFootageEdit("function buildTimeline(context) {}")).toBeNull();
  });
});

describe("overlays in a box of their own", () => {
  it("names a placement by its boxes, and anything else is the person's own", () => {
    for (const format of ["9:16", "1:1", "16:9"] as const) {
      expect(placementOf(format, {})).toEqual({ name: "full" });
      expect(placementOf(format, { layout: "top" })).toEqual({ name: "top" });
      for (const name of ["window", "speaker-window"] as const)
        expect(
          placementOf(
            format,
            placementBoxes(format, {
              name,
              corner: "bottom-left",
              size: "large",
            }),
          ),
        ).toEqual({ name, corner: "bottom-left", size: "large" });
    }
    expect(
      placementOf("9:16", { box: { x: 0.1, y: 0.2, w: 0.5, h: 0.3 } }),
    ).toEqual({ name: "custom" });
    // A box set by hand stays inside the frame.
    expect(cleanBox({ x: 0.9, y: -1, w: 0.5, h: 0.01, radius: 2 })).toEqual({
      x: 0.5,
      y: 0,
      w: 0.5,
      h: 0.05,
      radius: 0.5,
    });
  });

  it("draws a window over the speaker at its place in the frame", () => {
    const box = windowBox("9:16", "overlay", "top-right", "medium");
    const edit = addCutaway(twoClips(), 1, B, 0.5, 2, { box });
    expect(cutawayFrame(edit.cutaways![0]!)).toEqual({ top: false, box });
    const html = footageFiles(edit).files["composition.html"];
    expect(html).toContain(
      '<div class="fx-cut-shot fx-cut--box" style="left:51%;top:8%;width:44%;height:30.94%;border-radius:calc(32.4px * var(--fx-unit));" id="fx-cut-0"><video data-motify-video',
    );
    // It is above the shots, like any overlay.
    expect(html.indexOf('id="fx-cut-0"')).toBeGreaterThan(
      html.indexOf('<div class="fx-shots">'),
    );
    // A box wins over the old layout, and moving the overlay keeps it.
    const both = updateCutaway(edit, edit.cutaways![0]!.id, { layout: "top" });
    expect(cutawayFrame(both.cutaways![0]!).top).toBe(false);
    expect(
      moveCutaway(edit, edit.cutaways![0]!.id, 2).cutaways![0]!.box,
    ).toEqual(box);
  });

  it("puts an overlay the speaker stands in front of under the shots", () => {
    const speaker = {
      ...windowBox("9:16", "speaker", "top-left", "medium"),
      front: true,
    };
    const edit = addCutaway(twoClips(), 1, B, 0.5, 2, { speaker });
    const html = footageFiles(edit).files["composition.html"];
    // Full frame, in the layer before the shots: shrinking the speaker reveals it.
    const under = html.indexOf('<div class="fx-cutaways fx-cutaways--under">');
    const overlay = html.indexOf('<video class="fx-cutaway" id="fx-cut-0"');
    const shots = html.indexOf('<div class="fx-shots">');
    expect(under).toBeGreaterThan(-1);
    expect(overlay).toBeGreaterThan(under);
    expect(overlay).toBeLessThan(shots);
    // A card always fills the frame, whatever boxes it carries.
    expect(cutawayFrame({ kind: "card", box: speaker })).toEqual({
      top: false,
    });
  });
});

describe("caption motion", () => {
  const placed = {
    cue: { id: "c1", assetId: "a", start: 0, end: 2, text: "hello big world" },
    start: 10,
    end: 12,
    words: [
      { text: "hello", start: 10, end: 10.5 },
      { text: "big", start: 11, end: 11.3 },
      { text: "world", start: 11.4, end: 12 },
    ],
  };

  it("times each word piece by the transcript's words", () => {
    expect(cueWordTimes(placed, ["hello", "big", "world"])).toEqual([
      { start: 10, end: 10.5 },
      { start: 10.5, end: 11.3 },
      { start: 11.3, end: 12 },
    ]);
  });

  it("matches pieces split differently from the transcript by characters", () => {
    // Khmer is segmented by the browser, not as the transcript heard it.
    const times = cueWordTimes(placed, ["hel", "lobig", "world"]);
    expect(times).toHaveLength(3);
    expect(times[0]!.start).toBe(10);
    expect(times[2]!.end).toBe(12);
    expect(
      times.every(
        (time, index) => index === 0 || time.start >= times[index - 1]!.start,
      ),
    ).toBe(true);
  });

  it("spreads words over a reworded cue by length", () => {
    expect(cueWordTimes({ ...placed, words: [] }, ["ab", "ab"])).toEqual([
      { start: 10, end: 11 },
      { start: 11, end: 12 },
    ]);
  });

  it("keeps caption sizes inside the range", () => {
    expect(captionSize(undefined)).toBe(1);
    expect(captionSize(5)).toBe(2);
    expect(captionSize(0.1)).toBe(0.6);
    expect(captionSize(1.333)).toBe(1.33);
  });
});

describe("caption key words", () => {
  it("picks the words that carry a line, not the small ones", () => {
    expect(captionKeywords(["always", "be", "willing", "to", "grow"])).toEqual([
      true,
      false,
      true,
      false,
      false,
    ]);
    expect(captionKeywords(["hi"])).toEqual([true]);
  });

  it("stacks key words on their own lines with the small words tucked in", () => {
    // do what you | love | and the | rest | will come
    expect(
      stackBreaks([false, false, false, true, false, false, true, false, true]),
    ).toEqual([false, false, false, true, true, false, true, true, false]);
  });
});

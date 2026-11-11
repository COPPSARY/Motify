/**
 * A footage edit: a video cut from the person's own clips (the backend's
 * packages/footage/edit.ts has the same shape).
 *
 * It is an ordinary project. `render.ts` writes it into the project's files:
 * composition.html holds the clips, captions and titles as elements, and
 * timeline.js carries this object and moves them. Preview, versions and export
 * are therefore the ones every film uses; nothing here plays or renders video.
 *
 * Times are seconds. A segment's `in`/`out` and a caption's `start`/`end` are
 * times in the source clip, so a caption follows its words wherever the
 * segment is trimmed or moved; titles sit on the finished video's own clock.
 */

export type FootageFormat = "9:16" | "16:9" | "1:1";
export type FootageTransition =
  "cut" | "slide" | "blur" | "zoom" | "whip" | "flash";
/** "split": another clip fills the top half (left in 16:9) while this one plays below. */
export type FootageLayout = "full" | "split";
export type FootageTitleStyle =
  "headline" | "kinetic" | "badge" | "lower-third" | "cta";
export type FootageCaptionStyle = "pop" | "box" | "clean";

export const FOOTAGE_FORMATS: readonly FootageFormat[] = [
  "9:16",
  "16:9",
  "1:1",
];
export const FOOTAGE_TRANSITIONS: readonly FootageTransition[] = [
  "cut",
  "blur",
  "zoom",
  "whip",
  "flash",
  "slide",
];
export const FOOTAGE_TITLE_STYLES: readonly FootageTitleStyle[] = [
  "headline",
  "kinetic",
  "badge",
  "lower-third",
  "cta",
];

export type FootageCardTemplate = "spotlight" | "statement" | "list" | "end";
export type FootageCardTheme = "paper" | "white" | "dark" | "accent";
export const FOOTAGE_CARD_TEMPLATES: readonly FootageCardTemplate[] = [
  "spotlight",
  "statement",
  "list",
  "end",
];
export const FOOTAGE_CARD_THEMES: readonly FootageCardTheme[] = [
  "paper",
  "white",
  "dark",
  "accent",
];

/**
 * A motion graphic cut between shots: a full-frame animated card the footage
 * runtime draws on the film's own timeline. Its segment has no clip.
 */
export interface FootageCard {
  template: FootageCardTemplate;
  theme: FootageCardTheme;
  /** A small line above the title, e.g. "ប្រើប្រាស់". */
  eyebrow?: string;
  /** The big words: a name, a statement. */
  title: string;
  /** A small spaced-out word under it, e.g. "OPUS". */
  label?: string;
  /** A huge number or price, e.g. "5.5" or "$2.50". */
  big?: string;
  /** For a list: up to four short lines. */
  items?: string[];
  /**
   * The card made by Motify's motion-graphics generator, in a project of its
   * own; played in the card's place once ready. The template shows until then.
   */
  film?: {
    projectId: string;
    state: "generating" | "ready" | "failed";
    duration?: number;
  };
}

export interface FootageClip {
  assetId: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export interface FootageSegment {
  id: string;
  assetId: string;
  in: number;
  out: number;
  volume: number;
  transition: FootageTransition;
  /** J-cut: the sound starts this long before the picture. */
  audioLead: number;
  /** L-cut: the sound runs on this long under the next picture. */
  audioTail: number;
  /** A slow push-in to this scale over the segment; 1 is none. */
  zoom: number;
  /** Full frame (the default), or split with `overlay` on top. */
  layout?: FootageLayout;
  /** The clip shown in the other half of a split, from `in` seconds. */
  overlay?: { assetId: string; in: number };
  /** A steady closer framing for the whole segment (a jump cut's punch-in); 1 is none. */
  punch?: number;
  /** A card instead of a clip; `assetId` is then "" and `in`..`out` its length. */
  card?: FootageCard;
}

/** The longest a card may run, in seconds. */
export const MAX_CARD_SECONDS = 8;

export interface CaptionWord {
  text: string;
  start: number;
  end: number;
}

export interface CaptionCue {
  id: string;
  assetId: string;
  start: number;
  end: number;
  text: string;
  alt?: string;
  words?: CaptionWord[];
}

export interface FootageTitle {
  id: string;
  /** Text colour; the video's default when absent. */
  color?: string;
  text: string;
  sub?: string;
  start: number;
  duration: number;
  style: FootageTitleStyle;
  position: "top" | "center" | "bottom";
}

export interface FootageMusic {
  trackId: string;
  title: string;
  volume: number;
  duck: boolean;
}

/** What an overlay shows: another clip (B-roll), a picture, or a card. */
export type FootageCutawayKind = "clip" | "image" | "card";
/**
 * "full" covers the frame; "top" fills the top half (the left in 16:9) while the
 * speaker zooms out and moves down to stay in view below, the talking-head split.
 */
export type FootageCutawayLayout = "full" | "top";

/**
 * An overlay over talk: B-roll, a picture or a card covers the video while the
 * clip underneath keeps its sound and captions. Pinned to the moment it
 * illustrates, in the covered clip's own time, so trims, splits and cut pauses
 * keep it there.
 */
export interface FootageCutaway {
  id: string;
  /** The clip it covers, and where in that clip it starts. */
  over: string;
  from: number;
  duration: number;
  /** A clip (the default), a picture or a card. */
  kind?: FootageCutawayKind;
  /** Full frame (the default), or the top half with the speaker below; not for cards. */
  layout?: FootageCutawayLayout;
  /** The clip shown, from `in` seconds; the picture's asset for an image; "" for a card. */
  assetId: string;
  in: number;
  /** For a card: what it says (and its generated film). */
  card?: FootageCard;
}

/** One line of a voice-over: Kiri's reading of `text`, on the video's clock. */
export interface FootageVoiceLine {
  id: string;
  /** The narration's audio track (motify-audio://). */
  trackId: string;
  text: string;
  start: number;
  duration: number;
}

/**
 * A voice-over read by Kiri TTS. Its lines are the captions while it is on,
 * and the clips' own sound plays quietly under it.
 */
export interface FootageVoiceover {
  voice: string;
  volume: number;
  lines: FootageVoiceLine[];
}

export interface FootageEdit {
  kind: "motify-footage-edit";
  version: 1;
  format: FootageFormat;
  fps: number;
  title?: string;
  brief?: string;
  /** The business's name from its Brand Kit, spelled exactly so on cards and titles. */
  business?: string;
  theme: { accent: string; ink: string; font: string };
  clips: FootageClip[];
  segments: FootageSegment[];
  captions: {
    enabled: boolean;
    style: FootageCaptionStyle;
    position: "bottom" | "center";
    /** Caption colour; white (or the accent, for the yellow style) when absent. */
    color?: string;
    language: string;
    cues: CaptionCue[];
  };
  titles: FootageTitle[];
  music: FootageMusic | null;
  /** Overlays over talk: B-roll, pictures and cards. */
  cutaways?: FootageCutaway[];
  /** A voice-over; see FootageVoiceover. */
  voiceover?: FootageVoiceover | null;
  /** A whoosh on moving transitions and a pop on cards; on unless false. */
  sfx?: boolean;
}

export interface PlacedCutaway {
  cutaway: FootageCutaway;
  /** On the video's clock. */
  start: number;
  end: number;
  /** Where in the shown clip it starts here. */
  trim: number;
}

/**
 * Overlays on the video's clock. Each starts at the moment of the talk it is
 * pinned to (or, when that moment was cut, where the talk picks up again) and
 * then runs its length on the video's clock, across cuts into later scenes. It
 * stops early only at a card cut in, which already fills the frame, at the end
 * of the video, or when the clip it shows runs out.
 */
export function placeCutaways(edit: FootageEdit): PlacedCutaway[] {
  const shots = placeSegments(edit);
  const total = shots.length > 0 ? shots[shots.length - 1]!.end : 0;
  const placed: PlacedCutaway[] = [];
  for (const cutaway of edit.cutaways ?? []) {
    const talk = shots.filter(
      ({ segment }) => !segment.card && segment.assetId === cutaway.over,
    );
    let start: number | undefined;
    let skipped = 0;
    const holding = talk.find(
      ({ segment }) =>
        cutaway.from >= segment.in && cutaway.from < segment.out - 0.15,
    );
    if (holding) start = holding.start + (cutaway.from - holding.segment.in);
    else {
      const next = talk.find(
        ({ segment }) =>
          segment.in > cutaway.from &&
          segment.in < cutaway.from + cutaway.duration - 0.15,
      );
      if (next) {
        start = next.start;
        skipped = next.segment.in - cutaway.from;
      }
    }
    if (start === undefined) continue;
    let end = Math.min(total, start + cutaway.duration - skipped);
    const card = shots.find(
      (shot) => shot.segment.card && shot.start >= start! - 0.001,
    );
    if (card) end = Math.min(end, card.start);
    const trim = cutaway.in + skipped;
    if (!cutaway.kind || cutaway.kind === "clip") {
      const shown = clipOf(edit, cutaway.assetId);
      if (shown) end = Math.min(end, start + shown.duration - trim);
    }
    if (end - start < 0.15) continue;
    placed.push({
      cutaway,
      start: round(start),
      end: round(end),
      trim: round(trim),
    });
  }
  return placed.sort((a, b) => a.start - b.start);
}

/** The longest `cutaway` may run: its clip's rest, a card's limit, or the video. */
export function cutawayMaxLength(
  edit: FootageEdit,
  cutaway: Pick<FootageCutaway, "kind" | "assetId" | "in">,
): number {
  if (cutaway.kind === "card") return MAX_CARD_SECONDS;
  const total = editDuration(edit);
  if (cutaway.kind === "image") return Math.max(0.3, total);
  const shown = clipOf(edit, cutaway.assetId);
  return Math.max(
    0.3,
    Math.min(total, (shown?.duration ?? total) - cutaway.in),
  );
}

/**
 * An overlay over whatever is playing at `at` (B-roll by default; a picture or
 * a card with `extra`); the talk underneath keeps going.
 */
export function addCutaway(
  edit: FootageEdit,
  at: number,
  assetId: string,
  clipIn = 0,
  seconds = 2.5,
  extra: Pick<FootageCutaway, "kind" | "card" | "layout"> = {},
): FootageEdit {
  const placed = placeSegments(edit).find(
    (item) => !item.segment.card && at >= item.start && at < item.end,
  );
  if (!placed || placed.segment.assetId === assetId) return edit;
  const clipShown = !extra.kind || extra.kind === "clip";
  const from = round(placed.segment.in + (at - placed.start));
  const shown = clipShown ? clipOf(edit, assetId) : undefined;
  // It may run on past this scene into the next ones, up to the video's end.
  const duration = round(
    Math.max(
      0.3,
      Math.min(
        seconds,
        editDuration(edit) - at,
        (shown?.duration ?? seconds) - clipIn,
      ),
    ),
  );
  return {
    ...edit,
    cutaways: [
      ...(edit.cutaways ?? []),
      {
        id: newId("c"),
        over: placed.segment.assetId,
        from,
        duration,
        ...(extra.kind && extra.kind !== "clip" ? { kind: extra.kind } : {}),
        ...(extra.layout === "top" && extra.kind !== "card"
          ? { layout: "top" as const }
          : {}),
        assetId,
        in: round(Math.max(0, clipIn)),
        ...(extra.card ? { card: extra.card } : {}),
      },
    ],
  };
}

/** The time of the nearest moment a clip (not a card) plays, for an overlay. */
export function overlayTime(edit: FootageEdit, at: number): number | null {
  let best: number | null = null;
  for (const { segment, start, end } of placeSegments(edit)) {
    if (segment.card || end - start < 0.4) continue;
    const time = Math.min(Math.max(at, start), end - 0.35);
    if (best === null || Math.abs(time - at) < Math.abs(best - at)) best = time;
  }
  return best === null ? null : round(best);
}

/**
 * A picture (a logo, a product photo, a screenshot) over the talk at `at`: in
 * the top half above the speaker in a vertical or square video, full frame in a
 * wide one.
 */
export function addPicture(
  edit: FootageEdit,
  at: number,
  assetId: string,
  seconds = 3,
): FootageEdit {
  const time = overlayTime(edit, at);
  return time === null
    ? edit
    : addCutaway(edit, time, assetId, 0, seconds, {
        kind: "image",
        ...(edit.format === "16:9" ? {} : { layout: "top" as const }),
      });
}

export function updateCutaway(
  edit: FootageEdit,
  id: string,
  patch: Partial<Omit<FootageCutaway, "id">>,
): FootageEdit {
  return {
    ...edit,
    cutaways: (edit.cutaways ?? []).map((cut) =>
      cut.id === id ? { ...cut, ...patch } : cut,
    ),
  };
}

export function removeCutaway(edit: FootageEdit, id: string): FootageEdit {
  return {
    ...edit,
    cutaways: (edit.cutaways ?? []).filter((cut) => cut.id !== id),
  };
}

/** Moves B-roll to start at `at` on the video's clock, over whatever plays there. */
export function moveCutaway(
  edit: FootageEdit,
  id: string,
  at: number,
): FootageEdit {
  const cut = (edit.cutaways ?? []).find((item) => item.id === id);
  if (!cut) return edit;
  const without = removeCutaway(edit, id);
  const moved = addCutaway(without, at, cut.assetId, cut.in, cut.duration, {
    ...(cut.kind ? { kind: cut.kind } : {}),
    ...(cut.card ? { card: cut.card } : {}),
    ...(cut.layout ? { layout: cut.layout } : {}),
  });
  if (moved === without) return edit;
  const added = moved.cutaways![moved.cutaways!.length - 1]!;
  return {
    ...moved,
    cutaways: [...without.cutaways!, { ...added, id: cut.id }],
  };
}

/**
 * Pulls an overlay's start to `at` on the video's clock while its end stays
 * put: earlier shows more of its clip from before, later less. It cannot start
 * on a card, before its clip's first frame, or within 0.3 s of its end.
 */
export function trimCutawayStart(
  edit: FootageEdit,
  id: string,
  at: number,
): FootageEdit {
  const placed = placeCutaways(edit).find((item) => item.cutaway.id === id);
  if (!placed) return edit;
  const cut = placed.cutaway;
  const clipShown = !cut.kind || cut.kind === "clip";
  let start = Math.min(at, placed.end - 0.3);
  if (clipShown) start = Math.max(start, placed.start - placed.trim);
  const snapped = overlayTime(edit, Math.max(0, start));
  if (snapped === null || snapped >= placed.end - 0.3) return edit;
  const shift = snapped - placed.start;
  const without = removeCutaway(edit, id);
  const moved = addCutaway(
    without,
    snapped,
    cut.assetId,
    clipShown ? placed.trim + shift : cut.in,
    Math.min(
      placed.end - snapped,
      cut.kind === "card" ? MAX_CARD_SECONDS : Number.POSITIVE_INFINITY,
    ),
    {
      ...(cut.kind ? { kind: cut.kind } : {}),
      ...(cut.card ? { card: cut.card } : {}),
      ...(cut.layout ? { layout: cut.layout } : {}),
    },
  );
  if (moved === without) return edit;
  const added = moved.cutaways![moved.cutaways!.length - 1]!;
  return {
    ...moved,
    cutaways: (edit.cutaways ?? []).map((item) =>
      item.id === id ? { ...added, id } : item,
    ),
  };
}

/** Words that are only hesitation, in Khmer and English. */
const FILLERS = new Set([
  "អឺ",
  "អ៊ឺ",
  "អឹម",
  "អ៊ឹម",
  "ហឹម",
  "អឺម",
  "um",
  "umm",
  "uh",
  "uhh",
  "uhm",
  "erm",
  "er",
  "ah",
  "hmm",
  "mm",
]);

export function isFiller(word: string): boolean {
  return FILLERS.has(
    word
      .toLowerCase()
      .replace(/[.,!?…។៕]+$/u, "")
      .trim(),
  );
}

/**
 * Cuts hesitation words ("um", "អឺ") out of the talking segments, splitting
 * each around them; the closer framing on alternate pieces hides the jumps.
 */
export function removeFillers(
  edit: FootageEdit,
  transcripts: Readonly<Record<string, readonly CaptionWord[]>>,
): FootageEdit {
  let changed = false;
  const segments = edit.segments.flatMap((segment) => {
    if (segment.card || segment.volume <= 0) return [segment];
    const fillers = (transcripts[segment.assetId] ?? []).filter(
      (word) =>
        isFiller(word.text) &&
        word.start > segment.in + 0.05 &&
        word.end < segment.out - 0.05,
    );
    if (fillers.length === 0) return [segment];
    changed = true;
    const pieces: FootageSegment[] = [];
    let cursor = segment.in;
    for (const filler of fillers) {
      const gap = Math.max(cursor, filler.start - 0.02);
      if (gap - cursor >= 0.3)
        pieces.push({
          ...segment,
          id: pieces.length === 0 ? segment.id : newId("s"),
          in: round(cursor),
          out: round(gap),
          transition: pieces.length === 0 ? segment.transition : "cut",
          ...(pieces.length % 2 === 1 ? { punch: 1.08 } : {}),
        });
      cursor = Math.max(cursor, filler.end + 0.02);
    }
    if (segment.out - cursor >= 0.3)
      pieces.push({
        ...segment,
        id: pieces.length === 0 ? segment.id : newId("s"),
        in: round(cursor),
        transition: pieces.length === 0 ? segment.transition : "cut",
        ...(pieces.length % 2 === 1 ? { punch: 1.08 } : {}),
      });
    return pieces;
  });
  return changed ? withSegments(edit, segments) : edit;
}

export const FORMAT_SIZE: Record<
  FootageFormat,
  { width: number; height: number }
> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

/** The shortest a segment may be trimmed to, in seconds. */
export const MIN_SEGMENT = 0.3;

export function emptyEdit(format: FootageFormat = "9:16"): FootageEdit {
  return {
    kind: "motify-footage-edit",
    version: 1,
    format,
    fps: 30,
    theme: { accent: "#FFD400", ink: "#111111", font: "Kantumruy Pro" },
    clips: [],
    segments: [],
    captions: {
      enabled: true,
      style: "clean",
      position: "bottom",
      language: "km",
      cues: [],
    },
    titles: [],
    music: null,
  };
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36).slice(-5)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

export function segmentLength(segment: Pick<FootageSegment, "in" | "out">) {
  return Math.max(0, segment.out - segment.in);
}

export function editDuration(edit: Pick<FootageEdit, "segments">): number {
  return round(
    edit.segments.reduce((total, segment) => total + segmentLength(segment), 0),
  );
}

export function clipOf(
  edit: FootageEdit,
  assetId: string,
): FootageClip | undefined {
  return edit.clips.find((clip) => clip.assetId === assetId);
}

// ---- where everything plays -----------------------------------------------------------

export interface PlacedSegment {
  segment: FootageSegment;
  index: number;
  /** On the video's clock. */
  start: number;
  end: number;
}

export interface PlacedSound {
  segmentId: string;
  assetId: string;
  /** On the video's clock. */
  start: number;
  /** Where in the clip's sound it begins. */
  trim: number;
  duration: number;
  volume: number;
}

export interface PlacedCue {
  cue: CaptionCue;
  start: number;
  end: number;
  /** Word timings on the video's clock, for the word being said to light up. */
  words: CaptionWord[];
}

export function placeSegments(edit: FootageEdit): PlacedSegment[] {
  let at = 0;
  return edit.segments.map((segment, index) => {
    const start = at;
    at += segmentLength(segment);
    return { segment, index, start: round(start), end: round(at) };
  });
}

/**
 * Each segment's sound. A J-cut starts it early, over the end of the previous
 * picture, and that picture's own sound stops there; an L-cut runs it on under
 * the next picture, whose sound waits. Both stay inside the clip.
 */
export function placeSounds(edit: FootageEdit): PlacedSound[] {
  const placed = placeSegments(edit);
  const audible = placed.map(({ segment }) => {
    const clip = clipOf(edit, segment.assetId);
    return Boolean(clip?.hasAudio) && segment.volume > 0;
  });
  // How far each sound really reaches past its picture, after its clip's limits.
  const leads = placed.map(({ segment }, index) =>
    index === 0 || !audible[index]
      ? 0
      : Math.min(
          segment.audioLead,
          segment.in,
          segmentLength(placed[index - 1]!.segment) / 2,
        ),
  );
  const tails = placed.map(({ segment }, index) => {
    const next = placed[index + 1]?.segment;
    const duration = clipOf(edit, segment.assetId)?.duration ?? segment.out;
    return !next || !audible[index]
      ? 0
      : Math.min(
          segment.audioTail,
          Math.max(0, duration - segment.out),
          segmentLength(next) / 2,
        );
  });
  return placed.flatMap(({ segment, start, end }, index): PlacedSound[] => {
    if (!audible[index]) return [];
    const lead = leads[index]!;
    const tail = tails[index]!;
    // A neighbour's J/L-cut takes over this segment's sound at its edges.
    const cutIn = lead > 0 ? 0 : (tails[index - 1] ?? 0);
    const cutOut = tail > 0 ? 0 : (leads[index + 1] ?? 0);
    const soundStart = start - lead + cutIn;
    const soundEnd = end + tail - cutOut;
    if (soundEnd - soundStart <= 0.05) return [];
    return [
      {
        segmentId: segment.id,
        assetId: segment.assetId,
        start: round(soundStart),
        trim: round(segment.in - (start - soundStart)),
        duration: round(soundEnd - soundStart),
        volume: segment.volume,
      },
    ];
  });
}

const KHMER = /[\u1780-\u17FF\u19E0-\u19FF]/;

/** A voice-over line as caption lines short enough to read at a glance, timed by their length. */
function voiceCues(line: FootageVoiceLine): PlacedCue[] {
  const khmer = KHMER.test(line.text);
  const limit = khmer ? 26 : 36;
  const words =
    typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter(khmer ? "km" : undefined, {
            granularity: "word",
          }).segment(line.text),
          (piece) => piece.segment,
        )
      : line.text.split(/(\s+)/);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current + word).trim().length > limit && word.trim()) {
      chunks.push(current.trim());
      current = word;
    } else current += word;
  }
  if (current.trim()) chunks.push(current.trim());
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0) || 1;
  let at = line.start;
  return chunks.map((text, index) => {
    const length = (line.duration * text.length) / size;
    const placed: PlacedCue = {
      cue: {
        id: `${line.id}-${index}`,
        assetId: "",
        start: at,
        end: at + length,
        text,
      },
      start: round(at),
      end: round(at + length),
      words: [],
    };
    at += length;
    return placed;
  });
}

/**
 * Captions on the video's clock: each cue shown inside every segment that plays
 * its words, or the voice-over's lines while there is one.
 */
export function placeCues(edit: FootageEdit): PlacedCue[] {
  if (!edit.captions.enabled) return [];
  if (edit.voiceover && edit.voiceover.lines.length > 0)
    return edit.voiceover.lines.flatMap(voiceCues);
  const result: PlacedCue[] = [];
  for (const { segment, start } of placeSegments(edit)) {
    // Captions are what is heard: a muted shot's words are not shown.
    if (segment.volume <= 0) continue;
    for (const cue of edit.captions.cues) {
      if (cue.assetId !== segment.assetId) continue;
      const from = Math.max(cue.start, segment.in);
      const to = Math.min(cue.end, segment.out);
      // A cue barely inside the segment is a word cut off at its edge; leave it out.
      if (to - from < Math.min(0.35, (cue.end - cue.start) * 0.5)) continue;
      const offset = start - segment.in;
      result.push({
        cue,
        start: round(from + offset),
        end: round(to + offset),
        words: (cue.words ?? [])
          .filter((word) => word.end > segment.in && word.start < segment.out)
          .map((word) => ({
            text: word.text,
            start: round(Math.max(word.start, segment.in) + offset),
            end: round(Math.min(word.end, segment.out) + offset),
          })),
      });
    }
  }
  return result.sort((a, b) => a.start - b.start);
}

/** The segment playing at `time`, and where in it. */
export function segmentAt(
  edit: FootageEdit,
  time: number,
): PlacedSegment | undefined {
  const placed = placeSegments(edit);
  return (
    placed.find((item) => time >= item.start && time < item.end) ??
    placed[placed.length - 1]
  );
}

// ---- edits ----------------------------------------------------------------------------

function withSegments(
  edit: FootageEdit,
  segments: FootageSegment[],
): FootageEdit {
  const total = editDuration({ segments });
  return {
    ...edit,
    segments,
    // A title past the new end would never show; it moves back inside.
    titles: edit.titles.map((title) =>
      title.start >= total
        ? { ...title, start: round(Math.max(0, total - title.duration)) }
        : title,
    ),
  };
}

export function addClip(edit: FootageEdit, clip: FootageClip): FootageEdit {
  if (edit.clips.some((existing) => existing.assetId === clip.assetId))
    return edit;
  return { ...edit, clips: [...edit.clips, clip] };
}

/** A clip from the bin, whole, at the end of the video (or after `afterIndex`). */
export function appendClip(
  edit: FootageEdit,
  assetId: string,
  afterIndex = edit.segments.length - 1,
): FootageEdit {
  const clip = clipOf(edit, assetId);
  if (!clip) return edit;
  const segment: FootageSegment = {
    id: newId("s"),
    assetId,
    in: 0,
    out: round(clip.duration),
    volume: 1,
    transition: "cut",
    audioLead: 0,
    audioTail: 0,
    zoom: 1,
  };
  const segments = [...edit.segments];
  segments.splice(afterIndex + 1, 0, segment);
  return withSegments(edit, segments);
}

export function removeClip(edit: FootageEdit, assetId: string): FootageEdit {
  return withSegments(
    {
      ...edit,
      clips: edit.clips.filter((clip) => clip.assetId !== assetId),
      captions: {
        ...edit.captions,
        cues: edit.captions.cues.filter((cue) => cue.assetId !== assetId),
      },
      cutaways: (edit.cutaways ?? []).filter(
        (cut) => cut.assetId !== assetId && cut.over !== assetId,
      ),
    },
    edit.segments.filter((segment) => segment.assetId !== assetId),
  );
}

/** Splits the segment playing at `time` in two, at that frame. */
export function splitAt(edit: FootageEdit, time: number): FootageEdit {
  const placed = placeSegments(edit).find(
    (item) => time > item.start + MIN_SEGMENT && time < item.end - MIN_SEGMENT,
  );
  // A card is one graphic; it is trimmed, not split.
  if (!placed || placed.segment.card) return edit;
  const cut = round(placed.segment.in + (time - placed.start));
  const first = { ...placed.segment, out: cut, audioTail: 0 };
  const second = {
    ...placed.segment,
    id: newId("s"),
    in: cut,
    transition: "cut" as const,
    audioLead: 0,
  };
  const segments = [...edit.segments];
  segments.splice(placed.index, 1, first, second);
  return withSegments(edit, segments);
}

export function removeSegment(edit: FootageEdit, id: string): FootageEdit {
  return withSegments(
    edit,
    edit.segments.filter((segment) => segment.id !== id),
  );
}

export function moveSegment(
  edit: FootageEdit,
  id: string,
  toIndex: number,
): FootageEdit {
  const from = edit.segments.findIndex((segment) => segment.id === id);
  if (from === -1) return edit;
  const segments = [...edit.segments];
  const [moved] = segments.splice(from, 1);
  segments.splice(Math.max(0, Math.min(segments.length, toIndex)), 0, moved!);
  return withSegments(edit, segments);
}

/** Sets a segment's source range, kept inside its clip and at least MIN_SEGMENT long. */
export function trimSegment(
  edit: FootageEdit,
  id: string,
  range: { in?: number; out?: number },
): FootageEdit {
  return withSegments(
    edit,
    edit.segments.map((segment) => {
      if (segment.id !== id) return segment;
      const duration = segment.card
        ? MAX_CARD_SECONDS
        : (clipOf(edit, segment.assetId)?.duration ?? segment.out);
      let start = range.in ?? segment.in;
      let end = range.out ?? segment.out;
      start = Math.max(0, Math.min(start, end - MIN_SEGMENT));
      end = Math.min(duration, Math.max(end, start + MIN_SEGMENT));
      return { ...segment, in: round(start), out: round(end) };
    }),
  );
}

export function updateSegment(
  edit: FootageEdit,
  id: string,
  patch: Partial<Omit<FootageSegment, "id" | "assetId">>,
): FootageEdit {
  return withSegments(
    edit,
    edit.segments.map((segment) =>
      segment.id === id ? { ...segment, ...patch } : segment,
    ),
  );
}

export interface Silence {
  start: number;
  end: number;
}

/**
 * Cuts the silences out of every segment: each is split around any pause
 * longer than `minimum`, keeping `pad` of breath on either side of the words.
 */
export function removeSilences(
  edit: FootageEdit,
  silences: Readonly<Record<string, readonly Silence[]>>,
  minimum = 0.7,
  pad = 0.12,
): FootageEdit {
  const segments = edit.segments.flatMap((segment) => {
    const gaps = (silences[segment.assetId] ?? [])
      .map((gap) => ({ start: gap.start + pad, end: gap.end - pad }))
      .filter(
        (gap) =>
          gap.end - gap.start >= minimum - pad * 2 &&
          gap.end > segment.in &&
          gap.start < segment.out,
      );
    if (gaps.length === 0) return [segment];
    const pieces: FootageSegment[] = [];
    let cursor = segment.in;
    for (const gap of gaps) {
      if (gap.start - cursor >= MIN_SEGMENT)
        pieces.push({
          ...segment,
          id: pieces.length === 0 ? segment.id : newId("s"),
          in: round(cursor),
          out: round(Math.min(gap.start, segment.out)),
          transition: pieces.length === 0 ? segment.transition : "cut",
        });
      cursor = Math.max(cursor, gap.end);
    }
    if (segment.out - cursor >= MIN_SEGMENT)
      pieces.push({
        ...segment,
        id: pieces.length === 0 ? segment.id : newId("s"),
        in: round(cursor),
        transition: pieces.length === 0 ? segment.transition : "cut",
      });
    return pieces;
  });
  return withSegments(edit, segments);
}

/**
 * A card at `at`. Over a clip that plays its sound it goes over the talk, so
 * the voice never stops for it; elsewhere it is cut in after the segment
 * playing at `at` (first when `at` is before everything).
 */
export function addCard(
  edit: FootageEdit,
  at: number,
  card: FootageCard,
  seconds = 2.5,
): FootageEdit {
  const playing = placeSegments(edit).find(
    (item) => at >= item.start && at < item.end,
  );
  if (
    playing &&
    !playing.segment.card &&
    playing.segment.volume > 0 &&
    clipOf(edit, playing.segment.assetId)?.hasAudio
  ) {
    const over = addCutaway(edit, at, "", 0, seconds, { kind: "card", card });
    if (over !== edit) return over;
  }
  const segment: FootageSegment = {
    id: newId("k"),
    assetId: "",
    in: 0,
    out: round(Math.min(MAX_CARD_SECONDS, Math.max(0.6, seconds))),
    volume: 0,
    transition: edit.segments.length === 0 ? "cut" : "slide",
    audioLead: 0,
    audioTail: 0,
    zoom: 1,
    card,
  };
  const placed = placeSegments(edit);
  const current = placed.find((item) => at >= item.start && at < item.end);
  const index =
    at <= 0 ? 0 : current ? current.index + 1 : edit.segments.length;
  const segments = [...edit.segments];
  segments.splice(index, 0, segment);
  return withSegments(edit, segments);
}

/** Changes a card, cut in (a segment) or over talk (an overlay). */
export function updateCard(
  edit: FootageEdit,
  id: string,
  patch: Partial<FootageCard>,
): FootageEdit {
  const next = withSegments(
    edit,
    edit.segments.map((segment) =>
      segment.id === id && segment.card
        ? { ...segment, card: { ...segment.card, ...patch } }
        : segment,
    ),
  );
  if (!(edit.cutaways ?? []).some((cut) => cut.id === id && cut.card))
    return next;
  return {
    ...next,
    cutaways: (edit.cutaways ?? []).map((cut) =>
      cut.id === id && cut.card
        ? { ...cut, card: { ...cut.card, ...patch } }
        : cut,
    ),
  };
}

export function updateCue(
  edit: FootageEdit,
  id: string,
  patch: Partial<Pick<CaptionCue, "text" | "alt" | "start" | "end">>,
): FootageEdit {
  return {
    ...edit,
    captions: {
      ...edit.captions,
      cues: edit.captions.cues.map((cue) => {
        if (cue.id !== id) return cue;
        const next = { ...cue, ...patch };
        // Typed-over words no longer match their timings; the line lights up as a whole.
        if (patch.text !== undefined && patch.text !== cue.text)
          delete next.words;
        return next;
      }),
    },
  };
}

export function addTitle(
  edit: FootageEdit,
  at: number,
  style: FootageTitleStyle = "headline",
): FootageEdit {
  const total = editDuration(edit);
  const start = round(Math.max(0, Math.min(at, total - 1)));
  return {
    ...edit,
    titles: [
      ...edit.titles,
      {
        id: newId("t"),
        text: style === "badge" ? "-20%" : "ចំណងជើង",
        start,
        duration: round(Math.min(3, Math.max(1, total - start))),
        style,
        position:
          style === "lower-third" || style === "cta"
            ? "bottom"
            : style === "headline"
              ? "top"
              : "center",
      },
    ],
  };
}

export function updateTitle(
  edit: FootageEdit,
  id: string,
  patch: Partial<Omit<FootageTitle, "id">>,
): FootageEdit {
  return {
    ...edit,
    titles: edit.titles.map((title) =>
      title.id === id ? { ...title, ...patch } : title,
    ),
  };
}

export function removeTitle(edit: FootageEdit, id: string): FootageEdit {
  return { ...edit, titles: edit.titles.filter((title) => title.id !== id) };
}

export function setFormat(
  edit: FootageEdit,
  format: FootageFormat,
): FootageEdit {
  return { ...edit, format };
}

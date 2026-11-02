import type { GuidedToolRequest, StoryboardBeat } from "../cloud/projects-api";
import type { CanvasAspect } from "../composition/canvas-frame";
import type { AssetIntent } from "../stores/local-assets";

/**
 * The guided tools on the create page: pick what to make, add pictures, pick a
 * few options, and generate. Everything here is what the person sees. The
 * brief the model works from is written by the server from the tool's id and
 * the options, so it never shows up in the browser or the chat.
 */

export type GuidedToolId = GuidedToolRequest["id"];
export type GuidedLanguage = GuidedToolRequest["language"];
export type GuidedFormat = NonNullable<GuidedToolRequest["format"]>;

/** A way of telling a tool's film, e.g. in scenes or as one animated poster. */
export interface FormatOption {
  readonly format: GuidedFormat;
  readonly label: string;
  readonly hint: string;
}

/** An image slot: pictures shown in the film as they are, or ones to rebuild from. */
export interface ImageSlot {
  readonly label: string;
  readonly hint: string;
  readonly max: number;
}

export interface GuidedTool {
  readonly id: GuidedToolId;
  readonly title: string;
  /** What goes in and what comes out, e.g. "Screenshots → video". */
  readonly tip: string;
  readonly summary: string;
  /** The Prompt Template whose video is the demo, and whose look the film takes. */
  readonly look: string;
  readonly aspect: CanvasAspect;
  /** Ways the film can be told, the first being the default; none when it has one. */
  readonly formats?: readonly FormatOption[];
  /** Pictures to rebuild from or take the look of; never shown in the film. */
  readonly reference: ImageSlot;
  /**
   * Pictures shown in the film as they are, beside a slot for the logo; null
   * when the tool shows neither.
   */
  readonly placed: ImageSlot | null;
  /** Whether the film signs off with a brand, so the form asks for its logo. */
  readonly logo: boolean;
  /** Which image slot comes first in the form. */
  readonly lead: AssetIntent;
  readonly instructions: {
    readonly label: string;
    readonly placeholder: string;
    readonly required: boolean;
  };
}

/** What the form hands back: the request, the line shown in the chat, and the images. */
export interface GuideResult {
  readonly tool: GuidedToolRequest;
  readonly message: string;
  readonly aspect: CanvasAspect;
  readonly files: readonly { file: File; intent: AssetIntent; logo?: true }[];
}

export const GUIDED_TOOLS: readonly GuidedTool[] = [
  {
    id: "product-walkthrough",
    title: "Product walkthrough",
    tip: "Screenshots → video",
    summary: "Turn app screenshots into an animated walkthrough.",
    look: "google-docs-product-demo",
    aspect: "16:9",
    reference: {
      label: "App screenshots",
      hint: "In the order you want them shown. We rebuild every element and animate it in.",
      max: 6,
    },
    placed: {
      label: "Pictures",
      hint: "Photos or images to show as they are.",
      max: 3,
    },
    logo: true,
    lead: "reference",
    instructions: {
      label: "Extra instructions",
      placeholder: "e.g. Focus on the share step and keep it upbeat",
      required: false,
    },
  },
  {
    id: "product-launch",
    title: "Product launch",
    tip: "Photos → launch film",
    summary: "Announce a product by showing it at work, live.",
    look: "figma-ai-agent",
    aspect: "16:9",
    reference: {
      label: "Screenshots or style references",
      hint: "We rebuild or take the look from these. They are not shown as they are.",
      max: 4,
    },
    placed: {
      label: "Product photos",
      hint: "Shown as they are, never redrawn.",
      max: 4,
    },
    logo: true,
    lead: "asset",
    instructions: {
      label: "Extra instructions",
      placeholder: "e.g. It launches on 1 December, end on our website",
      required: false,
    },
  },
  {
    id: "social-ad",
    title: "Social media ad",
    tip: "Product shots → ad",
    summary: "A quick, eye-catching promo for your feed.",
    look: "motiks-spicy-curls",
    aspect: "9:16",
    formats: [
      { format: "scenes", label: "Scenes", hint: "Quick cuts" },
      { format: "poster", label: "1 scene", hint: "Animated poster" },
    ],
    reference: {
      label: "Style references",
      hint: "We take the look from these. They are not shown as they are.",
      max: 4,
    },
    placed: {
      label: "Product photos",
      hint: "Shown as they are, never redrawn.",
      max: 4,
    },
    logo: true,
    lead: "asset",
    instructions: {
      label: "Extra instructions",
      placeholder: "e.g. 20% off this week only",
      required: false,
    },
  },
  {
    id: "story",
    title: "Story animation",
    tip: "Idea → animated short",
    summary: "A short animated story, no words needed.",
    look: "paper-moon",
    aspect: "16:9",
    reference: {
      label: "Characters or a style you like",
      hint: "Drawings or images in the look you want. They are not shown as they are.",
      max: 4,
    },
    placed: {
      label: "Pictures to show",
      hint: "Real things the story features, like a book's cover or pages. Shown as they are.",
      max: 4,
    },
    logo: false,
    lead: "reference",
    instructions: {
      label: "What's the story?",
      placeholder:
        "e.g. A tiny paper boat tries to reach the moon, and finds the sea instead",
      required: true,
    },
  },
];

export const ASPECT_OPTIONS: readonly {
  aspect: CanvasAspect;
  label: string;
}[] = [
  { aspect: "16:9", label: "Landscape" },
  { aspect: "9:16", label: "Vertical" },
  { aspect: "1:1", label: "Square" },
  { aspect: "4:5", label: "Portrait" },
];

export const LANGUAGE_OPTIONS: readonly {
  language: GuidedLanguage;
  label: string;
  native: string;
}[] = [
  { language: "en", label: "English", native: "English" },
  { language: "km", label: "Khmer", native: "ខ្មែរ" },
];

export const LENGTH_PRESETS: readonly number[] = [10, 15, 25];
export const MIN_SECONDS = 5;
export const MAX_SECONDS = 60;

/** A length inside what a guided film may ask for, or null for one that is not a number. */
export function clampSeconds(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(value)));
}

/**
 * The server's price for a guided tool (`quoteFilmUnits` in the backend's
 * credit-pricing.ts): the typical request's cost, scaled by the film's length
 * against 15 seconds within half and two and a half times, in tenths of a
 * credit, and inside what one request may cost.
 */
export const TYPICAL_FILM_SECONDS = 15;

export function estimateToolCredits(
  seconds: number,
  estimate: { typical: number; min: number; max: number } | null,
): number | null {
  if (!estimate) return null;
  const scale = Math.min(2.5, Math.max(0.5, seconds / TYPICAL_FILM_SECONDS));
  const quote = Math.round(estimate.typical * scale * 10) / 10;
  return Math.min(estimate.max, Math.max(estimate.min, quote));
}

/**
 * What the form still needs before it can generate, in words for the person,
 * or null when it is ready. Something has to say what the film is about:
 * pictures, a sentence, or a Brand Kit.
 */
export function missingInput(
  tool: GuidedTool,
  input: { instructions: string; images: number; hasBrand: boolean },
): string | null {
  const written = input.instructions.trim().length > 0;
  if (tool.instructions.required && !written) return "Tell us the story.";
  if (written || input.images > 0 || input.hasBrand) return null;
  return tool.id === "product-walkthrough"
    ? "Add a screenshot, or say what your app does in Extra instructions."
    : "Add a picture, or say what it's about in Extra instructions.";
}

/** The line the chat shows for a guided request: the person's choices and their own words. */
export function guideMessage(
  tool: GuidedTool,
  options: {
    aspect: CanvasAspect;
    seconds: number;
    language: GuidedLanguage;
    instructions: string;
    format?: GuidedFormat;
  },
): string {
  const language =
    LANGUAGE_OPTIONS.find((item) => item.language === options.language)
      ?.label ?? "English";
  const format = tool.formats?.find((item) => item.format === options.format);
  // The default way of telling it goes without saying.
  const told =
    format && format !== tool.formats?.[0] ? ` · ${format.label}` : "";
  const summary = `${tool.title}${told} · ${options.aspect} · ${options.seconds} sec · ${language}`;
  const extra = options.instructions.trim();
  return extra ? `${summary}\n\n${extra}` : summary;
}

/** The demo video for a tool, from the templates the API serves. */
export function toolVideo(
  tool: GuidedTool,
  templates: readonly { slug: string; video: string | null }[],
): string | null {
  return templates.find((item) => item.slug === tool.look)?.video ?? null;
}

/**
 * What a storyboard preview costs: a fixed price, the server's
 * `STORYBOARD_UNITS` in the backend's storyboard.ts.
 */
export const STORYBOARD_CREDITS = 1;

/** The shortest beat, in seconds; timings are kept to halves of a second. */
const MIN_BEAT_SECONDS = 0.5;

/**
 * The beats retimed to fill the film exactly, keeping how long each is
 * against the others, as the server does when it builds from them. Used after
 * a beat is removed or moved, so the times shown stay true.
 */
export function retimeBeats(
  beats: readonly StoryboardBeat[],
  seconds: number,
): StoryboardBeat[] {
  const count = Math.min(beats.length, Math.floor(seconds / MIN_BEAT_SECONDS));
  const kept = beats.slice(0, count);
  const total = kept.reduce((sum, beat) => sum + Math.max(0, beat.duration), 0);
  let start = 0;
  let elapsed = 0;
  return kept.map((beat, index) => {
    elapsed += Math.max(0, beat.duration);
    const remaining = count - index - 1;
    const end =
      index === count - 1
        ? seconds
        : Math.min(
            seconds - remaining * MIN_BEAT_SECONDS,
            Math.max(
              start + MIN_BEAT_SECONDS,
              total > 0
                ? Math.round((elapsed / total) * seconds * 2) / 2
                : start + seconds / count,
            ),
          );
    const timed = { ...beat, start, duration: end - start };
    start = end;
    return timed;
  });
}

/** The beats with one moved up (-1) or down (1), retimed; unchanged at either end. */
export function moveBeat(
  beats: readonly StoryboardBeat[],
  index: number,
  offset: -1 | 1,
  seconds: number,
): StoryboardBeat[] {
  const target = index + offset;
  if (target < 0 || target >= beats.length) return [...beats];
  const next = [...beats];
  const [moved] = next.splice(index, 1);
  if (moved) next.splice(target, 0, moved);
  return retimeBeats(next, seconds);
}

/** The beats without one, retimed; the last beat cannot be removed. */
export function removeBeat(
  beats: readonly StoryboardBeat[],
  index: number,
  seconds: number,
): StoryboardBeat[] {
  if (beats.length <= 1) return [...beats];
  return retimeBeats(
    beats.filter((_, position) => position !== index),
    seconds,
  );
}

/** A beat's place in the film, as "0–3.5s". */
export function beatTime(beat: { start: number; duration: number }): string {
  const format = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${format(beat.start)}–${format(beat.start + beat.duration)}s`;
}

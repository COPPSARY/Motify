import type { CanvasAspect, CanvasShape } from "./canvas-frame";

/**
 * What each canvas shape is called to someone who has never heard of an aspect
 * ratio: where the video will be posted. The ratio itself stays in tooltips and
 * screen-reader labels.
 */
export interface AspectName {
  /** In full, for menus and cards. */
  readonly name: string;
  /** Short enough for a toolbar button. */
  readonly short: string;
  /** Where it is used, in a few words. */
  readonly hint: string;
}

export const ASPECT_NAMES: Readonly<Record<CanvasAspect, AspectName>> = {
  "9:16": {
    name: "Reels & TikTok",
    short: "Reels",
    hint: "TikTok, Reels, Stories",
  },
  "1:1": {
    name: "Square post",
    short: "Square",
    hint: "Instagram and Facebook posts",
  },
  "4:5": {
    name: "Instagram feed",
    short: "Feed",
    hint: "Instagram feed posts",
  },
  "16:9": {
    name: "YouTube",
    short: "YouTube",
    hint: "Websites and widescreen video",
  },
};

/** "Reels & TikTok (9:16)": the name, with the ratio for anyone who wants it. */
export function aspectLabel(aspect: CanvasAspect): string {
  return `${ASPECT_NAMES[aspect].name} (${aspect})`;
}

/** The name of a canvas shape, which may be the design's own size. */
export function canvasShapeName(shape: CanvasShape): string {
  return shape === "original" ? "Original size" : ASPECT_NAMES[shape].name;
}

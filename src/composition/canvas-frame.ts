/**
 * Output canvas for a composition.
 *
 * Most films are authored at one fixed size with absolute positions, so a
 * different aspect ratio cannot reflow them. The canvas changes instead, and
 * the authored frame is placed in it: "fit" keeps the whole scene visible with
 * a blurred surround, "fill" crops it to cover the canvas, and "smart" follows
 * the frame's subjects with a measured virtual camera (auto-reframe.ts).
 *
 * A film that declares itself adaptive is mounted at the canvas size instead
 * and lays itself out for it, so framing does not apply to it.
 */
export type CanvasAspect = "16:9" | "1:1" | "9:16";
export type CanvasFraming = "smart" | "fit" | "fill";
export type CanvasOrientation = "landscape" | "square" | "portrait";

export interface CanvasSettings {
  aspect: CanvasAspect;
  framing: CanvasFraming;
}

export const DEFAULT_CANVAS: CanvasSettings = {
  aspect: "16:9",
  framing: "smart",
};

export const CANVAS_FRAMINGS: readonly CanvasFraming[] = [
  "smart",
  "fit",
  "fill",
];

export function isCanvasFraming(value: unknown): value is CanvasFraming {
  return CANVAS_FRAMINGS.includes(value as CanvasFraming);
}

export function canvasOrientation(
  width: number,
  height: number,
): CanvasOrientation {
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

/** The frame placed exactly on the canvas. */
export const IDENTITY_LAYOUT: FrameLayout = {
  scale: 1,
  x: 0,
  y: 0,
  identity: true,
};

export const CANVAS_ASPECTS: readonly CanvasAspect[] = ["16:9", "1:1", "9:16"];

const RATIOS: Record<CanvasAspect, number> = {
  "16:9": 16 / 9,
  "1:1": 1,
  "9:16": 9 / 16,
};

const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2);

export function isCanvasAspect(value: unknown): value is CanvasAspect {
  return CANVAS_ASPECTS.includes(value as CanvasAspect);
}

/** The short side stays the authored short side, so 1080p films stay 1080p. */
export function canvasSize(
  baseWidth: number,
  baseHeight: number,
  aspect: CanvasAspect,
): { width: number; height: number } {
  const short = Math.min(baseWidth, baseHeight);
  const ratio = RATIOS[aspect];
  return ratio >= 1
    ? { width: even(short * ratio), height: even(short) }
    : { width: even(short), height: even(short / ratio) };
}

export interface FrameLayout {
  scale: number;
  x: number;
  y: number;
  /** True when the authored frame already is the canvas. */
  identity: boolean;
}

export function frameLayout(
  baseWidth: number,
  baseHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  framing: CanvasFraming,
): FrameLayout {
  if (baseWidth === canvasWidth && baseHeight === canvasHeight)
    return IDENTITY_LAYOUT;
  // Smart framing starts from fit until its camera path is measured.
  const pick = framing === "fill" ? Math.max : Math.min;
  const scale = pick(canvasWidth / baseWidth, canvasHeight / baseHeight);
  return {
    scale,
    x: (canvasWidth - baseWidth * scale) / 2,
    y: (canvasHeight - baseHeight * scale) / 2,
    identity: false,
  };
}

/** The CSS transform that places the authored frame inside the canvas. */
export function frameTransform(layout: FrameLayout): string {
  return layout.identity
    ? ""
    : `translate(${layout.x}px, ${layout.y}px) scale(${layout.scale})`;
}

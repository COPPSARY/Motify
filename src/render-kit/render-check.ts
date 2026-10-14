import type { SceneDefinition } from "../composition/types";
import { mountFilm, type FilmInput, type MountedFilm } from "./mount";

/**
 * Looks at a film the way a viewer would, before it is saved: mounts it with
 * the editor's compiler and runtime, seeks the moments that matter, measures
 * the live DOM and rasterizes frames through the export path. It reports
 * objective faults only (broken, empty, frozen, unreadable), never taste.
 */

export interface RenderCheckInput extends FilmInput {
  /** Objects the brief says carry each cut; each must be visible on both sides. */
  handoffs?: ReadonlyArray<{ object: string; cut: number }>;
  /** Contact sheet width in px. */
  sheetWidth?: number;
}

export interface RenderFault {
  code: string;
  /** A fatal fault blocks saving: the film is broken, not merely weak. */
  fatal: boolean;
  message: string;
  time?: number;
}

export interface RenderCheckResult {
  faults: RenderFault[];
  /** JPEG data URL of up to eight frames with their times, or null. */
  sheet: string | null;
  sheetTimes: number[];
  authoredDuration: number;
  elapsedMs: number;
}

/** Either side of a cut where a seam's start and end are inspected. */
const SEAM_OFFSET = 0.4;
const STILL_STEP = 0.33;
const STILL_LIMIT = 1.5;
/** Share of pixels that must change for a moment to count as motion. */
const MOTION_SHARE = 0.005;
const BLANK_SHARE = 0.004;
const SHEET_FRAMES = 8;
/** The last hold may run this much longer than the limit: a film may end on a still. */
const END_HOLD_ALLOWANCE = 1.8;
const LENGTH_TOLERANCE = 0.25;

export async function renderCheck(
  input: RenderCheckInput,
): Promise<RenderCheckResult> {
  const started = performance.now();
  const faults: RenderFault[] = [];
  const fault = (
    code: string,
    fatal: boolean,
    message: string,
    time?: number,
  ) =>
    faults.push({
      code,
      fatal,
      message,
      ...(time !== undefined ? { time: round(time) } : {}),
    });

  let film: MountedFilm;
  try {
    film = mountFilm(input);
  } catch (error) {
    fault(
      "TIMELINE_THROWS",
      true,
      `buildTimeline threw: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      faults,
      sheet: null,
      sheetTimes: [],
      authoredDuration: 0,
      elapsedMs: performance.now() - started,
    };
  }

  try {
    await document.fonts.ready;
    const width = film.runtime.mountedSize.width;
    const height = film.runtime.mountedSize.height;
    const scenes = [...(input.scenes ?? [])].sort((a, b) => a.start - b.start);
    const cuts = scenes.slice(1).map((scene) => scene.start);
    const authored = film.authoredDuration;

    for (const id of new Set(film.nullRegistrations)) {
      fault(
        "NULL_ELEMENT",
        false,
        `register('${id}') was given no element: the id or selector matches nothing.`,
      );
    }
    if (Math.abs(authored - input.duration) > LENGTH_TOLERANCE) {
      fault(
        "TIMELINE_LENGTH",
        false,
        `The timeline runs ${round(authored)}s but the film is declared ${input.duration}s.`,
      );
    }

    // Scenes at their midpoints: present, visible, holding readable, unclipped,
    // legible text.
    const midpoints = scenes.map((scene) => scene.start + scene.duration / 2);
    const analysisScale = 0.5;
    const midpointFrames = new Map<number, HTMLCanvasElement>();
    for (const [index, scene] of scenes.entries()) {
      const time = midpoints[index]!;
      film.seek(time);
      const section = film.root.querySelector<HTMLElement>(
        `[data-scene="${cssEscape(scene.id)}"]`,
      );
      if (!section) {
        fault(
          "SCENE_MISSING",
          true,
          `Scene ${scene.id} has no data-scene section.`,
          time,
        );
      } else if (!hasVisibleContent(section, film.root, width, height)) {
        fault(
          "SCENE_EMPTY",
          true,
          `Scene ${scene.id} shows nothing at its midpoint (${round(time)}s): it is hidden, transparent or off-canvas.`,
          time,
        );
      }
      const frame = await film.exportFrame(analysisScale);
      midpointFrames.set(time, frame);
      if (isNearBlank(frame))
        fault(
          "BLANK_FRAME",
          true,
          `The frame at ${round(time)}s is blank or nearly blank.`,
          time,
        );
      checkText(film.root, width, height, frame, analysisScale, time, fault);
    }

    // Seams: something moves across each cut, and the handoff object is on
    // screen at both ends of its seam.
    for (const cut of cuts) {
      const before = layout(film, cut - SEAM_OFFSET, width, height);
      const after = layout(film, cut + SEAM_OFFSET, width, height);
      let moved = false;
      let faded = false;
      for (const [node, box] of before) {
        const next = after.get(node);
        if (!next) continue;
        if (
          Math.abs(box.x - next.x) > 4 ||
          Math.abs(box.y - next.y) > 4 ||
          Math.abs(box.w - next.w) > 4 ||
          Math.abs(box.h - next.h) > 4
        )
          moved = true;
        if (Math.abs(box.opacity - next.opacity) > 0.2) faded = true;
      }
      if (!moved && faded) {
        fault(
          "OPACITY_ONLY_CUT",
          false,
          `The cut at ${round(cut)}s only changes opacity: nothing moves across it.`,
          cut,
        );
      }
      film.seek(cut);
      const seamFrame = await film.exportFrame(analysisScale);
      if (isNearBlank(seamFrame))
        fault(
          "BLANK_FRAME",
          true,
          `The seam at ${round(cut)}s passes through a blank frame.`,
          cut,
        );
    }
    for (const handoff of input.handoffs ?? []) {
      const node = film.root.querySelector<HTMLElement>(
        `[data-edit="${cssEscape(handoff.object)}"]`,
      );
      for (const time of [
        handoff.cut - SEAM_OFFSET,
        handoff.cut + SEAM_OFFSET,
      ]) {
        film.seek(time);
        if (!node || !isVisible(node, film.root, width, height)) {
          fault(
            "HANDOFF_HIDDEN",
            false,
            `Handoff object '${handoff.object}' is not visible at ${round(time)}s, so it does not carry the cut at ${round(handoff.cut)}s.`,
            time,
          );
          break;
        }
      }
    }

    // Stillness: no stretch longer than the limit without a visible change.
    // A step changes when enough pixels do, or when any text changes (a
    // counter ticking is motion even though few pixels move). The film's final
    // settle may hold longer, as the editor's own dead-air check allows.
    const stillScale = Math.min(1, 320 / width);
    let previous: { data: ImageData; text: string } | null = null;
    let stillSince: number | null = null;
    for (let time = 0; time <= authored + 1e-6; time += STILL_STEP) {
      film.seek(time);
      const frame = await film.exportFrame(stillScale);
      const current = {
        data: frame
          .getContext("2d")!
          .getImageData(0, 0, frame.width, frame.height),
        text: film.root.textContent ?? "",
      };
      if (previous) {
        const moved =
          changedShare(previous.data, current.data) >= MOTION_SHARE ||
          previous.text !== current.text;
        if (!moved) {
          stillSince ??= time - STILL_STEP;
        } else {
          if (
            stillSince !== null &&
            time - STILL_STEP - stillSince > STILL_LIMIT
          ) {
            fault(
              "STILL_SPAN",
              false,
              `Nothing changes from ${round(stillSince)}s to ${round(time - STILL_STEP)}s.`,
              stillSince,
            );
          }
          stillSince = null;
        }
      }
      previous = current;
    }
    if (
      stillSince !== null &&
      authored - stillSince > STILL_LIMIT * END_HOLD_ALLOWANCE
    ) {
      fault(
        "STILL_SPAN",
        false,
        `Nothing changes from ${round(stillSince)}s to the end at ${round(authored)}s.`,
        stillSince,
      );
    }

    // The contact sheet: scene midpoints first, then the middles of the cuts.
    const sheetTimes = [...midpoints, ...cuts]
      .slice(0, SHEET_FRAMES)
      .sort((a, b) => a - b);
    const sheet = await contactSheet(
      film,
      sheetTimes,
      input.sheetWidth ?? 1280,
      midpointFrames,
    );
    return {
      faults,
      sheet,
      sheetTimes: sheetTimes.map(round),
      authoredDuration: round(authored),
      elapsedMs: Math.round(performance.now() - started),
    };
  } finally {
    film.destroy();
  }
}

// ------------------------------------------------------------------ predicates

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
}

function layout(
  film: MountedFilm,
  time: number,
  width: number,
  height: number,
): Map<Element, Box> {
  film.seek(time);
  const origin = film.root.getBoundingClientRect();
  const boxes = new Map<Element, Box>();
  for (const node of Array.from(
    film.root.querySelectorAll<HTMLElement>("[data-edit], [data-scene]"),
  )) {
    const rect = node.getBoundingClientRect();
    if (rect.width * rect.height < width * height * 0.002) continue;
    boxes.set(node, {
      x: rect.left - origin.left,
      y: rect.top - origin.top,
      w: rect.width,
      h: rect.height,
      opacity: effectiveOpacity(node, film.root),
    });
  }
  return boxes;
}

function effectiveOpacity(node: Element, root: Element): number {
  let opacity = 1;
  for (
    let current: Element | null = node;
    current && current !== root.parentElement;
    current = current.parentElement
  ) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return 0;
    opacity *= Number(style.opacity);
  }
  return opacity;
}

function isVisible(
  node: Element,
  root: HTMLElement,
  width: number,
  height: number,
): boolean {
  if (effectiveOpacity(node, root) < 0.05) return false;
  const origin = root.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const left = rect.left - origin.left;
  const top = rect.top - origin.top;
  return (
    rect.width > 1 &&
    rect.height > 1 &&
    left < width &&
    top < height &&
    left + rect.width > 0 &&
    top + rect.height > 0
  );
}

function hasVisibleContent(
  section: HTMLElement,
  root: HTMLElement,
  width: number,
  height: number,
): boolean {
  if (effectiveOpacity(section, root) < 0.05) return false;
  const candidates = [
    section,
    ...Array.from(section.querySelectorAll<HTMLElement>("*")),
  ];
  return candidates.some((node) => {
    if (!isVisible(node, root, width, height)) return false;
    if (node instanceof HTMLImageElement || node instanceof SVGElement)
      return true;
    if (
      Array.from(node.childNodes).some(
        (child) =>
          child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      )
    )
      return true;
    const style = getComputedStyle(node);
    return (
      style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
      style.backgroundImage !== "none" ||
      style.borderTopWidth !== "0px"
    );
  });
}

type FaultSink = (
  code: string,
  fatal: boolean,
  message: string,
  time?: number,
) => void;

/** Overlapping, clipped or low-contrast text at a scene's midpoint. */
function checkText(
  root: HTMLElement,
  width: number,
  height: number,
  frame: HTMLCanvasElement,
  scale: number,
  time: number,
  fault: FaultSink,
): void {
  const origin = root.getBoundingClientRect();
  const texts: Array<{ node: HTMLElement; box: DOMRect; label: string }> = [];
  for (const node of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    const textNodes = Array.from(node.childNodes).filter(
      (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
    );
    if (textNodes.length === 0 || effectiveOpacity(node, root) < 0.3) continue;
    const range = document.createRange();
    range.setStartBefore(textNodes[0]!);
    range.setEndAfter(textNodes.at(-1)!);
    const rect = range.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const box = new DOMRect(
      rect.left - origin.left,
      rect.top - origin.top,
      rect.width,
      rect.height,
    );
    // Clipped by an ancestor mask on purpose (a rising line still inside its mask) is not on screen.
    if (clippedAway(node, root, rect)) continue;
    texts.push({
      node,
      box,
      label: (node.textContent ?? "").trim().slice(0, 32),
    });
  }
  const reported = new Set<string>();
  for (const text of texts) {
    const { box } = text;
    if (
      box.left < -4 ||
      box.top < -4 ||
      box.right > width + 4 ||
      box.bottom > height + 4
    ) {
      const key = `off:${text.label}`;
      if (!reported.has(key))
        fault(
          "TEXT_OFF_CANVAS",
          false,
          `"${text.label}" runs off the canvas at ${round(time)}s.`,
          time,
        );
      reported.add(key);
    }
  }
  for (let a = 0; a < texts.length; a += 1) {
    for (let b = a + 1; b < texts.length; b += 1) {
      const first = texts[a]!;
      const second = texts[b]!;
      if (first.node.contains(second.node) || second.node.contains(first.node))
        continue;
      const overlap = intersection(first.box, second.box);
      const smaller = Math.min(area(first.box), area(second.box));
      if (smaller > 0 && overlap / smaller > 0.15) {
        fault(
          "TEXT_OVERLAP",
          false,
          `"${first.label}" and "${second.label}" overlap at ${round(time)}s.`,
          time,
        );
      }
    }
  }
  const context = frame.getContext("2d")!;
  for (const text of texts) {
    const style = getComputedStyle(text.node);
    // Only settled text is judged: a word mid-fade or mid-blur is not yet being read.
    if (effectiveOpacity(text.node, root) < 0.9 || blurred(text.node, root))
      continue;
    const ink = parseColor(style.color);
    if (!ink) continue;
    const x = Math.max(0, Math.floor(text.box.left * scale));
    const y = Math.max(0, Math.floor(text.box.top * scale));
    const w = Math.min(frame.width - x, Math.ceil(text.box.width * scale));
    const h = Math.min(frame.height - y, Math.ceil(text.box.height * scale));
    if (w < 2 || h < 2) continue;
    const background = backgroundBehind(
      context.getImageData(x, y, w, h).data,
      ink,
    );
    if (!background) continue;
    const alpha = (ink[3] ?? 1) * effectiveOpacity(text.node, root);
    const shown: [number, number, number] = [0, 1, 2].map(
      (channel) => ink[channel]! * alpha + background[channel]! * (1 - alpha),
    ) as [number, number, number];
    const ratio = contrast(shown, background);
    const size = parseFloat(style.fontSize);
    const bold = Number(style.fontWeight) >= 600;
    // WCAG: 3:1 is enough for large type, 4.5:1 for everything else.
    const needed = size >= 32 || (bold && size >= 24) ? 3 : 4.5;
    if (ratio < needed) {
      fault(
        "LOW_CONTRAST",
        false,
        `"${text.label}" has ${ratio.toFixed(1)}:1 contrast at ${round(time)}s; it needs ${needed}:1.`,
        time,
      );
    }
  }
}

function blurred(node: Element, root: Element): boolean {
  for (
    let current: Element | null = node;
    current && current !== root;
    current = current.parentElement
  ) {
    const filter = getComputedStyle(current).filter;
    if (filter !== "none" && /blur\((?!0px)/.test(filter)) return true;
  }
  return false;
}

function clippedAway(node: Element, root: Element, rect: DOMRect): boolean {
  for (
    let current = node.parentElement;
    current && current !== root;
    current = current.parentElement
  ) {
    const style = getComputedStyle(current);
    if (style.overflow === "visible" && style.clipPath === "none") continue;
    const clip = current.getBoundingClientRect();
    const visible = intersection(rect, clip);
    if (visible < area(rect) * 0.5) return true;
  }
  return false;
}

function changedShare(a: ImageData, b: ImageData): number {
  let changed = 0;
  for (let index = 0; index < a.data.length; index += 4) {
    if (
      Math.abs(a.data[index]! - b.data[index]!) +
        Math.abs(a.data[index + 1]! - b.data[index + 1]!) +
        Math.abs(a.data[index + 2]! - b.data[index + 2]!) >
      36
    )
      changed += 1;
  }
  return changed / (a.data.length / 4);
}

function isNearBlank(frame: HTMLCanvasElement): boolean {
  const data = frame
    .getContext("2d")!
    .getImageData(0, 0, frame.width, frame.height).data;
  const counts = new Map<number, number>();
  for (let index = 0; index < data.length; index += 4) {
    const key =
      ((data[index]! >> 4) << 8) |
      ((data[index + 1]! >> 4) << 4) |
      (data[index + 2]! >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dominant = Math.max(...counts.values());
  return 1 - dominant / (data.length / 4) < BLANK_SHARE;
}

/** The colour behind a text box: the pixels least like the ink. */
function backgroundBehind(
  data: Uint8ClampedArray,
  ink: number[],
): [number, number, number] | null {
  const pixels: Array<{ distance: number; rgb: [number, number, number] }> = [];
  for (let index = 0; index < data.length; index += 4) {
    const rgb: [number, number, number] = [
      data[index]!,
      data[index + 1]!,
      data[index + 2]!,
    ];
    pixels.push({
      distance:
        Math.abs(rgb[0] - ink[0]!) +
        Math.abs(rgb[1] - ink[1]!) +
        Math.abs(rgb[2] - ink[2]!),
      rgb,
    });
  }
  if (pixels.length === 0) return null;
  pixels.sort((a, b) => b.distance - a.distance);
  const far = pixels.slice(0, Math.max(1, Math.floor(pixels.length * 0.4)));
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const pixel of far) {
    red += pixel.rgb[0];
    green += pixel.rgb[1];
    blue += pixel.rgb[2];
  }
  return [red / far.length, green / far.length, blue / far.length];
}

function parseColor(value: string): number[] | null {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (!match) return null;
  const parts = match[1]!
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
}

function luminance(rgb: readonly number[]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: readonly number[], b: readonly number[]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

function intersection(a: DOMRect, b: DOMRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function area(rect: DOMRect): number {
  return rect.width * rect.height;
}

async function contactSheet(
  film: MountedFilm,
  times: number[],
  sheetWidth: number,
  cached: Map<number, HTMLCanvasElement>,
): Promise<string | null> {
  if (times.length === 0) return null;
  const columns = Math.min(4, times.length);
  const rows = Math.ceil(times.length / columns);
  const { width, height } = film.runtime.mountedSize;
  const cellWidth = Math.floor(sheetWidth / columns);
  const cellHeight = Math.round((cellWidth * height) / width);
  const canvas = document.createElement("canvas");
  canvas.width = cellWidth * columns;
  canvas.height = cellHeight * rows;
  const context = canvas.getContext("2d", { alpha: false })!;
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const [index, time] of times.entries()) {
    let frame = cached.get(time);
    if (!frame) {
      film.seek(time);
      frame = await film.exportFrame(0.5);
    }
    const x = (index % columns) * cellWidth;
    const y = Math.floor(index / columns) * cellHeight;
    context.drawImage(frame, x, y, cellWidth, cellHeight);
    context.fillStyle = "rgba(0,0,0,0.65)";
    context.fillRect(x, y, 64, 22);
    context.fillStyle = "#fff";
    context.font = "600 14px Inter, sans-serif";
    context.fillText(`${round(time)}s`, x + 8, y + 16);
  }
  return canvas.toDataURL("image/jpeg", 0.78);
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export type { SceneDefinition };

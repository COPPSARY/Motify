import type { FrameLayout } from "./canvas-frame";
import {
  frameSubjects,
  isAtmosphere,
  isPainted,
  isVisiblyRendered,
  visibleElements,
} from "./frame-subjects";
import { CompositionRuntime, type ReframeTrack } from "./runtime";
import type { CompositionDefinition, RuntimeEditorState } from "./types";

/**
 * Smart framing: a virtual camera that keeps a film's subjects filling a
 * canvas of another shape.
 *
 * A film is authored at fixed pixel positions, so a 16:9 film cannot be
 * re-laid out for 9:16 without rewriting it. What can be done exactly is what
 * "auto reframe" tools approximate with computer vision: find where the
 * subjects are at every moment and move a crop window to keep them in view.
 * Here the subjects come from the live DOM, so their boxes are measured, not
 * guessed. The camera holds steady within a shot, glides between shots with
 * an eased move instead of jumping, ignores cursors and other pointers, never
 * zooms tighter than "fill", and never shows past the film's edge when it can
 * avoid it.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface SubjectSample {
  time: number;
  /** Where the subjects worth keeping in view are, in authored pixels. */
  box: Box | null;
}

export interface Size {
  width: number;
  height: number;
}

/** One measured pose of the camera: the authored point at the canvas centre. */
export interface CameraKey {
  time: number;
  scale: number;
  centerX: number;
  centerY: number;
  /**
   * The first pose of a new shot. The camera does not jump to it: it glides
   * from the old shot to the new one over a short eased move around this time.
   */
  cut?: boolean;
}

/** Seconds between measurements. Motion between them is interpolated. */
export const SAMPLE_INTERVAL = 1 / 6;
/** Room kept between the subjects and the canvas edge, per side. */
const SAFE_MARGIN = 0.08;
/** Half-width of the smoothing window, in seconds. */
const SMOOTHING_SECONDS = 1;
/**
 * Zoom is smoothed over a longer window than position: a camera breathing in
 * and out is far more noticeable than one drifting sideways.
 */
const ZOOM_SMOOTHING_SECONDS = 1.5;
/** How far ahead and behind, in seconds, a shot's framing looks for its subject. */
const ANTICIPATION_SECONDS = 0.4;
/** A shot shorter than this is folded into its neighbour, so the camera does not twitch. */
const MIN_SHOT_SECONDS = 2;
/**
 * How long the camera takes to glide from one shot to the next: short for a
 * small reframe, longer for a move across the film, so it never whips.
 */
const TRANSITION_MIN_SECONDS = 0.9;
const TRANSITION_MAX_SECONDS = 2;
/** Extra glide time per view-width travelled (or per e-fold of zoom). */
const TRANSITION_SECONDS_PER_VIEW = 0.9;
/**
 * A shot is framed once, holding everything its subject does, unless that
 * would leave it wider than this share of the framing its moments want; then
 * the camera follows gently instead. Films move their own camera; a reframe
 * that reacts to every move of it reads as a second, fighting camera.
 */
const LOCKED_SHOT_MIN_ZOOM = 0.75;
/** An empty stretch longer than this eases out to the whole frame. */
const EMPTY_HOLD_SECONDS = 1.2;
/** Movement within a shot smaller than this is held perfectly still. */
const STILL_SHOT_DRIFT = 0.04;
const STILL_SHOT_ZOOM = 1.08;
/** Media smaller than this share of the frame (an icon, a badge) never anchors a shot. */
const MINOR_MEDIA_SHARE = 0.003;
/** Closest the camera goes, relative to the scale that covers the canvas. */
const MAX_ZOOM_OVER_COVER = 1;
/** A subject this far away (share of the film) or this much bigger is a new shot. */
const SHOT_CHANGE_DISTANCE = 0.2;
const SHOT_CHANGE_ZOOM = 1.6;

const boxWidth = (box: Box) => box.right - box.left;
const boxHeight = (box: Box) => box.bottom - box.top;
const union = (first: Box, second: Box): Box => ({
  left: Math.min(first.left, second.left),
  top: Math.min(first.top, second.top),
  right: Math.max(first.right, second.right),
  bottom: Math.max(first.bottom, second.bottom),
});

/** The scale at which `box` fits the canvas inside the safe margin. */
function scaleToFit(box: Box, canvas: Size): number {
  const usable = 1 - SAFE_MARGIN * 2;
  return Math.min(
    (canvas.width * usable) / Math.max(1, boxWidth(box)),
    (canvas.height * usable) / Math.max(1, boxHeight(box)),
  );
}

/**
 * Which subjects to keep in view at one moment.
 *
 * Keeping all of them reproduces "fit" whenever a frame has anything near its
 * edges, such as a sidebar beside the hero card. So the most salient subject
 * anchors the shot and others join it only while the shot can still be at
 * least halfway (geometrically) between fit and fill. What is left out is
 * peripheral by construction; the anchor itself is never cropped.
 */
export interface MeasuredSubject {
  box: Box;
  text: boolean;
  /**
   * Runs past the frame edge (a marquee, a full-bleed headline): it is meant
   * to be cut, so it may be cropped and never anchors the shot.
   */
  bleeds?: boolean;
  /**
   * Small media such as an icon or a badge: kept in view when it sits beside
   * the shot's subject, never the reason for a shot.
   */
  minor?: boolean;
}

export function chooseSubjectBox(
  measured: readonly MeasuredSubject[],
  film: Size,
  canvas: Size,
): Box | null {
  const contained = measured.filter((subject) => !subject.bleeds);
  const candidates = contained.length > 0 ? contained : measured;
  const major = candidates.filter((subject) => !subject.minor);
  if (major.length === 0) return null;
  const minor = candidates.filter((subject) => subject.minor);
  const fit = Math.min(canvas.width / film.width, canvas.height / film.height);
  const cover = Math.max(
    canvas.width / film.width,
    canvas.height / film.height,
  );
  const minScale = Math.sqrt(fit * cover);
  const centreX = film.width / 2;
  const centreY = film.height / 2;
  const reach = Math.hypot(centreX, centreY);
  const salience = ({ box, text }: MeasuredSubject) => {
    const area = Math.sqrt(boxWidth(box) * boxHeight(box));
    const distance = Math.hypot(
      (box.left + box.right) / 2 - centreX,
      (box.top + box.bottom) / 2 - centreY,
    );
    return area * (text ? 2 : 1) * (1 - (distance / reach) * 0.5);
  };
  const ranked = [...major].sort((a, b) => salience(b) - salience(a));
  let chosen = ranked[0]!.box;
  for (const subject of ranked.slice(1)) {
    const candidate = union(chosen, subject.box);
    if (scaleToFit(candidate, canvas) >= minScale) chosen = candidate;
  }
  // An icon beside the subject (a logo mark, a badge) comes along; one
  // elsewhere does not pull the shot wider.
  const area = (box: Box) => boxWidth(box) * boxHeight(box);
  for (const subject of minor) {
    const candidate = union(chosen, subject.box);
    if (area(candidate) <= area(chosen) * 1.25) chosen = candidate;
  }
  return chosen;
}

/** Keeps the view on the film where it can, so the surround rarely shows. */
function clampCentre(
  scale: number,
  centre: number,
  canvasSpan: number,
  filmSpan: number,
): number {
  const view = canvasSpan / scale;
  if (view >= filmSpan) return filmSpan / 2;
  return Math.min(filmSpan - view / 2, Math.max(view / 2, centre));
}

function smooth(
  values: readonly number[],
  radius: number,
  weights: readonly number[],
  shots: readonly number[],
): number[] {
  return values.map((_, index) => {
    let total = 0;
    let weight = 0;
    for (
      let other = Math.max(0, index - radius);
      other <= Math.min(values.length - 1, index + radius);
      other++
    ) {
      // A pan never reaches across a cut.
      if (shots[other] !== shots[index]) continue;
      // A triangular kernel: near samples count more than far ones.
      const kernel = (radius + 1 - Math.abs(other - index)) * weights[other]!;
      total += values[other]! * kernel;
      weight += kernel;
    }
    return weight > 0 ? total / weight : values[index]!;
  });
}

/**
 * Splits the raw poses into shots: a new shot starts where the subject jumps
 * somewhere else. A "shot" shorter than MIN_SHOT_SECONDS is a blip — a card
 * flashing past, a subject briefly lost — and is folded into its neighbour.
 */
function segmentShots(
  rawX: readonly number[],
  rawY: readonly number[],
  rawScale: readonly number[],
  film: Size,
  step: number,
): number[] {
  const changes = (from: number, to: number): boolean =>
    Math.abs(rawX[to]! - rawX[from]!) > film.width * SHOT_CHANGE_DISTANCE ||
    Math.abs(rawY[to]! - rawY[from]!) > film.height * SHOT_CHANGE_DISTANCE ||
    Math.abs(Math.log(rawScale[to]! / rawScale[from]!)) >
      Math.log(SHOT_CHANGE_ZOOM);
  const starts = [0];
  for (let index = 1; index < rawX.length; index++) {
    if (changes(index - 1, index)) starts.push(index);
  }
  const minimum = Math.max(
    1,
    Math.round(MIN_SHOT_SECONDS / Math.max(step, 1e-3)),
  );
  // Fold every shot too short to hold into its neighbours. A blip that comes
  // back to the framing it left disappears entirely; one that leads
  // somewhere new joins the shot before it, so the change happens once.
  for (let changed = true; changed;) {
    changed = false;
    for (let index = 0; index < starts.length; index++) {
      const start = starts[index]!;
      const end = starts[index + 1] ?? rawX.length;
      if (end - start >= minimum || starts.length === 1) continue;
      if (index === 0) {
        starts.splice(1, 1);
      } else if (end < rawX.length && !changes(start - 1, end)) {
        starts.splice(index, 2);
      } else {
        starts.splice(index, 1);
      }
      changed = true;
      break;
    }
  }
  const shots: number[] = [];
  let shot = -1;
  for (let index = 0; index < rawX.length; index++) {
    if (starts[shot + 1] === index) shot++;
    shots.push(shot);
  }
  return shots;
}

/**
 * A shot whose smoothed camera barely moves is held perfectly still. Small
 * drifts that follow an element's entrance read as a wobbly camera.
 */
function holdStillShots(
  shots: readonly number[],
  scale: number[],
  centreX: number[],
  centreY: number[],
  film: Size,
): void {
  for (let start = 0; start < shots.length;) {
    let end = start;
    while (end < shots.length && shots[end] === shots[start]) end++;
    const range = (values: number[]) => {
      const slice = values.slice(start, end);
      return Math.max(...slice) - Math.min(...slice);
    };
    const still =
      range(centreX) < film.width * STILL_SHOT_DRIFT &&
      range(centreY) < film.height * STILL_SHOT_DRIFT &&
      range(scale.map(Math.log)) < Math.log(STILL_SHOT_ZOOM);
    if (still) {
      const mean = (values: number[]) =>
        values.slice(start, end).reduce((sum, value) => sum + value, 0) /
        (end - start);
      const heldScale = Math.exp(mean(scale.map(Math.log)));
      const heldX = mean(centreX);
      const heldY = mean(centreY);
      for (let index = start; index < end; index++) {
        scale[index] = heldScale;
        centreX[index] = heldX;
        centreY[index] = heldY;
      }
    }
    start = end;
  }
}

/**
 * Frames each shot once where it can: one still pose holding every position
 * its subject takes during the shot. Kept only when that pose is not much
 * wider than what the shot's moments ask for (LOCKED_SHOT_MIN_ZOOM).
 */
function lockShots(
  shots: readonly number[],
  boxes: readonly Box[],
  rawScale: readonly number[],
  scale: number[],
  centreX: number[],
  centreY: number[],
  limits: { fit: number; maxScale: number; canvas: Size },
): void {
  for (let start = 0; start < shots.length;) {
    let end = start;
    while (end < shots.length && shots[end] === shots[start]) end++;
    let held = boxes[start]!;
    for (let index = start + 1; index < end; index++)
      held = union(held, boxes[index]!);
    const lockedScale = Math.min(
      limits.maxScale,
      Math.max(limits.fit, scaleToFit(held, limits.canvas)),
    );
    const wanted = rawScale
      .slice(start, end)
      .map(Math.log)
      .sort((a, b) => a - b);
    const typical = Math.exp(wanted[Math.floor(wanted.length / 2)]!);
    if (lockedScale >= typical * LOCKED_SHOT_MIN_ZOOM) {
      for (let index = start; index < end; index++) {
        scale[index] = lockedScale;
        centreX[index] = (held.left + held.right) / 2;
        centreY[index] = (held.top + held.bottom) / 2;
      }
    }
    start = end;
  }
}

/**
 * Turns measured subject boxes into a steady camera path.
 *
 * Each sample asks for the pose that frames its subjects. Where the subject
 * jumps somewhere else — a new beat, a new card — the path starts a new shot,
 * which the track turns into a short eased glide. Within a shot the poses
 * jitter as elements animate, so they are smoothed (scale in log space, so
 * zooming in and out feel symmetrical) and held still when they barely move,
 * then checked again: if smoothing would cut into a subject the camera widens
 * just enough to keep it, and the result is clamped to the film's edges.
 */
export function planCameraPath(
  samples: readonly SubjectSample[],
  film: Size,
  canvas: Size,
): CameraKey[] {
  if (samples.length === 0) return [];
  const fit = Math.min(canvas.width / film.width, canvas.height / film.height);
  const cover = Math.max(
    canvas.width / film.width,
    canvas.height / film.height,
  );
  const maxScale = cover * MAX_ZOOM_OVER_COVER;
  const wholeFrame: Box = {
    left: 0,
    top: 0,
    right: film.width,
    bottom: film.height,
  };

  const step =
    samples.length > 1
      ? (samples.at(-1)!.time - samples[0]!.time) / (samples.length - 1)
      : SAMPLE_INTERVAL;

  // A brief empty moment (a blank seam between two beats) borrows the
  // nearest subjects so the camera does not lurch out and back. A long one
  // has nothing to frame, so it shows the whole film.
  const filled: (Box | null)[] = samples.map((sample) => sample.box);
  for (let start = 0; start < filled.length;) {
    if (filled[start]) {
      start++;
      continue;
    }
    let end = start;
    while (end < filled.length && !filled[end]) end++;
    const long = (end - start) * step >= EMPTY_HOLD_SECONDS;
    const before = start > 0 ? filled[start - 1]! : null;
    const after = end < filled.length ? filled[end]! : null;
    for (let index = start; index < end; index++) {
      filled[index] = long
        ? wholeFrame
        : ((index - start < end - index ? before : after) ?? before ?? after);
    }
    start = end;
  }
  const boxes = filled.map((box) => box ?? wholeFrame);
  const weights = samples.map((sample) => (sample.box ? 1 : 0.25));

  const rawScale = boxes.map((box) =>
    Math.min(maxScale, Math.max(fit, scaleToFit(box, canvas))),
  );
  const rawX = boxes.map((box) => (box.left + box.right) / 2);
  const rawY = boxes.map((box) => (box.top + box.bottom) / 2);

  const shots = segmentShots(rawX, rawY, rawScale, film, step);

  // Within a shot, frame where the subject is over the surrounding moments,
  // not only now: the camera widens or sets off before the subject moves, as
  // an operator anticipating it would, instead of snapping after it.
  const reach = Math.max(
    1,
    Math.round(ANTICIPATION_SECONDS / Math.max(step, 1e-3)),
  );
  const held = boxes.map((box, index) => {
    let around = box;
    for (
      let other = Math.max(0, index - reach);
      other <= Math.min(boxes.length - 1, index + reach);
      other++
    ) {
      if (shots[other] === shots[index]) around = union(around, boxes[other]!);
    }
    return around;
  });
  const heldScale = held.map((box) =>
    Math.min(maxScale, Math.max(fit, scaleToFit(box, canvas))),
  );
  const radius = Math.max(
    1,
    Math.round(SMOOTHING_SECONDS / Math.max(step, 1e-3)),
  );
  const zoomRadius = Math.max(
    1,
    Math.round(ZOOM_SMOOTHING_SECONDS / Math.max(step, 1e-3)),
  );
  const scale = smooth(heldScale.map(Math.log), zoomRadius, weights, shots).map(
    Math.exp,
  );
  const centreX = smooth(
    held.map((box) => (box.left + box.right) / 2),
    radius,
    weights,
    shots,
  );
  const centreY = smooth(
    held.map((box) => (box.top + box.bottom) / 2),
    radius,
    weights,
    shots,
  );
  holdStillShots(shots, scale, centreX, centreY, film);
  lockShots(shots, boxes, rawScale, scale, centreX, centreY, {
    fit,
    maxScale,
    canvas,
  });

  // No per-moment correction afterwards: snapping the camera to a subject
  // the smoothed path lags behind is exactly the jerk this path avoids. The
  // anticipation window and the safe margin keep subjects in view instead.
  return samples.map((sample, index) => {
    const poseScale = Math.min(maxScale, Math.max(fit, scale[index]!));
    const x = centreX[index]!;
    const y = centreY[index]!;
    return {
      time: sample.time,
      scale: poseScale,
      centerX: clampCentre(poseScale, x, canvas.width, film.width),
      centerY: clampCentre(poseScale, y, canvas.height, film.height),
      ...(index > 0 && shots[index] !== shots[index - 1] ? { cut: true } : {}),
    };
  });
}

export function layoutForKey(key: CameraKey, canvas: Size): FrameLayout {
  return {
    scale: key.scale,
    x: canvas.width / 2 - key.centerX * key.scale,
    y: canvas.height / 2 - key.centerY * key.scale,
    identity: false,
  };
}

/** Gentle at both ends, and its fastest moment is only ~1.6x its average. */
const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

function blendKeys(from: CameraKey, to: CameraKey, t: number): CameraKey {
  return {
    time: from.time + (to.time - from.time) * t,
    scale: Math.exp(
      Math.log(from.scale) + (Math.log(to.scale) - Math.log(from.scale)) * t,
    ),
    centerX: from.centerX + (to.centerX - from.centerX) * t,
    centerY: from.centerY + (to.centerY - from.centerY) * t,
  };
}

/**
 * A camera path that can be read at any time, between its measurements.
 *
 * Within a shot the pose is interpolated between measurements. Around each
 * shot change the camera glides, centred on the change: it eases in and out
 * from where the old shot was to where the new one settles, taking longer the
 * further it travels, so a new subject is arrived at, never jumped to.
 */
export function trackFromKeys(
  keys: readonly CameraKey[],
  canvas: Size,
): ReframeTrack {
  /** The path with shot changes as instant switches. */
  const stepped = (time: number): CameraKey => {
    if (time <= keys[0]!.time) return keys[0]!;
    if (time >= keys.at(-1)!.time) return keys.at(-1)!;
    let low = 0;
    let high = keys.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (keys[middle]!.time <= time) low = middle;
      else high = middle;
    }
    const from = keys[low]!;
    const to = keys[high]!;
    if (to.cut) return from;
    return blendKeys(
      from,
      to,
      (time - from.time) / Math.max(1e-6, to.time - from.time),
    );
  };

  const cutIndices = keys.flatMap((key, index) => (key.cut ? [index] : []));
  const changes = cutIndices.map((index) => keys[index]!.time);
  const glides = cutIndices.map((cutIndex, index) => {
    const before = keys[cutIndex - 1]!;
    const after = keys[cutIndex]!;
    // Distance in views of the outgoing shot, plus how far the zoom changes.
    const travel =
      Math.abs(after.centerX - before.centerX) / (canvas.width / before.scale) +
      Math.abs(after.centerY - before.centerY) /
        (canvas.height / before.scale) +
      Math.abs(Math.log(after.scale / before.scale));
    const wanted = Math.min(
      TRANSITION_MAX_SECONDS,
      TRANSITION_MIN_SECONDS + travel * TRANSITION_SECONDS_PER_VIEW,
    );
    const time = changes[index]!;
    const room = Math.min(
      wanted,
      index > 0 ? time - changes[index - 1]! : Infinity,
      index < changes.length - 1 ? changes[index + 1]! - time : Infinity,
    );
    return { start: time - room / 2, end: time + room / 2 };
  });

  return {
    at(time: number): FrameLayout {
      if (keys.length === 0) {
        return { scale: 1, x: 0, y: 0, identity: false };
      }
      const glide = glides.find(({ start, end }) => time > start && time < end);
      if (glide) {
        const from = stepped(glide.start);
        const to = stepped(glide.end);
        const t = (time - glide.start) / (glide.end - glide.start);
        return layoutForKey(blendKeys(from, to, easeInOutSine(t)), canvas);
      }
      return layoutForKey(stepped(time), canvas);
    },
  };
}

/** Share of the frame a subject may stick out by before it counts as bleeding. */
const BLEED_TOLERANCE = 0.04;

/**
 * Whether anything a viewer sees is painted over `element` at this point.
 * Transparent wrappers and atmosphere (glows, vignettes) do not count.
 */
function paintsOver(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (["IMG", "VIDEO", "CANVAS"].includes(element.tagName)) return true;
  if (isAtmosphere(element)) return false;
  const style = getComputedStyle(element);
  if (Number(style.opacity || "1") < 0.5) return false;
  if (isPainted(style)) return true;
  return Array.from(element.childNodes).some(
    (node) =>
      node.nodeType === Node.TEXT_NODE &&
      (node.textContent ?? "").trim().length > 0,
  );
}

/**
 * Whether `element` is actually on top somewhere inside `rect`: not covered
 * by a later scene's ground, not clipped away by a reveal mask or an
 * overflow-hidden line. Asked of the browser's own hit testing, which already
 * knows stacking, clipping and transforms.
 */
function showsThrough(
  element: HTMLElement,
  root: HTMLElement,
  rect: Box,
): boolean {
  if (typeof document.elementsFromPoint !== "function") return true;
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  const points = [
    [0.5, 0.5],
    [0.25, 0.3],
    [0.75, 0.3],
    [0.25, 0.7],
    [0.75, 0.7],
  ] as const;
  for (const [fx, fy] of points) {
    const stack = document.elementsFromPoint(
      rect.left + width * fx,
      rect.top + height * fy,
    );
    for (const hit of stack) {
      if (!root.contains(hit) || hit === root) continue;
      if (hit === element || element.contains(hit)) return true;
      if (hit.contains(element)) continue;
      if (paintsOver(hit)) break;
    }
  }
  return false;
}

const POINTER_HINT = /cursor|pointer|caret|mouse/i;

/**
 * A mouse pointer or caret drawn into the film. It moves constantly and is
 * never what a shot is about, so the camera does not follow it.
 */
function isPointerGraphic(element: Element, root: HTMLElement): boolean {
  for (
    let current: Element | null = element;
    current && current !== root;
    current = current.parentElement
  ) {
    const name = `${current.getAttribute("class") ?? ""} ${
      current.getAttribute("data-edit") ?? ""
    } ${current.id}`;
    if (POINTER_HINT.test(name)) return true;
    if (current instanceof HTMLImageElement && POINTER_HINT.test(current.src))
      return true;
  }
  return false;
}

/** Text smaller than this (on-screen pixels) is texture, not something to frame. */
const MIN_TEXT_HEIGHT = 6;

/**
 * The element a run of text reads as part of: its nearest block-level
 * container. Films split headlines into per-word and per-letter spans for
 * animation; grouping by block puts "M-o-t-i-f-y" back together as one word.
 */
function textBlock(element: HTMLElement, root: HTMLElement): HTMLElement {
  for (
    let current: HTMLElement | null = element;
    current && current !== root;
    current = current.parentElement
  ) {
    if (!getComputedStyle(current).display.startsWith("inline")) return current;
  }
  return element;
}

/**
 * The subjects visible on a mounted root, in the film's own pixels: painted
 * shapes and images, plus every block of text that is actually on top.
 *
 * `film` is the root's untransformed size, so the root may be scaled down to
 * sit inside the viewport, where hit testing works.
 */
export function measureSubjects(
  root: HTMLElement,
  film: Size = { width: root.offsetWidth, height: root.offsetHeight },
): MeasuredSubject[] {
  const rootRect = root.getBoundingClientRect();
  const ratio = film.width / Math.max(1, rootRect.width);
  const canvasArea = Math.max(1, rootRect.width * rootRect.height);
  const slackX = rootRect.width * BLEED_TOLERANCE;
  const slackY = rootRect.height * BLEED_TOLERANCE;
  const measured: MeasuredSubject[] = [];

  const add = (rect: Box, text: boolean, minor = false): void => {
    const onScreen: Box = {
      left: Math.max(rootRect.left, rect.left),
      top: Math.max(rootRect.top, rect.top),
      right: Math.min(rootRect.right, rect.right),
      bottom: Math.min(rootRect.bottom, rect.bottom),
    };
    if (
      onScreen.right - onScreen.left < 2 ||
      onScreen.bottom - onScreen.top < 2
    )
      return;
    measured.push({
      box: {
        left: (onScreen.left - rootRect.left) * ratio,
        top: (onScreen.top - rootRect.top) * ratio,
        right: (onScreen.right - rootRect.left) * ratio,
        bottom: (onScreen.bottom - rootRect.top) * ratio,
      },
      text,
      ...(minor ? { minor: true } : {}),
      bleeds:
        rect.left < rootRect.left - slackX ||
        rect.right > rootRect.right + slackX ||
        rect.top < rootRect.top - slackY ||
        rect.bottom > rootRect.bottom + slackY,
    });
  };
  const clip = (rect: Box): Box => ({
    left: Math.max(rootRect.left, rect.left),
    top: Math.max(rootRect.top, rect.top),
    right: Math.min(rootRect.right, rect.right),
    bottom: Math.min(rootRect.bottom, rect.bottom),
  });

  // Cards, panels and other painted shapes: the card is what must stay in
  // frame, not only the words on it. Unpainted text holders are left to the
  // text pass below.
  const elements = visibleElements(root, rootRect, true);
  for (const element of frameSubjects(elements, canvasArea)) {
    if (!isPainted(getComputedStyle(element))) continue;
    if (isPointerGraphic(element, root)) continue;
    const rect = element.getBoundingClientRect();
    const onScreen = clip(rect);
    if (
      onScreen.right - onScreen.left < 2 ||
      onScreen.bottom - onScreen.top < 2
    )
      continue;
    if (showsThrough(element, root, onScreen)) add(rect, false);
  }

  // Images, icons and logos. Inline SVG reports a lowercase tag name, so it is
  // matched here rather than by tag comparison.
  for (const media of root.querySelectorAll<HTMLElement>(
    "img, video, canvas, svg",
  )) {
    if (media.parentElement?.closest("svg")) continue;
    if (isPointerGraphic(media, root)) continue;
    if (!isVisiblyRendered(media, root)) continue;
    const rect = media.getBoundingClientRect();
    const share = (rect.width * rect.height) / canvasArea;
    if (share < 0.0005 || share > 0.6) continue;
    const onScreen = clip(rect);
    if (
      onScreen.right - onScreen.left < 2 ||
      onScreen.bottom - onScreen.top < 2
    )
      continue;
    if (showsThrough(media, root, onScreen))
      add(rect, false, share < MINOR_MEDIA_SHARE);
  }

  // Text, run by run, grouped into the blocks it reads as.
  const visible = new Map<HTMLElement, boolean>();
  const blocks = new Map<HTMLElement, Box>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node.textContent ?? "").trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest("style, script, template")) continue;
    let shown = visible.get(parent);
    if (shown === undefined) {
      shown = isVisiblyRendered(parent, root);
      visible.set(parent, shown);
    }
    if (!shown) continue;
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (rect.height < MIN_TEXT_HEIGHT || rect.width < 2) continue;
    const onScreen = clip(rect);
    if (
      onScreen.right - onScreen.left < 2 ||
      onScreen.bottom - onScreen.top < 2
    )
      continue;
    if (!showsThrough(parent, root, onScreen)) continue;
    const block = textBlock(parent, root);
    const run: Box = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };
    const existing = blocks.get(block);
    blocks.set(block, existing ? union(existing, run) : run);
  }
  for (const box of blocks.values()) add(box, true);
  return measured;
}

function nextIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 120 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

async function imagesSettled(root: HTMLElement): Promise<void> {
  const pending = Array.from(root.querySelectorAll("img"))
    .filter((image) => !image.complete)
    .map((image) => image.decode().catch(() => undefined));
  if (pending.length === 0) return;
  await Promise.race([
    Promise.all(pending),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
}

/**
 * Measures a film on a hidden copy and plans its camera for `canvas`.
 *
 * The copy has the editor's overrides applied, so a nudged element is framed
 * where the user put it. Work is spread over idle callbacks; `signal` stops it
 * when the film, the edits or the canvas change first.
 */
export async function analyzeReframe(options: {
  definition: CompositionDefinition;
  editorState?: RuntimeEditorState;
  canvas: Size;
  signal?: AbortSignal;
  /** Measurements taken per idle slice. */
  batch?: number;
}): Promise<ReframeTrack> {
  const { definition, canvas, signal } = options;
  const film = { width: definition.width, height: definition.height };
  // Hit testing only reaches what is inside the viewport, so the probe copy
  // is scaled to fit it, transparent, and stacked under the page.
  const fitViewport = Math.min(
    1,
    (window.innerWidth || film.width) / film.width,
    (window.innerHeight || film.height) / film.height,
  );
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset["reframeProbe"] = "";
  host.style.cssText = `position:fixed;left:0;top:0;width:${film.width}px;height:${film.height}px;opacity:0;z-index:-2147483647;transform:scale(${fitViewport * 0.98});transform-origin:0 0;overflow:hidden;contain:layout paint`;
  // Films often switch hit testing off on layers; here it is the measurement.
  const probeStyle = document.createElement("style");
  probeStyle.textContent =
    "[data-reframe-probe] * { pointer-events: auto !important; }";
  const root = document.createElement("div");
  root.style.cssText = `position:absolute;left:0;top:0;width:${film.width}px;height:${film.height}px`;
  host.append(probeStyle, root);
  document.body.append(host);
  let runtime: CompositionRuntime | null = null;
  try {
    runtime = new CompositionRuntime(definition, root);
    // Element edits only; the canvas of the copy stays authored.
    runtime.importEditorState({
      elements: options.editorState?.elements ?? {},
      animations: options.editorState?.animations ?? {},
      tweens: options.editorState?.tweens ?? {},
    });
    await imagesSettled(root);
    const duration = Math.max(
      definition.duration,
      Number.isFinite(runtime.timeline.duration())
        ? runtime.timeline.duration()
        : 0,
    );
    const count = Math.max(2, Math.ceil(duration / SAMPLE_INTERVAL) + 1);
    const batch = options.batch ?? 12;
    const samples: SubjectSample[] = [];
    for (let index = 0; index < count; index++) {
      if (index % batch === 0) {
        await nextIdle();
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      }
      const time = Math.min(duration, index * SAMPLE_INTERVAL);
      runtime.seek(time);
      samples.push({
        time,
        box: chooseSubjectBox(measureSubjects(root, film), film, canvas),
      });
    }
    return trackFromKeys(planCameraPath(samples, film, canvas), canvas);
  } finally {
    runtime?.destroy();
    host.remove();
  }
}

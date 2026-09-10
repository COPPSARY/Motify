import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);

/**
 * The film's ease vocabulary.
 *
 * GSAP's stock curves top out at a narrow dynamic range: `power2.inOut` moves
 * at only 3x its mean velocity at the fastest point, and `sine.inOut` at 1.57.
 * Stretched over the two-to-five second travels a film is actually built from,
 * that reads as constant velocity — the middle of the move has no ramp in it.
 *
 * These are registered `CustomEase` curves with the range a time ramp needs.
 * Each is annotated with its peak-to-mean velocity ratio (linear = 1.00) and,
 * for the arrival curves, how much distance it covers in the first 20% of its
 * duration — `expo.out` covers 93% there, which is why an oversized entrance
 * built on it is gone before it can be read.
 *
 * Pick by what the motion *is*, not by how long it lasts:
 *
 * - `EASE.cameraRamp` — a camera or world travelling a long way. Holds, blasts
 *   through the middle, settles. Use for lateral tracks and z-flies.
 * - `EASE.travel` — an object crossing the frame under its own direction.
 * - `EASE.material` — a carrier's own outline changing. Weighted, not snappy.
 * - `EASE.arrive` — something landing in place. Fast off the mark, long tail,
 *   but still legible at the start.
 * - `EASE.depart` — something accelerating out of frame. Peaks at the exit.
 * - `EASE.settle` — an oversized element pulling back to rest.
 *
 * Ambient drift and breathing loops stay on `sine.inOut`, and a constant-rate
 * readout — an audio playhead, a progress bar — stays on `none`. Neither is a
 * directed move, so neither wants a ramp.
 */
export const EASE = {
  /** peak 5.90x, 3% covered by 20% — a true hold-blast-settle ramp. */
  cameraRamp: CustomEase.create("motionlyCameraRamp", "M0,0 C0.8,0 0.14,1 1,1"),
  /** peak 3.82x, front-loaded ramp for directed object travel. */
  travel: CustomEase.create("motionlyTravel", "M0,0 C0.62,0 0.16,1 1,1"),
  /** peak 3.75x, slightly heavier through the middle than `travel`. */
  material: CustomEase.create("motionlyMaterial", "M0,0 C0.66,0 0.2,1 1,1"),
  /** peak 5.25x at t=0, 72% covered by 20% — punchier than `power2.out`
   *  (49%) without `expo.out`'s two-frame collapse. */
  arrive: CustomEase.create("motionlyArrive", "M0,0 C0.16,0.84 0.22,1 1,1"),
  /** peak 8.68x at t=1 — accelerates all the way out. */
  depart: CustomEase.create("motionlyDepart", "M0,0 C0.55,0 0.92,0.3 1,1"),
  /** peak 6.00x at t=0, 73% covered by 20% — for giant-to-settle pullbacks. */
  settle: CustomEase.create("motionlySettle", "M0,0 C0.12,0.72 0.16,1 1,1"),
} as const;

export interface MotionOptions {
  at?: gsap.Position;
  duration?: number;
  ease?: string;
}

export interface SlideOptions extends MotionOptions {
  direction?: "up" | "right" | "down" | "left";
  distance?: number;
}

export interface StaggerOptions extends SlideOptions {
  stagger?: number;
}

export interface SceneHandoffOptions extends MotionOptions {
  direction?: "up" | "right" | "down" | "left";
  distance?: number;
}

export interface CameraZoomPanOptions extends MotionOptions {
  startScale?: number;
  endScale?: number;
  startX?: number;
  endX?: number;
  startY?: number;
  endY?: number;
}

export interface WaveOptions extends MotionOptions {
  totalDuration?: number;
  yOffset?: number;
  scaleXOffset?: number;
}

export interface GiantCropOptions extends MotionOptions {
  startScale?: number;
  endScale?: number;
  panX?: number;
  unit?: "words" | "chars";
  stagger?: number;
  settleEase?: string;
  xPercent?: number;
  yPercent?: number;
}

export interface EditorialTextOptions extends MotionOptions {
  stagger?: number;
  distance?: number;
  blur?: number;
}

export interface WaterfallTextOptions extends MotionOptions {
  startScale?: number;
  endScale?: number;
  panX?: number;
  startX?: number;
  startY?: number;
  rotateX?: number;
  rotateY?: number;
  stagger?: number;
  xPercent?: number;
  yPercent?: number;
}

export interface SquashStretchOptions extends MotionOptions {
  factor?: number;
  direction?: "horizontal" | "vertical";
}

export interface AnticipateOptions extends MotionOptions {
  distance?: number;
  direction?: "left" | "right" | "up" | "down";
  scale?: number;
}

export interface MotionArcOptions extends MotionOptions {
  startX?: number;
  startY?: number;
  endX: number;
  endY: number;
  arcHeight?: number;
}

export interface ImpactShakeOptions extends MotionOptions {
  intensity?: number;
  rotational?: boolean;
}

export interface ErrorWobbleOptions extends MotionOptions {
  distance?: number;
  angle?: number;
}

export interface AmbientBreathingOptions extends MotionOptions {
  minScale?: number;
  maxScale?: number;
  yDrift?: number;
  repeat?: number;
}

export interface AmbientFloatOptions extends MotionOptions {
  distance?: number;
  rotation?: number;
  repeat?: number;
}

export interface StepSurgeCounterOptions extends MotionOptions {
  start?: number;
  surgeTarget?: number;
  end: number;
  suffix?: string;
  prefix?: string;
  pauseDuration?: number;
}

export interface PerspectiveCardOptions extends MotionOptions {
  rotateX?: number;
  rotateY?: number;
  z?: number;
  perspective?: number;
}

export interface MatchCutOptions extends MotionOptions {
  scale?: number;
}

export interface MaskRevealOptions extends MotionOptions {
  shape?: "rectangle" | "circle";
  direction?: "left" | "right" | "up" | "down" | "center";
}

export interface PunchInOptions extends MotionOptions {
  scale?: number;
  origin?: string;
  holdDuration?: number;
  returnToNormal?: boolean;
}

export interface CaptionPopOptions extends MotionOptions {
  activeColor?: string;
  normalColor?: string;
  distance?: number;
}

export interface CutTheCurveOptions extends MotionOptions {
  outgoing: Target;
  incoming: Target;
  direction?: "left" | "right" | "up" | "down";
  distance?: number;
  blur?: number;
}

export interface ZoomThroughOptions extends MotionOptions {
  outgoing: Target;
  incoming: Target;
  scaleExit?: number;
  scaleEntry?: number;
  blur?: number;
}

export interface InverseZoomThroughOptions extends MotionOptions {
  outgoing: Target;
  incoming: Target;
  scaleExit?: number;
  scaleEntry?: number;
  blur?: number;
}

type Target = gsap.TweenTarget;

export function reveal(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { autoAlpha: 0, y: 18 },
    {
      autoAlpha: 1,
      y: 0,
      duration: options.duration ?? 0.55,
      ease: options.ease ?? "power3.out",
    },
    options.at,
  );
}

export function slide(
  timeline: gsap.core.Timeline,
  target: Target,
  options: SlideOptions = {},
): gsap.core.Timeline {
  const distance = options.distance ?? 56;
  const from = {
    x:
      options.direction === "left"
        ? distance
        : options.direction === "right"
          ? -distance
          : 0,
    y:
      options.direction === "down"
        ? -distance
        : options.direction === "up"
          ? distance
          : 0,
    autoAlpha: 0,
  };
  return timeline.fromTo(
    target,
    from,
    {
      x: 0,
      y: 0,
      autoAlpha: 1,
      duration: options.duration ?? 0.68,
      ease: options.ease ?? "power4.out",
    },
    options.at,
  );
}

export function scalePop(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { scale: 0.82, autoAlpha: 0 },
    {
      scale: 1,
      autoAlpha: 1,
      duration: options.duration ?? 0.62,
      ease: options.ease ?? "back.out(1.35)",
    },
    options.at,
  );
}

export function spring(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { y: 70, scale: 0.92 },
    {
      y: 0,
      scale: 1,
      duration: options.duration ?? 0.85,
      ease: options.ease ?? "elastic.out(1, .72)",
    },
    options.at,
  );
}

export function blurReveal(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { filter: "blur(18px)", autoAlpha: 0, y: 24 },
    {
      filter: "blur(0px)",
      autoAlpha: 1,
      y: 0,
      duration: options.duration ?? 0.72,
      ease: options.ease ?? "power3.out",
    },
    options.at,
  );
}

export function maskWipe(
  timeline: gsap.core.Timeline,
  target: Target,
  options: SlideOptions = {},
): gsap.core.Timeline {
  const direction = options.direction ?? "right";
  const hidden =
    direction === "left"
      ? "inset(0 0 0 100%)"
      : direction === "up"
        ? "inset(100% 0 0)"
        : direction === "down"
          ? "inset(0 0 100%)"
          : "inset(0 100% 0 0)";
  return timeline.fromTo(
    target,
    { clipPath: hidden },
    {
      clipPath: "inset(0 0 0 0)",
      duration: options.duration ?? 0.78,
      ease: options.ease ?? "expo.out",
    },
    options.at,
  );
}

export function gradientSweep(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions & { fromPosition?: string; toPosition?: string } = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { backgroundPosition: options.fromPosition ?? "200% 0" },
    {
      backgroundPosition: options.toPosition ?? "0% 0",
      duration: options.duration ?? 1.4,
      ease: options.ease ?? "power2.inOut",
    },
    options.at,
  );
}

export function continuousTextGradient(
  element: HTMLElement,
  gradient = "linear-gradient(96deg, #111318 0%, #7657ff 42%, #c753ff 62%, #111318 100%)",
): HTMLElement[] {
  const words = splitText(element, "words").filter((word) =>
    Boolean(word.textContent?.trim()),
  );
  const elementRect = element.getBoundingClientRect();
  const gradientWidth = Math.max(1, element.scrollWidth);
  const layoutRatio = gradientWidth / Math.max(1, elementRect.width);
  words.forEach((word) => {
    const offset =
      (elementRect.left - word.getBoundingClientRect().left) * layoutRatio;
    word.style.backgroundImage = gradient;
    word.style.backgroundRepeat = "no-repeat";
    word.style.backgroundSize = `${gradientWidth}px 100%`;
    word.style.backgroundPosition = `${offset}px 0`;
    word.style.backgroundClip = "text";
    word.style.webkitBackgroundClip = "text";
    word.style.webkitTextFillColor = "transparent";
  });

  return words;
}

export function rotateReveal(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { rotation: -7, scale: 0.78, autoAlpha: 0 },
    {
      rotation: 0,
      scale: 1,
      autoAlpha: 1,
      duration: options.duration ?? 0.7,
      ease: options.ease ?? "power4.out",
    },
    options.at,
  );
}

export function staggerEntrance(
  timeline: gsap.core.Timeline,
  targets: Target,
  options: StaggerOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    targets,
    { y: options.distance ?? 52, autoAlpha: 0, scale: 0.96 },
    {
      y: 0,
      autoAlpha: 1,
      scale: 1,
      duration: options.duration ?? 0.58,
      stagger: options.stagger ?? 0.09,
      ease: options.ease ?? "power4.out",
    },
    options.at,
  );
}

export function staggerExit(
  timeline: gsap.core.Timeline,
  targets: Target,
  options: StaggerOptions = {},
): gsap.core.Timeline {
  return timeline.to(
    targets,
    {
      y: -(options.distance ?? 34),
      autoAlpha: 0,
      duration: options.duration ?? 0.42,
      stagger: options.stagger ?? 0.055,
      ease: options.ease ?? "power3.in",
    },
    options.at,
  );
}

export function cameraPush(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions & { scale?: number; x?: number; y?: number } = {},
): gsap.core.Timeline {
  if (!target) return timeline;
  return timeline.to(
    target,
    {
      scale: options.scale ?? 1.18,
      x: options.x ?? 0,
      y: options.y ?? 0,
      duration: options.duration ?? 1.35,
      ease: options.ease ?? "power3.inOut",
    },
    options.at,
  );
}

export function cameraPull(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions & { scale?: number; x?: number; y?: number } = {},
): gsap.core.Timeline {
  if (!target) return timeline;
  return timeline.to(
    target,
    {
      scale: options.scale ?? 1,
      x: options.x ?? 0,
      y: options.y ?? 0,
      duration: options.duration ?? 1.25,
      ease: options.ease ?? "power3.inOut",
    },
    options.at,
  );
}

export function cameraZoomPan(
  timeline: gsap.core.Timeline,
  target: Target,
  options: CameraZoomPanOptions = {},
): gsap.core.Timeline {
  if (!target) return timeline;
  return timeline.fromTo(
    target,
    {
      scale: options.startScale ?? 2.6,
      x: options.startX ?? 0,
      y: options.startY ?? 0,
      filter: "blur(12px)",
      autoAlpha: 0,
    },
    {
      scale: options.endScale ?? 1.0,
      x: options.endX ?? 0,
      y: options.endY ?? 0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: options.duration ?? 0.95,
      ease: options.ease ?? "power3.out",
    },
    options.at,
  );
}

function resolveCentering(
  element: HTMLElement | null | undefined,
  explicitXPercent?: number,
  explicitYPercent?: number,
): { xPercent?: number; yPercent?: number } {
  if (!element) return {};
  // Layout belongs to authored CSS. Inferring centering from class names or a
  // pre-existing transform makes GSAP replace the wrapper transform and can
  // collapse an otherwise centered sentence against the edge of the stage.
  return {
    ...(explicitXPercent !== undefined ? { xPercent: explicitXPercent } : {}),
    ...(explicitYPercent !== undefined ? { yPercent: explicitYPercent } : {}),
  };
}

function ensureTextMotionLayer(element: HTMLElement): HTMLElement {
  const existing = Array.from(element.children).find((child) =>
    child.classList.contains("motionly-text-motion-layer"),
  ) as HTMLElement | undefined;
  if (existing) return existing;

  const layer = document.createElement("span");
  layer.className = "motionly-text-motion-layer";
  layer.style.display = "inline-block";
  layer.style.maxWidth = "100%";
  layer.style.transformOrigin = "50% 55%";
  layer.style.willChange = "transform, opacity, filter";
  layer.append(...Array.from(element.childNodes));
  element.append(layer);
  return layer;
}

/** Words resolve onto their final baseline without zooming or bouncing the
 * sentence. Layout and accent markup stay authored; all motion is seekable. */
export function editorialTextReveal(
  timeline: gsap.core.Timeline,
  element: HTMLElement | null | undefined,
  options: EditorialTextOptions = {},
): HTMLElement[] {
  if (!element) return [];
  const layer = ensureTextMotionLayer(element);
  const words = splitText(layer, "words").filter((word) =>
    Boolean(word.textContent?.trim()),
  );
  const duration = options.duration ?? 0.48;
  const stagger = options.stagger ?? 0.085;
  // A label resolves numeric and named GSAP positions identically for both
  // tracks. Focus finishes before translation, avoiding a smeared reading hold.
  const anchor = `editorial-reveal-${timeline.getChildren().length}`;
  timeline.addLabel(anchor, options.at);
  timeline.set(element, { autoAlpha: 1 }, anchor);
  timeline.fromTo(
    words,
    { y: options.distance ?? 18, autoAlpha: 0 },
    {
      y: 0,
      autoAlpha: 1,
      duration,
      stagger,
      ease: options.ease ?? "power3.out",
    },
    anchor,
  );
  timeline.fromTo(
    words,
    { filter: `blur(${options.blur ?? 5}px)` },
    {
      filter: "blur(0px)",
      duration: duration * 0.55,
      stagger,
      ease: "power3.out",
    },
    anchor,
  );
  return words;
}

export function giantKineticCrop(
  timeline: gsap.core.Timeline,
  element: HTMLElement | null | undefined,
  options: GiantCropOptions = {},
): HTMLElement[] {
  if (!element) return [];
  const motionLayer = ensureTextMotionLayer(element);
  const pieces = splitText(motionLayer, options.unit ?? "words").filter(
    (piece) => Boolean(piece.textContent?.trim()),
  );
  const startScale = options.startScale ?? 2.8;
  const endScale = options.endScale ?? 1.0;
  const duration = options.duration ?? 0.88;
  const centering = resolveCentering(
    element,
    options.xPercent,
    options.yPercent,
  );

  // Keep the sentence wrapper fixed in its authored layout. The visual zoom
  // happens on a dedicated inner layer, so centered text cannot be pushed or
  // clipped when the timeline is scrubbed or an editor override is applied.
  timeline.set(
    element,
    { autoAlpha: 1, perspective: 1200, ...centering },
    options.at,
  );
  timeline.fromTo(
    motionLayer,
    {
      scale: startScale,
      x: options.panX ?? 0,
      autoAlpha: 0,
    },
    {
      scale: endScale,
      x: 0,
      autoAlpha: 1,
      duration,
      ease: options.ease ?? "power3.out",
    },
    options.at,
  );

  timeline.fromTo(
    motionLayer,
    { filter: "blur(8px)" },
    { filter: "blur(0px)", duration: duration * 0.45, ease: "power3.out" },
    options.at,
  );
  pieces.forEach((piece, i) => {
    timeline.fromTo(
      piece,
      {
        y: 18,
        autoAlpha: 0,
        transformOrigin: "50% 65%",
      },
      {
        y: 0,
        autoAlpha: 1,
        duration: duration * 0.72,
        ease: options.settleEase ?? "back.out(1.35)",
      },
      ((options.at as number) ?? 0) + i * (options.stagger ?? 0.045),
    );
  });

  return pieces;
}

export function waterfallTextReveal(
  timeline: gsap.core.Timeline,
  element: HTMLElement | null | undefined,
  options: WaterfallTextOptions = {},
): HTMLElement[] {
  if (!element) return [];
  const motionLayer = ensureTextMotionLayer(element);
  const words = splitText(motionLayer, "words").filter((word) =>
    Boolean(word.textContent?.trim()),
  );
  const at = typeof options.at === "number" ? options.at : 0;
  const duration = options.duration ?? 0.55;
  const stagger = options.stagger ?? 0.055;
  const centering = resolveCentering(
    element,
    options.xPercent,
    options.yPercent,
  );

  timeline.set(words, { autoAlpha: 0 }, 0);
  timeline.set(element, { autoAlpha: 1, perspective: 1200, ...centering }, at);
  timeline.fromTo(
    motionLayer,
    {
      scale: options.startScale ?? 2.2,
      x: options.panX ?? 0,
    },
    {
      scale: options.endScale ?? 1,
      x: 0,
      duration: duration + words.length * stagger,
      ease: "expo.out",
    },
    at,
  );

  words.forEach((word, index) => {
    const wordAt = at + index * stagger;
    timeline.fromTo(
      word,
      {
        autoAlpha: 0,
        x: options.startX ?? 0,
        y: options.startY ?? 44,
        rotateX: options.rotateX ?? 0,
        rotateY: options.rotateY ?? 0,
        transformOrigin: "50% 70%",
      },
      {
        autoAlpha: 1,
        x: 0,
        y: 0,
        rotateX: 0,
        rotateY: 0,
        duration,
        ease: options.ease ?? "back.out(1.35)",
      },
      wordAt,
    );
  });

  return words;
}

export function ambientWaves(
  timeline: gsap.core.Timeline,
  waves: Target[],
  options: WaveOptions = {},
): gsap.core.Timeline {
  const totalDuration = options.totalDuration ?? 24;
  const at = options.at ?? 0;

  waves.forEach((wave, i) => {
    timeline.fromTo(
      wave,
      {
        y: (options.yOffset ?? -20) + i * 14,
        x: i % 2 === 0 ? -40 : 40,
        scaleX: options.scaleXOffset ?? 1.2,
        scaleY: 1.05,
        opacity: 0.32,
      },
      {
        y: (options.yOffset ?? -20) - i * 14,
        x: i % 2 === 0 ? 40 : -40,
        scaleX: (options.scaleXOffset ?? 1.2) * 1.08,
        scaleY: 1.12,
        opacity: 0.46,
        duration: totalDuration,
        ease: "sine.inOut",
      },
      at,
    );
  });

  return timeline;
}

export function sceneHandoff(
  timeline: gsap.core.Timeline,
  outgoing: Target,
  incoming: Target,
  options: SceneHandoffOptions = {},
): gsap.core.Timeline {
  const direction = options.direction ?? "left";
  const duration = options.duration ?? 0.82;
  const axis =
    direction === "left" || direction === "right" ? "xPercent" : "yPercent";
  const incomingOffset =
    direction === "left" || direction === "up" ? 100 : -100;
  const outgoingOffset = -incomingOffset * 0.18;
  const handoff = gsap.timeline();

  handoff
    .set(
      incoming,
      {
        autoAlpha: 1,
        zIndex: 2,
        [axis]: incomingOffset,
        scale: 1,
      },
      0,
    )
    .set(outgoing, { zIndex: 1, transformOrigin: "50% 50%" }, 0)
    .fromTo(
      incoming,
      {
        [axis]: incomingOffset,
        scale: 1,
      },
      {
        [axis]: 0,
        scale: 1,
        duration,
        ease: options.ease ?? "power3.inOut",
        immediateRender: false,
      },
      0,
    )
    .to(
      outgoing,
      {
        [axis]: outgoingOffset,
        scale: 1.035,
        duration,
        ease: options.ease ?? "power3.inOut",
      },
      0,
    )
    .set(outgoing, {
      autoAlpha: 0,
      x: 0,
      y: 0,
      xPercent: 0,
      yPercent: 0,
      scale: 1,
      zIndex: 0,
    })
    .set(incoming, { xPercent: 0, yPercent: 0, zIndex: 1 });

  return timeline.add(handoff, options.at);
}

export function morph(
  timeline: gsap.core.Timeline,
  target: Target,
  styles: gsap.TweenVars,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.to(
    target,
    {
      ...styles,
      duration: options.duration ?? 0.8,
      ease: options.ease ?? "power3.inOut",
    },
    options.at,
  );
}

export function splitText(
  element: HTMLElement | null | undefined,
  unit: "words" | "chars",
): HTMLElement[] {
  if (!element || !element.dataset) return [];
  if (element.dataset["motionlySplitUnit"] === unit) {
    return Array.from(element.querySelectorAll(".motionly-split-item"));
  }

  const allPieces: HTMLElement[] = [];

  function processNode(node: Node): Node[] {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (!text) return [];
      const parts = unit === "words" ? text.split(/(\s+)/) : Array.from(text);
      const newNodes: Node[] = [];
      for (const part of parts) {
        if (!part) continue;
        const span = document.createElement("span");
        span.textContent = part;
        span.className = "motionly-split-item";
        span.style.display = part.trim() ? "inline-block" : "inline";
        allPieces.push(span);
        newNodes.push(span);
      }
      return newNodes;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains("motionly-split-item")) {
        allPieces.push(el);
        return [el];
      }
      const children = Array.from(el.childNodes);
      const newChildren: Node[] = [];
      for (const child of children) {
        newChildren.push(...processNode(child));
      }
      el.replaceChildren(...newChildren);
      return [el];
    }
    return [node];
  }

  const rootChildren = Array.from(element.childNodes);
  const newRootChildren: Node[] = [];
  for (const child of rootChildren) {
    newRootChildren.push(...processNode(child));
  }
  element.replaceChildren(...newRootChildren);
  element.dataset["motionlySplitUnit"] = unit;
  return allPieces;
}

export function textReveal(
  timeline: gsap.core.Timeline,
  element: HTMLElement | null | undefined,
  options: StaggerOptions & { unit?: "words" | "chars" } = {},
): HTMLElement[] {
  if (!element) return [];
  const pieces = splitText(element, options.unit ?? "words");
  timeline.fromTo(
    pieces,
    { yPercent: 115, rotateX: -24, autoAlpha: 0 },
    {
      yPercent: 0,
      rotateX: 0,
      autoAlpha: 1,
      duration: options.duration ?? 0.62,
      stagger: options.stagger ?? 0.045,
      ease: options.ease ?? "power4.out",
    },
    options.at,
  );
  return pieces;
}

export function wordSlideRotate(
  timeline: gsap.core.Timeline,
  element: HTMLElement | null | undefined,
  options: StaggerOptions & { rotation?: number } = {},
): HTMLElement[] {
  if (!element) return [];
  const words = splitText(element, "words").filter((item) =>
    Boolean(item.textContent?.trim()),
  );
  timeline.fromTo(
    words,
    {
      y: options.distance ?? 42,
      rotation: options.rotation ?? 4,
      autoAlpha: 0,
    },
    {
      y: 0,
      rotation: 0,
      autoAlpha: 1,
      duration: options.duration ?? 0.58,
      stagger: options.stagger ?? 0.045,
      ease: options.ease ?? "power3.out",
    },
    options.at,
  );
  return words;
}

export function charSpringBounce(
  timeline: gsap.core.Timeline,
  element: HTMLElement | null | undefined,
  options: StaggerOptions = {},
): HTMLElement[] {
  if (!element) return [];
  const chars = splitText(element, "chars");
  timeline.fromTo(
    chars,
    { y: options.distance ?? 30, scale: 0.82, autoAlpha: 0 },
    {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      duration: options.duration ?? 0.48,
      stagger: options.stagger ?? 0.025,
      ease: options.ease ?? "back.out(1.7)",
    },
    options.at,
  );
  return chars;
}

export function squashAndStretch(
  timeline: gsap.core.Timeline,
  target: Target,
  options: SquashStretchOptions = {},
): gsap.core.Timeline {
  const factor = options.factor ?? 0.14;
  const isHoriz = options.direction !== "vertical";
  const duration = options.duration ?? 0.44;
  const squashTime = duration * 0.35;
  const settleTime = duration * 0.65;

  const squashScale = isHoriz
    ? { scaleX: 1 + factor, scaleY: Math.max(0.5, 1 - factor) }
    : { scaleX: Math.max(0.5, 1 - factor), scaleY: 1 + factor };

  const sub = gsap.timeline();
  sub
    .to(target, {
      ...squashScale,
      duration: squashTime,
      ease: "power2.in",
    })
    .to(target, {
      scaleX: 1,
      scaleY: 1,
      duration: settleTime,
      ease: options.ease ?? "back.out(1.4)",
    });

  return timeline.add(sub, options.at);
}

export function anticipate(
  timeline: gsap.core.Timeline,
  target: Target,
  options: AnticipateOptions = {},
): gsap.core.Timeline {
  const distance = options.distance ?? 18;
  const scale = options.scale ?? 0.95;
  const dir = options.direction ?? "right";
  const fromVars: gsap.TweenVars = {
    x: dir === "right" ? -distance : dir === "left" ? distance : 0,
    y: dir === "down" ? -distance : dir === "up" ? distance : 0,
    scale,
    duration: options.duration ?? 0.28,
    ease: options.ease ?? "power2.inOut",
  };
  return timeline.to(target, fromVars, options.at);
}

export function motionArc(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionArcOptions,
): gsap.core.Timeline {
  const duration = options.duration ?? 0.72;
  const arcHeight = options.arcHeight ?? 38;
  const startX = options.startX ?? 0;
  const startY = options.startY ?? 0;
  const endX = options.endX;
  const endY = options.endY;
  const midX = (startX + endX) / 2;
  const midY = Math.min(startY, endY) - arcHeight;

  const sub = gsap.timeline();
  if (options.startX !== undefined || options.startY !== undefined) {
    sub.set(target, { x: startX, y: startY }, 0);
  }
  sub.to(
    target,
    {
      keyframes: [
        { x: midX, y: midY, duration: duration * 0.48, ease: "power1.out" },
        { x: endX, y: endY, duration: duration * 0.52, ease: "power2.in" },
      ],
    },
    0,
  );

  return timeline.add(sub, options.at);
}

export function impactShake(
  timeline: gsap.core.Timeline,
  target: Target,
  options: ImpactShakeOptions = {},
): gsap.core.Timeline {
  const intensity = options.intensity ?? 10;
  const duration = options.duration ?? 0.42;
  const rotational = options.rotational ?? true;
  const step = duration / 4;

  const sub = gsap.timeline();
  sub
    .to(target, {
      x: intensity,
      rotation: rotational ? 2.2 : 0,
      duration: step,
      ease: "power2.out",
    })
    .to(target, {
      x: -intensity * 0.6,
      rotation: rotational ? -1.6 : 0,
      duration: step,
      ease: "power1.inOut",
    })
    .to(target, {
      x: intensity * 0.28,
      rotation: rotational ? 0.8 : 0,
      duration: step,
      ease: "power1.inOut",
    })
    .to(target, {
      x: 0,
      rotation: 0,
      duration: step,
      ease: "power2.out",
    });

  return timeline.add(sub, options.at);
}

export function errorWobble(
  timeline: gsap.core.Timeline,
  target: Target,
  options: ErrorWobbleOptions = {},
): gsap.core.Timeline {
  const distance = options.distance ?? 12;
  const angle = options.angle ?? 3.5;
  const duration = options.duration ?? 0.48;
  const step = duration / 5;

  const sub = gsap.timeline();
  sub
    .to(target, {
      x: -distance,
      rotation: -angle,
      duration: step,
      ease: "power2.out",
    })
    .to(target, {
      x: distance,
      rotation: angle,
      duration: step,
      ease: "power1.inOut",
    })
    .to(target, {
      x: -distance * 0.5,
      rotation: -angle * 0.5,
      duration: step,
      ease: "power1.inOut",
    })
    .to(target, {
      x: distance * 0.25,
      rotation: angle * 0.25,
      duration: step,
      ease: "power1.inOut",
    })
    .to(target, { x: 0, rotation: 0, duration: step, ease: "power2.out" });

  return timeline.add(sub, options.at);
}

export function ambientBreathing(
  timeline: gsap.core.Timeline,
  target: Target,
  options: AmbientBreathingOptions = {},
): gsap.core.Timeline {
  const minScale = options.minScale ?? 0.985;
  const maxScale = options.maxScale ?? 1.015;
  const yDrift = options.yDrift ?? 3;
  const duration = options.duration ?? 2.8;

  return timeline.fromTo(
    target,
    { scale: minScale, y: -yDrift },
    {
      scale: maxScale,
      y: yDrift,
      duration,
      yoyo: true,
      repeat: options.repeat ?? 1,
      ease: options.ease ?? "sine.inOut",
    },
    options.at,
  );
}

export function ambientFloat(
  timeline: gsap.core.Timeline,
  target: Target,
  options: AmbientFloatOptions = {},
): gsap.core.Timeline {
  const distance = options.distance ?? 8;
  const rotation = options.rotation ?? 1.5;
  const duration = options.duration ?? 3.2;

  return timeline.fromTo(
    target,
    { y: -distance, rotation: -rotation },
    {
      y: distance,
      rotation,
      duration,
      yoyo: true,
      repeat: options.repeat ?? 1,
      ease: options.ease ?? "sine.inOut",
    },
    options.at,
  );
}

export function stepSurgeCounter(
  timeline: gsap.core.Timeline,
  targetElement: HTMLElement | null | undefined,
  options: StepSurgeCounterOptions,
): gsap.core.Timeline {
  if (!targetElement) return timeline;
  const start = options.start ?? 0;
  const end = options.end;
  const surgeTarget =
    options.surgeTarget ?? Math.round(start + (end - start) * 0.74);
  const duration = options.duration ?? 1.25;
  const pause = options.pauseDuration ?? 0.12;
  const p1Duration = Math.max(0.18, (duration - pause) * 0.44);
  const p2Duration = Math.max(0.18, (duration - pause) * 0.56);
  const prefix = options.prefix ?? "";
  const suffix = options.suffix ?? "";

  const state = { val: start };
  targetElement.style.fontVariantNumeric = "tabular-nums";
  targetElement.textContent = `${prefix}${Math.round(start)}${suffix}`;

  const sub = gsap.timeline();
  sub
    .to(state, {
      val: surgeTarget,
      duration: p1Duration,
      ease: "power2.out",
      onUpdate: () => {
        targetElement.textContent = `${prefix}${Math.round(state.val)}${suffix}`;
      },
    })
    .to(state, {
      val: surgeTarget,
      duration: pause,
    })
    .to(state, {
      val: end,
      duration: p2Duration,
      ease: "power3.out",
      onUpdate: () => {
        targetElement.textContent = `${prefix}${Math.round(state.val)}${suffix}`;
      },
    });

  return timeline.add(sub, options.at);
}

export function perspectiveCardReveal(
  timeline: gsap.core.Timeline,
  target: Target,
  options: PerspectiveCardOptions = {},
): gsap.core.Timeline {
  const rotateX = options.rotateX ?? 16;
  const rotateY = options.rotateY ?? -12;
  const z = options.z ?? -120;
  const perspective = options.perspective ?? 1200;

  return timeline.fromTo(
    target,
    {
      transformPerspective: perspective,
      rotateX,
      rotateY,
      z,
      autoAlpha: 0,
      scale: 0.9,
    },
    {
      rotateX: 0,
      rotateY: 0,
      z: 0,
      autoAlpha: 1,
      scale: 1,
      duration: options.duration ?? 0.74,
      ease: options.ease ?? "back.out(1.25)",
    },
    options.at,
  );
}

export function matchCut(
  timeline: gsap.core.Timeline,
  outgoing: Target,
  incoming: Target,
  options: MatchCutOptions = {},
): gsap.core.Timeline {
  const duration = options.duration ?? 0.45;
  const sub = gsap.timeline();

  sub
    .set(incoming, { autoAlpha: 0, scale: options.scale ?? 1.0 }, 0)
    .to(
      outgoing,
      { scale: 0.94, duration: duration * 0.45, ease: "power2.in" },
      0,
    )
    .set(outgoing, { autoAlpha: 0 }, duration * 0.45)
    .set(incoming, { autoAlpha: 1, scale: 0.94 }, duration * 0.45)
    .to(
      incoming,
      { scale: 1, duration: duration * 0.55, ease: "back.out(1.35)" },
      duration * 0.45,
    );

  return timeline.add(sub, options.at);
}

export function maskReveal(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MaskRevealOptions = {},
): gsap.core.Timeline {
  const shape = options.shape ?? "rectangle";
  const dir = options.direction ?? "right";

  if (shape === "circle") {
    return timeline.fromTo(
      target,
      { clipPath: "circle(0% at 50% 50%)" },
      {
        clipPath: "circle(142% at 50% 50%)",
        duration: options.duration ?? 0.78,
        ease: options.ease ?? "expo.out",
      },
      options.at,
    );
  }

  const hidden =
    dir === "left"
      ? "inset(0 0 0 100%)"
      : dir === "up"
        ? "inset(100% 0 0 0)"
        : dir === "down"
          ? "inset(0 0 100% 0)"
          : dir === "center"
            ? "inset(50% 50% 50% 50%)"
            : "inset(0 100% 0 0)";

  return timeline.fromTo(
    target,
    { clipPath: hidden },
    {
      clipPath: "inset(0 0 0 0)",
      duration: options.duration ?? 0.76,
      ease: options.ease ?? "expo.out",
    },
    options.at,
  );
}

export function punchIn(
  timeline: gsap.core.Timeline,
  target: Target,
  options: PunchInOptions = {},
): gsap.core.Timeline {
  const scale = options.scale ?? 1.12;
  const origin = options.origin ?? "50% 45%";
  const duration = options.duration ?? 0.22;
  const sub = gsap.timeline();

  sub.to(target, {
    scale,
    transformOrigin: origin,
    duration,
    ease: options.ease ?? "back.out(1.4)",
  });

  if (options.returnToNormal) {
    sub.to(
      target,
      {
        scale: 1,
        duration: 0.32,
        ease: "power2.out",
      },
      `+=${options.holdDuration ?? 0.3}`,
    );
  }

  return timeline.add(sub, options.at);
}

export function captionPop(
  timeline: gsap.core.Timeline,
  target: Target,
  options: CaptionPopOptions = {},
): gsap.core.Timeline {
  const distance = options.distance ?? 14;
  const sub = gsap.timeline();

  const toVars: gsap.TweenVars = {
    scale: 1,
    y: 0,
    autoAlpha: 1,
    duration: options.duration ?? 0.34,
    ease: options.ease ?? "back.out(1.4)",
  };

  if (options.activeColor) {
    toVars.color = options.activeColor;
  }

  sub.fromTo(
    target,
    {
      scale: 0.68,
      y: distance,
      autoAlpha: 0,
      transformOrigin: "50% 80%",
    },
    toVars,
  );

  if (options.normalColor && options.activeColor) {
    sub.to(
      target,
      { color: options.normalColor, duration: 0.12, ease: "linear" },
      "+=0.2",
    );
  }

  return timeline.add(sub, options.at);
}

export function cutTheCurve(
  timeline: gsap.core.Timeline,
  options: CutTheCurveOptions,
): gsap.core.Timeline {
  const duration = options.duration ?? 0.6;
  const halfDur = duration * 0.5;
  const dir = options.direction ?? "left";
  const dist = options.distance ?? 230;
  const blurPx = options.blur ?? 8;
  const sub = gsap.timeline();

  const dx = dir === "left" ? -dist : dir === "right" ? dist : 0;
  const dy = dir === "up" ? -dist : dir === "down" ? dist : 0;
  const dxIn = -dx;
  const dyIn = -dy;

  sub.set(options.incoming, { autoAlpha: 0 }, 0);

  // Phase 1: Outgoing accelerates mid-motion
  sub.to(
    options.outgoing,
    {
      x: dx,
      y: dy,
      filter: `blur(${blurPx}px)`,
      duration: halfDur,
      ease: "power4.in",
    },
    0,
  );
  sub.to(
    options.outgoing,
    {
      autoAlpha: 0,
      duration: duration * 0.47,
      ease: "power2.in",
    },
    duration * 0.03,
  );

  // Hard cut & Phase 2: Incoming continues same vector and decelerates
  sub.fromTo(
    options.incoming,
    {
      x: dxIn,
      y: dyIn,
      filter: `blur(${blurPx}px)`,
      autoAlpha: 0.35,
    },
    {
      x: 0,
      y: 0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: halfDur,
      ease: "power4.out",
      immediateRender: false,
    },
    halfDur,
  );

  return timeline.add(sub, options.at);
}

export function zoomThrough(
  timeline: gsap.core.Timeline,
  options: ZoomThroughOptions,
): gsap.core.Timeline {
  const duration = options.duration ?? 0.6;
  const exitDur = duration * 0.33;
  const entryDur = duration * 0.67;
  const blurPx = options.blur ?? 10;
  const scaleExit = options.scaleExit ?? 1.2;
  const scaleEntry = options.scaleEntry ?? 0.75;
  const sub = gsap.timeline();

  sub.set(options.incoming, { autoAlpha: 0 }, 0);

  // Phase 1: Accelerate forward toward camera
  sub.to(
    options.outgoing,
    {
      scale: scaleExit,
      filter: `blur(${blurPx}px)`,
      duration: exitDur,
      ease: "power3.in",
    },
    0,
  );
  sub.to(
    options.outgoing,
    {
      autoAlpha: 0.15,
      duration: exitDur,
      ease: "none",
    },
    0,
  );

  // Cut
  sub.set(options.outgoing, { autoAlpha: 0 }, exitDur);

  // Phase 2: Incoming expands from 0.75 into focal plane
  sub.fromTo(
    options.incoming,
    {
      scale: scaleEntry,
      filter: `blur(${blurPx}px)`,
      autoAlpha: 0.15,
    },
    {
      scale: 1,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: entryDur,
      ease: "expo.out",
      immediateRender: false,
    },
    exitDur,
  );

  return timeline.add(sub, options.at);
}

export function inverseZoomThrough(
  timeline: gsap.core.Timeline,
  options: InverseZoomThroughOptions,
): gsap.core.Timeline {
  const duration = options.duration ?? 0.7;
  const exitDur = duration * 0.3;
  const entryDur = duration * 0.7;
  const blurPx = options.blur ?? 10;
  const scaleExit = options.scaleExit ?? 0.8;
  const scaleEntry = options.scaleEntry ?? 1.25;
  const sub = gsap.timeline();

  sub.set(options.incoming, { autoAlpha: 0 }, 0);

  // Phase 1: Outgoing recedes away from viewer
  sub.to(
    options.outgoing,
    {
      scale: scaleExit,
      filter: `blur(${blurPx}px)`,
      duration: exitDur,
      ease: "power3.in",
    },
    0,
  );
  sub.to(
    options.outgoing,
    {
      autoAlpha: 0.15,
      duration: exitDur,
      ease: "none",
    },
    0,
  );

  // Cut
  sub.set(options.outgoing, { autoAlpha: 0 }, exitDur);

  // Phase 2: Incoming arrives oversized and retracts into focus
  sub.fromTo(
    options.incoming,
    {
      scale: scaleEntry,
      filter: `blur(${blurPx}px)`,
      autoAlpha: 0.15,
    },
    {
      scale: 1,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: entryDur,
      ease: "expo.out",
      immediateRender: false,
    },
    exitDur,
  );

  return timeline.add(sub, options.at);
}

/* ------------------------------------------------------------------------- *
 * Rule 3: typography as a physical object.
 *
 * The three treatments the direction pass chooses between, as callable
 * mechanics rather than prose the build turn has to reinvent. Naming a
 * treatment in the direction and leaving the implementation open produced the
 * same clumsy result every time: a low-opacity text overlay easing in on
 * `autoAlpha`, which reads as a slide deck rather than as type with mass.
 *
 * Each one keeps the authored wrapper fixed and animates a dedicated inner
 * layer, so centred text cannot be pushed out of the frame or clipped when the
 * timeline is scrubbed or an editor override is applied.
 * ------------------------------------------------------------------------- */

export interface PullbackCompleteOptions extends MotionOptions {
  /** The camera world or stage the pullback moves. */
  camera?: Target;
  /** How large the opening fragment sits before the camera retreats. */
  startScale?: number;
  endScale?: number;
  /** Seconds the settled fragment holds before the camera starts moving. */
  hold?: number;
  stagger?: number;
  settleEase?: string;
}

/**
 * **The Pullback Complete.** One massive cropped line settles; the camera pulls
 * back and the rest of the sentence arrives in the negative space the retreat
 * opened up. The pullback and the completion are one move — the tail never
 * fades in on its own, it occupies room that was always there.
 */
export function pullbackComplete(
  timeline: gsap.core.Timeline,
  lead: HTMLElement | null | undefined,
  tail: HTMLElement | null | undefined,
  options: PullbackCompleteOptions = {},
): gsap.core.Timeline {
  if (!lead) return timeline;
  const at = (options.at as number) ?? 0;
  const startScale = options.startScale ?? 2.6;
  const endScale = options.endScale ?? 1;
  const settleDuration = options.duration ?? 0.9;
  const hold = options.hold ?? 0.5;
  const leadLayer = ensureTextMotionLayer(lead);

  timeline.set(lead, { autoAlpha: 1, ...resolveCentering(lead) }, at);
  // The tail is absent until the retreat opens room for it. Hiding only its
  // words would leave the container occupying the frame from the first beat,
  // which is the difference between a sentence completing and one that was
  // always there with half of it invisible.
  if (tail) timeline.set(tail, { autoAlpha: 0 }, at);
  timeline.fromTo(
    leadLayer,
    { scale: startScale, autoAlpha: 0 },
    {
      scale: startScale,
      autoAlpha: 1,
      duration: settleDuration * 0.35,
      ease: "power2.out",
    },
    at,
  );
  splitText(leadLayer, "words")
    .filter((piece) => Boolean(piece.textContent?.trim()))
    .forEach((piece, index) => {
      timeline.fromTo(
        piece,
        { y: 34, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: settleDuration * 0.7,
          ease: options.settleEase ?? "back.out(1.4)",
        },
        at + index * (options.stagger ?? 0.06),
      );
    });

  // The retreat. Scaling the line down and the camera out are the same gesture,
  // so the fragment appears to stay put while the frame widens around it.
  const pullAt = at + settleDuration + hold;
  const pullDuration = options.duration ?? 1.1;
  timeline.to(
    leadLayer,
    { scale: endScale, duration: pullDuration, ease: "expo.out" },
    pullAt,
  );
  if (options.camera) {
    timeline.to(
      options.camera,
      { scale: endScale, duration: pullDuration, ease: "expo.out" },
      pullAt,
    );
  }

  if (tail) {
    const tailLayer = ensureTextMotionLayer(tail);
    timeline.set(tail, { autoAlpha: 1 }, pullAt);
    // Measured off the reference: the tail does not travel in from off-screen.
    // It occupies room the retreat has just opened, so it resolves in place —
    // a short opacity ramp with a few pixels of lift, arriving left to right
    // while the line is still shrinking. A 60% slide reads as a separate
    // element joining the shot rather than as one sentence completing.
    splitText(tailLayer, "words")
      .filter((piece) => Boolean(piece.textContent?.trim()))
      .forEach((piece, index) => {
        timeline.fromTo(
          piece,
          { y: 10, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: pullDuration * 0.34,
            ease: options.settleEase ?? "back.out(1.3)",
          },
          pullAt + pullDuration * 0.3 + index * (options.stagger ?? 0.07),
        );
      });
  }
  // The film never freezes on a settled line: it keeps breathing through the
  // reading hold, which is what the references do under every statement.
  timeline.to(
    leadLayer,
    { scale: endScale * 1.04, duration: 1.6, ease: "sine.inOut" },
    pullAt + pullDuration,
  );
  return timeline;
}

export interface GrowCompleteOptions extends MotionOptions {
  /** Where the opening fragment starts, as a share of its settled size. */
  startScale?: number;
  stagger?: number;
  settleEase?: string;
}

/**
 * **Grow and Complete.** The other way a sentence finishes itself, and the one
 * the reference films use most.
 *
 * The opening fragment sits small and centred, then grows to full size while
 * the rest of the sentence arrives beside it. The line re-centres continuously
 * as words land, so the sentence never appears to grow rightward off its own
 * centre — that re-centring is what makes it read as one line completing rather
 * than as words being appended.
 *
 * Measured: the fragment grows over about 0.5s, words land 0.07s apart starting
 * a third of the way in, and the whole build is done in roughly 0.75s.
 */
export function growAndComplete(
  timeline: gsap.core.Timeline,
  lead: HTMLElement | null | undefined,
  tail: HTMLElement | null | undefined,
  options: GrowCompleteOptions = {},
): gsap.core.Timeline {
  if (!lead) return timeline;
  const at = (options.at as number) ?? 0;
  const duration = options.duration ?? 0.5;
  const leadLayer = ensureTextMotionLayer(lead);

  timeline.set(lead, { autoAlpha: 1, ...resolveCentering(lead) }, at);
  timeline.fromTo(
    leadLayer,
    { scale: options.startScale ?? 0.55 },
    {
      scale: 1,
      duration,
      ease: options.ease ?? "power3.out",
    },
    at,
  );

  if (!tail) return timeline;
  const tailLayer = ensureTextMotionLayer(tail);
  const pieces = splitText(tailLayer, "words").filter((piece) =>
    Boolean(piece.textContent?.trim()),
  );
  timeline.set(tail, { autoAlpha: 1 }, at);
  pieces.forEach((piece, index) => {
    timeline.fromTo(
      piece,
      { y: 10, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: duration * 0.7,
        ease: options.settleEase ?? "back.out(1.3)",
      },
      at + duration * 0.36 + index * (options.stagger ?? 0.07),
    );
  });

  // Re-centre the line as it fills out. The tail keeps its layout box, so the
  // pair is shifted right by half that box at the start and released to zero as
  // the words land — no reflow, and correct under reverse scrubbing.
  const shift = tail.getBoundingClientRect().width / 2;
  if (shift > 0) {
    const line =
      lead.parentElement && lead.parentElement === tail.parentElement
        ? lead.parentElement
        : null;
    timeline.fromTo(
      line ?? [lead, tail],
      { x: shift },
      { x: 0, duration, ease: options.ease ?? "power3.out" },
      at,
    );
  }
  return timeline;
}

export interface MacroSettleOptions extends MotionOptions {
  /** Opening scale. Rule 3 calls for 300%. */
  startScale?: number;
  endScale?: number;
  /** Blur in pixels at the opening scale. */
  blur?: number;
  unit?: "words" | "chars";
  stagger?: number;
}

/**
 * **Macro Settle.** Type arrives at 300% scale, heavily blurred, then snaps
 * into crisp 100% focus.
 *
 * The snap is the point: the blur resolves in the middle of the move on a
 * `power4.out`, so the line is sharp well before it stops travelling. Text that
 * stays soft while it is still moving reads as a video artefact rather than as
 * a lens finding focus.
 */
export function macroSettle(
  timeline: gsap.core.Timeline,
  element: HTMLElement | null | undefined,
  options: MacroSettleOptions = {},
): HTMLElement[] {
  if (!element) return [];
  const at = (options.at as number) ?? 0;
  const duration = options.duration ?? 0.85;
  const layer = ensureTextMotionLayer(element);
  const pieces = splitText(layer, options.unit ?? "words").filter((piece) =>
    Boolean(piece.textContent?.trim()),
  );

  timeline.set(element, { autoAlpha: 1, ...resolveCentering(element) }, at);
  timeline.fromTo(
    layer,
    {
      scale: options.startScale ?? 3,
      autoAlpha: 0,
      filter: "blur(" + String(options.blur ?? 18) + "px)",
    },
    {
      scale: options.endScale ?? 1,
      autoAlpha: 1,
      duration,
      ease: options.ease ?? "expo.out",
    },
    at,
  );
  // Focus lands before the movement does.
  timeline.to(
    layer,
    { filter: "blur(0px)", duration: duration * 0.45, ease: "power4.out" },
    at + duration * 0.25,
  );
  pieces.forEach((piece, index) => {
    timeline.fromTo(
      piece,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: duration * 0.3, ease: "power2.out" },
      at + index * (options.stagger ?? 0.035),
    );
  });
  return pieces;
}

export interface KineticAnchorOptions extends MotionOptions {
  /** How far the moving words travel before they settle around the anchor. */
  distance?: number;
  /** Degrees of rotation the moving words carry through the move. */
  rotation?: number;
  stagger?: number;
}

/**
 * **Kinetic Anchor.** One word holds absolutely still while the rest of the
 * sentence physically revolves or slides around it.
 *
 * The anchor is never tweened. Everything the viewer reads as movement belongs
 * to the words travelling past it, which is what makes the still word register
 * as the subject of the line rather than as text that simply failed to animate.
 */
export function kineticAnchor(
  timeline: gsap.core.Timeline,
  anchor: HTMLElement | null | undefined,
  orbiting: HTMLElement | null | undefined,
  options: KineticAnchorOptions = {},
): HTMLElement[] {
  if (!anchor) return [];
  const at = (options.at as number) ?? 0;
  const duration = options.duration ?? 0.8;
  const distance = options.distance ?? 120;

  timeline.set(anchor, { autoAlpha: 1, scale: 1, x: 0, y: 0 }, at);

  if (!orbiting) return [];
  const layer = ensureTextMotionLayer(orbiting);
  const pieces = splitText(layer, "words").filter((piece) =>
    Boolean(piece.textContent?.trim()),
  );
  timeline.set(orbiting, { autoAlpha: 1 }, at);
  pieces.forEach((piece, index) => {
    // Alternating arrival vectors read as travel around the anchor rather than
    // as one block of text sliding in.
    const direction = index % 2 === 0 ? 1 : -1;
    timeline.fromTo(
      piece,
      {
        x: distance * direction,
        y: -distance * 0.35 * direction,
        rotation: (options.rotation ?? 8) * direction,
        autoAlpha: 0,
        transformOrigin: "50% 50%",
      },
      {
        x: 0,
        y: 0,
        rotation: 0,
        autoAlpha: 1,
        duration,
        ease: options.ease ?? "back.out(1.4)",
      },
      at + index * (options.stagger ?? 0.07),
    );
  });
  return pieces;
}

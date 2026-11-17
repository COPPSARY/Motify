import type { PsdDocument, PsdLayerNode } from "./psd-import";

/**
 * PSD to Video's last step: the imported layers matched to Photoshop's own
 * picture of the design.
 *
 * Photoshop saves what each layer is made of (pixels, masks, the settings of
 * its layer style) but not what its style looks like, so the importer redraws
 * strokes, bevels, glows and the blend modes CSS lacks, and a redraw is never
 * exactly Photoshop's. Photoshop does save the finished design, its
 * composite. Wherever the layers, stacked as the editor stacks them, come out
 * different from it, the redrawn layer on top there takes the colour (and, at
 * its edges, the coverage) that makes the stack come out as Photoshop's.
 *
 * The layers stay separate and editable; the design they come to rest in is
 * Photoshop's. A redrawn layer takes the correction first. Where none covers
 * the pixel, the top layer there does: even Photoshop's own pixels can come
 * out different, because its Overlay, Luminosity and other modes are not
 * quite the browser's.
 */

export interface CompositeMatch {
  /** Share of the canvas that differs visibly from Photoshop, 0..1. */
  before: number;
  after: number;
  /** Pixels corrected. */
  corrected: number;
}

/** A difference worth correcting, in 0..255 on any channel. */
const TOLERANCE = 2;
/** What a person sees as different: the average channel off by this much. */
const VISIBLE = 12;
/**
 * How far, in pixels, a moving layer's corrections are averaged: wide enough
 * to lose the grain of the layers above, narrow enough to keep a bevel's light.
 */
const SMOOTH_RADIUS = 3;
/** How long the match runs before it lets the page draw. */
const YIELD_EVERY_MS = 40;
/** Past this many differing pixels, correcting would stall the browser. */
const MAX_CORRECTED = 6_000_000;

type Rgba = [number, number, number, number];

interface Leaf {
  node: PsdLayerNode;
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Corrected pixels, not yet written back to its canvas. */
  dirty: boolean;
  /** It covers the whole canvas: a background or a texture over everything. */
  spansCanvas: boolean;
}

/**
 * Corrects the layers of `document` in place so they stack into
 * `composite`, Photoshop's own picture. Null when the file has no usable
 * composite (saved without "Maximize compatibility").
 *
 * Layers move on their own in the video, so a layer takes only what is
 * wrong with its own look, never something that depends on another layer
 * being where it is at rest (that shows as a ghost outline as soon as the
 * other one moves):
 *
 * - only a redrawn layer, at Normal, where it covers fully and no other
 *   moving layer lies over it there (a texture over the whole canvas is
 *   fine: it does not move against it);
 * - its correction smoothed over its own pixels: a redraw's error is smooth
 *   (a bevel that lights a badge 10% brighter); the grain of the layers
 *   above is not, and would tear against them when it moved;
 * - colour only: its edges and coverage stay as they are.
 *
 * What depends on more than one layer (blend modes CSS lacks, Photoshop's
 * own blend maths) is left as it is: close to Photoshop, and clean in motion.
 */
export async function matchComposite(
  document: PsdDocument,
  composite: HTMLCanvasElement | undefined,
  onProgress?: (share: number) => void,
): Promise<CompositeMatch | null> {
  const { width: W, height: H } = document;
  if (!composite || composite.width !== W || composite.height !== H)
    return null;
  const target = composite.getContext("2d")?.getImageData(0, 0, W, H).data;
  if (!target || !hasPixels(target)) return null;

  const leaves = new Map<PsdLayerNode, Leaf>();
  for (const node of visibleLeaves(document.layers)) {
    const context = node.canvas!.getContext("2d");
    const pixels = context?.getImageData(
      0,
      0,
      node.canvas!.width,
      node.canvas!.height,
    );
    if (pixels)
      leaves.set(node, {
        node,
        data: pixels.data,
        width: pixels.width,
        height: pixels.height,
        dirty: false,
        spansCanvas:
          node.left <= 0 &&
          node.top <= 0 &&
          node.left + pixels.width >= W &&
          node.top + pixels.height >= H,
      });
  }

  const drawn = renderLayers(document);
  if (!drawn) return null;
  const before = visibleShare(drawn, target);
  const progress = pacer(onProgress);

  const differing = differingPixels(drawn, target, W * H);
  const deltas = new Map<Leaf, Float32Array>();
  let corrected = 0;
  for (let n = 0; n < differing.length; n += 1) {
    await progress(n / differing.length);
    const p = differing[n]!;
    const stack = compileStack(document.layers, leaves, p % W, (p / W) | 0);
    const owner = ownerAt(stack);
    if (!owner) continue;
    const solved = solvePixel(stack, owner, wantAt(target, p));
    if (!solved) continue;
    const leaf = owner.leaf;
    let delta = deltas.get(leaf);
    if (!delta) {
      delta = new Float32Array(leaf.width * leaf.height * 3);
      deltas.set(leaf, delta);
    }
    const at = owner.local;
    const d = (at / 4) * 3;
    for (let c = 0; c < 3; c += 1)
      delta[d + c] = solved.color[c]! * 255 - leaf.data[at + c]!;
    corrected += 1;
  }
  for (const [leaf, delta] of deltas) applySmoothed(leaf, delta);
  flush(leaves);

  const after = renderLayers(document);
  return {
    before,
    after: after ? visibleShare(after, target) : before,
    corrected,
  };
}

/**
 * The layer a pixel's difference belongs to: the top redrawn layer at Normal
 * that covers it fully, with no other moving layer over it. Null when there
 * is none, or when a moving layer's edge lies over it.
 */
function ownerAt(stack: readonly Op[]): LeafOp | null {
  for (const op of stackLeaves(stack)) {
    const alpha = op.leaf.data[op.local + 3]!;
    if (alpha === 0) continue;
    if (
      op.leaf.node.redrawn &&
      ownable(op.leaf.node) &&
      op.mix === null &&
      alpha === 255
    )
      return op;
    // Something over it that moves on its own: the difference may be its.
    if (!op.leaf.spansCanvas) return null;
  }
  return null;
}

/** Pixels that differ from Photoshop's by more than TOLERANCE. */
function differingPixels(
  drawn: Uint8ClampedArray,
  target: Uint8ClampedArray,
  count: number,
): number[] {
  const differing: number[] = [];
  for (let p = 0; p < count && differing.length < MAX_CORRECTED; p += 1)
    if (differs(drawn, target, p * 4)) differing.push(p);
  return differing;
}

/** Photoshop's pixel, premultiplied, 0..1. */
function wantAt(target: Uint8ClampedArray, p: number): Rgba {
  const i = p * 4;
  const a = target[i + 3]! / 255;
  return [
    (target[i]! / 255) * a,
    (target[i + 1]! / 255) * a,
    (target[i + 2]! / 255) * a,
    a,
  ];
}

/** Lets the page draw every YIELD_EVERY_MS, and reports how far it is. */
function pacer(
  onProgress?: (share: number) => void,
): (share: number) => Promise<void> {
  let last = performance.now();
  let calls = 0;
  return async (share) => {
    calls += 1;
    if ((calls & 1023) !== 0 || performance.now() - last < YIELD_EVERY_MS)
      return;
    onProgress?.(share);
    await new Promise((resolve) => setTimeout(resolve, 0));
    last = performance.now();
  };
}

/**
 * A layer's corrections, smoothed over its own pixels and then applied: the
 * correction at each pixel is the average of those around it, among the
 * pixels the layer covers. What a redraw got wrong survives; the grain of
 * the layers above does not.
 */
function applySmoothed(leaf: Leaf, delta: Float32Array): void {
  const { width: w, height: h, data } = leaf;
  const r = SMOOTH_RADIUS;
  const opaque = (x: number, y: number) => data[(y * w + x) * 4 + 3] === 255;
  // Box sums by rows, then columns, over the pixels it covers fully.
  const rows = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const sum = [0, 0, 0, 0];
    const add = (x: number, sign: number) => {
      if (x < 0 || x >= w || !opaque(x, y)) return;
      const d = (y * w + x) * 3;
      for (let c = 0; c < 3; c += 1) sum[c]! += sign * delta[d + c]!;
      sum[3]! += sign;
    };
    for (let x = -r; x < r; x += 1) add(x, 1);
    for (let x = 0; x < w; x += 1) {
      add(x + r, 1);
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c += 1) rows[o + c] = sum[c]!;
      add(x - r, -1);
    }
  }
  for (let x = 0; x < w; x += 1) {
    const sum = [0, 0, 0, 0];
    const add = (y: number, sign: number) => {
      if (y < 0 || y >= h) return;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c += 1) sum[c]! += sign * rows[o + c]!;
    };
    for (let y = -r; y < r; y += 1) add(y, 1);
    for (let y = 0; y < h; y += 1) {
      add(y + r, 1);
      if (opaque(x, y) && sum[3]! > 0) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c += 1)
          data[i + c] = Math.round(data[i + c]! + sum[c]! / sum[3]!);
        leaf.dirty = true;
      }
      add(y - r, -1);
    }
  }
}

/** Writes corrected pixels back to the layers' canvases. */
function flush(leaves: ReadonlyMap<PsdLayerNode, Leaf>): void {
  for (const leaf of leaves.values()) {
    if (!leaf.dirty) continue;
    const canvas = window.document.createElement("canvas");
    canvas.width = leaf.width;
    canvas.height = leaf.height;
    canvas
      .getContext("2d")
      ?.putImageData(
        new ImageData(
          new Uint8ClampedArray(leaf.data),
          leaf.width,
          leaf.height,
        ),
        0,
        0,
      );
    leaf.node.canvas = canvas;
    leaf.dirty = false;
  }
}

// ------------------------------------------------------------- solving

interface Solved {
  color: Rgb;
  alpha: number;
  /** How far the stack is from Photoshop's with this pixel, 0..1. */
  error: number;
}

/**
 * The colour (and, at an edge, the coverage) of one pixel of `owner` that
 * brings `stack` closest to `want` (premultiplied, 0..1). Null when no
 * change of it gets closer: the layer is hidden there, or already right.
 */
function solvePixel(stack: Op[], owner: LeafOp, want: Rgba): Solved | null {
  const { leaf, local } = owner;
  const data = leaf.data;
  const start = data[local + 3]! / 255;
  if (start === 0) return null;
  const own: Rgb = [
    data[local]! / 255,
    data[local + 1]! / 255,
    data[local + 2]! / 255,
  ];
  // Colour only, at its own coverage: its edges stay as they are.
  const coverages = [start];
  const got: Rgba = [0, 0, 0, 0];
  const moved: Rgba = [0, 0, 0, 0];
  composeStack(stack, null, got);
  const baseline = errorOf(got, want);
  let best: Solved | null = null;
  const override: Override = { op: owner, color: [0, 0, 0], alpha: 0 };
  for (const alpha of coverages) {
    const color: Rgb = [own[0], own[1], own[2]];
    override.alpha = alpha;
    let error = Infinity;
    for (let step = 0; step < 6; step += 1) {
      override.color = color;
      composeStack(stack, override, got);
      error = errorOf(got, want);
      if (error * 255 <= TOLERANCE / 2) break;
      // How the stack's colour moves with the layer's, channel by channel.
      const nudged = color.map((value) =>
        value > 1 - NUDGE ? value - NUDGE : value + NUDGE,
      ) as Rgb;
      override.color = nudged;
      composeStack(stack, override, moved);
      for (let c = 0; c < 3; c += 1) {
        const gain = (moved[c]! - got[c]!) / (nudged[c]! - color[c]!);
        if (Math.abs(gain) < 1e-3) continue;
        color[c] = clamp01(color[c]! + (want[c]! - got[c]!) / gain);
      }
      override.color = color;
      composeStack(stack, override, got);
      error = errorOf(got, want);
    }
    if (!best || error < best.error)
      best = { error, color: [color[0], color[1], color[2]], alpha };
    if (error * 255 <= TOLERANCE) break;
  }
  if (!best || best.error >= baseline - 0.5 / 255) return null;
  return best;
}

/** How far a channel is moved to see how the stack answers. */
const NUDGE = 0.02;

function errorOf(got: Rgba, want: Rgba): number {
  return Math.max(
    Math.abs(got[0] - want[0]),
    Math.abs(got[1] - want[1]),
    Math.abs(got[2] - want[2]),
    Math.abs(got[3] - want[3]),
  );
}

// ---------------------------------------------------------- compositing

/** A layer that covers the pixel, at its place in the stack. */
interface LeafOp {
  kind: "leaf";
  leaf: Leaf;
  /** The pixel's index in the layer's data. */
  local: number;
  opacity: number;
  mix: Mix;
}

/** A group the browser draws as one: its layers, then it, over the rest. */
interface GroupOp {
  kind: "group";
  ops: Op[];
  opacity: number;
  mix: Mix;
}

type Op = LeafOp | GroupOp;

interface Override {
  op: LeafOp;
  color: Rgb;
  alpha: number;
}

/**
 * The stack at one pixel, bottom first, as the browser composites the
 * editor's elements: a group with opacity, a blend mode or a filter is its
 * own stacking context and blends with what is under it as one; any other
 * group's layers blend straight through. Layers that do not reach the pixel
 * are left out.
 */
function compileStack(
  layers: readonly PsdLayerNode[],
  leaves: ReadonlyMap<PsdLayerNode, Leaf>,
  x: number,
  y: number,
): Op[] {
  const ops: Op[] = [];
  for (const node of layers) {
    if (node.hidden) continue;
    if (node.kind === "group") {
      const inner = compileStack(node.children, leaves, x, y);
      if (inner.length === 0) continue;
      if (isolated(node))
        ops.push({
          kind: "group",
          ops: inner,
          opacity: node.opacity,
          mix: mixOf(node.blend),
        });
      else ops.push(...inner);
      continue;
    }
    const leaf = leaves.get(node);
    if (!leaf) continue;
    const local = localIndex(leaf, x, y);
    if (local < 0) continue;
    ops.push({
      kind: "leaf",
      leaf,
      local,
      opacity: node.opacity,
      mix: mixOf(node.blend),
    });
  }
  return ops;
}

/** The layers in a stack, top first. */
function stackLeaves(ops: readonly Op[]): LeafOp[] {
  return [...ops]
    .reverse()
    .flatMap((op) => (op.kind === "leaf" ? [op] : stackLeaves(op.ops)));
}

/**
 * The stack composited into `out`, premultiplied, with one layer's pixel
 * overridden. Works in place: this runs millions of times on a large file.
 */
function composeStack(
  ops: readonly Op[],
  override: Override | null,
  out: Rgba,
): void {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  composeOps(out, ops, override, 0);
}

/** One scratch pixel per group depth. */
const groupScratch: Rgba[] = [];

function composeOps(
  target: Rgba,
  ops: readonly Op[],
  override: Override | null,
  depth: number,
): void {
  for (const op of ops) {
    if (op.kind === "group") {
      const inner = (groupScratch[depth] ??= [0, 0, 0, 0]);
      inner[0] = 0;
      inner[1] = 0;
      inner[2] = 0;
      inner[3] = 0;
      composeOps(inner, op.ops, override, depth + 1);
      if (inner[3] > 0)
        blendInto(
          target,
          inner[0],
          inner[1],
          inner[2],
          inner[3],
          op.opacity,
          op.mix,
        );
      continue;
    }
    let r: number;
    let g: number;
    let b: number;
    let a: number;
    if (override !== null && override.op === op) {
      r = override.color[0];
      g = override.color[1];
      b = override.color[2];
      a = override.alpha;
    } else {
      const data = op.leaf.data;
      const at = op.local;
      a = data[at + 3]! / 255;
      if (a === 0) continue;
      r = data[at]! / 255;
      g = data[at + 1]! / 255;
      b = data[at + 2]! / 255;
    }
    if (a === 0) continue;
    blendInto(target, r * a, g * a, b * a, a, op.opacity, op.mix);
  }
}

/** How a layer mixes with what is under it: a CSS blend, resolved once. */
type Mix =
  | null
  | "plus-lighter"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity"
  | ((b: number, s: number) => number);

function mixOf(blend: string | undefined): Mix {
  if (!blend || blend === "normal") return null;
  if (
    blend === "plus-lighter" ||
    blend === "hue" ||
    blend === "saturation" ||
    blend === "color" ||
    blend === "luminosity"
  )
    return blend;
  return SEPARABLE[blend] ?? null;
}

/**
 * W3C compositing, in place: a premultiplied source (s0, s1, s2, sa) at
 * `opacity` over `target`, blended by `mix`.
 */
function blendInto(
  target: Rgba,
  s0: number,
  s1: number,
  s2: number,
  sa: number,
  opacity: number,
  mix: Mix,
): void {
  const as = sa * opacity;
  if (as <= 0) return;
  const p0 = s0 * opacity;
  const p1 = s1 * opacity;
  const p2 = s2 * opacity;
  const ab = target[3];
  if (mix === "plus-lighter") {
    target[0] = Math.min(1, p0 + target[0]);
    target[1] = Math.min(1, p1 + target[1]);
    target[2] = Math.min(1, p2 + target[2]);
    target[3] = Math.min(1, as + ab);
    return;
  }
  const keep = 1 - as;
  if (mix === null || ab <= 0) {
    target[0] = p0 + keep * target[0];
    target[1] = p1 + keep * target[1];
    target[2] = p2 + keep * target[2];
    target[3] = as + ab * keep;
    return;
  }
  const c0 = p0 / as;
  const c1 = p1 / as;
  const c2 = p2 / as;
  const b0 = target[0] / ab;
  const b1 = target[1] / ab;
  const b2 = target[2] / ab;
  let m0: number;
  let m1: number;
  let m2: number;
  if (typeof mix === "function") {
    m0 = mix(b0, c0);
    m1 = mix(b1, c1);
    m2 = mix(b2, c2);
  } else {
    [m0, m1, m2] = nonSeparable(mix, [b0, b1, b2], [c0, c1, c2]);
  }
  const under = 1 - ab;
  target[0] = as * (under * c0 + ab * m0) + keep * target[0];
  target[1] = as * (under * c1 + ab * m1) + keep * target[1];
  target[2] = as * (under * c2 + ab * m2) + keep * target[2];
  target[3] = as + ab * keep;
}

type Rgb = [number, number, number];

function nonSeparable(
  mix: "hue" | "saturation" | "color" | "luminosity",
  b: Rgb,
  s: Rgb,
): Rgb {
  switch (mix) {
    case "hue":
      return setLum(setSat(s, sat(b)), lum(b));
    case "saturation":
      return setLum(setSat(b, sat(s)), lum(b));
    case "color":
      return setLum(s, lum(b));
    case "luminosity":
      return setLum(b, lum(s));
  }
}

const hardLight = (b: number, s: number) =>
  s <= 0.5 ? b * 2 * s : screen(b, 2 * s - 1);
const screen = (b: number, s: number) => b + s - b * s;

/** CSS's separable blend modes, as the browser computes them. */
const SEPARABLE: Readonly<Record<string, (b: number, s: number) => number>> = {
  normal: (_b, s) => s,
  multiply: (b, s) => b * s,
  screen,
  overlay: (b, s) => hardLight(s, b),
  darken: Math.min,
  lighten: Math.max,
  "color-dodge": (b, s) =>
    b === 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)),
  "color-burn": (b, s) =>
    b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s),
  "hard-light": hardLight,
  "soft-light": (b, s) => {
    if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
    const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
    return b + (2 * s - 1) * (d - b);
  },
  difference: (b, s) => Math.abs(b - s),
  exclusion: (b, s) => b + s - 2 * b * s,
};

const lum = (c: Rgb) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

function clipColor(c: Rgb): Rgb {
  const l = lum(c);
  const n = Math.min(...c);
  const x = Math.max(...c);
  let out = c;
  if (n < 0) out = out.map((v) => l + ((v - l) * l) / (l - n)) as Rgb;
  if (x > 1) out = out.map((v) => l + ((v - l) * (1 - l)) / (x - l)) as Rgb;
  return out;
}

function setLum(c: Rgb, l: number): Rgb {
  const d = l - lum(c);
  return clipColor([c[0] + d, c[1] + d, c[2] + d]);
}

const sat = (c: Rgb) => Math.max(...c) - Math.min(...c);

function setSat(c: Rgb, s: number): Rgb {
  const order = [0, 1, 2].sort((p, q) => c[p]! - c[q]!);
  const [min, mid, max] = order as [number, number, number];
  const out: Rgb = [0, 0, 0];
  const low = c[min]!;
  const high = c[max]!;
  if (high > low) {
    out[mid] = ((c[mid]! - low) * s) / (high - low);
    out[max] = s;
  }
  return out;
}

// ------------------------------------------------------------ rendering

/**
 * The layers drawn on a canvas as the editor stacks them, or null without a
 * 2D canvas.
 */
export function renderLayers(document: PsdDocument): Uint8ClampedArray | null {
  const canvas = window.document.createElement("canvas");
  canvas.width = document.width;
  canvas.height = document.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  drawLayers(context, document.layers, document);
  return context.getImageData(0, 0, document.width, document.height).data;
}

function drawLayers(
  context: CanvasRenderingContext2D,
  layers: readonly PsdLayerNode[],
  document: PsdDocument,
): void {
  for (const node of layers) {
    if (node.hidden) continue;
    if (node.kind === "group") {
      if (!isolated(node)) {
        drawLayers(context, node.children, document);
        continue;
      }
      const layer = window.document.createElement("canvas");
      layer.width = document.width;
      layer.height = document.height;
      const inner = layer.getContext("2d");
      if (!inner) continue;
      drawLayers(inner, node.children, document);
      paintCanvas(context, layer, 0, 0, node);
      continue;
    }
    if (node.canvas)
      paintCanvas(context, node.canvas, node.left, node.top, node);
  }
}

function paintCanvas(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  left: number,
  top: number,
  node: PsdLayerNode,
): void {
  context.globalAlpha = node.opacity;
  context.globalCompositeOperation = (
    node.blend === "plus-lighter" ? "lighter" : (node.blend ?? "source-over")
  ) as GlobalCompositeOperation;
  context.drawImage(source, left, top);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
}

// --------------------------------------------------------------- helpers

/** A group the browser draws as its own stacking context. */
function isolated(node: PsdLayerNode): boolean {
  return node.opacity < 1 || Boolean(node.blend) || Boolean(node.filter);
}

/** Layers drawn from pixels, shown, bottom first. */
function visibleLeaves(layers: readonly PsdLayerNode[]): PsdLayerNode[] {
  return layers.flatMap((node) => {
    if (node.hidden) return [];
    if (node.kind === "group") return visibleLeaves(node.children);
    return node.canvas ? [node] : [];
  });
}

/** Live text is drawn by the browser, not from these pixels: never corrected. */
function ownable(node: PsdLayerNode): boolean {
  return node.kind === "image" || node.textAsImage === true || !node.text;
}

function localIndex(leaf: Leaf, x: number, y: number): number {
  const lx = x - leaf.node.left;
  const ly = y - leaf.node.top;
  if (lx < 0 || ly < 0 || lx >= leaf.width || ly >= leaf.height) return -1;
  return (ly * leaf.width + lx) * 4;
}

function differs(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  i: number,
): boolean {
  const aa = a[i + 3]! / 255;
  const ba = b[i + 3]! / 255;
  return (
    Math.abs(a[i]! * aa - b[i]! * ba) > TOLERANCE ||
    Math.abs(a[i + 1]! * aa - b[i + 1]! * ba) > TOLERANCE ||
    Math.abs(a[i + 2]! * aa - b[i + 2]! * ba) > TOLERANCE ||
    Math.abs(a[i + 3]! - b[i + 3]!) > TOLERANCE
  );
}

/** Share of pixels a person would see as different, laid on white. */
function visibleShare(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let off = 0;
  for (let i = 0; i < a.length; i += 4) {
    const aa = a[i + 3]! / 255;
    const ba = b[i + 3]! / 255;
    let sum = 0;
    for (let c = 0; c < 3; c += 1)
      sum += Math.abs(
        a[i + c]! * aa + 255 * (1 - aa) - (b[i + c]! * ba + 255 * (1 - ba)),
      );
    if (sum / 3 > VISIBLE) off += 1;
  }
  return off / (a.length / 4);
}

function hasPixels(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) return true;
  return false;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

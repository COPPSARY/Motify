import type {
  Color,
  EffectNoiseGradient,
  EffectSolidGradient,
  GradientStyle,
  LayerEffectBevel,
  LayerEffectGradientOverlay,
  LayerEffectInnerGlow,
  LayerEffectPatternOverlay,
  LayerEffectSatin,
  LayerEffectShadow,
  LayerEffectStroke,
  LayerEffectsInfo,
  LayerEffectsOuterGlow,
  UnitsValue,
} from "ag-psd";

/**
 * Photoshop layer styles drawn into a layer's own pixels at import.
 *
 * The browser cannot draw a stroke, glow, bevel or gradient overlay on an
 * image the way Photoshop does, so the import draws them once, into the PNG
 * the layer is uploaded as. The layer then looks as it did in Photoshop
 * wherever it moves, fades or scales, and needs nothing from the renderer.
 *
 * Everything works on plain RGBA buffers, never on a canvas, so it is the same
 * in every browser and in tests. Photoshop does not publish its algorithms:
 * shadows, glows, strokes and overlays follow its documented geometry
 * closely; bevel and satin are redrawn and can differ in fine shading.
 */

/** RGBA, not premultiplied: the layout of ImageData. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** A raster at its place on the canvas. */
export interface PlacedRaster extends Raster {
  left: number;
  top: number;
}

export interface StyleOptions {
  /** The layer's Fill: 0..1. Exterior styles and strokes ignore it. */
  fillOpacity: number;
  /** Photoshop's global light, degrees. */
  globalAngle: number;
  globalAltitude: number;
  documentWidth: number;
  documentHeight: number;
  /** The file's patterns by id. */
  patterns: ReadonlyMap<string, Raster>;
}

export interface StyledLayer {
  raster: PlacedRaster;
  /** What was drawn approximately or not at all, in words. */
  notes: string[];
}

/** Past this many pixels a layer's styles would stall the browser. */
export const MAX_STYLE_PIXELS = 9_000_000;

type Rgb = [number, number, number];
type Effect = { enabled?: boolean; present?: boolean } | undefined;

const on = (effect: Effect): boolean =>
  Boolean(effect) && effect!.enabled !== false && effect!.present !== false;

/** The enabled styles a layer has, by Photoshop's name for each. */
export function enabledStyles(effects: LayerEffectsInfo | undefined): string[] {
  if (!effects || effects.disabled) return [];
  return [
    effects.dropShadow?.some(on) ? "drop shadow" : "",
    on(effects.outerGlow) ? "outer glow" : "",
    effects.innerShadow?.some(on) ? "inner shadow" : "",
    on(effects.innerGlow) ? "inner glow" : "",
    on(effects.bevel) ? "bevel" : "",
    on(effects.satin) ? "satin" : "",
    effects.stroke?.some(on) ? "stroke" : "",
    effects.solidFill?.some(on) ? "colour overlay" : "",
    effects.gradientOverlay?.some(on) ? "gradient overlay" : "",
    on(effects.patternOverlay) ? "pattern overlay" : "",
  ].filter(Boolean);
}

/** A Photoshop colour as 0..255 RGB, or null for one we cannot read. */
export function colorRgb(color: Color | undefined): Rgb | null {
  if (!color) return null;
  if ("r" in color) return [color.r, color.g, color.b];
  if ("fr" in color) return [color.fr * 255, color.fg * 255, color.fb * 255];
  return null;
}

/**
 * The layer with its styles drawn in, in Photoshop's stacking order: drop
 * shadow, outer glow, the layer (at its Fill), pattern, gradient and colour
 * overlay, satin, inner glow, inner shadow, stroke, bevel. Returns null when
 * the layer is too large to style.
 */
export function renderLayerStyle(
  content: PlacedRaster,
  effects: LayerEffectsInfo,
  options: StyleOptions,
): StyledLayer | null {
  const scale = effects.scale && effects.scale > 0 ? effects.scale : 1;
  const px = (value: UnitsValue | undefined, fallback = 0) =>
    Math.max(0, (value?.value ?? fallback) * scale);
  const notes: string[] = [];

  const shadows = (effects.dropShadow ?? []).filter(on);
  const outerGlow = on(effects.outerGlow) ? effects.outerGlow : undefined;
  const strokes = (effects.stroke ?? []).filter(on);
  const bevel = on(effects.bevel) ? effects.bevel : undefined;

  // Room around the layer for what is drawn outside it.
  let pad = 0;
  for (const shadow of shadows)
    pad = Math.max(pad, px(shadow.distance) + px(shadow.size) * 1.5);
  if (outerGlow) pad = Math.max(pad, px(outerGlow.size) * 1.5);
  for (const stroke of strokes) {
    if (stroke.position !== "inside")
      pad = Math.max(
        pad,
        stroke.position === "center"
          ? px(stroke.size, 3) / 2
          : px(stroke.size, 3),
      );
  }
  if (bevel && bevel.style && bevel.style !== "inner bevel")
    pad = Math.max(pad, px(bevel.size, 5));
  pad = Math.ceil(pad) + 2;

  const W = content.width + pad * 2;
  const H = content.height + pad * 2;
  if (W * H > MAX_STYLE_PIXELS) return null;
  const n = W * H;
  const box: Box = { x: pad, y: pad, w: content.width, h: content.height };
  const frame: Frame = {
    W,
    H,
    originX: content.left - pad,
    originY: content.top - pad,
  };

  // The layer's shape, and the layer at its Fill, on the padded canvas.
  const shape = new Float32Array(n);
  const layer = new Float32Array(n * 4);
  const fill = clamp01(options.fillOpacity);
  for (let y = 0; y < content.height; y += 1) {
    for (let x = 0; x < content.width; x += 1) {
      const from = (y * content.width + x) * 4;
      const at = (y + pad) * W + x + pad;
      const alpha = content.data[from + 3]! / 255;
      shape[at] = alpha;
      const a = alpha * fill;
      layer[at * 4] = (content.data[from]! / 255) * a;
      layer[at * 4 + 1] = (content.data[from + 1]! / 255) * a;
      layer[at * 4 + 2] = (content.data[from + 2]! / 255) * a;
      layer[at * 4 + 3] = a;
    }
  }
  let distance: Float32Array | null = null;
  const sd = () => (distance ??= signedDistance(shape, W, H));
  const light = (
    effect: { useGlobalLight?: boolean; angle?: number },
    fallback = 120,
  ) =>
    effect.useGlobalLight !== false && effect.useGlobalLight !== undefined
      ? options.globalAngle
      : (effect.angle ?? fallback);

  // ---- below the layer
  const below = new Float32Array(n * 4);
  for (const shadow of [...shadows].reverse()) {
    const alpha = shadowAlpha(shape, sd, frame, shadow, px, light(shadow));
    if (shadow.layerConceals !== false)
      for (let i = 0; i < n; i += 1) alpha[i]! *= 1 - shape[i]!;
    paint(below, alpha, shadow.opacity ?? 0.75, {
      color: colorRgb(shadow.color) ?? [0, 0, 0],
    });
  }
  if (outerGlow) {
    const size = px(outerGlow.size, 5);
    const spread = (size * (outerGlow.choke?.value ?? 0)) / 100;
    let alpha: Float32Array;
    if (outerGlow.technique === "precise") {
      const d = sd();
      alpha = new Float32Array(n);
      for (let i = 0; i < n; i += 1)
        alpha[i] = clamp01(1 - (d[i]! - spread) / Math.max(1, size - spread));
    } else {
      alpha = blur(grow(shape, sd, spread, n), W, H, (size - spread) / 2, 0);
    }
    paint(below, alpha, outerGlow.opacity ?? 0.75, {
      ...glowColor(outerGlow, alpha),
    });
  }

  // ---- on the layer, clipped to its shape
  const pattern = on(effects.patternOverlay)
    ? effects.patternOverlay
    : undefined;
  if (pattern) {
    const tile = pattern.pattern && options.patterns.get(pattern.pattern.id);
    if (tile) {
      paint(layer, shape, pattern.opacity ?? 1, {
        colors: patternColors(tile, pattern, frame, box),
        blend: pattern.blendMode,
      });
    } else {
      notes.push("Its pattern overlay's pattern is not in the file.");
    }
  }
  for (const overlay of [...(effects.gradientOverlay ?? [])]
    .filter(on)
    .reverse()) {
    const gradient = solidGradient(overlay.gradient, notes);
    if (!gradient) continue;
    paint(layer, shape, overlay.opacity ?? 1, {
      colors: gradientColors(gradient, overlay, frame, box, options),
      blend: overlay.blendMode,
    });
  }
  for (const overlay of [...(effects.solidFill ?? [])].filter(on).reverse()) {
    paint(layer, shape, overlay.opacity ?? 1, {
      color: colorRgb(overlay.color) ?? [0, 0, 0],
      blend: overlay.blendMode,
    });
  }
  if (on(effects.satin)) {
    const satin = effects.satin!;
    const alpha = satinAlpha(shape, frame, satin, px);
    paint(layer, alpha, satin.opacity ?? 0.5, {
      color: colorRgb(satin.color) ?? [0, 0, 0],
      blend: satin.blendMode ?? "multiply",
    });
  }
  if (on(effects.innerGlow)) {
    const glow = effects.innerGlow!;
    const alpha = innerGlowAlpha(shape, sd, frame, glow, px);
    paint(layer, alpha, glow.opacity ?? 0.75, {
      ...glowColor(glow, alpha),
      blend: glow.blendMode ?? "screen",
    });
  }
  for (const shadow of [...(effects.innerShadow ?? [])].filter(on).reverse()) {
    const alpha = innerShadowAlpha(shape, sd, frame, shadow, px, light(shadow));
    paint(layer, alpha, shadow.opacity ?? 0.75, {
      color: colorRgb(shadow.color) ?? [0, 0, 0],
      blend: shadow.blendMode ?? "multiply",
    });
  }
  for (const stroke of [...strokes].reverse()) {
    drawStroke(layer, shape, sd(), frame, box, stroke, px, options, notes);
  }

  // The layer over what is below it.
  for (let i = 0; i < n * 4; i += 4) {
    const a = layer[i + 3]!;
    for (let k = 0; k < 4; k += 1)
      below[i + k] = layer[i + k]! + below[i + k]! * (1 - a);
  }
  if (bevel)
    drawBevel(below, shape, sd(), frame, bevel, px, light(bevel), options);
  if (effects.bevel?.useTexture) notes.push("Its bevel's texture is left out.");
  if (bevel || on(effects.satin))
    notes.push(
      `Its ${[bevel ? "bevel" : "", on(effects.satin) ? "satin" : ""].filter(Boolean).join(" and ")} is redrawn and can differ slightly from Photoshop.`,
    );

  return { raster: cropped(below, frame), notes };
}

// ------------------------------------------------------------------ shapes

interface Frame {
  W: number;
  H: number;
  /** Where the padded canvas starts on the document. */
  originX: number;
  originY: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Px = (value: UnitsValue | undefined, fallback?: number) => number;

/** Light from `angle` casts a shadow this far in x and y. */
function offset(angle: number, distance: number): [number, number] {
  const radians = (angle * Math.PI) / 180;
  return [-Math.cos(radians) * distance, Math.sin(radians) * distance];
}

function shadowAlpha(
  shape: Float32Array,
  sd: () => Float32Array,
  frame: Frame,
  shadow: LayerEffectShadow,
  px: Px,
  angle: number,
): Float32Array {
  const size = px(shadow.size, 5);
  const spread = (size * (shadow.choke?.value ?? 0)) / 100;
  const n = frame.W * frame.H;
  const blurred = blur(
    grow(shape, sd, spread, n),
    frame.W,
    frame.H,
    (size - spread) / 2,
    0,
  );
  const [dx, dy] = offset(angle, px(shadow.distance, 5));
  return shift(blurred, frame.W, frame.H, dx, dy, 0);
}

function innerShadowAlpha(
  shape: Float32Array,
  sd: () => Float32Array,
  frame: Frame,
  shadow: LayerEffectShadow,
  px: Px,
  angle: number,
): Float32Array {
  const size = px(shadow.size, 5);
  const choke = (size * (shadow.choke?.value ?? 0)) / 100;
  const n = frame.W * frame.H;
  // The outside of the shape, grown in by the choke, blurred, then offset.
  const outside = new Float32Array(n);
  const d = sd();
  for (let i = 0; i < n; i += 1)
    outside[i] = choke > 0 ? clamp01(choke + d[i]! + 0.5) : 1 - shape[i]!;
  const blurred = blur(outside, frame.W, frame.H, (size - choke) / 2, 1);
  const [dx, dy] = offset(angle, px(shadow.distance, 5));
  const shifted = shift(blurred, frame.W, frame.H, dx, dy, 1);
  for (let i = 0; i < n; i += 1) shifted[i]! *= shape[i]!;
  return shifted;
}

function innerGlowAlpha(
  shape: Float32Array,
  sd: () => Float32Array,
  frame: Frame,
  glow: LayerEffectInnerGlow,
  px: Px,
): Float32Array {
  const size = px(glow.size, 5);
  const choke = (size * (glow.choke?.value ?? 0)) / 100;
  const n = frame.W * frame.H;
  const d = sd();
  let edge: Float32Array;
  if (glow.technique === "precise") {
    edge = new Float32Array(n);
    for (let i = 0; i < n; i += 1)
      edge[i] = clamp01(1 - (-d[i]! - choke) / Math.max(1, size - choke));
  } else {
    const outside = new Float32Array(n);
    for (let i = 0; i < n; i += 1)
      outside[i] = choke > 0 ? clamp01(choke + d[i]! + 0.5) : 1 - shape[i]!;
    edge = blur(outside, frame.W, frame.H, (size - choke) / 2, 1);
  }
  for (let i = 0; i < n; i += 1)
    edge[i] = (glow.source === "center" ? 1 - edge[i]! : edge[i]!) * shape[i]!;
  return edge;
}

function satinAlpha(
  shape: Float32Array,
  frame: Frame,
  satin: LayerEffectSatin,
  px: Px,
): Float32Array {
  const blurred = blur(shape, frame.W, frame.H, px(satin.size, 14) / 2, 0);
  const [dx, dy] = offset(satin.angle ?? 19, px(satin.distance, 11) / 2);
  const one = shift(blurred, frame.W, frame.H, dx, dy, 0);
  const other = shift(blurred, frame.W, frame.H, -dx, -dy, 0);
  const n = frame.W * frame.H;
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const difference = Math.abs(one[i]! - other[i]!);
    alpha[i] = (satin.invert ? 1 - difference : difference) * shape[i]!;
  }
  return alpha;
}

/** The shape grown by `by` px; the shape itself when `by` is 0. */
function grow(
  shape: Float32Array,
  sd: () => Float32Array,
  by: number,
  n: number,
): Float32Array {
  if (by <= 0) return shape;
  const d = sd();
  const grown = new Float32Array(n);
  for (let i = 0; i < n; i += 1) grown[i] = clamp01(by - d[i]! + 0.5);
  return grown;
}

function drawStroke(
  target: Float32Array,
  shape: Float32Array,
  d: Float32Array,
  frame: Frame,
  box: Box,
  stroke: LayerEffectStroke,
  px: Px,
  options: StyleOptions,
  notes: string[],
): void {
  const size = px(stroke.size, 3);
  const n = frame.W * frame.H;
  const position = stroke.position ?? "outside";
  const outer =
    position === "outside" ? size : position === "center" ? size / 2 : 0;
  const inner =
    position === "inside" ? size : position === "center" ? size / 2 : 0;
  let colors: Float32Array | undefined;
  let color: Rgb = colorRgb(stroke.color) ?? [0, 0, 0];
  if (stroke.fillType === "gradient") {
    const gradient = solidGradient(stroke.gradient, notes);
    if (gradient) {
      colors = gradientColors(
        gradient,
        {
          angle: stroke.gradient?.angle,
          scale: stroke.gradient?.scale,
          type: stroke.gradient?.style,
          reverse: stroke.gradient?.reverse,
          align: stroke.gradient?.align,
          offset: stroke.gradient?.offset,
        },
        frame,
        box,
        options,
      );
    }
  } else if (stroke.fillType === "pattern") {
    const tile = stroke.pattern && options.patterns.get(stroke.pattern.id);
    if (tile)
      colors = patternColors(
        tile,
        {
          scale: stroke.pattern?.scale,
          phase: stroke.pattern?.phase,
          align: stroke.pattern?.linked,
        },
        frame,
        box,
      );
    else {
      notes.push("Its stroke's pattern is not in the file; it is drawn grey.");
      color = [128, 128, 128];
    }
  }
  const opacity = stroke.opacity ?? 1;
  if (inner > 0) {
    const alpha = new Float32Array(n);
    for (let i = 0; i < n; i += 1)
      alpha[i] = Math.min(shape[i]!, clamp01(d[i]! + inner + 0.5));
    paint(target, alpha, opacity, { color, colors, blend: stroke.blendMode });
  }
  if (outer > 0) {
    // Outside the shape the stroke and the layer share each pixel's
    // coverage, so they add: no seam where they meet.
    for (let i = 0; i < n; i += 1) {
      const a = clamp01(outer - d[i]! + 0.5) * (1 - shape[i]!) * opacity;
      if (a <= 0) continue;
      const j = i * 4;
      const source = colors
        ? [colors[j]!, colors[j + 1]!, colors[j + 2]!]
        : [color[0] / 255, color[1] / 255, color[2] / 255];
      const coverage = a * (colors ? colors[j + 3]! : 1);
      for (let k = 0; k < 3; k += 1) target[j + k]! += source[k]! * coverage;
      target[j + 3] = Math.min(1, target[j + 3]! + coverage);
    }
  }
}

function drawBevel(
  target: Float32Array,
  shape: Float32Array,
  d: Float32Array,
  frame: Frame,
  bevel: LayerEffectBevel,
  px: Px,
  angle: number,
  options: StyleOptions,
): void {
  const { W, H } = frame;
  const n = W * H;
  const size = Math.max(1, px(bevel.size, 5));
  const style = bevel.style ?? "inner bevel";
  const height = new Float32Array(n);
  const region = new Float32Array(n);
  const profile = (t: number) => {
    const v = clamp01(t);
    // Smooth bevels are rounded; chisel bevels are straight slopes.
    return bevel.technique === "chisel hard" ||
      bevel.technique === "chisel soft"
      ? v
      : Math.sqrt(1 - (1 - v) * (1 - v));
  };
  for (let i = 0; i < n; i += 1) {
    const inside = -d[i]!;
    const outside = d[i]!;
    switch (style) {
      case "outer bevel":
        height[i] = inside >= 0 ? 1 : profile(1 - outside / size);
        region[i] = (1 - shape[i]!) * clamp01(size - outside + 0.5);
        break;
      case "emboss":
        height[i] = profile((size / 2 - outside) / size);
        region[i] = Math.max(shape[i]!, clamp01(size / 2 - outside + 0.5));
        break;
      case "pillow emboss":
        height[i] =
          inside >= 0
            ? profile(inside / (size / 2))
            : profile(outside / (size / 2));
        region[i] = Math.max(shape[i]!, clamp01(size / 2 - outside + 0.5));
        break;
      default:
        height[i] = profile(inside / size);
        region[i] = shape[i]!;
    }
    if (bevel.direction === "down") height[i] = -height[i]!;
  }
  const soften = px(bevel.soften) + (bevel.technique === "chisel soft" ? 1 : 0);
  const surface = soften > 0 ? blur(height, W, H, soften / 2, 0) : height;
  const altitude =
    ((bevel.useGlobalLight ? options.globalAltitude : (bevel.altitude ?? 30)) *
      Math.PI) /
    180;
  const azimuth = (angle * Math.PI) / 180;
  const lx = Math.cos(altitude) * Math.cos(azimuth);
  const ly = -Math.cos(altitude) * Math.sin(azimuth);
  const lz = Math.sin(altitude);
  const depth = size * (bevel.strength ?? 1);
  const highlight = new Float32Array(n);
  const shadow = new Float32Array(n);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      if (region[i]! <= 0) continue;
      const gx =
        (surface[y * W + Math.min(W - 1, x + 1)]! -
          surface[y * W + Math.max(0, x - 1)]!) /
        2;
      const gy =
        (surface[Math.min(H - 1, y + 1) * W + x]! -
          surface[Math.max(0, y - 1) * W + x]!) /
        2;
      const nx = -gx * depth;
      const ny = -gy * depth;
      const shade = (nx * lx + ny * ly + lz) / Math.hypot(nx, ny, 1);
      highlight[i] =
        clamp01((shade - lz) / Math.max(0.05, 1 - lz)) * region[i]!;
      shadow[i] = clamp01((lz - shade) / Math.max(0.05, lz)) * region[i]!;
    }
  }
  paint(target, highlight, bevel.highlightOpacity ?? 0.75, {
    color: colorRgb(bevel.highlightColor) ?? [255, 255, 255],
    blend: bevel.highlightBlendMode ?? "screen",
  });
  paint(target, shadow, bevel.shadowOpacity ?? 0.75, {
    color: colorRgb(bevel.shadowColor) ?? [0, 0, 0],
    blend: bevel.shadowBlendMode ?? "multiply",
  });
}

// --------------------------------------------------------------- colouring

function glowColor(
  glow: LayerEffectsOuterGlow | LayerEffectInnerGlow,
  alpha: Float32Array,
): { color: Rgb; colors?: Float32Array } {
  const color = colorRgb(glow.color) ?? [255, 255, 190];
  if (glow.gradient?.type !== "solid") return { color };
  // A gradient glow runs from the gradient's start at the edge to its end
  // where the glow fades out.
  const lut = gradientLut(glow.gradient, false);
  const colors = new Float32Array(alpha.length * 4);
  for (let i = 0; i < alpha.length; i += 1) {
    const at = Math.round((1 - clamp01(alpha[i]!)) * 255) * 4;
    colors.set(lut.subarray(at, at + 4), i * 4);
  }
  return { color, colors };
}

function solidGradient(
  gradient: EffectSolidGradient | EffectNoiseGradient | undefined,
  notes: string[],
): EffectSolidGradient | null {
  if (!gradient) return null;
  if (gradient.type === "solid") return gradient;
  notes.push("Its noise gradient is left out.");
  return null;
}

/** 256 samples of a gradient, straight RGBA in 0..1. */
export function gradientLut(
  gradient: EffectSolidGradient,
  reverse: boolean,
): Float32Array {
  const colorStops = [...gradient.colorStops].sort(
    (a, b) => a.location - b.location,
  );
  const opacityStops = [...gradient.opacityStops].sort(
    (a, b) => a.location - b.location,
  );
  const lut = new Float32Array(256 * 4);
  for (let index = 0; index < 256; index += 1) {
    const t = reverse ? 1 - index / 255 : index / 255;
    const rgb = interpolate(colorStops, t, (stop) => {
      const value = colorRgb(stop.color) ?? [0, 0, 0];
      return [value[0] / 255, value[1] / 255, value[2] / 255];
    });
    const [alpha = 1] = opacityStops.length
      ? interpolate(opacityStops, t, (stop) => [stop.opacity])
      : [1];
    lut.set([rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, alpha], index * 4);
  }
  return lut;
}

/** Between two stops, with Photoshop's midpoint: where they mix half and half. */
function interpolate<T extends { location: number; midpoint: number }>(
  stops: readonly T[],
  t: number,
  value: (stop: T) => number[],
): number[] {
  if (stops.length === 0) return [0, 0, 0];
  if (t <= stops[0]!.location) return value(stops[0]!);
  for (let index = 1; index < stops.length; index += 1) {
    const next = stops[index]!;
    if (t > next.location) continue;
    const previous = stops[index - 1]!;
    const span = next.location - previous.location;
    const f = span > 0 ? (t - previous.location) / span : 1;
    const midpoint = Math.min(0.95, Math.max(0.05, previous.midpoint ?? 0.5));
    const mix =
      f < midpoint
        ? (0.5 * f) / midpoint
        : 0.5 + (0.5 * (f - midpoint)) / (1 - midpoint);
    const from = value(previous);
    const to = value(next);
    return from.map((component, k) => component + (to[k]! - component) * mix);
  }
  return value(stops.at(-1)!);
}

/** Straight RGBA per pixel of a gradient laid over the layer or document. */
function gradientColors(
  gradient: EffectSolidGradient,
  overlay: Pick<
    LayerEffectGradientOverlay,
    "angle" | "scale" | "reverse" | "align" | "offset"
  > & { type?: GradientStyle },
  frame: Frame,
  layerBox: Box,
  options: StyleOptions,
): Float32Array {
  const box: Box =
    overlay.align === false
      ? {
          x: -frame.originX,
          y: -frame.originY,
          w: options.documentWidth,
          h: options.documentHeight,
        }
      : layerBox;
  const lut = gradientLut(gradient, Boolean(overlay.reverse));
  const angle = ((overlay.angle ?? 90) * Math.PI) / 180;
  const ux = Math.cos(angle);
  const uy = -Math.sin(angle);
  const scale = overlay.scale && overlay.scale > 0 ? overlay.scale : 1;
  const half =
    Math.max(1, (Math.abs(box.w * ux) + Math.abs(box.h * uy)) / 2) * scale;
  const cx = box.x + box.w / 2 + (overlay.offset?.x ?? 0) * box.w;
  const cy = box.y + box.h / 2 + (overlay.offset?.y ?? 0) * box.h;
  const style = overlay.type ?? "linear";
  const colors = new Float32Array(frame.W * frame.H * 4);
  for (let y = 0; y < frame.H; y += 1) {
    for (let x = 0; x < frame.W; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const along = dx * ux + dy * uy;
      const across = -dx * uy + dy * ux;
      let t: number;
      switch (style) {
        case "radial":
          t = Math.hypot(dx, dy) / half;
          break;
        case "reflected":
          t = Math.abs(along) / half;
          break;
        case "diamond":
          t = (Math.abs(along) + Math.abs(across)) / half;
          break;
        case "angle": {
          const turn = Math.atan2(-dy, dx) - angle;
          t = (((-turn / (2 * Math.PI)) % 1) + 1) % 1;
          break;
        }
        default:
          t = (along / half + 1) / 2;
      }
      const at = Math.round(clamp01(t) * 255) * 4;
      colors.set(lut.subarray(at, at + 4), (y * frame.W + x) * 4);
    }
  }
  return colors;
}

function patternColors(
  tile: Raster,
  pattern: Pick<LayerEffectPatternOverlay, "scale" | "phase" | "align">,
  frame: Frame,
  layerBox: Box,
): Float32Array {
  const scale = pattern.scale && pattern.scale > 0 ? pattern.scale : 1;
  // Linked with the layer, the pattern starts at the layer; otherwise at the
  // document's corner.
  const startX =
    (pattern.align !== false ? layerBox.x : -frame.originX) +
    (pattern.phase?.x ?? 0);
  const startY =
    (pattern.align !== false ? layerBox.y : -frame.originY) +
    (pattern.phase?.y ?? 0);
  const colors = new Float32Array(frame.W * frame.H * 4);
  for (let y = 0; y < frame.H; y += 1) {
    const ty = mod(Math.floor((y - startY) / scale), tile.height);
    for (let x = 0; x < frame.W; x += 1) {
      const tx = mod(Math.floor((x - startX) / scale), tile.width);
      const from = (ty * tile.width + tx) * 4;
      const at = (y * frame.W + x) * 4;
      colors[at] = tile.data[from]! / 255;
      colors[at + 1] = tile.data[from + 1]! / 255;
      colors[at + 2] = tile.data[from + 2]! / 255;
      colors[at + 3] = tile.data[from + 3]! / 255;
    }
  }
  return colors;
}

// ------------------------------------------------------------- compositing

type Separable = (backdrop: number, source: number) => number;

const colorDodge: Separable = (b, s) =>
  b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s));
const colorBurn: Separable = (b, s) =>
  b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s);
const hardLight: Separable = (b, s) =>
  s <= 0.5 ? b * 2 * s : b + (2 * s - 1) - b * (2 * s - 1);

/** Photoshop's per-channel blend modes, W3C formulas where they share one. */
export const BLEND_FUNCTIONS: Readonly<Record<string, Separable>> = {
  normal: (_b, s) => s,
  dissolve: (_b, s) => s,
  darken: Math.min,
  multiply: (b, s) => b * s,
  "color burn": colorBurn,
  "linear burn": (b, s) => Math.max(0, b + s - 1),
  lighten: Math.max,
  screen: (b, s) => b + s - b * s,
  "color dodge": colorDodge,
  "linear dodge": (b, s) => Math.min(1, b + s),
  overlay: (b, s) => hardLight(s, b),
  "soft light": (b, s) => {
    if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
    const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
    return b + (2 * s - 1) * (d - b);
  },
  "hard light": hardLight,
  "vivid light": (b, s) =>
    s <= 0.5 ? colorBurn(b, 2 * s) : colorDodge(b, 2 * s - 1),
  "linear light": (b, s) => clamp01(b + 2 * s - 1),
  "pin light": (b, s) =>
    s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1),
  "hard mix": (b, s) => (b + s >= 1 ? 1 : 0),
  difference: (b, s) => Math.abs(b - s),
  exclusion: (b, s) => b + s - 2 * b * s,
  subtract: (b, s) => Math.max(0, b - s),
  divide: (b, s) => (s <= 0 ? 1 : Math.min(1, b / s)),
};

/**
 * Paints a colour through `alpha` onto a premultiplied buffer, blended as
 * W3C compositing does: the blend applies where both are present.
 */
function paint(
  target: Float32Array,
  alpha: Float32Array,
  opacity: number,
  source: { color?: Rgb; colors?: Float32Array; blend?: string },
): void {
  const blend =
    BLEND_FUNCTIONS[source.blend ?? "normal"] ?? BLEND_FUNCTIONS["normal"]!;
  const color = (source.color ?? [0, 0, 0]).map((value) => value / 255);
  const colors = source.colors;
  for (let i = 0; i < alpha.length; i += 1) {
    const j = i * 4;
    const as = alpha[i]! * opacity * (colors ? colors[j + 3]! : 1);
    if (as <= 0) continue;
    const ab = target[j + 3]!;
    for (let k = 0; k < 3; k += 1) {
      const cs = colors ? colors[j + k]! : color[k]!;
      const cb = ab > 0 ? target[j + k]! / ab : 0;
      const mixed = (1 - ab) * cs + ab * blend(cb, cs);
      target[j + k] = as * mixed + (1 - as) * target[j + k]!;
    }
    target[j + 3] = as + ab * (1 - as);
  }
}

/** The premultiplied buffer as RGBA, cropped to what it draws. */
function cropped(buffer: Float32Array, frame: Frame): PlacedRaster {
  const { W, H } = frame;
  let left = W;
  let top = H;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (buffer[(y * W + x) * 4 + 3]! * 255 < 0.5) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) {
    left = 0;
    top = 0;
    right = 0;
    bottom = 0;
  }
  const width = right - left + 1;
  const height = bottom - top + 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = ((y + top) * W + x + left) * 4;
      const to = (y * width + x) * 4;
      const a = buffer[from + 3]!;
      if (a <= 0) continue;
      data[to] = Math.round((buffer[from]! / a) * 255);
      data[to + 1] = Math.round((buffer[from + 1]! / a) * 255);
      data[to + 2] = Math.round((buffer[from + 2]! / a) * 255);
      data[to + 3] = Math.round(a * 255);
    }
  }
  return {
    width,
    height,
    data,
    left: frame.originX + left,
    top: frame.originY + top,
  };
}

// ---------------------------------------------------------------- geometry

/** Gaussian blur as three box blurs; `edge` is the value beyond the buffer. */
export function blur(
  source: Float32Array,
  W: number,
  H: number,
  sigma: number,
  edge: number,
): Float32Array {
  if (!(sigma > 0.25)) return Float32Array.from(source);
  // Box sizes for three passes that approximate the Gaussian.
  const ideal = Math.sqrt((12 * sigma * sigma) / 3 + 1);
  let lower = Math.floor(ideal);
  if (lower % 2 === 0) lower -= 1;
  const upper = lower + 2;
  const m = Math.round(
    (12 * sigma * sigma - 3 * lower * lower - 12 * lower - 9) /
      (-4 * lower - 4),
  );
  const a = Float32Array.from(source);
  const b = new Float32Array(source.length);
  for (let pass = 0; pass < 3; pass += 1) {
    const radius = ((pass < m ? lower : upper) - 1) / 2;
    boxPass(a, b, W, H, radius, edge, true);
    boxPass(b, a, W, H, radius, edge, false);
  }
  return a;
}

function boxPass(
  source: Float32Array,
  target: Float32Array,
  W: number,
  H: number,
  radius: number,
  edge: number,
  horizontal: boolean,
): void {
  const length = horizontal ? W : H;
  const lines = horizontal ? H : W;
  const step = horizontal ? 1 : W;
  const size = radius * 2 + 1;
  for (let line = 0; line < lines; line += 1) {
    const start = horizontal ? line * W : line;
    const at = (index: number) =>
      index < 0 || index >= length ? edge : source[start + index * step]!;
    let sum = 0;
    for (let index = -radius; index <= radius; index += 1) sum += at(index);
    for (let index = 0; index < length; index += 1) {
      target[start + index * step] = sum / size;
      sum += at(index + radius + 1) - at(index - radius);
    }
  }
}

/** The buffer moved by (dx, dy), sampled bilinearly. */
function shift(
  source: Float32Array,
  W: number,
  H: number,
  dx: number,
  dy: number,
  edge: number,
): Float32Array {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return source;
  const out = new Float32Array(source.length);
  const sample = (x: number, y: number) =>
    x < 0 || y < 0 || x >= W || y >= H ? edge : source[y * W + x]!;
  for (let y = 0; y < H; y += 1) {
    const sy = y - dy;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    for (let x = 0; x < W; x += 1) {
      const sx = x - dx;
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      out[y * W + x] =
        (sample(x0, y0) * (1 - fx) + sample(x0 + 1, y0) * fx) * (1 - fy) +
        (sample(x0, y0 + 1) * (1 - fx) + sample(x0 + 1, y0 + 1) * fx) * fy;
    }
  }
  return out;
}

/**
 * Distance from each pixel to the shape's edge: positive outside, negative
 * inside, refined by partial coverage so strokes stay antialiased.
 */
export function signedDistance(
  shape: Float32Array,
  W: number,
  H: number,
): Float32Array {
  const n = W * H;
  const inside = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) inside[i] = shape[i]! >= 0.5 ? 1 : 0;
  const toInside = distanceTo(inside, 1, W, H);
  const toOutside = distanceTo(inside, 0, W, H);
  const result = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const alpha = shape[i]!;
    if (alpha > 0.02 && alpha < 0.98) result[i] = 0.5 - alpha;
    else result[i] = inside[i] ? -(toOutside[i]! - 0.5) : toInside[i]! - 0.5;
  }
  return result;
}

/** Exact Euclidean distance to the nearest pixel whose flag is `value`. */
function distanceTo(
  flags: Uint8Array,
  value: number,
  W: number,
  H: number,
): Float32Array {
  const INF = 1e20;
  const grid = new Float64Array(W * H);
  for (let i = 0; i < grid.length; i += 1)
    grid[i] = flags[i] === value ? 0 : INF;
  const size = Math.max(W, H);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  for (let x = 0; x < W; x += 1) {
    for (let y = 0; y < H; y += 1) f[y] = grid[y * W + x]!;
    transform1d(f, H, d, v, z);
    for (let y = 0; y < H; y += 1) grid[y * W + x] = d[y]!;
  }
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) f[x] = grid[y * W + x]!;
    transform1d(f, W, d, v, z);
    for (let x = 0; x < W; x += 1) grid[y * W + x] = d[x]!;
  }
  const out = new Float32Array(W * H);
  for (let i = 0; i < out.length; i += 1)
    out[i] = Math.sqrt(Math.min(grid[i]!, 1e12));
  return out;
}

/** Felzenszwalb and Huttenlocher's squared distance transform, one line. */
function transform1d(
  f: Float64Array,
  n: number,
  d: Float64Array,
  v: Int32Array,
  z: Float64Array,
): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q += 1) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k -= 1;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1]! < q) k += 1;
    d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!;
  }
}

function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

import type {
  AdjustmentLayer,
  BlendMode,
  ColorBalanceValues,
  CurvesAdjustmentChannel,
  HueSaturationAdjustmentChannel,
  LevelsAdjustmentChannel,
} from "ag-psd";
import {
  BLEND_FUNCTIONS,
  colorRgb,
  gradientLut,
  type PlacedRaster,
} from "./psd-effects";

/**
 * Photoshop adjustment layers, applied to the layers beneath them at import.
 *
 * An adjustment layer recolours everything under it. Motify has no layer that
 * recolours what is behind it in both the editor and the export, so each
 * adjustment is applied to the pixels (and text colours) of the layers it
 * covers. For opaque layers the result is Photoshop's; where a soft edge
 * overlaps another layer it can differ by a shade. The layers stay separate
 * and movable, and keep their adjusted colours wherever they move.
 */

/** Adjusts one colour in place; channels 0..255. */
export type ColorAdjust = (rgb: number[]) => void;

/**
 * The adjustment as a colour function, or why it cannot be applied. Its
 * blend mode is folded in, so the function returns the final colour.
 */
export function adjustmentFunction(
  adjustment: AdjustmentLayer,
  blendMode: BlendMode | undefined,
): ColorAdjust | string {
  const adjust = colorFunction(adjustment);
  if (typeof adjust === "string") return adjust;
  if (!blendMode || blendMode === "normal" || blendMode === "pass through")
    return adjust;
  if (blendMode === "luminosity" || blendMode === "color") {
    return (rgb) => {
      const original = [...rgb];
      adjust(rgb);
      const result =
        blendMode === "luminosity"
          ? setLum(original, lum(rgb))
          : setLum(rgb, lum(original));
      rgb.splice(0, 3, ...result);
    };
  }
  const blend = BLEND_FUNCTIONS[blendMode];
  if (!blend) return `its blend mode “${blendMode}” cannot be applied`;
  return (rgb) => {
    const original = [...rgb];
    adjust(rgb);
    for (let k = 0; k < 3; k += 1)
      rgb[k] = blend(original[k]! / 255, rgb[k]! / 255) * 255;
  };
}

function colorFunction(adjustment: AdjustmentLayer): ColorAdjust | string {
  switch (adjustment.type) {
    case "levels":
      return perChannel(
        (adjustment.channels ?? []).map((channel) =>
          channel ? levelsLut(channel) : null,
        ),
      );
    case "curves":
      return perChannel(
        adjustment.values
          ? adjustment.values.map((values) =>
              values?.length === 256 ? Float32Array.from(values) : null,
            )
          : (adjustment.channels ?? []).map((points) =>
              points?.length ? curveLut(points) : null,
            ),
      );
    case "brightness/contrast":
      return brightnessContrast(
        adjustment.brightness ?? 0,
        adjustment.contrast ?? 0,
        Boolean(adjustment.useLegacy),
      );
    case "exposure": {
      const exposure = 2 ** (adjustment.exposure ?? 0);
      const offset = adjustment.offset ?? 0;
      const gamma =
        adjustment.gamma && adjustment.gamma > 0 ? adjustment.gamma : 1;
      return (rgb) => {
        for (let k = 0; k < 3; k += 1) {
          const linear = Math.max(
            0,
            toLinear(rgb[k]! / 255) * exposure + offset,
          );
          rgb[k] = clamp255(fromLinear(linear) ** (1 / gamma) * 255);
        }
      };
    }
    case "vibrance": {
      const vibrance = (adjustment.vibrance ?? 0) / 100;
      const saturation = (adjustment.saturation ?? 0) / 100;
      return (rgb) => {
        const max = Math.max(...rgb.slice(0, 3)) / 255;
        const min = Math.min(...rgb.slice(0, 3)) / 255;
        // Vibrance works hardest on the least saturated colours.
        const amount = saturation + vibrance * (1 - (max - min));
        const gray = lum(rgb);
        for (let k = 0; k < 3; k += 1)
          rgb[k] = clamp255(gray + (rgb[k]! - gray) * (1 + amount));
      };
    }
    case "hue/saturation":
      return hueSaturation(adjustment);
    case "color balance":
      return colorBalance(
        adjustment.shadows,
        adjustment.midtones,
        adjustment.highlights,
        adjustment.preserveLuminosity !== false,
      );
    case "black & white": {
      const weight = {
        r: (adjustment.reds ?? 40) / 100,
        y: (adjustment.yellows ?? 60) / 100,
        g: (adjustment.greens ?? 40) / 100,
        c: (adjustment.cyans ?? 60) / 100,
        b: (adjustment.blues ?? 20) / 100,
        m: (adjustment.magentas ?? 80) / 100,
      };
      const tint = adjustment.useTint ? colorRgb(adjustment.tintColor) : null;
      return (rgb) => {
        const gray = clamp255(blackAndWhite(rgb, weight));
        const result = tint ? setLum(tint, gray) : [gray, gray, gray];
        rgb.splice(0, 3, ...result);
      };
    }
    case "photo filter": {
      const color = colorRgb(adjustment.color);
      if (!color) return "its filter colour could not be read";
      const density = (adjustment.density ?? 25) / 100;
      const keep = adjustment.preserveLuminosity !== false;
      return (rgb) => {
        const original = lum(rgb);
        for (let k = 0; k < 3; k += 1)
          rgb[k] = rgb[k]! * (1 - density + (density * color[k]!) / 255);
        if (keep) rgb.splice(0, 3, ...setLum(rgb, original));
      };
    }
    case "channel mixer": {
      const mix = (
        channel: { red: number; green: number; blue: number; constant: number },
        rgb: number[],
      ) =>
        (rgb[0]! * channel.red +
          rgb[1]! * channel.green +
          rgb[2]! * channel.blue) /
          100 +
        (channel.constant * 255) / 100;
      if (adjustment.monochrome && adjustment.gray) {
        const gray = adjustment.gray;
        return (rgb) => {
          const value = clamp255(mix(gray, rgb));
          rgb.splice(0, 3, value, value, value);
        };
      }
      const identity = (red: number, green: number, blue: number) => ({
        red,
        green,
        blue,
        constant: 0,
      });
      const red = adjustment.red ?? identity(100, 0, 0);
      const green = adjustment.green ?? identity(0, 100, 0);
      const blue = adjustment.blue ?? identity(0, 0, 100);
      return (rgb) => {
        const result = [red, green, blue].map((channel) =>
          clamp255(mix(channel, rgb)),
        );
        rgb.splice(0, 3, ...result);
      };
    }
    case "invert":
      return (rgb) => {
        for (let k = 0; k < 3; k += 1) rgb[k] = 255 - rgb[k]!;
      };
    case "posterize": {
      const levels = Math.max(2, adjustment.levels ?? 4);
      return (rgb) => {
        for (let k = 0; k < 3; k += 1)
          rgb[k] =
            (Math.min(levels - 1, Math.floor((rgb[k]! / 256) * levels)) * 255) /
            (levels - 1);
      };
    }
    case "threshold": {
      const level = adjustment.level ?? 128;
      return (rgb) => {
        const value = lum(rgb) >= level ? 255 : 0;
        rgb.splice(0, 3, value, value, value);
      };
    }
    case "gradient map": {
      if (adjustment.gradientType !== "solid" || !adjustment.colorStops)
        return "its noise gradient cannot be applied";
      const lut = gradientLut(
        {
          name: adjustment.name ?? "",
          type: "solid",
          colorStops: adjustment.colorStops,
          opacityStops: adjustment.opacityStops ?? [],
        },
        Boolean(adjustment.reverse),
      );
      return (rgb) => {
        const at = Math.round(clamp255(lum(rgb))) * 4;
        const alpha = lut[at + 3]!;
        for (let k = 0; k < 3; k += 1)
          rgb[k] = rgb[k]! * (1 - alpha) + lut[at + k]! * 255 * alpha;
      };
    }
    case "selective color":
      return "Selective Color cannot be applied";
    case "color lookup":
      return "Color Lookup cannot be applied";
    default:
      return "this kind of adjustment cannot be applied";
  }
}

/** A per-channel lookup: index 0 is the RGB composite, then R, G, B. */
function perChannel(luts: (Float32Array | null)[]): ColorAdjust {
  const [composite, ...channels] = luts;
  return (rgb) => {
    for (let k = 0; k < 3; k += 1) {
      let value = rgb[k]!;
      const channel = channels[k];
      if (channel) value = lookup(channel, value);
      if (composite) value = lookup(composite, value);
      rgb[k] = value;
    }
  };
}

function lookup(lut: Float32Array, value: number): number {
  const at = Math.min(255, Math.max(0, value));
  const low = Math.floor(at);
  const high = Math.min(255, low + 1);
  return lut[low]! + (lut[high]! - lut[low]!) * (at - low);
}

export function levelsLut(channel: LevelsAdjustmentChannel): Float32Array {
  const lut = new Float32Array(256);
  const span = Math.max(1, channel.highlightInput - channel.shadowInput);
  const gamma = channel.midtoneInput > 0 ? channel.midtoneInput : 1;
  for (let v = 0; v < 256; v += 1) {
    const t = Math.min(1, Math.max(0, (v - channel.shadowInput) / span));
    lut[v] =
      channel.shadowOutput +
      t ** (1 / gamma) * (channel.highlightOutput - channel.shadowOutput);
  }
  return lut;
}

/** Photoshop's curve: a natural cubic spline through the points. */
export function curveLut(points: CurvesAdjustmentChannel): Float32Array {
  const sorted = [...points].sort((a, b) => a.input - b.input);
  const xs = sorted.map((point) => point.input);
  const ys = sorted.map((point) => point.output);
  const n = xs.length;
  const second = new Float64Array(n);
  if (n > 2) {
    // The tridiagonal system for the spline's second derivatives.
    const u = new Float64Array(n);
    for (let i = 1; i < n - 1; i += 1) {
      const sig = (xs[i]! - xs[i - 1]!) / (xs[i + 1]! - xs[i - 1]!);
      const p = sig * second[i - 1]! + 2;
      second[i] = (sig - 1) / p;
      const slope =
        (ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!) -
        (ys[i]! - ys[i - 1]!) / (xs[i]! - xs[i - 1]!);
      u[i] = ((6 * slope) / (xs[i + 1]! - xs[i - 1]!) - sig * u[i - 1]!) / p;
    }
    for (let i = n - 2; i >= 0; i -= 1)
      second[i] = second[i]! * second[i + 1]! + u[i]!;
  }
  const lut = new Float32Array(256);
  for (let v = 0; v < 256; v += 1) {
    if (n === 0) lut[v] = v;
    else if (v <= xs[0]!) lut[v] = ys[0]!;
    else if (v >= xs[n - 1]!) lut[v] = ys[n - 1]!;
    else {
      let k = 1;
      while (xs[k]! < v) k += 1;
      const h = xs[k]! - xs[k - 1]!;
      const a = (xs[k]! - v) / h;
      const b = (v - xs[k - 1]!) / h;
      lut[v] =
        a * ys[k - 1]! +
        b * ys[k]! +
        ((a * a * a - a) * second[k - 1]! + (b * b * b - b) * second[k]!) *
          ((h * h) / 6);
    }
    lut[v] = clamp255(lut[v]!);
  }
  return lut;
}

function brightnessContrast(
  brightness: number,
  contrast: number,
  legacy: boolean,
): ColorAdjust {
  const lut = new Float32Array(256);
  for (let v = 0; v < 256; v += 1) {
    let t = v / 255;
    if (legacy) {
      t += brightness / 255;
      t = (t - 0.5) * (1 + contrast / 100) + 0.5;
    } else {
      // The modern controls keep black and white where they are.
      t = t ** (1 / (1 + brightness / 150));
      const k = contrast >= 0 ? 1 + (contrast / 100) * 1.5 : 1 + contrast / 100;
      t = 0.5 + (t - 0.5) * k;
    }
    lut[v] = clamp255(t * 255);
  }
  return (rgb) => {
    for (let k = 0; k < 3; k += 1) rgb[k] = lookup(lut, rgb[k]!);
  };
}

const HUE_RANGES = [
  "reds",
  "yellows",
  "greens",
  "cyans",
  "blues",
  "magentas",
] as const;

function hueSaturation(
  adjustment: Extract<AdjustmentLayer, { type: "hue/saturation" }>,
): ColorAdjust {
  const lighten = (rgb: number[], amount: number) => {
    for (let k = 0; k < 3; k += 1)
      rgb[k] =
        amount >= 0
          ? rgb[k]! + (255 - rgb[k]!) * amount
          : rgb[k]! * (1 + amount);
  };
  if (adjustment.colorize) {
    const {
      hue = 0,
      saturation = 25,
      lightness = 0,
    } = adjustment.colorization ?? {};
    return (rgb) => {
      const gray = lum(rgb);
      const colored = hslToRgb(hue, saturation / 100, gray / 255);
      rgb.splice(0, 3, ...colored);
      lighten(rgb, lightness / 100);
    };
  }
  const master = adjustment.master ?? { hue: 0, saturation: 0, lightness: 0 };
  const ranges = HUE_RANGES.map((name) => adjustment[name]).filter(
    (range): range is HueSaturationAdjustmentChannel =>
      Boolean(range && (range.hue || range.saturation || range.lightness)),
  );
  return (rgb) => {
    const [h, s, l] = rgbToHsl(rgb);
    let hue = master.hue;
    let saturation = master.saturation;
    let lightness = master.lightness;
    for (const range of ranges) {
      const weight = rangeWeight(range, h);
      hue += range.hue * weight;
      saturation += range.saturation * weight;
      lightness += range.lightness * weight;
    }
    const factor = Math.max(0, 1 + saturation / 100);
    rgb.splice(0, 3, ...hslToRgb(h + hue, Math.min(1, s * factor), l));
    lighten(rgb, lightness / 100);
  };
}

/** How much of a hue range's change applies to a hue: ramps a→b, full b→c, ramps c→d. */
function rangeWeight(
  range: HueSaturationAdjustmentChannel,
  hue: number,
): number {
  let best = 0;
  for (const h of [hue - 360, hue, hue + 360]) {
    let weight = 0;
    if (h >= range.b && h <= range.c) weight = 1;
    else if (h > range.a && h < range.b)
      weight = (h - range.a) / (range.b - range.a);
    else if (h > range.c && h < range.d)
      weight = (range.d - h) / (range.d - range.c);
    best = Math.max(best, weight);
  }
  return best;
}

/** As GIMP's colour balance, which follows Photoshop's. */
function colorBalance(
  shadows: ColorBalanceValues | undefined,
  midtones: ColorBalanceValues | undefined,
  highlights: ColorBalanceValues | undefined,
  preserveLuminosity: boolean,
): ColorAdjust {
  const values = (balance: ColorBalanceValues | undefined) =>
    balance
      ? [balance.cyanRed, balance.magentaGreen, balance.yellowBlue].map(
          (value) => value / 100,
        )
      : [0, 0, 0];
  const s = values(shadows);
  const m = values(midtones);
  const h = values(highlights);
  const a = 0.25;
  const b = 0.333;
  const scale = 0.7;
  return (rgb) => {
    const original = lum(rgb);
    const [, , lightness] = rgbToHsl(rgb);
    const shadow = clamp01((lightness - b) / -a + 0.5) * scale;
    const midtone =
      clamp01((lightness - b) / a + 0.5) *
      clamp01((lightness + b - 1) / -a + 0.5) *
      scale;
    const highlight = clamp01((lightness + b - 1) / a + 0.5) * scale;
    for (let k = 0; k < 3; k += 1) {
      const shift = shadow * s[k]! + midtone * m[k]! + highlight * h[k]!;
      rgb[k] = clamp255(rgb[k]! + shift * 255);
    }
    if (preserveLuminosity) rgb.splice(0, 3, ...setLum(rgb, original));
  };
}

/**
 * Photoshop's Black & White: the grey rises from the smallest channel by the
 * weight of each colour the pixel is made of.
 */
function blackAndWhite(
  rgb: readonly number[],
  weight: { r: number; y: number; g: number; c: number; b: number; m: number },
): number {
  const [r = 0, g = 0, b = 0] = rgb;
  const sorted = [
    { value: r, key: "r" },
    { value: g, key: "g" },
    { value: b, key: "b" },
  ].sort((x, y) => y.value - x.value);
  const [max, mid, min] = sorted as [
    { value: number; key: string },
    { value: number; key: string },
    { value: number; key: string },
  ];
  const secondary = { rg: "y", gr: "y", gb: "c", bg: "c", rb: "m", br: "m" }[
    max.key + mid.key
  ] as "y" | "c" | "m";
  return (
    min.value +
    (mid.value - min.value) * weight[secondary] +
    (max.value - mid.value) * weight[max.key as "r" | "g" | "b"]
  );
}

// ------------------------------------------------------------- applying

/** Where an adjustment applies on the canvas: its mask times its opacity. */
export type Strength = (x: number, y: number) => number;

/** Applies the adjustment to a raster in place, as strongly as `strength` says. */
export function adjustRaster(
  raster: PlacedRaster,
  adjust: ColorAdjust,
  strength: Strength,
): void {
  const rgb = [0, 0, 0];
  const { data, width, height } = raster;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      if (data[at + 3] === 0) continue;
      const amount = strength(raster.left + x + 0.5, raster.top + y + 0.5);
      if (amount <= 0) continue;
      rgb[0] = data[at]!;
      rgb[1] = data[at + 1]!;
      rgb[2] = data[at + 2]!;
      adjust(rgb);
      for (let k = 0; k < 3; k += 1)
        data[at + k] = data[at + k]! + (rgb[k]! - data[at + k]!) * amount;
    }
  }
}

/** A CSS colour (`#rrggbb` or `rgba(…)`) adjusted, or unchanged if unreadable. */
export function adjustCssColor(
  color: string,
  adjust: ColorAdjust,
  amount: number,
): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  const rgba = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(color);
  let rgb: number[];
  let alpha = 1;
  if (hex) {
    const value = Number.parseInt(hex[1]!, 16);
    rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  } else if (rgba) {
    rgb = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  } else return color;
  const adjusted = [...rgb];
  adjust(adjusted);
  const [r, g, b] = rgb.map((value, k) =>
    Math.round(clamp255(value + (adjusted[k]! - value) * amount)),
  );
  return alpha < 1
    ? `rgba(${r}, ${g}, ${b}, ${alpha})`
    : `#${[r, g, b].map((value) => value!.toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------- colour

function lum(rgb: readonly number[]): number {
  return 0.3 * rgb[0]! + 0.59 * rgb[1]! + 0.11 * rgb[2]!;
}

/** W3C SetLum: the colour moved to a luminosity, clipped into gamut. */
function setLum(rgb: readonly number[], target: number): number[] {
  const d = target - lum(rgb);
  const c = rgb.slice(0, 3).map((value) => value + d);
  const l = lum(c);
  const min = Math.min(...c);
  const max = Math.max(...c);
  return c.map((value) => {
    let v = value;
    if (min < 0) v = l + ((v - l) * l) / (l - min || 1);
    if (max > 255) v = l + ((v - l) * (255 - l)) / (max - l || 1);
    return clamp255(v);
  });
}

function rgbToHsl(rgb: readonly number[]): [number, number, number] {
  const r = rgb[0]! / 255;
  const g = rgb[1]! / 255;
  const b = rgb[2]! / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(hue: number, s: number, l: number): number[] {
  const h = (((hue % 360) + 360) % 360) / 360;
  if (s <= 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

function toLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function fromLinear(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

function clamp255(value: number): number {
  return value <= 0 ? 0 : value >= 255 ? 255 : value;
}

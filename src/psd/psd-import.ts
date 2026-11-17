import type {
  BlendMode,
  Color,
  Layer,
  LayerEffectShadow,
  Psd,
  TextStyle,
} from "ag-psd";
import type { ProjectSourceFiles } from "../cloud/projects-api";
import { FILM_FONTS } from "../composition/film-fonts";
import { createGeneratedAdapterSource } from "../composition/generated-adapter";
import type { SceneDefinition, SceneTrackKind } from "../composition/types";
import {
  adjustCssColor,
  adjustmentFunction,
  adjustRaster,
  type ColorAdjust,
  type Strength,
} from "./psd-adjust";
import {
  colorRgb,
  enabledStyles,
  renderLayerStyle,
  type PlacedRaster,
  type Raster,
  type StyleOptions,
} from "./psd-effects";

/**
 * PSD to Video (Beta): a Photoshop file read in the browser and written as
 * Motify's own project source.
 *
 * Every Photoshop layer becomes a `data-edit` element of composition.html at
 * its Photoshop position: an <img> for a pixel layer, live text for a type
 * layer, a positioned <div> for a group. It is then a layer like any other —
 * selected and edited in the editor, animated by timeline.js, mounted and
 * exported by the same runtime. Nothing here renders or animates anything.
 *
 * The .psd never leaves the browser; only its layers' pixels are uploaded,
 * as PNG assets referenced by `motify-asset://` tokens.
 */

/** Marks an imported design's template, so the editor and the AI know it. */
export const PSD_IMPORT_MARKER = "data-psd-import";
/** The one scene an imported design starts as. */
export const PSD_SCENE_ID = "psd";
export const PSD_MAX_BYTES = 500 * 1024 * 1024;
/** Past this a project is too heavy to edit, upload, or brief the AI with. */
export const PSD_MAX_LAYERS = 150;
/** What a run costs, whatever its length: as the backend's PSD_TO_VIDEO_UNITS. */
export const PSD_TO_VIDEO_CREDITS = 20;
/** The largest canvas the editor mounts. */
const MAX_CANVAS_EDGE = 8192;
const RESERVED_IDS = new Set(["stage", PSD_SCENE_ID]);

/**
 * Photoshop blend modes CSS draws the same way. Export rasterises through SVG
 * foreignObject, which honours mix-blend-mode, so the video matches the
 * preview.
 */
const CSS_BLEND_MODES: Partial<Record<BlendMode, string>> = {
  darken: "darken",
  multiply: "multiply",
  "color burn": "color-burn",
  lighten: "lighten",
  screen: "screen",
  "color dodge": "color-dodge",
  "linear dodge": "plus-lighter",
  overlay: "overlay",
  "soft light": "soft-light",
  "hard light": "hard-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
};

/**
 * Blend modes CSS has no equivalent for, drawn with the closest one it has.
 * They blend with whatever moves beneath them, so they cannot be drawn into
 * the layer's pixels. Dissolve can, and is; Divide has no close match.
 */
const APPROXIMATE_BLEND_MODES: Partial<
  Record<BlendMode, { css: string; label: string }>
> = {
  "linear burn": { css: "multiply", label: "Multiply" },
  "darker color": { css: "darken", label: "Darken" },
  "lighter color": { css: "lighten", label: "Lighten" },
  "vivid light": { css: "hard-light", label: "Hard Light" },
  "linear light": { css: "hard-light", label: "Hard Light" },
  "pin light": { css: "hard-light", label: "Hard Light" },
  "hard mix": { css: "hard-light", label: "Hard Light" },
  subtract: { css: "difference", label: "Difference" },
};

export type PsdLayerKind = "image" | "text" | "group";

export interface PsdTextStyle {
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  /** px on the canvas */
  fontSize: number;
  color: string;
  /** em */
  letterSpacing: number;
  underline: boolean;
}

export interface PsdText {
  runs: { text: string; style: PsdTextStyle }[];
  align: "left" | "center" | "right";
  /** px */
  lineHeight: number;
  /** Paragraph text wraps inside its box; point text never wraps. */
  wraps: boolean;
  /** The text box on the canvas, px. */
  left: number;
  top: number;
  width: number;
}

export interface PsdLayerNode {
  /** Its data-edit id. */
  id: string;
  /** Its name in Photoshop. */
  name: string;
  kind: PsdLayerKind;
  /** Bounds on the canvas, px. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** 0..1 */
  opacity: number;
  hidden: boolean;
  /**
   * Pixels: every image layer, and every text layer as Photoshop drew it,
   * with its masks, layer style and adjustments drawn in. Its bounds include
   * the style.
   */
  canvas?: HTMLCanvasElement;
  /** Live text, for a type layer we could rebuild. */
  text?: PsdText;
  /**
   * A type layer shown as Photoshop's pixels instead of live text: chosen in
   * the review, or because the text could not be rebuilt faithfully.
   */
  textAsImage?: boolean;
  /**
   * The layer's own pixels before its styles, where it sits: what a clipping
   * mask above it is clipped to.
   */
  shape?: { canvas: HTMLCanvasElement; left: number; top: number };
  /** A CSS `filter`: the drop shadows of live text and of groups. */
  filter?: string;
  /** Its Photoshop blend mode as CSS `mix-blend-mode`; absent for Normal. */
  blend?: string;
  /** What did not carry over from Photoshop, in words. */
  notes: string[];
  children: PsdLayerNode[];
}

export interface PsdDocument {
  name: string;
  width: number;
  height: number;
  /** Bottom to top, the order they paint in. */
  layers: PsdLayerNode[];
  /** Fonts the text uses that Motify does not bundle. */
  missingFonts: string[];
  /** File-wide notes on what did not carry over. */
  notes: string[];
}

/** Where an import is, after the person confirms the layers. */
export interface PsdImportProgress {
  step: "upload" | "open";
  /** Layer images uploaded so far, of `total`. */
  done: number;
  total: number;
}

/** An invalid or unsupported file, in words for the person. */
export class PsdImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PsdImportError";
  }
}

export function isPsdImport(compositionHtml: string): boolean {
  return /<template\b[^>]*\bdata-psd-import\b/i.test(compositionHtml);
}

// ------------------------------------------------------------------ reading

/** Reads a .psd in the browser. Throws PsdImportError with a reason to show. */
export async function readPsdFile(file: File): Promise<PsdDocument> {
  if (!/\.psd$/i.test(file.name)) {
    throw new PsdImportError("Choose a Photoshop file ending in .psd.");
  }
  if (file.size > PSD_MAX_BYTES) {
    throw new PsdImportError(
      "This file is over 500 MB. Flatten or delete unused layers in Photoshop and try again.",
    );
  }
  const buffer = await file.arrayBuffer();
  const signature = String.fromCharCode(...new Uint8Array(buffer.slice(0, 4)));
  if (signature !== "8BPS") {
    throw new PsdImportError(
      "This isn't a Photoshop document. Save it from Photoshop as .psd and try again.",
    );
  }
  // Loaded only here, so the editor never pays for the parser until a PSD is opened.
  const { readPsd } = await import("ag-psd");
  let psd: Psd;
  try {
    // Photoshop's own composite is skipped: a file saved without "Maximize
    // compatibility" stores a blank one, and the review draws the layers instead.
    psd = readPsd(buffer, {
      skipThumbnail: true,
      skipCompositeImageData: true,
    });
  } catch (error) {
    throw new PsdImportError(
      `This Photoshop file could not be read (${error instanceof Error ? error.message : "unknown error"}). Re-save it from Photoshop and try again.`,
    );
  }
  return mapPsd(psd, file.name.replace(/\.psd$/i, ""));
}

/** ag-psd's tree as Motify layers: what each is, where it sits, what was lost. */
export function mapPsd(psd: Psd, name: string): PsdDocument {
  if (
    !(psd.width > 0 && psd.height > 0) ||
    psd.width > MAX_CANVAS_EDGE ||
    psd.height > MAX_CANVAS_EDGE
  ) {
    throw new PsdImportError(
      `The canvas is ${psd.width}×${psd.height} px; PSD to Video handles up to ${MAX_CANVAS_EDGE} px on each side. Resize the image in Photoshop and try again.`,
    );
  }
  const patterns = new Map<string, Raster>();
  for (const pattern of psd.patterns ?? []) {
    const { w, h } = pattern.bounds;
    if (w > 0 && h > 0 && pattern.data.length >= w * h * 4) {
      patterns.set(pattern.id, {
        width: w,
        height: h,
        data: new Uint8ClampedArray(
          pattern.data.buffer,
          pattern.data.byteOffset,
          w * h * 4,
        ),
      });
    }
  }
  const context: MapContext = {
    ids: new Set(RESERVED_IDS),
    fonts: new Set(),
    notes: new Set(),
    count: 0,
    style: {
      fillOpacity: 1,
      globalAngle: psd.imageResources?.globalAngle ?? 120,
      globalAltitude: psd.imageResources?.globalAltitude ?? 30,
      documentWidth: psd.width,
      documentHeight: psd.height,
      patterns,
    },
  };
  // 3 is RGB; ag-psd converts the other modes it can read.
  if (psd.colorMode !== undefined && psd.colorMode !== 3) {
    context.notes.add(
      "The file is not in RGB colour, so its colours were converted and may look slightly different.",
    );
  }
  if ((psd.bitsPerChannel ?? 8) > 8) {
    context.notes.add("16- and 32-bit colour is reduced to 8-bit.");
  }
  // Adjustments that reach the top of the file have nothing left to apply to.
  const layers = mapLayers(psd.children ?? [], context, []);
  if (context.count === 0) {
    throw new PsdImportError(
      "This file has no layers with anything on them. Check that it was saved with its layers, not flattened.",
    );
  }
  if (context.count > PSD_MAX_LAYERS) {
    throw new PsdImportError(
      `This file has ${context.count} layers; PSD to Video handles up to ${PSD_MAX_LAYERS}. Merge small decorative layers in Photoshop and try again.`,
    );
  }
  const bundled = new Set(FILM_FONTS.map((font) => font.family.toLowerCase()));
  return {
    name: name.trim() || "Photoshop design",
    width: psd.width,
    height: psd.height,
    layers,
    missingFonts: [...context.fonts].filter(
      (family) => !bundled.has(family.toLowerCase()),
    ),
    notes: [...context.notes],
  };
}

interface MapContext {
  ids: Set<string>;
  fonts: Set<string>;
  notes: Set<string>;
  count: number;
  style: StyleOptions;
}

/** An adjustment layer, ready to apply to the layers under it. */
interface Adjustment {
  adjust: ColorAdjust;
  strength: Strength;
}

/**
 * One level of the layer tree, bottom to top. `escaping` collects the
 * adjustments that reach past this level: in a pass-through group, an
 * adjustment recolours what is below the group too.
 */
function mapLayers(
  layers: readonly Layer[],
  context: MapContext,
  escaping: Adjustment[],
): PsdLayerNode[] {
  const nodes: PsdLayerNode[] = [];
  /** What each layer drew, for the clipping masks above it. */
  const drawn = new Map<Layer, PsdLayerNode | null>();
  layers.forEach((layer, index) => {
    // A clipping mask clips to the nearest layer below that is not clipped itself.
    let base: Layer | undefined;
    if (layer.clipping) {
      for (let below = index - 1; below >= 0; below -= 1) {
        if (!layers[below]!.clipping) {
          base = layers[below];
          break;
        }
      }
    }
    if (layer.adjustment) {
      if (layer.hidden) return;
      const adjustment = readAdjustment(layer, context);
      if (!adjustment) return;
      if (base) {
        // Clipped, it recolours only the layer it is clipped to.
        const target = drawn.get(base);
        if (target) applyAdjustment([target], adjustment);
        return;
      }
      applyAdjustment(nodes, adjustment);
      escaping.push(adjustment);
      return;
    }
    const passed: Adjustment[] = [];
    const node = mapLayer(
      layer,
      context,
      base ? (drawn.get(base) ?? null) : undefined,
      passed,
    );
    // A pass-through group's adjustments recolour what is below it here too.
    for (const adjustment of passed) {
      applyAdjustment(nodes, adjustment);
      escaping.push(adjustment);
    }
    drawn.set(layer, node);
    if (node) nodes.push(node);
  });
  return nodes;
}

function readAdjustment(layer: Layer, context: MapContext): Adjustment | null {
  const name = layer.name?.trim() || "Adjustment";
  const adjust = adjustmentFunction(layer.adjustment!, layer.blendMode);
  if (typeof adjust === "string") {
    context.notes.add(`Adjustment layer “${name}” is not applied: ${adjust}.`);
    return null;
  }
  const amount = clamp01(layer.opacity ?? 1) * clamp01(layer.fillOpacity ?? 1);
  if (amount <= 0) return null;
  const mask = maskSampler(layer);
  return {
    adjust,
    strength: mask ? (x, y) => amount * mask(x, y) : () => amount,
  };
}

/** Recolours the layers, and everything inside the groups among them. */
function applyAdjustment(
  nodes: readonly PsdLayerNode[],
  adjustment: Adjustment,
): void {
  for (const node of nodes) {
    if (node.kind === "group") {
      applyAdjustment(node.children, adjustment);
      continue;
    }
    if (node.canvas) {
      updateCanvas(node.canvas, node, (raster) =>
        adjustRaster(raster, adjustment.adjust, adjustment.strength),
      );
    }
    if (node.text) {
      const box = node.text;
      const amount = adjustment.strength(
        box.left + box.width / 2,
        node.top + node.height / 2,
      );
      node.text = {
        ...box,
        runs: box.runs.map((run) => ({
          ...run,
          style: {
            ...run.style,
            color: adjustCssColor(run.style.color, adjustment.adjust, amount),
          },
        })),
      };
    }
  }
}

/**
 * One layer, or null for one with nothing to show. `clipBase` is what the
 * layer is clipped to: undefined when it is not a clipping mask, null when its
 * base drew nothing we can clip to.
 */
function mapLayer(
  layer: Layer,
  context: MapContext,
  clipBase: PsdLayerNode | null | undefined,
  escaping: Adjustment[],
): PsdLayerNode | null {
  const name = layer.name?.trim() || "Layer";
  const notes: string[] = [];
  const mode = layer.blendMode;
  let blend = mode ? CSS_BLEND_MODES[mode] : undefined;
  const approximate = mode ? APPROXIMATE_BLEND_MODES[mode] : undefined;
  if (approximate) {
    blend = approximate.css;
    notes.push(
      `Blend mode “${mode}” is shown as ${approximate.label}, the closest a video can draw.`,
    );
  } else if (
    mode &&
    blend === undefined &&
    !["normal", "pass through", "dissolve"].includes(mode)
  ) {
    notes.push(`Blend mode “${mode}” is shown as Normal.`);
  }
  const base = {
    name,
    opacity: clamp01(layer.opacity ?? 1),
    hidden: Boolean(layer.hidden),
    notes,
    ...(blend ? { blend } : {}),
  };

  if (layer.children) {
    // A pass-through group lets the adjustments inside it reach below it.
    const isolated = mode !== undefined && mode !== "pass through";
    const inner: Adjustment[] = [];
    const children = mapLayers(layer.children, context, inner);
    if (!isolated) escaping.push(...inner);
    if (children.length === 0) return null;
    const groupMask = combinedMask(layer, notes);
    if (groupMask) maskDescendants(children, groupMask);
    const styles = enabledStyles(layer.effects);
    const shadows = styles.includes("drop shadow")
      ? dropShadowFilter(layer)
      : undefined;
    const lost = styles.filter((style) => style !== "drop shadow");
    if (lost.length > 0)
      notes.push(`Group layer style not imported: ${lost.join(", ")}.`);
    if (layer.artboard) {
      context.notes.add("Artboards are imported as groups on one canvas.");
    }
    const left = Math.min(...children.map((child) => child.left));
    const top = Math.min(...children.map((child) => child.top));
    const right = Math.max(
      ...children.map((child) => child.left + child.width),
    );
    const bottom = Math.max(
      ...children.map((child) => child.top + child.height),
    );
    context.count += 1;
    return {
      ...base,
      id: uniqueId(name, context.ids),
      kind: "group",
      left,
      top,
      width: right - left,
      height: bottom - top,
      ...(shadows ? { filter: shadows } : {}),
      children,
    };
  }

  let left = layer.left ?? 0;
  let top = layer.top ?? 0;
  let width = (layer.right ?? left) - left;
  let height = (layer.bottom ?? top) - top;
  let canvas = layer.canvas;
  const hasPixels = Boolean(canvas && width > 0 && height > 0);
  const isText = Boolean(layer.text?.text.trim());
  if (!hasPixels && !isText) return null;

  // The layer's own masks first: they shape it before its styles are drawn.
  if (canvas && hasPixels) {
    const mask = combinedMask(layer, notes);
    if (mask)
      canvas = updateCanvas(copyCanvas(canvas), { left, top }, (raster) =>
        multiplyAlpha(raster, mask),
      );
  }
  /** The layer's shape before its styles: what clipping masks clip to. */
  const shape = canvas && hasPixels ? { canvas, left, top } : undefined;

  const styles = enabledStyles(layer.effects);
  const fillOpacity = clamp01(layer.fillOpacity ?? 1);
  let text: (PsdText & { filter?: string }) | undefined;
  let keepAsImage = "";
  if (isText) {
    const live =
      clipBase === undefined ? readText(layer, context) : "it is clipped";
    if (typeof live === "string") {
      if (hasPixels) keepAsImage = `Kept as an image because ${live}.`;
    } else {
      text = liveTextStyle(live, layer, fillOpacity);
      const lost =
        fillOpacity < 1
          ? styles
          : styles.filter((style) => !LIVE_TEXT_STYLES.has(style));
      if (lost.length > 0) {
        keepAsImage = `Kept as an image to keep its ${lost.join(", ")}. Switch it to Text to edit the words; ${lost.length === 1 ? "that style is" : "those styles are"} then left out.`;
      }
    }
  }
  if (!text && !hasPixels) return null;
  if (keepAsImage && hasPixels) notes.push(keepAsImage);
  if (!hasPixels) {
    const lost = styles.filter((style) => !LIVE_TEXT_STYLES.has(style));
    if (lost.length > 0)
      notes.push(`Layer style not imported: ${lost.join(", ")}.`);
  }

  // Styles and Fill drawn into the pixels.
  if (canvas && hasPixels && (styles.length > 0 || fillOpacity < 1)) {
    const source = toRaster(canvas);
    // A canvas that cannot be read (no 2D context) is left as it is.
    const styled =
      source.width > 0
        ? renderLayerStyle({ ...source, left, top }, layer.effects ?? {}, {
            ...context.style,
            fillOpacity,
          })
        : undefined;
    if (styled) {
      canvas = toCanvas(styled.raster);
      ({ left, top, width, height } = styled.raster);
      notes.push(...styled.notes);
    } else if (styled === null) {
      notes.push(
        "The layer is too large to draw its layer style; it is imported without it.",
      );
    }
  }

  if (clipBase === null) {
    notes.push("Its clipping mask is not applied.");
  } else if (clipBase && canvas && hasPixels) {
    if (!clipBase.shape) notes.push("Its clipping mask is not applied.");
    else canvas = clipTo(canvas, { left, top }, clipBase.shape);
  }

  if (mode === "dissolve" && canvas && hasPixels) {
    const opacity = base.opacity;
    canvas = updateCanvas(copyCanvas(canvas), { left, top }, (raster) =>
      dissolve(raster, opacity),
    );
    base.opacity = 1;
  }

  context.count += 1;
  const textAsImage = Boolean(isText && hasPixels && (!text || keepAsImage));
  return {
    ...base,
    id: uniqueId(name, context.ids),
    kind: isText ? "text" : "image",
    left,
    top,
    width,
    height,
    ...(canvas && hasPixels ? { canvas } : {}),
    ...(shape ? { shape } : {}),
    ...(text ? { text } : {}),
    ...(textAsImage ? { textAsImage } : {}),
    ...(text?.filter ? { filter: text.filter } : {}),
    children: [],
  };
}

/** Styles live text draws itself, as CSS; the rest are only drawn in pixels. */
const LIVE_TEXT_STYLES = new Set(["drop shadow", "colour overlay"]);

/** Live text with what CSS can draw of its styles and Fill. */
function liveTextStyle(
  text: PsdText,
  layer: Layer,
  fillOpacity: number,
): PsdText & { filter?: string } {
  const effects = layer.effects;
  const enabled = !effects?.disabled;
  const overlay = enabled
    ? effects?.solidFill?.find(
        (fill) =>
          fill.enabled !== false &&
          fill.present !== false &&
          (!fill.blendMode || fill.blendMode === "normal"),
      )
    : undefined;
  const overlayColor = overlay ? colorRgb(overlay.color) : null;
  const filter = enabled ? dropShadowFilter(layer) : undefined;
  return {
    ...text,
    runs: text.runs.map((run) => {
      let color = run.style.color;
      if (overlayColor) {
        // An overlay below 100% lets the text's own colour through.
        const own = colorRgb(cssToColor(color)) ?? overlayColor;
        const amount = clamp01(overlay!.opacity ?? 1);
        color = cssColor({
          r: own[0] + (overlayColor[0] - own[0]) * amount,
          g: own[1] + (overlayColor[1] - own[1]) * amount,
          b: own[2] + (overlayColor[2] - own[2]) * amount,
        });
      }
      if (fillOpacity < 1)
        color = cssColor(cssToColor(color), color, fillOpacity);
      return { ...run, style: { ...run.style, color } };
    }),
    ...(filter ? { filter } : {}),
  };
}

function cssToColor(color: string): Color | undefined {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return undefined;
  const value = Number.parseInt(hex[1]!, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Every enabled drop shadow, as one CSS filter. */
function dropShadowFilter(layer: Layer): string | undefined {
  const shadows = (layer.effects?.dropShadow ?? []).filter(
    (shadow) => shadow.enabled !== false && shadow.present !== false,
  );
  if (shadows.length === 0 || layer.effects?.disabled) return undefined;
  return shadows.map(dropShadow).join(" ");
}

function dropShadow(shadow: LayerEffectShadow): string {
  const angle = ((shadow.angle ?? 120) * Math.PI) / 180;
  const distance = shadow.distance?.value ?? 0;
  const size = shadow.size?.value ?? 0;
  const spread = (shadow.choke?.value ?? 0) / 100;
  const x = round(-Math.cos(angle) * distance);
  const y = round(Math.sin(angle) * distance);
  const color = cssColor(shadow.color, "#000000", shadow.opacity ?? 0.75);
  // As Photoshop's own Copy CSS: the blur is the size less its spread.
  return `drop-shadow(${x}px ${y}px ${round(size * (1 - spread))}px ${color})`;
}

// ------------------------------------------------------------------ masks

/** Where a mask lets the layer show on the canvas: 0..1 at a point. */
type MaskSampler = (x: number, y: number) => number;

/** The layer's pixel mask and vector mask together, or null when it has none. */
function combinedMask(layer: Layer, notes: string[]): MaskSampler | null {
  const samplers: MaskSampler[] = [];
  const pixels = maskSampler(layer);
  if (pixels) samplers.push(pixels);
  if (layer.vectorMask && !layer.vectorMask.disable && !layer.vectorFill) {
    const vector = vectorMaskSampler(layer);
    if (vector) samplers.push(vector);
    else notes.push("Its vector mask is not applied.");
  }
  if (samplers.length === 0) return null;
  if (samplers.length === 1) return samplers[0]!;
  return (x, y) => samplers.reduce((value, sample) => value * sample(x, y), 1);
}

/** The layer's pixel mask, read once. */
function maskSampler(layer: Layer): MaskSampler | null {
  const mask = layer.mask;
  if (!mask?.canvas || mask.disabled || mask.canvas.width === 0) return null;
  const pixels = mask.canvas
    .getContext("2d")
    ?.getImageData(0, 0, mask.canvas.width, mask.canvas.height);
  if (!pixels) return null;
  const left = mask.left ?? 0;
  const top = mask.top ?? 0;
  const outside = (mask.defaultColor ?? 0) / 255;
  return (x, y) => {
    const mx = Math.floor(x - left);
    const my = Math.floor(y - top);
    if (mx < 0 || my < 0 || mx >= pixels.width || my >= pixels.height)
      return outside;
    return pixels.data[(my * pixels.width + mx) * 4]! / 255;
  };
}

/** The layer's vector mask, drawn from its paths at canvas resolution. */
function vectorMaskSampler(layer: Layer): MaskSampler | null {
  const vector = layer.vectorMask!;
  const paths = vector.paths.filter(
    (path) => !path.open && path.knots.length > 1,
  );
  if (paths.length === 0) return null;
  const points = paths.flatMap((path) =>
    path.knots.flatMap((knot) => knot.points),
  );
  const xs = points.filter((_, index) => index % 2 === 0);
  const ys = points.filter((_, index) => index % 2 === 1);
  const left = Math.floor(Math.min(...xs)) - 1;
  const top = Math.floor(Math.min(...ys)) - 1;
  const width = Math.ceil(Math.max(...xs)) + 1 - left;
  const height = Math.ceil(Math.max(...ys)) + 1 - top;
  if (!(width > 0 && height > 0) || width * height > 40_000_000) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.translate(-left, -top);
  context.fillStyle = "#fff";
  if (vector.fillStartsWithAllPixels)
    context.fillRect(left, top, width, height);
  paths.forEach((path, index) => {
    const outline = new Path2D();
    const knots = path.knots;
    outline.moveTo(knots[0]!.points[2]!, knots[0]!.points[3]!);
    for (let k = 1; k <= knots.length; k += 1) {
      const from = knots[k - 1]!.points;
      const to = knots[k % knots.length]!.points;
      // Each knot is [in-handle, anchor, out-handle].
      outline.bezierCurveTo(from[4]!, from[5]!, to[0]!, to[1]!, to[2]!, to[3]!);
    }
    outline.closePath();
    const operation =
      index === 0 && !vector.fillStartsWithAllPixels
        ? "combine"
        : (path.operation ?? "combine");
    context.globalCompositeOperation =
      operation === "subtract"
        ? "destination-out"
        : operation === "intersect"
          ? "destination-in"
          : operation === "exclude"
            ? "xor"
            : "source-over";
    context.fill(outline, path.fillRule === "even-odd" ? "evenodd" : "nonzero");
  });
  const pixels = context.getImageData(0, 0, width, height);
  const invert = Boolean(vector.invert);
  return (x, y) => {
    const mx = Math.floor(x - left);
    const my = Math.floor(y - top);
    const inside =
      mx < 0 || my < 0 || mx >= width || my >= height
        ? 0
        : pixels.data[(my * width + mx) * 4 + 3]! / 255;
    return invert ? 1 - inside : inside;
  };
}

/**
 * A group's mask cut into the layers inside it. Text it cuts through shows as
 * Photoshop's pixels, which can be cut; live text cannot.
 */
function maskDescendants(
  nodes: readonly PsdLayerNode[],
  mask: MaskSampler,
): void {
  for (const node of nodes) {
    if (node.kind === "group") {
      maskDescendants(node.children, mask);
      continue;
    }
    if (node.canvas) {
      node.canvas = updateCanvas(copyCanvas(node.canvas), node, (raster) =>
        multiplyAlpha(raster, mask),
      );
    }
    if (node.text && !node.textAsImage) {
      const box = node.text;
      const points = [
        [box.left, node.top],
        [box.left + box.width, node.top],
        [box.left, node.top + node.height],
        [box.left + box.width, node.top + node.height],
        [box.left + box.width / 2, node.top + node.height / 2],
      ] as const;
      if (points.some(([x, y]) => mask(x, y) < 0.98) && node.canvas) {
        node.textAsImage = true;
        node.notes.push(
          "Kept as an image because its group's mask cuts through it.",
        );
      }
    }
  }
}

function multiplyAlpha(raster: PlacedRaster, mask: MaskSampler): void {
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      const at = (y * raster.width + x) * 4 + 3;
      if (raster.data[at] === 0) continue;
      raster.data[at] =
        raster.data[at]! * mask(raster.left + x + 0.5, raster.top + y + 0.5);
    }
  }
}

/** Photoshop's Dissolve: each pixel shown whole or not at all, by its opacity. */
function dissolve(raster: PlacedRaster, opacity: number): void {
  let seed = 0x2f6b1d;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let at = 3; at < raster.data.length; at += 4) {
    raster.data[at] = random() < (raster.data[at]! / 255) * opacity ? 255 : 0;
  }
}

/** The layer kept only where its clipping base's own pixels are. */
function clipTo(
  source: HTMLCanvasElement,
  at: { left: number; top: number },
  base: { canvas: HTMLCanvasElement; left: number; top: number },
): HTMLCanvasElement {
  // The base drawn onto a canvas the layer's size first: compositing a smaller
  // image directly would leave everything outside it unclipped.
  const shape = document.createElement("canvas");
  shape.width = source.width;
  shape.height = source.height;
  shape
    .getContext("2d")
    ?.drawImage(base.canvas, base.left - at.left, base.top - at.top);
  const out = copyCanvas(source);
  const context = out.getContext("2d");
  if (!context) return source;
  context.globalCompositeOperation = "destination-in";
  context.drawImage(shape, 0, 0);
  return out;
}

function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  out.getContext("2d")?.drawImage(source, 0, 0);
  return out;
}

function toRaster(canvas: HTMLCanvasElement): Raster {
  const pixels = canvas
    .getContext?.("2d")
    ?.getImageData(0, 0, canvas.width, canvas.height);
  if (!pixels) return { width: 0, height: 0, data: new Uint8ClampedArray() };
  return { width: pixels.width, height: pixels.height, data: pixels.data };
}

function toCanvas(raster: Raster): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = raster.width;
  canvas.height = raster.height;
  canvas
    .getContext("2d")
    ?.putImageData(
      new ImageData(
        new Uint8ClampedArray(raster.data),
        raster.width,
        raster.height,
      ),
      0,
      0,
    );
  return canvas;
}

/** Edits a canvas's pixels in place, placed where it sits on the canvas. */
function updateCanvas(
  canvas: HTMLCanvasElement,
  at: { left: number; top: number },
  edit: (raster: PlacedRaster) => void,
): HTMLCanvasElement {
  const context = canvas.getContext?.("2d");
  if (!context || canvas.width === 0 || canvas.height === 0) return canvas;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  edit({
    width: pixels.width,
    height: pixels.height,
    data: pixels.data,
    left: at.left,
    top: at.top,
  });
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/**
 * A type layer as live text, or why it stays an image. Live text is placed
 * from Photoshop's own anchor and size, so it lands where the pixels were in
 * the same font; a missing font is substituted, never moved.
 */
function readText(layer: Layer, context: MapContext): PsdText | string {
  const data = layer.text!;
  if (data.warp?.style && data.warp.style !== "none")
    return "the text is warped";
  if (data.orientation === "vertical") return "the text is vertical";
  if (data.textPath) return "the text follows a path";
  const [xx = 1, xy = 0, yx = 0, yy = 1, tx, ty] = data.transform ?? [];
  if (Math.abs(xy) > 0.001 || Math.abs(yx) > 0.001)
    return "the text is rotated";
  if (xx <= 0 || yy <= 0) return "the text is flipped";

  // Photoshop breaks lines with \r, and soft-breaks them with ETX (U+0003).
  const content = data.text
    .replace(/\r\n?/g, "\n")
    .replaceAll(String.fromCharCode(3), "\n")
    .replace(/\n+$/, "");
  const baseStyle = data.style ?? {};
  const runs: PsdText["runs"] = [];
  let offset = 0;
  for (const run of data.styleRuns?.length
    ? data.styleRuns
    : [{ length: content.length, style: {} }]) {
    const piece = content.slice(offset, offset + run.length);
    offset += run.length;
    if (!piece) continue;
    const style = textStyle({ ...baseStyle, ...run.style }, yy, context);
    const previous = runs.at(-1);
    if (previous && sameStyle(previous.style, style)) previous.text += piece;
    else runs.push({ text: piece, style });
  }
  if (offset < content.length && runs.length > 0) {
    runs.at(-1)!.text += content.slice(offset);
  }
  if (runs.length === 0) return "the text is empty";

  const fontSize = Math.max(...runs.map((run) => run.style.fontSize));
  if (!(fontSize > 0)) return "its size could not be read";
  const lineHeight =
    baseStyle.autoLeading === false && baseStyle.leading
      ? baseStyle.leading * yy
      : fontSize * 1.2;
  const lines = content.split("\n").length;
  const justification = data.paragraphStyle?.justification ?? "left";
  const align = justification.includes("center")
    ? "center"
    : justification.includes("right")
      ? "right"
      : "left";

  const inkLeft = layer.left ?? 0;
  const inkTop = layer.top ?? 0;
  const inkWidth = (layer.right ?? inkLeft) - inkLeft;
  const inkHeight = (layer.bottom ?? inkTop) - inkTop;
  if (inkHeight > lines * lineHeight * 2.5) return "its size could not be read";
  // Where the first baseline sits under the top of an HTML line box.
  const baseline = (lineHeight - fontSize * 1.15) / 2 + fontSize * 0.92;

  if (
    data.shapeType === "box" &&
    data.boxBounds &&
    tx !== undefined &&
    ty !== undefined
  ) {
    const [boxLeft = 0, boxTop = 0, boxRight = 0] = data.boxBounds;
    return {
      runs,
      align,
      lineHeight: round(lineHeight),
      wraps: true,
      left: round(tx + boxLeft * xx),
      top: round(ty + boxTop * yy - (lineHeight - fontSize * 1.15) / 2),
      width: round((boxRight - boxLeft) * xx),
    };
  }

  // Point text never wraps; its box is wider than the ink so a substituted
  // font cannot push the last word over the edge.
  const width = Math.ceil(Math.max(inkWidth * 1.3, inkWidth + fontSize * 2));
  const anchorX =
    tx ??
    (align === "center"
      ? inkLeft + inkWidth / 2
      : align === "right"
        ? inkLeft + inkWidth
        : inkLeft);
  const left =
    align === "center"
      ? anchorX - width / 2
      : align === "right"
        ? anchorX - width
        : anchorX;
  // The anchor is the first baseline; without one, the cap height meets the ink.
  let top =
    ty !== undefined ? ty - baseline : inkTop - (baseline - fontSize * 0.72);
  if (inkHeight > 0 && Math.abs(top - inkTop) > lineHeight * 2) {
    top = inkTop - (baseline - fontSize * 0.72);
  }
  return {
    runs,
    align,
    lineHeight: round(lineHeight),
    wraps: false,
    left: round(left),
    top: round(top),
    width,
  };
}

function textStyle(
  style: TextStyle,
  scale: number,
  context: MapContext,
): PsdTextStyle {
  const font = parseFontName(style.font?.name ?? "");
  if (font.family) context.fonts.add(font.family);
  return {
    fontFamily: font.family,
    fontWeight: style.fauxBold ? Math.max(700, font.weight) : font.weight,
    fontStyle: style.fauxItalic || font.italic ? "italic" : "normal",
    fontSize: round((style.fontSize ?? 12) * scale),
    color: cssColor(style.fillColor),
    letterSpacing: round((style.tracking ?? 0) / 1000, 3),
    underline: Boolean(style.underline),
  };
}

function sameStyle(a: PsdTextStyle, b: PsdTextStyle): boolean {
  return (Object.keys(a) as (keyof PsdTextStyle)[]).every(
    (key) => a[key] === b[key],
  );
}

const WEIGHTS: readonly [RegExp, number][] = [
  [/thin|hairline/, 100],
  [/extra ?light|ultra ?light/, 200],
  [/semi ?bold|demi ?bold/, 600],
  [/extra ?bold|ultra ?bold|heavy/, 800],
  [/black/, 900],
  [/light/, 300],
  [/medium/, 500],
  [/bold/, 700],
];

/** "Montserrat-SemiBoldItalic" → Montserrat, 600, italic. */
export function parseFontName(postScriptName: string): {
  family: string;
  weight: number;
  italic: boolean;
} {
  const [familyPart = "", stylePart = ""] = postScriptName.split("-");
  const family = familyPart
    .replace(/(PSMT|MT|PS|Std)$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const style = stylePart.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const weight = WEIGHTS.find(([pattern]) => pattern.test(style))?.[1] ?? 400;
  return { family, weight, italic: /italic|oblique/.test(style) };
}

function cssColor(
  color: Color | undefined,
  fallback = "#000000",
  alpha = 1,
): string {
  const rgb = colorRgb(color);
  if (!rgb) return fallback;
  const [r, g, b] = rgb.map((value) =>
    Math.round(Math.min(255, Math.max(0, value))),
  );
  return alpha < 1
    ? `rgba(${r}, ${g}, ${b}, ${round(clamp01(alpha), 3)})`
    : `#${[r, g, b].map((value) => value!.toString(16).padStart(2, "0")).join("")}`;
}

/** A stable, readable data-edit id from the layer's name. */
function uniqueId(name: string, used: Set<string>): string {
  const slug =
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "layer";
  const stem = /^[a-z]/.test(slug) ? slug : `layer-${slug}`;
  let id = stem;
  for (let index = 2; used.has(id); index += 1) id = `${stem}-${index}`;
  used.add(id);
  return id;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

// ----------------------------------------------------------------- building

/** Every layer, depth first. */
export function flattenLayers(layers: readonly PsdLayerNode[]): PsdLayerNode[] {
  return layers.flatMap((layer) => [layer, ...flattenLayers(layer.children)]);
}

/** Whether a layer is drawn from pixels (and so needs an uploaded PNG). */
export function drawsPixels(layer: PsdLayerNode): boolean {
  return (
    layer.kind === "image" ||
    (layer.kind === "text" && (layer.textAsImage === true || !layer.text))
  );
}

/** A layer's pixels as a PNG to upload. */
export function layerPng(layer: PsdLayerNode): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!layer.canvas) {
      reject(new Error(`“${layer.name}” has no pixels.`));
      return;
    }
    layer.canvas.toBlob((blob) => {
      if (blob)
        resolve(new File([blob], `${layer.id}.png`, { type: "image/png" }));
      else reject(new Error(`“${layer.name}” could not be encoded.`));
    }, "image/png");
  });
}

export interface PsdProject {
  files: ProjectSourceFiles;
  scenes: SceneDefinition[];
  width: number;
  height: number;
  fps: number;
  duration: number;
}

/**
 * The design as Motify source. `sources` maps each pixel layer's id to its
 * image (a `motify-asset://` token); a layer without one is left out.
 */
export function buildPsdProject(
  document: PsdDocument,
  sources: ReadonlyMap<string, string>,
  options: { duration: number; title?: string },
): PsdProject {
  const duration = options.duration;
  const title = options.title ?? document.name;
  const markup = document.layers
    .map((layer) => layerMarkup(layer, sources, { left: 0, top: 0 }, "      "))
    .filter(Boolean)
    .join("\n");
  const compositionHtml = `<template ${PSD_IMPORT_MARKER}>
  <main class="mk-stage" data-motify-generation-profile="claude-foundation-v1" data-edit="stage" data-edit-label="Stage" style="width:${document.width}px;height:${document.height}px;background:#ffffff">
    <section data-scene="${PSD_SCENE_ID}" data-edit="${PSD_SCENE_ID}" data-edit-label="Photoshop design">
${markup}
    </section>
  </main>
</template>`;
  const tracks = [...document.layers]
    .reverse()
    .filter((layer) => layerIncluded(layer, sources))
    .map((layer) => ({
      id: layer.id,
      label: layer.name,
      kind: trackKind(layer, document),
      start: 0,
      end: duration,
    }));
  const scenes: SceneDefinition[] = [
    {
      id: PSD_SCENE_ID,
      label: "Photoshop design",
      start: 0,
      duration,
      accent: "#31a8ff",
      tracks,
    },
  ];
  const fps = 60;
  return {
    files: {
      "composition.html": compositionHtml,
      "styles.css": PSD_STYLES,
      "timeline.js": PSD_TIMELINE,
      "index.ts": createGeneratedAdapterSource({
        id: "psd-import",
        title,
        duration,
        scenes,
        width: document.width,
        height: document.height,
        fps,
      }),
    },
    scenes,
    width: document.width,
    height: document.height,
    fps,
    duration,
  };
}

const PSD_STYLES = `.psd-layer { position: absolute; margin: 0; padding: 0; }
img.psd-layer { display: block; max-width: none; }
.psd-text { white-space: pre; overflow-wrap: normal; }
.psd-layer[hidden] { display: none; }`;

const PSD_TIMELINE = `export function buildTimeline({ root, timeline, register }) {
  // Imported from Photoshop: every layer rests where the design put it.
  // Animate it with AI from the chat, or write its motion here.
}`;

function layerIncluded(
  layer: PsdLayerNode,
  sources: ReadonlyMap<string, string>,
): boolean {
  if (layer.kind === "group") {
    return layer.children.some((child) => layerIncluded(child, sources));
  }
  return drawsPixels(layer) ? sources.has(layer.id) : Boolean(layer.text);
}

function trackKind(layer: PsdLayerNode, document: PsdDocument): SceneTrackKind {
  if (layer.kind === "text" && !drawsPixels(layer)) return "Text";
  const coversCanvas =
    layer.left <= 0 &&
    layer.top <= 0 &&
    layer.left + layer.width >= document.width &&
    layer.top + layer.height >= document.height;
  return coversCanvas && layer.kind === "image" ? "Background" : "Element";
}

function layerMarkup(
  layer: PsdLayerNode,
  sources: ReadonlyMap<string, string>,
  origin: { left: number; top: number },
  indent: string,
): string {
  if (!layerIncluded(layer, sources)) return "";
  const attributes = [
    `data-edit="${escapeHtml(layer.id)}"`,
    `data-edit-label="${escapeHtml(layer.name)}"`,
  ];
  const hidden = layer.hidden ? " hidden" : "";
  const common = [
    ...(layer.opacity < 1 ? [`opacity:${round(layer.opacity, 3)}`] : []),
    ...(layer.filter ? [`filter:${layer.filter}`] : []),
    ...(layer.blend ? [`mix-blend-mode:${layer.blend}`] : []),
  ];
  const box = (left: number, top: number) =>
    `left:${round(left - origin.left)}px;top:${round(top - origin.top)}px`;

  if (layer.kind === "group") {
    const children = layer.children
      .map((child) => layerMarkup(child, sources, layer, `${indent}  `))
      .filter(Boolean)
      .join("\n");
    const style = [
      box(layer.left, layer.top),
      `width:${layer.width}px;height:${layer.height}px`,
      ...common,
    ].join(";");
    return `${indent}<div class="psd-layer" ${attributes.join(" ")} style="${style}"${hidden}>\n${children}\n${indent}</div>`;
  }

  if (drawsPixels(layer)) {
    const style = [
      box(layer.left, layer.top),
      `width:${layer.width}px;height:${layer.height}px`,
      ...common,
    ].join(";");
    return `${indent}<img class="psd-layer" ${attributes.join(" ")} src="${escapeHtml(sources.get(layer.id)!)}" alt="${escapeHtml(layer.name)}" style="${style}"${hidden}>`;
  }

  const text = layer.text!;
  const [first] = text.runs;
  const style = [
    box(text.left, text.top),
    `width:${text.width}px`,
    styleDeclarations(first!.style),
    `line-height:${text.lineHeight}px`,
    `text-align:${text.align}`,
    ...(text.wraps ? ["white-space:pre-wrap"] : []),
    ...common,
  ].join(";");
  const content = text.runs
    .map((run) =>
      sameStyle(run.style, first!.style)
        ? escapeHtml(run.text)
        : `<span style="${styleDeclarations(run.style)}">${escapeHtml(run.text)}</span>`,
    )
    .join("");
  return `${indent}<p class="psd-layer psd-text" ${attributes.join(" ")} style="${style}"${hidden}>${content}</p>`;
}

function styleDeclarations(style: PsdTextStyle): string {
  // The file's own font first, then the bundled ones that cover Latin and Khmer.
  const families = [
    ...new Set(
      [style.fontFamily, "Inter", "Kantumruy Pro"]
        .map((family) => family.replace(/['"\\<>]/g, ""))
        .filter(Boolean),
    ),
  ]
    .map((family) => `'${family}'`)
    .join(", ");
  return [
    `font-family:${families}, system-ui, sans-serif`,
    `font-size:${style.fontSize}px`,
    `font-weight:${style.fontWeight}`,
    ...(style.fontStyle === "italic" ? ["font-style:italic"] : []),
    `color:${style.color}`,
    ...(style.letterSpacing ? [`letter-spacing:${style.letterSpacing}em`] : []),
    ...(style.underline ? ["text-decoration:underline"] : []),
  ].join(";");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

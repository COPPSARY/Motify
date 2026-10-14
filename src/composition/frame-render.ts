import {
  FILM_FONTS,
  filmFontFaceCss,
  filmFontsUsedIn,
  type FilmFont,
} from "./film-fonts";
import type { FrameLayout } from "./canvas-frame";
import { rawFilmDocument } from "./raw-film";
import type { CompositionRuntime } from "./runtime";

/**
 * Rasterizes the mounted film into canvases: the authored frame on its own,
 * and the output canvas with the frame placed in it. Kept apart from the
 * encoder so the editor can draw the blurred backdrop without loading muxers.
 */

const embeddedImageCache = new Map<string, Promise<string>>();
const embeddedFontCss = new Map<string, Promise<string>>();
let watermarkImage: Promise<HTMLImageElement> | undefined;

const WATERMARK_URL = "/motify-watermark-smoke.png";

async function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not embed an image."));
    reader.readAsDataURL(blob);
  });
}
function embeddedImageDataUrl(url: string): Promise<string> {
  let embeddedImage = embeddedImageCache.get(url);
  if (!embeddedImage) {
    embeddedImage = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Could not embed ${url} for export.`);
      return blobAsDataUrl(await response.blob());
    });
    embeddedImageCache.set(url, embeddedImage);
  }
  return embeddedImage;
}

async function inlineImages(source: Element, clone: Element): Promise<void> {
  const sourceImages = Array.from(source.querySelectorAll("img"));
  const cloneImages = Array.from(clone.querySelectorAll("img"));
  await Promise.all(
    sourceImages.map(async (image, index) => {
      const target = cloneImages[index];
      const url = image.currentSrc || image.src;
      if (!target || !url || url.startsWith("data:")) return;
      target.src = await embeddedImageDataUrl(url);
    }),
  );
}

/**
 * The bundled faces a film names, embedded for export.
 *
 * A frame is rasterized as an SVG image, and an SVG image cannot reach the
 * page's loaded fonts or fetch any of its own, so every exported frame fell
 * back to a system face with different widths: a headline that wrapped in
 * preview sat on one line in the video. Inlining the face as a data URL is the
 * one form the image is allowed to use. Inter is always included, as the
 * editor's typeface and the kit's default.
 */
function embeddedFilmFont(font: FilmFont): Promise<string> {
  let css = embeddedFontCss.get(font.family);
  if (!css) {
    css = embeddedImageDataUrl(font.url)
      .then((url) => filmFontFaceCss([font], () => url))
      // A missing face degrades to the system font, exactly as before.
      .catch(() => "");
    embeddedFontCss.set(font.family, css);
  }
  return css;
}

export async function exportFontCss(source: string): Promise<string> {
  const used = filmFontsUsedIn(source);
  const fonts = used.some((font) => font.family === "Inter")
    ? used
    : [FILM_FONTS[0]!, ...used];
  return (await Promise.all(fonts.map(embeddedFilmFont))).join("");
}

const BUNDLED_FONT_URLS = new Set(FILM_FONTS.map((font) => font.url));

/**
 * A brand's own `@font-face` files, inlined into the clone's styles. Like the
 * bundled faces, a url() the SVG image would have to fetch never loads.
 */
export async function inlineFontFaces(clone: Element): Promise<void> {
  await Promise.all(
    Array.from(clone.querySelectorAll("style")).map(async (style) => {
      const css = style.textContent ?? "";
      if (!css.includes("@font-face")) return;
      const urls = new Set<string>();
      for (const face of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
        for (const match of face.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
          const url = match[2]!;
          if (!url.startsWith("data:") && !BUNDLED_FONT_URLS.has(url))
            urls.add(url);
        }
      }
      if (urls.size === 0) return;
      let inlined = css;
      for (const url of urls) {
        try {
          inlined = inlined.split(url).join(await embeddedImageDataUrl(url));
        } catch {
          // An unreachable font file degrades to the fallback family.
        }
      }
      style.textContent = inlined;
    }),
  );
}

async function imageFromSvg(svg: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "sync";
  // Blob URLs containing foreignObject taint Chrome canvases, which prevents
  // WebCodecs from constructing a VideoFrame. A data URL stays origin-clean.
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}

function loadWatermark(): Promise<HTMLImageElement> {
  watermarkImage ??= embeddedImageDataUrl(WATERMARK_URL).then(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  });
  return watermarkImage;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas export is unavailable.");
  return context;
}

/**
 * Each <canvas> in `clone` replaced by an image of its counterpart in
 * `source` as drawn right now. A cloned canvas is blank, and an SVG image
 * cannot draw one anyway, so without this every canvas exports empty. A
 * WebGL canvas only keeps its pixels with `preserveDrawingBuffer`.
 */
export function snapshotCanvases(source: ParentNode, clone: ParentNode): void {
  const sources = Array.from(source.querySelectorAll("canvas"));
  const targets = Array.from(clone.querySelectorAll("canvas"));
  sources.forEach((canvas, index) => {
    const target = targets[index];
    if (!target) return;
    let url: string;
    try {
      url = canvas.toDataURL("image/png");
    } catch {
      // A canvas tainted by a cross-origin image cannot be read; leave it.
      return;
    }
    const image = target.ownerDocument.createElement("img");
    for (const attribute of Array.from(target.attributes))
      image.setAttribute(attribute.name, attribute.value);
    image.setAttribute("src", url);
    // The laid-out size, not the backing store's pixel size.
    image.style.width = `${canvas.clientWidth || canvas.width}px`;
    image.style.height = `${canvas.clientHeight || canvas.height}px`;
    target.replaceWith(image);
  });
}

/**
 * A raw film's frame: its whole document, as the iframe shows it now, drawn
 * through the same SVG image as any other film, so it exports what preview
 * shows. Scripts and audio are left out; images, canvases and fonts are inlined.
 */
async function renderRawFrame(
  doc: Document,
  width: number,
  height: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const live = doc.documentElement;
  const clone = live.cloneNode(true) as HTMLElement;
  // Images pair up by position, so they are inlined before canvases become images.
  await inlineImages(live, clone);
  snapshotCanvases(live, clone);
  clone
    .querySelectorAll("script, audio, noscript, style[data-motify-fonts]")
    .forEach((node) => node.remove());
  await inlineFontFaces(clone);
  const fontCss = await exportFontCss(live.outerHTML);
  if (fontCss) {
    const fontStyle = doc.createElement("style");
    fontStyle.textContent = fontCss;
    (clone.querySelector("head") ?? clone).append(fontStyle);
  }
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const image = await imageFromSvg(svg);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  context2d(canvas).drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** The film exactly as authored, at `scale` times its authored size. */
export async function renderAuthoredFrame(
  runtime: CompositionRuntime,
  scale = 1,
): Promise<HTMLCanvasElement> {
  // An adaptive film is mounted at the canvas size rather than its authored one.
  const { width, height } = runtime.mountedSize;
  const rawDocument = rawFilmDocument(runtime.root);
  if (rawDocument) return renderRawFrame(rawDocument, width, height, scale);
  const clone = runtime.root.cloneNode(true) as HTMLElement;
  // Images pair up by position, so they are inlined before canvases become images.
  await inlineImages(runtime.root, clone);
  snapshotCanvases(runtime.root, clone);
  // The preview's watermark sits on the canvas, not in the film.
  clone
    .querySelectorAll("[data-motify-watermark]")
    .forEach((node) => node.remove());
  await inlineFontFaces(clone);
  const fontCss = await exportFontCss(clone.outerHTML);
  if (fontCss) {
    const fontStyle = document.createElement("style");
    fontStyle.textContent = fontCss;
    // Last, so it outranks the scene kit's own url() face, which an SVG image
    // is not allowed to fetch: of two equal @font-face rules the later wins.
    clone.append(fontStyle);
  }
  clone.style.position = "relative";
  clone.style.inset = "auto";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.transform = "none";
  clone.style.border = "0";
  clone.style.borderRadius = "0";
  clone.style.boxShadow = "none";
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${serialized}</div></foreignObject></svg>`;
  const image = await imageFromSvg(svg);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  context2d(canvas).drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Draws `frame` scaled to cover `width` x `height`, centred and cropped. */
export function drawCover(
  context: CanvasRenderingContext2D,
  frame: CanvasImageSource & { width: number; height: number },
  width: number,
  height: number,
): void {
  const cover = Math.max(width / frame.width, height / frame.height);
  const drawWidth = frame.width * cover;
  const drawHeight = frame.height * cover;
  context.drawImage(
    frame,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

/** Share of the backdrop's resolution; the blur hides how coarse it is. */
const BACKDROP_RESOLUTION = 1 / 12;

/**
 * The fitted film's surroundings: the same frame enlarged to cover the canvas,
 * blurred and dimmed, so the bars read as part of the shot instead of black.
 * The editor preview draws the same thing with a CSS blur.
 */
export function drawBlurredBackdrop(
  context: CanvasRenderingContext2D,
  frame: CanvasImageSource & { width: number; height: number },
  width: number,
  height: number,
): void {
  const small = document.createElement("canvas");
  small.width = Math.max(2, Math.round(width * BACKDROP_RESOLUTION));
  small.height = Math.max(2, Math.round(height * BACKDROP_RESOLUTION));
  const smallContext = context2d(small);
  // Blurring the small copy is cheap; scaling it up smooths it further.
  smallContext.filter = "blur(2px)";
  drawCover(smallContext, frame, small.width, small.height);
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(small, 0, 0, width, height);
  context.fillStyle = "rgba(0, 0, 0, 0.35)";
  context.fillRect(0, 0, width, height);
  context.restore();
}

async function drawWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<void> {
  const image = await loadWatermark();
  const drawWidth = Math.round(width * 0.21);
  const drawHeight = Math.round(
    (drawWidth / Math.max(1, image.naturalWidth)) * image.naturalHeight,
  );
  context.save();
  context.globalAlpha = 0.8;
  context.drawImage(
    image,
    width - drawWidth + Math.round(width * 0.008),
    height - drawHeight + Math.round(height * 0.007),
    drawWidth,
    drawHeight,
  );
  context.restore();
}

/**
 * One output frame: the authored film placed on the runtime's canvas. A fitted
 * film sits on its own blurred backdrop; a filled one is cropped to cover.
 */
export async function renderCompositionFrame(
  runtime: CompositionRuntime,
  scale = 1,
  watermark = false,
): Promise<HTMLCanvasElement> {
  const { width, height } = runtime.canvasDimensions;
  const layout: FrameLayout = runtime.frame;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = context2d(canvas);
  // Rasterized at the size it is drawn, so text stays sharp.
  const frame = await renderAuthoredFrame(runtime, layout.scale * scale);
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  // Wherever the placed frame may not reach, show the film's own surround.
  if (!layout.identity && runtime.canvas.framing !== "fill") {
    drawBlurredBackdrop(context, frame, canvas.width, canvas.height);
  }
  context.drawImage(
    frame,
    layout.x * scale,
    layout.y * scale,
    runtime.mountedSize.width * layout.scale * scale,
    runtime.mountedSize.height * layout.scale * scale,
  );
  if (watermark) await drawWatermark(context, canvas.width, canvas.height);
  return canvas;
}

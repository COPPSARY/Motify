import interLatinUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import type { FrameLayout } from "./canvas-frame";
import type { CompositionRuntime } from "./runtime";

/**
 * Rasterizes the mounted film into canvases: the authored frame on its own,
 * and the output canvas with the frame placed in it. Kept apart from the
 * encoder so the editor can draw the blurred backdrop without loading muxers.
 */

const embeddedImageCache = new Map<string, Promise<string>>();
let embeddedFontCss: Promise<string> | undefined;
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
 * The editor's typeface, embedded for export.
 *
 * A frame is rasterized as an SVG image, and an SVG image cannot reach the
 * page's loaded fonts or fetch any of its own. The editor shows Inter because
 * `main.ts` loads it; every exported frame silently fell back to a system face
 * with different widths, so a headline that wrapped in preview sat on one line
 * in the video and the whole layout shifted. Inlining the Latin variable face
 * (48KB) as a data URL is the one form the image is allowed to use.
 */
function exportFontCss(): Promise<string> {
  embeddedFontCss ??= fetch(interLatinUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Inter could not be embedded.");
      return response.blob();
    })
    .then(blobAsDataUrl)
    // Registered under both names: fontsource calls the face "Inter Variable",
    // while generated films routinely ask for plain "Inter".
    .then((url) =>
      ["Inter Variable", "Inter"]
        .map(
          (family) =>
            `@font-face{font-family:"${family}";font-style:normal;font-display:block;font-weight:100 900;src:url(${url}) format("woff2");}`,
        )
        .join(""),
    )
    // A missing face degrades to the system font, exactly as before.
    .catch(() => "");
  return embeddedFontCss;
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

/** The film exactly as authored, at `scale` times its authored size. */
export async function renderAuthoredFrame(
  runtime: CompositionRuntime,
  scale = 1,
): Promise<HTMLCanvasElement> {
  // An adaptive film is mounted at the canvas size rather than its authored one.
  const { width, height } = runtime.mountedSize;
  const clone = runtime.root.cloneNode(true) as HTMLElement;
  await inlineImages(runtime.root, clone);
  // The preview's watermark sits on the canvas, not in the film.
  clone
    .querySelectorAll("[data-motify-watermark]")
    .forEach((node) => node.remove());
  const fontCss = await exportFontCss();
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

import {
  FILM_FONTS,
  filmFontFaceCss,
  filmFontsUsedIn,
  namesFamily,
  variableFamily,
  withoutFontFaceRules,
  type FilmFont,
} from "./film-fonts";
import type { FrameLayout } from "./canvas-frame";
import { counterpart, emptyHolders, planDirectClips } from "./direct-clips";
import { profileCount, profileNow, profileStage } from "./export-profile";
import { rawFilmDocument } from "./raw-film";
import type { CompositionRuntime } from "./runtime";
import { seekVideosExactly } from "./video-sync";

/** A clip's decoded frame, as the export's clip reader hands it over. */
export interface ClipPicture {
  readonly displayWidth: number;
  readonly displayHeight: number;
  draw(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void;
}
export type ClipPictures = Map<HTMLVideoElement, ClipPicture>;

/** Where an export gets its clips' frames (export-clip-frames.ts). */
export interface ExportClipPictures {
  /** Every clip on screen at `time`: decoded, or else placed on its <video>. */
  place(root: ParentNode, time: number): Promise<ClipPictures>;
  /** False puts every clip into the page image; true (the default) draws plain ones straight onto the canvas. */
  direct?: boolean;
}

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
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
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

/** Pictures re-encoded smaller than this many bytes are not worth it. */
const SHRINK_MIN_BYTES = 200_000;
/** Room for a picture the film scales up past the frame (a push-in). */
const PICTURE_HEADROOM = 1.25;

/** `width` x `height` fitted inside `maxEdge` on its long side, never enlarged. */
export function boundedPictureSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const ratio = Math.min(1, maxEdge / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * The long edge a picture needs in a frame rendered `width` x `height` at
 * `scale`: never more than the frame itself, with a little room for a zoom.
 * Kept to steps of 256px, so one export encodes each picture once.
 */
export function pictureEdgeFor(
  width: number,
  height: number,
  scale: number,
): number {
  const edge = Math.max(width, height) * scale * PICTURE_HEADROOM;
  return Math.max(512, Math.ceil(edge / 256) * 256);
}

async function shrunkDataUrl(blob: Blob, maxEdge: number): Promise<string> {
  if (
    blob.size < SHRINK_MIN_BYTES ||
    !/^image\/(png|jpeg|webp)$/.test(blob.type) ||
    typeof createImageBitmap !== "function"
  )
    return blobAsDataUrl(blob);
  const bitmap = await createImageBitmap(blob);
  try {
    const size = boundedPictureSize(bitmap.width, bitmap.height, maxEdge);
    if (size.width === bitmap.width && blob.type !== "image/png")
      return blobAsDataUrl(blob);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return blobAsDataUrl(blob);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    // WebP keeps a logo's transparency at a fraction of PNG's size; a browser
    // that cannot write it hands back PNG, which is still the smaller picture.
    const shrunk = canvas.toDataURL("image/webp", 0.92);
    const original = await blobAsDataUrl(blob);
    return shrunk.length < original.length ? shrunk : original;
  } finally {
    bitmap.close();
  }
}

/**
 * A picture for an exported frame, no larger than the frame needs.
 *
 * Every frame is drawn as an SVG image with its pictures inlined, and the
 * browser decodes each of them again for every frame. A phone screenshot sent
 * whole is megabytes of text and millions of pixels per picture per frame, so
 * a film with three or four of them exported many times slower than one
 * without. Scaled to the frame, it looks the same.
 */
function embeddedPictureDataUrl(url: string, maxEdge: number): Promise<string> {
  const key = `${maxEdge} ${url}`;
  let embedded = embeddedImageCache.get(key);
  if (!embedded) {
    embedded = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Could not embed ${url} for export.`);
      const blob = await response.blob();
      // A picture that cannot be re-encoded is still exported, whole.
      return shrunkDataUrl(blob, maxEdge).catch(() => blobAsDataUrl(blob));
    });
    embeddedImageCache.set(key, embedded);
  }
  return embedded;
}

/** One transparent pixel, standing in for a picture nobody can see. */
const BLANK_PICTURE =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/**
 * Whether `element` can put anything on the page right now: neither it nor
 * anything it sits in is undisplayed, hidden or fully transparent. A browser
 * that cannot say is taken to show everything.
 */
export function showsNow(element: Element): boolean {
  const check = (
    element as Element & {
      checkVisibility?: (options?: Record<string, boolean>) => boolean;
    }
  ).checkVisibility;
  if (typeof check !== "function") return true;
  return check.call(element, {
    // The same two questions under their older and newer names.
    checkOpacity: true,
    checkVisibilityCSS: true,
    opacityProperty: true,
    visibilityProperty: true,
  });
}

async function inlineImages(
  source: Element,
  clone: Element,
  maxEdge: number,
): Promise<void> {
  const sourceImages = Array.from(source.querySelectorAll("img"));
  const cloneImages = Array.from(clone.querySelectorAll("img"));
  await Promise.all(
    sourceImages.map(async (image, index) => {
      const target = cloneImages[index];
      const url = image.currentSrc || image.src;
      if (!target || !url) return;
      // A film keeps every scene's pictures on the page and shows a few at a
      // time. One that is not showing goes in as a blank of the same size:
      // put in whole, each of them was megabytes for the frame to carry and
      // read, for nothing.
      const shown = showsNow(image);
      if (url.startsWith("data:") && shown) return;
      if (!shown) target.src = BLANK_PICTURE;
      else
        try {
          target.src = await embeddedPictureDataUrl(url, maxEdge);
        } catch (error) {
          // One picture that cannot be read leaves a gap, not a failed export.
          console.warn("[Export] a picture was left out", url, error);
          target.removeAttribute("src");
          return;
        }
      // A picture sized by its own pixels would shrink with them: pin it to
      // the size it is laid out at now, which changes nothing for the rest.
      const laid = (image.ownerDocument.defaultView ?? window).getComputedStyle(
        image,
      );
      if (laid.display !== "none" && laid.width.endsWith("px")) {
        target.style.width = laid.width;
        target.style.height = laid.height;
      }
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
function embeddedFilmFont(font: FilmFont, variable: boolean): Promise<string> {
  // A family split into script files has one entry per file.
  const key = `${font.family}|${font.url}|${variable}`;
  let css = embeddedFontCss.get(key);
  if (!css) {
    css = embeddedImageDataUrl(font.url)
      .then((url) =>
        filmFontFaceCss(
          [font],
          () => url,
          // Each name carries the whole file again, so the fontsource name
          // is only declared for a film that sets something in it.
          () =>
            variable
              ? [font.family, variableFamily(font.family)]
              : [font.family],
        ),
      )
      // A missing face degrades to the system font, exactly as before.
      .catch(() => "");
    embeddedFontCss.set(key, css);
  }
  return css;
}

export async function exportFontCss(source: string): Promise<string> {
  // Only what the film sets text in: every face it merely declares would be
  // embedded in, and read back out of, each frame.
  const styled = withoutFontFaceRules(source);
  const used = filmFontsUsedIn(styled);
  const fonts = used.some((font) => font.family === "Inter")
    ? used
    : [FILM_FONTS[0]!, ...used];
  return (
    await Promise.all(
      fonts.map((font) =>
        embeddedFilmFont(
          font,
          namesFamily(styled, variableFamily(font.family)),
        ),
      ),
    )
  ).join("");
}

/**
 * The embedded faces for a whole export, found once for the film and once for
 * each card film in it. A film names its fonts in its styles, which do not
 * change from frame to frame, and looking for them means reading the whole
 * page.
 */
const exportFonts = new WeakMap<
  ExportClipPictures,
  WeakMap<Element, Promise<string>>
>();

function fontCssFor(
  clips: ExportClipPictures | undefined,
  live: Element,
): Promise<string> {
  if (!clips) return exportFontCss(live.outerHTML);
  let found = exportFonts.get(clips);
  if (!found) {
    found = new WeakMap();
    exportFonts.set(clips, found);
  }
  let css = found.get(live);
  if (!css) {
    css = exportFontCss(live.outerHTML);
    found.set(live, css);
  }
  return css;
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

/**
 * The last page image an export drew, kept as pixels. With its clips drawn
 * straight onto the canvas, an export's page image is the captions, titles
 * and cards alone, and most frames show the same ones as the frame before:
 * that frame's pixels are used again instead of drawing the page anew, which
 * is most of a frame's time.
 */
let lastOverlay:
  | { svg: string; width: number; height: number; pixels: HTMLCanvasElement }
  | undefined;

/**
 * The canvases an export draws each frame on, kept from one frame to the
 * next. A new full-size canvas for every frame is a new surface on the GPU
 * for every frame, and the old ones are only let go when the collector gets
 * to them: on integrated graphics that alone was most of a frame's time.
 */
const frameCanvases = new Map<string, HTMLCanvasElement>();

function frameCanvas(
  name: string,
  width: number,
  height: number,
  reuse: boolean,
): HTMLCanvasElement {
  let canvas = reuse ? frameCanvases.get(name) : undefined;
  if (!canvas) {
    canvas = document.createElement("canvas");
    if (reuse) frameCanvases.set(name, canvas);
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  } else if (reuse) {
    const context = context2d(canvas);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
  }
  return canvas;
}

/** Lets go of what the last export kept between frames. */
export function releaseExportFrameCache(): void {
  if (lastOverlay) lastOverlay.pixels.width = 0;
  lastOverlay = undefined;
  for (const canvas of frameCanvases.values()) canvas.width = 0;
  frameCanvases.clear();
}

async function overlayPixels(
  svg: string,
  width: number,
  height: number,
): Promise<CanvasImageSource> {
  if (
    lastOverlay &&
    lastOverlay.svg === svg &&
    lastOverlay.width === width &&
    lastOverlay.height === height
  ) {
    profileCount("page image reused");
    return lastOverlay.pixels;
  }
  const image = await imageFromSvg(svg);
  // Kept on a canvas: an ImageBitmap made from this image taints any canvas
  // it is drawn on, and a tainted frame cannot be encoded.
  const pixels = document.createElement("canvas");
  pixels.width = width;
  pixels.height = height;
  context2d(pixels).drawImage(image, 0, 0, width, height);
  profileCount("page image drawn");
  if (lastOverlay) lastOverlay.pixels.width = 0;
  lastOverlay = { svg, width, height, pixels };
  return pixels;
}

/**
 * Elements that paint nothing now and take no room in their layout: those
 * not displayed, and invisible ones (opacity 0) positioned out of the flow.
 * An export leaves them out of the page image so it has less to lay out, and
 * their animation does not change the image from frame to frame.
 */
const KEPT_TAGS = new Set([
  "STYLE",
  "SCRIPT",
  "TEMPLATE",
  "LINK",
  "META",
  "TITLE",
  "HEAD",
]);

function unseenElements(root: HTMLElement): HTMLElement[] {
  const view = root.ownerDocument.defaultView ?? window;
  const unseen: HTMLElement[] = [];
  const walk = (element: Element) => {
    for (const child of Array.from(element.children)) {
      if (!(child instanceof HTMLElement)) continue;
      // A style sheet is "not displayed" too, and must stay.
      if (KEPT_TAGS.has(child.tagName)) continue;
      const style = view.getComputedStyle(child);
      if (
        style.display === "none" ||
        (parseFloat(style.opacity) === 0 &&
          (style.position === "absolute" || style.position === "fixed"))
      ) {
        unseen.push(child);
        continue;
      }
      walk(child);
    }
  };
  walk(root);
  return unseen;
}

let inertDocument: Document | undefined;

/**
 * A copy of `element` and everything in it, in a document that loads nothing.
 *
 * A plain `cloneNode` copy belongs to the page, and the page starts loading
 * every <video>, <audio> and <img> in it the moment it exists, attached or
 * not: for each frame of an export, each clip in the film was fetched again
 * and given a decoder of its own, only to be thrown away. A film cut from a
 * dozen shots spent nearly all of its export on that. A document with no
 * window loads nothing, and its elements serialize exactly the same.
 */
export function inertClone<T extends Element>(element: T): T {
  inertDocument ??= document.implementation.createHTMLDocument("");
  return inertDocument.importNode(element, true);
}

/**
 * An SVG document as an image address. Blob URLs containing foreignObject
 * taint Chrome canvases, which prevents WebCodecs from constructing a
 * VideoFrame. A data URL stays origin-clean.
 */
function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function imageFromSvg(svg: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "sync";
  image.src = svgDataUrl(svg);
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
      // Reading a canvas back and encoding it is slow; one that is not
      // showing is not worth it.
      url = showsNow(canvas) ? canvas.toDataURL("image/png") : BLANK_PICTURE;
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
 * The pixels a clip laid out `width` x `height` needs at `scale`: the
 * covering side keeps every pixel the output can show, never more than the
 * clip has.
 */
function pictureSize(
  width: number,
  height: number,
  pixelWidth: number,
  pixelHeight: number,
  scale: number,
): { width: number; height: number } {
  const fit = Math.min(
    1,
    Math.max((width * scale) / pixelWidth, (height * scale) / pixelHeight),
  );
  return {
    width: Math.max(1, Math.round(pixelWidth * fit)),
    height: Math.max(1, Math.round(pixelHeight * fit)),
  };
}

function blobAsDataUrlFast(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed."));
    reader.readAsDataURL(blob);
  });
}

/**
 * The export's decoded clip frames that show, as JPEG data URLs for
 * `snapshotVideos`. They are encoded off the page's thread, in parallel: a
 * canvas encoded in place stalls behind the decoder's work, up to a second a
 * frame. A clip that cannot be encoded here is left to `snapshotVideos`.
 */
export async function encodeClipPictures(
  pictures: ClipPictures | undefined,
  scale: number,
): Promise<Map<HTMLVideoElement, string>> {
  const urls = new Map<HTMLVideoElement, string>();
  if (!pictures || typeof OffscreenCanvas !== "function") return urls;
  await Promise.all(
    [...pictures].map(async ([video, picture]) => {
      const view = video.ownerDocument.defaultView ?? window;
      if (view.getComputedStyle(video).visibility === "hidden") return;
      if (picture.displayWidth <= 0 || picture.displayHeight <= 0) return;
      const size = pictureSize(
        video.clientWidth || picture.displayWidth,
        video.clientHeight || picture.displayHeight,
        picture.displayWidth,
        picture.displayHeight,
        scale,
      );
      try {
        const canvas = new OffscreenCanvas(size.width, size.height);
        const context = canvas.getContext("2d");
        if (!context) return;
        picture.draw(context, 0, 0, size.width, size.height);
        const blob = await canvas.convertToBlob({
          type: "image/jpeg",
          quality: 0.92,
        });
        urls.set(video, await blobAsDataUrlFast(blob));
      } catch (error) {
        console.warn("[Export] a clip frame could not be encoded", error);
      }
    }),
  );
  return urls;
}

/**
 * Each <video> in `clone` replaced by an image of the frame its counterpart in
 * `source` shows right now. An SVG image cannot play a video, so without this
 * every clip exports empty. The image keeps the clip's attributes, and its
 * laid-out size and fit, so it sits exactly where the clip did.
 *
 * Encoding a frame is most of an export's time, so a clip that is not visible
 * right now (a footage edit has one per segment) is not drawn at all, and a
 * visible one is drawn no larger than it appears in the output at `scale`.
 */
export function snapshotVideos(
  source: ParentNode,
  clone: ParentNode,
  scale = Number.POSITIVE_INFINITY,
  pictureUrls?: ReadonlyMap<HTMLVideoElement, string>,
  /** Clips drawn on the canvas instead; the image leaves them out. */
  leftOut?: ReadonlySet<HTMLVideoElement>,
): void {
  const sources = Array.from(source.querySelectorAll("video"));
  const targets = Array.from(clone.querySelectorAll("video"));
  sources.forEach((video, index) => {
    const target = targets[index];
    if (!target) return;
    const width = video.clientWidth || video.videoWidth;
    const height = video.clientHeight || video.videoHeight;
    const view = video.ownerDocument.defaultView ?? window;
    if (leftOut?.has(video)) {
      // Drawn on the canvas: nothing of it (not even its moving style) goes into the image.
      target.replaceWith(target.ownerDocument.createElement("i"));
      return;
    }
    const shown = view.getComputedStyle(video).visibility !== "hidden";
    // The export's decoded frame for this clip, already encoded, else the <video>'s own.
    let url = (shown && pictureUrls?.get(video)) || "";
    if (!url && shown && video.videoWidth > 0 && video.readyState >= 2) {
      const size = pictureSize(
        width,
        height,
        video.videoWidth,
        video.videoHeight,
        scale,
      );
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      try {
        context2d(canvas).drawImage(video, 0, 0, canvas.width, canvas.height);
        url = canvas.toDataURL("image/jpeg", 0.92);
      } catch {
        // A clip from another origin cannot be read; it exports empty.
        url = "";
      }
    }
    const image = target.ownerDocument.createElement("img");
    for (const attribute of Array.from(target.attributes))
      if (!["src", "poster", "autoplay", "controls"].includes(attribute.name))
        image.setAttribute(attribute.name, attribute.value);
    if (url) image.setAttribute("src", url);
    else image.style.visibility = "hidden";
    // Styles written for `video` no longer match an <img>; carry what places the picture.
    const computed = (
      video.ownerDocument.defaultView ?? window
    ).getComputedStyle(video);
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
    image.style.objectFit = computed.objectFit;
    image.style.objectPosition = computed.objectPosition;
    if (computed.display === "inline") image.style.display = "inline-block";
    target.replaceWith(image);
  });
}

/**
 * Each footage card made by Motify's generator (a raw film in an iframe inside
 * the film) replaced by a picture of the frame it shows now. An SVG image
 * cannot draw an iframe; a hidden one is simply dropped.
 *
 * The picture is the card's own page as an SVG image, drawn with the rest of
 * the frame. Drawing it first and handing the frame a JPEG of it meant
 * drawing the card, reading it back from the graphics card, encoding it and
 * decoding it again, for every frame the card is on.
 */
async function snapshotCardFilms(
  source: ParentNode,
  clone: ParentNode,
  scale: number,
  clips?: ExportClipPictures,
): Promise<void> {
  const frames = Array.from(
    source.querySelectorAll<HTMLIFrameElement>("iframe[data-motify-card-film]"),
  );
  const targets = Array.from(
    clone.querySelectorAll<HTMLIFrameElement>("iframe[data-motify-card-film]"),
  );
  await Promise.all(
    frames.map(async (frame, index) => {
      const target = targets[index];
      if (!target) return;
      const view = frame.ownerDocument.defaultView ?? window;
      const inner = frame.contentDocument;
      if (!inner || view.getComputedStyle(frame).visibility === "hidden") {
        target.remove();
        return;
      }
      const width = frame.clientWidth || 1080;
      const height = frame.clientHeight || 1920;
      const image = target.ownerDocument.createElement("img");
      image.setAttribute(
        "src",
        svgDataUrl(
          await rawFrameSvg(inner, width, height, scale, undefined, clips),
        ),
      );
      image.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px`;
      target.replaceWith(image);
    }),
  );
}

/**
 * A raw film's frame as an SVG image's source: its whole document, as the
 * iframe shows it now, so it exports what preview shows. Scripts and audio
 * are left out; images, canvases and fonts are inlined.
 */
async function rawFrameSvg(
  doc: Document,
  width: number,
  height: number,
  scale: number,
  pictures?: ClipPictures,
  clips?: ExportClipPictures,
): Promise<string> {
  const live = doc.documentElement;
  const clone = inertClone(live);
  // Images pair up by position, so they are inlined before canvases and clips become images.
  await inlineImages(live, clone, pictureEdgeFor(width, height, scale));
  snapshotCanvases(live, clone);
  snapshotVideos(live, clone, scale, await encodeClipPictures(pictures, scale));
  clone
    .querySelectorAll("script, audio, noscript, style[data-motify-fonts]")
    .forEach((node) => node.remove());
  await inlineFontFaces(clone);
  const fontCss = await fontCssFor(clips, live);
  if (fontCss) {
    const fontStyle = doc.createElement("style");
    fontStyle.textContent = fontCss;
    (clone.querySelector("head") ?? clone).append(fontStyle);
  }
  const serialized = new XMLSerializer().serializeToString(clone);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
}

/**
 * A raw film's frame, drawn through the same SVG image as any other film. An
 * export keeps the last frame's pixels, so a moment the film holds still is
 * drawn once.
 */
async function renderRawFrame(
  doc: Document,
  width: number,
  height: number,
  scale: number,
  pictures?: ClipPictures,
  clips?: ExportClipPictures,
): Promise<HTMLCanvasElement> {
  let at = profileNow();
  const svg = await rawFrameSvg(doc, width, height, scale, pictures, clips);
  at = profileStage("serialize", at);
  const canvas = frameCanvas(
    "authored",
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
    Boolean(clips),
  );
  const page = clips
    ? await overlayPixels(svg, canvas.width, canvas.height)
    : await imageFromSvg(svg);
  at = profileStage("page image", at);
  context2d(canvas).drawImage(page, 0, 0, canvas.width, canvas.height);
  profileStage("draw", at);
  return canvas;
}

/**
 * The film exactly as authored, at `scale` times its authored size. Clips are
 * first placed on the playhead's exact frame; a caller drawing the live view
 * while it plays (the editor backdrop) passes `seekVideos: false` instead.
 */
export async function renderAuthoredFrame(
  runtime: CompositionRuntime,
  scale = 1,
  {
    seekVideos = true,
    clips,
  }: { seekVideos?: boolean; clips?: ExportClipPictures } = {},
): Promise<HTMLCanvasElement> {
  let pictures: ClipPictures | undefined;
  let at = profileNow();
  // An export decodes its clips in order; anything else places each <video>.
  if (clips) pictures = await clips.place(runtime.root, runtime.time);
  else if (seekVideos) await seekVideosExactly(runtime.root, runtime.time);
  at = profileStage("clip decode", at);
  // An adaptive film is mounted at the canvas size rather than its authored one.
  const { width, height } = runtime.mountedSize;
  const rawDocument = rawFilmDocument(runtime.root);
  if (rawDocument)
    return renderRawFrame(rawDocument, width, height, scale, pictures, clips);
  const clone = inertClone(runtime.root);
  // Plain clips are drawn straight onto the canvas, under the page (direct-clips.ts).
  const direct =
    clips?.direct === false ? null : planDirectClips(runtime.root, pictures);
  // An export leaves out what paints nothing, and what only held the clips
  // drawn on the canvas; found now, removed once the clone is done.
  const liveUnseen = clips ? unseenElements(runtime.root) : [];
  const unseen = [
    ...liveUnseen,
    ...(direct
      ? emptyHolders(runtime.root, direct.clips, new Set(liveUnseen))
      : []),
  ]
    .map((element) => counterpart(runtime.root, clone, element))
    .filter((element): element is HTMLElement => element !== null);
  if (direct)
    for (const element of direct.blanked) {
      const target =
        element === runtime.root
          ? clone
          : counterpart(runtime.root, clone, element);
      if (target) target.style.background = "transparent";
    }
  at = profileStage("plan", at);
  const imagePictures = direct
    ? new Map(
        [...(pictures ?? [])].filter(([video]) => !direct.clips.has(video)),
      )
    : pictures;
  // Images pair up by position, so they are inlined before canvases and clips become images.
  await inlineImages(runtime.root, clone, pictureEdgeFor(width, height, scale));
  snapshotCanvases(runtime.root, clone);
  at = profileStage("inline pictures", at);
  const clipUrls = await encodeClipPictures(imagePictures, scale);
  if (clipUrls.size > 0) at = profileStage("clip to jpeg", at);
  snapshotVideos(runtime.root, clone, scale, clipUrls, direct?.clips);
  at = profileStage("snapshot clips", at);
  await snapshotCardFilms(runtime.root, clone, scale, clips);
  at = profileStage("card films", at);
  for (const element of unseen) element.remove();
  await inlineFontFaces(clone);
  // Read from the film as mounted: the copy by now carries its pictures inline.
  const fontCss = await fontCssFor(clips, runtime.root);
  at = profileStage("fonts", at);
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
  at = profileStage("serialize", at);
  const canvas = frameCanvas(
    "authored",
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
    Boolean(clips),
  );
  const page = clips
    ? await overlayPixels(svg, canvas.width, canvas.height)
    : await imageFromSvg(svg);
  at = profileStage("page image", at);
  const context = context2d(canvas);
  direct?.draw(context, canvas.width / width);
  context.drawImage(page, 0, 0, canvas.width, canvas.height);
  profileStage("draw", at);
  if (!direct && pictures?.size)
    profileCount("frames with clips in the page image");
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
  clips?: ExportClipPictures,
): Promise<HTMLCanvasElement> {
  const { width, height } = runtime.canvasDimensions;
  const layout: FrameLayout = runtime.frame;
  const canvas = frameCanvas(
    "composition",
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
    Boolean(clips),
  );
  const context = context2d(canvas);
  // Rasterized at the size it is drawn, so text stays sharp.
  const frame = await renderAuthoredFrame(runtime, layout.scale * scale, {
    ...(clips ? { clips } : {}),
  });
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

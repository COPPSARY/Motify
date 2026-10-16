import { DEFAULT_CANVAS, canvasAspectForSize } from "./canvas-frame";
import { renderAuthoredFrame } from "./frame-render";
import { RAW_FILM_FRAME_SELECTOR } from "./raw-film";
import { CompositionRuntime } from "./runtime";
import type { CompositionDefinition } from "./types";

/**
 * The gallery still for a film: one frame through the export rasterizer, drawn
 * from a second, hidden copy of the film so the editor's playhead never moves.
 */

/** Long edge of a still: sharp on a gallery card at 2x, about 20 KB as WebP. */
export const THUMBNAIL_EDGE = 480;
const RAW_FILM_LOAD_TIMEOUT_MS = 5_000;

/**
 * Where the still is taken: most of the way through the opening scene, after
 * its entrance has played and before it leaves. Frame zero is usually empty.
 */
export function thumbnailTime(
  film: Pick<CompositionDefinition, "duration" | "scenes">,
): number {
  const opening = film.scenes[0];
  const time =
    opening && opening.duration > 0
      ? opening.start + opening.duration * 0.6
      : film.duration * 0.3;
  return Math.min(Math.max(0, time), film.duration);
}

function rawFilmLoaded(root: HTMLElement): Promise<void> {
  const frame = root.querySelector<HTMLIFrameElement>(RAW_FILM_FRAME_SELECTOR);
  if (!frame || frame.contentDocument?.readyState === "complete")
    return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, RAW_FILM_LOAD_TIMEOUT_MS);
    frame.addEventListener(
      "load",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeThumbnail(frame: HTMLCanvasElement): Promise<Blob> {
  // Whatever the film leaves transparent shows on black, as it does in export.
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("2D canvas capture is unavailable.");
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(frame, 0, 0);
  const webp = await canvasBlob(canvas, "image/webp", 0.8);
  // Safari cannot encode WebP and quietly hands back a PNG instead.
  if (webp?.type === "image/webp") return webp;
  const jpeg = await canvasBlob(canvas, "image/jpeg", 0.82);
  if (!jpeg) throw new Error("Thumbnail encoding failed.");
  return jpeg;
}

export async function captureThumbnail(
  film: CompositionDefinition,
): Promise<Blob> {
  // Off-screen but laid out: a film may measure itself while it builds.
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-100000px;top:0;pointer-events:none;contain:layout paint";
  const root = document.createElement("div");
  root.style.cssText = `position:relative;width:${film.width}px;height:${film.height}px;overflow:hidden`;
  host.append(root);
  document.body.append(host);
  let runtime: CompositionRuntime | undefined;
  try {
    const aspect = canvasAspectForSize(film.width, film.height);
    runtime = new CompositionRuntime(
      film,
      root,
      aspect
        ? { canvas: { aspect, framing: DEFAULT_CANVAS.framing } }
        : undefined,
    );
    // The copy is only ever looked at, never heard.
    root.querySelectorAll<HTMLMediaElement>("audio, video").forEach((media) => {
      media.muted = true;
      media.pause();
    });
    runtime.seek(thumbnailTime(film));
    await rawFilmLoaded(root);
    await document.fonts?.ready;
    const { width, height } = runtime.mountedSize;
    const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(width, height));
    return await encodeThumbnail(await renderAuthoredFrame(runtime, scale));
  } finally {
    runtime?.destroy();
    host.remove();
  }
}

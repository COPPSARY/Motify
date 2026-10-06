import interLatinUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { CompositionRuntime } from "./runtime";

const embeddedImageCache = new Map<string, Promise<string>>();
let embeddedFontCss: Promise<string> | undefined;

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

async function appendWatermark(
  root: HTMLElement,
  width: number,
  height: number,
): Promise<void> {
  if (root.querySelector("[data-motify-watermark]")) return;
  const image = document.createElement("img");
  image.src = await embeddedImageDataUrl("/motify-watermark-smoke.png");
  image.alt = "";
  image.style.cssText = `display:block;width:${Math.round(width * 0.21)}px;height:auto`;

  const watermark = document.createElement("div");
  watermark.dataset["motifyWatermark"] = "";
  watermark.setAttribute("aria-hidden", "true");
  watermark.style.cssText = `position:absolute;right:${Math.round(width * -0.008)}px;bottom:${Math.round(height * -0.007)}px;opacity:.8;z-index:2147483647;pointer-events:none`;
  watermark.append(image);
  root.append(watermark);
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

export async function renderCompositionFrame(
  runtime: CompositionRuntime,
  scale = 1,
  watermark = false,
): Promise<HTMLCanvasElement> {
  const { width, height } = runtime.definition;
  const clone = runtime.root.cloneNode(true) as HTMLElement;
  await inlineImages(runtime.root, clone);
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
  if (watermark) await appendWatermark(clone, width, height);
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${serialized}</div></foreignObject></svg>`;
  const image = await imageFromSvg(svg);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas export is unavailable.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function exportPng(
  runtime: CompositionRuntime,
  scale = 1,
): Promise<Blob> {
  const canvas = await renderCompositionFrame(runtime, scale);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG encoding failed."));
    }, "image/png");
  });
}

export async function findSupportedAvcConfig(
  width: number,
  height: number,
  requestedFps: number,
): Promise<{ config: VideoEncoderConfig; fps: number }> {
  const frameRates = requestedFps > 30 ? [requestedFps, 30] : [requestedFps];
  const profiles = ["4200", "4d00", "6400"];
  const accelerations: HardwareAcceleration[] = [
    "prefer-hardware",
    "no-preference",
    "prefer-software",
  ];

  for (const fps of frameRates) {
    for (const profile of profiles) {
      for (const hardwareAcceleration of accelerations) {
        const config: VideoEncoderConfig = {
          codec: `avc1.${profile}${fps > 30 ? "2a" : "28"}`,
          width,
          height,
          bitrate: fps > 30 ? 20_000_000 : 12_000_000,
          framerate: fps,
          hardwareAcceleration,
          latencyMode: "quality",
        };
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) {
          return { config: support.config ?? config, fps };
        }
      }
    }
  }

  throw new Error(
    "This browser cannot encode H.264 MP4 video at 1080p, including the 30 FPS compatibility mode.",
  );
}

export async function exportVideo(
  runtime: CompositionRuntime,
  onProgress?: (progress: number, statusText: string) => void,
  requestedFps = runtime.definition.fps,
  watermark = false,
): Promise<Blob> {
  const { width, height, duration } = runtime.definition;
  if (
    typeof VideoEncoder === "undefined" ||
    typeof VideoFrame === "undefined"
  ) {
    throw new Error(
      "MP4 export requires a browser with WebCodecs support. Use the latest Chrome or Edge.",
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("2D canvas export is unavailable.");

  const { config, fps } = await findSupportedAvcConfig(
    width,
    height,
    requestedFps,
  );

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height, frameRate: fps },
    fastStart: "in-memory",
  });
  let encoderError: Error | undefined;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    error: (error) => {
      encoderError = error;
    },
  });
  encoder.configure(config);

  const initialTime = runtime.time;
  const wasPlaying = runtime.snapshot.playing;
  runtime.pause();

  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const frameDuration = Math.round(1_000_000 / fps);

  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      runtime.seek(frameIndex / fps);

      const frameCanvas = await renderCompositionFrame(runtime, 1, watermark);
      context.drawImage(frameCanvas, 0, 0);

      const frame = new VideoFrame(canvas, {
        timestamp: frameIndex * frameDuration,
        duration: frameDuration,
      });
      encoder.encode(frame, { keyFrame: frameIndex % (fps * 2) === 0 });
      frame.close();

      if (encoder.encodeQueueSize > 8) await encoder.flush();
      if (encoderError) throw encoderError;

      const completedFrames = frameIndex + 1;
      const pct = Math.round((completedFrames / totalFrames) * 100);
      onProgress?.(
        completedFrames / totalFrames,
        `Encoding MP4 at ${fps} FPS... ${pct}%`,
      );
    }

    await encoder.flush();
    if (encoderError) throw encoderError;
    muxer.finalize();
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    encoder.close();
    runtime.seek(initialTime);
    if (wasPlaying) runtime.play();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

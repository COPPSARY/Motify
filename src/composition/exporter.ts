import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import {
  ArrayBufferTarget as WebmArrayBufferTarget,
  Muxer as WebmMuxer,
} from "webm-muxer";
import {
  exportBitrate,
  outputSize,
  type ExportQuality,
  type ExportRange,
} from "./export-options";
import { renderCompositionFrame } from "./frame-render";
import type { CompositionRuntime } from "./runtime";

export { renderCompositionFrame };

export async function exportPng(
  runtime: CompositionRuntime,
  scale = 1,
  watermark = false,
): Promise<Blob> {
  const canvas = await renderCompositionFrame(runtime, scale, watermark);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG encoding failed."));
    }, "image/png");
  });
}

/** H.264 level for the macroblock rate, so 4K is not asked of a 4.0 profile. */
function avcLevel(width: number, height: number, fps: number): string {
  const macroblocksPerSecond =
    Math.ceil(width / 16) * Math.ceil(height / 16) * fps;
  if (macroblocksPerSecond <= 245_760) return "28";
  if (macroblocksPerSecond <= 522_240) return "2a";
  if (macroblocksPerSecond <= 983_040) return "33";
  return "34";
}

export async function findSupportedAvcConfig(
  width: number,
  height: number,
  requestedFps: number,
  bitrate?: number,
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
          codec: `avc1.${profile}${avcLevel(width, height, fps)}`,
          width,
          height,
          bitrate: bitrate ?? (fps > 30 ? 20_000_000 : 12_000_000),
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
    `This browser cannot encode H.264 MP4 video at ${width}x${height}, including the 30 FPS compatibility mode. Try a lower resolution.`,
  );
}

const WEBM_CODECS = [
  { encoder: "vp09.00.40.08", muxer: "V_VP9" },
  { encoder: "vp8", muxer: "V_VP8" },
] as const;

async function findSupportedWebmConfig(
  width: number,
  height: number,
  fps: number,
  bitrate: number,
): Promise<{ config: VideoEncoderConfig; muxerCodec: string }> {
  for (const codec of WEBM_CODECS) {
    const config: VideoEncoderConfig = {
      codec: codec.encoder,
      width,
      height,
      bitrate,
      framerate: fps,
      latencyMode: "quality",
    };
    const support = await VideoEncoder.isConfigSupported(config);
    if (support.supported) {
      return { config: support.config ?? config, muxerCodec: codec.muxer };
    }
  }
  throw new Error(
    `This browser cannot encode WebM video at ${width}x${height}. Try MP4 or a lower resolution.`,
  );
}

/** What this browser can encode, so the dialog can disable the rest up front. */
export async function detectExportSupport(): Promise<{
  video: boolean;
  mp4: boolean;
  webm: boolean;
}> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined")
    return { video: false, mp4: false, webm: false };
  const supported = async (codec: string): Promise<boolean> => {
    try {
      const result = await VideoEncoder.isConfigSupported({
        codec,
        width: 1280,
        height: 720,
        bitrate: 4_000_000,
        framerate: 30,
      });
      return Boolean(result.supported);
    } catch {
      return false;
    }
  };
  const [mp4, webm] = await Promise.all([
    supported("avc1.42002a"),
    supported(WEBM_CODECS[0].encoder).then(
      async (vp9) => vp9 || supported(WEBM_CODECS[1].encoder),
    ),
  ]);
  return { video: mp4 || webm, mp4, webm };
}

export class ExportCancelledError extends Error {
  constructor() {
    super("Export cancelled.");
    this.name = "ExportCancelledError";
  }
}

export interface ExportVideoOptions {
  format?: "mp4" | "webm";
  /** Short side of the canvas in pixels; defaults to the authored size. */
  height?: number;
  quality?: ExportQuality;
  fps?: number;
  watermark?: boolean;
  /** Seconds; defaults to the whole composition. */
  range?: ExportRange;
  /** Playback speed; 2 renders the range in half the time. */
  speed?: number;
  signal?: AbortSignal;
  onProgress?: (
    progress: number,
    statusText: string,
    etaSeconds: number | undefined,
  ) => void;
  /** Called every few frames with the frame just rendered, for a live preview. */
  onFrame?: (frame: HTMLCanvasElement) => void;
}

export interface ExportVideoResult {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
  width: number;
  height: number;
  fps: number;
}

const PREVIEW_FRAME_INTERVAL = 6;
const ETA_WARMUP_FRAMES = 3;

export async function exportVideo(
  runtime: CompositionRuntime,
  options: ExportVideoOptions = {},
): Promise<ExportVideoResult> {
  const { duration } = runtime.definition;
  const { width: baseWidth, height: baseHeight } = runtime.canvasDimensions;
  const format = options.format ?? "mp4";
  const requestedFps = options.fps ?? runtime.definition.fps;
  const quality = options.quality ?? "standard";
  const range = options.range ?? { start: 0, end: duration };
  const speed = options.speed ?? 1;
  const { signal } = options;
  if (
    typeof VideoEncoder === "undefined" ||
    typeof VideoFrame === "undefined"
  ) {
    throw new Error(
      "Video export requires a browser with WebCodecs support. Use the latest Chrome or Edge.",
    );
  }
  if (signal?.aborted) throw new ExportCancelledError();

  const { width, height, scale } = outputSize(
    baseWidth,
    baseHeight,
    options.height ?? Math.min(baseWidth, baseHeight),
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("2D canvas export is unavailable.");

  let config: VideoEncoderConfig;
  let fps: number;
  let webmCodec = "V_VP9";
  if (format === "webm") {
    fps = requestedFps;
    const found = await findSupportedWebmConfig(
      width,
      height,
      fps,
      exportBitrate(width, height, fps, quality),
    );
    config = found.config;
    webmCodec = found.muxerCodec;
  } else {
    const found = await findSupportedAvcConfig(
      width,
      height,
      requestedFps,
      exportBitrate(width, height, requestedFps, quality),
    );
    config = found.config;
    fps = found.fps;
    // The fallback may have dropped the frame rate, which changes the budget.
    if (fps !== requestedFps)
      config = {
        ...config,
        bitrate: exportBitrate(width, height, fps, quality),
      };
  }

  let addChunk: (
    chunk: EncodedVideoChunk,
    metadata?: EncodedVideoChunkMetadata,
  ) => void;
  let finalize: () => Blob;
  if (format === "webm") {
    const target = new WebmArrayBufferTarget();
    const muxer = new WebmMuxer({
      target,
      video: { codec: webmCodec, width, height, frameRate: fps },
    });
    addChunk = (chunk, metadata) => muxer.addVideoChunk(chunk, metadata);
    finalize = () => {
      muxer.finalize();
      return new Blob([target.buffer], { type: "video/webm" });
    };
  } else {
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: "avc", width, height, frameRate: fps },
      fastStart: "in-memory",
    });
    addChunk = (chunk, metadata) => muxer.addVideoChunk(chunk, metadata);
    finalize = () => {
      muxer.finalize();
      return new Blob([target.buffer], { type: "video/mp4" });
    };
  }

  let encoderError: Error | undefined;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => addChunk(chunk, metadata),
    error: (error) => {
      encoderError = error;
    },
  });
  encoder.configure(config);

  const initialTime = runtime.time;
  const wasPlaying = runtime.snapshot.playing;
  runtime.pause();

  const totalFrames = Math.max(
    1,
    Math.ceil(((range.end - range.start) / speed) * fps),
  );
  const frameDuration = Math.round(1_000_000 / fps);
  const label = format === "webm" ? "WebM" : "MP4";
  const startedAt = performance.now();

  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (signal?.aborted) throw new ExportCancelledError();
      runtime.seek(
        Math.min(duration, range.start + (frameIndex / fps) * speed),
      );

      const frameCanvas = await renderCompositionFrame(
        runtime,
        scale,
        options.watermark ?? false,
      );
      context.drawImage(frameCanvas, 0, 0, width, height);

      const frame = new VideoFrame(canvas, {
        timestamp: frameIndex * frameDuration,
        duration: frameDuration,
      });
      encoder.encode(frame, {
        keyFrame: frameIndex % (fps * 2) === 0,
      });
      frame.close();

      if (encoder.encodeQueueSize > 8) await encoder.flush();
      if (encoderError) throw encoderError;

      const completedFrames = frameIndex + 1;
      if (frameIndex % PREVIEW_FRAME_INTERVAL === 0) options.onFrame?.(canvas);
      const elapsed = (performance.now() - startedAt) / 1000;
      const eta =
        completedFrames >= ETA_WARMUP_FRAMES
          ? (elapsed / completedFrames) * (totalFrames - completedFrames)
          : undefined;
      options.onProgress?.(
        completedFrames / totalFrames,
        `Encoding ${label} at ${fps} FPS... ${Math.round((completedFrames / totalFrames) * 100)}%`,
        eta,
      );
    }

    await encoder.flush();
    if (encoderError) throw encoderError;
    if (signal?.aborted) throw new ExportCancelledError();
    const blob = finalize();
    return {
      blob,
      mimeType: blob.type,
      extension: format,
      width,
      height,
      fps,
    };
  } finally {
    if (encoder.state !== "closed") encoder.close();
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

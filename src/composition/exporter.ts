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
import {
  encodeExportAudio,
  exportAudioTracks,
  mixExportAudio,
  type EncodedExportAudio,
} from "./export-audio";
import { ExportClipFrames } from "./export-clip-frames";
import {
  finishExportProfile,
  profileNow,
  profileStage,
  startExportProfile,
  type ExportStageTime,
} from "./export-profile";
import {
  releaseExportFrameCache,
  renderCompositionFrame,
} from "./frame-render";
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
  /** Where the time went, by stage, slowest first. */
  profile: Record<string, ExportStageTime>;
}

const PREVIEW_FRAME_INTERVAL = 6;
const ETA_WARMUP_FRAMES = 3;
/** Frames the encoder may hold before the next one waits for it. */
const MAX_ENCODE_QUEUE = 8;
/** How long the encoder may take nothing before the export gives up on it. */
const ENCODER_STALL_MS = 45_000;
/** How long it may take nothing before the export stops handing it frames unpainted. */
const ENCODER_SLOW_MS = 4_000;
/** Times one export reopens an encoder that closed under it before failing. */
const MAX_ENCODER_RESTARTS = 5;

export class EncoderStalledError extends Error {
  constructor() {
    super(
      "The video encoder stopped responding. Try the export again, or choose a lower resolution.",
    );
    this.name = "EncoderStalledError";
  }
}

/**
 * Waits until the encoder holds at most `size` frames. It takes frames at its
 * own pace (its `dequeue` event); calling `flush()` to make room instead
 * forces it to finish everything it is holding every few frames, and in
 * Chrome such a flush has been seen never to resolve, leaving the export
 * stuck near its end. An encoder that takes nothing for a long time fails the
 * export rather than hanging it; `onSlow` is told once, well before that.
 */
async function waitForEncoderRoom(
  encoder: VideoEncoder,
  size: number,
  onSlow?: () => void,
): Promise<void> {
  let lastSize = encoder.encodeQueueSize;
  let lastProgress = performance.now();
  let toldSlow = false;
  while (encoder.encodeQueueSize > size) {
    await new Promise<void>((resolve) => {
      const done = () => {
        encoder.removeEventListener("dequeue", done);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, 100);
      encoder.addEventListener("dequeue", done);
    });
    if (encoder.encodeQueueSize < lastSize) {
      lastSize = encoder.encodeQueueSize;
      lastProgress = performance.now();
    } else if (performance.now() - lastProgress > ENCODER_STALL_MS) {
      throw new EncoderStalledError();
    } else if (
      !toldSlow &&
      performance.now() - lastProgress > ENCODER_SLOW_MS
    ) {
      toldSlow = true;
      onSlow?.();
    }
  }
}

/** The encoder's final flush, which fails the export instead of hanging it. */
function flushWithin(encoder: VideoEncoder, ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new EncoderStalledError()), ms);
    encoder.flush().then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

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

  // The film's sound, mixed and encoded before the muxer exists, since the
  // muxer is told its tracks up front. A film with no sound, or a browser that
  // cannot encode audio, exports video alone.
  options.onProgress?.(0, "Preparing audio...", undefined);
  let audio: EncodedExportAudio | null = null;
  try {
    const mix = await mixExportAudio(
      exportAudioTracks(runtime.root),
      range,
      speed,
    );
    if (mix) audio = await encodeExportAudio(mix, format);
  } catch (error) {
    console.warn("Export continues without audio.", error);
    audio = null;
  }
  if (signal?.aborted) throw new ExportCancelledError();

  let addChunk: (
    chunk: EncodedVideoChunk,
    metadata?: EncodedVideoChunkMetadata,
  ) => void;
  let finalize: () => Blob;
  // Audio goes in alongside the video, never ahead of it, so each muxer sees
  // both tracks in time order.
  const pendingAudio = audio ? [...audio.chunks] : [];
  const addAudioUpTo = (
    timestamp: number,
    add: (
      chunk: EncodedAudioChunk,
      metadata?: EncodedAudioChunkMetadata,
    ) => void,
  ) => {
    while (
      pendingAudio.length > 0 &&
      pendingAudio[0]!.chunk.timestamp <= timestamp
    ) {
      const next = pendingAudio.shift()!;
      add(next.chunk, next.metadata);
    }
  };
  if (format === "webm") {
    const target = new WebmArrayBufferTarget();
    const muxer = new WebmMuxer({
      target,
      video: { codec: webmCodec, width, height, frameRate: fps },
      ...(audio
        ? {
            audio: {
              codec: audio.muxerCodec,
              numberOfChannels: audio.numberOfChannels,
              sampleRate: audio.sampleRate,
            },
          }
        : {}),
    });
    const addAudio = (
      chunk: EncodedAudioChunk,
      metadata?: EncodedAudioChunkMetadata,
    ) => muxer.addAudioChunk(chunk, metadata);
    addChunk = (chunk, metadata) => {
      addAudioUpTo(chunk.timestamp, addAudio);
      muxer.addVideoChunk(chunk, metadata);
    };
    finalize = () => {
      addAudioUpTo(Number.POSITIVE_INFINITY, addAudio);
      muxer.finalize();
      return new Blob([target.buffer], { type: "video/webm" });
    };
  } else {
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: "avc", width, height, frameRate: fps },
      ...(audio
        ? {
            audio: {
              codec: audio.muxerCodec as "aac" | "opus",
              numberOfChannels: audio.numberOfChannels,
              sampleRate: audio.sampleRate,
            },
          }
        : {}),
      fastStart: "in-memory",
    });
    const addAudio = (
      chunk: EncodedAudioChunk,
      metadata?: EncodedAudioChunkMetadata,
    ) => muxer.addAudioChunk(chunk, metadata);
    addChunk = (chunk, metadata) => {
      addAudioUpTo(chunk.timestamp, addAudio);
      muxer.addVideoChunk(chunk, metadata);
    };
    finalize = () => {
      addAudioUpTo(Number.POSITIVE_INFINITY, addAudio);
      muxer.finalize();
      return new Blob([target.buffer], { type: "video/mp4" });
    };
  }

  const frameDuration = Math.round(1_000_000 / fps);
  let encoderError: Error | undefined;
  /** The last frame the muxer has, so a reopened encoder resumes after it. */
  let lastSavedFrame = -1;
  const openEncoder = (): VideoEncoder => {
    const opened: VideoEncoder = new VideoEncoder({
      output: (chunk, metadata) => {
        addChunk(chunk, metadata);
        lastSavedFrame = Math.round(chunk.timestamp / frameDuration);
      },
      error: (error) => {
        if (opened === encoder) encoderError = error;
      },
    });
    opened.configure(config);
    return opened;
  };
  let encoder = openEncoder();
  let restarts = 0;
  let frameIndex = 0;
  let keyFrameNext = true;
  /**
   * Whether each frame is painted before it is handed to the encoder. A frame
   * left to paint later holds on to the decoded clip frames drawn into it
   * while it waits in the encoder's queue, and an encoder has been seen to
   * stop for good behind that. Painting first means waiting for the graphics
   * card on every frame, which halves the speed of an export, so it is only
   * done once the encoder has stopped taking frames.
   */
  let paintBeforeEncode = false;
  /**
   * The encoder closed under the export: Chrome reclaims one in a tab left in
   * the background, and a hardware encoder can fail mid-stream. Every frame
   * the muxer already has is kept; a fresh encoder starts again, on a key
   * frame, from the first one it lacks.
   */
  const reopenEncoder = () => {
    const cause = encoderError ?? new Error("The video encoder closed.");
    if (restarts >= MAX_ENCODER_RESTARTS) throw cause;
    restarts++;
    console.warn(
      `[Export] the video encoder closed at frame ${frameIndex}; resuming from frame ${lastSavedFrame + 1}.`,
      cause,
    );
    encoderError = undefined;
    encoder = openEncoder();
    frameIndex = lastSavedFrame + 1;
    keyFrameNext = true;
  };
  const encoderClosed = () =>
    encoderError !== undefined || encoder.state === "closed";

  const initialTime = runtime.time;
  const wasPlaying = runtime.snapshot.playing;
  runtime.pause();

  const totalFrames = Math.max(
    1,
    Math.ceil(((range.end - range.start) / speed) * fps),
  );
  const label = format === "webm" ? "WebM" : "MP4";
  const startedAt = performance.now();
  // Clips are decoded in order rather than sought for every frame.
  const clips = new ExportClipFrames();
  startExportProfile();

  try {
    for (;;) {
      while (frameIndex < totalFrames) {
        if (signal?.aborted) throw new ExportCancelledError();
        if (encoderClosed()) reopenEncoder();
        let at = profileNow();
        runtime.seek(
          Math.min(duration, range.start + (frameIndex / fps) * speed),
        );
        at = profileStage("seek", at);

        const frameCanvas = await renderCompositionFrame(
          runtime,
          scale,
          options.watermark ?? false,
          clips,
        );
        // Drawing the frame awaits; the encoder may have closed meanwhile.
        if (encoderClosed()) continue;
        at = profileNow();
        context.drawImage(frameCanvas, 0, 0, width, height);
        if (paintBeforeEncode) {
          context.getImageData(0, 0, 1, 1);
          at = profileStage("paint before encode", at);
        }

        const frame = new VideoFrame(canvas, {
          timestamp: frameIndex * frameDuration,
          duration: frameDuration,
        });
        try {
          encoder.encode(frame, {
            keyFrame: keyFrameNext || frameIndex % (fps * 2) === 0,
          });
        } finally {
          frame.close();
        }
        keyFrameNext = false;
        at = profileStage("encode", at);

        await waitForEncoderRoom(encoder, MAX_ENCODE_QUEUE, () => {
          if (paintBeforeEncode) return;
          paintBeforeEncode = true;
          console.warn(
            `[Export] the encoder stopped taking frames at frame ${frameIndex}; painting each frame before it is encoded from here on.`,
          );
          // Every decoded frame the export holds is given back; clips reopen
          // where they are next needed.
          void clips.dispose();
        });
        profileStage("encoder wait", at);
        if (encoderClosed()) continue;

        frameIndex++;
        const completedFrames = frameIndex;
        if ((completedFrames - 1) % PREVIEW_FRAME_INTERVAL === 0)
          options.onFrame?.(canvas);
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

      try {
        await flushWithin(encoder, ENCODER_STALL_MS + totalFrames * 50);
      } catch (error) {
        // A flush the closing encoder rejected is resumed like any other close.
        if (!encoderClosed()) throw error;
      }
      if (signal?.aborted) throw new ExportCancelledError();
      if (!encoderClosed()) break;
      reopenEncoder();
    }
    const blob = finalize();
    const profile = finishExportProfile();
    const seconds = (performance.now() - startedAt) / 1000;
    console.info(
      `[Export] ${totalFrames} frames in ${seconds.toFixed(1)}s (${(totalFrames / seconds).toFixed(1)} a second)`,
      profile,
    );
    return {
      blob,
      mimeType: blob.type,
      extension: format,
      width,
      height,
      fps,
      profile,
    };
  } finally {
    finishExportProfile();
    if (encoder.state !== "closed") encoder.close();
    await clips.dispose();
    releaseExportFrameCache();
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

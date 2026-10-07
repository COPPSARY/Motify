/** Everything the export dialog offers, kept free of DOM and encoder code. */

export type ExportFormat = "mp4" | "webm" | "png";
export type ExportQuality = "draft" | "standard" | "high";
export type ExportRangeMode = "full" | "scene" | "selection";

export interface ExportSettings {
  format: ExportFormat;
  /** Short side of the canvas in pixels; the other side follows its aspect. */
  height: number;
  quality: ExportQuality;
  fps: number;
  range: ExportRangeMode;
  /** File name without extension; empty falls back to the project title. */
  filename: string;
  /** Playback speed of the exported video; 2 halves its length. */
  speed: number;
  /** Selection bounds in seconds, used when `range` is "selection". */
  selectionStart: number;
  selectionEnd: number;
}

export interface ExportRange {
  start: number;
  end: number;
}

export const RESOLUTION_HEIGHTS = [720, 1080, 1440, 2160] as const;
export const FPS_CHOICES = [24, 30, 60] as const;
export const SPEED_CHOICES = [1, 1.25, 1.5, 2] as const;
/**
 * Heights above this need a paid plan. Set to 1080 to lock 1440p and 4K;
 * all resolutions are open to everyone for now.
 */
export const FREE_MAX_HEIGHT = 2160;

export const QUALITY_LABELS: Record<ExportQuality, string> = {
  draft: "Draft",
  standard: "Standard",
  high: "High",
};

/** Bits per pixel per frame. Standard matches the old fixed 12 Mbps at 1080p30. */
const BITS_PER_PIXEL: Record<ExportQuality, number> = {
  draft: 0.08,
  standard: 0.19,
  high: 0.3,
};

export interface ExportPreset {
  id: string;
  label: string;
  hint: string;
  settings: Pick<ExportSettings, "format" | "height" | "quality">;
}

export const EXPORT_PRESETS: readonly ExportPreset[] = [
  {
    id: "web",
    label: "YouTube / web",
    hint: "1080p MP4, plays everywhere",
    settings: { format: "mp4", height: 1080, quality: "standard" },
  },
  {
    id: "best",
    label: "Best quality",
    hint: "4K MP4, high bitrate",
    settings: { format: "mp4", height: 2160, quality: "high" },
  },
  {
    id: "small",
    label: "Small file",
    hint: "720p MP4 for chat and email",
    settings: { format: "mp4", height: 720, quality: "draft" },
  },
  {
    id: "webm",
    label: "Web embed",
    hint: "1080p WebM (VP9)",
    settings: { format: "webm", height: 1080, quality: "standard" },
  },
  {
    id: "still",
    label: "Still frame",
    hint: "PNG of the current frame",
    settings: { format: "png", height: 1080, quality: "high" },
  },
];

/**
 * The output size for a canvas. `shortSide` is the resolution label: 1080p is
 * 1920x1080 on 16:9, 1080x1080 on 1:1 and 1080x1920 on 9:16. Encoders want
 * even dimensions.
 */
export function outputSize(
  canvasWidth: number,
  canvasHeight: number,
  shortSide: number,
): { width: number; height: number; scale: number } {
  const scale = shortSide / Math.min(canvasWidth, canvasHeight);
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  return {
    width: even(canvasWidth * scale),
    height: even(canvasHeight * scale),
    scale,
  };
}

export function exportBitrate(
  width: number,
  height: number,
  fps: number,
  quality: ExportQuality,
): number {
  const bitrate = width * height * fps * BITS_PER_PIXEL[quality];
  return Math.round(Math.min(60_000_000, Math.max(1_000_000, bitrate)));
}

export function resolveRange(
  settings: ExportSettings,
  duration: number,
  scene?: { start: number; duration: number },
): ExportRange {
  let start = 0;
  let end = duration;
  if (settings.range === "scene" && scene) {
    start = scene.start;
    end = scene.start + scene.duration;
  } else if (settings.range === "selection") {
    start = settings.selectionStart;
    end = settings.selectionEnd;
  }
  start = Math.min(Math.max(0, start), duration);
  end = Math.min(Math.max(start, end), duration);
  return end - start < 1e-6 ? { start: 0, end: duration } : { start, end };
}

export interface ExportEstimate {
  bytes: number;
  frames: number;
  /** Warnings worth showing before the user commits. */
  warnings: string[];
}

/** WebM rates run a little lower than H.264 at the same visual quality. */
const FORMAT_SIZE_FACTOR: Record<ExportFormat, number> = {
  mp4: 1,
  webm: 0.85,
  png: 0,
};

// The muxer keeps the whole file in memory.
const LARGE_FILE_BYTES = 800 * 1024 * 1024;
const LONG_RENDER_FRAMES = 60 * 60 * 3;

export function estimateExport(
  settings: ExportSettings,
  compositionWidth: number,
  compositionHeight: number,
  range: ExportRange,
): ExportEstimate {
  const seconds = (range.end - range.start) / settings.speed;
  const frames = Math.max(1, Math.ceil(seconds * settings.fps));
  if (settings.format === "png") return { bytes: 0, frames: 1, warnings: [] };
  const size = outputSize(compositionWidth, compositionHeight, settings.height);
  const bitrate = exportBitrate(
    size.width,
    size.height,
    settings.fps,
    settings.quality,
  );
  const bytes = Math.round(
    ((bitrate * seconds) / 8) * FORMAT_SIZE_FACTOR[settings.format],
  );
  const warnings: string[] = [];
  if (bytes > LARGE_FILE_BYTES) {
    warnings.push(
      "This file is large and is built in memory. Lower the resolution or export a shorter range if the tab runs out of memory.",
    );
  }
  if (frames > LONG_RENDER_FRAMES || size.height >= 2160) {
    warnings.push(
      "This will take a while. Keep this tab open and visible, because background tabs render slowly.",
    );
  }
  return { bytes, frames, warnings };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

export function defaultExportSettings(
  fps: number,
  duration: number,
): ExportSettings {
  const nearest = FPS_CHOICES.reduce((best, choice) =>
    Math.abs(choice - fps) < Math.abs(best - fps) ? choice : best,
  );
  return {
    format: "mp4",
    height: 1080,
    quality: "standard",
    fps: nearest,
    range: "full",
    filename: "",
    speed: 1,
    selectionStart: 0,
    selectionEnd: duration,
  };
}

const STORAGE_KEY = "motify_export_settings";

/** The choices worth remembering; range and selection are per project. */
export function loadSavedExportSettings(): Partial<ExportSettings> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw) as Partial<ExportSettings>;
    const result: Partial<ExportSettings> = {};
    if (
      saved.format === "mp4" ||
      saved.format === "webm" ||
      saved.format === "png"
    )
      result.format = saved.format;
    if (RESOLUTION_HEIGHTS.includes(saved.height as never))
      result.height = saved.height as number;
    if (
      saved.quality === "draft" ||
      saved.quality === "standard" ||
      saved.quality === "high"
    )
      result.quality = saved.quality;
    if (FPS_CHOICES.includes(saved.fps as never))
      result.fps = saved.fps as number;
    return result;
  } catch {
    return {};
  }
}

export function saveExportSettings(settings: ExportSettings): void {
  try {
    const { format, height, quality, fps } = settings;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ format, height, quality, fps }),
    );
  } catch {
    // Storage can be blocked; the dialog just starts from defaults next time.
  }
}

export interface ExportHistoryItem {
  id: number;
  name: string;
  url: string;
  bytes: number;
  detail: string;
}

/** A safe download name, without an extension, from what the user typed. */
export function exportFileBase(name: string, fallback: string): string {
  const clean = (value: string): string =>
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ")
      .replace(/\.(mp4|webm|png)$/i, "")
      .replace(/\s+/g, " ")
      .replace(/^[\s.]+|[\s.]+$/g, "")
      .slice(0, 100)
      .trim();
  return clean(name) || clean(fallback) || "motify-video";
}

import { RAW_FILM_FRAME_SELECTOR } from "./raw-film";

/**
 * Plays a film's clips in step with the timeline playhead.
 *
 * A generated film places an attached clip as
 * `<video data-motify-video src=... data-start="2" data-trim="0" [loop]>`.
 * The timeline is the single clock: while it plays, each clip plays and is
 * pulled back when it drifts; while paused, scrubbing or exporting, each clip
 * is placed on the exact frame. The film's own script never touches a clip.
 */

export interface VideoSyncSnapshot {
  time: number;
  playing: boolean;
}

const VIDEO_SELECTOR = "video[data-motify-video]";
/** Playback wanders from the timeline; past this it is pulled back. */
const DRIFT_SECONDS = 0.25;
/** While paused the clip is placed exactly, so only skip no-op seeks. */
const SCRUB_EPSILON = 1 / 120;
/** A clip that never answers a seek must not hang an export. */
const SEEK_TIMEOUT_MS = 4000;

function seconds(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/** Every clip in a mounted film, including inside a raw film's frame. */
export function filmVideos(root: ParentNode): HTMLVideoElement[] {
  const videos = Array.from(
    root.querySelectorAll<HTMLVideoElement>(VIDEO_SELECTOR),
  );
  const frame = root.querySelector<HTMLIFrameElement>(RAW_FILM_FRAME_SELECTOR);
  const inner = frame?.contentDocument;
  if (inner)
    videos.push(
      ...Array.from(inner.querySelectorAll<HTMLVideoElement>(VIDEO_SELECTOR)),
    );
  return videos;
}

/**
 * Where in the clip the film is at `filmTime`: its first frame before it
 * starts, then real time from `data-trim`, looping or holding its last frame.
 */
export function clipTime(
  clip: { start: number; trim: number; loop: boolean; duration: number },
  filmTime: number,
): number {
  const elapsed = Math.max(0, filmTime - clip.start);
  if (!Number.isFinite(clip.duration) || clip.duration <= 0)
    return clip.trim + elapsed;
  const span = Math.max(0.001, clip.duration - clip.trim);
  if (clip.loop) return clip.trim + (elapsed % span);
  // The very end of a clip often has no decodable frame; hold just before it.
  return Math.min(clip.trim + elapsed, Math.max(0, clip.duration - 0.05));
}

function clipOf(video: HTMLVideoElement) {
  return {
    start: seconds(video.dataset["start"]),
    trim: seconds(video.dataset["trim"]),
    loop: video.loop,
    duration: video.duration,
  };
}

/** Sound is the soundtrack's job; a clip only ever shows pictures. */
function prepare(video: HTMLVideoElement): void {
  if (video.dataset["motifyPrepared"] === "") return;
  video.dataset["motifyPrepared"] = "";
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = false;
  video.controls = false;
  video.playsInline = true;
  video.preload = "auto";
  video.pause();
}

export class VideoSync {
  constructor(private readonly root: ParentNode) {}

  sync({ time, playing }: VideoSyncSnapshot): void {
    for (const video of filmVideos(this.root)) {
      prepare(video);
      const clip = clipOf(video);
      const target = clipTime(clip, time);
      const running =
        playing &&
        time >= clip.start &&
        (clip.loop ||
          !Number.isFinite(clip.duration) ||
          target < clip.duration - 0.05);
      if (running) {
        if (Math.abs(video.currentTime - target) > DRIFT_SECONDS)
          video.currentTime = target;
        // A clip that is not ready yet is retried on the next tick.
        if (video.paused) void video.play().catch(() => undefined);
      } else {
        if (!video.paused) video.pause();
        if (Math.abs(video.currentTime - target) > SCRUB_EPSILON)
          video.currentTime = target;
      }
    }
  }

  dispose(): void {
    for (const video of filmVideos(this.root)) video.pause();
  }
}

function settled(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("error", done);
      resolve();
    };
    const ready = () => {
      if (!video.seeking) done();
    };
    const timer = setTimeout(done, SEEK_TIMEOUT_MS);
    video.addEventListener("seeked", done);
    video.addEventListener("loadeddata", ready);
    video.addEventListener("error", done);
    if (
      !video.seeking &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    )
      done();
  });
}

/**
 * Places every clip on the exact frame for `time` and waits until each has
 * decoded it, so a captured frame shows the clip where the film says it is.
 */
export async function seekVideosExactly(
  root: ParentNode,
  time: number,
): Promise<void> {
  await Promise.all(
    filmVideos(root).map(async (video) => {
      prepare(video);
      if (!video.paused) video.pause();
      if (video.readyState < HTMLMediaElement.HAVE_METADATA)
        await settled(video);
      const target = clipTime(clipOf(video), time);
      if (Math.abs(video.currentTime - target) > SCRUB_EPSILON)
        video.currentTime = target;
      await settled(video);
    }),
  );
}

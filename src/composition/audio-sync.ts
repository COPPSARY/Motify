/**
 * Plays a composition's <audio> elements in step with the timeline playhead.
 *
 * The timeline is the single clock. A generated film declares its music as
 * `<audio data-motify-audio src=... data-start="0">`; this follows the runtime
 * snapshot instead of driving playback, so Play, Pause, scrubbing, and restart
 * behave the same for sound as for motion, and `timelineJs` never touches it.
 */
export interface AudioSyncSnapshot {
  time: number;
  playing: boolean;
}

interface SyncedTrack {
  element: HTMLAudioElement;
  start: number;
  retryAt: number;
}

/** Playback wanders from the timeline; past this it is pulled back. */
const DRIFT_SECONDS = 0.3;
/** While paused the playhead is placed exactly, so only skip no-op seeks. */
const SCRUB_EPSILON = 0.04;
/** After the browser refuses to play, wait before asking again. */
const RETRY_MS = 500;

export class AudioSync {
  private readonly tracks: SyncedTrack[] = [];
  private context: AudioContext | null = null;
  private isMuted = false;

  constructor(root: ParentNode) {
    for (const element of root.querySelectorAll<HTMLAudioElement>(
      "audio[data-motify-audio]",
    )) {
      const start = Number.parseFloat(element.dataset["start"] ?? "0");
      const volume = Number.parseFloat(element.dataset["volume"] ?? "1");
      element.autoplay = false;
      element.loop = false;
      element.controls = false;
      element.preload = "auto";
      element.volume = Number.isFinite(volume)
        ? Math.min(1, Math.max(0, volume))
        : 1;
      this.tracks.push({
        element,
        start: Number.isFinite(start) ? Math.max(0, start) : 0,
        retryAt: 0,
      });
    }
  }

  get trackCount(): number {
    return this.tracks.length;
  }

  get muted(): boolean {
    return this.isMuted;
  }

  set muted(value: boolean) {
    this.isMuted = value;
    for (const { element } of this.tracks) element.muted = value;
  }

  sync({ time, playing }: AudioSyncSnapshot): void {
    for (const track of this.tracks) this.syncTrack(track, time, playing);
  }

  /**
   * Opens the browser's audio gate from the Play click itself. Calling this
   * method must be the first work done by the click handler: both resume() and
   * element.play() are started before the first await, while transient user
   * activation is still available on deployed HTTPS origins.
   */
  async unlock({ time }: AudioSyncSnapshot): Promise<void> {
    const context = this.ensureContext();
    console.info(
      `[Audio] AudioContext state on play: ${context?.state ?? "unavailable"}`,
    );

    const resume =
      context?.state === "suspended"
        ? context.resume().catch((error: unknown) => {
            console.warn("[Audio] AudioContext resume failed", error);
          })
        : Promise.resolve();
    const playback = this.tracks.map(async (track) => {
      this.seekTrack(track, time);
      try {
        await track.element.play();
        track.retryAt = 0;
      } catch (error) {
        // A source can still be rendering when Play is clicked. Timeline sync
        // retries it as soon as the source becomes ready.
        console.warn("[Audio] audio element unlock failed", error);
      }
    });

    await Promise.all([resume, ...playback]);
  }

  dispose(): void {
    for (const { element } of this.tracks) {
      element.pause();
      const ownedUrl = element.dataset["motifyOwnedObjectUrl"];
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    }
    if (this.context && this.context.state !== "closed") {
      void this.context.close().catch(() => undefined);
    }
    this.context = null;
    this.tracks.length = 0;
  }

  // The context exists only to be resumed from the Play gesture, which also
  // unlocks Web Audio for the page. Elements are never routed through it: a
  // MediaElementSource on a cross-origin track without CORS headers plays
  // silence, which is exactly how a deployed film goes quiet.
  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof AudioContext === "undefined") return null;
    try {
      this.context = new AudioContext();
      return this.context;
    } catch (error) {
      console.warn("[Audio] AudioContext initialization failed", error);
      this.context = null;
      return null;
    }
  }

  private seekTrack(track: SyncedTrack, time: number): void {
    const local = Math.max(0, time - track.start);
    if (Math.abs(track.element.currentTime - local) > SCRUB_EPSILON) {
      track.element.currentTime = local;
    }
  }

  private syncTrack(track: SyncedTrack, time: number, playing: boolean): void {
    const { element } = track;
    const local = time - track.start;
    const duration = element.duration;
    const ended = Number.isFinite(duration) && local >= duration;

    if (local < 0 || ended) {
      element.pause();
      if (local < 0 && element.currentTime > 0) element.currentTime = 0;
      return;
    }

    if (!playing) {
      element.pause();
      if (Math.abs(element.currentTime - local) > SCRUB_EPSILON) {
        element.currentTime = local;
      }
      return;
    }

    if (!element.paused) {
      if (Math.abs(element.currentTime - local) > DRIFT_SECONDS) {
        element.currentTime = local;
      }
      return;
    }

    const now = globalThis.performance?.now() ?? Date.now();
    if (now < track.retryAt) return;
    if (Math.abs(element.currentTime - local) > SCRUB_EPSILON) {
      element.currentTime = local;
    }
    // Browsers block sound until the page has had a user gesture; the next
    // frame simply tries again once one has happened.
    track.retryAt = now + RETRY_MS;
    void Promise.resolve(element.play()).catch(() => undefined);
  }
}

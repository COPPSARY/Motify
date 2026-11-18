import { derived, readable, writable } from "svelte/store";

/** What the backend says a running generation is doing. */
export type GenerationPhase =
  "preparing" | "writing" | "voice" | "checking" | "fixing";

export interface GenerationEstimate {
  /** The typical run of this kind, in seconds. */
  seconds: number;
  /** Four runs in five finish within this many seconds. */
  upToSeconds: number;
}

export interface GenerationProgress {
  /** When the editor started the job, by this browser's clock. */
  startedAt: number;
  phase?: GenerationPhase;
  estimate?: GenerationEstimate;
}

/** Set while a generation job runs; null when none does or the backend reports none. */
export const generationProgress = writable<GenerationProgress | null>(null);

/** Each phase as the editor names it. The step list groups voice and fixing under writing. */
export const PHASE_LABELS: Record<GenerationPhase, string> = {
  preparing: "Reading your brief",
  writing: "Writing the film",
  voice: "Recording the voice-over",
  checking: "Checking the result",
  fixing: "Fixing what the check found",
};

export interface ProgressView {
  label: string | null;
  /** "About 3 min left", or a note once the run is past its estimate; null without one. */
  eta: string | null;
  elapsed: string;
  /** 0-1 for a progress bar, held below 1 until the run finishes; null without an estimate. */
  fraction: number | null;
}

/**
 * Reads the progress at `now`. Past the typical time it stops counting down
 * and says so plainly, rather than sitting at "0 sec left".
 */
export function describeProgress(
  progress: GenerationProgress,
  now: number,
): ProgressView {
  const elapsedSeconds = Math.max(0, (now - progress.startedAt) / 1000);
  const label = progress.phase ? PHASE_LABELS[progress.phase] : null;
  const elapsed = clock(elapsedSeconds);
  const estimate = progress.estimate;
  if (!estimate) return { label, eta: null, elapsed, fraction: null };
  const fraction = Math.min(0.95, elapsedSeconds / estimate.upToSeconds);
  const left = estimate.seconds - elapsedSeconds;
  if (left > 0) return { label, eta: timeLeft(left), elapsed, fraction };
  if (elapsedSeconds < estimate.upToSeconds) {
    return {
      label,
      eta: "Almost done, a little longer than usual",
      elapsed,
      fraction,
    };
  }
  return {
    label,
    eta: "Taking longer than usual. You can leave this page; it keeps going.",
    elapsed,
    fraction,
  };
}

function timeLeft(seconds: number): string {
  if (seconds >= 90) return `About ${Math.round(seconds / 60)} min left`;
  if (seconds >= 45) return "About a minute left";
  return "Less than a minute left";
}

function clock(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Ticks once a second while anything is subscribed. */
const now = readable(Date.now(), (set) => {
  const timer = setInterval(() => set(Date.now()), 1000);
  return () => clearInterval(timer);
});

/** The progress as the editor shows it, refreshed every second. */
export const generationProgressView = derived(
  [generationProgress, now],
  ([progress, time]) => (progress ? describeProgress(progress, time) : null),
);

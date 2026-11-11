/**
 * How an `<audio data-motify-audio>` track is placed beyond its start:
 *
 * - `data-trim`      where in the file it begins, in seconds
 * - `data-duration`  how long it plays; to the end of the file when absent
 * - `data-envelope`  its loudness over its own time, as "time:gain" pairs
 *                    ("0:0 0.5:1 9:1 10:0" fades in and out), times `data-volume`
 *
 * Preview (AudioSync) and export (export-audio) read the same attributes, so a
 * fade or a dip under speech sounds the same in both.
 */

export interface EnvelopePoint {
  time: number;
  gain: number;
}

export interface TrackPlacement {
  /** Film time at which the track starts. */
  start: number;
  /** Where in the file it begins. */
  trim: number;
  /** How long it plays; Infinity to the end of the file. */
  duration: number;
  volume: number;
  envelope: EnvelopePoint[];
}

function number(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseEnvelope(value: string | undefined): EnvelopePoint[] {
  if (!value) return [];
  return value
    .trim()
    .split(/\s+/)
    .flatMap((pair) => {
      const [time, gain] = pair.split(":").map(Number);
      return Number.isFinite(time) && Number.isFinite(gain)
        ? [{ time: Math.max(0, time!), gain: Math.max(0, Math.min(1, gain!)) }]
        : [];
    })
    .sort((a, b) => a.time - b.time);
}

export function trackPlacement(element: HTMLElement): TrackPlacement {
  const duration = number(
    element.dataset["duration"],
    Number.POSITIVE_INFINITY,
  );
  return {
    start: Math.max(0, number(element.dataset["start"], 0)),
    trim: Math.max(0, number(element.dataset["trim"], 0)),
    duration: duration > 0 ? duration : Number.POSITIVE_INFINITY,
    volume: Math.min(1, Math.max(0, number(element.dataset["volume"], 1))),
    envelope: parseEnvelope(element.dataset["envelope"]),
  };
}

/** The envelope's gain at `time` (track time), linear between points; 1 without one. */
export function envelopeGain(
  envelope: readonly EnvelopePoint[],
  time: number,
): number {
  if (envelope.length === 0) return 1;
  if (time <= envelope[0]!.time) return envelope[0]!.gain;
  for (let index = 1; index < envelope.length; index += 1) {
    const point = envelope[index]!;
    if (time <= point.time) {
      const previous = envelope[index - 1]!;
      const span = point.time - previous.time;
      return span <= 0
        ? point.gain
        : previous.gain +
            ((time - previous.time) / span) * (point.gain - previous.gain);
    }
  }
  return envelope[envelope.length - 1]!.gain;
}

export function formatEnvelope(points: readonly EnvelopePoint[]): string {
  return points
    .map(
      (point) =>
        `${Math.round(point.time * 1000) / 1000}:${Math.round(point.gain * 1000) / 1000}`,
    )
    .join(" ");
}

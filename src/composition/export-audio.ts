import {
  envelopeGain,
  trackPlacement,
  type EnvelopePoint,
} from "./audio-envelope";
import type { ExportRange } from "./export-options";

/**
 * The sound of an export: every track the film plays (its
 * `<audio data-motify-audio>` elements, including a raw film's rendered
 * soundtrack) mixed offline over the exported range, then encoded with
 * WebCodecs for the same muxer as the video. Export steps the playhead frame
 * by frame in silence, so the audio is made apart from it, exactly once.
 */

export interface ExportAudioTrack {
  src: string;
  /** Film time, in seconds, at which the track starts. */
  start: number;
  volume: number;
  /** Where in the file it begins (`data-trim`). */
  trim?: number;
  /** How long it plays (`data-duration`); to the file's end when absent. */
  duration?: number;
  /** Loudness over the track's own time (`data-envelope`). */
  envelope?: EnvelopePoint[];
}

export interface EncodedExportAudio {
  /** The muxer's name for the codec: "aac" or "opus" for MP4, "A_OPUS" for WebM. */
  muxerCodec: string;
  numberOfChannels: number;
  sampleRate: number;
  chunks: Array<{
    chunk: EncodedAudioChunk;
    metadata: EncodedAudioChunkMetadata | undefined;
  }>;
}

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const FRAMES_PER_CHUNK = 1024;

export function exportAudioTracks(root: ParentNode): ExportAudioTrack[] {
  return Array.from(
    root.querySelectorAll<HTMLAudioElement>("audio[data-motify-audio]"),
  ).flatMap((element) => {
    const src = element.currentSrc || element.src;
    if (!src) return [];
    const placement = trackPlacement(element);
    return [
      {
        src,
        start: placement.start,
        volume: placement.volume,
        ...(placement.trim > 0 ? { trim: placement.trim } : {}),
        ...(Number.isFinite(placement.duration)
          ? { duration: placement.duration }
          : {}),
        ...(placement.envelope.length > 0
          ? { envelope: placement.envelope }
          : {}),
      },
    ];
  });
}

/** The tracks mixed over `range` at `speed`; null when there is nothing to hear. */
export async function mixExportAudio(
  tracks: readonly ExportAudioTrack[],
  range: ExportRange,
  speed: number,
): Promise<AudioBuffer | null> {
  if (tracks.length === 0 || typeof OfflineAudioContext === "undefined")
    return null;
  const seconds = (range.end - range.start) / speed;
  const frames = Math.max(1, Math.ceil(seconds * SAMPLE_RATE));
  const context = new OfflineAudioContext(CHANNELS, frames, SAMPLE_RATE);
  let placed = 0;
  // A footage edit plays one clip's sound in many places: decode each file once.
  const decoded = new Map<string, Promise<AudioBuffer | null>>();
  const decode = (src: string) => {
    let pending = decoded.get(src);
    if (!pending) {
      pending = fetch(src)
        .then((response) => response.arrayBuffer())
        .then((bytes) => context.decodeAudioData(bytes))
        .catch((error: unknown) => {
          // A track that cannot be read leaves the rest of the mix intact.
          console.warn("Export could not read an audio track.", error);
          return null;
        });
      decoded.set(src, pending);
    }
    return pending;
  };
  for (const track of tracks) {
    const buffer = await decode(track.src);
    if (!buffer) continue;
    const trim = track.trim ?? 0;
    const length = Math.min(
      track.duration ?? Number.POSITIVE_INFINITY,
      buffer.duration - trim,
    );
    const end = track.start + length;
    if (length <= 0 || end <= range.start || track.start >= range.end) continue;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = speed;
    const gain = context.createGain();
    const when = Math.max(0, (track.start - range.start) / speed);
    // How far into the track the export begins, in track time.
    const skipped = Math.max(0, range.start - track.start);
    if (track.envelope && track.envelope.length > 0) {
      const at = (time: number) => when + Math.max(0, time - skipped) / speed;
      gain.gain.setValueAtTime(
        track.volume * envelopeGain(track.envelope, skipped),
        when,
      );
      for (const point of track.envelope) {
        if (point.time <= skipped) continue;
        gain.gain.linearRampToValueAtTime(
          track.volume * point.gain,
          at(point.time),
        );
      }
    } else {
      gain.gain.value = track.volume;
    }
    source.connect(gain).connect(context.destination);
    source.start(when, trim + skipped, Math.max(0.001, length - skipped));
    placed += 1;
  }
  return placed > 0 ? context.startRendering() : null;
}

async function supportedAudioCodec(
  format: "mp4" | "webm",
): Promise<{ codec: string; muxerCodec: string } | null> {
  if (typeof AudioEncoder === "undefined") return null;
  const candidates =
    format === "webm"
      ? [{ codec: "opus", muxerCodec: "A_OPUS" }]
      : [
          { codec: "mp4a.40.2", muxerCodec: "aac" },
          { codec: "opus", muxerCodec: "opus" },
        ];
  for (const candidate of candidates) {
    try {
      const support = await AudioEncoder.isConfigSupported({
        codec: candidate.codec,
        sampleRate: SAMPLE_RATE,
        numberOfChannels: CHANNELS,
        bitrate: 192_000,
      });
      if (support.supported) return candidate;
    } catch {
      // Not this one.
    }
  }
  return null;
}

/** Encodes the mix for the export's muxer; null when this browser cannot encode audio. */
export async function encodeExportAudio(
  buffer: AudioBuffer,
  format: "mp4" | "webm",
): Promise<EncodedExportAudio | null> {
  const codec = await supportedAudioCodec(format);
  if (!codec) return null;
  const chunks: EncodedExportAudio["chunks"] = [];
  let failure: Error | undefined;
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => chunks.push({ chunk, metadata }),
    error: (error) => {
      failure = error;
    },
  });
  encoder.configure({
    codec: codec.codec,
    sampleRate: SAMPLE_RATE,
    numberOfChannels: CHANNELS,
    bitrate: 192_000,
  });
  const channels = Array.from({ length: CHANNELS }, (_, index) =>
    buffer.getChannelData(Math.min(index, buffer.numberOfChannels - 1)),
  );
  try {
    for (let start = 0; start < buffer.length; start += FRAMES_PER_CHUNK) {
      const count = Math.min(FRAMES_PER_CHUNK, buffer.length - start);
      const planar = new Float32Array(count * CHANNELS);
      channels.forEach((channel, index) =>
        planar.set(channel.subarray(start, start + count), index * count),
      );
      const data = new AudioData({
        format: "f32-planar",
        sampleRate: SAMPLE_RATE,
        numberOfFrames: count,
        numberOfChannels: CHANNELS,
        timestamp: Math.round((start / SAMPLE_RATE) * 1_000_000),
        data: planar,
      });
      encoder.encode(data);
      data.close();
      if (failure) throw failure;
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  return {
    muxerCodec: codec.muxerCodec,
    numberOfChannels: CHANNELS,
    sampleRate: SAMPLE_RATE,
    chunks,
  };
}

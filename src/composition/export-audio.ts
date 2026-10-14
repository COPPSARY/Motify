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
    const start = Number.parseFloat(element.dataset["start"] ?? "0");
    const volume = Number.parseFloat(element.dataset["volume"] ?? "1");
    return [
      {
        src,
        start: Number.isFinite(start) ? Math.max(0, start) : 0,
        volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1,
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
  for (const track of tracks) {
    let buffer: AudioBuffer;
    try {
      const response = await fetch(track.src);
      buffer = await context.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      // A track that cannot be read leaves the rest of the mix intact.
      console.warn("Export could not read an audio track.", error);
      continue;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = speed;
    const gain = context.createGain();
    gain.gain.value = track.volume;
    source.connect(gain).connect(context.destination);
    const when = Math.max(0, (track.start - range.start) / speed);
    const offset = Math.max(0, range.start - track.start);
    if (offset >= buffer.duration) continue;
    source.start(when, offset);
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

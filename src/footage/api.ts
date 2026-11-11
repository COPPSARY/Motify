import { fetchApi } from "../api/client";
import { isRawFilm } from "../composition/raw-film";
import { cardFilmDocument, setCardFilm } from "./films";
import type { CaptionCue, FootageEdit } from "./edit";

/**
 * The backend's footage routes (Motionly-Backend: src/routes/footage.routes.ts)
 * and the local copies of each clip's files the editor plays from.
 */

export type FootageStage =
  "queued" | "media" | "transcript" | "analysis" | "done";

export interface ClipMoment {
  start: number;
  end: number;
  label: string;
  kind: string;
  score: number;
}

export interface FootageStatus {
  assetId: string;
  status: "processing" | "ready" | "failed" | "missing";
  stage: FootageStage;
  error?: string;
  media?: {
    durationMs: number;
    width: number;
    height: number;
    fps: number;
    hasAudio: boolean;
    videoCopied: boolean;
  };
  files: string[];
  stripFrames: number;
  scenes: number[];
  silences: Array<{ start: number; end: number }>;
  transcript: {
    language: string;
    text: string;
    words: Array<{ text: string; start: number; end: number }>;
  } | null;
  analysis: {
    summary: string;
    shot: string;
    quality: number;
    issues: string[];
    moments: ClipMoment[];
    avoid: Array<{ start: number; end: number; reason: string }>;
    model: boolean;
  } | null;
}

export interface FootageEditResult {
  edit: FootageEdit;
  summary: string;
  credits?: { charged: number; remaining: number };
}

async function data<T>(response: Response): Promise<T> {
  return ((await response.json()) as { data: T }).data;
}

/** Starts reading a clip (once; the backend keeps the result) and says how far it is. */
export async function ensureFootage(assetId: string): Promise<FootageStatus> {
  return data(
    await fetchApi(`/v1/assets/${assetId}/footage`, { method: "POST" }),
  );
}

export async function footageStatus(assetId: string): Promise<FootageStatus> {
  return data(await fetchApi(`/v1/assets/${assetId}/footage`));
}

export async function roughCut(
  projectId: string,
  input: {
    edit: FootageEdit;
    brief: string;
    seconds: number;
    captionLanguage: string;
    music: boolean;
    /** A voice-over read by Kiri; off unless asked for. */
    voiceover?: boolean;
    /** Pictures to use: a logo, product photos. */
    assetIds?: string[];
  },
): Promise<FootageEditResult> {
  return data(
    await fetchApi(`/v1/projects/${projectId}/footage/rough-cut`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

/** What the person selected; an instruction given with it is about these parts. */
export interface InstructionFocus {
  segmentIds?: string[];
  titleIds?: string[];
  cueIds?: string[];
}

export async function editByInstruction(
  projectId: string,
  edit: FootageEdit,
  instruction: string,
  focus?: InstructionFocus,
  assetIds: string[] = [],
): Promise<FootageEditResult> {
  return data(
    await fetchApi(`/v1/projects/${projectId}/footage/instructions`, {
      method: "POST",
      body: JSON.stringify({
        edit,
        instruction,
        ...(focus ? { focus } : {}),
        ...(assetIds.length > 0 ? { assetIds } : {}),
      }),
    }),
  );
}

/** Starts Motify's generator on a card; it runs in the background on the server. */
export async function startMotionCard(
  projectId: string,
  input: {
    format: string;
    seconds: number;
    brief?: string;
    card: {
      eyebrow?: string;
      title: string;
      label?: string;
      big?: string;
      items?: string[];
    };
    assetIds?: string[];
    note?: string;
  },
): Promise<string> {
  const result = await data<{ cardProjectId: string }>(
    await fetchApi(`/v1/projects/${projectId}/footage/cards`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
  return result.cardProjectId;
}

export interface MotionCardStatus {
  status: "generating" | "ready" | "failed";
  error?: string;
  film?: { html: string; timelineJs: string; duration: number };
}

export async function motionCardStatus(
  cardProjectId: string,
): Promise<MotionCardStatus> {
  return data(await fetchApi(`/v1/footage/cards/${cardProjectId}`));
}

export async function translateCaptions(
  cues: CaptionCue[],
  language: string,
): Promise<CaptionCue[]> {
  const result = await data<{ cues: CaptionCue[] }>(
    await fetchApi(`/v1/footage/captions/translate`, {
      method: "POST",
      body: JSON.stringify({ cues, language }),
    }),
  );
  return result.cues;
}

// ---- local copies ---------------------------------------------------------------------

/**
 * Each clip file is downloaded once per session and played from memory: a
 * signed link expires in minutes, and an export seeks every frame exactly,
 * which a local copy does reliably. An edit remounts its film on every
 * change, so these copies outlive any one mount and are never revoked by it.
 */
const files = new Map<string, Promise<string>>();

/**
 * The person's own file for a clip they just uploaded, played (picture and
 * sound) until the server's prepared copy is ready, so the editor never waits.
 */
const localCopies = new Map<string, string>();

export function seedLocalClip(assetId: string, file: File): void {
  if (!localCopies.has(assetId))
    localCopies.set(assetId, URL.createObjectURL(file));
}

export async function footageFileUrl(
  assetId: string,
  file: string,
): Promise<string> {
  try {
    return await serverFileUrl(assetId, file);
  } catch (error) {
    // Not prepared yet: the local file plays meanwhile, for picture and sound.
    const local = localCopies.get(assetId);
    if (local && (file === "video.mp4" || file === "audio.m4a")) return local;
    throw error;
  }
}

function serverFileUrl(assetId: string, file: string): Promise<string> {
  const key = `${assetId}/${file}`;
  let pending = files.get(key);
  if (!pending) {
    pending = (async () => {
      const response = await fetchApi(
        `/v1/assets/${assetId}/footage/files/${file}`,
      );
      const { url } = await data<{ url: string }>(response);
      const download = /^https?:\/\//i.test(url)
        ? await fetch(url)
        : await fetchApi(url);
      if (!download.ok)
        throw new Error(`Clip download failed: ${download.status}`);
      return URL.createObjectURL(await download.blob());
    })();
    files.set(key, pending);
    pending.catch(() => {
      if (files.get(key) === pending) files.delete(key);
    });
  }
  return pending;
}

const FOOTAGE_TOKEN = /motify-footage:\/\/([0-9a-f-]{36})\/([a-z0-9.]+)/gi;

const effects = new Map<string, Promise<string>>();

/** A WAV file of an audio buffer, for an <audio> element and the export mix. */
function wav(buffer: AudioBuffer): Blob {
  const channel = buffer.getChannelData(0);
  const bytes = new DataView(new ArrayBuffer(44 + channel.length * 2));
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1)
      bytes.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  bytes.setUint32(4, 36 + channel.length * 2, true);
  text(8, "WAVEfmt ");
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true);
  bytes.setUint16(22, 1, true);
  bytes.setUint32(24, buffer.sampleRate, true);
  bytes.setUint32(28, buffer.sampleRate * 2, true);
  bytes.setUint16(32, 2, true);
  bytes.setUint16(34, 16, true);
  text(36, "data");
  bytes.setUint32(40, channel.length * 2, true);
  channel.forEach((sample, index) =>
    bytes.setInt16(
      44 + index * 2,
      Math.max(-1, Math.min(1, sample)) * 0x7fff,
      true,
    ),
  );
  return new Blob([bytes], { type: "audio/wav" });
}

/** A whoosh (swept, filtered noise) or a pop (a falling blip), made once per session. */
export function soundEffectUrl(name: string): Promise<string> {
  let pending = effects.get(name);
  if (!pending) {
    pending = (async () => {
      const rate = 44_100;
      const seconds = name === "pop" ? 0.16 : 0.5;
      const context = new OfflineAudioContext(
        1,
        Math.ceil(rate * seconds),
        rate,
      );
      const gain = context.createGain();
      gain.connect(context.destination);
      if (name === "pop") {
        const tone = context.createOscillator();
        tone.type = "sine";
        tone.frequency.setValueAtTime(950, 0);
        tone.frequency.exponentialRampToValueAtTime(240, seconds);
        gain.gain.setValueAtTime(0.0001, 0);
        gain.gain.exponentialRampToValueAtTime(0.9, 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, seconds);
        tone.connect(gain);
        tone.start(0);
      } else {
        const noise = context.createBuffer(1, Math.ceil(rate * seconds), rate);
        const data = noise.getChannelData(0);
        // A fixed seed keeps the whoosh the same in preview and export.
        let seed = 7;
        for (let index = 0; index < data.length; index += 1) {
          seed = (seed * 16807) % 2147483647;
          data[index] = (seed / 2147483647) * 2 - 1;
        }
        const source = context.createBufferSource();
        source.buffer = noise;
        const band = context.createBiquadFilter();
        band.type = "bandpass";
        band.Q.value = 1.2;
        band.frequency.setValueAtTime(350, 0);
        band.frequency.exponentialRampToValueAtTime(3800, seconds * 0.55);
        band.frequency.exponentialRampToValueAtTime(900, seconds);
        gain.gain.setValueAtTime(0.0001, 0);
        gain.gain.exponentialRampToValueAtTime(0.8, seconds * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, seconds);
        source.connect(band).connect(gain);
        source.start(0);
      }
      return URL.createObjectURL(wav(await context.startRendering()));
    })();
    effects.set(name, pending);
  }
  return pending;
}

/** The source with every `motify-footage://` token swapped for its local copy. */
export async function hydrateFootageTokens(source: string): Promise<string> {
  const tokens = new Map<string, { assetId: string; file: string }>();
  for (const match of source.matchAll(FOOTAGE_TOKEN))
    tokens.set(match[0], { assetId: match[1]!, file: match[2]! });
  let hydrated = source;
  for (const name of new Set(
    [...source.matchAll(/motify-sfx:\/\/(whoosh|pop)/g)].map(
      (match) => match[1]!,
    ),
  )) {
    try {
      hydrated = hydrated.replaceAll(
        `motify-sfx://${name}`,
        await soundEffectUrl(name),
      );
    } catch {
      hydrated = hydrated.replaceAll(`motify-sfx://${name}`, "");
    }
  }
  await Promise.all(
    [...tokens].map(async ([token, { assetId, file }]) => {
      try {
        const url = await footageFileUrl(assetId, file);
        hydrated = hydrated.replaceAll(token, url);
      } catch (error) {
        // A clip that is not ready yet plays as nothing rather than failing the edit.
        console.warn("[Footage] clip file unavailable", token, error);
        hydrated = hydrated.replaceAll(token, "");
      }
    }),
  );
  return hydrated;
}

/** Image files (poster, filmstrip) are small; the browser fetches them from a signed link. */
export async function footageImageUrl(
  assetId: string,
  file: "poster.jpg" | "strip.jpg",
): Promise<string> {
  return footageFileUrl(assetId, file);
}

/** Loads a ready card's film once; false while it is not ready (or is not a raw film). */
export async function loadCardFilm(projectId: string): Promise<boolean> {
  if (cardFilmDocument(projectId)) return true;
  const status = await motionCardStatus(projectId);
  if (status.status !== "ready" || !status.film) return false;
  if (!isRawFilm(status.film.timelineJs)) return false;
  setCardFilm(projectId, status.film.html);
  return true;
}

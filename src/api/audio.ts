import type { AudioTrack, ProjectsApi } from "../cloud/projects-api";
import { uploadAsset } from "./assets";
import { fetchApi } from "./client";

/** The container types the backend accepts, keyed by the extension it checks. */
const AUDIO_CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".weba": "audio/webm",
};

export const AUDIO_ACCEPT = "audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.weba";
export const AUDIO_MAX_BYTES = 50_000_000;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export function isAudioFile(file: File): boolean {
  return (
    file.type.startsWith("audio/") ||
    extensionOf(file.name) in AUDIO_CONTENT_TYPES
  );
}

/**
 * Browsers disagree on what to call the same song (`audio/x-m4a`, `audio/mp3`)
 * and often report nothing for .m4a or .aac. The backend requires the type to
 * match the extension, so the extension decides.
 */
export function audioContentType(file: File): string {
  const known = AUDIO_CONTENT_TYPES[extensionOf(file.name)];
  if (known) return known;
  if (file.type === "audio/webm") return file.type;
  throw new Error(
    `${file.name} is not a supported audio file. Use MP3, WAV, OGG, M4A, or AAC.`,
  );
}

/**
 * The container the file's first bytes actually hold, as the extension that
 * names it. Mirrors the backend's signature check, which is what decides.
 * MPEG audio and ADTS AAC share a sync word, so a header can match both.
 */
export function sniffAudioExtensions(header: Uint8Array): string[] {
  const ascii = String.fromCharCode(...header.subarray(0, 16));
  const [b0 = 0, b1 = 0, b2 = 0, b3 = 0] = header;
  const found: string[] = [];
  if (ascii.startsWith("ID3") || (b0 === 0xff && (b1 & 0xe0) === 0xe0))
    found.push(".mp3");
  if (b0 === 0xff && (b1 & 0xf6) === 0xf0) found.push(".aac");
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE")
    found.push(".wav");
  if (ascii.startsWith("OggS")) found.push(".ogg");
  if (ascii.slice(4, 8) === "ftyp") found.push(".m4a");
  if (b0 === 0x1a && b1 === 0x45 && b2 === 0xdf && b3 === 0xa3)
    found.push(".weba");
  return found;
}

/**
 * The file as it should be uploaded. Downloaders routinely save an M4A or
 * WebM stream under a `.mp3` name; declaring it by extension got it rejected
 * as "bytes do not match an allowed safe asset type". When the bytes name a
 * different supported container, upload it as that one, renamed to match,
 * because the backend requires extension, declared type and bytes to agree.
 */
export async function normalizeAudioFile(file: File): Promise<File> {
  const named = extensionOf(file.name);
  const extension =
    named === ".webm" ? ".weba" : named === ".oga" ? ".ogg" : named;
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const actual = sniffAudioExtensions(header);
  const [detected] = actual;
  const detectedType = detected && AUDIO_CONTENT_TYPES[detected];
  if (!detectedType || actual.includes(extension)) {
    return new File([file], file.name, { type: audioContentType(file) });
  }
  const base =
    file.name.lastIndexOf(".") === -1
      ? file.name
      : file.name.slice(0, file.name.lastIndexOf("."));
  return new File([file], `${base}${detected}`, { type: detectedType });
}

export function formatTrackDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/**
 * Uploads a song and adds it to the workspace's music library. Uploading
 * reuses the asset pipeline (checksum, signed upload, verification); the
 * library entry is registered once the bytes are confirmed.
 */
export async function addTrackToLibrary(
  api: ProjectsApi,
  workspaceId: string,
  file: File,
  onProgress?: (percentage: number) => void,
): Promise<AudioTrack> {
  audioContentType(file);
  if (file.size > AUDIO_MAX_BYTES) {
    throw new Error(`${file.name} is larger than 50 MB.`);
  }
  const assetId = await uploadAsset(
    workspaceId,
    await normalizeAudioFile(file),
    onProgress,
  );
  try {
    return await api.registerAudioTrack(workspaceId, { assetId });
  } catch (error) {
    // The upload is verified but nothing points at it; do not leave it behind.
    await fetchApi(`/v1/assets/${assetId}`, { method: "DELETE" }).catch(
      () => undefined,
    );
    throw error;
  }
}

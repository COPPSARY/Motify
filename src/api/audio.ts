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
  const type = audioContentType(file);
  if (file.size > AUDIO_MAX_BYTES) {
    throw new Error(`${file.name} is larger than 50 MB.`);
  }
  const assetId = await uploadAsset(
    workspaceId,
    new File([file], file.name, { type }),
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

import { fetchApi } from "./client";

const MOTIFY_AUDIO_TOKEN =
  /motify-audio:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

/**
 * Songs are large and one generation hydrates its source several times (once
 * per validation pass, then once to mount), so the bytes are fetched once per
 * track and kept for the session. A small cap keeps memory bounded.
 */
const MAX_CACHED_TRACKS = 4;
const blobs = new Map<string, Promise<Blob>>();

export function fetchAudioBlob(trackId: string): Promise<Blob> {
  const cached = blobs.get(trackId);
  if (cached) return cached;
  const pending = downloadAudio(trackId);
  blobs.set(trackId, pending);
  pending.catch(() => {
    if (blobs.get(trackId) === pending) blobs.delete(trackId);
  });
  while (blobs.size > MAX_CACHED_TRACKS) {
    const oldest = blobs.keys().next().value;
    if (oldest === undefined) break;
    blobs.delete(oldest);
  }
  return pending;
}

export function clearAudioBlobCache(): void {
  blobs.clear();
}

async function downloadAudio(trackId: string): Promise<Blob> {
  // Signed links expire in minutes, so a composition never holds one: it plays
  // from a local copy instead, which also makes seeking reliable.
  const accessResponse = await fetchApi(`/v1/audio/${trackId}/access`);
  const { data } = (await accessResponse.json()) as { data: { url: string } };
  const response = /^https?:\/\//i.test(data.url)
    ? await fetch(data.url)
    : await fetchApi(data.url);
  if (!response.ok)
    throw new Error(`Audio download failed: ${response.status}`);
  return response.blob();
}

/**
 * Swaps every `motify-audio://` token for a playable object URL. A track that
 * cannot be fetched (deleted, offline) keeps its token: a silent film is a
 * far better outcome than one that refuses to open.
 */
export async function hydrateAudioTokens(
  source: string,
): Promise<{ source: string; objectUrls: string[] }> {
  const trackIds = [...source.matchAll(MOTIFY_AUDIO_TOKEN)].map(
    (match) => match[1],
  );
  let hydrated = source;
  const objectUrls: string[] = [];

  for (const trackId of new Set(trackIds)) {
    if (!trackId) continue;
    try {
      const objectUrl = URL.createObjectURL(await fetchAudioBlob(trackId));
      objectUrls.push(objectUrl);
      hydrated = hydrated.replaceAll(`motify-audio://${trackId}`, objectUrl);
    } catch (error) {
      console.warn(`Could not load audio track ${trackId}.`, error);
    }
  }

  return { source: hydrated, objectUrls };
}

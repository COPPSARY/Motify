import { get, writable } from "svelte/store";
import { ensureFootage, footageStatus, type FootageStatus } from "./api";

/**
 * How far the backend is with reading each clip, by asset id. Reading is
 * asked for once per clip and then followed until it is ready or failed; a
 * clip already read (the same bytes, in any project) answers ready at once.
 */
export const clipStatuses = writable<Record<string, FootageStatus>>({});

const watching = new Set<string>();
const POLL_MS = 2500;

function put(status: FootageStatus): void {
  clipStatuses.update((all) => ({ ...all, [status.assetId]: status }));
}

export function watchClips(assetIds: readonly string[]): void {
  for (const assetId of assetIds) {
    if (watching.has(assetId)) continue;
    const known = get(clipStatuses)[assetId];
    if (known?.status === "ready") continue;
    watching.add(assetId);
    void follow(assetId);
  }
}

async function follow(assetId: string): Promise<void> {
  try {
    let status = await ensureFootage(assetId);
    put(status);
    while (status.status === "processing") {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      status = await footageStatus(assetId);
      put(status);
    }
  } catch (error) {
    put({
      assetId,
      status: "failed",
      stage: "queued",
      error:
        error instanceof Error ? error.message : "This clip could not be read.",
      files: [],
      stripFrames: 0,
      scenes: [],
      silences: [],
      transcript: null,
      analysis: null,
    });
  } finally {
    watching.delete(assetId);
  }
}

/** Asks again for a clip that failed. */
export function retryClip(assetId: string): void {
  clipStatuses.update((all) => {
    const next = { ...all };
    delete next[assetId];
    return next;
  });
  watchClips([assetId]);
}

/** Resolves once every clip is read; rejects naming the first that failed. */
export function whenClipsReady(assetIds: readonly string[]): Promise<void> {
  watchClips(assetIds);
  return new Promise((resolve, reject) => {
    const unsubscribe = clipStatuses.subscribe((all) => {
      const failed = assetIds.find((id) => all[id]?.status === "failed");
      if (failed) {
        queueMicrotask(() => unsubscribe());
        reject(new Error(all[failed]?.error ?? "A clip could not be read."));
        return;
      }
      if (assetIds.every((id) => all[id]?.status === "ready")) {
        queueMicrotask(() => unsubscribe());
        resolve();
      }
    });
  });
}

export const STAGE_LABEL: Record<FootageStatus["stage"], string> = {
  queued: "Waiting",
  media: "Preparing video",
  transcript: "Listening",
  analysis: "Watching",
  done: "Ready",
};

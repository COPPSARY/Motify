import { get, writable } from "svelte/store";

import type {
  AudioLibraryScope,
  AudioTrack,
  ProjectsApi,
} from "../cloud/projects-api";

/** A film scored to three songs is already a lot to ask of one prompt. */
export const MAX_SELECTED_AUDIO = 3;

export interface MusicFilter {
  scope: AudioLibraryScope;
  query: string;
}

export type MusicStatus = "idle" | "loading" | "ready" | "error";

/** Every track the signed-in workspace can use, narrowed by `musicFilter`. */
export const musicTracks = writable<AudioTrack[]>([]);
export const musicStatus = writable<MusicStatus>("idle");
export const musicError = writable("");
export const musicFilter = writable<MusicFilter>({ scope: "all", query: "" });

/** Songs chosen for the next message; cleared once it is sent. */
export const selectedAudio = writable<AudioTrack[]>([]);

/** Songs the open project is already scored to. */
export const projectAudio = writable<AudioTrack[]>([]);

let libraryRequest = 0;
let projectRequest = 0;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Loads the library for the current filter. A newer request supersedes an older one. */
export async function refreshMusicLibrary(
  api: ProjectsApi,
  workspaceId: string,
): Promise<void> {
  const request = ++libraryRequest;
  const filter = get(musicFilter);
  musicStatus.set("loading");
  try {
    const { tracks } = await api.listAudioTracks(workspaceId, {
      scope: filter.scope,
      query: filter.query,
    });
    if (request !== libraryRequest) return;
    musicTracks.set(tracks);
    musicError.set("");
    musicStatus.set("ready");
  } catch (error) {
    if (request !== libraryRequest) return;
    musicError.set(messageOf(error, "Could not load your music library."));
    musicStatus.set("error");
  }
}

/** Loads the tracks a project is scored to; `null` means no project is open. */
export async function refreshProjectAudio(
  api: ProjectsApi,
  projectId: string | null,
): Promise<void> {
  const request = ++projectRequest;
  if (!projectId) {
    projectAudio.set([]);
    return;
  }
  try {
    const tracks = await api.listProjectAudio(projectId);
    if (request === projectRequest) projectAudio.set(tracks);
  } catch {
    // The panel still works from the library; the project list is a convenience.
    if (request === projectRequest) projectAudio.set([]);
  }
}

/** Returns false when the message already carries the most songs it can. */
export function selectAudioTrack(track: AudioTrack): boolean {
  const current = get(selectedAudio);
  if (current.some((item) => item.id === track.id)) return true;
  if (current.length >= MAX_SELECTED_AUDIO) return false;
  selectedAudio.set([...current, track]);
  return true;
}

export function deselectAudioTrack(trackId: string): void {
  selectedAudio.update((tracks) =>
    tracks.filter((track) => track.id !== trackId),
  );
}

/** Keeps chips and lists honest after a track is edited or deleted. */
export function replaceTrack(track: AudioTrack): void {
  const swap = (tracks: AudioTrack[]) =>
    tracks.map((item) => (item.id === track.id ? track : item));
  musicTracks.update(swap);
  selectedAudio.update(swap);
  projectAudio.update(swap);
}

export function forgetTrack(trackId: string): void {
  const drop = (tracks: AudioTrack[]) =>
    tracks.filter((item) => item.id !== trackId);
  musicTracks.update(drop);
  selectedAudio.update(drop);
  projectAudio.update(drop);
}

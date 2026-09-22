import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioTrack } from "../cloud/projects-api";
import {
  MAX_SELECTED_AUDIO,
  deselectAudioTrack,
  forgetTrack,
  musicError,
  musicFilter,
  musicStatus,
  musicTracks,
  projectAudio,
  refreshMusicLibrary,
  refreshProjectAudio,
  replaceTrack,
  selectAudioTrack,
  selectedAudio,
} from "./music-library";

function track(id: string, title = id): AudioTrack {
  return {
    id,
    scope: "workspace",
    workspaceId: "workspace",
    title,
    artist: null,
    genre: null,
    moodTags: [],
    bpm: null,
    license: null,
    durationMs: 30_000,
    contentType: "audio/mpeg",
    byteSize: 1,
    token: `motify-audio://${id}`,
    createdAt: "2026-09-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  musicTracks.set([]);
  musicStatus.set("idle");
  musicError.set("");
  musicFilter.set({ scope: "all", query: "" });
  selectedAudio.set([]);
  projectAudio.set([]);
});

describe("music library", () => {
  it("loads the library with the current filter", async () => {
    musicFilter.set({ scope: "system", query: "calm" });
    const api = {
      listAudioTracks: vi
        .fn()
        .mockResolvedValue({ tracks: [track("a")], totalItems: 1 }),
    };

    await refreshMusicLibrary(api as never, "workspace");

    expect(api.listAudioTracks).toHaveBeenCalledWith("workspace", {
      scope: "system",
      query: "calm",
    });
    expect(get(musicTracks)).toEqual([track("a")]);
    expect(get(musicStatus)).toBe("ready");
  });

  it("reports a failed load and recovers on the next one", async () => {
    const api = {
      listAudioTracks: vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ tracks: [track("a")], totalItems: 1 }),
    };

    await refreshMusicLibrary(api as never, "workspace");
    expect(get(musicStatus)).toBe("error");
    expect(get(musicError)).toBe("offline");

    await refreshMusicLibrary(api as never, "workspace");
    expect(get(musicStatus)).toBe("ready");
    expect(get(musicError)).toBe("");
  });

  it("ignores a slow response that a newer request has superseded", async () => {
    let releaseSlow: (value: unknown) => void = () => undefined;
    const api = {
      listAudioTracks: vi
        .fn()
        .mockImplementationOnce(
          () => new Promise((resolve) => (releaseSlow = resolve)),
        )
        .mockResolvedValueOnce({ tracks: [track("fresh")], totalItems: 1 }),
    };

    const slow = refreshMusicLibrary(api as never, "workspace");
    await refreshMusicLibrary(api as never, "workspace");
    releaseSlow({ tracks: [track("stale")], totalItems: 1 });
    await slow;

    expect(get(musicTracks).map((item) => item.id)).toEqual(["fresh"]);
  });

  it("clears the project's songs when no project is open", async () => {
    projectAudio.set([track("a")]);

    await refreshProjectAudio({} as never, null);

    expect(get(projectAudio)).toEqual([]);
  });

  it("loads a project's songs, and shows none if that fails", async () => {
    const api = {
      listProjectAudio: vi
        .fn()
        .mockResolvedValueOnce([track("a")])
        .mockRejectedValueOnce(new Error("offline")),
    };

    await refreshProjectAudio(api as never, "project");
    expect(get(projectAudio)).toEqual([track("a")]);

    await refreshProjectAudio(api as never, "project");
    expect(get(projectAudio)).toEqual([]);
  });
});

describe("song selection", () => {
  it("selects a song once and lets it be removed", () => {
    expect(selectAudioTrack(track("a"))).toBe(true);
    expect(selectAudioTrack(track("a"))).toBe(true);
    expect(get(selectedAudio)).toHaveLength(1);

    deselectAudioTrack("a");
    expect(get(selectedAudio)).toEqual([]);
  });

  it("refuses a song beyond the per-message limit", () => {
    for (let index = 0; index < MAX_SELECTED_AUDIO; index += 1) {
      expect(selectAudioTrack(track(`t${index}`))).toBe(true);
    }

    expect(selectAudioTrack(track("one-too-many"))).toBe(false);
    expect(get(selectedAudio)).toHaveLength(MAX_SELECTED_AUDIO);
  });

  it("keeps every list honest when a track is edited or deleted", () => {
    musicTracks.set([track("a", "Old"), track("b")]);
    selectedAudio.set([track("a", "Old")]);
    projectAudio.set([track("a", "Old")]);

    replaceTrack(track("a", "New"));
    expect(get(musicTracks)[0]?.title).toBe("New");
    expect(get(selectedAudio)[0]?.title).toBe("New");
    expect(get(projectAudio)[0]?.title).toBe("New");

    forgetTrack("a");
    expect(get(musicTracks).map((item) => item.id)).toEqual(["b"]);
    expect(get(selectedAudio)).toEqual([]);
    expect(get(projectAudio)).toEqual([]);
  });
});

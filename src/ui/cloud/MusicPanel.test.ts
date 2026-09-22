import { mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioTrack } from "../../cloud/projects-api";
import {
  musicFilter,
  musicStatus,
  musicTracks,
  projectAudio,
  selectedAudio,
} from "../../stores/music-library";
import MusicPanel from "./MusicPanel.svelte";

const addTrackToLibrary = vi.hoisted(() => vi.fn());
vi.mock("../../api/audio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/audio")>()),
  addTrackToLibrary,
}));

function track(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: "track-1",
    scope: "workspace",
    workspaceId: "workspace",
    title: "Bright Future",
    artist: "Studio",
    genre: "electronic",
    moodTags: ["upbeat"],
    bpm: 120,
    license: null,
    durationMs: 151_000,
    contentType: "audio/mpeg",
    byteSize: 10,
    token: "motify-audio://track-1",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

const builtIn = track({
  id: "system-1",
  scope: "system",
  workspaceId: null,
  title: "Calm Bed",
  artist: null,
  genre: "ambient",
  moodTags: [],
  bpm: null,
  license: "CC0",
  token: "motify-audio://system-1",
});

let component: ReturnType<typeof mount> | undefined;

function makeApi(tracks: AudioTrack[] = [track(), builtIn]) {
  return {
    listAudioTracks: vi
      .fn()
      .mockResolvedValue({ tracks, totalItems: tracks.length }),
    updateAudioTrack: vi.fn(),
    removeAudioTrack: vi.fn().mockResolvedValue(undefined),
    getAudioAccess: vi
      .fn()
      .mockResolvedValue({ url: "https://storage/song", expiresIn: 300 }),
  };
}

async function render(api = makeApi(), props: Record<string, unknown> = {}) {
  const callbacks = {
    onUse: vi.fn(),
    onRemoveFromProject: vi.fn().mockResolvedValue(undefined),
    onNotice: vi.fn(),
  };
  const target = document.createElement("div");
  document.body.append(target);
  component = mount(MusicPanel, {
    target,
    props: { api, workspaceId: "workspace", ...callbacks, ...props } as never,
  });
  await settle();
  return { api, ...callbacks };
}

async function settle() {
  for (let index = 0; index < 5; index += 1) {
    await tick();
    await Promise.resolve();
  }
}

const buttonByLabel = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.trim().startsWith(text),
  );

/** Finds an element the test depends on, failing with its selector if absent. */
function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Expected ${selector} to be rendered.`);
  return element;
}

function dropEvent(type: string, files: File[]) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types: ["Files"], files, dropEffect: "" },
  });
  return event;
}

beforeEach(() => {
  musicTracks.set([]);
  musicStatus.set("idle");
  musicFilter.set({ scope: "all", query: "" });
  selectedAudio.set([]);
  projectAudio.set([]);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
    () => undefined,
  );
});

afterEach(async () => {
  if (component) await unmount(component);
  component = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
  addTrackToLibrary.mockReset();
});

describe("MusicPanel", () => {
  it("asks a signed-out visitor to sign in instead of offering uploads", async () => {
    const { api } = await render(makeApi(), { workspaceId: "" });

    expect(document.body.textContent).toContain("Sign in to use music");
    expect(document.querySelector(".music-dropzone")).toBeNull();
    expect(api.listAudioTracks).not.toHaveBeenCalled();
  });

  it("lists songs with their details and only lets you change your own", async () => {
    await render();

    const text = document.body.textContent ?? "";
    expect(text).toContain("Bright Future");
    expect(text).toContain("Studio · electronic · 2:31 · 120 BPM");
    expect(text).toContain("upbeat");
    expect(text).toContain("Calm Bed");
    expect(text).toContain("Built-in");
    expect(buttonByLabel("Edit Bright Future")).not.toBeNull();
    expect(buttonByLabel("Delete Bright Future")).not.toBeNull();
    expect(buttonByLabel("Edit Calm Bed")).toBeNull();
    expect(buttonByLabel("Delete Calm Bed")).toBeNull();
  });

  it("shows an empty state that points at the drop zone", async () => {
    await render(makeApi([]));

    expect(document.body.textContent).toContain("No songs yet");
  });

  it("uploads a dropped song and reports it", async () => {
    addTrackToLibrary.mockResolvedValue(track({ title: "Dropped Song" }));
    const { api, onNotice } = await render();
    const song = new File(["x"], "dropped.mp3", { type: "audio/mpeg" });

    document
      .querySelector(".music-dropzone")
      ?.dispatchEvent(dropEvent("drop", [song]));
    await settle();

    expect(addTrackToLibrary).toHaveBeenCalledWith(
      api,
      "workspace",
      song,
      expect.any(Function),
    );
    expect(onNotice).toHaveBeenCalledWith(
      "Dropped Song added to your music library.",
    );
    expect(api.listAudioTracks).toHaveBeenCalledTimes(2);
  });

  it("turns away files that are not songs", async () => {
    const { onNotice } = await render();

    document
      .querySelector(".music-dropzone")
      ?.dispatchEvent(
        dropEvent("drop", [new File(["x"], "logo.png", { type: "image/png" })]),
      );
    await settle();

    expect(addTrackToLibrary).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith(
      expect.stringContaining("Only audio files"),
    );
  });

  it("keeps a failed upload visible with its reason", async () => {
    addTrackToLibrary.mockRejectedValue(
      new Error("song.mp3 is larger than 50 MB."),
    );
    await render();

    document
      .querySelector(".music-dropzone")
      ?.dispatchEvent(
        dropEvent("drop", [
          new File(["x"], "song.mp3", { type: "audio/mpeg" }),
        ]),
      );
    await settle();

    expect(document.body.textContent).toContain("larger than 50 MB");
    buttonByLabel("Dismiss song.mp3")?.click();
    await settle();
    expect(document.body.textContent).not.toContain("larger than 50 MB");
  });

  it("highlights the drop zone while a file is dragged over it", async () => {
    await render();
    const zone = document.querySelector(".music-dropzone");

    zone?.dispatchEvent(dropEvent("dragenter", []));
    await settle();
    expect(zone?.classList.contains("is-drag-active")).toBe(true);

    zone?.dispatchEvent(new Event("dragleave", { bubbles: true }));
    await settle();
    expect(zone?.classList.contains("is-drag-active")).toBe(false);
  });

  it("selects a song for the next message and can undo it", async () => {
    const { onUse } = await render();

    buttonByText("Use")?.click();
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({ id: "track-1" }),
    );

    selectedAudio.set([track()]);
    await settle();
    expect(buttonByText("Selected")).toBeDefined();
    buttonByText("Selected")?.click();
    await settle();
    expect(document.body.textContent).not.toContain("Selected");
  });

  it("marks a song already scoring the project and protects it from deletion", async () => {
    projectAudio.set([track()]);
    await render();

    const row = [...document.querySelectorAll(".music-list")].at(-1);
    expect(row?.textContent).toContain("In project");
    expect(buttonByLabel("Delete Bright Future")?.disabled).toBe(true);
  });

  it("stops offering songs once a message holds the maximum", async () => {
    selectedAudio.set([
      track({ id: "a", title: "A" }),
      track({ id: "b", title: "B" }),
      track({ id: "c", title: "C" }),
    ]);
    await render();

    const use = [
      ...document.querySelectorAll<HTMLButtonElement>(".music-use"),
    ].find((button) => button.textContent?.trim() === "Use");
    expect(use?.disabled).toBe(true);
    expect(use?.title).toContain("Up to 3 songs");
  });

  it("asks before deleting and shows why a delete failed", async () => {
    const api = makeApi();
    api.removeAudioTrack.mockRejectedValueOnce(
      new Error("Remove this track from every project before deleting it."),
    );
    await render(api);

    buttonByLabel("Delete Bright Future")?.click();
    await settle();
    expect(document.body.textContent).toContain("Delete?");
    expect(api.removeAudioTrack).not.toHaveBeenCalled();

    buttonByLabel("Confirm deleting Bright Future")?.click();
    await settle();
    expect(api.removeAudioTrack).toHaveBeenCalledWith("track-1");
    expect(document.body.textContent).toContain("before deleting it");
  });

  it("deletes a song once confirmed", async () => {
    musicTracks.set([track()]);
    const { api, onNotice } = await render();

    buttonByLabel("Delete Bright Future")?.click();
    await settle();
    buttonByLabel("Confirm deleting Bright Future")?.click();
    await settle();

    expect(api.removeAudioTrack).toHaveBeenCalledWith("track-1");
    expect(onNotice).toHaveBeenCalledWith(
      "Bright Future deleted from your music library.",
    );
    expect(document.body.textContent).not.toContain("Studio · electronic");
  });

  it("sends only the changed fields when editing", async () => {
    const api = makeApi();
    api.updateAudioTrack.mockResolvedValue(track({ bpm: 128 }));
    await render(api);

    buttonByLabel("Edit Bright Future")?.click();
    await settle();
    const bpm = must<HTMLInputElement>('.music-edit input[type="number"]');
    expect(bpm.value).toBe("120");
    bpm.value = "128";
    bpm.dispatchEvent(new Event("input", { bubbles: true }));
    document
      .querySelector<HTMLFormElement>(".music-edit")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();

    expect(api.updateAudioTrack).toHaveBeenCalledWith("track-1", { bpm: 128 });
    expect(document.querySelector(".music-edit")).toBeNull();
  });

  it("clears a field the user blanks and rejects an impossible tempo", async () => {
    const api = makeApi();
    api.updateAudioTrack.mockResolvedValue(track({ artist: null }));
    await render(api);

    buttonByLabel("Edit Bright Future")?.click();
    await settle();
    const artist = must<HTMLInputElement>(
      ".music-edit label:nth-of-type(2) input",
    );
    const bpm = must<HTMLInputElement>('.music-edit input[type="number"]');
    bpm.value = "900";
    bpm.dispatchEvent(new Event("input", { bubbles: true }));
    document
      .querySelector<HTMLFormElement>(".music-edit")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    expect(document.body.textContent).toContain(
      "BPM must be a whole number from 20 to 300",
    );
    expect(api.updateAudioTrack).not.toHaveBeenCalled();

    bpm.value = "120";
    bpm.dispatchEvent(new Event("input", { bubbles: true }));
    artist.value = "";
    artist.dispatchEvent(new Event("input", { bubbles: true }));
    document
      .querySelector<HTMLFormElement>(".music-edit")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    expect(api.updateAudioTrack).toHaveBeenCalledWith("track-1", {
      artist: null,
    });
  });

  it("searches after the user stops typing", async () => {
    vi.useFakeTimers();
    const { api } = await render();
    const search = must<HTMLInputElement>(".music-search input");

    search.value = "upbeat";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(100);
    expect(api.listAudioTracks).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(200);
    expect(api.listAudioTracks).toHaveBeenLastCalledWith("workspace", {
      scope: "all",
      query: "upbeat",
    });
  });

  it("narrows the library to built-in tracks", async () => {
    const { api } = await render();

    buttonByText("Built-in")?.click();
    await settle();

    expect(api.listAudioTracks).toHaveBeenLastCalledWith("workspace", {
      scope: "system",
      query: "",
    });
  });

  it("previews a song straight from its signed link", async () => {
    const { api } = await render();

    buttonByLabel("Play Bright Future")?.click();
    await settle();

    expect(api.getAudioAccess).toHaveBeenCalledWith("track-1");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("removes a song from the project, but not while Tiffy is working", async () => {
    projectAudio.set([track()]);
    const first = await render(makeApi(), { busy: true });
    expect(
      buttonByLabel("Remove Bright Future from this project")?.disabled,
    ).toBe(true);
    if (component) await unmount(component);
    document.body.replaceChildren();

    const second = await render(makeApi(), { busy: false });
    buttonByLabel("Remove Bright Future from this project")?.click();
    await settle();

    expect(first.onRemoveFromProject).not.toHaveBeenCalled();
    expect(second.onRemoveFromProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: "track-1" }),
    );
  });

  it("explains why removing a song failed", async () => {
    projectAudio.set([track()]);
    await render(makeApi(), {
      onRemoveFromProject: vi
        .fn()
        .mockRejectedValue(new Error("Project not found.")),
    });

    buttonByLabel("Remove Bright Future from this project")?.click();
    await settle();

    expect(document.body.textContent).toContain("Project not found.");
  });
});

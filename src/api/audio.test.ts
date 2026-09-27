import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addTrackToLibrary,
  audioContentType,
  formatTrackDuration,
  isAudioFile,
} from "./audio";

const uploadAsset = vi.hoisted(() => vi.fn());
const fetchApi = vi.hoisted(() => vi.fn());

vi.mock("./assets", () => ({ uploadAsset }));
vi.mock("./client", () => ({ fetchApi }));

const file = (name: string, type = "") => new File(["x"], name, { type });

afterEach(() => {
  vi.clearAllMocks();
});

describe("audio files", () => {
  it("recognizes songs by type or extension", () => {
    expect(isAudioFile(file("a.mp3", "audio/mpeg"))).toBe(true);
    expect(isAudioFile(file("a.m4a"))).toBe(true);
    expect(isAudioFile(file("A.WAV"))).toBe(true);
    expect(isAudioFile(file("logo.png", "image/png"))).toBe(false);
    expect(isAudioFile(file("clip.mp4", "video/mp4"))).toBe(false);
  });

  it("names the type the backend expects for the extension", () => {
    expect(audioContentType(file("a.mp3", "audio/mp3"))).toBe("audio/mpeg");
    expect(audioContentType(file("a.m4a", ""))).toBe("audio/mp4");
    expect(audioContentType(file("a.aac", "audio/x-aac"))).toBe("audio/aac");
    expect(audioContentType(file("a.webm", "audio/webm"))).toBe("audio/webm");
    expect(() => audioContentType(file("a.txt", "text/plain"))).toThrow(
      "not a supported audio file",
    );
  });

  it("formats durations as minutes and seconds", () => {
    expect(formatTrackDuration(0)).toBe("0:00");
    expect(formatTrackDuration(32_400)).toBe("0:32");
    expect(formatTrackDuration(151_000)).toBe("2:31");
  });
});

describe("addTrackToLibrary", () => {
  it("uploads with the corrected type, then registers the asset", async () => {
    uploadAsset.mockResolvedValue("asset-1");
    const api = {
      registerAudioTrack: vi.fn().mockResolvedValue({ id: "track-1" }),
    };

    await expect(
      addTrackToLibrary(api as never, "workspace-1", file("song.m4a")),
    ).resolves.toEqual({ id: "track-1" });

    const uploaded = uploadAsset.mock.calls[0]?.[1] as File;
    expect(uploaded.type).toBe("audio/mp4");
    expect(uploaded.name).toBe("song.m4a");
    expect(api.registerAudioTrack).toHaveBeenCalledWith("workspace-1", {
      assetId: "asset-1",
    });
  });

  it("rejects an oversized file before uploading anything", async () => {
    const big = file("song.mp3", "audio/mpeg");
    Object.defineProperty(big, "size", { value: 50_000_001 });

    await expect(
      addTrackToLibrary({} as never, "workspace-1", big),
    ).rejects.toThrow("larger than 50 MB");
    expect(uploadAsset).not.toHaveBeenCalled();
  });

  it("uploads an M4A saved under a .mp3 name as the M4A it is", async () => {
    uploadAsset.mockResolvedValue("asset-1");
    const api = {
      registerAudioTrack: vi.fn().mockResolvedValue({ id: "track-1" }),
    };
    // The header of a YouTube-downloader "mp3": an ISO/DASH MP4 box.
    const header = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x64, 0x61, 0x73, 0x68,
      0x00, 0x00, 0x00, 0x00,
    ]);
    const song = new File([header], "Warriyo - Mortals (NCS).mp3", {
      type: "audio/mpeg",
    });

    await addTrackToLibrary(api as never, "workspace-1", song);

    const uploaded = uploadAsset.mock.calls[0]?.[1] as File;
    expect(uploaded.name).toBe("Warriyo - Mortals (NCS).m4a");
    expect(uploaded.type).toBe("audio/mp4");
  });

  it("keeps a real MP3 as an MP3", async () => {
    uploadAsset.mockResolvedValue("asset-1");
    const api = {
      registerAudioTrack: vi.fn().mockResolvedValue({ id: "track-1" }),
    };
    const song = new File(
      [new TextEncoder().encode("ID3\u0004\u0000")],
      "a.mp3",
    );

    await addTrackToLibrary(api as never, "workspace-1", song);

    const uploaded = uploadAsset.mock.calls[0]?.[1] as File;
    expect(uploaded.name).toBe("a.mp3");
    expect(uploaded.type).toBe("audio/mpeg");
  });

  it("removes the uploaded file when registering it fails", async () => {
    uploadAsset.mockResolvedValue("asset-1");
    fetchApi.mockResolvedValue(new Response(null, { status: 204 }));
    const api = {
      registerAudioTrack: vi.fn().mockRejectedValue(new Error("not audio")),
    };

    await expect(
      addTrackToLibrary(api as never, "workspace-1", file("song.mp3")),
    ).rejects.toThrow("not audio");
    expect(fetchApi).toHaveBeenCalledWith("/v1/assets/asset-1", {
      method: "DELETE",
    });
  });
});

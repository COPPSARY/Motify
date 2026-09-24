import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CloudApiError,
  ProjectsApi,
  type ProjectSourceFiles,
} from "./projects-api";

const files: ProjectSourceFiles = {
  "composition.html": "<template></template>",
  "styles.css": "",
  "timeline.js": "export function buildTimeline() {}",
  "index.ts": "export const composition = {};",
};

function response(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectsApi", () => {
  it("keeps the session CSRF token and sends it on project mutations", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, {
          data: { user: { id: "user" }, csrfToken: "csrf-token" },
        }),
      )
      .mockResolvedValueOnce(
        response(200, { data: { id: "project", revision: 2 } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await api.getSession();
    await expect(
      api.saveSource("project", { revision: 1, files }),
    ).resolves.toEqual({
      project: { id: "project", revision: 2 },
      unchanged: false,
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL("http://localhost:4000/v1/projects/project"),
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-token" }),
      }),
    );
    const body = JSON.parse(
      String(fetchMock.mock.lastCall?.[1]?.body),
    ) as Record<string, unknown>;
    expect(body).toEqual({
      revision: 1,
      compositionHtml: expect.stringContaining("<template>"),
      timelineJs: files["timeline.js"],
    });
  });

  it("loads a CSRF token before saving source", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, {
          data: { user: { id: "user" }, csrfToken: "csrf-token" },
        }),
      )
      .mockResolvedValueOnce(
        response(200, { data: { id: "project", revision: 2 } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await new ProjectsApi("http://localhost:4000").saveSource("project", {
      revision: 1,
      files,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL("http://localhost:4000/v1/projects/project"),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-token" }),
      }),
    );
  });

  it("loads a CSRF token before creating a project", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, {
          data: { user: { id: "user-1" }, csrfToken: "csrf-token" },
        }),
      )
      .mockResolvedValueOnce(
        response(200, {
          data: {
            id: "project-1",
            workspaceId: "workspace-1",
            name: "Untitled Motionly Project",
            slug: "untitled-motionly-project",
            width: 1920,
            height: 1080,
            fps: 30,
            duration: 10,
            sourceHash: "source-hash",
            revision: 1,
            createdBy: "user-1",
            createdAt: "2026-09-17T00:00:00.000Z",
            updatedAt: "2026-09-17T00:00:00.000Z",
            savedAt: "2026-09-17T00:00:00.000Z",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await api.createProject("workspace-1", {
      name: "Untitled Motionly Project",
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 10,
      files,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      new URL("http://localhost:4000/v1/auth/me"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL("http://localhost:4000/v1/workspaces/workspace-1/projects"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-token" }),
      }),
    );
  });

  it("exposes revision conflict details to the editor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        response(409, {
          error: {
            code: "REVISION_CONFLICT",
            message: "The project changed since it was loaded.",
            details: { currentRevision: 7 },
          },
        }),
      ),
    );
    const api = new ProjectsApi("http://localhost:4000");

    await expect(api.getProject("project")).rejects.toMatchObject({
      status: 409,
      code: "REVISION_CONFLICT",
      details: { currentRevision: 7 },
    } satisfies Partial<CloudApiError>);
  });

  it("handles empty success responses for archived projects", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, {
          data: { user: { id: "user" }, csrfToken: "csrf-token" },
        }),
      )
      .mockResolvedValueOnce(response(204));
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await api.getSession();
    await expect(api.removeProject("project", 3)).resolves.toBeUndefined();
  });

  it("sends a generation message and reads generated source from the backend", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, {
          data: { user: { id: "user" }, csrfToken: "csrf-token" },
        }),
      )
      .mockResolvedValueOnce(
        response(200, {
          data: {
            type: "generation",
            response: "Your film is ready.",
            projectId: "project",
            revision: 4,
          },
        }),
      )
      .mockResolvedValueOnce(
        response(200, {
          data: {
            "composition.html": "<template><main /></template>",
            "timeline.js": "export function buildTimeline(context) {}",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await api.getSession();
    await expect(
      api.sendMotionMessage("project", { message: "Make a launch film" }),
    ).resolves.toMatchObject({ type: "generation", revision: 4 });
    await expect(api.getSource("project")).resolves.toEqual({
      "composition.html": "<template><main /></template>",
      "timeline.js": "export function buildTimeline(context) {}",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL("http://localhost:4000/v1/projects/project/messages"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-token" }),
        body: JSON.stringify({ message: "Make a launch film" }),
      }),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL("http://localhost:4000/v1/projects/project/source"),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });
});

describe("ProjectsApi music library", () => {
  const track = {
    id: "track-1",
    scope: "workspace",
    title: "Bright Future",
    token: "motify-audio://track-1",
  };

  function session() {
    return response(200, {
      data: { user: { id: "user" }, csrfToken: "csrf-token" },
    });
  }

  it("lists tracks with the filter and the total the server reports", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      response(200, {
        data: [track],
        pagination: { page: 1, pageSize: 100, totalItems: 140, totalPages: 2 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await expect(
      api.listAudioTracks("workspace", { scope: "system", query: " upbeat " }),
    ).resolves.toEqual({ tracks: [track], totalItems: 140 });

    const url = fetchMock.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe("/v1/workspaces/workspace/audio");
    expect(url.searchParams.get("scope")).toBe("system");
    expect(url.searchParams.get("q")).toBe("upbeat");
    expect(url.searchParams.get("pageSize")).toBe("100");
  });

  it("registers, edits, and deletes tracks with the session CSRF token", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(response(201, { data: track }))
      .mockResolvedValueOnce(response(200, { data: { ...track, bpm: 128 } }))
      .mockResolvedValueOnce(response(204));
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await api.registerAudioTrack("workspace", { assetId: "asset-1" });
    await expect(
      api.updateAudioTrack("track-1", { bpm: 128, artist: null }),
    ).resolves.toMatchObject({ bpm: 128 });
    await expect(api.removeAudioTrack("track-1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL("http://localhost:4000/v1/workspaces/workspace/audio"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-token" }),
        body: JSON.stringify({ assetId: "asset-1" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      new URL("http://localhost:4000/v1/audio/track-1"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ bpm: 128, artist: null }),
      }),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL("http://localhost:4000/v1/audio/track-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("reads and detaches a project's tracks", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { data: [track] }))
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(response(204));
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await expect(api.listProjectAudio("project")).resolves.toEqual([track]);
    await api.detachProjectAudio("project", "track-1");

    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL("http://localhost:4000/v1/projects/project/audio/track-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("sends chosen songs with a generation message", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(
        response(200, { data: { type: "generation", response: "Done" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await api.sendMotionMessage("project", {
      message: "Score it to this song.",
      audio: [{ trackId: "track-1" }],
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL("http://localhost:4000/v1/projects/project/messages"),
      expect.objectContaining({
        body: JSON.stringify({
          message: "Score it to this song.",
          audio: [{ trackId: "track-1" }],
        }),
      }),
    );
  });

  it("surfaces the server's reason when a track is still in use", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(
        response(409, {
          error: {
            code: "AUDIO_TRACK_IN_USE",
            message: "Remove this track from every project before deleting it.",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await expect(api.removeAudioTrack("track-1")).rejects.toMatchObject({
      status: 409,
      code: "AUDIO_TRACK_IN_USE",
    });
  });
});

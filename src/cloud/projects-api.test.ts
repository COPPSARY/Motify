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
        response(200, {
          data: { project: { id: "project" }, unchanged: false },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await api.getSession();
    await api.saveSource("project", { revision: 1, files });

    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL("http://localhost:4000/v1/projects/project/source"),
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
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

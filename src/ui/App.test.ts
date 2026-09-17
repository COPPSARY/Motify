import { mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App.svelte";

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("App project actions", () => {
  it("restores the project identified by a /p/:id URL on page load", async () => {
    const project = {
      id: "project-1",
      workspaceId: "workspace-1",
      name: "Cloud Film",
      slug: "cloud-film",
      width: 1920,
      height: 1080,
      fps: 60,
      duration: 8,
      scenes: [],
      sourceHash: "source-hash",
      revision: 1,
      createdBy: "user-1",
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
      savedAt: "2026-09-15T00:00:00.000Z",
    };
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = input instanceof URL ? input : new URL(String(input));
        if (url.pathname === "/v1/auth/me")
          return json({
            data: {
              user: {
                id: "user-1",
                email: "designer@example.com",
                emailVerified: true,
                displayName: "Designer",
                avatarUrl: null,
              },
              csrfToken: "csrf-token",
            },
          });
        if (url.pathname === "/v1/workspaces")
          return json({
            data: [
              {
                id: "workspace-1",
                name: "Design Studio",
                slug: "design-studio",
                kind: "team",
                role: "owner",
              },
            ],
          });
        if (url.pathname === "/v1/workspaces/workspace-1/projects")
          return json({ data: [project] });
        if (url.pathname === "/v1/projects/project-1")
          return json({ data: project });
        if (url.pathname === "/v1/projects/project-1/source")
          return json({
            data: {
              "composition.html":
                '<template><main data-edit="stage">Opened from URL</main></template>',
              "timeline.js": "export function buildTimeline() {}",
            },
          });
        throw new Error(`Unexpected request: ${url.pathname}`);
      }),
    );
    window.history.replaceState({}, "", "/p/project-1");
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(App, { target });

    try {
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain("Opened from URL");
      });
      expect(window.location.pathname).toBe("/p/project-1");
    } finally {
      await unmount(component);
    }
  });

  it("opens the saved-project gallery from the top bar", async () => {
    const project = {
      id: "project-1",
      workspaceId: "workspace-1",
      name: "Cloud Film",
      slug: "cloud-film",
      width: 1920,
      height: 1080,
      fps: 60,
      duration: 8,
      scenes: [],
      sourceHash: "source-hash",
      revision: 1,
      createdBy: "user-1",
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
      savedAt: "2026-09-15T00:00:00.000Z",
    };
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = input instanceof URL ? input : new URL(String(input));
        if (url.pathname === "/v1/auth/me") {
          return json({
            data: {
              user: {
                id: "user-1",
                email: "designer@example.com",
                emailVerified: true,
                displayName: "Designer",
                avatarUrl: null,
              },
              csrfToken: "csrf-token",
            },
          });
        }
        if (url.pathname === "/v1/workspaces") {
          return json({
            data: [
              {
                id: "workspace-1",
                name: "Design Studio",
                slug: "design-studio",
                kind: "team",
                role: "owner",
              },
            ],
          });
        }
        if (url.pathname === "/v1/workspaces/workspace-1/projects") {
          return json({ data: [project] });
        }
        if (url.pathname === "/v1/projects/project-1") {
          return json({ data: project });
        }
        if (url.pathname === "/v1/projects/project-1/source") {
          return json({
            data: {
              "composition.html":
                '<template><main data-edit="stage">Opened cloud project</main></template>',
              "timeline.js": "export function buildTimeline() {}",
            },
          });
        }
        throw new Error(`Unexpected request: ${url.pathname}`);
      }),
    );

    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(App, { target });

    try {
      await tick();
      const openButton = Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Open",
      );

      expect(openButton).toBeDefined();
      openButton?.click();

      await vi.waitFor(() => {
        expect(document.querySelector(".cloud-projects-dialog")).not.toBeNull();
      });

      const projectButton = document.querySelector<HTMLButtonElement>(
        '[aria-label="Open Cloud Film"]',
      );
      expect(projectButton).not.toBeNull();
      projectButton?.click();

      await vi.waitFor(() => {
        expect(document.querySelector(".cloud-projects-dialog")).toBeNull();
        expect(document.body.textContent).toContain("Opened cloud project");
      });
    } finally {
      await unmount(component);
    }
  });
});

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
  it("shows the shared editor without cloud assistant UI in local mode", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(App, { target, props: { mode: "local" } });

    try {
      await tick();
      expect(document.querySelector(".me-preview-container")).not.toBeNull();
      expect(document.querySelector(".me-scene-bar")).not.toBeNull();
      expect(document.querySelector(".me-properties-panel")).not.toBeNull();
      expect(document.querySelector(".me-left-panel")).toBeNull();
      expect(document.querySelector(".ai-chat-panel")).toBeNull();
      expect(document.querySelector(".cloud-projects-dialog")).toBeNull();
      expect(
        document.querySelector('[aria-label="Assistant prompt"]'),
      ).toBeNull();
      expect(document.body.textContent).not.toContain("Tiffy");
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/me"),
        expect.anything(),
      );

      const presets = Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Presets",
      );
      presets?.click();
      await tick();
      expect(document.querySelector(".me-left-panel")).not.toBeNull();
      expect(document.querySelector(".ai-chat-panel")).toBeNull();
      const assets = Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Assets",
      );
      assets?.click();
      await tick();
      expect(document.body.textContent).toContain("Project assets");
    } finally {
      await unmount(component);
    }
  });

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
        if (url.pathname === "/v1/projects/project-1/assets")
          return json({ data: [] });
        throw new Error(`Unexpected request: ${url.pathname}`);
      }),
    );
    window.history.replaceState({}, "", "/p/project-1");
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(App, { target });

    try {
      expect(document.querySelector(".ai-chat-panel")).not.toBeNull();
      const prompt = document.querySelector<HTMLTextAreaElement>(
        '[aria-label="Assistant prompt"]',
      );
      expect(prompt).not.toBeNull();
      if (prompt) {
        prompt.value = "Make it move";
        prompt.dispatchEvent(new Event("input", { bubbles: true }));
        await tick();
        expect(
          document.querySelector<HTMLButtonElement>(
            '[aria-label="Send message to Tiffy"]',
          )?.disabled,
        ).toBe(false);
      }
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
        if (url.pathname === "/v1/projects/project-1/assets") {
          return json({ data: [] });
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

  it("holds a guest's prompt behind the account dialog instead of generating", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = input instanceof URL ? input : new URL(String(input));
      if (url.pathname === "/v1/auth/me")
        return new Response(null, { status: 401 });
      if (url.pathname === "/v1/workspaces")
        return new Response(null, { status: 401 });
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(App, { target });

    try {
      await vi.waitFor(() => {
        expect(
          Array.from(document.querySelectorAll("button")).some(
            (button) => button.textContent?.trim() === "Sign in",
          ),
        ).toBe(true);
      });

      const prompt = document.querySelector<HTMLTextAreaElement>(
        '[aria-label="Assistant prompt"]',
      );
      expect(prompt).not.toBeNull();
      prompt!.value = "Make a launch film";
      prompt!.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
      document
        .querySelector<HTMLButtonElement>(
          '[aria-label="Send message to Tiffy"]',
        )
        ?.click();

      await vi.waitFor(() => {
        expect(document.querySelector(".auth-dialog")).not.toBeNull();
      });
      expect(document.body.textContent).toContain("Create account");
      // The prompt is held, not spent: nothing was sent to generation.
      expect(
        fetchMock.mock.calls.some(([request]) =>
          String(request).includes("/api/ai/generate"),
        ),
      ).toBe(false);
    } finally {
      await unmount(component);
    }
  });
});

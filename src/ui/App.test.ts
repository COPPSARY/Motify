import { mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App.svelte";
import { saveProjectDraft } from "../stores/project-drafts";

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
  it("does not restore assets from a previous draft on the cloud landing page", async () => {
    localStorage.setItem(
      "motionly-project-draft-v1:active",
      JSON.stringify({
        version: 1,
        updatedAt: 1,
        files: {
          "composition.html":
            '<template><main data-edit="stage">Previous draft</main></template>',
          "styles.css": "",
          "timeline.js": "export function buildTimeline() {}",
          "index.ts": "",
        },
        messages: [],
        assets: [
          {
            id: "old-logo",
            name: "previous-project-logo.png",
            mimeType: "image/png",
            token: "motionly-local:old-logo",
            intent: "asset",
          },
        ],
        editorState: { overrides: {} },
        metadata: { title: "Previous draft", duration: 5, scenes: [] },
      }),
    );
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
          return new Response(null, { status: 401 });
        if (url.pathname === "/v1/workspaces")
          return new Response(null, { status: 401 });
        throw new Error(`Unexpected request: ${url.pathname}`);
      }),
    );
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
      expect(document.body.textContent).not.toContain(
        "previous-project-logo.png",
      );
      expect(document.body.textContent).not.toContain("Previous draft");
      // With no video open: the create prompt, navigation, and no inspector.
      expect(document.body.textContent).toContain("What are we making today?");
      expect(document.querySelector(".me-properties-panel")).toBeNull();
      expect(document.querySelector(".ai-chat-header")).toBeNull();
      expect(document.body.textContent).not.toContain("Chat with Tiffy");
      expect(document.body.textContent).not.toContain("New video");
      expect(
        document.querySelector<HTMLAnchorElement>(
          '.me-sidebar-home a[href="/brand"]',
        ),
      ).not.toBeNull();
      expect(
        document.querySelector(".me-sidebar-upgrade")?.getAttribute("href"),
      ).toBe("https://motify.video/pricing");

      const nav = (label: string) =>
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(".me-sidebar-link"),
        ).find((button) => button.textContent?.trim() === label);
      nav("Templates")?.click();
      await tick();
      expect(document.querySelector(".me-template-grid")).not.toBeNull();
      expect(window.location.pathname).toBe("/templates");
      document
        .querySelector<HTMLButtonElement>(
          '[aria-label="Open the Relay template"]',
        )
        ?.click();

      // A video is open: Tiffy's chat replaces the navigation, and the
      // inspector has only its design controls.
      await vi.waitFor(() => {
        expect(document.querySelector(".ai-chat-header")).not.toBeNull();
      });
      expect(document.querySelector(".me-sidebar-home")).toBeNull();
      expect(document.querySelector(".me-template-grid")).toBeNull();
      expect(document.querySelector(".me-properties-panel")).not.toBeNull();
      expect(
        document.querySelector(".me-properties-panel")?.textContent,
      ).not.toContain("Animate");
      expect(document.body.textContent).not.toContain("PNG");
      expect(
        document.querySelector<HTMLInputElement>(
          'input[aria-label="Remove watermark"]',
        )?.disabled,
      ).toBe(true);
      expect(document.querySelector("[data-motify-watermark]")).not.toBeNull();

      const previewRoot = document.querySelector<HTMLElement>(
        ".composition-canvas",
      );
      const editableText = Array.from(
        document.querySelectorAll<HTMLElement>("[data-motionly-id]"),
      ).find(
        (element) =>
          /^(H[1-6]|P|SPAN|STRONG|EM|SMALL|BUTTON)$/.test(element.tagName) &&
          element.children.length === 0 &&
          Boolean(element.textContent?.trim()) &&
          !element.matches("[data-field]") &&
          !element.querySelector("[data-field]"),
      );
      expect(editableText).toBeDefined();
      // The template opens at its authored zero state, where its first text
      // entrance has not run in jsdom. Make that registered layer visible so
      // this test can exercise the canvas hit-test and contextual inspector.
      for (
        let node: HTMLElement | null = editableText ?? null;
        node && previewRoot?.contains(node);
        node = node.parentElement
      ) {
        node.style.opacity = "1";
        node.style.visibility = "visible";
        if (getComputedStyle(node).display === "none")
          node.style.display = "block";
        if (node === previewRoot) break;
      }
      Object.defineProperty(document, "elementsFromPoint", {
        configurable: true,
        value: vi.fn(() => (editableText ? [editableText] : [])),
      });
      document
        .querySelector<HTMLElement>(".me-stage")
        ?.dispatchEvent(
          new MouseEvent("click", { bubbles: true, clientX: 20, clientY: 20 }),
        );
      await tick();
      expect(
        document.querySelector(
          '.me-properties-panel [aria-label="Font family"]',
        ),
      ).not.toBeNull();
      expect(
        document.querySelector(
          '.me-properties-panel [aria-label="Font style"]',
        ),
      ).not.toBeNull();
      expect(
        document.querySelector(
          '.me-properties-panel [aria-label="Text fill color"]',
        ),
      ).not.toBeNull();
      expect(
        document.querySelector(
          '.me-properties-panel [aria-label="Background color"]',
        ),
      ).toBeNull();
      const addBgBtn = document.querySelector<HTMLButtonElement>(
        '.me-properties-panel [aria-label="Add background"]',
      );
      expect(addBgBtn).not.toBeNull();
      addBgBtn?.click();
      await tick();
      expect(
        document.querySelector(
          '.me-properties-panel [aria-label="Background color"]',
        ),
      ).not.toBeNull();
      expect(
        document.querySelector(
          '.me-properties-panel [aria-label="Corner radius"]',
        ),
      ).not.toBeNull();

      const removeBgBtn = document.querySelector<HTMLButtonElement>(
        '.me-properties-panel [aria-label="Remove background"]',
      );
      expect(removeBgBtn).not.toBeNull();
      removeBgBtn?.click();
      await tick();
      expect(
        document.querySelector(
          '.me-properties-panel [aria-label="Background color"]',
        ),
      ).toBeNull();
      expect(
        document.querySelector(
          '.me-properties-panel [aria-label="Add background"]',
        ),
      ).not.toBeNull();
      expect(document.querySelector(".me-selection-badge")).toBeNull();

      document
        .querySelector<HTMLButtonElement>('[aria-label="Back to home"]')
        ?.click();
      await vi.waitFor(() => {
        expect(document.querySelector(".me-sidebar-home")).not.toBeNull();
      });
      expect(document.body.textContent).toContain("What are we making today?");
    } finally {
      await unmount(component);
    }
  });
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
    saveProjectDraft("project-1", {
      version: 1,
      updatedAt: Date.now(),
      files: {
        "composition.html":
          '<template><main data-edit="stage">Opened from URL</main></template>',
        "styles.css": "",
        "timeline.js": "export function buildTimeline() {}",
        "index.ts": "",
      },
      messages: [
        { role: "user", text: "Keep this older prompt with the project" },
        { role: "assistant", text: "I kept the conversation." },
      ],
      assets: [],
      editorState: { elements: {}, animations: {}, tweens: {} },
      metadata: { title: "Cloud Film", duration: 8, scenes: [] },
      baseRevision: 1,
    });
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
      expect(document.body.textContent).toContain(
        "Keep this older prompt with the project",
      );
      expect(document.body.textContent).toContain("I kept the conversation.");
      expect(window.location.pathname).toBe("/p/project-1");
    } finally {
      await unmount(component);
    }
  });

  it("opens the saved-project gallery from My Videos", async () => {
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
        if (
          url.pathname === "/v1/workspaces/workspace-1/billing/subscription"
        ) {
          return json({
            data: {
              status: "active",
              plan: "pro",
              currentPeriodStart: "2026-09-01T00:00:00.000Z",
              currentPeriodEnd: "2026-10-01T00:00:00.000Z",
            },
          });
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
      await vi.waitFor(() => {
        expect(
          document.querySelector(".me-sidebar-plan")?.textContent?.trim(),
        ).toBe("pro");
      });
      document.querySelector<HTMLButtonElement>(".me-sidebar-profile")?.click();
      await tick();
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(".me-profile-menu button"),
      )
        .find((button) => button.textContent?.trim() === "Support")
        ?.click();
      await tick();
      expect(
        document
          .querySelector(
            '.me-support-copy a[href="mailto:support@motify.video"]',
          )
          ?.textContent?.trim(),
      ).toBe("support@motify.video");

      const openButton = Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "My Videos",
      );

      expect(openButton).toBeDefined();
      openButton?.click();

      await vi.waitFor(() => {
        expect(document.querySelector(".cloud-projects-dialog")).not.toBeNull();
      });
      // My Videos is a page with its own URL, not a dialog over the app.
      expect(window.location.pathname).toBe("/videos");
      expect(
        document.querySelector(".me-videos-host .cloud-projects-dialog"),
      ).not.toBeNull();

      const projectButton = document.querySelector<HTMLButtonElement>(
        '[aria-label="Open Cloud Film"]',
      );
      expect(projectButton).not.toBeNull();
      projectButton?.click();

      await vi.waitFor(() => {
        expect(document.querySelector(".cloud-projects-dialog")).toBeNull();
        expect(document.body.textContent).toContain("Opened cloud project");
      });
      expect(window.location.pathname).toBe("/p/project-1");
      expect(
        document.querySelector<HTMLInputElement>(
          'input[aria-label="Remove watermark"]',
        )?.disabled,
      ).toBe(false);
      const removeWatermark = document.querySelector<HTMLInputElement>(
        'input[aria-label="Remove watermark"]',
      );
      removeWatermark?.click();
      await tick();
      expect(document.querySelector("[data-motify-watermark]")).toBeNull();
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

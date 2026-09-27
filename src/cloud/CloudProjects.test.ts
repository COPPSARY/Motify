import { mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import CloudProjectGallery from "./CloudProjectGallery.svelte";
import type { ProjectSourceFiles } from "./projects-api";

const files: ProjectSourceFiles = {
  "composition.html": '<template id="test"><main>Cloud test</main></template>',
  "styles.css": "main { color: white; }",
  "timeline.js": "export function buildTimeline() {}",
  "index.ts": "export const composition = {};",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("CloudProjectGallery", () => {
  it("bootstraps a session, creates a project, and replaces its rolling snapshot", async () => {
    let projectExists = false;
    let revision = 1;
    const project = () => ({
      id: "00000000-0000-4000-8000-000000000003",
      workspaceId: "00000000-0000-4000-8000-000000000002",
      name: "Cloud Film",
      slug: "cloud-film-abcd1234",
      width: 1920,
      height: 1080,
      fps: 60,
      duration: 12,
      currentVersionId: `00000000-0000-4000-8000-00000000000${revision + 3}`,
      revision,
      createdBy: "00000000-0000-4000-8000-000000000001",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    const version = () => ({
      id: `00000000-0000-4000-8000-00000000000${revision + 3}`,
      projectId: project().id,
      versionNumber: revision,
      sourceHash: revision === 1 ? "hash-one" : "hash-two",
      message: null,
      createdBy: "00000000-0000-4000-8000-000000000001",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = input instanceof URL ? input : new URL(String(input));
      const method = init?.method ?? "GET";
      if (url.pathname === "/v1/auth/me") {
        return json({
          data: {
            user: {
              id: "00000000-0000-4000-8000-000000000001",
              email: "designer@example.com",
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
              id: "00000000-0000-4000-8000-000000000002",
              name: "Design Studio",
              slug: "design-studio",
              kind: "team",
              role: "owner",
            },
          ],
        });
      }
      if (url.pathname.endsWith("/projects") && method === "GET") {
        return json({ data: projectExists ? [project()] : [] });
      }
      if (url.pathname.endsWith("/projects") && method === "POST") {
        const payload = JSON.parse(String(init?.body)) as {
          name: string;
          compositionHtml: string;
          timelineJs: string;
        };
        expect(payload).toEqual({
          name: "Cloud Film",
          width: 1920,
          height: 1080,
          fps: 60,
          duration: 12,
          compositionHtml:
            '<template id="test">\n<style>\nmain { color: white; }\n</style><main>Cloud test</main></template>',
          timelineJs: "export function buildTimeline() {}",
        });
        projectExists = true;
        return json(
          {
            data: { project: project(), version: version() },
          },
          201,
        );
      }
      if (/^\/v1\/projects\/[^/]+$/.test(url.pathname) && method === "PATCH") {
        revision = 2;
        return json({ data: project() });
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(CloudProjectGallery, {
      target,
      props: {
        initialFiles: files,
        width: 1920,
        height: 1080,
        fps: 60,
        duration: 12,
      },
    }) as unknown as {
      openManager(): Promise<void>;
      saveActive(): Promise<void>;
    };

    try {
      await component.openManager();
      await vi.waitFor(() => {
        expect(document.querySelector(".cloud-project-gallery")).not.toBeNull();
      });
      expect(document.querySelector(".cloud-source-editor")).toBeNull();
      expect(document.body.textContent).not.toContain("composition.html");

      const newProjectButton = Array.from(
        document.querySelectorAll("button"),
      ).find((button) => button.textContent?.includes("Create new project"));
      expect(newProjectButton).toBeDefined();
      newProjectButton?.click();
      await tick();

      const nameInput = document.querySelector<HTMLInputElement>(
        "#cloud-new-project-name",
      );
      expect(nameInput).not.toBeNull();
      if (!nameInput) return;
      nameInput.value = "Cloud Film";
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();

      const createButton = Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("Create project"),
      );
      expect(createButton).toBeDefined();
      createButton?.click();
      await vi.waitFor(() => {
        expect(document.querySelector(".cloud-projects-dialog")).toBeNull();
      });
      expect(projectExists).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "X-CSRF-Token": "csrf-token" }),
        }),
      );

      await component.openManager();
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain("Cloud Film");
      });
      await component.saveActive();
      await vi.waitFor(() => {
        expect(revision).toBe(2);
      });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: expect.stringMatching(/^\/v1\/projects\/[^/]+$/),
        }),
        expect.objectContaining({ method: "PATCH" }),
      );
    } finally {
      await unmount(component);
    }
  });
});

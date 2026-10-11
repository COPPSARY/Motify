import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectVersion } from "../../cloud/projects-api";
import VersionsPanel from "./VersionsPanel.svelte";

const now = Date.parse("2026-10-06T12:00:00.000Z");

function version(overrides: Partial<ProjectVersion>): ProjectVersion {
  return {
    revision: 1,
    source: "generation",
    restoredFromRevision: null,
    label: null,
    pinned: false,
    createdBy: "user",
    createdAt: "2026-10-06T11:58:00.000Z",
    prompt: null,
    current: false,
    ...overrides,
  };
}

async function settle() {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
    await tick();
  }
}

function setup(versions: ProjectVersion[], options: { busy?: boolean } = {}) {
  const api = {
    listVersions: vi.fn().mockResolvedValue(versions),
    updateVersion: vi.fn().mockResolvedValue(undefined),
  };
  const onRestore = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const target = document.createElement("div");
  target.className = "code-editor-scope";
  document.body.append(target);
  const component = mount(VersionsPanel, {
    target,
    props: {
      api,
      projectId: "project",
      revision: 7,
      busy: options.busy ?? false,
      onRestore,
      onClose,
      now: () => now,
    },
  });
  return { api, onRestore, onClose, target, component };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("VersionsPanel", () => {
  it("identifies each version by number, origin, prompt and age, newest first", async () => {
    const { target, api, component } = setup([
      version({
        revision: 7,
        source: "restore",
        restoredFromRevision: 2,
        current: true,
        createdAt: "2026-10-06T11:59:50.000Z",
      }),
      version({
        revision: 4,
        source: "manual_edit",
        createdAt: "2026-10-06T09:00:00.000Z",
      }),
      version({
        revision: 2,
        prompt: "Make it vertical",
        label: "Vertical cut",
        pinned: true,
        createdAt: "2026-09-01T12:00:00.000Z",
      }),
    ]);
    await settle();

    expect(api.listVersions).toHaveBeenCalledWith("project");
    const items = [...target.querySelectorAll(".versions-item")];
    expect(items).toHaveLength(3);
    expect(items[0]!.textContent).toContain("Version 7");
    expect(items[0]!.textContent).toContain("Current");
    expect(items[0]!.textContent).toContain("Restored from version 2");
    expect(items[0]!.textContent).toContain("just now");
    expect(items[0]!.querySelector(".versions-restore")).toBeNull();
    expect(items[1]!.textContent).toContain("Edited by hand");
    expect(items[1]!.textContent).toContain("3 hours ago");
    expect(items[2]!.textContent).toContain("Vertical cut");
    expect(items[2]!.textContent).toContain("v2");
    expect(items[2]!.textContent).toContain("“Make it vertical”");
    expect(items[2]!.textContent).toContain("1 month ago");
    unmount(component);
  });

  it("restores an older version and pins without reloading", async () => {
    const { target, onRestore, api, component } = setup([
      version({ revision: 7, current: true }),
      version({ revision: 3 }),
    ]);
    await settle();

    const older = target.querySelectorAll(".versions-item")[1]!;
    (older.querySelector(".versions-restore") as HTMLButtonElement).click();
    await settle();
    expect(onRestore).toHaveBeenCalledWith(3);

    (
      older.querySelector('[aria-label="Pin version 3"]') as HTMLButtonElement
    ).click();
    flushSync();
    await settle();
    expect(api.updateVersion).toHaveBeenCalledWith("project", 3, {
      pinned: true,
    });
    expect(
      target.querySelector('[aria-label="Unpin version 3"]'),
    ).not.toBeNull();
    unmount(component);
  });

  it("holds restores while Tiffy is working", async () => {
    const { target, component } = setup(
      [version({ revision: 7, current: true }), version({ revision: 3 })],
      { busy: true },
    );
    await settle();
    expect(
      (target.querySelector(".versions-restore") as HTMLButtonElement).disabled,
    ).toBe(true);
    unmount(component);
  });

  it("says so when a restore fails", async () => {
    const { target, onRestore, component } = setup([
      version({ revision: 7, current: true }),
      version({ revision: 3 }),
    ]);
    onRestore.mockRejectedValue(new Error("conflict"));
    await settle();
    (target.querySelector(".versions-restore") as HTMLButtonElement).click();
    await settle();
    expect(target.querySelector(".versions-error")?.textContent).toContain(
      "Version 3 could not be restored.",
    );
    unmount(component);
  });
});

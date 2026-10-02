import { mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadAssetObjectUrl = vi.hoisted(() => vi.fn());
vi.mock("../../api/assets", () => ({
  loadAssetObjectUrl,
  uploadAsset: vi.fn(),
}));

import type { WorkspaceAsset } from "../../cloud/projects-api";
import AssetsPanel from "./AssetsPanel.svelte";

function asset(id: string, fileName: string): WorkspaceAsset {
  return {
    id,
    workspaceId: "workspace",
    state: "READY",
    fileName,
    contentType: "image/png",
    byteSize: 100,
    checksum: "a".repeat(64),
    label: null,
    tags: [],
    width: 100,
    height: 100,
    durationMs: null,
    createdAt: "2026-10-02T00:00:00.000Z",
    downloadUrl: `/v1/assets/${id}/download`,
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});

beforeEach(() => {
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("AssetsPanel", () => {
  it("groups each reusable asset once and adds library media to the prompt", async () => {
    loadAssetObjectUrl.mockImplementation(async (id: string) => `blob:${id}`);
    const assets = [
      asset("brand-logo", "logo.png"),
      asset("video-shot", "hero.png"),
      asset("library-shot", "dashboard.png"),
    ];
    const api = {
      listWorkspaceAssets: vi.fn().mockResolvedValue(assets),
      getBrand: vi.fn().mockResolvedValue({
        assets: [{ assetId: "brand-logo" }],
      }),
      listProjectAssets: vi.fn().mockResolvedValue([
        {
          id: "video-shot",
          fileName: "hero.png",
          contentType: "image/png",
          role: "asset",
          token: "motify-asset://video-shot",
        },
      ]),
    };
    const onUse = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(AssetsPanel, {
      target,
      props: {
        api,
        workspaceId: "workspace",
        projectId: "project",
        onUse,
      } as never,
    });

    try {
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain("dashboard.png");
      });
      expect(document.body.textContent?.match(/logo\.png/g)).toHaveLength(1);
      expect(document.body.textContent?.match(/hero\.png/g)).toHaveLength(1);
      expect(document.body.textContent?.match(/dashboard\.png/g)).toHaveLength(
        1,
      );
      expect(document.body.textContent).toContain("Brand assets");
      expect(document.body.textContent).toContain("Current video");
      expect(document.body.textContent).toContain("Workspace assets");

      document
        .querySelector<HTMLButtonElement>(
          '[aria-label="Add dashboard.png to the next prompt"]',
        )
        ?.click();
      expect(onUse).toHaveBeenCalledWith(assets[2]);
    } finally {
      await unmount(component);
    }
  });
});

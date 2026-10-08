import { mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadAssetObjectUrl = vi.hoisted(() => vi.fn());
const fetchCreditSnapshot = vi.hoisted(() => vi.fn());

vi.mock("../../api/assets", () => ({ loadAssetObjectUrl }));
vi.mock("../../api/credits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/credits")>()),
  fetchCreditSnapshot,
}));

import { refreshCredits, resetCredits } from "../../stores/credits";
import { RESOLUTION_CREDIT_COSTS } from "../../cloud/projects-api";
import AssetGeneratorPanel from "./AssetGeneratorPanel.svelte";

function selectOption(select: HTMLSelectElement, value: string): void {
  select.value = value;
  for (const option of select.options) {
    option.selected = option.value === value;
  }
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  resetCredits();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

beforeEach(() => {
  resetCredits();
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("AssetGeneratorPanel", () => {
  it("generates a nine-scene storyboard with 2K resolution (10 credits default), previews it, applies credits and adds it as a reference", async () => {
    loadAssetObjectUrl.mockResolvedValue("blob:generated-image");
    const generated = {
      id: "asset-1",
      workspaceId: "workspace-1",
      state: "READY",
      fileName: "generated.png",
      contentType: "image/png",
      byteSize: 100,
      checksum: "a".repeat(64),
      label: "Cobalt clouds",
      tags: ["storyboard", "generated", "nano-banana"],
      width: 2752,
      height: 1536,
      durationMs: null,
      createdAt: "2026-10-08T00:00:00.000Z",
      downloadUrl: "/v1/assets/asset-1/download",
      credits: { charged: 10, remaining: 40 },
    } as const;
    const api = { generateStoryboard: vi.fn().mockResolvedValue(generated) };
    const onUseReference = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(AssetGeneratorPanel, {
      target,
      props: { api, workspaceId: "workspace-1", onUseReference } as never,
    });

    try {
      const submit = document.querySelector<HTMLButtonElement>(
        ".asset-generator-submit",
      )!;
      expect(submit.textContent).toContain("10");

      const prompt = document.querySelector<HTMLTextAreaElement>(
        '[aria-label="Storyboard description"]',
      )!;
      prompt.value = "Cobalt clouds";
      prompt.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
      submit.click();

      await vi.waitFor(() =>
        expect(api.generateStoryboard).toHaveBeenCalledWith("workspace-1", {
          prompt: "Cobalt clouds",
          aspectRatio: "16:9",
          imageSize: "2K",
        }),
      );
      await vi.waitFor(() => {
        expect(
          document.querySelector<HTMLImageElement>(
            ".asset-generator-result img",
          )?.src,
        ).toBe("blob:generated-image");
      });

      expect(document.body.textContent).toContain("2K");

      const use = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((button) => button.textContent?.includes("Use as reference"));
      use?.click();
      expect(onUseReference).toHaveBeenCalledWith(generated);
    } finally {
      await unmount(component);
    }
  });

  it("changes credit cost when resolution changes between 1K (5), 2K (10) and 4K (15)", async () => {
    expect(RESOLUTION_CREDIT_COSTS).toEqual({
      "1K": 5,
      "2K": 10,
      "4K": 15,
    });

    loadAssetObjectUrl.mockResolvedValue("blob:test");
    const api = {
      generateStoryboard: vi.fn().mockResolvedValue({
        id: "asset-2",
        workspaceId: "workspace-1",
        state: "READY",
        fileName: "test.png",
        contentType: "image/png",
        byteSize: 10,
        checksum: "b".repeat(64),
        label: "test",
        tags: [],
        width: 100,
        height: 100,
        durationMs: null,
        createdAt: "2026-10-08T00:00:00.000Z",
        downloadUrl: null,
      }),
    };
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(AssetGeneratorPanel, {
      target,
      props: { api, workspaceId: "workspace-1" } as never,
    });

    try {
      const select = document.querySelector<HTMLSelectElement>(
        ".asset-generator-size select",
      )!;
      const submit = document.querySelector<HTMLButtonElement>(
        ".asset-generator-submit",
      )!;

      // Default is 2K -> 10 credits
      expect(select.value).toBe("2K");
      expect(submit.textContent).toContain("10");

      // Switch to 1K -> 5 credits
      selectOption(select, "1K");
      await tick();
      expect(submit.textContent).toContain("5");

      // Switch to 4K -> 15 credits
      selectOption(select, "4K");
      await tick();
      expect(submit.textContent).toContain("15");

      const prompt = document.querySelector<HTMLTextAreaElement>(
        '[aria-label="Storyboard description"]',
      )!;
      prompt.value = "Testing 4K cost";
      prompt.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
      submit.click();

      await vi.waitFor(() =>
        expect(api.generateStoryboard).toHaveBeenCalledWith("workspace-1", {
          prompt: "Testing 4K cost",
          aspectRatio: "16:9",
          imageSize: "4K",
        }),
      );
    } finally {
      await unmount(component);
    }
  });

  it("disables generation and shows a warning when credit balance is insufficient", async () => {
    fetchCreditSnapshot.mockResolvedValue({
      balance: 8, // less than 2K (10 credits)
      estimate: { typical: 1, min: 0.5, max: 2 },
    });
    await refreshCredits();

    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(AssetGeneratorPanel, {
      target,
      props: {
        api: { generateStoryboard: vi.fn() },
        workspaceId: "ws-1",
      } as never,
    });

    try {
      const prompt = document.querySelector<HTMLTextAreaElement>(
        '[aria-label="Storyboard description"]',
      )!;
      prompt.value = "Something";
      prompt.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();

      const submit = document.querySelector<HTMLButtonElement>(
        ".asset-generator-submit",
      )!;
      expect(submit.disabled).toBe(true);
      expect(document.body.textContent).toContain(
        "Not enough credits — you have 8 left.",
      );

      // Switch to 1K (5 credits) -> 8 credits is enough!
      const select = document.querySelector<HTMLSelectElement>(
        ".asset-generator-size select",
      )!;
      selectOption(select, "1K");
      await tick();

      expect(submit.disabled).toBe(false);
      expect(document.querySelector(".asset-generator-credit-hint")).toBeNull();
    } finally {
      await unmount(component);
    }
  });

  it("keeps generation disabled until a workspace and prompt exist", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(AssetGeneratorPanel, {
      target,
      props: { api: { generateStoryboard: vi.fn() }, workspaceId: "" } as never,
    });
    try {
      expect(
        document.querySelector<HTMLButtonElement>(".asset-generator-submit")
          ?.disabled,
      ).toBe(true);
      expect(document.body.textContent).toContain("Sign in to generate");
    } finally {
      await unmount(component);
    }
  });
});

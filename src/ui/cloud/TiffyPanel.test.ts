import { mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchCreditSnapshot = vi.hoisted(() => vi.fn());
vi.mock("../../api/credits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/credits")>()),
  fetchCreditSnapshot,
}));

import { refreshCredits, resetCredits } from "../../stores/credits";
import { generationStore } from "../../stores/generation";
import TiffyPanel from "./TiffyPanel.svelte";

afterEach(() => {
  document.body.replaceChildren();
  generationStore.set({
    isActive: false,
    status: "IDLE",
    stage: "IDLE",
    progress: 0,
    message: "",
  });
});

describe("TiffyPanel generation controls", () => {
  it("defaults effort to Medium and lets the user choose High", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps(),
    });

    try {
      const trigger = must<HTMLButtonElement>(".ai-effort-picker");
      expect(trigger.textContent).toContain("Effort: Medium");
      trigger.click();
      await tick();
      document
        .querySelectorAll<HTMLButtonElement>(".ai-effort-menu button")[1]
        ?.click();
      await tick();
      expect(trigger.textContent).toContain("Effort: High");
    } finally {
      await unmount(component);
    }
  });

  it("sends a free user to pricing from a faded, locked Pro", async () => {
    const onSelectModel = vi.fn();
    const onUpgradeModel = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({
        modelPicker: true,
        modelLocked: true,
        onSelectModel,
        onUpgradeModel,
      }),
    });

    try {
      const trigger = must<HTMLButtonElement>(".ai-model-picker");
      expect(trigger.textContent).toContain("Flash");
      trigger.click();
      await tick();
      const pro = document.querySelectorAll<HTMLButtonElement>(
        ".ai-model-menu button",
      )[1];
      expect(pro?.textContent).toContain("Pro");
      expect(pro?.classList.contains("is-locked")).toBe(true);
      expect(pro?.textContent).toContain("Upgrade to unlock");
      pro?.click();
      await tick();
      expect(onUpgradeModel).toHaveBeenCalledOnce();
      expect(onSelectModel).not.toHaveBeenCalled();
      expect(document.querySelector(".ai-model-menu")).toBeNull();
    } finally {
      await unmount(component);
    }
  });

  it("lets a paid user switch between Pro and Flash", async () => {
    const onSelectModel = vi.fn();
    const onUpgradeModel = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({
        modelPicker: true,
        modelLocked: false,
        generationModel: "pro",
        onSelectModel,
        onUpgradeModel,
      }),
    });

    try {
      const trigger = must<HTMLButtonElement>(".ai-model-picker");
      expect(trigger.textContent).toContain("Pro");
      trigger.click();
      await tick();
      const options = document.querySelectorAll<HTMLButtonElement>(
        ".ai-model-menu button",
      );
      expect(options[1]?.classList.contains("is-locked")).toBe(false);
      options[0]?.click();
      await tick();
      expect(onSelectModel).toHaveBeenCalledWith("flash");
      expect(onUpgradeModel).not.toHaveBeenCalled();
    } finally {
      await unmount(component);
    }
  });

  it("shows no model picker for a local project", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, { target, props: panelProps() });

    try {
      expect(document.querySelector(".ai-model-picker")).toBeNull();
    } finally {
      await unmount(component);
    }
  });

  it("shows progress only in the temporary run card", async () => {
    generationStore.set({
      isActive: true,
      status: "GENERATING",
      stage: "GENERATING",
      progress: 20,
      message: "Tiffy is reading your prompt...",
    });
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({
        activityVerb: "Reading your brief",
        longGeneration: true,
        assistantMessages: [{ role: "user", text: "Make a film" }],
      }),
    });

    try {
      expect(document.querySelector(".ai-chat-activity")).not.toBeNull();
      expect(document.body.textContent).toContain(
        "This may take a few minutes",
      );
      expect(document.body.textContent).not.toContain(
        "Tiffy is reading your prompt",
      );
      expect(document.querySelector(".ai-chat-state")).toBeNull();
      expect(
        document.querySelector(
          '.ai-chat-activity li[aria-current="step"] .ai-chat-step-marker',
        ),
      ).not.toBeNull();
    } finally {
      await unmount(component);
    }
  });
});

describe("TiffyPanel uploads", () => {
  it("lets the composer choose a Brand DNA or turn it off", async () => {
    const manageBrand = vi.fn();
    const selectBrand = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: {
        assistantMessages: [],
        assistantDraft: "",
        composerInput: undefined as unknown as HTMLTextAreaElement,
        activityVerb: "Working",
        pendingAssets: [],
        classifiedAssets: [],
        stagedPreviews: {},
        uploadingMedia: false,
        uploadProgress: 0,
        uploadPreview: null,
        uploadName: "",
        isErrorMessage: () => false,
        handleFixError: async () => undefined,
        classifyStagedAsset: () => undefined,
        removeStagedAsset: () => undefined,
        submitAssistant: async () => undefined,
        resizeComposer: () => undefined,
        composerKeydown: () => undefined,
        handlePaste: async () => undefined,
        onAttach: () => undefined,
        brandName: "Acme",
        brandProfiles: [
          { id: "brand-1", name: "Acme", isDefault: true, updatedAt: "" },
          { id: "brand-2", name: "Other", isDefault: false, updatedAt: "" },
        ],
        onSelectBrand: selectBrand,
        onManageBrand: manageBrand,
      } as never,
    });

    try {
      const chip = document.querySelector<HTMLButtonElement>(".ai-brand-chip");
      expect(chip?.textContent).toContain("Acme");
      chip?.click();
      await tick();
      const options = document.querySelectorAll<HTMLButtonElement>(
        ".ai-brand-menu button",
      );
      options[0]?.click();
      expect(selectBrand).toHaveBeenCalledWith(null);
      chip?.click();
      await tick();
      document
        .querySelectorAll<HTMLButtonElement>(".ai-brand-menu button")[2]
        ?.click();
      expect(selectBrand).toHaveBeenCalledWith("brand-2");
      chip?.click();
      await tick();
      document
        .querySelectorAll<HTMLButtonElement>(".ai-brand-menu button")[3]
        ?.click();
      expect(manageBrand).toHaveBeenCalledOnce();
    } finally {
      await unmount(component);
    }
  });

  it("shows the hero prompt without a message thread", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: {
        variant: "hero",
        assistantMessages: [],
        assistantDraft: "",
        composerInput: undefined as unknown as HTMLTextAreaElement,
        activityVerb: "Working",
        pendingAssets: [],
        classifiedAssets: [],
        stagedPreviews: {},
        uploadingMedia: false,
        uploadProgress: 0,
        uploadPreview: null,
        uploadName: "",
        isErrorMessage: () => false,
        handleFixError: async () => undefined,
        classifyStagedAsset: () => undefined,
        removeStagedAsset: () => undefined,
        submitAssistant: async () => undefined,
        resizeComposer: () => undefined,
        composerKeydown: () => undefined,
        handlePaste: async () => undefined,
        onAttach: () => undefined,
      } as never,
    });

    try {
      expect(document.body.textContent).toContain("What are we making today?");
      expect(document.querySelector(".ai-chat-messages")).toBeNull();
      expect(
        document.querySelector(".ai-brand-chip")?.textContent?.trim(),
      ).toBe("Set up brand");
      const aspect = document.querySelector<HTMLButtonElement>(
        '.ai-aspect-picker[aria-haspopup="listbox"]',
      );
      expect(aspect?.getAttribute("aria-label")).toContain("16:9");
      aspect?.click();
      await tick();
      const options = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
      );
      expect(options.map((option) => option.textContent?.trim())).toEqual([
        "16:9 · Landscape",
        "1:1 · Square",
        "4:5 · Portrait",
        "9:16 · Vertical",
      ]);
      expect(options.every((option) => option.querySelector("svg"))).toBe(true);
      options[3]?.click();
      await tick();
      expect(aspect?.getAttribute("aria-label")).toContain("9:16");
      expect(document.querySelector('[role="listbox"]')).toBeNull();
    } finally {
      await unmount(component);
    }
  });

  it("shows the selected file thumbnail while it is uploading", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: {
        assistantMessages: [],
        assistantDraft: "",
        composerInput: undefined as unknown as HTMLTextAreaElement,
        activityVerb: "Working",
        pendingAssets: [],
        classifiedAssets: [],
        stagedPreviews: {},
        uploadingMedia: true,
        uploadProgress: 42,
        uploadPreview: "blob:upload-preview",
        uploadName: "cover.png",
        isErrorMessage: () => false,
        handleFixError: async () => undefined,
        classifyStagedAsset: async () => undefined,
        removeStagedAsset: async () => undefined,
        submitAssistant: async () => undefined,
        resizeComposer: () => undefined,
        composerKeydown: () => undefined,
        handlePaste: async () => undefined,
        onAttach: () => undefined,
      } as never,
    });

    try {
      const thumbnail =
        document.querySelector<HTMLImageElement>(".ai-upload-thumb");
      expect(thumbnail).not.toBeNull();
      expect(thumbnail?.src).toBe("blob:upload-preview");
      expect(thumbnail?.alt).toBe("cover.png");
      expect(document.body.textContent).toContain("Uploading cover.png — 42%");
    } finally {
      await unmount(component);
    }
  });
});

describe("TiffyPanel sent attachments", () => {
  it("shows a sent image as a thumbnail without repeating its filename", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: {
        assistantMessages: [
          {
            role: "user",
            text: "Use this as a reference",
            attachments: [
              {
                id: "a1",
                name: "Pasted image",
                previewUrl: "blob:pasted-preview",
                intent: "reference",
              },
            ],
          },
        ],
        assistantDraft: "",
        composerInput: undefined as unknown as HTMLTextAreaElement,
        activityVerb: "Working",
        pendingAssets: [],
        classifiedAssets: [],
        stagedPreviews: {},
        uploadingMedia: false,
        uploadProgress: 0,
        uploadPreview: "",
        uploadName: "",
        isErrorMessage: () => false,
        handleFixError: async () => undefined,
        classifyStagedAsset: async () => undefined,
        removeStagedAsset: async () => undefined,
        submitAssistant: async () => undefined,
        resizeComposer: () => undefined,
        composerKeydown: () => undefined,
        handlePaste: async () => undefined,
        onAttach: () => undefined,
      } as never,
    });

    try {
      const image = document.querySelector<HTMLImageElement>(
        ".ai-message-attachment-image",
      );
      expect(image).not.toBeNull();
      expect(image?.src).toBe("blob:pasted-preview");
      expect(image?.alt).toBe("Pasted image");
      // The picture is the label; the name only survives as a tooltip.
      expect(document.querySelector(".ai-message-attachment-name")).toBeNull();
    } finally {
      await unmount(component);
    }
  });
});

/** Finds an element the test depends on, failing with its selector if absent. */
function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Expected ${selector} to be rendered.`);
  return element;
}

const song = {
  id: "track-1",
  scope: "workspace" as const,
  workspaceId: "workspace",
  title: "Bright Future",
  artist: null,
  genre: null,
  moodTags: [],
  bpm: 120,
  license: null,
  durationMs: 30_000,
  contentType: "audio/mpeg",
  byteSize: 1,
  token: "motify-audio://track-1",
  createdAt: "2026-09-01T00:00:00.000Z",
};

function panelProps(overrides: Record<string, unknown> = {}) {
  return {
    assistantMessages: [],
    assistantDraft: "",
    composerInput: undefined as unknown as HTMLTextAreaElement,
    activityVerb: "Working",
    pendingAssets: [],
    classifiedAssets: [],
    stagedPreviews: {},
    uploadingMedia: false,
    uploadProgress: 0,
    uploadPreview: "",
    uploadName: "",
    isErrorMessage: () => false,
    handleFixError: async () => undefined,
    classifyStagedAsset: async () => undefined,
    removeStagedAsset: async () => undefined,
    submitAssistant: async () => undefined,
    resizeComposer: () => undefined,
    composerKeydown: () => undefined,
    handlePaste: async () => undefined,
    onAttach: () => undefined,
    ...overrides,
  } as never;
}

function fileDrag(type: string, files: File[] = []) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types: ["Files"], files, dropEffect: "" },
  });
  return event;
}

describe("TiffyPanel music", () => {
  it("shows the songs chosen for the next message and lets one be removed", async () => {
    const removeSelectedAudio = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({ selectedAudio: [song], removeSelectedAudio }),
    });

    try {
      const chip = document.querySelector(".ai-attachment.is-music");
      expect(chip?.textContent).toContain("Bright Future");
      expect(chip?.textContent).toContain("music");

      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Remove Bright Future"]',
        )
        ?.click();
      expect(removeSelectedAudio).toHaveBeenCalledWith(
        expect.objectContaining({ id: "track-1" }),
      );
    } finally {
      await unmount(component);
    }
  });

  it("shows no music row when nothing is chosen", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, { target, props: panelProps() });

    try {
      expect(document.querySelector(".ai-attachment.is-music")).toBeNull();
    } finally {
      await unmount(component);
    }
  });

  it("labels a sent song with a music icon and its name", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({
        assistantMessages: [
          {
            role: "user",
            text: "Score it to this",
            attachments: [
              { id: "track-1", name: "Bright Future", kind: "audio" },
            ],
          },
        ],
      }),
    });

    try {
      const attachment = document.querySelector(".ai-message-attachment");
      expect(attachment?.textContent).toContain("Bright Future");
      expect(attachment?.querySelector("svg")).not.toBeNull();
    } finally {
      await unmount(component);
    }
  });
});

describe("TiffyPanel drop target", () => {
  it("hands dropped files to the app and cancels the browser's own handling", async () => {
    const onDropFiles = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({ onDropFiles }),
    });

    try {
      const panel = must<HTMLElement>(".ai-chat-panel");
      const file = new File(["x"], "song.mp3", { type: "audio/mpeg" });
      const drop = fileDrag("drop", [file]);
      panel.dispatchEvent(drop);

      expect(drop.defaultPrevented).toBe(true);
      expect(onDropFiles).toHaveBeenCalledWith([file]);
    } finally {
      await unmount(component);
    }
  });

  it("shows a drop hint only while a file is dragged over", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, { target, props: panelProps() });

    try {
      const panel = must<HTMLElement>(".ai-chat-panel");
      expect(panel.classList.contains("is-drag-over")).toBe(false);

      panel.dispatchEvent(fileDrag("dragenter"));
      await tick();
      expect(panel.classList.contains("is-drag-over")).toBe(true);
      expect(panel.getAttribute("data-drop-hint")).toContain("images or songs");

      panel.dispatchEvent(new Event("dragleave", { bubbles: true }));
      await tick();
      expect(panel.classList.contains("is-drag-over")).toBe(false);
    } finally {
      await unmount(component);
    }
  });

  it("ignores drags that carry no files, such as selected text", async () => {
    const onDropFiles = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({ onDropFiles }),
    });

    try {
      const panel = must<HTMLElement>(".ai-chat-panel");
      const text = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(text, "dataTransfer", {
        value: { types: ["text/plain"], files: [] },
      });
      panel.dispatchEvent(text);

      expect(text.defaultPrevented).toBe(false);
      expect(onDropFiles).not.toHaveBeenCalled();
    } finally {
      await unmount(component);
    }
  });

  it("does not take a file while a song is already uploading", async () => {
    const onDropFiles = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({ onDropFiles, uploadingMedia: true }),
    });

    try {
      const panel = must<HTMLElement>(".ai-chat-panel");
      const drop = fileDrag("drop", [new File(["x"], "song.mp3")]);
      panel.dispatchEvent(drop);

      // Still cancelled, so the browser does not navigate away to the file.
      expect(drop.defaultPrevented).toBe(true);
      expect(onDropFiles).not.toHaveBeenCalled();
    } finally {
      await unmount(component);
    }
  });
});

describe("TiffyPanel credit estimate", () => {
  beforeEach(() => {
    resetCredits();
    fetchCreditSnapshot.mockReset();
  });

  it("keeps the plain send arrow on a deployment that is not charging for requests", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({ assistantDraft: "Make the intro pop" }),
    });

    try {
      expect(document.querySelector(".ai-composer-credit-hint")).toBeNull();
      expect(document.querySelector(".ai-send-cost")).toBeNull();
      expect(
        document.querySelector<HTMLButtonElement>(".ai-composer-send"),
      ).not.toHaveProperty("disabled", true);
    } finally {
      await unmount(component);
    }
  });

  it("shows no cost until there is a message to size it from", async () => {
    fetchCreditSnapshot.mockResolvedValue({
      balance: 50,
      estimate: { typical: 10, min: 0.5, max: 30 },
    });
    await refreshCredits();

    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({ assistantDraft: "" }),
    });

    try {
      expect(document.querySelector(".ai-send-cost")).toBeNull();
      expect(document.querySelector(".ai-composer-credit-hint")).toBeNull();
    } finally {
      await unmount(component);
    }
  });

  it("shows the cost compactly inside the arrow send button", async () => {
    fetchCreditSnapshot.mockResolvedValue({
      balance: 50,
      estimate: { typical: 10, min: 0.5, max: 30 },
    });
    await refreshCredits();

    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({ assistantDraft: "Make the intro pop" }),
    });

    try {
      const send = must<HTMLButtonElement>(".ai-composer-send");
      expect(send.textContent?.trim()).toBe("5");
      expect(must<HTMLElement>(".ai-send-cost").textContent?.trim()).toBe("5");
      expect(document.querySelector(".ai-composer-credit-hint")).toBeNull();
      expect(send.disabled).toBe(false);
    } finally {
      await unmount(component);
    }
  });

  it("grows the estimate as the drafted message gets longer", async () => {
    fetchCreditSnapshot.mockResolvedValue({
      balance: 50,
      estimate: { typical: 10, min: 0.5, max: 30 },
    });
    await refreshCredits();

    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({ assistantDraft: "Fix it" }),
    });

    try {
      const composer = must<HTMLTextAreaElement>(".ai-composer-input");
      const cost = must<HTMLElement>(".ai-send-cost");
      const short = cost.textContent;

      composer.value =
        "Slow the intro to two seconds, make the headline larger, and fade the logo in over the first second instead of cutting to it.";
      composer.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();

      expect(cost.textContent).not.toBe(short);
      expect(cost.textContent?.trim()).toBe("20.8");
    } finally {
      await unmount(component);
    }
  });

  it("does not block sending just because the balance is under the typical cost", async () => {
    fetchCreditSnapshot.mockResolvedValue({
      balance: 3,
      estimate: { typical: 10, min: 0.5, max: 30 },
    });
    await refreshCredits();

    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({ assistantDraft: "Make the intro pop" }),
    });

    try {
      expect(must<HTMLButtonElement>(".ai-composer-send").disabled).toBe(false);
      expect(must<HTMLElement>(".ai-send-cost").textContent?.trim()).toBe("5");
      expect(document.querySelector(".ai-composer-credit-hint")).toBeNull();
    } finally {
      await unmount(component);
    }
  });

  it("does not require a separate click to classify a pasted image", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({
        assistantDraft: "Use this product image in the video",
        classifiedAssets: [
          {
            id: "image-1",
            name: "product.png",
            mimeType: "image/png",
            token: "motionly-asset://image-1",
          },
        ],
      }),
    });

    try {
      expect(must<HTMLButtonElement>(".ai-composer-send").disabled).toBe(false);
      expect(document.querySelector(".ai-intent-question")).toBeNull();
      expect(
        must<HTMLElement>(".ai-attachment-intent-tag").textContent,
      ).toContain("auto");
    } finally {
      await unmount(component);
    }
  });

  it("blocks sending and explains why once the balance is below what a request needs", async () => {
    fetchCreditSnapshot.mockResolvedValue({
      balance: 0.2,
      estimate: { typical: 10, min: 0.5, max: 30 },
    });
    await refreshCredits();

    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TiffyPanel, {
      target,
      props: panelProps({ assistantDraft: "Make the intro pop" }),
    });

    try {
      const hint = must<HTMLElement>(".ai-composer-credit-hint");
      expect(hint.textContent?.trim()).toBe(
        "Not enough credits — you have 0.2 left.",
      );
      expect(hint.classList.contains("is-low")).toBe(true);
      const send = must<HTMLButtonElement>(".ai-composer-send");
      expect(send.disabled).toBe(true);
      expect(send.getAttribute("aria-label")).toContain("not enough credits");
    } finally {
      await unmount(component);
    }
  });
});

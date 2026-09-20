import { mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import TiffyPanel from "./TiffyPanel.svelte";

afterEach(() => {
  document.body.replaceChildren();
});

describe("TiffyPanel uploads", () => {
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

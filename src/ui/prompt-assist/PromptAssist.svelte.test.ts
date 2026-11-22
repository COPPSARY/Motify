import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "../../api/client";
import {
  refreshPromptAssist,
  resetPromptAssist,
  setPromptAssistBrand,
  setPromptAssistUser,
} from "../../stores/prompt-assist";
import PromptEnhanceButton from "./PromptEnhanceButton.svelte";

const api = vi.hoisted(() => ({
  enhancePrompt: vi.fn(),
  preparePromptImages: vi.fn(),
}));

vi.mock("../../api/prompt-assist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/prompt-assist")>()),
  ...api,
}));

async function enable() {
  await refreshPromptAssist({
    getCapabilities: async () => ({ promptAssist: true }),
  });
  setPromptAssistUser(true);
}

describe("PromptEnhanceButton", () => {
  let component: ReturnType<typeof mount> | null = null;

  beforeEach(() => {
    resetPromptAssist();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (component) await unmount(component);
    component = null;
    document.body.innerHTML = "";
  });

  function render(props: Record<string, unknown>) {
    const target = document.createElement("div");
    document.body.append(target);
    component = mount(PromptEnhanceButton, { target, props: props as never });
    flushSync();
  }

  async function settle() {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
      await tick();
    }
    flushSync();
  }

  const button = () =>
    document.querySelector<HTMLButtonElement>(".pa-enhance-button");

  it("is an icon button with no price, shown only once the API offers it and someone is signed in", async () => {
    render({ value: "", surface: "composer", onApply: vi.fn() });
    expect(button()).toBeNull();
    await enable();
    flushSync();
    expect(button()!.getAttribute("aria-label")).toBe("Enhance prompt");
    expect(button()!.textContent?.trim()).toBe("");
    expect(button()!.title).toBe("Enhance prompt (free)");
  });

  it("asks for a few words before calling the model", async () => {
    await enable();
    const onNotice = vi.fn();
    render({ value: " ", surface: "composer", onApply: vi.fn(), onNotice });
    button()!.click();
    await settle();
    expect(api.enhancePrompt).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith(
      expect.stringContaining("Write a few words"),
    );
  });

  it("puts the enhanced prompt straight into the prompt box, with no preview", async () => {
    await enable();
    api.enhancePrompt.mockResolvedValue({
      enhanced: "A 30-second launch film for Ledger with a hook.",
    });
    const onApply = vi.fn();
    render({ value: "ad for my app", surface: "composer", onApply });
    button()!.click();
    await settle();

    expect(api.enhancePrompt).toHaveBeenCalledWith({
      prompt: "ad for my app",
      surface: "composer",
    });
    expect(onApply).toHaveBeenCalledWith(
      "A 30-second launch film for Ledger with a hook.",
    );
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("tells the server which workspace and brand to write about", async () => {
    await enable();
    api.enhancePrompt.mockResolvedValue({
      enhanced: "A detailed Ledger film.",
    });
    setPromptAssistBrand("ws-1", "brand-1");
    render({
      value: "video about my products",
      surface: "composer",
      onApply: vi.fn(),
    });
    button()!.click();
    await settle();
    expect(api.enhancePrompt).toHaveBeenLastCalledWith({
      prompt: "video about my products",
      surface: "composer",
      workspaceId: "ws-1",
      brandId: "brand-1",
    });

    setPromptAssistBrand("ws-1", null);
    button()!.click();
    await settle();
    expect(api.enhancePrompt).toHaveBeenLastCalledWith({
      prompt: "video about my products",
      surface: "composer",
      workspaceId: "ws-1",
      brandId: null,
    });
  });

  it("tells the server what is attached, so it plans only what those files can do", async () => {
    await enable();
    api.enhancePrompt.mockResolvedValue({
      enhanced: "A detailed sneaker film.",
    });
    render({
      value: "make a video for my shoes",
      surface: "composer",
      attachments: { images: 1, videos: 0, audio: 0 },
      onApply: vi.fn(),
    });
    button()!.click();
    await settle();
    expect(api.enhancePrompt).toHaveBeenCalledWith({
      prompt: "make a video for my shoes",
      surface: "composer",
      attachments: { images: 1, videos: 0, audio: 0 },
    });
  });

  it("shows the enhancer the attached images, downscaled, so it plans from what they show", async () => {
    await enable();
    api.enhancePrompt.mockResolvedValue({
      enhanced: "A detailed sneaker film.",
    });
    const prepared = [
      {
        name: "shoe.png",
        role: "asset",
        dataUrl: "data:image/jpeg;base64,AAAA",
      },
    ];
    api.preparePromptImages.mockResolvedValue(prepared);
    const images = [{ name: "shoe.png", role: "asset", src: "blob:shoe" }];
    render({
      value: "make a video for my shoes",
      surface: "composer",
      images,
      onApply: vi.fn(),
    });
    button()!.click();
    await settle();
    expect(api.preparePromptImages).toHaveBeenCalledWith(images);
    expect(api.enhancePrompt).toHaveBeenCalledWith({
      prompt: "make a video for my shoes",
      surface: "composer",
      images: prepared,
    });
  });

  it("sends no images when none could be read", async () => {
    await enable();
    api.enhancePrompt.mockResolvedValue({
      enhanced: "A detailed sneaker film.",
    });
    api.preparePromptImages.mockResolvedValue([]);
    render({
      value: "make a video for my shoes",
      surface: "composer",
      images: [{ name: "broken.png", role: "asset", src: "blob:gone" }],
      onApply: vi.fn(),
    });
    button()!.click();
    await settle();
    expect(api.enhancePrompt).toHaveBeenCalledWith({
      prompt: "make a video for my shoes",
      surface: "composer",
    });
  });

  it("reports that it is busy until the new text is in, so the page can hold Send", async () => {
    await enable();
    let finish: (value: { enhanced: string }) => void = () => undefined;
    api.enhancePrompt.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    const states: boolean[] = [];
    const onApply = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const props = $state({
      value: "ad for my app",
      surface: "composer" as const,
      onApply,
      enhancing: false,
    });
    component = mount(PromptEnhanceButton, { target, props });
    flushSync();

    button()!.click();
    await settle();
    states.push(props.enhancing);
    expect(button()!.disabled).toBe(true);
    expect(button()!.getAttribute("aria-label")).toBe("Enhancing prompt");

    finish({ enhanced: "A detailed launch film." });
    await settle();
    states.push(props.enhancing);
    expect(states).toEqual([true, false]);
    expect(onApply).toHaveBeenCalledWith("A detailed launch film.");
  });

  it("says why when the server refuses, such as the daily limit, and leaves the prompt alone", async () => {
    await enable();
    api.enhancePrompt.mockRejectedValue(
      new ApiRequestError(
        "You have used today's free enhancements. Try again tomorrow.",
        429,
        "RATE_LIMITED",
      ),
    );
    const onNotice = vi.fn();
    const onApply = vi.fn();
    render({ value: "ad for my app", surface: "composer", onApply, onNotice });
    button()!.click();
    await settle();
    expect(onNotice).toHaveBeenCalledWith(
      "You have used today's free enhancements. Try again tomorrow.",
    );
    expect(onApply).not.toHaveBeenCalled();
    expect(button()!.disabled).toBe(false);
  });
});

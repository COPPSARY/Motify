import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Storyboard } from "../../cloud/projects-api";
import type { GuideResult } from "../../onboarding/guided-tools";
import GuidedStart from "./GuidedStart.svelte";
import { forgetPromptTemplates } from "./prompt-template-cache";

const fetchPromptTemplates = vi.hoisted(() => vi.fn());
vi.mock("../../api/prompt-templates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/prompt-templates")>()),
  fetchPromptTemplates,
}));
vi.mock("../../api/assets", () => ({
  loadAssetObjectUrl: vi.fn().mockRejectedValue(new Error("offline")),
}));

const settle = async () => {
  await Promise.resolve();
  await tick();
  flushSync();
};

function button(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((item) =>
    item.textContent?.includes(name),
  );
  if (!found) throw new Error(`No button "${name}"`);
  return found;
}

function type(id: string, value: string) {
  const field = document.getElementById(id) as
    HTMLInputElement | HTMLTextAreaElement;
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  flushSync();
}

describe("GuidedStart", () => {
  let component: ReturnType<typeof mount> | undefined;
  const onGenerate = vi.fn<(result: GuideResult) => Promise<boolean>>();

  function start(
    props: {
      brand?: { name: string; logoAssetId: string | null } | null;
      onExplore?: () => void;
      maxSeconds?: number | null;
      onUpgrade?: () => void;
      onStoryboard?: (result: GuideResult) => Promise<{
        storyboard: Storyboard;
        uploads: ReadonlyMap<File, string>;
      } | null>;
    } = {},
  ) {
    component = mount(GuidedStart, {
      target: document.body,
      props: { onGenerate, ...props },
    });
    flushSync();
  }

  function lastResult(): GuideResult {
    const [call] = onGenerate.mock.calls.slice(-1);
    if (!call) throw new Error("onGenerate was not called");
    return call[0];
  }

  beforeEach(() => {
    forgetPromptTemplates();
    fetchPromptTemplates.mockResolvedValue([]);
    onGenerate.mockReset();
    onGenerate.mockResolvedValue(true);
  });

  afterEach(() => {
    if (component) void unmount(component);
    component = undefined;
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("shows the tools, then the form for the one picked", async () => {
    start();
    expect(document.querySelectorAll(".gs-card")).toHaveLength(4);
    expect(document.body.textContent).toContain("Screenshots → video");
    button("Product walkthrough").click();
    await settle();
    expect(document.querySelector("h1")?.textContent).toContain(
      "Product walkthrough",
    );
    expect(document.body.textContent).toContain("Used as reference only");
    expect(document.body.textContent).toContain("Shown in your video");
    expect(document.body.textContent).toContain("Video language");

    button("All tools").click();
    await settle();
    expect(document.querySelectorAll(".gs-card")).toHaveLength(4);
  });

  it("links to every template from under the cards", () => {
    const onExplore = vi.fn();
    start({ onExplore });
    button("Explore more templates").click();
    expect(onExplore).toHaveBeenCalledOnce();
  });

  it("asks for something to go on before generating", async () => {
    start();
    button("Product walkthrough").click();
    await settle();
    button("Generate video").click();
    await settle();
    expect(onGenerate).not.toHaveBeenCalled();
    expect(document.querySelector(".gs-missing")?.textContent).toContain(
      "screenshot",
    );
  });

  it("sends the tool and the person's choices, and shows only those in the chat", async () => {
    start();
    button("Social media ad").click();
    await settle();
    button("1:1").click();
    button("Custom").click();
    await settle();
    type("guide-seconds", "40");
    button("ខ្មែរ").click();
    type("guide-instructions", "20% off this week");
    button("Generate video").click();
    await settle();

    const result = lastResult();
    expect(result.tool).toEqual({
      id: "social-ad",
      seconds: 40,
      language: "km",
      format: "scenes",
      look: "motiks-spicy-curls",
    });
    expect(result.aspect).toBe("1:1");
    expect(result.message).toBe(
      "Social media ad · 1:1 · 40 sec · Khmer\n\n20% off this week",
    );
    expect(result.files).toEqual([]);
    // Sent, so the form gives way to the tools again.
    expect(document.querySelectorAll(".gs-card")).toHaveLength(4);
  });

  it("holds a free plan to its length, and says why on the locked ones", async () => {
    const onUpgrade = vi.fn();
    start({ maxSeconds: 10, onUpgrade });
    button("Social media ad").click();
    await settle();

    const locked = [
      ...document.querySelectorAll<HTMLButtonElement>(".gs-segment.is-locked"),
    ];
    expect(locked.map((item) => item.textContent?.trim())).toEqual([
      "15 sec",
      "25 sec",
      "Custom",
    ]);
    for (const item of locked) {
      expect(item.dataset["tooltip"]).toBe(
        "Free plan videos are up to 10 seconds. Upgrade for longer videos.",
      );
      expect(item.getAttribute("aria-disabled")).toBe("true");
    }
    expect(document.querySelector(".gs-limit")?.textContent).toContain(
      "Free plan videos are up to 10 seconds.",
    );
    expect(document.getElementById("guide-seconds")).toBeNull();

    button("25 sec").click();
    await settle();
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    type("guide-instructions", "20% off this week");
    button("Generate video").click();
    await settle();
    expect(lastResult().tool.seconds).toBe(10);
  });

  it("makes a social ad as one animated poster when asked", async () => {
    start();
    button("Product walkthrough").click();
    await settle();
    // Only the Social media ad has formats to choose from.
    expect(document.body.textContent).not.toContain("Animated poster");
    button("All tools").click();
    await settle();
    button("Social media ad").click();
    await settle();
    button("1 scene").click();
    type("guide-instructions", "New spicy flavour");
    button("Generate video").click();
    await settle();

    expect(lastResult().tool.format).toBe("poster");
    expect(lastResult().message).toBe(
      "Social media ad · 1 scene · 9:16 · 15 sec · English\n\nNew spicy flavour",
    );
  });

  it("keeps the logo apart from the pictures, and marks it as the logo", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
      revokeObjectURL: vi.fn(),
    });
    start();
    button("Product launch").click();
    await settle();
    const [logoInput, picturesInput] = [
      ...document.querySelectorAll<HTMLInputElement>(".gs-split .gs-file"),
    ];
    const logo = new File(["l"], "logo.png", { type: "image/png" });
    const photo = new File(["p"], "photo.png", { type: "image/png" });
    for (const [input, file] of [
      [logoInput, logo],
      [picturesInput, photo],
    ] as const) {
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      input?.dispatchEvent(new Event("change"));
    }
    flushSync();
    button("Generate video").click();
    await settle();

    expect(lastResult().files).toEqual([
      { file: logo, intent: "asset", logo: true },
      { file: photo, intent: "asset" },
    ]);
  });

  it("reorders pictures, and says when many will take longer", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
      revokeObjectURL: vi.fn(),
    });
    start();
    button("Product walkthrough").click();
    await settle();
    const input = document.querySelector<HTMLInputElement>(
      ".gs-panel > .gs-file",
    );
    const screens = ["one", "two", "three"].map(
      (name) => new File([name], `${name}.png`, { type: "image/png" }),
    );
    expect(document.querySelector(".gs-slow")).toBeNull();
    Object.defineProperty(input, "files", {
      value: screens,
      configurable: true,
    });
    input?.dispatchEvent(new Event("change"));
    flushSync();
    expect(document.querySelector(".gs-slow")?.textContent).toContain(
      "3 pictures",
    );

    const first = document.querySelector<HTMLElement>(
      '[data-picture="blob:one.png"]',
    );
    first?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await settle();
    expect(
      [...document.querySelectorAll<HTMLElement>("[data-picture]")].map(
        (thumb) => thumb.dataset["picture"],
      ),
    ).toEqual(["blob:two.png", "blob:one.png", "blob:three.png"]);

    button("Generate video").click();
    await settle();
    expect(lastResult().files.map(({ file }) => file.name)).toEqual([
      "two.png",
      "one.png",
      "three.png",
    ]);
  });

  it("stays open when the request was not sent, as while signing in", async () => {
    onGenerate.mockResolvedValue(false);
    start({ brand: { name: "Kept", logoAssetId: "logo-1" } });
    button("Product launch").click();
    await settle();
    expect(document.body.textContent).toContain("From your Brand Kit.");
    button("Generate video").click();
    await settle();
    expect(onGenerate).toHaveBeenCalledOnce();
    expect(document.querySelector("h1")?.textContent).toContain(
      "Product launch",
    );
  });

  it("previews the plan, keeps the person's edits, and sends them with the film", async () => {
    const storyboard: Storyboard = {
      beats: [
        {
          title: "Hook",
          start: 0,
          duration: 5,
          shows: [],
          action: "The name lands.",
          camera: "Push in",
          text: "Meet Ledger",
        },
        {
          title: "Proof",
          start: 5,
          duration: 5,
          shows: [],
          action: "Numbers count up.",
          camera: "Hold",
          text: "",
        },
        {
          title: "Close",
          start: 10,
          duration: 5,
          shows: [],
          action: "The logo.",
          camera: "",
          text: "",
        },
      ],
      ending: "The logo on its own.",
      direction: "orbit/116/silky",
    };
    const onStoryboard = vi.fn().mockResolvedValue({
      storyboard: structuredClone(storyboard),
      uploads: new Map(),
    });
    start({ onStoryboard });
    button("Social media ad").click();
    await settle();
    type("guide-instructions", "Meet Ledger");
    button("Preview the plan first").click();
    await settle();
    expect(onStoryboard).toHaveBeenCalledOnce();
    expect(document.querySelector("h1")?.textContent).toContain("plan");
    expect(document.querySelectorAll(".gs-beat")).toHaveLength(3);

    document
      .querySelector<HTMLButtonElement>('[aria-label="Remove beat 2"]')
      ?.click();
    flushSync();
    expect(document.querySelectorAll(".gs-beat")).toHaveLength(2);

    // Back and in again with the same choices: the same plan, not a new one.
    button("Back to options").click();
    await settle();
    button("Preview the plan first").click();
    await settle();
    expect(onStoryboard).toHaveBeenCalledOnce();
    expect(document.querySelectorAll(".gs-beat")).toHaveLength(2);

    button("Make this video").click();
    await settle();
    const sent = lastResult().tool.storyboard;
    expect(sent?.beats.map((beat) => beat.title)).toEqual(["Hook", "Close"]);
    expect(sent?.beats.at(-1)).toMatchObject({ start: 7.5, duration: 7.5 });
    // The direction it was planned with goes back as it came, so the film is shot as planned.
    expect(sent?.direction).toBe("orbit/116/silky");
  });

  it("plans a new storyboard when the choices change", async () => {
    const onStoryboard = vi.fn().mockResolvedValue({
      storyboard: {
        beats: [
          {
            title: "Only",
            start: 0,
            duration: 15,
            shows: [],
            action: "Hi.",
            camera: "",
            text: "",
          },
        ],
        ending: "",
      },
      uploads: new Map(),
    });
    start({ onStoryboard });
    button("Social media ad").click();
    await settle();
    type("guide-instructions", "First idea");
    button("Preview the plan first").click();
    await settle();
    button("Back to options").click();
    await settle();
    type("guide-instructions", "Second idea");
    button("Preview the plan first").click();
    await settle();
    expect(onStoryboard).toHaveBeenCalledTimes(2);
  });
});

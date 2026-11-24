import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WelcomeFlow from "./WelcomeFlow.svelte";

const fetchPromptTemplates = vi.hoisted(() => vi.fn());
vi.mock("../api/prompt-templates", () => ({ fetchPromptTemplates }));

const settle = async () => {
  await Promise.resolve();
  await tick();
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

describe("WelcomeFlow", () => {
  let component: ReturnType<typeof mount> | undefined;
  const onDone = vi.fn();
  const onSkip = vi.fn();

  beforeEach(() => {
    fetchPromptTemplates.mockResolvedValue([
      { slug: "a", video: "https://v/a.webm", categories: ["Product"] },
      { slug: "b", video: null, categories: ["UI"] },
    ]);
  });
  afterEach(() => {
    if (component) unmount(component);
    component = undefined;
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  const open = async () => {
    component = mount(WelcomeFlow, {
      target: document.body,
      props: { onDone, onSkip },
    });
    await settle();
  };
  const buttons = () => [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ];
  const withText = (text: string) =>
    buttons().find((b) => b.textContent?.includes(text))!;
  const click = async (element: HTMLElement) => {
    element.click();
    await settle();
  };
  const bar = () =>
    document
      .querySelector('[role="progressbar"]')!
      .getAttribute("aria-valuenow");

  it("starts by asking who they are, with nothing chosen yet", async () => {
    await open();
    expect(document.body.textContent).toContain("Which best describes you?");
    expect(document.body.textContent).toContain("Marketing");
    expect(withText("Continue").disabled).toBe(true);
    expect(
      document.querySelectorAll('[role="radio"][aria-checked="true"]').length,
    ).toBe(0);
    expect(bar()).toBe("25");
  });

  it("walks through the questions and hands back the answers", async () => {
    await open();
    await click(withText("Marketing"));
    await click(withText("Continue"));
    expect(document.body.textContent).toContain(
      "How many videos do you need each month?",
    );
    // Regular is already chosen; pick Serious instead.
    await click(withText("Serious"));
    await click(withText("Continue"));
    expect(document.body.textContent).toContain(
      "What kinds of videos do you usually make?",
    );
    await click(withText("Ads and promos"));
    await click(withText("Explainers"));
    await click(withText("Continue"));
    expect(document.body.textContent).toContain(
      "What should your first video be?",
    );
    expect(bar()).toBe("100");
    expect(withText("Add my pictures").disabled).toBe(true);
    await click(withText("Feature showcase"));
    await click(withText("Add my pictures"));
    expect(onDone).toHaveBeenCalledWith({
      role: "marketer",
      monthlyVideos: "16-40",
      interests: ["ads", "explainers"],
      goal: "feature",
    });
  });

  it("lets them pick at most three kinds of video", async () => {
    await open();
    await click(withText("Marketing"));
    await click(withText("Continue"));
    await click(withText("Continue"));
    for (const name of ["Ads and promos", "Social media posts", "Explainers"]) {
      await click(withText(name));
    }
    expect(withText("Announcements").disabled).toBe(true);
    await click(withText("Explainers"));
    expect(withText("Announcements").disabled).toBe(false);
  });

  it("shows a preview where a template has one and none where not", async () => {
    await open();
    await click(withText("Marketing"));
    for (let i = 0; i < 3; i += 1) await click(withText("Continue"));
    expect(document.body.textContent).toContain("Product launch");
    expect(document.querySelectorAll("video").length).toBe(1);
  });

  it("offers only the first videos that suit what they usually make, and can show them all", async () => {
    await open();
    await click(withText("Marketing"));
    await click(withText("Continue"));
    await click(withText("Continue"));
    await click(withText("Stories and animation"));
    await click(withText("Continue"));
    expect(document.body.textContent).toContain(
      "Picked for what you usually make.",
    );
    const shown = [
      ...document.querySelectorAll<HTMLElement>(".wf__goal strong"),
    ].map((el) => el.textContent);
    expect(shown[0]).toBe("Just animation");
    expect(shown.length).toBeLessThan(4);
    await click(withText("Show all options"));
    expect(document.querySelectorAll(".wf__goal").length).toBe(4);
    expect(document.body.textContent).not.toContain("Show all options");
  });

  it("drops a chosen first video that the new kinds no longer point to", async () => {
    await open();
    await click(withText("Marketing"));
    await click(withText("Continue"));
    await click(withText("Continue"));
    await click(withText("Stories and animation"));
    await click(withText("Continue"));
    await click(withText("Just animation"));
    expect(withText("Add my pictures").disabled).toBe(false);
    await click(
      buttons().find((b) => b.getAttribute("aria-label") === "Back")!,
    );
    await click(withText("Stories and animation"));
    await click(withText("Ads and promos"));
    await click(withText("Continue"));
    expect(withText("Add my pictures").disabled).toBe(true);
  });

  it("shows kinds as stills that play only when hovered, and says to hover", async () => {
    const play = vi.fn(() => Promise.resolve());
    const pause = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
    window.matchMedia = vi.fn(() => ({
      matches: true,
    })) as unknown as typeof window.matchMedia;
    await open();
    await click(withText("Marketing"));
    await click(withText("Continue"));
    await click(withText("Continue"));
    expect(document.body.textContent).toContain(
      "Hover over a tile to see an example.",
    );
    const tile = withText("Ads and promos");
    expect(tile.querySelector("video")).not.toBeNull();
    expect(play).not.toHaveBeenCalled();
    tile.dispatchEvent(new MouseEvent("mouseenter"));
    await settle();
    expect(play).toHaveBeenCalledTimes(1);
    tile.dispatchEvent(new MouseEvent("mouseleave"));
    await settle();
    expect(pause).toHaveBeenCalled();
    // The tile with no example shows an icon instead of a video.
    expect(withText("Explainers").querySelector("video")).toBeNull();
    // @ts-expect-error: restoring the jsdom default of having no matchMedia
    delete window.matchMedia;
  });

  it("goes back a step", async () => {
    await open();
    await click(withText("Business owner"));
    await click(withText("Continue"));
    await click(
      buttons().find((b) => b.getAttribute("aria-label") === "Back")!,
    );
    expect(document.body.textContent).toContain("Which best describes you?");
    expect(withText("Business owner").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("does not block when the previews fail to load, and can be skipped", async () => {
    fetchPromptTemplates.mockRejectedValue(new Error("offline"));
    await open();
    expect(document.body.textContent).toContain("Which best describes you?");
    await click(withText("Skip"));
    expect(onSkip).toHaveBeenCalled();
  });
});

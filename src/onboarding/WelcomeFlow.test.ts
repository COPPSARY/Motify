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
      { categories: ["Product"] },
      { categories: ["Ads", "Product"] },
    ]);
  });
  afterEach(() => {
    if (component) unmount(component);
    component = undefined;
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  const open = async (props = {}) => {
    component = mount(WelcomeFlow, {
      target: document.body,
      props: { onDone, onSkip, ...props },
    });
    await settle();
  };
  const buttons = () => [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ];
  const byText = (text: string) =>
    buttons().find((b) => b.textContent?.trim() === text)!;
  const click = async (element: HTMLElement) => {
    element.click();
    await settle();
  };

  it("walks through the questions and hands back the answers", async () => {
    await open();
    expect(document.body.textContent).toContain("Step 1 of 3");
    expect(byText("Continue").disabled).toBe(true);
    await click(byText("Product"));
    await click(byText("Continue"));
    expect(document.body.textContent).toContain("Step 2 of 3");
    await click(buttons().find((b) => b.textContent?.includes("Square"))!);
    await click(byText("Continue"));
    const input = document.querySelector<HTMLInputElement>("input")!;
    input.value = "Kampot Pepper";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    await click(byText("Make my first video"));
    expect(onDone).toHaveBeenCalledWith({
      interests: ["Product"],
      format: "1:1",
      businessName: "Kampot Pepper",
    });
  });

  it("leaves out the interests question when there are no categories", async () => {
    fetchPromptTemplates.mockResolvedValue([]);
    await open();
    expect(document.body.textContent).toContain("Step 1 of 2");
    expect(document.body.textContent).toContain("Where will it be seen?");
  });

  it("does not block when the categories fail to load", async () => {
    fetchPromptTemplates.mockRejectedValue(new Error("offline"));
    await open();
    expect(document.body.textContent).toContain("Where will it be seen?");
  });

  it("can be skipped", async () => {
    await open();
    await click(byText("Skip for now"));
    expect(onSkip).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});

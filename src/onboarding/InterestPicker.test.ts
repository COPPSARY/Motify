import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InterestPicker from "./InterestPicker.svelte";

const fetchPromptTemplates = vi.hoisted(() => vi.fn());
vi.mock("../api/prompt-templates", () => ({ fetchPromptTemplates }));

const settle = async () => {
  await Promise.resolve();
  await tick();
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

describe("InterestPicker", () => {
  let component: ReturnType<typeof mount> | undefined;
  const onDone = vi.fn();

  beforeEach(() => {
    fetchPromptTemplates.mockResolvedValue([
      { categories: ["UI"] },
      { categories: ["Product", "UI"] },
      { categories: ["Product"] },
      { categories: ["Design"] },
    ]);
  });

  afterEach(() => {
    if (component) unmount(component);
    component = undefined;
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  const chips = () => [
    ...document.querySelectorAll<HTMLButtonElement>(".bd-chip"),
  ];
  const primary = () =>
    document.querySelector<HTMLButtonElement>(".bd-btn--primary")!;

  async function open() {
    component = mount(InterestPicker, {
      target: document.body,
      props: { onDone },
    });
    await settle();
  }

  it("offers each category, the biggest first", async () => {
    await open();
    expect(chips().map((chip) => chip.textContent)).toEqual([
      "Product",
      "UI",
      "Design",
    ]);
  });

  it("needs a pick before continuing, then returns what was picked", async () => {
    await open();
    expect(primary().disabled).toBe(true);
    chips()[0]?.click();
    chips()[2]?.click();
    await settle();
    expect(primary().disabled).toBe(false);
    primary().click();
    expect(onDone).toHaveBeenCalledWith(["Product", "Design"]);
  });

  it("lets a pick be undone, and 'Show all' returns none", async () => {
    await open();
    chips()[0]?.click();
    await settle();
    chips()[0]?.click();
    await settle();
    expect(primary().disabled).toBe(true);
    [...document.querySelectorAll<HTMLButtonElement>(".bd-btn")]
      .find((button) => button.textContent === "Show all")
      ?.click();
    expect(onDone).toHaveBeenCalledWith([]);
  });

  it("never blocks onboarding when the templates cannot load", async () => {
    fetchPromptTemplates.mockRejectedValueOnce(new Error("down"));
    await open();
    expect(onDone).toHaveBeenCalledWith([]);
  });
});

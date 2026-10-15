import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptTemplate } from "../../api/prompt-templates";
import PromptTemplatesPanel from "./PromptTemplatesPanel.svelte";

const fetchPromptTemplates = vi.hoisted(() => vi.fn());
vi.mock("../../api/prompt-templates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/prompt-templates")>()),
  fetchPromptTemplates,
}));

function template(
  slug: string,
  concept: string,
  categories: string[] = [],
): PromptTemplate {
  return {
    slug,
    title: `Title ${slug}`,
    eyebrow: "Brand",
    description: "A description.",
    categories,
    video: null,
    aspectRatio: "16:9",
    fields: [
      {
        key: "concept",
        label: "Concept",
        description: "The idea.",
        defaultValue: concept,
        placeholder: "",
        type: "text",
      },
    ],
    prompt: [
      { text: "Make a video about " },
      { field: "concept" },
      { text: "." },
    ],
    defaultPrompt: `Make a video about ${concept}.`,
  };
}

const settle = async () => {
  await Promise.resolve();
  await tick();
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

describe("PromptTemplatesPanel", () => {
  const writeText = vi.fn();
  let component: ReturnType<typeof mount> | undefined;

  beforeEach(() => {
    fetchPromptTemplates.mockResolvedValue([
      template("one", "a coffee shop"),
      template("two", "a bus"),
    ]);
    writeText.mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    if (component) unmount(component);
    component = undefined;
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  function open(onUse = vi.fn(), initialCategories: string[] = []) {
    component = mount(PromptTemplatesPanel, {
      target: document.body,
      props: { onUse, onNotice: vi.fn(), initialCategories },
    });
    return onUse;
  }

  it("opens the first template and copies its filled-in prompt", async () => {
    open();
    await settle();
    expect(document.body.textContent).toContain("Title one");
    const copy = document.querySelector<HTMLButtonElement>(
      "[data-tour='prompts-copy']",
    );
    expect(copy?.dataset["tooltip"]).toMatch(/edit it/i);
    copy?.click();
    await settle();
    expect(writeText).toHaveBeenCalledWith("Make a video about a coffee shop.");
    expect(document.body.textContent).toContain("Copied");
  });

  it("tells them to edit it for their product and add references once copied", async () => {
    open();
    await settle();
    expect(document.querySelector(".pt-note")).toBeNull();
    document
      .querySelector<HTMLButtonElement>("[data-tour='prompts-copy']")
      ?.click();
    await settle();
    const note = document.querySelector(".pt-note")?.textContent ?? "";
    expect(note).toMatch(/edit it for your own product/i);
    expect(note).toMatch(/add references/i);

    // It outlasts the button's "Copied" state, and goes away on another template.
    await new Promise((resolve) => setTimeout(resolve, 2400));
    flushSync();
    expect(document.querySelector(".pt-note")).not.toBeNull();
    document.querySelectorAll<HTMLButtonElement>(".pt-card")[1]?.click();
    await settle();
    expect(document.querySelector(".pt-note")).toBeNull();
  });

  it("copies what the person changed, in a field or by hand", async () => {
    open();
    await settle();
    const input = document.querySelector<HTMLInputElement>(".pt-field input")!;
    input.value = "a bakery";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    document
      .querySelector<HTMLButtonElement>("[data-tour='prompts-copy']")
      ?.click();
    await settle();
    expect(writeText).toHaveBeenLastCalledWith("Make a video about a bakery.");

    const prompt = document.querySelector<HTMLTextAreaElement>(".pt-prompt")!;
    prompt.value = "My own words";
    prompt.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    document
      .querySelector<HTMLButtonElement>("[data-tour='prompts-copy']")
      ?.click();
    await settle();
    expect(writeText).toHaveBeenLastCalledWith("My own words");
  });

  it("switches templates and sends the prompt to Tiffy", async () => {
    const onUse = open();
    await settle();
    document.querySelectorAll<HTMLButtonElement>(".pt-card")[1]?.click();
    await settle();
    expect(document.body.textContent).toContain("Title two");
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Use in Tiffy"))
      ?.click();
    expect(onUse).toHaveBeenCalledWith("Make a video about a bus.");
  });

  it("offers a retry when the templates cannot be loaded", async () => {
    fetchPromptTemplates.mockRejectedValueOnce(new Error("down"));
    open();
    await settle();
    expect(document.body.textContent).toContain("could not be loaded");
    document.querySelector<HTMLButtonElement>("[role='alert'] button")?.click();
    await settle();
    expect(document.body.textContent).toContain("Title one");
  });

  describe("category filter", () => {
    beforeEach(() => {
      fetchPromptTemplates.mockResolvedValue([
        template("one", "a coffee shop", ["Product"]),
        template("two", "a bus", ["UI"]),
        template("three", "a poster", ["Product", "Design"]),
      ]);
    });

    const cards = () =>
      [...document.querySelectorAll(".pt-card strong")].map(
        (element) => element.textContent,
      );

    it("opens filtered to the categories a new account picked", async () => {
      open(vi.fn(), ["UI"]);
      await settle();
      expect(cards()).toEqual(["Title two"]);
      // The open template is one of the visible ones.
      expect(document.body.textContent).toContain("Title two");
    });

    it("ignores picks no template uses rather than showing nothing", async () => {
      open(vi.fn(), ["Nope"]);
      await settle();
      expect(cards()).toHaveLength(3);
    });

    it("narrows and widens with the chips, and All clears them", async () => {
      open();
      await settle();
      expect(cards()).toHaveLength(3);
      const chip = (name: string) =>
        [...document.querySelectorAll<HTMLButtonElement>(".me-chip")].find(
          (button) => button.textContent === name,
        )!;
      chip("Product").click();
      await settle();
      expect(cards()).toEqual(["Title one", "Title three"]);
      chip("UI").click();
      await settle();
      expect(cards()).toHaveLength(3);
      chip("All").click();
      await settle();
      expect(cards()).toHaveLength(3);
      expect(chip("All").getAttribute("aria-pressed")).toBe("true");
    });

    it("keeps the open template inside the filtered list", async () => {
      open();
      await settle();
      expect(document.body.textContent).toContain("Title one");
      [...document.querySelectorAll<HTMLButtonElement>(".me-chip")]
        .find((button) => button.textContent === "UI")
        ?.click();
      await settle();
      expect(document.querySelector("#pt-detail-title")?.textContent).toBe(
        "Title two",
      );
    });
  });
});

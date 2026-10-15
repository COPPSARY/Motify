import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptTemplate } from "../../api/prompt-templates";
import PromptTemplatesPanel from "./PromptTemplatesPanel.svelte";

const fetchPromptTemplates = vi.hoisted(() => vi.fn());
vi.mock("../../api/prompt-templates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/prompt-templates")>()),
  fetchPromptTemplates,
}));

function template(slug: string, concept: string): PromptTemplate {
  return {
    slug,
    title: `Title ${slug}`,
    eyebrow: "Brand",
    description: "A description.",
    categories: [],
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

  function open(onUse = vi.fn()) {
    component = mount(PromptTemplatesPanel, {
      target: document.body,
      props: { onUse, onNotice: vi.fn() },
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
    expect(copy?.dataset["tooltip"]).toMatch(/tweak it/i);
    copy?.click();
    await settle();
    expect(writeText).toHaveBeenCalledWith("Make a video about a coffee shop.");
    expect(document.body.textContent).toContain("Copied");
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
});

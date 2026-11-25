import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptTemplate } from "../../api/prompt-templates";
import PromptTemplatesPanel from "./PromptTemplatesPanel.svelte";
import { forgetPromptTemplates } from "./prompt-template-cache";

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
    forgetPromptTemplates();
    vi.clearAllMocks();
  });

  async function type(value: string) {
    const input = document.querySelector<HTMLInputElement>(".ptd-field input")!;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  }

  function open(onUse = vi.fn(), initialCategories: string[] = []) {
    component = mount(PromptTemplatesPanel, {
      target: document.body,
      props: { onUse, onNotice: vi.fn(), initialCategories },
    });
    return onUse;
  }

  /** Opens a template's own page, as a click on its card does. */
  async function openTemplate(index = 0) {
    document.querySelectorAll<HTMLButtonElement>(".pt-card")[index]?.click();
    await settle();
  }

  const button = (label: string) =>
    [...document.querySelectorAll("button")].find((item) =>
      item.textContent?.includes(label),
    )!;
  const copyButton = () =>
    document.querySelector<HTMLButtonElement>(".ptd-copy")!;

  it("shows the list first and opens a template on its own page", async () => {
    open();
    await settle();
    expect(document.querySelectorAll(".pt-card")).toHaveLength(2);
    expect(document.querySelector(".ptd")).toBeNull();

    await openTemplate(1);
    expect(document.querySelector("#ptd-title")?.textContent).toBe("Title two");
    // The list gives way to the page instead of sitting beside it.
    expect(document.querySelector(".pt-grid")).toBeNull();
  });

  it("goes back to the list, and the next template starts fresh", async () => {
    open();
    await settle();
    await openTemplate(0);
    await type("a bakery");
    button("All templates").click();
    await settle();
    expect(document.querySelector(".ptd")).toBeNull();
    expect(document.querySelectorAll(".pt-card")).toHaveLength(2);
    await openTemplate(0);
    expect(
      document.querySelector<HTMLInputElement>(".ptd-field input")?.value,
    ).toBe("a coffee shop");
  });

  it("copies the filled-in prompt once the example is made theirs", async () => {
    open();
    await settle();
    await openTemplate();
    await type("a bakery");
    copyButton().click();
    await settle();
    expect(writeText).toHaveBeenCalledWith("Make a video about a bakery.");
    expect(document.body.textContent).toContain("Copied");
  });

  it("shows a live full prompt that highlights the fields and marks the changed ones", async () => {
    open();
    await settle();
    await openTemplate();
    const preview = document.querySelector(".ptd-prompt .pt-preview")!;
    expect(preview.textContent).toBe("Make a video about a coffee shop.");
    const mark = () => preview.querySelector("mark")!;
    expect(mark().classList.contains("is-changed")).toBe(false);
    await type("a bakery");
    expect(preview.textContent).toBe("Make a video about a bakery.");
    expect(mark().classList.contains("is-changed")).toBe(true);
  });

  it("puts the example back with Reset", async () => {
    open();
    await settle();
    await openTemplate();
    await type("a bakery");
    button("Reset").click();
    await settle();
    expect(
      document.querySelector<HTMLInputElement>(".ptd-field input")?.value,
    ).toBe("a coffee shop");
    expect(document.querySelector(".ptd-sample")).not.toBeNull();
  });

  it("keeps Copy and Use off until the example is changed or kept", async () => {
    const onUse = open();
    await settle();
    await openTemplate();
    expect(document.querySelector(".ptd-sample")).not.toBeNull();
    expect(
      document.querySelector(".ptd-field")?.classList.contains("is-start"),
    ).toBe(true);
    expect(copyButton().disabled).toBe(true);
    expect(button("Use in Tiffy").disabled).toBe(true);

    // Keeping the example as it is turns them on.
    document.querySelector<HTMLButtonElement>(".ptd-sample .pt-link")?.click();
    await settle();
    expect(document.querySelector(".ptd-sample")).toBeNull();
    expect(copyButton().disabled).toBe(false);
    button("Use in Tiffy").click();
    expect(onUse).toHaveBeenCalledWith("Make a video about a coffee shop.", []);

    // Another template starts over, and changing a field turns them on too.
    button("All templates").click();
    await settle();
    await openTemplate(1);
    expect(button("Use in Tiffy").disabled).toBe(true);
    await type("a ferry");
    expect(document.querySelector(".ptd-sample")).toBeNull();
    expect(button("Use in Tiffy").disabled).toBe(false);
  });

  it("needs the first field changed, not just fonts or colours", async () => {
    const two: PromptTemplate = {
      ...template("two-fields", "BookMeBus"),
      fields: [
        ...template("x", "BookMeBus").fields,
        {
          key: "colors",
          label: "Colors",
          description: "",
          defaultValue: "sky blue",
          placeholder: "",
          type: "text",
        },
      ],
    };
    fetchPromptTemplates.mockResolvedValue([two]);
    open();
    await settle();
    await openTemplate();
    const inputs =
      document.querySelectorAll<HTMLInputElement>(".ptd-field input");
    inputs[1]!.value = "navy";
    inputs[1]!.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(document.querySelector(".ptd-sample")).not.toBeNull();
    await type("Ferrygo");
    expect(document.querySelector(".ptd-sample")).toBeNull();
  });

  it("treats the first content field as the one to change, not colours listed ahead of it", async () => {
    const lookFirst: PromptTemplate = {
      ...template("look-first", "a coffee shop"),
      fields: [
        {
          key: "colors",
          label: "Colors",
          description: "",
          defaultValue: "red",
          placeholder: "",
          type: "text",
        },
        ...template("x", "a coffee shop").fields,
      ],
    };
    fetchPromptTemplates.mockResolvedValue([lookFirst]);
    open();
    await settle();
    await openTemplate();
    // Colours are folded away; the visible field is the one that has to change.
    const visible = document.querySelectorAll<HTMLInputElement>(
      ".ptd-fields:not(.ptd-look .ptd-fields) input",
    );
    visible[0]!.value = "a bakery";
    visible[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(document.querySelector(".ptd-sample")).toBeNull();
  });

  it("offers a coding-agent template only Copy, since it is not for Tiffy", async () => {
    fetchPromptTemplates.mockResolvedValue([
      { ...template("agent", "the checkout"), special: true },
    ]);
    open();
    await settle();
    await openTemplate();
    expect(document.querySelector(".ptd-assets")).toBeNull();
    expect(
      [...document.querySelectorAll("button")].some((item) =>
        item.textContent?.includes("Use in Tiffy"),
      ),
    ).toBe(false);
    expect(copyButton().textContent).toContain("Copy agent prompt");
  });

  it("sends the person's own assets to Tiffy with the prompt", async () => {
    const onUse = open();
    await settle();
    await openTemplate();
    await type("a bakery");
    const picker = document.querySelector<HTMLInputElement>(
      ".ptd-drop input[type=file]",
    )!;
    const logo = new File(["x"], "logo.png", { type: "image/png" });
    Object.defineProperty(picker, "files", {
      value: [logo],
      configurable: true,
    });
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(document.querySelector(".ptd-files")?.textContent).toContain(
      "logo.png",
    );
    button("Use in Tiffy").click();
    expect(onUse).toHaveBeenCalledWith("Make a video about a bakery.", [logo]);
  });

  it("takes dropped files and lets one be removed", async () => {
    open();
    await settle();
    await openTemplate();
    const drop = document.querySelector<HTMLElement>(".ptd-drop")!;
    const shot = new File(["x"], "shot.png", { type: "image/png" });
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files: [shot] } });
    drop.dispatchEvent(event);
    await settle();
    expect(document.querySelector(".ptd-files")?.textContent).toContain(
      "shot.png",
    );
    document.querySelector<HTMLButtonElement>(".ptd-files button")?.click();
    await settle();
    expect(document.querySelector(".ptd-files")).toBeNull();
  });

  it("shapes each preview to its video's aspect ratio", async () => {
    fetchPromptTemplates.mockResolvedValue([
      template("wide", "a launch"),
      { ...template("tall", "a reel"), aspectRatio: "9:16" },
    ]);
    open();
    await settle();
    const media = [...document.querySelectorAll<HTMLElement>(".pt-media")];
    expect(media.map((element) => element.style.aspectRatio)).toEqual([
      "16 / 9",
      "9 / 16",
    ]);
    expect(media[1]?.querySelector(".pt-ratio")?.textContent).toBe("9:16");
  });

  it("shows the list from earlier at once when the page is opened again", async () => {
    open();
    await settle();
    if (component) unmount(component);
    fetchPromptTemplates.mockReturnValueOnce(new Promise(() => undefined));
    open();
    flushSync();
    expect(document.body.textContent).not.toContain("Loading");
    expect(document.body.textContent).toContain("Title one");
  });

  it("keeps the earlier list when a refresh fails", async () => {
    open();
    await settle();
    if (component) unmount(component);
    fetchPromptTemplates.mockRejectedValueOnce(new Error("down"));
    open();
    await settle();
    expect(document.body.textContent).not.toContain("could not be loaded");
    expect(document.body.textContent).toContain("Title one");
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

    it("opens filtered to the category a new account picked", async () => {
      open(vi.fn(), ["UI"]);
      await settle();
      expect(cards()).toEqual(["Title two"]);
    });

    it("shows everything when a new account picked several categories", async () => {
      open(vi.fn(), ["UI", "Design"]);
      await settle();
      expect(cards()).toHaveLength(3);
    });

    it("ignores picks no template uses rather than showing nothing", async () => {
      open(vi.fn(), ["Nope"]);
      await settle();
      expect(cards()).toHaveLength(3);
    });

    it("filters to one category at a time, and All clears it", async () => {
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
      expect(cards()).toEqual(["Title two"]);
      expect(chip("Product").getAttribute("aria-pressed")).toBe("false");
      expect(chip("UI").getAttribute("aria-pressed")).toBe("true");
      chip("All").click();
      await settle();
      expect(cards()).toHaveLength(3);
      expect(chip("All").getAttribute("aria-pressed")).toBe("true");
    });

    it("keeps the chosen category when coming back from a template", async () => {
      open();
      await settle();
      [...document.querySelectorAll<HTMLButtonElement>(".me-chip")]
        .find((item) => item.textContent === "UI")
        ?.click();
      await settle();
      await openTemplate(0);
      expect(document.querySelector("#ptd-title")?.textContent).toBe(
        "Title two",
      );
      button("All templates").click();
      await settle();
      expect(cards()).toEqual(["Title two"]);
    });
  });
});

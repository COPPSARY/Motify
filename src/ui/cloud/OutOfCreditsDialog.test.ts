import { flushSync, mount, unmount } from "svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dismissOutOfCredits,
  outOfCreditsPrompt,
  promptOutOfCredits,
} from "../../stores/credits";
import OutOfCreditsDialog from "./OutOfCreditsDialog.svelte";

describe("OutOfCreditsDialog", () => {
  let component: ReturnType<typeof mount> | null = null;

  beforeEach(() => {
    dismissOutOfCredits();
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    });
  });

  afterEach(async () => {
    if (component) await unmount(component);
    component = null;
    document.body.innerHTML = "";
  });

  function render(onUpgrade = vi.fn()) {
    const target = document.createElement("div");
    document.body.append(target);
    component = mount(OutOfCreditsDialog, { target, props: { onUpgrade } });
    flushSync();
    return onUpgrade;
  }

  const dialog = () =>
    document.querySelector<HTMLDialogElement>(".me-out-of-credits")!;

  it("stays closed until a request runs out of credits", () => {
    render();
    expect(dialog().open).toBe(false);

    promptOutOfCredits();
    flushSync();

    expect(dialog().open).toBe(true);
    expect(dialog().textContent).toContain("Oh no, you’re out of credits!");
    expect(dialog().textContent).toContain(
      "Use code MOTIFY50 at checkout for 50% off.",
    );
  });

  it("has only a close button and one upgrade link to pricing", () => {
    render();
    promptOutOfCredits();
    flushSync();

    const buttons = dialog().querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.getAttribute("aria-label")).toBe("Close");
    const links = dialog().querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toMatch(/\/pricing$/);
    expect(links[0]!.getAttribute("target")).toBe("_blank");
  });

  it("closes from the X and clears the prompt", () => {
    render();
    promptOutOfCredits();
    flushSync();

    dialog().querySelector<HTMLButtonElement>("button")!.click();
    flushSync();

    expect(dialog().open).toBe(false);
    expect(get(outOfCreditsPrompt)).toBe(false);
  });

  it("reports the upgrade and closes", () => {
    const onUpgrade = render();
    promptOutOfCredits();
    flushSync();

    const link = dialog().querySelector<HTMLAnchorElement>("a")!;
    link.addEventListener("click", (event) => event.preventDefault());
    link.click();
    flushSync();

    expect(onUpgrade).toHaveBeenCalledOnce();
    expect(get(outOfCreditsPrompt)).toBe(false);
  });
});

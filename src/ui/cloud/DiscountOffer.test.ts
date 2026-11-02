import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DiscountOffer from "./DiscountOffer.svelte";

describe("DiscountOffer", () => {
  let component: ReturnType<typeof mount> | null = null;
  const writeText = vi.fn(async () => {});

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
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

  function open(onRedeem = vi.fn()) {
    const target = document.createElement("div");
    document.body.append(target);
    component = mount(DiscountOffer, { target, props: { onRedeem } });
    flushSync();
    document.querySelector<HTMLButtonElement>(".me-discount-button")!.click();
    flushSync();
    return onRedeem;
  }

  const dialog = () =>
    document.querySelector<HTMLDialogElement>(".me-discount")!;
  const close = () =>
    dialog().querySelector<HTMLButtonElement>(".me-discount__close")!;

  it("opens the offer with the code, where to use it, and one redeem link", () => {
    open();
    expect(dialog().open).toBe(true);
    expect(dialog().textContent).toContain("Get 50% off");
    expect(dialog().querySelector(".me-discount__code")?.textContent).toContain(
      "MOTIFY50",
    );
    expect(dialog().textContent).toContain("Promo code");
    const links = dialog().querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]!.textContent).toContain("Redeem it");
    expect(links[0]!.getAttribute("href")).toMatch(/\/pricing$/);
  });

  it("copies the code from the clipboard button", async () => {
    open();
    dialog().querySelector<HTMLButtonElement>(".me-discount__copy")!.click();
    expect(writeText).toHaveBeenCalledWith("MOTIFY50");
    await vi.waitFor(() => {
      flushSync();
      expect(
        dialog()
          .querySelector(".me-discount__copy")!
          .getAttribute("aria-label"),
      ).toBe("Code copied");
    });
  });

  it("asks before leaving, and can go back to the offer", () => {
    open();
    close().click();
    flushSync();
    expect(dialog().open).toBe(true);
    expect(dialog().textContent).toContain("Leave 50% on the table?");

    [...dialog().querySelectorAll("button")]
      .find((b) => b.textContent?.includes("Keep my 50% off"))!
      .click();
    flushSync();
    expect(dialog().textContent).toContain("Get 50% off your plan");
  });

  it("closes after the person declines", () => {
    open();
    close().click();
    flushSync();
    dialog().querySelector<HTMLButtonElement>(".me-discount__decline")!.click();
    flushSync();
    expect(dialog().open).toBe(false);
  });

  it("redeems without asking: copies the code, reports it, and closes", () => {
    const onRedeem = open();
    const link = dialog().querySelector<HTMLAnchorElement>("a")!;
    link.addEventListener("click", (event) => event.preventDefault());
    link.click();
    flushSync();
    expect(writeText).toHaveBeenCalledWith("MOTIFY50");
    expect(onRedeem).toHaveBeenCalledOnce();
    expect(dialog().open).toBe(false);
  });
});

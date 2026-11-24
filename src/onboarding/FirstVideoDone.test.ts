import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import FirstVideoDone from "./FirstVideoDone.svelte";

const plans = [
  { id: "starter", name: "Starter", price: 9.99, credits: 150 },
  { id: "pro", name: "Pro", price: 19.99, credits: 300 },
];

describe("FirstVideoDone", () => {
  let component: ReturnType<typeof mount> | undefined;
  afterEach(() => {
    if (component) unmount(component);
    component = undefined;
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  const open = (props: Record<string, unknown>) => {
    component = mount(FirstVideoDone, {
      target: document.body,
      props: { onClose: vi.fn(), ...props },
    });
    flushSync();
  };
  const button = (text: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      b.textContent?.includes(text),
    )!;
  const click = async (element: HTMLElement) => {
    element.click();
    await tick();
    flushSync();
  };

  it("celebrates first and shows the offer only after", async () => {
    const onOfferShown = vi.fn();
    open({ plans, offerDue: true, creditsPerVideo: 7, onOfferShown });
    expect(document.body.textContent).toContain("Your first video is ready!");
    expect(document.body.textContent).not.toContain("Starter");
    expect(onOfferShown).not.toHaveBeenCalled();
    await click(button("Keep going"));
    expect(onOfferShown).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Starter");
    expect(document.body.textContent).toContain("$9.99/mo");
    expect(document.body.textContent).toContain("about 20 videos like this");
  });

  it("goes straight to closing when no offer is due", async () => {
    const onClose = vi.fn();
    const onOfferShown = vi.fn();
    open({ plans, offerDue: false, onClose, onOfferShown });
    await click(button("Keep going"));
    expect(onClose).toHaveBeenCalled();
    expect(onOfferShown).not.toHaveBeenCalled();
  });

  it("skips the offer when the plans could not be loaded", async () => {
    const onClose = vi.fn();
    open({ plans: [], offerDue: true, onClose });
    await click(button("Keep going"));
    expect(onClose).toHaveBeenCalled();
  });

  it("opens pricing for the picked plan and can be dismissed", async () => {
    const opened = vi.spyOn(window, "open").mockReturnValue(null);
    const onUpgrade = vi.fn();
    const onClose = vi.fn();
    open({ plans, offerDue: true, creditsPerVideo: 7, onUpgrade, onClose });
    await click(button("Keep going"));
    await click(button("$19.99/mo"));
    expect(onUpgrade).toHaveBeenCalledWith("pro");
    expect(opened).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("offers Brand DNA from the celebration", async () => {
    const onBrand = vi.fn();
    const onClose = vi.fn();
    open({ plans, offerDue: true, onBrand, onClose });
    await click(button("Make it yours"));
    expect(onClose).toHaveBeenCalled();
    expect(onBrand).toHaveBeenCalled();
  });
});

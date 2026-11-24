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

  it("asks whether they like it, then points them at revising, then offers a plan", async () => {
    const onRate = vi.fn();
    const onOfferShown = vi.fn();
    open({ plans, offerDue: true, creditsPerVideo: 7, onRate, onOfferShown });
    expect(document.body.textContent).toContain("Your first video is ready");
    expect(document.body.textContent).toContain("Do you like it?");
    expect(document.body.textContent).not.toContain("Starter");
    await click(button("Not quite"));
    expect(onRate).toHaveBeenCalledWith("not-quite");
    expect(document.body.textContent).toContain(
      "No problem. You can change anything.",
    );
    expect(document.body.textContent).toContain("Make the title bigger");
    expect(onOfferShown).not.toHaveBeenCalled();
    await click(button("Skip for now"));
    expect(onOfferShown).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Starter");
    expect(document.body.textContent).toContain("$9.99/mo");
    expect(document.body.textContent).toContain("about 20 videos");
  });

  it("says so differently when they liked it", async () => {
    open({ plans, offerDue: false });
    await click(button("Love it"));
    expect(document.body.textContent).toContain(
      "Nice. You can still change anything.",
    );
  });

  it("hands a picked change to the editor instead of showing the offer straight away", async () => {
    const onRevise = vi.fn();
    const onOfferShown = vi.fn();
    open({ plans, offerDue: true, onRevise, onOfferShown });
    await click(button("Love it"));
    await click(button("Make it shorter"));
    expect(onRevise).toHaveBeenCalledWith("Make it shorter");
    expect(onOfferShown).not.toHaveBeenCalled();
  });

  it("puts the plan that fits what they said first, and says why", async () => {
    open({
      plans,
      offerDue: true,
      creditsPerVideo: 7,
      monthlyVideos: "16-40",
      startAt: "offer",
    });
    await tick();
    flushSync();
    const names = [...document.querySelectorAll(".fvd__plans strong")].map(
      (el) => el.textContent?.replace(/\s+/g, " ").trim(),
    );
    expect(names[0]).toBe("Pro Best for you");
    expect(names[1]).toBe("Starter");
    expect(document.body.textContent?.replace(/\s+/g, " ")).toContain(
      "You said 16 to 40 videos a month, so Pro fits you best.",
    );
  });

  it("lists the plans as they came when they did not say how many", async () => {
    open({ plans, offerDue: true, creditsPerVideo: 7, startAt: "offer" });
    await tick();
    flushSync();
    expect(document.body.textContent).not.toContain("Best for you");
    expect(document.body.textContent).toContain(
      "Your welcome credits cover a few videos",
    );
  });

  it("closes without an offer when none is due, or when the plans could not be loaded", async () => {
    const onClose = vi.fn();
    open({ plans, offerDue: false, onClose });
    await click(button("Love it"));
    await click(button("Skip for now"));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount(component!);
    document.body.replaceChildren();
    const again = vi.fn();
    open({ plans: [], offerDue: true, onClose: again, startAt: "offer" });
    await tick();
    expect(again).toHaveBeenCalled();
  });

  it("opens pricing for the picked plan", async () => {
    const opened = vi.spyOn(window, "open").mockReturnValue(null);
    const onUpgrade = vi.fn();
    const onClose = vi.fn();
    open({
      plans,
      offerDue: true,
      creditsPerVideo: 7,
      startAt: "offer",
      onUpgrade,
      onClose,
    });
    await tick();
    flushSync();
    await click(button("$19.99/mo"));
    expect(onUpgrade).toHaveBeenCalledWith("pro");
    expect(opened).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

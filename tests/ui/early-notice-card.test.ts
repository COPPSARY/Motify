import { mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EarlyNoticeCard, {
  STORAGE_KEY,
} from "../../src/ui/EarlyNoticeCard.svelte";

describe("EarlyNoticeCard", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
    localStorage.clear();
  });

  it("renders centered notice card on first app load and disables button for 3 seconds", async () => {
    const component = mount(EarlyNoticeCard, { target: document.body });
    await tick();

    // Verify card is rendered with dialog role and centered overlay
    const overlay = document.querySelector(".motionly-notice-overlay");
    expect(overlay).not.toBeNull();

    const title = document.querySelector(".notice-title");
    expect(title?.textContent).toContain("We’re still early.");

    const rawBodyText =
      document.querySelector(".notice-card-body")?.textContent;
    const bodyText = rawBodyText?.replace(/\s+/g, " ") ?? "";
    expect(bodyText).toContain(
      "If the animation quality isn’t quite where you expected, we’re sorry.",
    );
    expect(bodyText).toContain(
      "Motify is still in early development, and generation quality depends heavily on the AI models powering it.",
    );
    expect(bodyText).toContain(
      "We’re actively testing and improving our generation pipeline and working toward better AI models and better results.",
    );
    expect(bodyText).toContain(
      "Thank you for your patience while we build Motify.",
    );

    // Button should be disabled initially
    const button =
      document.querySelector<HTMLButtonElement>(".notice-action-btn");
    expect(button).not.toBeNull();
    expect(button?.textContent?.trim()).toBe("I understand");
    expect(button?.disabled).toBe(true);

    // After 2.5 seconds, button should still be disabled
    vi.advanceTimersByTime(2500);
    await tick();
    expect(button?.disabled).toBe(true);

    // At exactly 3.0 seconds, button becomes enabled
    vi.advanceTimersByTime(500);
    await tick();
    expect(button?.disabled).toBe(false);

    // User clicks "I understand"
    button?.click();
    await tick();

    // Storage is updated immediately
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");

    // Exit animation plays and removes card from DOM
    vi.advanceTimersByTime(300);
    await tick();

    expect(document.querySelector(".motionly-notice-overlay")).toBeNull();

    unmount(component);
  });

  it("does not render when notice has already been acknowledged in localStorage", async () => {
    localStorage.setItem(STORAGE_KEY, "true");

    const component = mount(EarlyNoticeCard, { target: document.body });
    await tick();

    expect(document.querySelector(".motionly-notice-overlay")).toBeNull();
    expect(document.querySelector(".motionly-notice-card")).toBeNull();

    unmount(component);
  });
});

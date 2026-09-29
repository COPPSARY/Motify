import { mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchCreditSnapshot = vi.hoisted(() => vi.fn());
const fetchCreditHistory = vi.hoisted(() => vi.fn());
vi.mock("../../api/credits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/credits")>()),
  fetchCreditSnapshot,
  fetchCreditHistory,
}));

/** The store only ever calls `fetchCreditSnapshot`; this is the balance-only shape most tests want. */
function balanceOnly(balance: number) {
  return { balance, estimate: null };
}

import { refreshCredits, resetCredits } from "../../stores/credits";
import CreditsBadge from "./CreditsBadge.svelte";

const grant = {
  id: "entry-1",
  kind: "SIGNUP_GRANT" as const,
  amount: 50,
  description: "Welcome credits",
  createdAt: "2026-09-28T09:00:00.000Z",
};

let component: ReturnType<typeof mount> | undefined;

async function settle() {
  for (let index = 0; index < 6; index += 1) {
    await tick();
    await Promise.resolve();
  }
}

async function render() {
  const target = document.createElement("div");
  document.body.append(target);
  component = mount(CreditsBadge, { target });
  await settle();
}

const trigger = () =>
  document.querySelector<HTMLButtonElement>(".credits-trigger");
const popover = () => document.querySelector(".credits-popover");

beforeEach(() => {
  resetCredits();
  fetchCreditSnapshot.mockReset().mockResolvedValue(balanceOnly(50));
  fetchCreditHistory
    .mockReset()
    .mockResolvedValue({ entries: [grant], nextCursor: null });
});

afterEach(() => {
  if (component) void unmount(component);
  component = undefined;
  document.body.innerHTML = "";
});

describe("CreditsBadge", () => {
  it("shows a dash, not zero, until the server has answered", async () => {
    await render();
    expect(trigger()?.textContent?.trim()).toBe("–");
    expect(trigger()?.getAttribute("aria-label")).toContain("Credits");
  });

  it("shows the balance the server reported", async () => {
    await render();
    await refreshCredits();
    await settle();
    expect(trigger()?.textContent?.trim()).toBe("50");
    expect(trigger()?.getAttribute("aria-label")).toBe(
      "50 credits. View credit activity",
    );
    expect(trigger()?.classList.contains("is-low")).toBe(false);
  });

  it("warns when there is less than one average generation left", async () => {
    fetchCreditSnapshot.mockResolvedValue(balanceOnly(4.5));
    await render();
    await refreshCredits();
    await settle();
    expect(trigger()?.classList.contains("is-low")).toBe(true);
    expect(trigger()?.textContent?.trim()).toBe("4.5");
  });

  it("opens to the balance and recent activity, and refreshes both", async () => {
    await render();
    await refreshCredits();
    trigger()?.click();
    await settle();

    expect(popover()).not.toBeNull();
    expect(trigger()?.getAttribute("aria-expanded")).toBe("true");
    expect(popover()?.textContent).toContain("credits available");
    expect(popover()?.textContent).toContain("Welcome credits");
    expect(popover()?.textContent).toContain("+50");
    expect(fetchCreditHistory).toHaveBeenCalledTimes(1);
    expect(fetchCreditSnapshot.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("closes on Escape and on a click elsewhere", async () => {
    await render();
    trigger()?.click();
    await settle();
    expect(popover()).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await settle();
    expect(popover()).toBeNull();

    trigger()?.click();
    await settle();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await settle();
    expect(popover()).toBeNull();
  });

  it("says so when the balance cannot be reached, without inventing a number", async () => {
    fetchCreditSnapshot.mockRejectedValue(new Error("offline"));
    await render();
    trigger()?.click();
    await settle();
    expect(popover()?.textContent).toContain(
      "Couldn't reach your credit balance",
    );
    expect(trigger()?.textContent?.trim()).toBe("–");
  });

  it("pages through longer history", async () => {
    fetchCreditHistory
      .mockReset()
      .mockResolvedValueOnce({ entries: [grant], nextCursor: "next" })
      .mockResolvedValueOnce({
        entries: [
          { ...grant, id: "entry-2", description: "Refund", amount: 3 },
        ],
        nextCursor: null,
      });
    await render();
    trigger()?.click();
    await settle();

    document.querySelector<HTMLButtonElement>(".credits-more")?.click();
    await settle();

    expect(fetchCreditHistory).toHaveBeenLastCalledWith("next");
    expect(popover()?.textContent).toContain("Refund");
    expect(document.querySelector(".credits-more")).toBeNull();
  });
});

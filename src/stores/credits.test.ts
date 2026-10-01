import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchCreditSnapshot = vi.hoisted(() => vi.fn());
vi.mock("../api/credits", () => ({ fetchCreditSnapshot }));

const balanceOnly = (balance: number) => ({ balance, estimate: null });

import {
  applyServerCharge,
  clearLastCharge,
  creditBalance,
  creditEstimate,
  creditStatus,
  lastCreditCharge,
  refreshCredits,
  resetCredits,
} from "./credits";

beforeEach(() => {
  resetCredits();
  fetchCreditSnapshot.mockReset();
});

describe("credits store", () => {
  it("starts unknown, not zero", () => {
    expect(get(creditBalance)).toBeNull();
    expect(get(creditStatus)).toBe("idle");
  });

  it("holds the balance the server reported", async () => {
    fetchCreditSnapshot.mockResolvedValue(balanceOnly(50));
    await refreshCredits();
    expect(get(creditBalance)).toBe(50);
    expect(get(creditStatus)).toBe("ready");
  });

  it("holds the estimate the server reported, and clears it for an account with none", async () => {
    fetchCreditSnapshot.mockResolvedValueOnce({
      balance: 50,
      estimate: { typical: 10, min: 0.5, max: 30 },
    });
    await refreshCredits();
    expect(get(creditEstimate)).toEqual({ typical: 10, min: 0.5, max: 30 });

    fetchCreditSnapshot.mockResolvedValueOnce(balanceOnly(50));
    await refreshCredits();
    expect(get(creditEstimate)).toBeNull();
  });

  it("keeps the last balance when a refresh fails", async () => {
    fetchCreditSnapshot.mockResolvedValueOnce(balanceOnly(42));
    await refreshCredits();
    fetchCreditSnapshot.mockRejectedValueOnce(new Error("offline"));
    await refreshCredits();
    expect(get(creditBalance)).toBe(42);
    expect(get(creditStatus)).toBe("error");
  });

  it("does not let a slow old answer overwrite a newer one", async () => {
    let releaseOld: (value: { balance: number; estimate: null }) => void = () =>
      undefined;
    fetchCreditSnapshot.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseOld = resolve;
      }),
    );
    const old = refreshCredits();
    fetchCreditSnapshot.mockResolvedValueOnce(balanceOnly(30));
    await refreshCredits();
    releaseOld(balanceOnly(50));
    await old;
    expect(get(creditBalance)).toBe(30);
  });

  it("never shows one account's balance to the next", async () => {
    let releaseSlow: (value: {
      balance: number;
      estimate: null;
    }) => void = () => undefined;
    fetchCreditSnapshot.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseSlow = resolve;
      }),
    );
    const inFlight = refreshCredits();
    resetCredits();
    releaseSlow(balanceOnly(50));
    await inFlight;
    expect(get(creditBalance)).toBeNull();
    expect(get(creditStatus)).toBe("idle");
  });

  it("exposes no way for the UI to set the balance", () => {
    expect("set" in creditBalance).toBe(false);
    expect("update" in creditBalance).toBe(false);
  });

  it("takes the balance a response reports and remembers what the request cost", () => {
    applyServerCharge({ charged: 3.4, remaining: 46.6 });
    expect(get(creditBalance)).toBe(46.6);
    expect(get(creditStatus)).toBe("ready");
    expect(get(lastCreditCharge)).toBe(3.4);
    clearLastCharge();
    expect(get(lastCreditCharge)).toBeNull();
    expect(get(creditBalance)).toBe(46.6);
  });

  it("ignores a response balance that is negative or not a number", () => {
    applyServerCharge({ charged: 1, remaining: 10 });
    applyServerCharge({ charged: 1, remaining: -3 });
    applyServerCharge({ charged: Number.NaN, remaining: 99 });
    expect(get(creditBalance)).toBe(10);
  });

  it("drops a refresh that started before a response reported the balance", async () => {
    let releaseOld: (value: { balance: number; estimate: null }) => void = () =>
      undefined;
    fetchCreditSnapshot.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseOld = resolve;
      }),
    );
    const old = refreshCredits();
    applyServerCharge({ charged: 3, remaining: 47 });
    releaseOld(balanceOnly(50));
    await old;
    expect(get(creditBalance)).toBe(47);
  });

  it("forgets the last charge with the account", () => {
    applyServerCharge({ charged: 3, remaining: 47 });
    resetCredits();
    expect(get(lastCreditCharge)).toBeNull();
  });
});

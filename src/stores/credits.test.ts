import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchCreditBalance = vi.hoisted(() => vi.fn());
vi.mock("../api/credits", () => ({ fetchCreditBalance }));

import {
  applyServerCharge,
  clearLastCharge,
  creditBalance,
  creditStatus,
  lastCreditCharge,
  refreshCredits,
  resetCredits,
} from "./credits";

beforeEach(() => {
  resetCredits();
  fetchCreditBalance.mockReset();
});

describe("credits store", () => {
  it("starts unknown, not zero", () => {
    expect(get(creditBalance)).toBeNull();
    expect(get(creditStatus)).toBe("idle");
  });

  it("holds the balance the server reported", async () => {
    fetchCreditBalance.mockResolvedValue(50);
    await refreshCredits();
    expect(get(creditBalance)).toBe(50);
    expect(get(creditStatus)).toBe("ready");
  });

  it("keeps the last balance when a refresh fails", async () => {
    fetchCreditBalance.mockResolvedValueOnce(42);
    await refreshCredits();
    fetchCreditBalance.mockRejectedValueOnce(new Error("offline"));
    await refreshCredits();
    expect(get(creditBalance)).toBe(42);
    expect(get(creditStatus)).toBe("error");
  });

  it("does not let a slow old answer overwrite a newer one", async () => {
    let releaseOld: (value: number) => void = () => undefined;
    fetchCreditBalance.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        releaseOld = resolve;
      }),
    );
    const old = refreshCredits();
    fetchCreditBalance.mockResolvedValueOnce(30);
    await refreshCredits();
    releaseOld(50);
    await old;
    expect(get(creditBalance)).toBe(30);
  });

  it("never shows one account's balance to the next", async () => {
    let releaseSlow: (value: number) => void = () => undefined;
    fetchCreditBalance.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        releaseSlow = resolve;
      }),
    );
    const inFlight = refreshCredits();
    resetCredits();
    releaseSlow(50);
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
    let releaseOld: (value: number) => void = () => undefined;
    fetchCreditBalance.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        releaseOld = resolve;
      }),
    );
    const old = refreshCredits();
    applyServerCharge({ charged: 3, remaining: 47 });
    releaseOld(50);
    await old;
    expect(get(creditBalance)).toBe(47);
  });

  it("forgets the last charge with the account", () => {
    applyServerCharge({ charged: 3, remaining: 47 });
    resetCredits();
    expect(get(lastCreditCharge)).toBeNull();
  });
});

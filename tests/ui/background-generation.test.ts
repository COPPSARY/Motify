import { describe, expect, it, vi } from "vitest";
import { waitForSavedGeneration } from "../../src/ui/background-generation";

/** A clock that only moves when the wait sleeps, so no real time passes. */
function fakeClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: vi.fn(async (ms: number) => {
      time += ms;
    }),
  };
}

describe("waitForSavedGeneration", () => {
  it("returns as soon as the backend's save shows up", async () => {
    const clock = fakeClock();
    const check = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const found = await waitForSavedGeneration({
      check,
      stillCurrent: () => true,
      intervalMs: 5000,
      timeoutMs: 60_000,
      ...clock,
    });
    expect(found).toBe(true);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("gives up after the timeout when nothing is saved", async () => {
    const clock = fakeClock();
    const check = vi.fn(async () => false);
    const found = await waitForSavedGeneration({
      check,
      stillCurrent: () => true,
      intervalMs: 5000,
      timeoutMs: 30_000,
      ...clock,
    });
    expect(found).toBe(false);
    expect(check).toHaveBeenCalledTimes(6);
  });

  it("stops waiting once the user has left the project", async () => {
    const clock = fakeClock();
    const check = vi.fn(async () => false);
    let current = true;
    check.mockImplementationOnce(async () => {
      current = false;
      return false;
    });
    const found = await waitForSavedGeneration({
      check,
      stillCurrent: () => current,
      ...clock,
    });
    expect(found).toBe(false);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("treats a failed poll as a missed look, not the end", async () => {
    const clock = fakeClock();
    const check = vi
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(true);
    const found = await waitForSavedGeneration({
      check,
      stillCurrent: () => true,
      ...clock,
    });
    expect(found).toBe(true);
  });
});

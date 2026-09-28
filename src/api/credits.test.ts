import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchCreditBalance,
  fetchCreditHistory,
  formatCreditChange,
  formatCredits,
  insufficientCreditsMessage,
} from "./credits";

function respond(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("credit API", () => {
  it("reads the balance with a GET to /v1/credits and nothing else", async () => {
    const fetchMock = respond({ data: { balance: 50 } });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCreditBalance()).resolves.toBe(50);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/credits$/);
    expect(init.method ?? "GET").toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe("include");
  });

  it.each([
    ["missing", { data: {} }],
    ["a string", { data: { balance: "50" } }],
    ["negative", { data: { balance: -1 } }],
    ["not finite", { data: { balance: null } }],
    ["no data", {}],
  ])(
    "refuses a balance that is %s rather than showing it",
    async (_name, body) => {
      vi.stubGlobal("fetch", respond(body));
      await expect(fetchCreditBalance()).rejects.toThrow(/not understood/);
    },
  );

  it("surfaces a rejected request as an error", async () => {
    vi.stubGlobal(
      "fetch",
      respond({ error: { message: "Authentication is required." } }, 401),
    );
    await expect(fetchCreditBalance()).rejects.toThrow(
      "Authentication is required.",
    );
  });

  it("pages history and passes the cursor through untouched", async () => {
    const fetchMock = respond({
      data: {
        entries: [
          {
            id: "a",
            kind: "SIGNUP_GRANT",
            amount: 50,
            description: "Welcome credits",
            createdAt: "2026-09-28T00:00:00.000Z",
          },
          { id: 5, amount: "x" },
        ],
        nextCursor: "abc",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await fetchCreditHistory("prev+/=");
    expect(page.entries).toHaveLength(1);
    expect(page.nextCursor).toBe("abc");
    const url = (fetchMock.mock.calls[0] as [string])[0];
    expect(url).toContain("limit=20");
    expect(url).toContain("cursor=prev%2B%2F%3D");
  });
});

describe("formatCredits", () => {
  it.each([
    [50, "50"],
    [0, "0"],
    [9.5, "9.5"],
    [3.37, "3.3"],
    [3.4, "3.4"],
    [0.99, "0.9"],
    [1234, "1,234"],
    [-5, "0"],
  ])("shows %s as %s, never rounding up", (input, expected) => {
    expect(formatCredits(input)).toBe(expected);
  });

  it("shows the direction of a change", () => {
    expect(formatCreditChange(50)).toBe("+50");
    expect(formatCreditChange(-3.4)).toBe("-3.4");
  });
});

describe("insufficientCreditsMessage", () => {
  it("says what is left, rounded down", () => {
    expect(insufficientCreditsMessage({ balance: 0.29, required: 0.5 })).toBe(
      "You don't have enough credits for this request. You have 0.2 left.",
    );
    expect(insufficientCreditsMessage({ balance: 0 })).toContain(
      "You have 0 left.",
    );
  });

  it("still makes sense without a usable balance", () => {
    for (const details of [undefined, {}, { balance: "lots" }]) {
      expect(insufficientCreditsMessage(details)).toBe(
        "You don't have enough credits for this request.",
      );
    }
  });
});

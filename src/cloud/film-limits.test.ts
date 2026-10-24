import { describe, expect, it } from "vitest";

import { FREE_MAX_SECONDS, filmLimit } from "./film-limits";

const base = {
  cloud: true,
  signedIn: true,
  planRead: true,
  entitled: undefined,
  paid: false,
};

describe("filmLimit", () => {
  it("takes the server's entitlement when it sends one", () => {
    expect(filmLimit({ ...base, entitled: 10 })).toBe(10);
    expect(filmLimit({ ...base, entitled: null })).toBeNull();
  });

  it("falls back to the plan on an API that does not send it", () => {
    expect(filmLimit(base)).toBe(FREE_MAX_SECONDS);
    expect(filmLimit({ ...base, paid: true })).toBeNull();
  });

  it("locks nothing before a signed-in plan is read, or for a local project", () => {
    expect(filmLimit({ ...base, planRead: false })).toBeNull();
    expect(filmLimit({ ...base, cloud: false, entitled: 10 })).toBeNull();
  });

  it("holds a signed-out visitor to the free length", () => {
    expect(filmLimit({ ...base, signedIn: false, planRead: false })).toBe(
      FREE_MAX_SECONDS,
    );
  });
});

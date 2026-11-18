import { describe, expect, it } from "vitest";

import { FREE_MAX_SECONDS, filmLimit, lengthWarning } from "./film-limits";

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

describe("lengthWarning", () => {
  it("warns when a prompt asks for more than three minutes", () => {
    expect(lengthWarning("Make a 5 minute video for my clinic", null)).toBe(
      "Our AI makes videos up to 3 minutes maximum, so this one will be 3 minutes.",
    );
    expect(lengthWarning("ធ្វើវីដេអូ ៤ នាទី", null)).toMatch(/3 minutes/);
  });

  it("says nothing when the length fits or none is asked for", () => {
    expect(lengthWarning("Make a 2 minute explainer", null)).toBeNull();
    expect(lengthWarning("Make a 3 minute video", null)).toBeNull();
    expect(
      lengthWarning("We deliver in 30 minutes, make a promo", null),
    ).toBeNull();
    expect(lengthWarning("Make a promo for my shop", null)).toBeNull();
  });

  it("names the free plan's length when that is the limit", () => {
    expect(lengthWarning("a 30-second ad", 10)).toMatch(
      /Free plan videos are up to 10 seconds/,
    );
  });
});

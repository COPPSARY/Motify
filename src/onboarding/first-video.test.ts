import { describe, expect, it } from "vitest";

import {
  awaitingFirstVideo,
  firstVideoPrompt,
  planOfferDue,
  profileToSave,
  videosPerMonth,
} from "./first-video";

const answers = (over = {}) => ({
  interests: [] as string[],
  format: "9:16" as const,
  businessName: "",
  ...over,
});

describe("firstVideoPrompt", () => {
  it("keeps a prompt that came from the landing page", () => {
    expect(
      firstVideoPrompt(answers({ interests: ["Ads"] }), "  A pepper farm  "),
    ).toBe("A pepper farm");
  });
  it("builds one from a single interest and the business", () => {
    expect(
      firstVideoPrompt(
        answers({ interests: ["Product"], businessName: "Kampot Pepper" }),
      ),
    ).toBe(
      "Make a short product video for Kampot Pepper. Keep it simple, bold and about 10 seconds long.",
    );
  });
  it("joins several interests", () => {
    expect(
      firstVideoPrompt(answers({ interests: ["UI", "Product", "Design"] })),
    ).toBe(
      "Make a short video that mixes ui, product and design. Keep it simple, bold and about 10 seconds long.",
    );
  });
  it("falls back to a promo when nothing was picked", () => {
    expect(firstVideoPrompt(answers())).toContain("a short promo video");
  });
});

describe("profileToSave", () => {
  it("trims, caps and leaves out an empty business name", () => {
    expect(
      profileToSave(
        answers({ interests: ["a", "b", "c", "d"], businessName: "   " }),
      ),
    ).toEqual({
      interests: ["a", "b", "c"],
      format: "9:16",
    });
    expect(
      profileToSave(answers({ businessName: "  Cafe  " })).businessName,
    ).toBe("Cafe");
  });
});

describe("planOfferDue", () => {
  it("is due once, to someone not on a plan", () => {
    expect(planOfferDue({}, null)).toBe(true);
    expect(
      planOfferDue({ planOfferShownAt: "2026-11-01T00:00:00Z" }, null),
    ).toBe(false);
    expect(planOfferDue({}, "starter")).toBe(false);
  });
});

describe("awaitingFirstVideo", () => {
  it("is true only between the welcome answers and the finished video", () => {
    expect(awaitingFirstVideo("first-video")).toBe(true);
    expect(awaitingFirstVideo("welcome")).toBe(false);
    expect(awaitingFirstVideo("first-video-done")).toBe(false);
    expect(awaitingFirstVideo(null)).toBe(false);
  });
});

describe("videosPerMonth", () => {
  it("divides credits by a video's cost and rounds large figures", () => {
    expect(videosPerMonth(150, 7)).toBe(20);
    expect(videosPerMonth(300, 7)).toBe(40);
    expect(videosPerMonth(30, 7)).toBe(4);
    expect(videosPerMonth(0, 7)).toBe(0);
    expect(videosPerMonth(150, 0)).toBe(0);
  });
});

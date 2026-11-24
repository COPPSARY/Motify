import { describe, expect, it } from "vitest";

import { GUIDED_TOOLS } from "./guided-tools";
import {
  GOAL_CHOICES,
  awaitingFirstVideo,
  goalById,
  planOfferDue,
  profileToSave,
  recommendPlan,
  videosPerMonth,
} from "./first-video";

const answers = (over = {}) => ({
  role: null,
  monthlyVideos: null,
  interests: [] as string[],
  goal: "launch" as const,
  ...over,
});

const plans = [
  { id: "pro", name: "Pro", price: 19.99, credits: 300 },
  { id: "starter", name: "Starter", price: 9.99, credits: 150 },
];

describe("first video categories", () => {
  it("each one opens a guided tool that exists", () => {
    for (const goal of GOAL_CHOICES) {
      expect(GUIDED_TOOLS.some((tool) => tool.id === goal.tool)).toBe(true);
    }
  });
  it("finds a category by id", () => {
    expect(goalById("feature")?.tool).toBe("product-walkthrough");
    expect(goalById("nope")).toBeUndefined();
  });
});

describe("profileToSave", () => {
  it("keeps the goal, caps the kinds and leaves out what was left blank", () => {
    expect(profileToSave(answers({ interests: ["a", "b", "c", "d"] }))).toEqual(
      {
        interests: ["a", "b", "c"],
        goal: "launch",
      },
    );
    expect(
      profileToSave(answers({ role: "marketer", monthlyVideos: "6-15" })),
    ).toEqual({
      interests: [],
      goal: "launch",
      role: "marketer",
      monthlyVideos: "6-15",
    });
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

describe("recommendPlan", () => {
  it("picks the cheapest plan that covers what they said", () => {
    expect(recommendPlan(plans, "1-5", 7)?.id).toBe("starter");
    expect(recommendPlan(plans, "6-15", 7)?.id).toBe("starter");
    expect(recommendPlan(plans, "16-40", 7)?.id).toBe("pro");
  });
  it("falls back to the biggest plan when none covers it", () => {
    expect(recommendPlan(plans, "40+", 7)?.id).toBe("pro");
  });
  it("says nothing without an answer or plans", () => {
    expect(recommendPlan(plans, undefined, 7)).toBeNull();
    expect(recommendPlan([], "6-15", 7)).toBeNull();
  });
});

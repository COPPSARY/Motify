import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  QUALITY_REPAIR_THRESHOLD,
  analyzeMotionQuality,
} from "../../src/ai/generation-guidance";

/**
 * A real gemini-3.5-flash-lite draw for "Create a cinematic product launch
 * video for Motionly highlighting AI generated motion graphics", captured from
 * a blank editor. It runs and renders, so nothing about it is blocking, but it
 * is the failure users report: small cards floating in an empty void, a camera
 * world no bigger than the viewport, and a 4.1s stretch with nothing scheduled.
 */
const weakDraw = {
  compositionHtml: readFileSync("tests/fixtures/weak-generation.html", "utf8"),
  timelineJs: readFileSync(
    "tests/fixtures/weak-generation.timeline.js",
    "utf8",
  ),
  reply: "",
};

const PROMPT =
  "Create a cinematic product launch video for Motionly highlighting AI generated motion graphics";

describe("strengths cannot buy off defects", () => {
  const report = analyzeMotionQuality(weakDraw, { prompt: PROMPT });
  const advisory = report.issues.filter(
    (issue) => !report.blockingIssues.includes(issue),
  );

  it("repairs the frozen stretch without demanding an application shell", () => {
    // Retain the dead-stretch repair while allowing object-based composition.
    expect(report.blockingIssues.join(" ")).toContain("with nothing scheduled");
    expect(report.issues.join(" ")).not.toContain(
      "build the application surface",
    );
    expect(advisory.length).toBeGreaterThanOrEqual(2);
  });

  it("counts more strengths than defects and still fails the gate", () => {
    // The bug: an uncapped `+3` per strength outscored the defect penalty, so
    // this draw reported 88 (and a live sibling clamped to a flat 100) and
    // shipped without the repair pass it needed.
    expect(report.strengths.length).toBeGreaterThan(advisory.length);
    expect(report.score).toBeLessThan(QUALITY_REPAIR_THRESHOLD);
    expect(report.requiresRepair).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(0);
  });

  it("allows the UI fixture when a walkthrough is requested", () => {
    // This legacy UI fixture is still valid for an explicit product tour.
    // saas-ad-direction.test.ts checks that it now fails an ad request.
    const strong = analyzeMotionQuality(
      {
        compositionHtml: readFileSync(
          "tests/fixtures/strong-generation.html",
          "utf8",
        ),
        timelineJs: readFileSync(
          "tests/fixtures/strong-generation.timeline.js",
          "utf8",
        ),
        reply: "",
      },
      { prompt: "Show the app in a product tour" },
    );
    expect(strong.blockingIssues).toHaveLength(0);
    expect(strong.score).toBeGreaterThanOrEqual(QUALITY_REPAIR_THRESHOLD);
    expect(strong.requiresRepair).toBe(false);
    expect(strong.score).toBeLessThanOrEqual(100);
  });
});

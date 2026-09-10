import { describe, expect, it } from "vitest";

import { isImprovement } from "../../src/ai/direct-ai";
import type { MotionQualityReport } from "../../src/ai/generation-guidance";

function report(
  score: number,
  blocking: readonly string[],
  advisory: readonly string[] = [],
): MotionQualityReport {
  return {
    score,
    requiresRepair: blocking.length > 0 || score < 80,
    issues: [...blocking, ...advisory],
    blockingIssues: [...blocking],
    strengths: [],
  };
}

const UNPARSEABLE =
  "timeline.js does not parse as JavaScript: Invalid or unexpected token";
const BLANK_SCENE =
  'Scene scene-01 never renders visible scene content. Its storyboard entry is present, but every layer owned by data-scene="scene-01" is empty, hidden, or off screen.';
const DEAD_AIR =
  "the timeline goes 4.8s with nothing scheduled; fill that stretch with the beat's own story action or cut it";
const SLIDESHOW =
  "scenes are joined by opacity toggles rather than carriers; this is slideshow output, not a directed film";

describe("repair passes are ranked by severity, not by count", () => {
  /**
   * The observed regression. A live flash-lite run went 73 -> 31 because the
   * degraded pass carried one blocking issue against the incumbent's two, and
   * the rule compared only how many there were. The one was "does not parse":
   * a film that cannot run replaced a film that ran.
   */
  it("never lets an unrunnable pass displace a running one", () => {
    const running = report(73, [DEAD_AIR, SLIDESHOW]);
    const broken = report(31, [UNPARSEABLE]);
    expect(isImprovement(broken, running)).toBe(false);
  });

  it("treats a scene that renders nothing as fatal too", () => {
    const running = report(70, [DEAD_AIR, SLIDESHOW]);
    const blank = report(65, [BLANK_SCENE]);
    expect(isImprovement(blank, running)).toBe(false);
  });

  it("accepts a pass that clears the fatal defect even with more complaints", () => {
    const broken = report(80, [UNPARSEABLE]);
    const running = report(60, [DEAD_AIR, SLIDESHOW]);
    expect(isImprovement(running, broken)).toBe(true);
  });

  it("still prefers fewer blocking issues when neither pass is fatal", () => {
    expect(
      isImprovement(report(70, [DEAD_AIR]), report(90, [DEAD_AIR, SLIDESHOW])),
    ).toBe(true);
  });

  it("falls back to score when the blocking lists match in severity and size", () => {
    expect(isImprovement(report(88, [DEAD_AIR]), report(74, [DEAD_AIR]))).toBe(
      true,
    );
    expect(isImprovement(report(74, [DEAD_AIR]), report(88, [DEAD_AIR]))).toBe(
      false,
    );
  });

  it("does not swap two equally fatal passes on score alone", () => {
    // Both are unrunnable; the higher score is meaningless, but neither is
    // worse, so the incumbent is only replaced on a real score gain.
    expect(
      isImprovement(report(50, [UNPARSEABLE]), report(40, [BLANK_SCENE])),
    ).toBe(true);
    expect(
      isImprovement(report(40, [UNPARSEABLE]), report(50, [BLANK_SCENE])),
    ).toBe(false);
  });

  it("keeps a clean pass over a blocked one", () => {
    expect(isImprovement(report(85, []), report(95, [DEAD_AIR]))).toBe(true);
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { analyzeMotionQuality } from "../../src/ai/generation-guidance";

/**
 * The scorer used to credit only preset calls, which is not what the house
 * films are made of: recoup, relay, tessera and KiriTTS carry 88 `EASE`
 * references between them and barely a dozen preset calls. A film built the way
 * the newest authored work is built scored no better than one left entirely on
 * stock GSAP curves, so the repair pass could not push toward the house style.
 */
const houseFilms = ["recoup", "relay", "tessera", "KiriTTS"] as const;
/** Authored before the EASE vocabulary existed. */
const legacyFilms = ["motionly-promo", "apple-notesapp", "claude"] as const;

function reportFor(film: string) {
  return analyzeMotionQuality({
    compositionHtml: readFileSync(
      `src/compositions/presets/${film}/composition.html`,
      "utf8",
    ),
    timelineJs: readFileSync(
      `src/compositions/presets/${film}/timeline.js`,
      "utf8",
    ),
    reply: "",
  });
}

describe("EASE vocabulary scoring", () => {
  it.each(houseFilms)("credits the tuned curves in %s", (film) => {
    const report = reportFor(film);
    expect(report.strengths).toContain(
      "directed motion is carried by the tuned EASE vocabulary",
    );
    expect(report.issues.join(" ")).not.toContain("no EASE curve is used");
  });

  it.each(houseFilms)("does not flag stock travels in %s", (film) => {
    expect(reportFor(film).issues.join(" ")).not.toContain(
      "stay on stock GSAP curves",
    );
  });

  it.each(legacyFilms)("warns that %s uses no EASE curve", (film) => {
    const report = reportFor(film);
    expect(report.issues.join(" ")).toContain("no EASE curve is used");
    // Advisory only. A film that renders is never withheld over an ease choice.
    expect(report.blockingIssues.join(" ")).not.toContain("EASE");
  });

  it("names the curves to reach for when travels stay on stock easing", () => {
    const report = reportFor("claude");
    const warning = report.issues.find((issue) =>
      issue.includes("stay on stock GSAP curves"),
    );
    expect(warning).toBeDefined();
    expect(warning).toContain("EASE.cameraRamp");
    expect(warning).toContain("EASE.settle");
  });

  it("leaves short tactile moves on stock curves alone", () => {
    // A 0.22s press has no room for a ramp; only travels of 0.9s+ are counted.
    const report = analyzeMotionQuality({
      compositionHtml: "<template><div data-edit='a'>x</div></template>",
      timelineJs: [
        "export function buildTimeline(context) {",
        "  const { timeline } = context;",
        "  timeline.to('.a', { scale: 1.1, duration: 0.2, ease: 'power2.out' });",
        "  timeline.to('.b', { scale: 1.0, duration: 0.22, ease: 'back.out(1.4)' });",
        "  timeline.to('.c', { x: 10, duration: 0.3, ease: 'power3.out' });",
        "}",
      ].join("\n"),
      reply: "",
    });
    expect(report.issues.join(" ")).not.toContain("stay on stock GSAP curves");
  });
});

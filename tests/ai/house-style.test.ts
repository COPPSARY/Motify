import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// @ts-expect-error -- build script, no type declarations
import {
  buildHouseStyle,
  measureHouseStyle,
} from "../../scripts/house-style.mjs";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";

function film(name: string) {
  return {
    name,
    timeline: readFileSync(
      `src/compositions/presets/${name}/timeline.js`,
      "utf8",
    ),
  };
}

const authored = [
  "KiriTTS",
  "apple-notesapp",
  "claude",
  "motionly-promo",
  "recoup",
  "relay",
  "tessera",
].map(film);

describe("measured house style", () => {
  /**
   * Films select themselves by using the vocabulary. The three authored before
   * `EASE` existed would drag every median toward stock-curve timing, which is
   * the opposite of the standard this reference is meant to set.
   */
  it("counts only the films built on the EASE vocabulary", () => {
    const measured = measureHouseStyle(authored);
    expect(measured.films).toEqual(["KiriTTS", "recoup", "relay", "tessera"]);
  });

  it("reports a usable duration range per curve", () => {
    const measured = measureHouseStyle(authored);
    const arrive = measured.curves.find(
      (curve: { ease: string }) => curve.ease === "arrive",
    );
    expect(arrive.uses).toBeGreaterThan(5);
    expect(arrive.min).toBeGreaterThan(0);
    expect(arrive.min).toBeLessThanOrEqual(arrive.median);
    expect(arrive.median).toBeLessThanOrEqual(arrive.max);
  });

  /**
   * The whole point of measuring rather than shipping source. If a layout, a
   * product name, or a line of copy can reach the model this way, it anchors
   * exactly as `buildMotionlyUserMessage` warns.
   */
  it("carries no copyable content from the films", () => {
    const reference = buildHouseStyle(authored);
    expect(reference).not.toMatch(/<[a-z]+[\s>]/i);
    expect(reference).not.toContain("data-edit");
    expect(reference).not.toContain("timeline.to");
    for (const name of ["Recoup", "Relay", "Tessera", "Kiri"]) {
      // Naming which films were measured is fine; their markup is not.
      expect(reference).not.toContain(`class="${name}`);
    }
  });

  it("degrades to nothing when no film uses the vocabulary", () => {
    expect(
      buildHouseStyle([{ name: "legacy", timeline: "timeline.to(a, {});" }]),
    ).toBe("");
  });

  it("ships inside the deployed prompt", () => {
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("Measured house style");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("src/ai/house-style.md");
    // The anti-anchoring instruction travels with the measurements.
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("must not be reconstructed");
  });

  it("matches the committed artifact", () => {
    // Git may hand this back with CRLF on Windows. The prompt build normalizes
    // line endings before hashing precisely so a checkout cannot change the
    // deployed prompt, so comparing them raw would be stricter than the
    // contract the artifact is actually held to.
    const normalize = (value: string) => value.replace(/\r\n?/g, "\n").trim();
    const generated = normalize(buildHouseStyle(authored));
    const committed = normalize(readFileSync("src/ai/house-style.md", "utf8"));
    expect(committed).toBe(generated);
  });
});

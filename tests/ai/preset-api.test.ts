import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// @ts-expect-error -- build script, no type declarations
import { buildPresetApi, parseFunctions } from "../../scripts/preset-api.mjs";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";

const presetsPath = resolve("src/composition/presets.ts");

async function presetsSource(): Promise<string> {
  return readFile(presetsPath, "utf8");
}

/** Every `export function` in presets.ts, in declaration order. */
async function declaredPresets(): Promise<string[]> {
  const source = await presetsSource();
  return [...source.matchAll(/^export function (\w+)\(/gm)].map(
    (match) => match[1]!,
  );
}

describe("preset API reference", () => {
  it("parses every exported preset", async () => {
    const source = await presetsSource();
    const parsed = parseFunctions(source).map(
      (fn: { name: string }) => fn.name,
    );
    expect(parsed).toEqual(await declaredPresets());
  });

  it("documents every preset in the deployed prompt", async () => {
    const missing = (await declaredPresets()).filter(
      (name) => !MOTIONLY_SYSTEM_PROMPT.includes(`${name}(`),
    );
    expect(missing).toEqual([]);
  });

  it("teaches the EASE vocabulary the presets are tuned against", async () => {
    const source = await presetsSource();
    const block = /export const EASE = \{([\s\S]*?)\n\} as const;/.exec(source);
    const curves = [
      ...block![1]!.matchAll(/(\w+):\s*CustomEase\.create\(/g),
    ].map((match) => match[1]!);
    expect(curves.length).toBeGreaterThan(0);
    for (const curve of curves) {
      expect(MOTIONLY_SYSTEM_PROMPT).toContain(`EASE.${curve}`);
    }
  });

  /**
   * The regression this whole reference exists for. `analyzeMotionQuality`
   * scores a generation on how many presets it called, and eight of the names
   * it credited had never appeared in the prompt — the model was graded on
   * vocabulary it had no way to know. Any preset the scorer rewards must be
   * teachable, so the two lists stay tied together here.
   */
  it("teaches every preset the quality scorer rewards", async () => {
    const guidance = await readFile(
      resolve("src/ai/generation-guidance.ts"),
      "utf8",
    );
    const rewarded = new Set<string>();
    for (const match of guidance.matchAll(
      /countMatches\(\s*executableTimeline,\s*\/([\s\S]*?)\/[gimsuy]*\s*,?\s*\)/g,
    )) {
      for (const name of match[1]!.matchAll(/\b([a-z][A-Za-z]{4,})\b/g)) {
        rewarded.add(name[1]!);
      }
    }
    const presets = new Set(await declaredPresets());
    const scored = [...rewarded].filter((name) => presets.has(name));
    expect(scored.length).toBeGreaterThan(10);
    const untaught = scored.filter(
      (name) => !MOTIONLY_SYSTEM_PROMPT.includes(`${name}(`),
    );
    expect(untaught).toEqual([]);
  });

  /**
   * SKILL.md told the model all three type treatments "return the split word
   * elements". `pullbackComplete` returns the timeline, so a model that followed
   * that and destructured the result crashed the film with "undefined is not
   * iterable" — observed in a live run. The reference now carries the real
   * return type for anything that is not a timeline.
   */
  it("marks the presets whose result may be destructured", async () => {
    const api = buildPresetApi(await presetsSource());
    expect(api).toContain(
      "macroSettle(timeline, element, options?) -> HTMLElement[]",
    );
    expect(api).toContain(
      "kineticAnchor(timeline, anchor, orbiting, options?) -> HTMLElement[]",
    );
    // Returns a timeline, so it carries no arrow and must not be indexed.
    expect(api).not.toContain(
      "pullbackComplete(timeline, lead, tail, options?) ->",
    );
    expect(api).toContain("crashes the film");
  });

  it("keeps every documented return type honest", async () => {
    const source = await presetsSource();
    const api = buildPresetApi(source);
    for (const fn of parseFunctions(source) as {
      name: string;
      returns: string;
    }[]) {
      if (fn.returns === "gsap.core.Timeline") continue;
      expect(api).toContain(`-> ${fn.returns}`);
    }
  });

  it("renders signatures with resolved defaults", async () => {
    const api = buildPresetApi(await presetsSource());
    // Inherited MotionOptions fields plus the preset's own, with real defaults.
    expect(api).toContain("`impactShake(timeline, target, options?)`");
    expect(api).toContain("intensity: number = 10");
    // A default carrying a comma and parens inside a string survives intact.
    expect(api).toContain('ease: string = "elastic.out(1, .72)"');
    // Required options are marked, so the model does not omit them.
    expect(api).toContain("endX: number (required)");
    // Inline intersection option types are not dropped.
    expect(api).toMatch(
      /`cameraPush\(timeline, target, options\?\)`[\s\S]{0,200}scale: number = 1\.18/,
    );
  });
});

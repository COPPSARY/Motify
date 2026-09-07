import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRESET_ASSET_URLS,
  hydratePresetAssets,
} from "../../src/compositions/preset-assets";

const presetsDir = join(process.cwd(), "src/compositions/presets");

function presetPlaceholders(): Set<string> {
  const tokens = new Set<string>();
  for (const entry of readdirSync(presetsDir)) {
    let html: string;
    try {
      html = readFileSync(join(presetsDir, entry, "composition.html"), "utf8");
    } catch {
      continue;
    }
    for (const match of html.matchAll(/__ASSET_[A-Z0-9_]+__/g)) {
      tokens.add(match[0]);
    }
  }
  return tokens;
}

describe("preset artwork", () => {
  it("resolves every placeholder a preset composition ships", () => {
    const tokens = presetPlaceholders();
    expect(tokens.size).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(PRESET_ASSET_URLS).toHaveProperty(token);
    }
  });

  it("hydrates preset media without touching chat asset tokens", () => {
    const source = `<img src="__ASSET_RAMEN_DISH__" alt="Ramen Dish"><img src="motionly-asset://user-upload" alt="Upload">`;
    const hydrated = hydratePresetAssets(source);
    expect(hydrated).not.toContain("__ASSET_");
    expect(hydrated).toContain('alt="Ramen Dish"');
    // A user's attachment is resolved separately and must survive untouched.
    expect(hydrated).toContain("motionly-asset://user-upload");
  });

  it("leaves sources without preset placeholders unchanged", () => {
    const source = "<main><h1>Generated composition</h1></main>";
    expect(hydratePresetAssets(source)).toBe(source);
  });
});

import { describe, expect, it } from "vitest";

import {
  FILM_FONTS,
  filmFontFaceCss,
  filmFontsUsedIn,
} from "../../src/composition/film-fonts";
import { SCENE_KIT_CSS, mountSceneKit } from "../../src/composition/scene-kit";

const families = (source: string) =>
  filmFontsUsedIn(source).map((font) => font.family);

describe("film fonts", () => {
  it("bundles a grotesk, a geometric, a serif, a mono and a condensed face", () => {
    expect(FILM_FONTS.map((font) => font.family)).toEqual([
      "Inter",
      "Plus Jakarta Sans",
      "Space Grotesk",
      "Fraunces",
      "JetBrains Mono",
      "Oswald",
    ]);
  });

  it("declares each face under its plain and its fontsource name", () => {
    const css = filmFontFaceCss(FILM_FONTS);
    for (const font of FILM_FONTS) {
      expect(css).toContain(`font-family:"${font.family}"`);
      expect(css).toContain(`font-family:"${font.family} Variable"`);
    }
  });

  it("finds the families a film names, quoted or not", () => {
    expect(
      families(
        `<main style="font-family:&quot;Fraunces&quot;, serif"><p style="font-family: JetBrains Mono, monospace">x</p></main>`,
      ),
    ).toEqual(["Fraunces", "JetBrains Mono"]);
    expect(
      families(`.t { font-family: 'Plus Jakarta Sans', sans-serif }`),
    ).toEqual(["Plus Jakarta Sans"]);
  });

  it("does not mistake a longer name for a bundled one", () => {
    expect(families(`font-family: Interstate, Oswaldo`)).toEqual([]);
  });

  it("are available to every kit film by name", () => {
    const root = document.createElement("div");
    mountSceneKit(root);
    const css =
      root.querySelector("style[data-motionly-kit]")?.textContent ?? "";
    for (const font of FILM_FONTS) {
      expect(css).toContain(`font-family:"${font.family}"`);
    }
  });
});

describe("scene kit defaults", () => {
  const stageRule = /\.mk-stage\s*{([^}]*)}/.exec(SCENE_KIT_CSS)?.[1] ?? "";

  it("uses neutral placeholders, not a violet accent", () => {
    expect(stageRule).not.toMatch(/7c6cff|124,\s*108,\s*255/i);
    expect(stageRule).toMatch(/--mk-accent:\s*#a3a3a3/);
  });

  it("takes its typeface from --mk-font", () => {
    expect(stageRule).toMatch(
      /font-family:\s*var\(--mk-font,\s*"Inter",\s*system-ui,\s*sans-serif\)/,
    );
  });

  it("draws the ambient light only when a film opts in, or on a legacy theme", () => {
    expect(SCENE_KIT_CSS).not.toMatch(/\.mk-stage::(before|after)/);
    expect(SCENE_KIT_CSS).toContain(
      '.mk-stage:is([data-ambient], [class*="mk-theme-"])::before',
    );
    expect(SCENE_KIT_CSS).toContain(
      '.mk-stage:is([data-ambient], [class*="mk-theme-"])::after',
    );
  });
});

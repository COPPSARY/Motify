import frauncesUrl from "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url";
import interUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import jetbrainsMonoUrl from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
import kantumruyKhmerUrl from "@fontsource-variable/kantumruy-pro/files/kantumruy-pro-khmer-wght-normal.woff2?url";
import kantumruyLatinUrl from "@fontsource-variable/kantumruy-pro/files/kantumruy-pro-latin-wght-normal.woff2?url";
import oswaldUrl from "@fontsource-variable/oswald/files/oswald-latin-wght-normal.woff2?url";
import plusJakartaSansUrl from "@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2?url";
import spaceGroteskUrl from "@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url";

/**
 * The typefaces every film may use by name (all SIL OFL 1.1, Latin subset,
 * variable weight). The backend's `motify-look` skill lists the same families.
 *
 * A film asks for a family by its plain name; fontsource registers each face as
 * "<Name> Variable", so both names are declared.
 */
export interface FilmFont {
  family: string;
  url: string;
  weight: string;
  /** For a family split into script files: the characters this file draws. */
  unicodeRange?: string;
}

/** Khmer and Khmer Symbols; the rest of a Khmer family's text is its Latin file. */
const KHMER_RANGE = "U+1780-17FF,U+19E0-19FF,U+200B-200D,U+25CC";
const LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

export const FILM_FONTS: readonly FilmFont[] = [
  { family: "Inter", url: interUrl, weight: "100 900" },
  { family: "Plus Jakarta Sans", url: plusJakartaSansUrl, weight: "200 800" },
  { family: "Space Grotesk", url: spaceGroteskUrl, weight: "300 700" },
  { family: "Fraunces", url: frauncesUrl, weight: "100 900" },
  { family: "JetBrains Mono", url: jetbrainsMonoUrl, weight: "100 800" },
  { family: "Oswald", url: oswaldUrl, weight: "200 700" },
  // Khmer captions and titles. A modern sans with a Latin companion, so mixed
  // Khmer and English lines share one face; exported frames embed both files.
  {
    family: "Kantumruy Pro",
    url: kantumruyKhmerUrl,
    weight: "100 700",
    unicodeRange: KHMER_RANGE,
  },
  {
    family: "Kantumruy Pro",
    url: kantumruyLatinUrl,
    weight: "100 700",
    unicodeRange: LATIN_RANGE,
  },
];

/** `@font-face` rules for `fonts`, each under its plain and its fontsource name. */
export function filmFontFaceCss(
  fonts: readonly FilmFont[],
  source: (font: FilmFont) => string = (font) => font.url,
): string {
  return fonts
    .flatMap((font) =>
      [font.family, `${font.family} Variable`].map(
        (family) =>
          `@font-face{font-family:"${family}";font-style:normal;font-display:block;font-weight:${font.weight};src:url(${source(font)}) format("woff2");${font.unicodeRange ? `unicode-range:${font.unicodeRange};` : ""}}`,
      ),
    )
    .join("");
}

/**
 * The bundled families a film's markup and styles name. A name must stand on
 * its own, so "Inter" does not match "Interstate". A stray match only embeds
 * one more small file, so this errs toward including a face.
 */
export function filmFontsUsedIn(source: string): FilmFont[] {
  return FILM_FONTS.filter((font) =>
    new RegExp(
      `(?<![A-Za-z])${font.family.replace(/ /g, "\\s+")}(?![A-Za-z])`,
      "i",
    ).test(source),
  );
}

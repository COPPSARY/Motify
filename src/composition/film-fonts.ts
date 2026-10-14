import frauncesUrl from "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url";
import interUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import jetbrainsMonoUrl from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
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
}

export const FILM_FONTS: readonly FilmFont[] = [
  { family: "Inter", url: interUrl, weight: "100 900" },
  { family: "Plus Jakarta Sans", url: plusJakartaSansUrl, weight: "200 800" },
  { family: "Space Grotesk", url: spaceGroteskUrl, weight: "300 700" },
  { family: "Fraunces", url: frauncesUrl, weight: "100 900" },
  { family: "JetBrains Mono", url: jetbrainsMonoUrl, weight: "100 800" },
  { family: "Oswald", url: oswaldUrl, weight: "200 700" },
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
          `@font-face{font-family:"${family}";font-style:normal;font-display:block;font-weight:${font.weight};src:url(${source(font)}) format("woff2");}`,
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

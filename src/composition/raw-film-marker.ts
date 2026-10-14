/**
 * How a raw film is recognised: its `timelineJs` is this marker (see
 * ./raw-film). Kept free of imports, because code that Node loads outside Vite
 * (vite.config.ts reaches src/ai) asks this question too, and must not pull in
 * the bundled font files ./raw-film depends on.
 */
export const RAW_FILM_MARKER = "// motify:raw-html v1";

export function isRawFilm(timelineJs: string): boolean {
  return timelineJs.trimStart().startsWith(RAW_FILM_MARKER);
}

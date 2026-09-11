import interLatinUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import SCENE_KIT_CSS from "./scene-kit.css?raw";

/**
 * The scene kit: a stylesheet and an icon sprite mounted inside every dynamic
 * composition's root.
 *
 * Generated films kept arriving as small, low-contrast cards on a flat stage,
 * and their layouts broke in ways no amount of prose fixed — a table whose
 * status column wrapped under its own row, a free-floating square standing in
 * for a transition. The model was writing every surface's CSS from scratch on
 * every generation. The kit gives it tested components to compose instead, so a
 * frame's design no longer depends on the model reproducing it correctly.
 *
 * It lives inside the root rather than in the document head because the video
 * exporter rasterizes a clone of the root through an SVG foreignObject, and
 * nothing outside that subtree survives the trip.
 */

/** Glyphs drawn on a 24px grid. Stroke comes from `.mk-icon`, colour from `currentColor`. */
export const SCENE_KIT_ICONS: Readonly<Record<string, string>> = {
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z"/>',
  inbox:
    '<path d="M4 13.5 6.5 5h11l2.5 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/><path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  bell: '<path d="M6 10a6 6 0 1 1 12 0c0 4 1.6 5.6 1.6 5.6H4.4S6 14 6 10Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"/>',
  user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  users:
    '<circle cx="9" cy="9" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M16 5.8a3.2 3.2 0 0 1 0 6.3M18 13.8a6 6 0 0 1 3 5.7"/>',
  chat: '<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4.5 3.5V17H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  calendar:
    '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  folder:
    '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v7.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z"/>',
  file: '<path d="M7 3.5h6.5L18 8v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z"/><path d="M13.5 3.5V8H18M9 13h6M9 16.5h4"/>',
  chart: '<path d="M4 20h16"/><path d="M7 20v-6M12 20V6M17 20v-9"/>',
  trend: '<path d="m4 16 5-5 4 4 7-7"/><path d="M14 8h6v6"/>',
  pie: '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12Z"/><path d="M15 3.8A8.5 8.5 0 0 1 20.2 9H15Z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  "check-circle":
    '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.8 2.8L16.2 9.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  "arrow-up-right": '<path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/>',
  sparkle:
    '<path d="M12 3.5 13.9 9 19.5 11 13.9 13 12 18.5 10.1 13 4.5 11 10.1 9Z"/><path d="M18.5 3.5v3M17 5h3"/>',
  star: '<path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.6L12 17l-5.1 2.6 1-5.6-4.1-4 5.7-.8Z"/>',
  heart:
    '<path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
  shield:
    '<path d="M12 3.5 19 6v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  bolt: '<path d="M13 3.5 5.5 13.5H12L11 20.5 18.5 10.5H12Z"/>',
  globe:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5S14.4 18.1 12 20.5C9.6 18.1 8.4 15.3 8.4 12S9.6 5.9 12 3.5Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  play: '<path d="M8 5.5v13l10.5-6.5Z"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
  image:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17.5 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  tag: '<path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8 8Z"/><circle cx="8" cy="8" r="1.4"/>',
  filter: '<path d="M4 5.5h16l-6 7.5v6l-4 1.5v-7.5Z"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r=".9"/><circle cx="4.8" cy="12" r=".9"/><circle cx="4.8" cy="17.5" r=".9"/>',
  code: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>',
  layers:
    '<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8Z"/><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
  dollar:
    '<path d="M12 3.5v17"/><path d="M16.5 7.5c-.9-1.3-2.5-2-4.5-2-2.6 0-4.3 1.3-4.3 3.2 0 4.6 9 2.4 9 6.8 0 2-1.9 3.5-4.7 3.5-2.2 0-3.9-.9-4.8-2.5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3 10h18M6.5 14.8h3.5"/>',
  cloud:
    '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.6 1.5A3.8 3.8 0 0 1 17.5 18.5Z"/>',
  "cursor-arrow": '<path d="M5 3.5 19 11.5l-6.2 1.6L9.6 19Z"/>',
};

/**
 * The 3D pointer: a solid body with a lit edge, used by `.mk-cursor`.
 * Filled rather than stroked, so it carries its own paint.
 */
const CURSOR_SYMBOL =
  '<symbol id="mk-cursor" viewBox="0 0 64 64">' +
  '<path d="M12 6 54 30 36.5 34.5 28 52Z" fill="currentColor" stroke="rgba(0,0,0,.25)" stroke-width="1.5" stroke-linejoin="round"/>' +
  '<path d="M16 12 45 29 34 31.8 28.5 43Z" fill="rgba(255,255,255,.28)"/>' +
  "</symbol>";

export const SCENE_KIT_SPRITE =
  '<svg xmlns="http://www.w3.org/2000/svg" class="mk-sprite" aria-hidden="true" style="display:none">' +
  Object.entries(SCENE_KIT_ICONS)
    .map(
      ([name, body]) =>
        `<symbol id="mk-i-${name}" viewBox="0 0 24 24">${body}</symbol>`,
    )
    .join("") +
  CURSOR_SYMBOL +
  "</svg>";

export { SCENE_KIT_CSS };

/**
 * Puts the kit into a freshly mounted composition root.
 *
 * Both nodes are hidden — the style element and the sprite apply without being
 * painted — so the validator's visible-foreground and blank-frame measurements
 * see exactly what they saw before the kit existed.
 */
export function mountSceneKit(root: HTMLElement): void {
  const document = root.ownerDocument;
  const style = document.createElement("style");
  style.dataset["motionlyKit"] = "";
  style.style.display = "none";
  // Generated films routinely ask for plain "Inter", which fontsource never
  // registers — it names the face "Inter Variable" — so that request fell
  // through to Arial. The exporter embeds its own copy under both names.
  style.textContent =
    `@font-face{font-family:"Inter";font-style:normal;font-display:block;font-weight:100 900;src:url(${interLatinUrl}) format("woff2");}` +
    SCENE_KIT_CSS;
  const holder = document.createElement("div");
  holder.innerHTML = SCENE_KIT_SPRITE;
  const sprite = holder.firstElementChild;
  root.prepend(style, ...(sprite ? [sprite] : []));
}

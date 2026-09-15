import claudeLogoUrl from "./presets/claude/claude-color.svg?url";
import ramenDishUrl from "./presets/claude/ramen_dish.jpg?url";
import blueSkyUrl from "./presets/claude/blue_sky.jpg?url";
import kiriLogoUrl from "./presets/KiriTTS/Kiri-TTS Logo.svg?url";
import appleNotesLogoUrl from "./presets/apple-notesapp/apple-notes.svg?url";
import noteSketchUrl from "./presets/apple-notesapp/9c01cb4e40808bf2daaf2cf718464742.png?url";
import checklistAssetUrl from "./presets/apple-notesapp/Checklist-in-iPhone-notes.jpg?url";
import motifyCursorUrl from "./presets/motify/Cursor.png?url";

/**
 * Media that belongs to a preset composition, addressed by the `__ASSET_*__`
 * placeholders its `composition.html` ships with.
 *
 * A preset's own imagery is part of the composition source, never a chat
 * attachment: the editor resolves these at mount time so the artwork survives
 * every path that remounts from project files (draft restore, AI generation,
 * source edits), and so removing an attachment from the assistant can never
 * blank out a preset's images.
 *
 * `tests/composition/preset-assets.test.ts` fails if a preset introduces a
 * placeholder that is not listed here.
 */
export const PRESET_ASSET_URLS: Readonly<Record<string, string>> = {
  __ASSET_CLAUDE_LOGO__: claudeLogoUrl,
  __ASSET_RAMEN_DISH__: ramenDishUrl,
  __ASSET_BLUE_SKY__: blueSkyUrl,
  __ASSET_KIRI_LOGO__: kiriLogoUrl,
  // A directory rather than a file: KiriTTS loads several SF Pro Display cuts
  // from it, so the placeholder resolves to the folder the faces live in.
  __ASSET_SF_FONT_BASE__: `${import.meta.env.BASE_URL}fonts/sf-pro-display/`,
  __ASSET_KHMER_FONT_BASE__: `${import.meta.env.BASE_URL}fonts/kantumruy-pro/`,
  __ASSET_NOTES_LOGO__: appleNotesLogoUrl,
  __ASSET_NOTE_SKETCH__: noteSketchUrl,
  __ASSET_CHECKLIST__: checklistAssetUrl,
  __ASSET_MOTIFY_CURSOR__: motifyCursorUrl,
};

export function hydratePresetAssets(source: string): string {
  if (!source.includes("__ASSET_")) return source;
  let hydrated = source;
  for (const [placeholder, url] of Object.entries(PRESET_ASSET_URLS)) {
    hydrated = hydrated.replaceAll(placeholder, url);
  }
  return hydrated;
}

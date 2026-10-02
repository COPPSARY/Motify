import type { CompositionDefinition } from "../composition/types";
import { splitCompositionSource } from "../cloud/project-source";
import type { ProjectSourceFiles } from "../cloud/projects-api";

/**
 * Templates are fetched when one is opened, not shipped with the editor. Each
 * one is a composition plus its own source files; the gallery only needs
 * names and thumbnails, which live in the editor.
 */
export type TemplateId =
  | "claude"
  | "motify"
  | "kiri-tts"
  | "apple-notes"
  | "tessera"
  | "relay"
  | "recoup"
  | "motionly-promo";

export interface LoadedTemplate {
  composition: CompositionDefinition;
  files: ProjectSourceFiles;
}

type RawModule = Promise<{ default: string }>;

async function assemble(
  composition: Promise<CompositionDefinition>,
  html: RawModule,
  timeline: RawModule,
  adapter: RawModule,
): Promise<LoadedTemplate> {
  const [definition, htmlSource, timelineSource, adapterSource] =
    await Promise.all([composition, html, timeline, adapter]);
  return {
    composition: definition,
    files: splitCompositionSource(
      htmlSource.default,
      timelineSource.default,
      adapterSource.default,
    ),
  };
}

const loaders: Record<TemplateId, () => Promise<LoadedTemplate>> = {
  claude: () =>
    assemble(
      import("./presets/claude/index").then((module) => module.claudePreset),
      import("./presets/claude/composition.html?raw"),
      import("./presets/claude/timeline.js?raw"),
      import("./presets/claude/index.ts?raw"),
    ),
  motify: () =>
    assemble(
      import("./presets/motify/index").then((module) => module.motifyPreset),
      import("./presets/motify/composition.html?raw"),
      import("./presets/motify/timeline.js?raw"),
      import("./presets/motify/index.ts?raw"),
    ),
  "kiri-tts": () =>
    assemble(
      import("./presets/KiriTTS/index").then((module) => module.kiriTtsPreset),
      import("./presets/KiriTTS/composition.html?raw"),
      import("./presets/KiriTTS/timeline.js?raw"),
      import("./presets/KiriTTS/index.ts?raw"),
    ),
  "apple-notes": () =>
    assemble(
      import("./presets/apple-notesapp/index").then(
        (module) => module.appleNotesPreset,
      ),
      import("./presets/apple-notesapp/composition.html?raw"),
      import("./presets/apple-notesapp/timeline.js?raw"),
      import("./presets/apple-notesapp/index.ts?raw"),
    ),
  tessera: () =>
    assemble(
      import("./presets/tessera/index").then((module) => module.tesseraPreset),
      import("./presets/tessera/composition.html?raw"),
      import("./presets/tessera/timeline.js?raw"),
      import("./presets/tessera/index.ts?raw"),
    ),
  relay: () =>
    assemble(
      import("./presets/relay/index").then((module) => module.relayPreset),
      import("./presets/relay/composition.html?raw"),
      import("./presets/relay/timeline.js?raw"),
      import("./presets/relay/index.ts?raw"),
    ),
  recoup: () =>
    assemble(
      import("./presets/recoup/index").then((module) => module.recoupPreset),
      import("./presets/recoup/composition.html?raw"),
      import("./presets/recoup/timeline.js?raw"),
      import("./presets/recoup/index.ts?raw"),
    ),
  "motionly-promo": () =>
    assemble(
      import("./presets/motionly-promo/index").then(
        (module) => module.motionlyPromoPreset,
      ),
      import("./presets/motionly-promo/composition.html?raw"),
      import("./presets/motionly-promo/timeline.js?raw"),
      import("./presets/motionly-promo/index.ts?raw"),
    ),
};

export function loadTemplate(id: TemplateId): Promise<LoadedTemplate> {
  return loaders[id]();
}

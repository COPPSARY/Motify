import { combineCompositionSource } from "../cloud/project-source";
import type { ProjectSourceFiles } from "../cloud/projects-api";
import { createDynamicComposition } from "../composition/dynamic-compiler";
import type {
  CompositionDefinition,
  SceneDefinition,
} from "../composition/types";

/**
 * The editor opens here, on nothing.
 *
 * It used to open on the Claude preset, which made every first prompt an edit
 * of that preset: the generator saw a long, valid composition, classified the
 * session as an existing project, and shipped the request back re-themed onto
 * Claude's spine. A preset is a thing the user chooses from the Presets tab,
 * not the state they inherit, so its source only enters a session when they
 * open it.
 */
export const BLANK_COMPOSITION_ID = "blank-composition";

export const blankProjectFiles: ProjectSourceFiles = {
  "composition.html": `<template id="motionly-template">
  <style>.motionly-stage { position: relative; width: 100%; height: 100%; overflow: hidden; background: #080b14; }</style>
  <main class="motionly-stage" data-edit="stage"></main>
</template>`,
  "styles.css": "",
  "timeline.js": `export function buildTimeline({ root, timeline, register }) {
  const stage = root.querySelector("[data-edit='stage']");
  if (!stage) throw new Error("Motify stage was not found.");
  register("stage", stage);
}`,
  "index.ts": `import { defineComposition, type CompositionContext } from '@motionly/runtime';
import compositionHtml from './composition.html?raw';
import { buildTimeline } from './timeline.js';

function mount(context: CompositionContext) {
  const documentNode = new DOMParser().parseFromString(compositionHtml, 'text/html');
  const template = documentNode.querySelector<HTMLTemplateElement>('#motionly-template');
  if (!template) throw new Error('Motify template was not found.');
  context.root.replaceChildren(template.content.cloneNode(true));
}

export default defineComposition({
  id: 'blank-composition', title: 'Untitled Motify Project', description: 'Blank Motify composition',
  width: 1920, height: 1080, fps: 60, duration: 5,
  scenes: [{ id: 'main', label: 'Main', start: 0, duration: 5, accent: '#7657ff', tracks: [{ id: 'stage', label: 'Stage', kind: 'Background', start: 0, end: 5 }] }],
  sourcePreview: compositionHtml,
  build(context) { mount(context); buildTimeline(context); },
});`,
};

export const blankScenes: readonly SceneDefinition[] = [
  {
    id: "main",
    label: "Main",
    start: 0,
    duration: 5,
    accent: "#7657ff",
    tracks: [
      {
        id: "stage",
        label: "Stage",
        kind: "Background",
        start: 0,
        end: 5,
      },
    ],
  },
];

/** The composition the editor mounts on a first open and on New. */
export function createBlankComposition(): CompositionDefinition {
  return createDynamicComposition(
    combineCompositionSource(blankProjectFiles),
    blankProjectFiles["timeline.js"],
    {
      id: BLANK_COMPOSITION_ID,
      title: "Untitled Motify Project",
      duration: 5,
      scenes: blankScenes,
    },
  );
}

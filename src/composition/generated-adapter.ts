import type { SceneDefinition } from "./types";

export function createGeneratedAdapterSource(options: {
  id: string;
  title: string;
  duration: number;
  scenes: readonly SceneDefinition[];
  width?: number;
  height?: number;
  fps?: number;
}): string {
  const safeId = options.id.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  return `import { defineComposition, type CompositionContext } from '@motionly/runtime';
import compositionHtml from './composition.html?raw';
import compositionStyles from './styles.css?raw';
import { buildTimeline } from './timeline.js';

const compositionSource = compositionHtml.replace(
  /(<template\\b[^>]*>)/i,
  \`$1<style>\\n\${compositionStyles}\\n</style>\`,
);

function mount(context: CompositionContext) {
  const documentNode = new DOMParser().parseFromString(compositionSource, 'text/html');
  const template = documentNode.querySelector<HTMLTemplateElement>('template');
  if (!template) throw new Error('Motify template was not found.');
  context.root.replaceChildren(template.content.cloneNode(true));
}

// The local CLI reads this JSON literal without executing project code.
// prettier-ignore
export const motionlyMetadata = ${JSON.stringify({
    id: safeId || "ai-generated",
    title: options.title,
    description: "AI-edited Motify composition",
    width: options.width ?? 1920,
    height: options.height ?? 1080,
    fps: options.fps ?? 60,
    duration: options.duration,
    scenes: options.scenes,
  })} as const;

export default defineComposition({
  ...motionlyMetadata,
  sourcePreview: compositionSource,
  build(context) { mount(context); buildTimeline(context); },
});`;
}

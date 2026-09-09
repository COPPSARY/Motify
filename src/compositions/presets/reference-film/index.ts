import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import * as presets from "../../../composition/presets";
import { sanitizeTimelineScript } from "../../../composition/dynamic-compiler";
import compositionHtml from "./composition.html?raw";
import timelineSource from "./timeline.js?raw";

/**
 * The worked example.
 *
 * Every other preset in this repo predates the reference standard, and the
 * bundled generation foundation — the one concrete composition the model ever
 * sees — is a headline-plus-panel film. So the generator had a dozen kilobytes
 * of prose describing the studied films and no artefact built to match it, and
 * it pattern-matched the artefact.
 *
 * This is that artefact. It is deliberately plain HTML and CSS with no image
 * assets, so it can be read end to end, and every beat is annotated in
 * `timeline.js` with why it is shot the way it is.
 */
export const REFERENCE_FILM_DURATION = 20;

export const referenceFilmScenes: readonly SceneDefinition[] = [
  {
    id: "scene-01-claim",
    label: "01 · The claim, oversized",
    start: 0,
    duration: 3.6,
    accent: "#ee4b3c",
    tracks: [
      {
        id: "claim-line",
        label: "Opening statement",
        kind: "Text",
        start: 0.15,
        end: 3.5,
      },
      {
        id: "story-carrier",
        label: "Carrier · accent bar",
        kind: "Element",
        start: 0.9,
        end: 3.6,
      },
    ],
  },
  {
    id: "scene-02-import",
    label: "02 · The line completes itself",
    start: 3.6,
    duration: 3.8,
    accent: "#ee4b3c",
    tracks: [
      {
        id: "import-row",
        label: "Grow and complete",
        kind: "Text",
        start: 3.75,
        end: 7.3,
      },
      {
        id: "story-carrier",
        label: "Carrier · colour ground",
        kind: "Element",
        start: 3.2,
        end: 7.4,
      },
    ],
  },
  {
    id: "scene-03-styles",
    label: "03 · Objects with mass",
    start: 7.4,
    duration: 3.8,
    accent: "#c9351f",
    tracks: [
      {
        id: "style-chips",
        label: "Style options",
        kind: "Element",
        start: 7.75,
        end: 11.1,
      },
      {
        id: "camera-world",
        label: "Camera · settle onto the choice",
        kind: "Camera",
        start: 8.6,
        end: 10.2,
      },
    ],
  },
  {
    id: "scene-04-edit",
    label: "04 · The macro edit",
    start: 11.2,
    duration: 4.2,
    accent: "#0b0b0d",
    tracks: [
      {
        id: "macro-word",
        label: "Edited word",
        kind: "Text",
        start: 11.5,
        end: 15.2,
      },
      {
        id: "camera-world",
        label: "Camera · push all the way in",
        kind: "Camera",
        start: 11.2,
        end: 12.7,
      },
    ],
  },
  {
    id: "scene-05-brand",
    label: "05 · The brand",
    start: 15.4,
    duration: 4.6,
    accent: "#ee4b3c",
    tracks: [
      {
        id: "brand-lockup",
        label: "Mark and wordmark",
        kind: "Element",
        start: 15.55,
        end: 20,
      },
      {
        id: "camera-world",
        label: "Camera · pull back",
        kind: "Camera",
        start: 15,
        end: 16.4,
      },
    ],
  },
];

/**
 * The carrier chain, published so retrieval can show it alongside the source.
 * One element, five identities, crossing every boundary in the film.
 */
export const referenceFilmSeams = [
  {
    from: "scene-01-claim",
    to: "scene-02-import",
    at: 3.2,
    duration: 0.8,
    carrier: "story-carrier",
    mechanism: "morph" as const,
    becomes: "the accent bar floods out into the full-bleed colour ground",
  },
  {
    from: "scene-02-import",
    to: "scene-03-styles",
    at: 7.0,
    duration: 0.8,
    carrier: "story-carrier",
    mechanism: "morph" as const,
    becomes: "the colour ground contracts into the first style chip",
  },
  {
    from: "scene-03-styles",
    to: "scene-04-edit",
    at: 10.8,
    duration: 0.8,
    carrier: "story-carrier",
    mechanism: "morph" as const,
    becomes: "the chip stretches into the selection plate behind the word",
  },
  {
    from: "scene-04-edit",
    to: "scene-05-brand",
    at: 15.0,
    duration: 0.8,
    carrier: "story-carrier",
    mechanism: "morph" as const,
    becomes: "the selection plate floods out into the brand ground",
  },
];

function mountHtml(root: HTMLElement): void {
  const container = document.createElement("div");
  container.innerHTML = compositionHtml;
  const template = container.querySelector(
    "#motionly-composition-template",
  ) as HTMLTemplateElement | null;
  if (!template) throw new Error("Missing #motionly-composition-template");
  root.replaceChildren(template.content.cloneNode(true));
}

/**
 * `timeline.js` is authored as the generator authors one — calling the shared
 * preset helpers by bare name — so it is imported as source and run against the
 * same helper scope the compiler supplies, rather than duplicated as a module.
 */
function runTimeline(context: CompositionContext): void {
  const names = Object.keys(presets);
  // The same preparation the dynamic compiler gives a generated timeline, so
  // this preset executes through exactly the path a generated film does.
  const body = sanitizeTimelineScript(timelineSource);
  const factory = new Function(
    "context",
    "gsap",
    "presets",
    `const { ${names.join(", ")} } = presets;\n${body}\nreturn buildTimeline(context);`,
  );
  factory(
    context,
    (globalThis as { gsap?: unknown }).gsap,
    presets as unknown as Record<string, unknown>,
  );
}

export const referenceFilmPreset = defineComposition({
  id: "reference-standard-film",
  title: "Reference Standard · Text Becomes Motion",
  description:
    "The worked example for the reference standard: full-bleed colour grounds, statements that hold the frame alone at 118-132px, one carrier crossing all four boundaries as bar, ground, chip and plate, and three camera moves across five beats that all travel inward.",
  duration: REFERENCE_FILM_DURATION,
  fps: 60,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  sourcePreview: compositionHtml,
  scenes: referenceFilmScenes,
  build(context: CompositionContext) {
    mountHtml(context.root);
    runTimeline(context);
  },
});

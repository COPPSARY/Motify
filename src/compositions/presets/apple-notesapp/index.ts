import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import * as timelineModule from "./timeline.js";
import appleNotesLogoUrl from "./apple-notes.svg?url";
import noteSketchUrl from "./9c01cb4e40808bf2daaf2cf718464742.png?url";
import checklistAssetUrl from "./Checklist-in-iPhone-notes.jpg?url";

const sfFontBaseUrl = `${import.meta.env.BASE_URL}fonts/sf-pro-display/`;

const PLAYBACK_SCALE = 1.3;
export const APPLE_NOTES_PRESET_DURATION = 24.0 * PLAYBACK_SCALE;

const baseScenes: readonly SceneDefinition[] = [
  {
    id: "scene-01-scattered",
    label: "01 · A Thought Easy to Lose",
    start: 0,
    duration: 3.8,
    accent: "#0071e3",
    tracks: [
      {
        id: "notesBrandMark",
        label: "Apple Notes brand icon",
        kind: "Element",
        start: 0.1,
        end: 3.6,
      },
      {
        id: "notesIntroTitle",
        label: "Every useful idea starts…",
        kind: "Text",
        start: 0,
        end: 3.6,
      },
      {
        id: "notesBlueScribble",
        label: "Blue ink flourish",
        kind: "SVG",
        start: 0.7,
        end: 3.6,
      },
    ],
  },
  {
    id: "scene-02-fragments",
    label: "02 · Inputs Become One Capture",
    start: 3.6,
    duration: 4.0,
    accent: "#ff9f0a",
    tracks: [
      {
        id: "notesCaptureCard",
        label: "Quick Note carrier",
        kind: "Element",
        start: 3.7,
        end: 7.8,
      },
      {
        id: "notesSafariCard",
        label: "Safari research tab card",
        kind: "Element",
        start: 4.1,
        end: 6.8,
      },
      {
        id: "notesVoiceCard",
        label: "Voice Memo waveform card",
        kind: "Element",
        start: 4.3,
        end: 6.8,
      },
      {
        id: "notesPhotoCard1",
        label: "Whiteboard strategy card",
        kind: "Element",
        start: 4.5,
        end: 6.8,
      },
    ],
  },
  {
    id: "scene-03-three-pills",
    label: "03 · Notes Workspace Proof",
    start: 8.0,
    duration: 5.0,
    accent: "#ffd60a",
    tracks: [
      {
        id: "notesAppShell",
        label: "Full Apple Notes workspace",
        kind: "Element",
        start: 7.6,
        end: 13.0,
      },
      {
        id: "notesCursor",
        label: "macOS pointer action",
        kind: "Element",
        start: 9.8,
        end: 11.6,
      },
      {
        id: "notesCheckmarkIcon",
        label: "Checklist completion",
        kind: "Element",
        start: 10.4,
        end: 13.0,
      },
    ],
  },
  {
    id: "scene-04-ecosystem-sync",
    label: "04 · Available Everywhere",
    start: 14.0,
    duration: 4.2,
    accent: "#ff9f0a",
    tracks: [
      {
        id: "notesEcosystemStatement",
        label: "Write once, available everywhere",
        kind: "Text",
        start: 14.0,
        end: 18.2,
      },
    ],
  },
  {
    id: "scene-05-brand-resolve",
    label: "05 · Grand Climax: In One Place",
    start: 18.2,
    duration: 5.8,
    accent: "#ffd60a",
    tracks: [
      {
        id: "notesClimaxIcon",
        label: "Notes app icon",
        kind: "SVG",
        start: 18.2,
        end: 24.0,
      },
      {
        id: "notesClimaxTitle",
        label: "Everything worth keeping, in one place",
        kind: "Text",
        start: 18.6,
        end: 24.0,
      },
      {
        id: "notesClimaxTagline",
        label: "Open Notes CTA",
        kind: "Element",
        start: 19.4,
        end: 24.0,
      },
    ],
  },
];

const scenes: readonly SceneDefinition[] = baseScenes.map((scene) => ({
  ...scene,
  start: scene.start * PLAYBACK_SCALE,
  duration: scene.duration * PLAYBACK_SCALE,
  tracks: (scene.tracks ?? []).map((track) => ({
    ...track,
    start: track.start * PLAYBACK_SCALE,
    end: track.end * PLAYBACK_SCALE,
  })),
}));

function mountHtml(root: HTMLElement): void {
  const container = document.createElement("div");
  container.innerHTML = compositionHtml
    .replaceAll("__ASSET_NOTES_LOGO__", appleNotesLogoUrl)
    .replaceAll("__ASSET_NOTE_SKETCH__", noteSketchUrl)
    .replaceAll("__ASSET_CHECKLIST__", checklistAssetUrl)
    .replaceAll("__ASSET_SF_FONT_BASE__", sfFontBaseUrl);
  const template = container.querySelector(
    "#notes-preset-template",
  ) as HTMLTemplateElement | null;
  if (!template) throw new Error("Missing #notes-preset-template");
  root.replaceChildren(template.content.cloneNode(true));
}

export const appleNotesPreset = defineComposition({
  id: "apple-notes-product-film",
  title: "Apple Notes · Everything in One Place",
  description:
    "A spacious 31.2-second Apple Notes product story: scattered inputs converge into a full perspective Notes workspace, the same note moves across Mac, iPad, and iPhone, Apple Pencil completes the next action, and that completion becomes the app icon.",
  duration: APPLE_NOTES_PRESET_DURATION,
  fps: 60,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  sourcePreview: compositionHtml,
  scenes,
  build(context: CompositionContext) {
    mountHtml(context.root);
    timelineModule.buildAppleNotesTimeline(context);
  },
});

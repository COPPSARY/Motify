import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import * as timelineModule from "./timeline.js";
import kiriLogoUrl from "./Kiri-TTS Logo.svg?url";

const PLAYBACK_SCALE = 1.3;
export const KIRI_TTS_PRESET_DURATION = 28.5 * PLAYBACK_SCALE;

const baseScenes: readonly SceneDefinition[] = [
  {
    id: "act-01-linguistic",
    label: "01 · Khmer Should Sound Native",
    start: 0,
    duration: 5.5,
    accent: "#ef4444",
    tracks: [
      {
        id: "kiriCameraWorld",
        label: "Macro Camera Rig",
        kind: "Element",
        start: 0,
        end: 28.5,
      },
      {
        id: "kiriBeatIntroText",
        label: "Outcome-first Khmer voice statement",
        kind: "Text",
        start: 0.05,
        end: 1.85,
      },
      {
        id: "kiriBeatObstacleText",
        label: "Generic model obstacle statement",
        kind: "Text",
        start: 2.05,
        end: 3.2,
      },
      {
        id: "kiriBeatSolutionText",
        label: "Kiri native understanding statement",
        kind: "Text",
        start: 5.25,
        end: 6.4,
      },
      {
        id: "kiriMonolithicBox",
        label: "Monolithic Engine & Unspaced Script",
        kind: "Element",
        start: 0.35,
        end: 5.2,
      },
      {
        id: "kiriSegmentBeam",
        label: "Track-Matte Cyan Scanning Beam",
        kind: "Element",
        start: 2.38,
        end: 4.0,
      },
      {
        id: "kiriSegmentedWords",
        label: "Native Word Boundary Chips",
        kind: "Element",
        start: 2.9,
        end: 5.2,
      },
      {
        id: "kiriNativeSolvedBadge",
        label: "Native Segmentation Solved Badge",
        kind: "Element",
        start: 4.0,
        end: 5.2,
      },
    ],
  },
  {
    id: "act-02-tts",
    label: "02 · Expressive TTS & Line-by-Line Studio Composer",
    start: 5.5,
    duration: 6.5,
    accent: "#00D2FF",
    tracks: [
      {
        id: "kiriLineEditor",
        label: "Line Composer & Traveling Neon Beam",
        kind: "Element",
        start: 5.0,
        end: 11.6,
      },
      {
        id: "kiriTypedKhmer",
        label: "Native Khmer Script Real-time Typewriter",
        kind: "Text",
        start: 6.3,
        end: 11.6,
      },
      {
        id: "kiriEditorRow2",
        label: "Line 2 Instant Regeneration Feature",
        kind: "Element",
        start: 7.4,
        end: 11.6,
      },
      {
        id: "kiriStabilitySlider",
        label: "Stability & Speed Sliders Glide",
        kind: "Element",
        start: 8.0,
        end: 11.6,
      },
      {
        id: "kiriBtnGenerate",
        label: "Generate Speech Tactile Click",
        kind: "Element",
        start: 9.0,
        end: 11.6,
      },
      {
        id: "kiriAudioPlayerCard",
        label: "Blooming Audio Player & 12 EQ Bars",
        kind: "Element",
        start: 9.85,
        end: 11.6,
      },
    ],
  },
  {
    id: "act-03-stt",
    label: "03 · Diarized STT & Forced Alignment Subtitles",
    start: 12.0,
    duration: 6.5,
    accent: "#10B981",
    tracks: [
      {
        id: "kiriSttDropCard",
        label: "STT Studio Container",
        kind: "Element",
        start: 11.8,
        end: 18.0,
      },
      {
        id: "kiriDiarizeSpeaker1",
        label: "Speaker 1 Khmer Timestamps",
        kind: "Element",
        start: 12.4,
        end: 18.0,
      },
      {
        id: "kiriDiarizeSpeaker2",
        label: "Speaker 2 English Timestamps",
        kind: "Element",
        start: 14.5,
        end: 18.0,
      },
      {
        id: "kiriBtnExportSrt",
        label: "Export .SRT / .VTT Button & Click",
        kind: "Element",
        start: 16.0,
        end: 18.0,
      },
      {
        id: "kiriSrtSuccessBadge",
        label: "Emerald Subtitle Exported Banner",
        kind: "Element",
        start: 16.9,
        end: 18.0,
      },
    ],
  },
  {
    id: "act-04-clone-api",
    label: "04 · 10s Voice Cloning & OpenAI-Compatible REST API",
    start: 18.5,
    duration: 6.0,
    accent: "#00D2FF",
    tracks: [
      {
        id: "kiriCloneCard",
        label: "10s Reference Audio & Progress Ring",
        kind: "Element",
        start: 18.2,
        end: 24.0,
      },
      {
        id: "kiriVerifiedProfile",
        label: "Verified Profile: Bora Badge",
        kind: "Element",
        start: 20.35,
        end: 24.0,
      },
      {
        id: "kiriApiCard",
        label: "OpenAI REST API Endpoint Box",
        kind: "Element",
        start: 18.2,
        end: 24.0,
      },
      {
        id: "kiriLiveCounter",
        label: "Live Request Counter Surge",
        kind: "Text",
        start: 21.2,
        end: 24.0,
      },
    ],
  },
  {
    id: "act-05-climax",
    label: "05 · Native Voice Platform Resolve",
    start: 24.5,
    duration: 4.0,
    accent: "#FFFFFF",
    tracks: [
      {
        id: "kiriClimaxEmblem",
        label: "Geometric Emblem & Cyan Halo",
        kind: "Element",
        start: 24.3,
        end: 28.5,
      },
      {
        id: "kiriClimaxHeadline",
        label: "'Transform Text into Speech' Headline",
        kind: "Text",
        start: 24.7,
        end: 28.5,
      },
      {
        id: "kiriClimaxSubtitle",
        label: "Native Voice Platform Subtitle",
        kind: "Text",
        start: 25.1,
        end: 28.5,
      },
      {
        id: "kiriBtnGetStarted",
        label: "Get Started Pill with Light Shimmer",
        kind: "Element",
        start: 25.5,
        end: 28.5,
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
  container.innerHTML = compositionHtml.replaceAll(
    "__ASSET_KIRI_LOGO__",
    kiriLogoUrl,
  );
  const template = container.querySelector(
    "#kiritts-preset-template",
  ) as HTMLTemplateElement | null;
  if (!template) throw new Error("Missing #kiritts-preset-template");
  root.replaceChildren(template.content.cloneNode(true));
}

export const kiriTtsPreset = defineComposition({
  id: "kiritts-saas-ad",
  title: "KiriTTS · Native Khmer Voice Platform",
  description:
    "A spacious 37-second product story that begins with the desired outcome—Khmer speech that sounds native—then proves Kiri's word-boundary understanding through expressive TTS, exact subtitles, ten-second voice cloning, and an OpenAI-compatible API. Screen-space cursor targeting, perspective focus shots, zoom-throughs, and match-cut carriers connect all five acts.",
  duration: KIRI_TTS_PRESET_DURATION,
  fps: 60,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  sourcePreview: compositionHtml,
  scenes,
  build(context: CompositionContext) {
    mountHtml(context.root);
    timelineModule.buildKiriTtsTimeline(context);
  },
});

import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import { buildKiriTtsTimeline } from "./timeline.js";
import kiriLogoUrl from "./Kiri-TTS Logo.svg?url";

const sfFontBaseUrl = `${import.meta.env.BASE_URL}fonts/sf-pro-display/`;
const khmerFontBaseUrl = `${import.meta.env.BASE_URL}fonts/kantumruy-pro/`;

export const KIRI_TTS_PRESET_DURATION = 48;
export const kiriTtsScenes: readonly SceneDefinition[] = [
  {
    id: "hook",
    label: "01 / A TTS that speaks Khmer",
    start: 0,
    duration: 7,
    accent: "#ededf0",
  },
  {
    id: "intro",
    label: "02 / The mark",
    start: 7,
    duration: 3.5,
    accent: "#aaaab5",
  },
  {
    id: "tts",
    label: "03 / Script, voice, generate",
    start: 10.5,
    duration: 10,
    accent: "#aaaab5",
  },
  {
    id: "voices",
    label: "04 / Thirteen voices",
    start: 20.5,
    duration: 5.5,
    accent: "#f0a44a",
  },
  {
    id: "stt",
    label: "05 / Recording to transcript",
    start: 26,
    duration: 8,
    accent: "#b0bdd6",
  },
  {
    id: "export",
    label: "06 / Subtitle export",
    start: 34,
    duration: 4.5,
    accent: "#aaaab5",
  },
  {
    id: "features",
    label: "07 / One platform",
    start: 38.5,
    duration: 5.5,
    accent: "#aaaab5",
  },
  {
    id: "brand",
    label: "08 / Ready to build",
    start: 44,
    duration: 4,
    accent: "#ededf0",
  },
];

/** Editorial handoffs, all in final playback seconds. Each straddles its cut,
 * and the carrier is on screen on both sides of it. */
export const kiriTtsSeams = [
  {
    from: "hook",
    to: "intro",
    at: 6.3,
    duration: 1.4,
    carrier: "kiriBrandMark",
    mechanism: "PARTICLE-REASSEMBLE",
    becomes:
      "The English claim and the Khmer that completed it fracture together and collapse into the point the mark is already growing at.",
  },
  {
    from: "intro",
    to: "tts",
    at: 9.8,
    duration: 1.4,
    carrier: "kiriBrandMark",
    mechanism: "MORPH",
    becomes:
      "The original tile shrinks and docks into the flat editor header while the editor rises behind it.",
  },
  {
    from: "tts",
    to: "voices",
    at: 19.8,
    duration: 1.4,
    carrier: "kiriVoiceCarrier",
    mechanism: "MORPH",
    becomes:
      "The editor clears left; its waveform remains, then rises above the selected Maly profile and two readable alternatives.",
  },
  {
    from: "voices",
    to: "stt",
    at: 25.3,
    duration: 1.4,
    carrier: "kiriVoiceCarrier",
    mechanism: "MORPH",
    becomes:
      "The same surface contracts low into the frame, then opens into the Speech to Text upload target.",
  },
  {
    from: "stt",
    to: "export",
    at: 33.4,
    duration: 1.2,
    carrier: "kiriVoiceCarrier",
    mechanism: "MATCH-CUT",
    becomes:
      "The transcript holds its exact position and silhouette across the cut while its export controls rise inside it.",
  },
  {
    from: "export",
    to: "features",
    at: 37.9,
    duration: 1.2,
    carrier: "kiriBrandMark",
    mechanism: "PARTICLE-REASSEMBLE",
    becomes:
      "The five subtitle files converge on one point and the mark reassembles out of them, then rises as the camera retreats.",
  },
  {
    from: "features",
    to: "brand",
    at: 43.4,
    duration: 1.2,
    carrier: "kiriBrandMark",
    mechanism: "MATCH-CUT",
    becomes:
      "The browser read-aloud proof exits while the restored mark settles into the closing question.",
  },
] as const;

export const kiriTtsPreset = defineComposition({
  id: "kiritts-saas-ad",
  title: "KiriTTS / A TTS that speaks Khmer",
  description:
    "A 48-second product film: Khmer completes the opening claim, the mark docks into the speech editor, Maly is selected from thirteen voices, and text becomes audio. A recording becomes a three-speaker transcript and subtitle exports. Focused API and browser read-aloud proofs lead into the closing question.",
  duration: KIRI_TTS_PRESET_DURATION,
  fps: 60,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  sourcePreview: compositionHtml,
  scenes: kiriTtsScenes,
  build(context: CompositionContext) {
    const documentNode = new DOMParser().parseFromString(
      compositionHtml
        .replaceAll("__ASSET_KIRI_LOGO__", kiriLogoUrl)
        .replaceAll("__ASSET_SF_FONT_BASE__", sfFontBaseUrl)
        .replaceAll("__ASSET_KHMER_FONT_BASE__", khmerFontBaseUrl),
      "text/html",
    );
    const template = documentNode.querySelector<HTMLTemplateElement>(
      "#kiritts-preset-template",
    );
    if (!template) throw new Error("Missing KiriTTS composition template");
    context.root.replaceChildren(template.content.cloneNode(true));
    buildKiriTtsTimeline(context);
  },
});

import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import { buildRecoupTimeline } from "./timeline.js";

const sfFontBaseUrl = `${import.meta.env.BASE_URL}fonts/sf-pro-display/`;

export const RECOUP_PRESET_DURATION = 26;

export const recoupScenes: readonly SceneDefinition[] = [
  {
    id: "leak",
    label: "01 / A card declines",
    start: 0,
    duration: 4.2,
    accent: "#FF7A8F",
  },
  {
    id: "ledger",
    label: "02 / $7,410 at risk",
    start: 4.2,
    duration: 6.3,
    accent: "#FF7A8F",
  },
  {
    id: "pitch",
    label: "03 / So Recoup tries again",
    start: 10.5,
    duration: 1.9,
    accent: "#5BF0AE",
  },
  {
    id: "retry",
    label: "04 / Retried when it clears",
    start: 12.4,
    duration: 6.2,
    accent: "#5BF0AE",
  },
  {
    id: "result",
    label: "05 / 91.7% recovered",
    start: 18.6,
    duration: 3.8,
    accent: "#5BF0AE",
  },
  {
    id: "brand",
    label: "06 / Recoup",
    start: 22.4,
    duration: 3.6,
    accent: "#5BF0AE",
  },
];

/** Every seam straddles its cut and names the object that carries it. */
export const recoupSeams = [
  {
    from: "leak",
    to: "ledger",
    at: 3.6,
    duration: 1.2,
    carrier: "rcpCard",
    mechanism: "MATCH-CUT",
    becomes:
      "The camera is already dollying forward; the statement travels toward the lens on that same axis and defocuses as it passes, and the corridor of declined charges it emerges into is already arriving before the cut.",
  },
  {
    from: "ledger",
    to: "pitch",
    at: 9.9,
    duration: 1.2,
    carrier: "rcpCard",
    mechanism: "MORPH",
    becomes:
      "The carrier takes the other three charges' mass along z, then keeps travelling back into depth so the pitch frame belongs to the statement alone.",
  },
  {
    from: "pitch",
    to: "retry",
    at: 11.8,
    duration: 1.3,
    carrier: "rcpCard",
    mechanism: "MORPH",
    becomes:
      "The statement passes the lens as the carrier returns from depth and turns 180 degrees on Y. The retry schedule is running on the face that turns toward the viewer.",
  },
  {
    from: "retry",
    to: "result",
    at: 17.95,
    duration: 1.3,
    carrier: "rcpCard",
    mechanism: "MORPH",
    becomes:
      "The recovered charge's outline opens into the month it belongs to while the camera pulls back and begins its orbit.",
  },
  {
    from: "result",
    to: "brand",
    at: 21.8,
    duration: 1.2,
    carrier: "rcpCard",
    mechanism: "MORPH",
    becomes:
      "The panel tips away on X and the mark tips in on the same axis, so the brand is the carrier's last state rather than a new object dropped over it.",
  },
] as const;

export const recoupPreset = defineComposition({
  id: "recoup-failed-payments",
  title: "Recoup / Stop losing revenue you already earned",
  description:
    "A 26-second liquid-glass SaaS product ad for a fictional failed-payment recovery tool, shot on a real 3D camera. Statements own their own frames and the interface owns its own — never both at once. Nordvik Studio's account goes Active, Past due, Suspended over fourteen unpaid days, then back to Active on the frame a third retry clears. Translucent panes at authored depths from z 120 to z -1750 slide their highlights over a floor grid that makes every camera move legible. Real rows, real decline reasons, arithmetic that agrees with itself.",
  duration: RECOUP_PRESET_DURATION,
  fps: 60,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  sourcePreview: compositionHtml,
  scenes: recoupScenes,
  build(context: CompositionContext) {
    const documentNode = new DOMParser().parseFromString(
      compositionHtml.replaceAll("__ASSET_SF_FONT_BASE__", sfFontBaseUrl),
      "text/html",
    );
    const template = documentNode.querySelector<HTMLTemplateElement>(
      "#recoup-preset-template",
    );
    if (!template) throw new Error("Missing Recoup composition template");
    context.root.replaceChildren(template.content.cloneNode(true));
    buildRecoupTimeline(context);
  },
});

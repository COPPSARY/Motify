import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import { buildTesseraTimeline } from "./timeline.js";

const sfFontBaseUrl = `${import.meta.env.BASE_URL}fonts/sf-pro-display/`;

export const TESSERA_PRESET_DURATION = 20;

export const tesseraScenes: readonly SceneDefinition[] = [
  {
    id: "claim",
    label: "01 / Every source, a different shape",
    start: 0,
    duration: 4.5,
    accent: "#17171a",
  },
  {
    id: "stream",
    label: "02 / The corridor",
    start: 4.5,
    duration: 4.5,
    accent: "#6f6f78",
  },
  {
    id: "gate",
    label: "03 / Through the contract",
    start: 9,
    duration: 5,
    accent: "#4f46e5",
  },
  {
    id: "shape",
    label: "04 / One shape",
    start: 14,
    duration: 3.5,
    accent: "#4f46e5",
  },
  {
    id: "brand",
    label: "05 / Tessera",
    start: 17.5,
    duration: 2.5,
    accent: "#17171a",
  },
];

/** Every seam straddles its cut and names the object that carries it. */
export const tesseraSeams = [
  {
    from: "claim",
    to: "stream",
    at: 3.9,
    duration: 1.2,
    carrier: "tessRecordOne",
    mechanism: "MATCH-CUT",
    becomes:
      "The camera is already travelling forward; the claim recedes on that same axis and the corridor it recedes into is the next beat's material.",
  },
  {
    from: "stream",
    to: "gate",
    at: 8.4,
    duration: 1.2,
    carrier: "tessRecordOne",
    mechanism: "MATCH-CUT",
    becomes:
      "The forward travel continues unbroken while the gate resolves out of the depth ahead of the records still flying toward it.",
  },
  {
    from: "gate",
    to: "shape",
    at: 13.4,
    duration: 1.2,
    carrier: "tessRecordOne",
    mechanism: "MORPH",
    becomes:
      "The last crossed record settles into its reserved output slot and the gate, with nothing left to process, opens out and clears the frame.",
  },
  {
    from: "shape",
    to: "brand",
    at: 16.9,
    duration: 1.3,
    carrier: "tessBrandMark",
    mechanism: "PARTICLE-REASSEMBLE",
    becomes:
      "The five aligned records converge on one point and the mark's four tiles land out of them.",
  },
] as const;

export const tesseraPreset = defineComposition({
  id: "tessera-data-contract",
  title: "Tessera / Every source, one shape",
  description:
    "A 20-second transformation film with no application shell in it: records from eight systems fly a corridor toward the camera in eight different shapes, each resolves its own field names, values and formats to one contract at the instant it crosses a gate, the five that carry real data settle into a fully visible three-over-two comparison, and they converge to build the mark.",
  duration: TESSERA_PRESET_DURATION,
  fps: 60,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  sourcePreview: compositionHtml,
  scenes: tesseraScenes,
  build(context: CompositionContext) {
    const documentNode = new DOMParser().parseFromString(
      compositionHtml.replaceAll("__ASSET_SF_FONT_BASE__", sfFontBaseUrl),
      "text/html",
    );
    const template = documentNode.querySelector<HTMLTemplateElement>(
      "#tessera-preset-template",
    );
    if (!template) throw new Error("Missing Tessera composition template");
    context.root.replaceChildren(template.content.cloneNode(true));
    buildTesseraTimeline(context);
  },
});

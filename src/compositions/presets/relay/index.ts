import {
  defineComposition,
  type CompositionContext,
} from "../../../composition/types";
import html from "./composition.html?raw";
import { buildRelayTimeline } from "./timeline.js";

export const relayScenes = [
  {
    id: "problem",
    label: "01 / Feedback everywhere",
    start: 0,
    duration: 4,
    accent: "#e46047",
  },
  {
    id: "review",
    label: "02 / One review",
    start: 4,
    duration: 6,
    accent: "#253749",
  },
  {
    id: "approve",
    label: "03 / Everyone aligned",
    start: 10,
    duration: 5,
    accent: "#248374",
  },
  {
    id: "handoff",
    label: "04 / Move it forward",
    start: 15,
    duration: 6,
    accent: "#e46047",
  },
  {
    id: "brand",
    label: "05 / From feedback to finished",
    start: 21,
    duration: 5,
    accent: "#e46047",
  },
];
export const relayPreset = defineComposition({
  id: "relay-review-handoff",
  title: "Relay / From feedback to finished",
  description:
    "A 26-second concept film for a fictional review-and-handoff tool. Warm paper, coral, restrained 2.5D and a lateral camera journey: scattered feedback becomes an approved brief, folds into a packet and reaches the next person. The same brief carries the entire story.",
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 26,
  aspectRatio: "16:9",
  scenes: relayScenes,
  sourcePreview: html,
  build(context: CompositionContext) {
    const doc = new DOMParser().parseFromString(
      html.replaceAll(
        "__ASSET_SF_FONT_BASE__",
        `${import.meta.env.BASE_URL}fonts/sf-pro-display/`,
      ),
      "text/html",
    );
    const template = doc.querySelector<HTMLTemplateElement>(
      "#relay-preset-template",
    );
    if (!template) throw new Error("Missing Relay template");
    context.root.replaceChildren(template.content.cloneNode(true));
    buildRelayTimeline(context);
  },
});

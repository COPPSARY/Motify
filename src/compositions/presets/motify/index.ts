import { defineComposition } from "../../../composition/types";
import { hydratePresetAssets } from "../../preset-assets";
import compositionHtml from "./composition.html?raw";
import compositionStyles from "./styles.css?raw";
import { buildTimeline } from "./timeline.js";

const compositionSource = hydratePresetAssets(
  compositionHtml.replace(
    /(<template\b[^>]*>)/i,
    `$1<style>\n${compositionStyles}\n</style>`,
  ),
);

// The local CLI reads this JSON literal without executing project code.
// prettier-ignore
export const motionlyMetadata = {"id":"motionly-launch","title":"Motify — Launch Film","description":"SaaS launch film for Motify: from product idea to launch-ready video.","width":1920,"height":1080,"fps":60,"duration":52,"scenes":[{"id":"hook","label":"Hook","start":0,"duration":4.2,"accent":"#7cf7c5"},{"id":"problem","label":"The problem","start":4.2,"duration":6,"accent":"#ff7a59"},{"id":"meet","label":"Meet Motify","start":10.2,"duration":2.5,"accent":"#7cf7c5"},{"id":"prompt","label":"Describe your idea","start":12.7,"duration":3.5,"accent":"#7cf7c5"},{"id":"pipeline","label":"An idea becomes a production","start":16.2,"duration":6.3,"accent":"#7cf7c5"},{"id":"ask","label":"Just ask","start":22.5,"duration":6.7,"accent":"#7cf7c5"},{"id":"tweak","label":"Or tweak it yourself","start":29.2,"duration":6.95,"accent":"#8ab4ff"},{"id":"usecases","label":"Made with Motify","start":36.15,"duration":8.9,"accent":"#7cf7c5"},{"id":"final","label":"Motify","start":45.05,"duration":6.95,"accent":"#7cf7c5"}]} as const;

export const motifyPreset = defineComposition({
  ...motionlyMetadata,
  sourcePreview: compositionSource,
  build(context) {
    const documentNode = new DOMParser().parseFromString(
      compositionSource,
      "text/html",
    );
    const template = documentNode.querySelector("#starter-template");
    if (!(template instanceof HTMLTemplateElement))
      throw new Error("Starter template was not found.");
    context.root.replaceChildren(template.content.cloneNode(true));
    buildTimeline(context);
  },
});

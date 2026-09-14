import { defineComposition } from "@motionly/runtime";
import compositionHtml from "./composition.html?raw";
import compositionStyles from "./styles.css?raw";
import { buildTimeline } from "./timeline.js";

const compositionSource = compositionHtml.replace(
  /(<template\b[^>]*>)/i,
  `$1<style>\n${compositionStyles}\n</style>`,
);

// The local CLI reads this JSON literal without executing project code.
// prettier-ignore
export const motionlyMetadata = {"id":"starter","title":"{{name}}","description":"HTML/CSS composition with a caller-owned GSAP timeline.","width":1920,"height":1080,"fps":60,"duration":6,"scenes":[{"id":"hero","label":"Promise","start":0,"duration":3,"accent":"#d8ff55"},{"id":"proof","label":"Proof","start":3,"duration":3,"accent":"#8b6cff"}]} as const;

export default defineComposition({
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

import type { FootageCaptionAnimation, FootageCaptionStyle } from "./edit";
import type { FootageFormat } from "./edit";

/** The caption looks the start page offers, each a style with the motion that suits it. */
export const CAPTION_LOOKS: ReadonlyArray<{
  value: string;
  label: string;
  style: FootageCaptionStyle;
  animation: FootageCaptionAnimation;
}> = [
  { value: "stack", label: "Stacked", style: "stack", animation: "blur" },
  { value: "bold", label: "Bold", style: "bold", animation: "words" },
  { value: "box", label: "Boxed", style: "box", animation: "pop" },
  { value: "clean", label: "Clean", style: "clean", animation: "fade" },
  { value: "serif", label: "Serif", style: "serif", animation: "fade" },
  { value: "minimal", label: "Minimal", style: "minimal", animation: "fade" },
];

/** A caption look as the cut asks for it: the JSON the editor's caption look rule reads. */
export function captionLookJson(value: string): string {
  const look = CAPTION_LOOKS.find((item) => item.value === value);
  return look
    ? JSON.stringify({ style: look.style, animation: look.animation })
    : "";
}

/**
 * Where a video can start from: a full brief the AI reads well, the caption
 * look that suits it and, where it matters, the shape. Picking one fills the
 * brief, which the person can still rewrite.
 */
export const FOOTAGE_PRESETS: ReadonlyArray<{
  label: string;
  hint: string;
  brief: string;
  captions: string;
  format?: FootageFormat;
}> = [
  {
    label: "Talking head",
    hint: "One person talking to camera: tight cuts, stacked captions, a few graphics",
    brief:
      "A talking-head video from my clips. Cut my pauses, mistakes and repeats so it moves fast. Show what I talk about on screen where it helps, using my pictures first. Give the key numbers, steps or claims a motion graphic, and end with a clear call to action.",
    captions: "stack",
    format: "9:16",
  },
  {
    label: "Studio explainer",
    hint: "Like a YouTube creator: graphics and charts take the screen while you talk in a bubble",
    brief:
      "Cut it as a studio explainer, like a YouTube creator. On my key points, graphics and charts take the screen while I keep talking in a round bubble, and steps build as a checklist. Cut my pauses and mistakes.",
    captions: "stack",
  },
  {
    label: "Paper documentary",
    hint: "Vox style: pictures as prints on paper, quotes and dates as paper graphics",
    brief:
      "Make it a paper documentary in the Vox style. My talk narrates while my pictures and footage appear as prints on textured paper, with paper graphics for the key quotes, dates and numbers.",
    captions: "serif",
  },
  {
    label: "Shop promo",
    hint: "A shop, a menu or a product: the best shots, the price, how to order",
    brief:
      "A 30-second promotional video for my shop. Open with the best shot, keep any talking short, show the price, and end with how to order.",
    captions: "bold",
  },
  {
    label: "Product launch",
    hint: "The problem, the product in use, three features, the price",
    brief:
      "Introduce our new product in 30 seconds: the problem, the product in use, three key features, the price, and a call to action.",
    captions: "box",
  },
];

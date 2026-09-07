import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import * as timelineModule from "./timeline.js";
import claudeLogoUrl from "./claude-color.svg?url";
import ramenDishUrl from "./ramen_dish.jpg?url";
import blueSkyUrl from "./blue_sky.jpg?url";

export const CLAUDE_PRESET_DURATION = 24.5;

const scenes: readonly SceneDefinition[] = [
  {
    id: "scene-01-calorie-inquiry",
    label: "01 · Construction, Image Drop & Calorie Breakdown (0–7.8s)",
    start: 0,
    duration: 7.8,
    accent: "#e0683b",
    tracks: [
      {
        id: "claudeCameraWorld",
        label: "Macro Dynamic Camera Rig",
        kind: "Element",
        start: 0,
        end: 24.5,
      },
      {
        id: "claudeSidebar",
        label: "Left Sidebar & 1-by-1 Icon Pop",
        kind: "Element",
        start: 0.08,
        end: 2.4,
      },
      {
        id: "claudePromptShell",
        label: "Prompt Box & Traveling Glow Beam",
        kind: "Element",
        start: 0.38,
        end: 5.5,
      },
      {
        id: "claudeDraggedImage",
        label: "Image Drag & Clean Dock",
        kind: "Element",
        start: 1.2,
        end: 2.4,
      },
      {
        id: "claudeAttachedChip",
        label: "Attached Big Thumbnail (Clean)",
        kind: "Element",
        start: 2.25,
        end: 5.5,
      },
      {
        id: "claudeTypedInput",
        label: "Calorie Typing (Post 0.5s Pause)",
        kind: "Text",
        start: 3.2,
        end: 4.45,
      },
      {
        id: "claudeBtnSend",
        label: "Send Button Macro Click",
        kind: "Element",
        start: 4.45,
        end: 5.05,
      },
      {
        id: "claudeUserMessagePill",
        label: "User Question Bubble",
        kind: "Element",
        start: 5.05,
        end: 7.8,
      },
      {
        id: "claudeResponseText",
        label: "Claude Thought Headline",
        kind: "Text",
        start: 5.25,
        end: 7.8,
      },
      {
        id: "claudeArtifactCard",
        label: "Calorie Card & Breakdown Lines",
        kind: "Element",
        start: 5.5,
        end: 7.8,
      },
      {
        id: "claudeBottomChatBar1",
        label: "Bottom Floating Chat Bar",
        kind: "Element",
        start: 5.7,
        end: 7.8,
      },
    ],
  },
  {
    id: "scene-02-newchat-imagegen",
    label:
      "02 · Sidebar, 'Create Image', Standalone Thinking & 8K Blue Sky (7.8–17.8s)",
    start: 7.8,
    duration: 10.0,
    accent: "#f59e0b",
    tracks: [
      {
        id: "claudeSideBtnNew",
        label: "Sidebar '+ New' Button Click",
        kind: "Element",
        start: 7.8,
        end: 9.6,
      },
      {
        id: "claudePlusDropdown",
        label: "Plus Menu & 'Create Image' Selection",
        kind: "Element",
        start: 9.6,
        end: 11.85,
      },
      {
        id: "claudeTypedInput2",
        label: "'Create an image of a blue sky' Typing",
        kind: "Text",
        start: 11.85,
        end: 13.5,
      },
      {
        id: "claudeThinkingPill",
        label: "Standalone Centered Thinking Pill (Alone)",
        kind: "Element",
        start: 13.5,
        end: 15.0,
      },
      {
        id: "claudeSkyResponse",
        label: "Claude Response & Headline",
        kind: "Text",
        start: 15.0,
        end: 17.8,
      },
      {
        id: "claudeSkyCard",
        label: "Photorealistic 8K Blue Sky Card (Proud Hold)",
        kind: "Element",
        start: 15.0,
        end: 17.8,
      },
      {
        id: "claudeBottomChatBar2",
        label: "Bottom Floating Chat Bar",
        kind: "Element",
        start: 15.0,
        end: 17.8,
      },
    ],
  },
  {
    id: "scene-03-claude-mobile",
    label: "03 · Claude Mobile Showcase & Active User Interaction (17.8–22.0s)",
    start: 17.8,
    duration: 4.2,
    accent: "#3b82f6",
    tracks: [
      {
        id: "claudeMobileShowcase",
        label: "Smartphone 2.5D Rise & Framing",
        kind: "Element",
        start: 17.8,
        end: 22.0,
      },
      {
        id: "claudeMobileCard",
        label: "Synchronized Blue Sky Mobile Card",
        kind: "Element",
        start: 17.8,
        end: 22.0,
      },
      {
        id: "claudeMobileTyping",
        label: "'Explain atmospheric lighting' Mobile Typing",
        kind: "Text",
        start: 19.3,
        end: 20.5,
      },
      {
        id: "claudeMobileUserRow2",
        label: "New Message Bubble Pop & Rayleigh Analysis",
        kind: "Element",
        start: 20.55,
        end: 22.0,
      },
    ],
  },
  {
    id: "scene-04-climax",
    label: "04 · Optical Zoom-Out Climax: 'Claude is everywhere.' (22.0–24.5s)",
    start: 22.0,
    duration: 2.5,
    accent: "#e0683b",
    tracks: [
      {
        id: "claudeClimaxSequence",
        label: "Climax Root Container",
        kind: "Element",
        start: 22.0,
        end: 24.5,
      },
      {
        id: "claudeClimaxPrefix",
        label: "Deep Zoom on 'Claude is'",
        kind: "Element",
        start: 22.0,
        end: 24.5,
      },
      {
        id: "claudeClimaxEverywhere",
        label: "Super-Fast Zoom-Out & 'everywhere.'",
        kind: "Text",
        start: 22.35,
        end: 24.5,
      },
    ],
  },
];

function mountHtml(root: HTMLElement): void {
  const container = document.createElement("div");
  container.innerHTML = compositionHtml
    .replaceAll("__ASSET_CLAUDE_LOGO__", claudeLogoUrl)
    .replaceAll("__ASSET_RAMEN_DISH__", ramenDishUrl)
    .replaceAll("__ASSET_BLUE_SKY__", blueSkyUrl);
  const template = container.querySelector(
    "#claude-preset-template",
  ) as HTMLTemplateElement | null;
  if (!template) throw new Error("Missing #claude-preset-template");
  root.replaceChildren(template.content.cloneNode(true));
}

export const claudePreset = defineComposition({
  id: "claude-drag-drop",
  title: "Claude · UI Construction, Image Generation & Climax",
  description:
    "An 18.0s two-act cinematic motion film: architectural UI construction with 1-by-1 icon pop, clean image drop with traveling border beam (no blurred duplicate or orange hover veil), 0.5s pause with image+caret dead-centered, typing follow pan, smooth calorie breakdown slide-up, continuous pan into sidebar to click New Chat, plus dropdown to select 'Create image', stepped typing for 'Create an image of a blue sky', dynamic thinking pill with cycling verbs, photorealistic 8K blue sky reveal, and a grand optical camera zoom-out (slow then super fast) pulling back glowing background and text together before 'everywhere.' slides up.",
  duration: CLAUDE_PRESET_DURATION,
  fps: 60,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  sourcePreview: compositionHtml,
  scenes,
  build(context: CompositionContext) {
    mountHtml(context.root);
    timelineModule.buildClaudeTimeline(context);
  },
});

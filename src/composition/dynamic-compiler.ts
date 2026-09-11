import gsap from "gsap";
import * as presets from "./presets";
import { mountSceneKit } from "./scene-kit";
import type {
  CompositionContext,
  CompositionDefinition,
  SceneDefinition,
} from "./types";

export interface DynamicCompositionOptions {
  id?: string;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  scenes?: readonly SceneDefinition[];
}

/**
 * Strips ES module import/export declarations so the code can execute
 * in a dynamic Function runner in the browser.
 */
export function sanitizeTimelineScript(script: string): string {
  let cleaned = script.trim();
  // Strip markdown code fences if model returned them
  cleaned = cleaned
    .replace(/^```(?:javascript|js|ts)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return cleaned
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/export\s+function\s+/g, "function ")
    .replace(/export\s+(const|let|var)\s+/g, "$1 ")
    .trim();
}

/**
 * Which declaration is the timeline entry point.
 *
 * `buildTimeline` is the contract, so an exact match wins outright. Matching
 * merely on "timeline" appearing in a name picked the first such declaration in
 * the file, which for a composition carrying a helper — `animateTimelineCamera`,
 * `timelineLabels` — meant the runner invoked the helper with the composition
 * context and never ran the real timeline: the stage mounted and nothing moved.
 */
export function extractTimelineFunctionName(script: string): string {
  if (
    /(?:function\s+buildTimeline\s*\(|(?:const|let|var)\s+buildTimeline\s*=)/.test(
      script,
    )
  ) {
    return "buildTimeline";
  }
  const match =
    /function\s+(build[A-Za-z0-9_$]*[Tt]imeline[A-Za-z0-9_$]*)\s*\(/.exec(
      script,
    ) ||
    /(?:const|let|var)\s+(build[A-Za-z0-9_$]*[Tt]imeline[A-Za-z0-9_$]*)\s*=/.exec(
      script,
    ) ||
    /function\s+([A-Za-z0-9_$]*timeline[A-Za-z0-9_$]*)\s*\(/i.exec(script) ||
    /(?:const|let|var)\s+([A-Za-z0-9_$]*timeline[A-Za-z0-9_$]*)\s*=/i.exec(
      script,
    ) ||
    /function\s+([A-Za-z0-9_$]+)/.exec(script) ||
    /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/i.exec(script);
  return match?.[1] ?? "buildTimeline";
}

/**
 * Compiles raw HTML and GSAP timeline script into an active, runnable CompositionDefinition
 * directly in the browser DOM with zero backend or build-step dependencies.
 */
export function createDynamicComposition(
  compositionHtml: string,
  timelineJs: string,
  options: DynamicCompositionOptions = {},
): CompositionDefinition {
  const id = options.id ?? `dynamic-comp-${Date.now()}`;
  const title = options.title ?? "AI Generated Composition";
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const fps = options.fps ?? 60;
  let duration = options.duration ?? 18.0;

  const sanitizedJs = sanitizeTimelineScript(timelineJs);
  const fnName = extractTimelineFunctionName(sanitizedJs);

  const defaultScenes: SceneDefinition[] = [
    {
      id: "scene-01",
      label: "01 · Scene",
      start: 0,
      duration,
      accent: "#6366f1",
    },
  ];

  const scenes =
    options.scenes && options.scenes.length > 0
      ? options.scenes
      : defaultScenes;

  return {
    id,
    title,
    description: options.description ?? "Dynamic AI-generated composition.",
    width,
    height,
    fps,
    duration,
    scenes,
    sourcePreview: compositionHtml,
    build(context: CompositionContext) {
      // 1. Mount the HTML source into context.root
      const doc = new DOMParser().parseFromString(compositionHtml, "text/html");
      const template = doc.querySelector("template");
      if (template) {
        context.root.replaceChildren(template.content.cloneNode(true));
      } else {
        const wrapper =
          doc.querySelector(
            ".firstwave-promo, .hard-video-scene, .motionly-promo",
          ) ?? doc.body.firstElementChild;
        if (wrapper) {
          context.root.replaceChildren(wrapper.cloneNode(true));
        } else {
          context.root.innerHTML = compositionHtml;
        }
      }

      // The scene kit rides inside the root so export sees it too. Mounted
      // after the markup and before registration: it carries no data-edit ids,
      // so the editor and the validator treat the film exactly as authored.
      // Only for films that use it — every kit class and icon is `mk-` — so an
      // authored preset mounts exactly as it did before the kit existed, without
      // a stylesheet it never references weighing on every style recalculation.
      if (compositionHtml.includes("mk-")) mountSceneKit(context.root);

      // 2. Register all data-edit elements automatically
      context.root
        .querySelectorAll<HTMLElement>("[data-edit]")
        .forEach((el) => {
          const editId = el.dataset["edit"];
          if (editId) context.register(editId, el);
        });

      // 3. Execute the timeline choreography with context.root / context.element compatibility
      try {
        const presetVarNames = Object.keys(presets).join(", ");
        const runner = new Function(
          "context",
          "gsap",
          "presets",
          `
          const { ${presetVarNames} } = presets;
          ${sanitizedJs};

          if (typeof ${fnName} === "function") {
            ${fnName}(context);
          } else if (typeof buildTimeline === "function") {
            buildTimeline(context);
          } else if (typeof buildFirstwaveTimeline === "function") {
            buildFirstwaveTimeline(context);
          }
        `,
        );
        runner(context, gsap, presets);
      } catch (err) {
        console.error("Error executing dynamic timeline JS:", err);
        throw err;
      }

      // 4. Keep registration explicit. Arbitrary class/id/tween-target
      // registration makes nested decorative nodes steal canvas selection.

      // 5. If the timeline duration is longer than default, expand it
      const actualDuration = context.timeline.duration();
      if (actualDuration > 0 && actualDuration > duration) {
        duration = actualDuration;
      }
    },
  };
}

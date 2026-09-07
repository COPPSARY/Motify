import { createDynamicComposition } from "../composition/dynamic-compiler";
import { CompositionRuntime } from "../composition/runtime";
import type { SceneDefinition } from "../composition/types";
import type { DirectAiResult } from "./direct-ai";

const STRUCTURAL_REQUEST =
  /\b(add|insert|remove|delete|reorder|replace|redesign|rebuild)\b[\s\S]{0,30}\b(scene|timeline|composition|entire|whole)\b|\b(change|extend|shorten|set)\b[\s\S]{0,24}\b(duration|length|timing)\b/i;

function editIds(source: string): Set<string> {
  const documentNode = new DOMParser().parseFromString(source, "text/html");
  const template = documentNode.querySelector("template");
  const scope: ParentNode = template?.content ?? documentNode;
  return new Set(
    Array.from(scope.querySelectorAll<HTMLElement>("[data-edit]"))
      .map((element) => element.dataset["edit"]?.trim() ?? "")
      .filter(Boolean),
  );
}

function normalizedScenes(
  result: DirectAiResult,
  previousScenes: readonly SceneDefinition[],
  allowStructuralChange: boolean,
): readonly SceneDefinition[] {
  if (!allowStructuralChange && previousScenes.length > 0)
    return previousScenes;
  return result.scenes?.length ? result.scenes : previousScenes;
}

export interface ValidatedGeneration {
  result: DirectAiResult;
  duration: number;
  scenes: readonly SceneDefinition[];
}

export function validateGeneratedComposition(
  result: DirectAiResult,
  options: {
    prompt: string;
    previousHtml: string;
    previousDuration: number;
    previousScenes: readonly SceneDefinition[];
    requiredAssetTokens?: readonly string[];
  },
): ValidatedGeneration {
  const allowStructuralChange = STRUCTURAL_REQUEST.test(options.prompt);
  const previousIds = editIds(options.previousHtml);
  const nextIds = editIds(result.compositionHtml);
  if (nextIds.size === 0) {
    throw new Error("AI composition has no explicit data-edit layers.");
  }
  if (!allowStructuralChange) {
    const missing = [...previousIds].filter((id) => !nextIds.has(id));
    if (missing.length > 0) {
      throw new Error(
        `AI edit removed protected editable layers: ${missing.slice(0, 8).join(", ")}.`,
      );
    }
  }

  const missingAssets = (options.requiredAssetTokens ?? []).filter(
    (token) => !result.compositionHtml.includes(token),
  );
  if (missingAssets.length > 0) {
    throw new Error(
      `AI did not use ${missingAssets.length} attached image${missingAssets.length === 1 ? "" : "s"}.`,
    );
  }

  const requestedDuration = Number(result.duration);
  const duration =
    allowStructuralChange && Number.isFinite(requestedDuration)
      ? requestedDuration
      : options.previousDuration;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 300) {
    throw new Error("AI returned an invalid composition duration.");
  }
  const scenes = normalizedScenes(
    result,
    options.previousScenes,
    allowStructuralChange,
  );
  for (const scene of scenes) {
    if (
      !Number.isFinite(scene.start) ||
      !Number.isFinite(scene.duration) ||
      scene.start < 0 ||
      scene.duration <= 0 ||
      scene.start + scene.duration > duration + 1 / 30
    ) {
      throw new Error(
        `Scene ${scene.id} falls outside the composition duration.`,
      );
    }
  }

  const composition = createDynamicComposition(
    result.compositionHtml,
    result.timelineJs,
    { title: result.title, duration, scenes },
  );
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;left:-100000px;top:-100000px;width:1920px;height:1080px";
  document.body.append(root);
  let runtime: CompositionRuntime | null = null;
  try {
    runtime = new CompositionRuntime(composition, root);
    const actualDuration = runtime.timeline.duration();
    if (!Number.isFinite(actualDuration) || actualDuration <= 0) {
      throw new Error("AI timeline has no finite playable duration.");
    }
    if (actualDuration > duration + 1 / composition.fps) {
      throw new Error(
        `AI timeline duration ${actualDuration.toFixed(2)}s exceeds the ${duration.toFixed(2)}s composition.`,
      );
    }
    const proofTimes = new Set([0, duration]);
    for (const scene of scenes) {
      proofTimes.add(scene.start);
      proofTimes.add(Math.min(duration, scene.start + scene.duration));
    }
    for (const time of proofTimes) runtime.seek(time);
  } finally {
    runtime?.destroy();
    root.remove();
  }
  return { result, duration, scenes };
}

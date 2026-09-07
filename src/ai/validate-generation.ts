import { createDynamicComposition } from "../composition/dynamic-compiler";
import { CompositionRuntime } from "../composition/runtime";
import type { SceneDefinition } from "../composition/types";
import type { DirectAiResult } from "./direct-ai";

const STRUCTURAL_REQUEST =
  /\b(add|insert|remove|delete|reorder|replace|redesign|rebuild)\b[\s\S]{0,30}\b(scene|timeline|composition|entire|whole)\b|\b(change|extend|shorten|set)\b[\s\S]{0,24}\b(duration|length|timing)\b/i;

/** Executable carrier handoffs. Opacity is not one of them. */
const PHYSICAL_HANDOFF =
  /\b(?:morph|matchCut|cutTheCurve|zoomThrough|inverseZoomThrough|particleReassemble)\s*\(/g;

function isVisiblyRendered(element: HTMLElement, root: HTMLElement): boolean {
  for (
    let current: HTMLElement | null = element;
    current && current !== root;
    current = current.parentElement
  ) {
    const style = getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity || "1") <= 0.02
    ) {
      return false;
    }
  }
  return true;
}

function hasMeaningfulContent(element: HTMLElement): boolean {
  if (["IMG", "SVG", "VIDEO", "CANVAS"].includes(element.tagName)) return true;
  if ((element.textContent ?? "").trim().length >= 2) return true;
  const id = element.dataset["edit"]?.toLowerCase() ?? "";
  return Boolean(id && !/^(stage|camera-world|world|background)$/.test(id));
}

function visibleElements(
  root: HTMLElement,
  rootRect: DOMRect,
  hasLayout: boolean,
): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("*"))
    .filter((element) => hasMeaningfulContent(element))
    .filter((element) => isVisiblyRendered(element, root))
    .filter((element) => {
      if (!hasLayout) return true;
      const rect = element.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return false;
      return (
        rect.right > rootRect.left &&
        rect.left < rootRect.right &&
        rect.bottom > rootRect.top &&
        rect.top < rootRect.bottom
      );
    });
}

/** Leaf elements that own their own visible text run. */
function textLeaves(elements: readonly HTMLElement[]): HTMLElement[] {
  return elements.filter((element) => {
    const text = (element.textContent ?? "").trim();
    if (text.length < 3) return false;
    return !Array.from(element.children).some(
      (child) => (child.textContent ?? "").trim().length > 0,
    );
  });
}

function overlapRatio(first: DOMRect, second: DOMRect): number {
  const width = Math.max(
    0,
    Math.min(first.right, second.right) - Math.max(first.left, second.left),
  );
  const height = Math.max(
    0,
    Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
  );
  const smallerArea = Math.max(
    1,
    Math.min(first.width * first.height, second.width * second.height),
  );
  return (width * height) / smallerArea;
}

function assertNoOverlappingText(
  elements: readonly HTMLElement[],
  scene: SceneDefinition,
  time: number,
): void {
  const leaves = textLeaves(elements);
  for (let index = 0; index < leaves.length; index += 1) {
    const first = leaves[index];
    if (!first) continue;
    const firstText = (first.textContent ?? "").trim().replace(/\s+/g, " ");
    const firstRect = first.getBoundingClientRect();
    for (let next = index + 1; next < leaves.length; next += 1) {
      const second = leaves[next];
      if (!second) continue;
      if (first.contains(second) || second.contains(first)) continue;
      const secondText = (second.textContent ?? "").trim().replace(/\s+/g, " ");
      const ratio = overlapRatio(firstRect, second.getBoundingClientRect());
      if (firstText === secondText) {
        if (ratio > 0.72) {
          throw new Error(
            `Scene ${scene.id} stacks duplicate text around ${time.toFixed(2)}s.`,
          );
        }
        continue;
      }
      if (ratio > 0.6) {
        throw new Error(
          `Scene ${scene.id} overlaps unrelated text around ${time.toFixed(
            2,
          )}s: "${firstText.slice(0, 32)}" collides with "${secondText.slice(
            0,
            32,
          )}".`,
        );
      }
    }
  }
}

/**
 * A layer that belongs to another beat but is still on screen. Generated films
 * fail this when an outgoing scene is faded but never cleared, so the new beat
 * is composited over the old one.
 */
function assertNoStaleLayers(
  elements: readonly HTMLElement[],
  scene: SceneDefinition,
  sceneIds: ReadonlySet<string>,
  time: number,
): void {
  for (const element of elements) {
    const owner = element.dataset["scene"]?.trim();
    if (!owner || owner === scene.id) continue;
    if (!sceneIds.has(owner)) continue;
    throw new Error(
      `Scene ${scene.id} still shows the stale layer from ${owner} around ${time.toFixed(
        2,
      )}s.`,
    );
  }
}

function assertVisibleSceneFrame(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scene: SceneDefinition,
  sceneIds: ReadonlySet<string>,
  time: number,
): void {
  runtime.seek(time);
  const rootRect = root.getBoundingClientRect();
  const hasLayout = rootRect.width > 0 && rootRect.height > 0;
  const visible = visibleElements(root, rootRect, hasLayout);
  if (visible.length === 0) {
    throw new Error(
      `Scene ${scene.id} renders no visible foreground around ${time.toFixed(2)}s.`,
    );
  }
  assertNoStaleLayers(visible, scene, sceneIds, time);

  if (!hasLayout) return;

  const canvasArea = Math.max(1, rootRect.width * rootRect.height);
  const coverage = visible.reduce((total, element) => {
    const rect = element.getBoundingClientRect();
    const width = Math.max(
      0,
      Math.min(rect.right, rootRect.right) - Math.max(rect.left, rootRect.left),
    );
    const height = Math.max(
      0,
      Math.min(rect.bottom, rootRect.bottom) - Math.max(rect.top, rootRect.top),
    );
    return total + width * height;
  }, 0);
  if (coverage / canvasArea < 0.03) {
    throw new Error(
      `Scene ${scene.id} renders a near-blank frame around ${time.toFixed(2)}s.`,
    );
  }

  assertNoOverlappingText(visible, scene, time);
}

/** Inline styles GSAP writes, used to prove a beat actually develops. */
function frameSignature(root: HTMLElement): string {
  return Array.from(root.querySelectorAll<HTMLElement>("*"))
    .map((element, index) => {
      const style = element.style;
      return [
        element.dataset["edit"] ?? index,
        style.transform,
        style.opacity,
        style.display,
        style.visibility,
        (element.textContent ?? "").trim().length,
      ].join("|");
    })
    .join(";");
}

function assertSceneDevelops(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scene: SceneDefinition,
  limit: number,
): void {
  const signatures = new Set<string>();
  for (const progress of [0.05, 0.5, 0.95]) {
    const time = Math.max(
      0,
      Math.min(limit, scene.start + scene.duration * progress),
    );
    runtime.seek(time);
    signatures.add(frameSignature(root));
  }
  if (signatures.size <= 1) {
    throw new Error(
      `Scene ${scene.id} never changes; it is a static slide rather than a directed beat.`,
    );
  }
}

/**
 * Scene boundaries must conserve visual mass. A multi-scene timeline whose only
 * boundary mechanism is opacity is a slideshow.
 */
function assertCarrierContinuity(
  timelineJs: string,
  html: string,
  scenes: readonly SceneDefinition[],
): void {
  if (scenes.length < 2) return;
  const handoffs = Array.from(timelineJs.matchAll(PHYSICAL_HANDOFF)).length;
  if (handoffs === 0) {
    throw new Error(
      "AI output joins scenes without a morph, match-cut, or particle handoff; slideshow output is rejected.",
    );
  }
  if (!/data-transition-carrier(?:\s|=|>)/i.test(html)) {
    throw new Error(
      "AI composition has no persistent transition carrier, so scene boundaries cannot conserve visual mass.",
    );
  }
}

function assertAssetsUsed(html: string, tokens: readonly string[]): void {
  const missing = tokens.filter((token) => !html.includes(token));
  if (missing.length > 0) {
    throw new Error(
      `AI did not use ${missing.length} attached image${missing.length === 1 ? "" : "s"}.`,
    );
  }
  const unsourced = tokens.filter((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(
      `(?:(?:src|srcset|href|data-src|xlink:href)\\s*=\\s*["']?[^"'>]{0,80}|url\\(\\s*["']?[^"')]{0,80})${escaped}`,
      "i",
    ).test(html);
  });
  if (unsourced.length > 0) {
    throw new Error(
      `AI referenced ${unsourced.length} attached image${
        unsourced.length === 1 ? "" : "s"
      } without rendering it as a visible source.`,
    );
  }
}

/**
 * The runtime pads a short timeline out to the composition duration, so
 * `timeline.duration()` cannot reveal a film that stops early. Measure the last
 * authored tween instead: filler tweens on plain objects do not count.
 */
function authoredEnd(timeline: gsap.core.Timeline): number {
  let end = 0;
  for (const child of timeline.getChildren(false, true, true)) {
    const asTween = child as gsap.core.Tween;
    const targets =
      typeof asTween.targets === "function" ? asTween.targets() : null;
    const meaningful =
      targets === null ||
      targets.some((target) => target instanceof Element) ||
      typeof child.vars?.["onUpdate"] === "function";
    if (!meaningful) continue;
    end = Math.max(end, child.endTime());
  }
  return end;
}

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
    renderedHtml?: string;
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

  assertAssetsUsed(result.compositionHtml, options.requiredAssetTokens ?? []);

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
  assertCarrierContinuity(result.timelineJs, result.compositionHtml, scenes);

  const composition = createDynamicComposition(
    options.renderedHtml ?? result.compositionHtml,
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
    const lastAuthored = authoredEnd(runtime.timeline);
    if (scenes.length >= 2 && lastAuthored < duration * 0.7) {
      throw new Error(
        `AI timeline stops at ${lastAuthored.toFixed(
          2,
        )}s and leaves the rest of the ${duration.toFixed(2)}s composition frozen.`,
      );
    }
    const sceneIds = new Set(scenes.map((scene) => scene.id));
    const limit = Math.max(0, duration - 1 / composition.fps);
    for (const scene of scenes) {
      for (const progress of [0.25, 0.5, 0.8]) {
        const time = Math.min(limit, scene.start + scene.duration * progress);
        assertVisibleSceneFrame(
          runtime,
          root,
          scene,
          sceneIds,
          Math.max(0, time),
        );
      }
      assertSceneDevelops(runtime, root, scene, limit);
    }
    const finalScene = scenes.at(-1);
    if (finalScene) {
      assertVisibleSceneFrame(runtime, root, finalScene, sceneIds, limit);
    }
  } finally {
    runtime?.destroy();
    root.remove();
  }
  return { result, duration, scenes };
}

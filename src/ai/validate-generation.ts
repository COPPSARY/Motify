import { createDynamicComposition } from "../composition/dynamic-compiler";
import { CompositionRuntime } from "../composition/runtime";
import type { SceneDefinition } from "../composition/types";
import type { DirectAiResult } from "./direct-ai";

/**
 * Requests that are allowed to change the shape of the film rather than edit
 * the one on screen: an explicit structural edit, a duration change, or — the
 * common case — a request to author a new film outright. "Make an ad for my
 * issue tracker" is not an edit to the current composition, so holding its
 * output to the previous composition's layers rejects exactly the work the
 * user asked for.
 */
const STRUCTURAL_REQUEST =
  /\b(add|insert|remove|delete|reorder|replace|redesign|rebuild|regenerate|recreate|rewrite)\b[\s\S]{0,30}\b(scene|timeline|composition|film|video|entire|whole|complete)\b|\b(change|extend|shorten|set|make|hold|linger|stretch|trim)\b[\s\S]{0,32}\b(duration|length|timing|longer|shorter|slower|faster)\b|\b(make|create|build|generate|design|produce|animate|film|storyboard)\b[\s\S]{0,48}\b(ad|advert|advertisement|film|video|promo|commercial|animation|composition|reel|teaser|trailer|spot|intro|explainer|walkthrough|demo)\b|\bfrom scratch\b|\bstart over\b/i;

/** Hard ceiling on a composition's running time. */
const MAX_COMPOSITION_SECONDS = 300;

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
 * Scene boundaries should conserve visual mass; a multi-scene timeline whose
 * only boundary mechanism is opacity reads as a slideshow.
 *
 * This is direction, not correctness: such a film still renders, seeks, and
 * exports correctly, so it is reported as a warning the caller can surface
 * rather than an error that leaves the user with nothing.
 */
function carrierContinuityWarnings(
  timelineJs: string,
  html: string,
  scenes: readonly SceneDefinition[],
): string[] {
  if (scenes.length < 2) return [];
  const warnings: string[] = [];
  if (Array.from(timelineJs.matchAll(PHYSICAL_HANDOFF)).length === 0) {
    warnings.push(
      "Scenes are joined without a morph, match-cut, or particle handoff, so the film cuts like a slideshow.",
    );
  }
  if (!/data-transition-carrier(?:\s|=|>)/i.test(html)) {
    warnings.push(
      "No persistent transition carrier is marked, so scene boundaries do not conserve visual mass.",
    );
  }
  return warnings;
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

const SCENE_ACCENTS = ["#6366f1", "#22d3ee", "#f59e0b", "#f472b6", "#34d399"];

function wholeFilmScene(duration: number): SceneDefinition {
  return {
    id: "scene-01",
    label: "01 · Scene",
    start: 0,
    duration,
    accent: SCENE_ACCENTS[0] ?? "#6366f1",
  };
}

/**
 * Models routinely author `data-scene` beats in the markup and then omit the
 * top-level scenes array. Reading the beats back off the DOM keeps the
 * storyboard the user sees matching the film they are watching; the split is
 * even because the markup records which beats exist, not where they cut.
 */
function scenesFromMarkup(
  html: string,
  duration: number,
): readonly SceneDefinition[] {
  const ids: string[] = [];
  for (const match of html.matchAll(/data-scene=["']([^"']+)["']/gi)) {
    const id = (match[1] ?? "").trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  if (ids.length < 2) return [wholeFilmScene(duration)];
  const span = duration / ids.length;
  return ids.map((id, index) => ({
    id,
    label: `${String(index + 1).padStart(2, "0")} · ${id}`,
    start: index * span,
    duration: span,
    accent: SCENE_ACCENTS[index % SCENE_ACCENTS.length] ?? "#6366f1",
  }));
}

interface NormalizedScenes {
  /** The storyboard the editor shows and the runtime navigates. */
  readonly scenes: readonly SceneDefinition[];
  /**
   * The beats the frame assertions run against. Inferred boundaries record
   * which beats exist, not where they cut, so checking a beat's frames against
   * a guessed window would reject correct films for being at the wrong moment.
   * When the cuts are unknown, the whole film is validated as one beat.
   */
  readonly validated: readonly SceneDefinition[];
}

function normalizedScenes(
  result: DirectAiResult,
  previousScenes: readonly SceneDefinition[],
  allowStructuralChange: boolean,
  duration: number,
  replacesPreviousComposition: boolean,
): NormalizedScenes {
  if (!allowStructuralChange && previousScenes.length > 0) {
    return { scenes: previousScenes, validated: previousScenes };
  }
  if (result.scenes?.length) {
    return { scenes: result.scenes, validated: result.scenes };
  }
  // Replaying the beats of footage that no longer exists would validate the
  // new film against the previous film's cuts.
  if (replacesPreviousComposition || previousScenes.length === 0) {
    return {
      scenes: scenesFromMarkup(result.compositionHtml, duration),
      validated: [wholeFilmScene(duration)],
    };
  }
  return { scenes: previousScenes, validated: previousScenes };
}

export interface ValidatedGeneration {
  result: DirectAiResult;
  duration: number;
  scenes: readonly SceneDefinition[];
  /** Directorial notes about output that is correct but not yet cinematic. */
  warnings: readonly string[];
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
    /**
     * Which composition this generation started from. The bundled foundation is
     * scaffolding, not the user's work: its layers exist to be replaced, so
     * protecting them rejects every first film a user ever asks for.
     */
    generationProfile?: "claude-foundation-v1" | "existing";
    /**
     * Layers the user has moved, resized, restyled, or retimed by hand. Only
     * these are unrecoverable if an edit drops them; the rest of the previous
     * composition was authored by the model and it may re-cut its own work.
     */
    userEditedIds?: readonly string[];
  },
): ValidatedGeneration {
  const allowStructuralChange =
    options.generationProfile === "claude-foundation-v1" ||
    STRUCTURAL_REQUEST.test(options.prompt);
  const previousIds = editIds(options.previousHtml);
  const nextIds = editIds(result.compositionHtml);
  if (nextIds.size === 0) {
    throw new Error("AI composition has no explicit data-edit layers.");
  }
  const droppedLayers = allowStructuralChange
    ? []
    : [...previousIds].filter((id) => !nextIds.has(id));
  // Losing a layer the user shaped by hand destroys work only they can redo.
  const droppedUserWork = droppedLayers.filter((id) =>
    (options.userEditedIds ?? []).includes(id),
  );
  if (droppedUserWork.length > 0) {
    throw new Error(
      `AI edit removed layers you edited by hand: ${droppedUserWork.slice(0, 8).join(", ")}.`,
    );
  }

  assertAssetsUsed(result.compositionHtml, options.requiredAssetTokens ?? []);

  const requestedDuration = Number(result.duration);
  let duration =
    allowStructuralChange && Number.isFinite(requestedDuration)
      ? requestedDuration
      : options.previousDuration;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > MAX_COMPOSITION_SECONDS
  ) {
    throw new Error("AI returned an invalid composition duration.");
  }
  const { scenes, validated } = normalizedScenes(
    result,
    options.previousScenes,
    allowStructuralChange,
    duration,
    options.generationProfile === "claude-foundation-v1",
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
  const warnings = carrierContinuityWarnings(
    result.timelineJs,
    result.compositionHtml,
    scenes,
  );
  const recomposed = droppedLayers.filter(
    (id) => !droppedUserWork.includes(id),
  );
  if (recomposed.length > 0) {
    warnings.push(
      `This edit re-cut ${recomposed.length} layer${
        recomposed.length === 1 ? "" : "s"
      } rather than editing them in place (${recomposed.slice(0, 5).join(", ")}).`,
    );
  }

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
    // The film is as long as its motion. A timeline that runs past the
    // requested length is the model answering "hold this longer", not an
    // error, so the composition adopts it rather than rejecting the edit.
    if (actualDuration > duration + 1 / composition.fps) {
      if (actualDuration > MAX_COMPOSITION_SECONDS) {
        throw new Error(
          `AI timeline runs ${actualDuration.toFixed(2)}s, past the ${MAX_COMPOSITION_SECONDS}s ceiling.`,
        );
      }
      duration = actualDuration;
      warnings.push(
        `The timeline runs ${actualDuration.toFixed(1)}s, so the composition was extended to match.`,
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
    const sceneIds = new Set(validated.map((scene) => scene.id));
    const limit = Math.max(0, duration - 1 / composition.fps);
    for (const scene of validated) {
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
    const finalScene = validated.at(-1);
    if (finalScene) {
      assertVisibleSceneFrame(runtime, root, finalScene, sceneIds, limit);
    }
  } finally {
    runtime?.destroy();
    root.remove();
  }
  return { result, duration, scenes, warnings };
}

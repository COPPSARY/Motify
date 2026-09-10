import type {
  SceneDefinition,
  SceneTrack,
  SceneTrackKind,
} from "../composition/types";

export type { SceneTrack, SceneTrackKind };

function humanizeLabel(id: string): string {
  return id
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function formatTimelineSeconds(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return `${rounded
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1")}s`;
}

function detectElementKind(element?: HTMLElement): SceneTrackKind {
  if (!element) return "Element";
  if (
    element instanceof SVGElement ||
    element.tagName.toLowerCase() === "svg"
  ) {
    return "SVG";
  }
  const tag = element.tagName.toLowerCase();
  if (
    tag === "h1" ||
    tag === "h2" ||
    tag === "h3" ||
    tag === "h4" ||
    tag === "h5" ||
    tag === "h6" ||
    tag === "p" ||
    tag === "span" ||
    element.dataset["motionlySplitUnit"] !== undefined
  ) {
    return "Text";
  }
  return "Element";
}

interface TimeSpan {
  start: number;
  end: number;
}

/**
 * `startTime()` and `endTime()` are expressed in the animation's *parent* time.
 * A tween inside a nested timeline (every preset that builds one, every
 * `stagger` sub-tween) therefore reports times that mean nothing on the master
 * timeline. Walk the parent chain, undoing each ancestor's timeScale, so every
 * clip lands in one coordinate system: seconds on the master timeline.
 */
function masterSpan(
  tween: gsap.core.Tween,
  master: gsap.core.Timeline,
): TimeSpan {
  let start = tween.startTime();
  let end = tween.endTime();
  let node = tween.parent as gsap.core.Timeline | null | undefined;
  let guard = 0;
  while (node && node !== master && guard < 24) {
    const scale = node.timeScale() || 1;
    start = node.startTime() + start / scale;
    end = node.startTime() + end / scale;
    node = node.parent as gsap.core.Timeline | null | undefined;
    guard += 1;
  }
  return { start, end };
}

/**
 * One pass over the timeline instead of one pass per element: for every tween
 * target, credit the span to that element and to each registered ancestor, so a
 * split-word tween still extends its headline's clip.
 */
function collectElementSpans(
  registeredElements: ReadonlyMap<string, HTMLElement>,
  timeline: gsap.core.Timeline,
): Map<string, TimeSpan> {
  const idByElement = new Map<Element, string>();
  registeredElements.forEach((element, id) => {
    if (element && !idByElement.has(element)) idByElement.set(element, id);
  });

  const spans = new Map<string, TimeSpan>();
  const record = (id: string, span: TimeSpan): void => {
    const existing = spans.get(id);
    if (!existing) {
      spans.set(id, { start: span.start, end: span.end });
      return;
    }
    existing.start = Math.min(existing.start, span.start);
    existing.end = Math.max(existing.end, span.end);
  };

  const tweens = timeline.getChildren(true, true, false) as gsap.core.Tween[];
  for (const tween of tweens) {
    let targets: unknown[];
    try {
      targets = tween.targets?.() ?? [];
    } catch {
      continue;
    }
    if (targets.length === 0) continue;
    const span = masterSpan(tween, timeline);
    if (!Number.isFinite(span.start) || !Number.isFinite(span.end)) continue;
    for (const target of targets) {
      if (!(target instanceof Element)) continue;
      for (let node: Element | null = target; node; node = node.parentElement) {
        const id = idByElement.get(node);
        if (id) record(id, span);
      }
    }
  }
  return spans;
}

function clampTrack(span: TimeSpan): TimeSpan {
  const start = Math.max(0, Math.round(span.start * 100) / 100);
  const end = Math.max(start + 0.3, Math.round(span.end * 100) / 100);
  return { start, end };
}

function intersectsScene(span: TimeSpan, scene: SceneDefinition): boolean {
  const sceneEnd = scene.start + scene.duration;
  return span.end > scene.start + 1e-6 && span.start < sceneEnd - 1e-6;
}

/**
 * Derives timeline scene tracks for any composition or preset.
 *
 * Track `start`/`end` are always **master-timeline seconds**, matching the
 * authored `scene.tracks` the presets ship and the absolute time the scrubber
 * and playhead use. The editor converts to lane percentages; nothing downstream
 * should add `scene.start` to these values.
 */
export function deriveSceneTracks(
  scene: SceneDefinition,
  registeredElements?: Map<string, HTMLElement>,
  timeline?: gsap.core.Timeline,
): readonly SceneTrack[] {
  const fallback: readonly SceneTrack[] = [
    {
      id: `${scene.id}-main`,
      label: scene.label,
      kind: "Element",
      start: scene.start,
      end: scene.start + scene.duration,
    },
  ];

  if (scene.tracks && scene.tracks.length > 0) {
    const validTracks = registeredElements
      ? scene.tracks.filter((track) => registeredElements.has(track.id))
      : scene.tracks;
    if (validTracks.length > 0) return validTracks;
  }

  if (!registeredElements || registeredElements.size === 0) return fallback;

  const spans = timeline
    ? collectElementSpans(registeredElements, timeline)
    : new Map<string, TimeSpan>();

  const generatedTracks: SceneTrack[] = [];
  registeredElements.forEach((element, id) => {
    const span = spans.get(id);
    // Without tween evidence the element is simply present for the whole beat.
    const track = clampTrack(
      span ?? { start: scene.start, end: scene.start + scene.duration },
    );
    if (span && !intersectsScene(track, scene)) return;
    generatedTracks.push({
      id,
      label: humanizeLabel(id),
      kind: detectElementKind(element),
      start: track.start,
      end: track.end,
    });
  });

  return generatedTracks.length > 0 ? generatedTracks : fallback;
}

import type { SceneDefinition } from "../composition/types";

/**
 * Persisted marker written into generated HTML as
 * `data-motionly-generation-profile`. The value is deliberately frozen:
 * existing user compositions and local drafts carry it, and changing the
 * string would make the editor treat them as un-founded projects.
 */
export const GENERATION_FOUNDATION_PROFILE = "claude-foundation-v1";

/**
 * A new project needs valid source before the first generation reaches either
 * the local model or the cloud project API. This is deliberately a technical
 * scaffold, not an example film. It contains no product, brand, copy, UI,
 * information architecture, or transition vocabulary for a model to inherit.
 */
export const foundationScenes: readonly SceneDefinition[] = [
  {
    id: "scene-01",
    label: "01 · New composition",
    start: 0,
    duration: 20,
    accent: "#756f83",
  },
];

/** A one-scene scaffold has no boundaries and therefore no seams. */
export const foundationSeams = [] as const;

export const foundationHtml = `<template id="motionly-composition-template">
  <style>
    .motionly-foundation-stage {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #f2f0f4;
    }
    .motionly-foundation-field {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(rgba(28, 24, 36, .035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(28, 24, 36, .035) 1px, transparent 1px),
        radial-gradient(circle at 50% 46%, rgba(117, 111, 131, .08), transparent 42%);
      background-size: 96px 96px, 96px 96px, 100% 100%;
    }
    .motionly-foundation-world,
    .motionly-foundation-scene {
      position: absolute;
      inset: 0;
      transform-origin: 50% 50%;
    }
  </style>
  <main
    class="motionly-foundation-stage"
    data-edit="stage"
    data-edit-label="New composition"
    data-motionly-generation-profile="claude-foundation-v1"
  >
    <div class="motionly-foundation-field" data-edit="foundation-field" aria-hidden="true"></div>
    <div class="motionly-foundation-world" data-edit="camera-world" data-camera-world>
      <section
        class="motionly-foundation-scene"
        data-edit="scene-01"
        data-edit-label="New composition"
        data-scene="scene-01"
      ></section>
    </div>
  </main>
</template>`;

export const foundationTimeline = `export function buildTimeline(context) {
  const { root, timeline, register } = context;
  const get = (id) => {
    const element = root.querySelector('[data-edit="' + id + '"]');
    if (!element) return null;
    register(id, element);
    return element;
  };

  const stage = get("stage");
  const field = get("foundation-field");
  const world = get("camera-world");
  const scene = get("scene-01");

  timeline.set([stage, field, world, scene].filter(Boolean), { autoAlpha: 1 }, 0);
  timeline.set(world, { x: 0, y: 0, scale: 1 }, 0);
  timeline.to(world, { scale: 1.005, duration: 20, ease: "sine.inOut" }, 0);
}`;

export const foundationFiles = {
  compositionHtml: foundationHtml,
  timelineJs: foundationTimeline,
};

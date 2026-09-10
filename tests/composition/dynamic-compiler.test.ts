import { afterEach, describe, expect, it } from "vitest";
import {
  createDynamicComposition,
  extractTimelineFunctionName,
  sanitizeTimelineScript,
} from "../../src/composition/dynamic-compiler";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("dynamic-compiler", () => {
  let runtime: CompositionRuntime | null = null;
  let root: HTMLDivElement | null = null;

  afterEach(() => {
    runtime?.destroy();
    root?.remove();
    runtime = null;
    root = null;
  });

  it("sanitizes ES module import and export statements", () => {
    const rawJs = `
      import gsap from "gsap";
      import { wordSlideRotate } from "../../../composition/presets";

      export function buildTimeline(context) {
        context.timeline.to(context.root, { duration: 1 });
      }
    `;

    const sanitized = sanitizeTimelineScript(rawJs);
    expect(sanitized).not.toContain("import gsap");
    expect(sanitized).not.toContain("export function");
    expect(sanitized).toContain("function buildTimeline(context)");
  });

  it("creates a runnable CompositionDefinition from raw strings", () => {
    const html = `
      <template id="dynamic-template">
        <div class="test-container" data-edit="hero-box">
          <h1 data-edit="hero-title">Dynamic Title</h1>
        </div>
      </template>
    `;

    const js = `
      export function buildTimeline(context) {
        const title = context.root.querySelector("[data-edit='hero-title']");
        context.timeline.to(title, { duration: 2, scale: 1.5 });
      }
    `;

    const dynamicComp = createDynamicComposition(html, js, {
      duration: 10.0,
      title: "Test Dynamic Comp",
    });

    expect(dynamicComp.duration).toBe(10.0);
    expect(dynamicComp.title).toBe("Test Dynamic Comp");

    root = document.createElement("div");
    document.body.append(root);

    runtime = new CompositionRuntime(dynamicComp, root);

    expect(runtime.timeline.duration()).toBeGreaterThanOrEqual(2);
    expect(runtime.elements.has("hero-title")).toBe(true);
  });

  it("successfully invokes presets like scalePop when imports are stripped", () => {
    const html = `
      <template id="dynamic-template">
        <div data-edit="box">Hello</div>
      </template>
    `;

    const js = `
      import { scalePop } from "../../../composition/presets";
      export function buildTimeline(context) {
        const box = context.root.querySelector("[data-edit='box']");
        scalePop(context.timeline, box);
      }
    `;

    const dynamicComp = createDynamicComposition(html, js, { duration: 5.0 });
    root = document.createElement("div");
    document.body.append(root);

    runtime = new CompositionRuntime(dynamicComp, root);
    expect(runtime.timeline.duration()).toBeGreaterThan(0);
    expect(runtime.elements.has("box")).toBe(true);
  });

  it("runs buildTimeline even when a helper is named after the timeline", () => {
    const js = `
      function animateTimelineCamera(timeline, target) {
        timeline.to(target, { duration: 0.5, x: 40 });
      }

      export function buildTimeline(context) {
        const box = context.root.querySelector("[data-edit='box']");
        animateTimelineCamera(context.timeline, box);
        context.timeline.to(box, { duration: 3, opacity: 1 });
      }
    `;

    expect(extractTimelineFunctionName(js)).toBe("buildTimeline");

    const dynamicComp = createDynamicComposition(
      `<template><div data-edit="box">Hello</div></template>`,
      js,
      { duration: 1 },
    );
    root = document.createElement("div");
    document.body.append(root);

    runtime = new CompositionRuntime(dynamicComp, root);
    // The helper alone is 0.5s; only the real entry point reaches 3.5s.
    expect(runtime.timeline.duration()).toBeGreaterThan(3);
  });

  it("falls back to the closest build*Timeline entry point", () => {
    expect(
      extractTimelineFunctionName(
        [
          "function timelineLabels() {}",
          "function buildPromoTimeline(context) {}",
        ].join("\n"),
      ),
    ).toBe("buildPromoTimeline");
  });
});

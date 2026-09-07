import { describe, expect, it } from "vitest";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import { MOTIONLY_SYSTEM_PROMPT as serverPrompt } from "../../src/ai/gemini-server";
import {
  analyzeMotionQuality,
  buildMotionlyUserMessage,
  selectBackgroundDirection,
  selectRegistryReferences,
} from "../../src/ai/generation-guidance";
import { createDynamicComposition } from "../../src/composition/dynamic-compiler";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("Motionly AI Prompt and Choreography Rules", () => {
  it("enforces single focal subject and rejects card/chips clutter", () => {
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("one focal subject");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("title + subtitle + card");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("MOTIONLY PRESETS");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("TRANSITION LAW");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("\\n<style>...</style>");

    // Must not mandate multi-element cards or chips clutter
    expect(MOTIONLY_SYSTEM_PROMPT).not.toContain("Status pill drops in");
    expect(MOTIONLY_SYSTEM_PROMPT).not.toContain(
      "MULTI-ELEMENT SEQUENTIAL STAGGER",
    );
  });

  it("unifies the system prompt across gemini-server and prompt.ts", () => {
    expect(serverPrompt).toBe(MOTIONLY_SYSTEM_PROMPT);
  });

  it("keeps reference-grade camera and hold guidance internally consistent", () => {
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("STORY BEFORE SHOTS");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("dedicated local focus rig");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("SOURCE-SPECIFIC FULL-BLEED UI");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("Repair every axis below 4");
    expect(MOTIONLY_SYSTEM_PROMPT).not.toContain(
      "CONTINUOUS LIFE (NO FROZEN HOLDS)",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).not.toContain(
      "authentic 260px dark sidebar",
    );
  });

  it("retrieves useful registry metadata and skill contracts per request", () => {
    const references = selectRegistryReferences(
      "Launch an AI assistant with a typed prompt, browser UI, and proof metric",
    );
    expect(references.length).toBeGreaterThanOrEqual(6);
    expect(references.every((item) => Boolean(item.description))).toBe(true);
    expect(
      references.some((item) =>
        ["ai-chat-reveal", "typed-prompt", "browser-device-stage"].includes(
          item.name,
        ),
      ),
    ).toBe(true);

    const message = buildMotionlyUserMessage("Animate a SaaS launch", {});
    expect(message).toContain("RELEVANT SKILL CONTRACTS");
    expect(message).toContain("RETRIEVED HYPERFRAMES REFERENCES");
    expect(message).toContain("not callable Motionly functions");
    expect(message).toContain("reference-grade-product-film");
    expect(message).toContain("data-field");
  });

  it("includes project conversation and required supplied image tokens", () => {
    const message = buildMotionlyUserMessage("Use my product shot", {
      conversation: [{ role: "user", text: "Keep the bottle centered" }],
      assets: [
        {
          id: "asset-1",
          name: "bottle.png",
          mimeType: "image/png",
          dataBase64: "AA==",
          token: "motionly-asset://asset-1",
        },
      ],
      editorState: {
        animations: { bottle: { speed: 1.2, ease: "sine.inOut" } },
      },
    });
    expect(message).toContain("Keep the bottle centered");
    expect(message).toContain("motionly-asset://asset-1");
    expect(message).toContain("Every supplied image is required");
    expect(message).toContain("LOCAL EDITOR OVERRIDES");
    expect(message).toContain("sine.inOut");
  });

  it("routes notes prompts to a causal paper-and-signal background", () => {
    const direction = selectBackgroundDirection(
      "Make a premium notes app ad with voice transcription",
    );
    expect(direction.system).toContain("paper structure");
    expect(direction.progression).toContain("resolves into the app mark");
    expect(direction.avoid).toContain("generic aurora");

    const message = buildMotionlyUserMessage(
      "Make a premium notes app ad with voice transcription",
      {},
    );
    expect(message).toContain("apple-design");
    expect(message).toContain("notes product proof");
    expect(message).toContain("traveling ink/signal path");
  });

  it("flags sparse static generations for a repair pass", () => {
    const report = analyzeMotionQuality({
      title: "Static",
      duration: 16,
      scenes: [
        { id: "one", label: "One", start: 0, duration: 8, accent: "#fff" },
        { id: "two", label: "Two", start: 8, duration: 8, accent: "#fff" },
      ],
      compositionHtml:
        "<template><style>.x{opacity:1}</style><h1>Still</h1></template>",
      timelineJs:
        "export function buildTimeline({ timeline }) { timeline.to('.x', { opacity: 1 }); }",
      reply: "Done",
    });
    expect(report.requiresRepair).toBe(true);
    expect(report.issues.join(" ")).toContain("under-choreographed");
    expect(report.issues.join(" ")).toContain("handoff");
  });

  it("rejects non-reversible cleanup and layout-thrashing motion", () => {
    const report = analyzeMotionQuality({
      duration: 8,
      scenes: [
        { id: "scene-01", label: "One", start: 0, duration: 8, accent: "#fff" },
      ],
      compositionHtml:
        "<template><main data-camera-world class='world'></main></template>",
      timelineJs: `export function buildTimeline({ timeline }) {
        timeline.set('.panel', { autoAlpha: 0 }, 0);
        timeline.to('.panel', { width: '80%', duration: 1, onComplete: () => { panel.style.display = 'none'; } }, 1);
      }`,
      reply: "Done",
    });
    expect(report.issues.join(" ")).toContain("reverse-seek safe");
    expect(report.issues.join(" ")).toContain("layout properties");
  });

  it("allows a dense, deterministic multi-scene result through the quality gate", () => {
    const scene = (id: string, start: number) => ({
      id,
      label: id,
      start,
      duration: 4,
      accent: "#7c3aed",
    });
    const technique = (beat: string) => ({
      beat,
      registryReference: "per-word-rise",
      motionlyPresets: ["wordSlideRotate", "morph"],
      sustainedMotion: "The subject develops throughout the readable hold.",
      handoff: "morph" as const,
    });
    const report = analyzeMotionQuality({
      duration: 12,
      scenes: [
        scene("scene-01", 0),
        scene("scene-02", 4),
        scene("scene-03", 8),
      ],
      techniques: [
        technique("scene-01"),
        technique("scene-02"),
        { ...technique("scene-03"), handoff: "final-hold" },
      ],
      direction: ["scene-01", "scene-02", "scene-03"].map((scene) => ({
        scene,
        composition: "One centered focal subject",
        spatialRegion: "A distinct region in the camera world",
        cameraStart: "Wide",
        cameraEnd: "Focused",
        cameraTarget: "Carrier",
        primary: "Carrier",
        secondary: "Editorial sentence",
        hold: "Readable action hold",
        transition: "Morph into the next region",
      })),
      compositionHtml: `<template><style>.world{position:absolute;width:4200px;height:1080px}${".actor{position:absolute;transform-origin:center;}".repeat(
        45,
      )}</style><main class="stage"><div class="world" data-camera-world><h1 class="copy">A complete thought moves.</h1><div class="carrier"></div></div></main></template>`,
      timelineJs: `export function buildTimeline(context) {
        const { root, timeline } = context;
        const copy = root.querySelector('.copy');
        const carrier = root.querySelector('.carrier');
        const world = root.querySelector('.world');
        timeline.set([copy, carrier], { autoAlpha: 0 }, 0);
        wordSlideRotate(timeline, copy, { at: 0.2 });
        giantKineticCrop(timeline, copy, { at: 0.2 });
        timeline.to(carrier, { x: 40, duration: 0.5 }, 1);
        timeline.to(carrier, { x: 80, duration: 0.5 }, 2);
        timeline.to(carrier, { x: 120, duration: 0.5 }, 3);
        morph(timeline, carrier, { width: 600 }, { at: 4 });
        timeline.to(carrier, { rotation: 4, duration: 0.5 }, 5);
        timeline.to(carrier, { rotation: 0, duration: 0.5 }, 6);
        timeline.to(world, { x: -300, scale: 1.1, duration: 1 }, 3);
        timeline.to(world, { x: -900, scale: 1.1, duration: 1 }, 6);
        timeline.to(world, { x: -1200, scale: 0.9, duration: 1 }, 9);
        matchCut(timeline, copy, carrier, { at: 8 });
        timeline.to(carrier, { scale: 1.05, duration: 2 }, 9);
      }`,
      reply: "A directed three-beat composition.",
    });
    expect(report.issues).toEqual([]);
    expect(report.requiresRepair).toBe(false);
    expect(report.score).toBeGreaterThanOrEqual(90);
  });

  it("supports executing compositions using wordSlideRotate, morph, and cameraPush presets", () => {
    const html = `
      <template id="motionly-composition-template">
        <main class="motionly-stage" data-edit="stage">
          <div class="world" data-edit="world"></div>
          <h1 class="statement" data-edit="statement">Motionly rethinks product motion.</h1>
          <div class="carrier" data-edit="carrier"></div>
        </main>
      </template>
    `;

    const js = `
      export function buildTimeline(context) {
        const { root, timeline } = context;
        const stage = root.querySelector(".motionly-stage");
        const statement = root.querySelector("[data-edit='statement']");
        const carrier = root.querySelector("[data-edit='carrier']");

        timeline.set(carrier, { width: 300, height: 80, borderRadius: "16px", autoAlpha: 0 }, 0);
        wordSlideRotate(timeline, statement, { at: 0.2, distance: 40 });
        cameraPush(timeline, stage, { scale: 1.05, duration: 4.0 }, 0);
        morph(timeline, carrier, { width: 600, height: 300, borderRadius: "24px", autoAlpha: 1 }, { at: 4.2 });
      }
    `;

    const dynamicComp = createDynamicComposition(html, js, { duration: 6.0 });
    const root = document.createElement("div");
    document.body.append(root);

    const runtime = new CompositionRuntime(dynamicComp, root);
    expect(runtime.timeline.duration()).toBeGreaterThanOrEqual(4.2);
    expect(runtime.elements.has("statement")).toBe(true);
    expect(runtime.elements.has("carrier")).toBe(true);

    runtime.destroy();
    root.remove();
  });
});

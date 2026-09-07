import { describe, expect, it } from "vitest";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import { MOTIONLY_SYSTEM_PROMPT as serverPrompt } from "../../src/ai/gemini-server";
import {
  analyzeMotionQuality,
  buildMotionlyUserMessage,
  buildRegistryBrief,
  buildSkillRoutingBrief,
  QUALITY_REPAIR_THRESHOLD,
  selectBackgroundDirection,
  selectReferenceRoles,
  selectRegistryReferences,
} from "../../src/ai/generation-guidance";
import {
  buildProductIdentityBrief,
  selectProductProfile,
} from "../../src/ai/product-profile";
import { createDynamicComposition } from "../../src/composition/dynamic-compiler";
import { CompositionRuntime } from "../../src/composition/runtime";
import {
  GENERATION_FOUNDATION_PROFILE,
  foundationHtml,
  foundationScenes,
  foundationTimeline,
} from "../../src/ai/generation-foundation";

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
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("GENERATION FOUNDATION");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("data-transition-carrier");
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
    expect(
      references.filter((item) => item.type === "hyperframes:component").length,
    ).toBeGreaterThanOrEqual(6);

    const message = buildMotionlyUserMessage("Animate a SaaS launch", {});
    expect(message).toContain("RELEVANT SKILL CONTRACTS");
    expect(message).toContain("RETRIEVED HYPERFRAMES REFERENCES");
    expect(message).toContain("not callable Motionly functions");
    expect(message).toContain("reference-grade-product-film");
    expect(message).toContain("data-field");
    expect(message).toContain("GENERATION FOUNDATION");
    expect(message).toContain("data-hyperframe-component");
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
      )}</style><main class="stage" data-edit="stage" data-motionly-generation-profile="claude-foundation-v1"><div class="world" data-edit="camera-world" data-camera-world><h1 class="copy" data-edit="hook-copy" data-hyperframe-component="per-word-rise">A complete thought moves.</h1><div class="carrier" data-edit="story-carrier" data-transition-carrier data-hyperframe-component="morph-swap"></div><div class="shell" data-edit="product-shell" data-hyperframe-component="browser-device-stage"><span data-edit="typed-input"></span><span data-edit="prompt-caret"></span><div data-edit="action-button">Send</div></div></main></template>`,
      timelineJs: `export function buildTimeline(context) {
        const { root, timeline } = context;
        const copy = root.querySelector('.copy');
        const carrier = root.querySelector('.carrier');
        const world = root.querySelector('.world');
        timeline.set([copy, carrier], { autoAlpha: 0 }, 0);
        timeline.fromTo(copy, { y: 40 }, { y: 0, duration: 0.5 }, 0.1);
        timeline.fromTo(carrier, { scale: 0.9 }, { scale: 1, duration: 0.5 }, 0.2);
        timeline.fromTo(world, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.3);
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
        timeline.to(world, { scale: 1.45, x: -1400, duration: 1 }, 4.5);
        timeline.to(cursor, { scale: 0.86, duration: 0.09, yoyo: true, repeat: 1 }, 5.4);
        matchCut(timeline, copy, carrier, { at: 8 });
        timeline.to(shell, { y: -40, autoAlpha: 0, duration: 0.5 }, 7.4);
        timeline.to(copy, { y: -30, autoAlpha: 0, duration: 0.5 }, 7.6);
        timeline.to(carrier, { scale: 1.05, duration: 2 }, 9);
      }`,
      reply: "A directed three-beat composition.",
    });
    expect(report.issues).toEqual([]);
    expect(report.requiresRepair).toBe(false);
    expect(report.score).toBeGreaterThanOrEqual(90);
  });

  it("ships a compact generation foundation that passes the static gate", () => {
    const report = analyzeMotionQuality({
      title: "Foundation",
      duration: 20,
      scenes: foundationScenes,
      direction: foundationScenes.map((scene) => ({
        scene: scene.id,
        composition: "Carrier-led composition",
        spatialRegion: "Distinct camera-world region",
        cameraStart: "Wide",
        cameraEnd: "Focused",
        cameraTarget: "Persistent carrier",
        primary: "Carrier",
        secondary: "Authentic product evidence",
        hold: "Readable action hold",
        transition: "Carrier morphs into the next role",
      })),
      techniques: foundationScenes.map((scene, index) => ({
        beat: scene.id,
        registryReference: "morph-swap",
        motionlyPresets: ["morph", "wordSlideRotate"],
        sustainedMotion: "The interaction develops during camera travel.",
        handoff:
          index === foundationScenes.length - 1
            ? ("final-hold" as const)
            : ("morph" as const),
      })),
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
      reply: "Foundation ready.",
    });
    expect(foundationHtml).toContain(GENERATION_FOUNDATION_PROFILE);
    expect(report.issues).toEqual([]);
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

describe("Product-adaptive direction and the premium quality gate", () => {
  const scenes = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `scene-0${index + 1}`,
      label: `0${index + 1}`,
      start: index * 4,
      duration: 4,
      accent: "#7c3aed",
    }));

  it("states the product-adaptive, construction, camera, and anti-slop laws", () => {
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "PRODUCT-ADAPTIVE VISUAL IDENTITY",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "CLAUDE IS THE FLOOR, NOT THE SKIN",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "PROGRESSIVE CONSTRUCTION AND DECONSTRUCTION",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("CAMERA GRAMMAR");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("TYPING-FOLLOW PAN");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("MACRO INTERACTION SHOT");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("READABLE HOLD");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("BANNED SLOP");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("EDITABILITY CONTRACT");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("COMPONENT REUSE");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "FOLLOW-UP CONTEXT AND SUPPLIED MEDIA",
    );
  });

  it("carries the motion doctrine seam and timing law", () => {
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("SEAM VECTOR LAW");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("THE CURRENT");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("VOCABULARY BUDGET");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("TIMING INTENTS");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("STILLNESS BEFORE CLIMAX");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "bounce.out and elastic.out are banned",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("SUSTAINED MOTION");

    const routing = buildSkillRoutingBrief("Animate a SaaS launch");
    expect(routing).toContain("motion-doctrine");
    expect(routing).toContain("saas-motion-design transitions");
    expect(routing).toContain("cut-the-curve");
  });

  it("states the physical animation principles", () => {
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "PHYSICAL ANIMATION PRINCIPLES — OPACITY IS NOT ANIMATION",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("ANTICIPATION");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("SQUASH AND STRETCH");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "FOLLOW-THROUGH AND OVERLAPPING ACTION",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("SECONDARY ACTION");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("TIMING CONTRAST");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("EXAGGERATION");
  });

  it("blocks a composition with no motion and flags one that mostly fades", () => {
    const fadeOnly = analyzeMotionQuality({
      duration: 8,
      scenes: scenes(2),
      compositionHtml: `<template><main data-edit="stage"><h1 data-edit="hook">One</h1><div data-edit="card">Two</div></main></template>`,
      timelineJs: `export function buildTimeline({ timeline }) {
        timeline.set(hook, { autoAlpha: 0 }, 0);
        timeline.set(card, { autoAlpha: 0 }, 0);
        timeline.to(hook, { autoAlpha: 1, duration: 1 }, 0.5);
        timeline.to(hook, { autoAlpha: 0, duration: 1 }, 3);
        timeline.to(card, { autoAlpha: 1, duration: 1 }, 4);
      }`,
      reply: "Done",
    });
    expect(fadeOnly.blockingIssues.join(" ")).toContain(
      "opacity alone is not animation",
    );

    const mostlyFades = analyzeMotionQuality({
      duration: 8,
      scenes: scenes(2),
      compositionHtml: `<template><main data-edit="stage"><h1 data-edit="hook">One</h1></main></template>`,
      timelineJs: `export function buildTimeline({ timeline }) {
        timeline.set(hook, { autoAlpha: 0 }, 0);
        timeline.to(hook, { y: 10, duration: 0.5 }, 0.2);
        timeline.to(hook, { autoAlpha: 1, duration: 1 }, 0.5);
        timeline.to(card, { autoAlpha: 1, duration: 1 }, 2);
        timeline.to(card, { autoAlpha: 0, duration: 1 }, 4);
        timeline.to(mark, { autoAlpha: 1, duration: 1 }, 6);
      }`,
      reply: "Done",
    });
    // Fade-heavy motion is still motion: it earns a repair pass, not a reject.
    expect(mostlyFades.blockingIssues).toEqual([]);
    expect(mostlyFades.issues.join(" ")).toContain(
      "motion is mostly opacity fades",
    );
  });

  it("flags banned eases and transition-vocabulary sprawl", () => {
    const report = analyzeMotionQuality({
      duration: 12,
      scenes: [
        { id: "scene-01", label: "1", start: 0, duration: 4, accent: "#fff" },
        { id: "scene-02", label: "2", start: 4, duration: 4, accent: "#fff" },
        { id: "scene-03", label: "3", start: 8, duration: 4, accent: "#fff" },
      ],
      compositionHtml: `<template><main data-edit="stage" data-transition-carrier><div data-edit="carrier"></div></main></template>`,
      timelineJs: `export function buildTimeline({ timeline }) {
        timeline.set(carrier, { autoAlpha: 0 }, 0);
        timeline.to(carrier, { y: 0, duration: 0.6, ease: "elastic.out(1, 0.3)" }, 0.5);
        morph(timeline, carrier, { width: 400 }, { at: 4 });
        matchCut(timeline, carrier, panel, { at: 6 });
        cutTheCurve(timeline, { outgoing: panel, incoming: shell, at: 8 });
        zoomThrough(timeline, { outgoing: shell, incoming: mark, at: 10 });
      }`,
      reply: "Done",
    });
    const issues = report.issues.join(" ");
    expect(issues).toContain("bounce and elastic eases are banned");
    expect(issues).toContain("too many transition vocabularies");
  });

  it("adapts the visual identity to each product instead of reusing Claude chrome", () => {
    expect(selectProductProfile("premium notes app ad").id).toBe(
      "notes-writing",
    );
    expect(selectProductProfile("revenue analytics dashboard").id).toBe(
      "analytics-data",
    );
    expect(selectProductProfile("terminal deploy tool for developers").id).toBe(
      "developer-tool",
    );
    expect(selectProductProfile("a cozy candle subscription").id).toBe(
      "commerce",
    );

    const notes = buildProductIdentityBrief("premium notes app ad");
    expect(notes).toContain("paper-first editor");
    expect(notes).toContain("Never:");
    expect(notes).toContain("dark AI chrome");

    const message = buildMotionlyUserMessage("premium notes app ad", {});
    expect(message).toContain("PRODUCT VISUAL IDENTITY");
    expect(message).toContain("paper-first editor");
    expect(message).toContain("progressive construction in reading order");
    expect(message).toContain("typing-follow pan");
  });

  it("retrieves one proven mechanic per production role", () => {
    const roles = selectReferenceRoles(
      "Launch an AI assistant with a typed prompt, browser UI, and proof metric",
    );
    const covered = roles.map((entry) => entry.role);
    expect(covered).toContain("focal-typography");
    expect(covered).toContain("product-surface");
    expect(covered).toContain("progressive-construction");
    expect(covered).toContain("interaction");
    expect(covered).toContain("camera");
    expect(covered).toContain("continuity");
    expect(covered).toContain("proof");
    expect(covered).toContain("deconstruction-close");
    expect(new Set(roles.map((entry) => entry.item.name)).size).toBe(
      roles.length,
    );
    expect(buildRegistryBrief("AI assistant with a typed prompt")).toContain(
      "role: interaction",
    );
  });

  it("replays the previous plan so follow-ups continue the same film", () => {
    const message = buildMotionlyUserMessage("make the ending slower", {
      previousPlan: {
        title: "Northstar launch",
        subject: "analytics product ad",
        duration: 20,
        direction: [
          {
            scene: "scene-02",
            composition: "Full analytics workspace",
            spatialRegion: "center region",
            cameraStart: "wide",
            cameraEnd: "medium",
            cameraTarget: "the revenue chart",
            primary: "chart re-resolves",
            secondary: "filter bar quiet",
            hold: "1.1s readable settle",
            transition: "chart line carries into scene-03",
          },
        ],
        techniques: [
          {
            beat: "scene-02",
            registryReference: "chart-story",
            motionlyPresets: ["morph", "stepSurgeCounter"],
            sustainedMotion: "The counter resolves during the settle.",
            handoff: "morph",
          },
        ],
      },
    });
    expect(message).toContain("PREVIOUS GENERATION PLAN");
    expect(message).toContain("Northstar launch");
    expect(message).toContain("the revenue chart");
    expect(message).toContain("chart-story");
    expect(message).toContain("Never restart from a blank stage");
  });

  it("flags slideshow-shaped output joined by opacity toggles", () => {
    const report = analyzeMotionQuality({
      duration: 12,
      scenes: scenes(3),
      compositionHtml: `<template><main data-edit="stage" data-motionly-generation-profile="claude-foundation-v1"><div data-edit="carrier" data-transition-carrier></div><div class="scene-a" data-edit="scene-a">One</div><div class="scene-b" data-edit="scene-b">Two</div><div class="scene-c" data-edit="scene-c">Three</div></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        timeline.set(sceneA, { autoAlpha: 1 }, 0);
        timeline.to(sceneA, { autoAlpha: 0, duration: 0.5 }, 4);
        timeline.to(sceneB, { autoAlpha: 1, duration: 0.5 }, 4.5);
        timeline.to(sceneB, { autoAlpha: 0, duration: 0.5 }, 8);
        timeline.to(sceneC, { autoAlpha: 1, duration: 0.5 }, 8.5);
        timeline.to(sceneC, { autoAlpha: 1, duration: 0.5, stagger: 0.1 }, 9);
      }`,
      reply: "Done",
    });
    expect(report.issues.join(" ")).toContain("slideshow output");
    expect(report.requiresRepair).toBe(true);
  });

  it("flags a simultaneous fade-in of the whole layout", () => {
    const report = analyzeMotionQuality({
      duration: 8,
      scenes: scenes(2),
      compositionHtml: `<template><main data-edit="stage"><div data-edit="nav"></div></main></template>`,
      timelineJs: `export function buildTimeline({ timeline }) {
        timeline.fromTo([nav, header, card, footer], { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.4);
      }`,
      reply: "Done",
    });
    expect(report.issues.join(" ")).toContain("simultaneous fade-in");
  });

  it("flags tiny cards in a void, placeholder copy, and positional edit ids", () => {
    const report = analyzeMotionQuality({
      duration: 8,
      scenes: scenes(2),
      compositionHtml: `<template><main data-edit="stage"><div class="card" data-edit="layer-1">Lorem ipsum</div><div class="card" data-edit="layer-2">Metric</div><div class="card" data-edit="layer-3">Metric</div></main></template>`,
      timelineJs: `export function buildTimeline({ timeline }) {
        timeline.set(card, { autoAlpha: 0 }, 0);
        timeline.to(card, { autoAlpha: 1, duration: 1 }, 0.5);
      }`,
      reply: "Done",
    });
    const flagged = report.issues.join(" ");
    expect(flagged).toContain("small cards float in empty space");
    expect(flagged).toContain("generic placeholder");
    expect(flagged).toContain("positional rather than descriptive");
    // Layout taste is direction for the repair pass, never a rejection.
    expect(report.blockingIssues.join(" ")).not.toContain("small cards");
  });

  it("treats real AI product copy as content rather than a placeholder", () => {
    const report = analyzeMotionQuality({
      duration: 8,
      scenes: scenes(2),
      compositionHtml: `<template><main data-edit="stage"><h1 data-edit="headline">AI insights for every deploy</h1></main></template>`,
      timelineJs: `export function buildTimeline({ timeline }) {
        timeline.set(headline, { autoAlpha: 0 }, 0);
        timeline.to(headline, { y: 0, autoAlpha: 1, duration: 1 }, 0.4);
      }`,
      reply: "Done",
    });
    expect(report.issues.join(" ")).not.toContain("generic placeholder");
  });

  it("rejects ignored supplied media and leaked foundation branding", () => {
    const report = analyzeMotionQuality(
      {
        duration: 8,
        scenes: scenes(2),
        compositionHtml: `<template><main data-edit="stage"><h1 data-edit="copy">Claude writes your launch plan</h1></main></template>`,
        timelineJs: `export function buildTimeline({ timeline }) {
          timeline.set(copy, { autoAlpha: 0 }, 0);
          timeline.to(copy, { autoAlpha: 1, duration: 1 }, 0.4);
        }`,
        reply: "Done",
      },
      {
        prompt: "make an ad for my notes app",
        requiredAssetTokens: ["motionly-asset://hero"],
      },
    );
    const blocking = report.blockingIssues.join(" ");
    expect(blocking).toContain("supplied media is missing");
    expect(blocking).toContain("branding leaked");
  });

  it("ships a sound film with refinements noted instead of burning a repair pass", () => {
    const report = analyzeMotionQuality({
      title: "Foundation",
      duration: 20,
      scenes: foundationScenes,
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
      reply: "Foundation ready.",
    });
    // Missing direction/technique plans are refinements, not broken films, and
    // a film this sound should reach the user on the first round trip.
    expect(report.blockingIssues).toEqual([]);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(report.score).toBeGreaterThanOrEqual(QUALITY_REPAIR_THRESHOLD);
    expect(report.requiresRepair).toBe(false);
  });
});

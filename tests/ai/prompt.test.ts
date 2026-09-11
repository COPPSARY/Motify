import { describe, expect, it } from "vitest";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import { MOTIONLY_SYSTEM_PROMPT as serverPrompt } from "../../src/ai/gemini-server";
import {
  analyzeMotionQuality,
  buildFilmShapeBrief,
  buildMotionlyUserMessage,
  buildRegistryBrief,
  buildSkillRoutingBrief,
  QUALITY_REPAIR_THRESHOLD,
  selectBackgroundDirection,
  selectFilmShape,
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
  foundationSeams,
  foundationTimeline,
} from "../../src/ai/generation-foundation";

describe("Motionly AI Prompt and Choreography Rules", () => {
  it("names the failure mode it exists to prevent, and the handoff vocabulary", () => {
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "Small boxes adrift in empty space",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("The frame is filled");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("Available Motionly helpers");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("MORPH");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("MATCH-CUT");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("PARTICLE-REASSEMBLE");
  });

  it("leads with the concept step, not with an interface", () => {
    // The whole point: a product film is the product's mechanism, not its UI.
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("Write the transformation chain");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("The interface test");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("It is furniture");
    // A concept-first prompt must not tell the model to reach for a UI first.
    expect(MOTIONLY_SYSTEM_PROMPT).not.toMatch(/prefer a UI DEMO/i);
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("Scaling to the requested");
  });

  it("teaches the scene-clearing rule the runtime validator throws on", () => {
    // validate-generation's assertNoStaleLayers rejects the whole generation
    // when a data-scene layer survives into the next beat. Dropping this rule
    // from the skill turned that into a routine hard failure for users.
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("Clear the outgoing beat");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("reverse hierarchy");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("autoAlpha: 0");
    // The carrier is the deliberate exception and must stay untagged.
    // The rule this replaced only forbade the carrier from carrying a
    // `data-scene` tag of its own, so a carrier nested inside a scene container
    // obeyed the letter of it and was still cleared with that beat.
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "The carrier lives outside every scene container",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "a *sibling* of the `data-scene` containers",
    );
  });

  it("names the same five film shapes the per-request brief selects", () => {
    // The system prompt and buildFilmShapeBrief must agree; when they disagreed
    // the system prompt won and every request became a dashboard.
    for (const shape of [
      "transformation",
      "hero-object",
      "editorial",
      "data",
      "task",
    ]) {
      expect(MOTIONLY_SYSTEM_PROMPT).toContain(shape);
    }
    expect(buildFilmShapeBrief("ad for my security scanner")).toContain(
      "FILM SHAPE: TRANSFORMATION",
    );
  });
  it("unifies the system prompt across gemini-server and prompt.ts", () => {
    expect(serverPrompt).toBe(MOTIONLY_SYSTEM_PROMPT);
  });

  it("keeps reference-grade camera and hold guidance internally consistent", () => {
    // The rule this replaced — a camera tween on every beat, contrasting with
    // its neighbour — is what produced push, pull, push, pull in real output.
    expect(MOTIONLY_SYSTEM_PROMPT).not.toContain(
      "Fill each beat with its camera move",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "The camera is still when the type is moving",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("One dominant direction per film");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "A statement beat is the statement, alone",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("lastWordSettled");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "No stretch longer than 1.6s may pass with nothing scheduled",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).not.toContain(
      "CONTINUOUS LIFE (NO FROZEN HOLDS)",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).not.toContain(
      "authentic 260px dark sidebar",
    );
  });
  it("retrieves useful registry metadata and skill contracts per request", async () => {
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

    const message = await buildMotionlyUserMessage("Animate a SaaS launch", {});
    expect(message).toContain("Bundled skill: write-motionly");
    expect(message).toContain("RETRIEVED HYPERFRAMES REFERENCES");
    expect(message).toContain("not callable Motionly functions");
    expect(message).not.toContain("RELEVANT SKILL CONTRACTS");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("data-field");
    expect(message).toContain("GENERATION CONTEXT");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("data-hyperframe-component");
  });

  it("includes project conversation and required supplied image tokens", async () => {
    const message = await buildMotionlyUserMessage("Use my product shot", {
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
    // An unclassified image is still placeable, and it is declared required.
    expect(message).toContain("IMAGES TO PLACE");
    expect(message).toContain("Each one is required");
    expect(message).toContain("No reference images supplied.");
    expect(message).toContain("LOCAL EDITOR OVERRIDES");
    expect(message).toContain("sine.inOut");
  });

  it("routes notes prompts to a causal paper-and-signal background", async () => {
    const direction = selectBackgroundDirection(
      "Make a premium notes app ad with voice transcription",
    );
    expect(direction.system).toContain("paper structure");
    expect(direction.progression).toContain("resolves into the app mark");
    expect(direction.avoid).toContain("generic aurora");

    const message = await buildMotionlyUserMessage(
      "Make a premium notes app ad with voice transcription",
      {},
    );
    expect(message).toContain("paper structure");
    expect(message).toContain("PRODUCT VISUAL IDENTITY");
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
      seams: [
        {
          from: "scene-01",
          to: "scene-02",
          at: 3.5,
          duration: 1,
          carrier: "story-carrier",
          mechanism: "morph" as const,
          becomes: "the hook plate stretches into the product shell",
        },
        {
          from: "scene-02",
          to: "scene-03",
          at: 7.5,
          duration: 1,
          carrier: "story-carrier",
          mechanism: "match-cut" as const,
          becomes: "the shell holds its silhouette into the resolve",
        },
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
        const carrier = root.querySelector('[data-edit="story-carrier"]');
        const world = root.querySelector('.world');
        timeline.set([copy, carrier], { autoAlpha: 0 }, 0);
        timeline.fromTo(copy, { y: 40 }, { y: 0, duration: 0.5 }, 0.1);
        timeline.fromTo(carrier, { scale: 0.9 }, { scale: 1, duration: 0.5 }, 0.2);
        timeline.fromTo(world, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "sine.out" }, 0.3);
        wordSlideRotate(timeline, copy, { at: 0.2 });
        giantKineticCrop(timeline, copy, { at: 0.2 });
        timeline.to(carrier, { x: 40, duration: 0.5 }, 1);
        timeline.to(carrier, { x: 80, duration: 0.5 }, 2);
        timeline.to(carrier, { x: 120, duration: 0.5 }, 3);
        morph(timeline, carrier, { width: 600 }, { at: 4 });
        timeline.to(carrier, { rotation: 4, duration: 0.5 }, 5);
        timeline.to(carrier, { rotation: 0, duration: 0.5 }, 6);
        timeline.to(world, { x: -900, scale: 1.1, duration: 1.2, ease: EASE.cameraRamp }, 3);
        timeline.to(world, { x: -940, scale: 1.12, duration: 2.2, ease: "sine.inOut" }, 4.4);
        timeline.to(world, { x: -1400, scale: 1.45, duration: 1.2, ease: EASE.cameraRamp }, 7.6);
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
      seams: foundationSeams,
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
      "Re-theme every colour, radius, and type choice",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("Make each state physical");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("persist through the chain");
    // Preservation on edits lives in the runtime law, which ships ahead of
    // the skill in the same prompt.
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "Preserve existing IDs and editor overrides on edits",
    );
  });
  it("carries the motion doctrine seam and timing law", () => {
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("match axis, direction, velocity");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "exitStart >= lastWordSettled + readingHold",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "Never `bounce.out` or `elastic.out`",
    );
    const routing = buildSkillRoutingBrief("Animate a SaaS launch");
    expect(routing).toContain("Bundled skill: write-motionly");
    expect(routing).not.toContain("motion-doctrine");
  });
  it("states the observed motion laws rather than abstract principles", () => {
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "The camera never stops and never resets",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("Type enters cropped and settles");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("Action causes result");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "The resolve is a pullback from the proof",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("A corridor of material at depth");
    // The measured facts, not adjectives: without these the model reverts to
    // small cards on flat white.
    // The rule this replaced forced every statement to one large size. Measured
    // frame by frame, the reference varies threefold within a single film, and
    // that spread is what gives the film shape.
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "Size varies enormously, and the variation is the point",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "The oversized moment comes from the camera, not the type",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "Objects carry the film; type punctuates it",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("The ground is a lit space");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("The accent word");
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

  it("adapts the visual identity to each product instead of reusing Claude chrome", async () => {
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
    expect(notes).toContain("organized finished document");
    expect(notes).toContain(
      "navigation, sidebars, and an entire application shell are not required",
    );
    expect(notes).toContain("bright neutral ground");

    const message = await buildMotionlyUserMessage("premium notes app ad", {});
    expect(message).toContain("PRODUCT VISUAL IDENTITY");
    expect(message).toContain("organized finished document");
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("Make each state physical");
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
    expect(covered).toContain("brand-close");
    expect(new Set(roles.map((entry) => entry.item.name)).size).toBe(
      roles.length,
    );
    expect(buildRegistryBrief("AI assistant with a typed prompt")).toContain(
      "role: interaction",
    );
  });

  it("replays the previous plan so follow-ups continue the same film", async () => {
    const message = await buildMotionlyUserMessage("make the ending slower", {
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
    expect(flagged).not.toContain("build the application surface");
    expect(flagged).toContain("generic placeholder");
    expect(flagged).toContain("positional rather than descriptive");
    // This fixture is broken because only opacity changes. Three content
    // cards alone must not force a non-UI ad to build an application shell.
    expect(report.blockingIssues.join(" ")).toContain(
      "opacity alone is not animation",
    );
    expect(report.requiresRepair).toBe(true);
    // Taste-level notes stay advisory and must not join the blocking set.
    expect(report.blockingIssues.join(" ")).not.toContain(
      "generic placeholder",
    );
  });

  it("blocks a truncated timeline before it reaches the runtime", () => {
    const report = analyzeMotionQuality({
      duration: 8,
      scenes: scenes(2),
      compositionHtml: `<template><main data-edit="stage"><h1 data-edit="headline">Ship it</h1></main></template>`,
      // Output that ran out of tokens mid-statement.
      timelineJs: `export function buildTimeline({ timeline }) {
        timeline.set(headline, { autoAlpha: 0 }, 0);
        timeline.to(headline, { y: 0, autoAlpha: 1, dur`,
      reply: "Done",
    });
    expect(report.blockingIssues.join(" ")).toContain(
      "timeline.js does not parse",
    );
  });

  it("does not mistake a valid timeline for a broken one", () => {
    const report = analyzeMotionQuality({
      duration: 8,
      scenes: scenes(2),
      compositionHtml: `<template><main data-edit="stage"><h1 data-edit="headline">Ship it</h1></main></template>`,
      timelineJs: `export function buildTimeline({ root, timeline }) {
        const headline = root.querySelector('[data-edit="headline"]');
        timeline.set(headline, { autoAlpha: 0 }, 0);
        timeline.to(headline, { y: 0, autoAlpha: 1, duration: 1 }, 0.4);
      }`,
      reply: "Done",
    });
    expect(report.issues.join(" ")).not.toContain("does not parse");
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

describe("component source injection", () => {
  it("hands the model real component source, not just names", async () => {
    const message = await buildMotionlyUserMessage(
      "Create a promo video for Pulse, an AI customer feedback tool",
      {},
    );
    expect(message).toContain("AUTHORED SOURCE FOR THE SELECTED COMPONENTS");
    // Real CSS from a real component, not a one-line description.
    expect(message).toMatch(/<style>[\s\S]{400,}<\/style>/);
    expect(message).toContain("role: chaos-state");
    // The runtime contract must travel with the source it could violate.
    expect(MOTIONLY_SYSTEM_PROMPT).toContain("never start independent clocks");
  });

  it("carries enough source to be a visual standard", async () => {
    const withSource = await buildMotionlyUserMessage("notes app launch", {});
    const marker = withSource.indexOf(
      "AUTHORED SOURCE FOR THE SELECTED COMPONENTS",
    );
    const block = withSource.slice(
      marker,
      withSource.indexOf("Prefer these existing mechanics", marker),
    );
    expect(block.length).toBeGreaterThan(4000);
    expect(block.split("--- ").length - 1).toBeGreaterThanOrEqual(3);
  });
});

describe("new-generation context omits the UI foundation", () => {
  const foundationFiles = {
    compositionHtml: `<template><main data-edit="stage" data-motionly-generation-profile="claude-foundation-v1"><div data-edit="product-sidebar">Northstar</div></main></template>`,
    timelineJs:
      "export function buildTimeline({ timeline }) { timeline.to({}, {}); }",
    generationProfile: "claude-foundation-v1" as const,
  };

  it("asks for a new film rather than an edit when starting from the foundation", async () => {
    const message = await buildMotionlyUserMessage(
      "Brand teaser for Ledger, a finance app for freelancers",
      foundationFiles,
    );
    expect(message).toContain("CREATE a new composition from scratch");
    expect(message).not.toContain("EDIT the existing composition");
    expect(message).not.toContain("Current composition.html:");
    expect(message).not.toContain("CRAFT REFERENCE");
    expect(message).not.toContain(foundationFiles.compositionHtml);
    expect(message).toContain("There is nothing to preserve");
  });

  it("omits the whole foundation instead of asking the model not to copy it", async () => {
    const message = await buildMotionlyUserMessage(
      "Brand teaser for Ledger",
      foundationFiles,
    );
    expect(message).not.toContain(foundationFiles.compositionHtml);
    expect(message).not.toContain(foundationFiles.timelineJs);
  });

  it("still edits in place once the user has a composition of their own", async () => {
    const message = await buildMotionlyUserMessage("make the ending slower", {
      compositionHtml: `<template><main data-edit="stage">${"a".repeat(200)}</main></template>`,
      timelineJs: "export function buildTimeline() {}",
      generationProfile: "existing",
    });
    expect(message).toContain("EDIT the existing composition");
    expect(message).toContain("Current composition.html:");
    expect(message).toContain("Preserve every existing data-edit id");
    expect(message).not.toContain("CRAFT REFERENCE");
  });
});

describe("a conversation product is a task film, not a transformation one", () => {
  // "Make a motion graphic of user chatting to claude" used to route to
  // transformation: the model was handed scroll-feed and radial-surround, told
  // not to show an application shell, and returned a static shell built from
  // none of the chat mechanics the registry carries.
  it("routes conversation requests to task", () => {
    for (const prompt of [
      "Make a motion graphic of user chatting to claude",
      "user chatting with an AI assistant",
      "show the chat interface",
      "a conversation with a copilot",
      "a messaging app demo",
    ]) {
      expect(selectFilmShape(prompt)).toBe("task");
    }
  });

  it("retrieves conversation mechanics for them", () => {
    const names = selectReferenceRoles(
      "user chatting with an AI assistant",
    ).map((entry) => entry.item.name);
    expect(names).toContain("chat-thread");
    expect(names).toContain("typed-prompt");
  });

  it("does not swallow neighbouring shapes", () => {
    // hero-object and editorial are tested before task, so these stay put.
    expect(selectFilmShape("logo sting for a chat app")).toBe("hero-object");
    expect(selectFilmShape("kinetic typography about conversation")).toBe(
      "editorial",
    );
    expect(selectFilmShape("ad for my AI security scanner")).toBe(
      "transformation",
    );
  });
});

describe("retrieval follows the kind of film that was asked for", () => {
  it("does not hand a brand teaser an application surface", async () => {
    const prompt =
      "Make a 20-second brand teaser for Ledger, a personal finance app for freelancers. End on the Ledger logo.";
    expect(selectFilmShape(prompt)).toBe("hero-object");
    const names = selectReferenceRoles(prompt).map((entry) => entry.item.name);
    expect(names).not.toContain("browser-device-stage");
    expect(names).not.toContain("skeleton-reveal");
    const message = await buildMotionlyUserMessage(prompt, {});
    expect(message).toContain("FILM SHAPE: HERO-OBJECT");
    expect(message).toContain("This film has a subject, not a screen");
  });

  it("does not hand a pure typography film a UI interaction", () => {
    const prompt =
      "A pure kinetic typography film about shipping fast. No interface at all.";
    expect(selectFilmShape(prompt)).toBe("editorial");
    const names = selectReferenceRoles(prompt).map((entry) => entry.item.name);
    expect(names).not.toContain("browser-device-stage");
    expect(names).not.toContain("typed-prompt");
    expect(names).not.toContain("press-ripple");
  });

  it("reaches the chaos mechanic a problem-and-fix promo actually needs", () => {
    const prompt =
      "Promo for Pulse. Show how overwhelming customer feedback can be, then show Pulse making sense of it.";
    expect(selectFilmShape(prompt)).toBe("transformation");
    const roles = selectReferenceRoles(prompt);
    expect(roles.map((entry) => entry.role)).toContain("chaos-state");
    expect(roles.map((entry) => entry.item.name)).toContain(
      "overwhelm-surround",
    );
  });

  it("still builds a product surface when the request asks to see the interface", () => {
    const prompt = "Walk through the settings screen of our mobile app";
    expect(selectFilmShape(prompt)).toBe("task");
    expect(selectReferenceRoles(prompt).map((entry) => entry.role)).toContain(
      "product-surface",
    );
  });

  it("injects source for whichever shape was chosen, not a fixed UI set", async () => {
    const message = await buildMotionlyUserMessage(
      "Logo sting for an energy drink brand",
      {},
    );
    const start = message.indexOf(
      "AUTHORED SOURCE FOR THE SELECTED COMPONENTS",
    );
    const block = message.slice(
      start,
      message.indexOf("Prefer these existing mechanics", start),
    );
    expect(block.split("--- ").length - 1).toBeGreaterThanOrEqual(3);
    expect(block).not.toContain("browser-device-stage (role:");
  });
});

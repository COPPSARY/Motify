import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CompositionRuntime } from "../../src/composition/runtime";
import { motionlyPromoPreset as demoComposition } from "../../src/compositions/presets";

let runtime: CompositionRuntime;
let root: HTMLDivElement;

beforeAll(() => {
  root = document.createElement("div");
  document.body.append(root);
  runtime = new CompositionRuntime(demoComposition, root);
});

afterAll(() => {
  runtime?.destroy();
  document.body.replaceChildren();
});

describe("code-first composition runtime", { timeout: 60_000 }, () => {
  it("builds the product film directly from HTML and GSAP", () => {
    expect(runtime.timeline.duration()).toBeCloseTo(
      demoComposition.duration,
      3,
    );
    expect(runtime.root.querySelector(".promo")).not.toBeNull();
    expect(runtime.elements.has("final-cta")).toBe(true);
    expect(runtime.elements.has("build-question")).toBe(true);
  });

  it("seeks deterministically across scenes and frame boundaries", () => {
    runtime.seek(3.75);
    expect(runtime.snapshot.sceneId).toBe("problem");
    expect(runtime.time).toBeCloseTo(3.75, 3);
    const solutionsStart = demoComposition.scenes.find(
      (scene) => scene.id === "solutions",
    )?.start;
    expect(solutionsStart).toBeTypeOf("number");
    runtime.seek((solutionsStart ?? 0) + 0.1);
    expect(runtime.snapshot.sceneId).toBe("solutions");
    runtime.seek(100);
    expect(runtime.time).toBe(demoComposition.duration);
  });

  it("supports play, pause, restart, and visual overrides without a conversion layer", () => {
    runtime.play();
    expect(runtime.snapshot.playing).toBe(true);
    runtime.pause();
    expect(runtime.snapshot.playing).toBe(false);
    runtime.setOverride("final-cta", { x: 20, opacity: 0.8, text: "Ship it" });
    const cta = runtime.elements.get("final-cta");
    expect(cta?.textContent).toBe("Ship it");
    expect(cta?.style.translate).toBe("20px 0px");
    expect(cta?.style.opacity).toBe("0.8");
    runtime.restart();
    expect(runtime.snapshot.playing).toBe(true);
  });

  it("resumes a complete frame after forward and reverse timeline scrubs", () => {
    runtime.seek(27.2);
    runtime.seek(5.1);
    runtime.seek(23.7);
    runtime.seek(22.4);

    const headline = runtime.elements.get("final-headline");
    expect(headline).not.toBeNull();

    runtime.play();
    expect(runtime.snapshot.playing).toBe(true);
    expect(runtime.time).toBeCloseTo(22.4, 1);
  });

  it("preserves animated split-text spans when the editor changes copy", () => {
    const line = runtime.elements.get("build-question");
    expect(line?.dataset["motionlySplitUnit"]).toBe("chars");
    const animatedPieces = line?.children.length ?? 0;
    expect(animatedPieces).toBeGreaterThan(0);

    runtime.setOverride("build-question", { text: "SHIP IT" });

    expect(line?.textContent).toBe("SHIP IT");
    expect(line?.children.length).toBe(animatedPieces);
  });

  it("composes editor appearance overrides without erasing GSAP motion", () => {
    const title = runtime.elements.get("final-headline");

    runtime.setOverride("final-headline", {
      x: 24,
      scale: 1.04,
      color: "#ff705e",
      backgroundColor: "#17191c",
      fontSize: 118,
      borderRadius: 8,
    });
    runtime.seek(1);

    expect(title?.style.translate).toBe("24px 0px");
    expect(title?.style.scale).toBe("1.04");
    expect(title?.style.color).toBe("rgb(255, 112, 94)");
    expect(title?.style.backgroundColor).toBe("rgb(23, 25, 28)");
    expect(title?.style.fontSize).toBe("118px");
    expect(title?.style.borderRadius).toBe("8px");
  });

  it("edits registered layer animation timing and visibility", () => {
    const layer = runtime.elements.get("intro-brand-name");
    expect(layer).toBeDefined();

    const initial = runtime.getAnimationOverride("intro-brand-name");
    expect(initial.tweenCount).toBeGreaterThan(0);

    runtime.setAnimationOverride("intro-brand-name", {
      speed: 1.4,
      ease: "sine.inOut",
    });
    expect(runtime.getAnimationOverride("intro-brand-name")).toMatchObject({
      speed: 1.4,
      ease: "sine.inOut",
    });

    runtime.setOverride("intro-brand-name", { hidden: true });
    expect(layer?.style.visibility).toBe("hidden");
    runtime.setOverride("intro-brand-name", { hidden: false });
    expect(layer?.style.visibility).toBe("");
  });

  it("exports and restores visual, animation, and tween editor state", () => {
    runtime.setOverride("intro-brand-name", { x: 12, scale: 1.1 });
    runtime.setAnimationOverride("intro-brand-name", {
      speed: 1.2,
      ease: "sine.inOut",
    });
    const tween = runtime.getTweenDescriptors("intro-brand-name")[0];
    expect(tween).toBeDefined();
    if (!tween) throw new Error("Expected an intro tween.");
    runtime.setTweenOverride("intro-brand-name", tween.id, { duration: 0.75 });

    const state = runtime.exportEditorState();
    expect(state.elements["intro-brand-name"]).toMatchObject({
      x: 12,
      scale: 1.1,
    });
    expect(state.animations["intro-brand-name"]).toMatchObject({ speed: 1.2 });
    expect(state.tweens[tween.id]).toMatchObject({ duration: 0.75 });
  });
});

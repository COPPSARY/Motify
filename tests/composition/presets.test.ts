import { describe, expect, it } from "vitest";
import gsap from "gsap";
import * as presets from "../../src/composition/presets";

describe("GSAP-first motion presets", () => {
  it("ships a focused professional preset surface", () => {
    expect(Object.keys(presets).sort()).toEqual([
      "EASE",
      "ambientBreathing",
      "ambientFloat",
      "ambientWaves",
      "anticipate",
      "blurReveal",
      "cameraPull",
      "cameraPush",
      "cameraZoomPan",
      "captionPop",
      "charSpringBounce",
      "continuousTextGradient",
      "cutTheCurve",
      "editorialTextReveal",
      "errorWobble",
      "giantKineticCrop",
      "gradientSweep",
      "growAndComplete",
      "impactShake",
      "inverseZoomThrough",
      "kineticAnchor",
      "macroSettle",
      "maskReveal",
      "maskWipe",
      "matchCut",
      "morph",
      "motionArc",
      "perspectiveCardReveal",
      "pullbackComplete",
      "punchIn",
      "reveal",
      "rotateReveal",
      "scalePop",
      "sceneHandoff",
      "slide",
      "splitText",
      "spring",
      "squashAndStretch",
      "staggerEntrance",
      "staggerExit",
      "stepSurgeCounter",
      "textReveal",
      "waterfallTextReveal",
      "wordSlideRotate",
      "zoomThrough",
    ]);
  });

  it("composes overlapping motion into a caller-owned timeline", () => {
    const timeline = gsap.timeline({ paused: true });
    const card = document.createElement("div");
    const title = document.createElement("h1");
    title.textContent = "Motion graphics";
    presets.slide(timeline, card, { at: 0, direction: "up" });
    presets.textReveal(timeline, title, { at: 0.18, unit: "words" });
    expect(timeline.getChildren().length).toBeGreaterThanOrEqual(2);
    expect(title.querySelectorAll("span")).toHaveLength(3);
  });

  it("supports masks, camera moves, morphs, and stagger without hidden state", () => {
    const timeline = gsap.timeline({ paused: true });
    const camera = document.createElement("div");
    const firstCard = document.createElement("div");
    const secondCard = document.createElement("div");
    const cards = [firstCard, secondCard];

    presets.cameraPush(timeline, camera, { scale: 1.15, at: 0 });
    presets.maskWipe(timeline, firstCard, { direction: "right", at: 0.2 });
    presets.morph(
      timeline,
      secondCard,
      { borderRadius: 24, scale: 1.05 },
      { at: 0.4 },
    );
    presets.staggerEntrance(timeline, cards, { at: 0.6, stagger: 0.1 });

    expect(timeline.getChildren().length).toBeGreaterThanOrEqual(4);
  });

  it("executes advanced motion primitives from .agents skills cleanly", () => {
    const timeline = gsap.timeline({ paused: true });
    const box = document.createElement("div");
    const counter = document.createElement("span");
    const targetA = document.createElement("div");
    const targetB = document.createElement("div");

    presets.squashAndStretch(timeline, box, { factor: 0.2, at: 0 });
    presets.anticipate(timeline, box, { distance: 20, at: 0.5 });
    presets.motionArc(timeline, box, {
      startX: 0,
      startY: 0,
      endX: 200,
      endY: 100,
      at: 0.8,
    });
    presets.impactShake(timeline, box, { intensity: 12, at: 1.5 });
    presets.errorWobble(timeline, box, { distance: 10, at: 2.0 });
    presets.ambientBreathing(timeline, box, { at: 2.5 });
    presets.ambientFloat(timeline, box, { at: 3.0 });
    presets.stepSurgeCounter(timeline, counter, {
      start: 0,
      end: 92,
      suffix: "%",
      at: 3.5,
    });
    presets.perspectiveCardReveal(timeline, box, { at: 4.8 });
    presets.matchCut(timeline, targetA, targetB, { at: 5.5 });
    presets.maskReveal(timeline, box, { shape: "circle", at: 6.0 });
    presets.punchIn(timeline, box, { scale: 1.15, at: 6.8 });
    presets.captionPop(timeline, counter, { activeColor: "#10b981", at: 7.2 });
    presets.cutTheCurve(timeline, {
      outgoing: targetA,
      incoming: targetB,
      at: 7.6,
    });
    presets.zoomThrough(timeline, {
      outgoing: targetA,
      incoming: targetB,
      at: 8.2,
    });
    presets.inverseZoomThrough(timeline, {
      outgoing: targetA,
      incoming: targetB,
      at: 8.8,
    });

    expect(timeline.getChildren().length).toBeGreaterThanOrEqual(16);
    expect(counter.textContent).toBe("0%");
  });
});

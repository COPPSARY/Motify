import { describe, expect, it } from "vitest";
import gsap from "gsap";
import {
  growAndComplete,
  kineticAnchor,
  macroSettle,
  pullbackComplete,
} from "../../src/composition/presets";

/**
 * Rule 3 treatments, checked against what they render rather than against the
 * calls they make. Each of these used to be a sentence in the direction that
 * the build turn re-implemented as an opacity fade, so the assertions here are
 * about physical state at specific seconds.
 */
function stage(markup: string): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;left:-100000px;top:-100000px;width:1920px;height:1080px";
  root.innerHTML = markup;
  document.body.append(root);
  return root;
}

function at(timeline: gsap.core.Timeline, time: number): void {
  timeline.seek(time);
}

describe("the Pullback Complete", () => {
  it("settles a cropped fragment, then opens room the tail slides into", () => {
    const root = stage(
      `<div data-edit="camera"><h1 data-edit="lead">Claude is</h1><h1 data-edit="tail">everywhere.</h1></div>`,
    );
    const lead = root.querySelector<HTMLElement>('[data-edit="lead"]')!;
    const tail = root.querySelector<HTMLElement>('[data-edit="tail"]')!;
    const camera = root.querySelector<HTMLElement>('[data-edit="camera"]')!;
    const timeline = gsap.timeline({ paused: true });

    pullbackComplete(timeline, lead, tail, {
      camera,
      at: 0,
      startScale: 2.6,
      endScale: 1,
      hold: 0.5,
    });

    // The lead opens oversized and cropped, and the tail is not on screen yet.
    at(timeline, 0.9);
    const layer = lead.querySelector<HTMLElement>(
      ".motionly-text-motion-layer",
    )!;
    expect(gsap.getProperty(layer, "scale")).toBeGreaterThan(2);
    expect(Number(gsap.getProperty(tail, "opacity"))).toBeLessThan(0.1);

    // After the retreat the line is at reading size and the tail has arrived.
    at(timeline, 3.2);
    expect(Number(gsap.getProperty(layer, "scale"))).toBeCloseTo(1, 1);
    expect(Number(gsap.getProperty(camera, "scale"))).toBeCloseTo(1, 1);
    expect(Number(gsap.getProperty(tail, "opacity"))).toBeGreaterThan(0.9);

    // Measured off the reference: the tail resolves in the room the retreat
    // opened, lifting a few pixels rather than travelling in from off-screen.
    const words = tail.querySelectorAll<HTMLElement>(".motionly-split-item");
    expect(words.length).toBeGreaterThan(0);
    at(timeline, 2.05);
    expect(Math.abs(Number(gsap.getProperty(words[0]!, "y")))).toBeGreaterThan(
      0,
    );
    expect(Number(gsap.getProperty(words[0]!, "xPercent"))).toBe(0);
    root.remove();
  });
});

describe("Macro Settle", () => {
  it("arrives at 300% and blurred, and is sharp before it stops moving", () => {
    const root = stage(`<h1 data-edit="line">Filing is instant</h1>`);
    const line = root.querySelector<HTMLElement>('[data-edit="line"]')!;
    const timeline = gsap.timeline({ paused: true });

    macroSettle(timeline, line, { at: 0, duration: 0.85, startScale: 3 });
    const layer = line.querySelector<HTMLElement>(
      ".motionly-text-motion-layer",
    )!;

    at(timeline, 0.02);
    expect(Number(gsap.getProperty(layer, "scale"))).toBeGreaterThan(2.5);
    expect(String(gsap.getProperty(layer, "filter"))).toMatch(/blur\((?!0px)/);

    // Focus resolves ahead of the movement: sharp at 0.7s, settled by 0.85s.
    at(timeline, 0.72);
    expect(String(gsap.getProperty(layer, "filter"))).toMatch(/blur\(0px\)/);

    at(timeline, 0.9);
    expect(Number(gsap.getProperty(layer, "scale"))).toBeCloseTo(1, 1);
    root.remove();
  });
});

describe("Kinetic Anchor", () => {
  it("never moves the anchor while the rest of the line travels around it", () => {
    const root = stage(
      `<div><span data-edit="anchor">Claude</span><span data-edit="rest">is everywhere now</span></div>`,
    );
    const anchor = root.querySelector<HTMLElement>('[data-edit="anchor"]')!;
    const rest = root.querySelector<HTMLElement>('[data-edit="rest"]')!;
    const timeline = gsap.timeline({ paused: true });

    kineticAnchor(timeline, anchor, rest, { at: 0, distance: 120 });
    const words = rest.querySelectorAll<HTMLElement>(".motionly-split-item");
    expect(words.length).toBeGreaterThan(1);

    for (const time of [0.05, 0.4, 0.9, 1.4]) {
      at(timeline, time);
      expect(Number(gsap.getProperty(anchor, "x"))).toBe(0);
      expect(Number(gsap.getProperty(anchor, "y"))).toBe(0);
      expect(Number(gsap.getProperty(anchor, "rotation"))).toBe(0);
    }

    // The travelling words arrive from opposite sides, so the line reads as
    // movement around the anchor rather than one block sliding in.
    at(timeline, 0.05);
    const first = Number(gsap.getProperty(words[0]!, "x"));
    const second = Number(gsap.getProperty(words[1]!, "x"));
    expect(Math.sign(first)).not.toBe(Math.sign(second));

    at(timeline, 1.6);
    for (const word of words) {
      expect(Number(gsap.getProperty(word, "x"))).toBeCloseTo(0, 1);
      expect(Number(gsap.getProperty(word, "rotation"))).toBeCloseTo(0, 1);
    }
    root.remove();
  });
});

describe("Grow and Complete", () => {
  it("grows the fragment while the rest of the line lands beside it", () => {
    const root = stage(
      `<div><h1 data-edit="lead">Import</h1><h1 data-edit="tail">your own voiceovers</h1></div>`,
    );
    const lead = root.querySelector<HTMLElement>('[data-edit="lead"]')!;
    const tail = root.querySelector<HTMLElement>('[data-edit="tail"]')!;
    const timeline = gsap.timeline({ paused: true });

    growAndComplete(timeline, lead, tail, { at: 0, duration: 0.5 });
    const layer = lead.querySelector<HTMLElement>(
      ".motionly-text-motion-layer",
    )!;

    // Opens small and centred, with the tail not yet readable.
    at(timeline, 0.02);
    expect(Number(gsap.getProperty(layer, "scale"))).toBeLessThan(0.7);
    const words = tail.querySelectorAll<HTMLElement>(".motionly-split-item");
    expect(Number(gsap.getProperty(words[0]!, "opacity"))).toBeLessThan(0.2);

    // Grown to full size with the sentence complete, inside 0.75s.
    at(timeline, 0.78);
    expect(Number(gsap.getProperty(layer, "scale"))).toBeCloseTo(1, 1);
    for (const word of words) {
      expect(Number(gsap.getProperty(word, "opacity"))).toBeGreaterThan(0.9);
      expect(Number(gsap.getProperty(word, "y"))).toBeCloseTo(0, 1);
    }
    root.remove();
  });
});

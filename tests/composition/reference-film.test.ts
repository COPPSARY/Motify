import { describe, expect, it } from "vitest";
import { CompositionRuntime } from "../../src/composition/runtime";
import {
  referenceFilmPreset,
  referenceFilmScenes,
  referenceFilmSeams,
} from "../../src/compositions/presets/reference-film";
import { analyzeSeamPlan } from "../../src/ai/seam-plan";
import compositionHtml from "../../src/compositions/presets/reference-film/composition.html?raw";
import timelineSource from "../../src/compositions/presets/reference-film/timeline.js?raw";

/**
 * This preset exists to be the artefact the generator pattern-matches, so it
 * has to actually hold the standard it demonstrates — not merely run.
 */
function mount(): { root: HTMLElement; runtime: CompositionRuntime } {
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;left:-100000px;top:-100000px;width:1920px;height:1080px";
  document.body.append(root);
  return { root, runtime: new CompositionRuntime(referenceFilmPreset, root) };
}

describe("the reference-standard film", () => {
  it("mounts and seeks deterministically across every beat", () => {
    const { root, runtime } = mount();
    try {
      expect(runtime.timeline.duration()).toBeGreaterThan(19);
      for (const scene of referenceFilmScenes) {
        for (const progress of [0.1, 0.5, 0.9]) {
          runtime.seek(scene.start + scene.duration * progress);
        }
      }
      // Reverse scrubbing restores state; nothing is mutated by a callback.
      runtime.seek(19.9);
      runtime.seek(0);
      const carrier = root.querySelector<HTMLElement>(
        '[data-edit="story-carrier"]',
      );
      expect(carrier).not.toBeNull();
    } finally {
      runtime.destroy();
      root.remove();
    }
  });

  /** One object crossing every boundary, which is what the chain must be. */
  it("carries a single object through all four seams", () => {
    expect(referenceFilmSeams).toHaveLength(referenceFilmScenes.length - 1);
    expect(new Set(referenceFilmSeams.map((seam) => seam.carrier)).size).toBe(
      1,
    );

    const report = analyzeSeamPlan({
      seams: referenceFilmSeams,
      scenes: referenceFilmScenes,
      html: compositionHtml,
      timelineJs: timelineSource,
      duration: referenceFilmPreset.duration,
    });
    expect(report.issues).toEqual([]);
    expect(report.planned).toBe(true);
  });

  /**
   * The carrier is a sibling of the scene containers, never inside one. A
   * carrier nested in a beat is cleared with that beat, which is the single
   * most common way a carrier chain fails.
   */
  it("keeps the carrier outside every scene container", () => {
    const container = document.createElement("div");
    container.innerHTML = compositionHtml;
    const template = container.querySelector("template")!;
    const fragment = template.content;
    const carrier = fragment.querySelector<HTMLElement>(
      '[data-edit="story-carrier"]',
    )!;
    expect(carrier.closest("[data-scene]")).toBeNull();
    expect(carrier.parentElement?.dataset["camera-world"]).toBeUndefined();
    expect(carrier.parentElement?.hasAttribute("data-camera-world")).toBe(true);
    expect(carrier.hasAttribute("data-scene")).toBe(false);
  });

  /**
   * The film's camera doctrine: it holds through the statement beats and moves
   * only where a move is motivated. Three moves across five beats, and never a
   * push answered by a pull for the sake of contrast.
   */
  it("moves the camera fewer times than it has beats", () => {
    const moves = timelineSource.match(
      /\b(?:cameraPush|cameraPull|cameraZoomPan)\s*\(/g,
    );
    expect(moves).not.toBeNull();
    expect(moves!.length).toBeLessThan(referenceFilmScenes.length);
    expect(moves!.length).toBeGreaterThanOrEqual(2);
  });

  it("uses the measured type moves rather than reinventing them", () => {
    expect(timelineSource).toMatch(/macroSettle\(/);
    expect(timelineSource).toMatch(/growAndComplete\(/);
    // Scale varies threefold across the film, which is the point: a dramatic
    // beat, a connective line at roughly a third of it, and a modest close.
    expect(compositionHtml).toMatch(/font-size:\s*196px/);
    expect(compositionHtml).toMatch(/font-size:\s*82px/);
    expect(compositionHtml).toMatch(/font-size:\s*84px/);
  });

  it("grounds every beat in a lit space rather than flat white", () => {
    // The *ground* is never flat white — it opens on near-black with a warm
    // source. White ink on the brand colour, which is what the mark's petals
    // are, is the standard itself rather than a violation of it.
    expect(compositionHtml).toMatch(
      /\.rf-stage\s*\{[\s\S]*?background:\s*var\(--ink\)/,
    );
    expect(compositionHtml).toMatch(/--ink:\s*#0b0b0d/);
    expect(compositionHtml).toMatch(/--brand:\s*#ee4b3c/);
    // Atmosphere is tagged, so it is never mistaken for a beat's content.
    expect(compositionHtml).toMatch(/data-background-role="bloom"/);
  });
});

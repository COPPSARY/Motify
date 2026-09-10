import { describe, expect, it } from "vitest";
import gsap from "gsap";
import {
  tesseraPreset,
  tesseraScenes,
  tesseraSeams,
} from "../../src/compositions/presets/tessera";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("Tessera data-contract film", () => {
  it("tiles five beats across 20 seconds with straddling seams", () => {
    expect(tesseraPreset.duration).toBe(20);
    expect(tesseraScenes.map((s) => s.id)).toEqual([
      "claim",
      "stream",
      "gate",
      "shape",
      "brand",
    ]);
    let end = 0;
    for (const scene of tesseraScenes) {
      expect(scene.start).toBeCloseTo(end);
      end = scene.start + scene.duration;
    }
    expect(end).toBe(20);
    for (const seam of tesseraSeams) {
      const boundary = tesseraScenes.find((s) => s.id === seam.to)!.start;
      expect(seam.at).toBeLessThan(boundary);
      expect(seam.at + seam.duration).toBeGreaterThan(boundary);
    }
  });

  it("carries its material through the gate and seeks deterministically", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(tesseraPreset, root);
    expect(runtime.timeline.duration()).toBeCloseTo(20);
    expect(root.innerHTML).not.toContain("__ASSET_");

    // The carrier crosses every boundary, so it lives outside every scene.
    for (const id of new Set(tesseraSeams.map((s) => s.carrier))) {
      expect(
        root.querySelector(`[data-edit="${id}"]`)!.closest("[data-scene]"),
      ).toBeNull();
    }

    // Nothing is switched off by a timed zero-duration hide.
    const abruptHides = runtime.timeline
      .getChildren(true, true, false)
      .filter(
        (tween) =>
          tween.startTime() > 0 &&
          tween.duration() === 0 &&
          (tween.vars.autoAlpha === 0 ||
            tween.vars.opacity === 0 ||
            tween.vars.visibility === "hidden"),
      );
    expect(abruptHides).toEqual([]);

    const state = () =>
      [...root.querySelectorAll("[data-edit],.motionly-split-item")].map((e) =>
        ["x", "y", "z", "scaleX", "rotationY", "opacity"].map((property) =>
          gsap.getProperty(e, property),
        ),
      );
    runtime.seek(19.9);
    runtime.seek(0);
    for (const time of [1.2, 4.6, 7.2, 10.4, 12.6, 15.5, 18.6]) {
      runtime.seek(time);
      const before = state();
      runtime.seek(19.9);
      runtime.seek(0);
      runtime.seek(time);
      expect(state()).toEqual(before);
    }

    // Each record carries both its source's own shape and the contract's.
    const one = root.querySelector('[data-edit="tessRecordOne"]')!;
    const text = one.textContent!.replace(/\s+/g, " ");
    expect(text).toContain("stripe");
    expect(text).toContain("ts");
    expect(text).toContain("timestamp");
    expect(root.querySelectorAll(".tess-record").length).toBe(8);
    runtime.destroy();
    root.remove();
  });
});

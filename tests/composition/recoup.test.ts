import { describe, expect, it } from "vitest";
import gsap from "gsap";
import {
  recoupPreset,
  recoupScenes,
  recoupSeams,
} from "../../src/compositions/presets/recoup";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("Recoup failed-payment SaaS ad", () => {
  it("tiles five beats across 26 seconds with straddling seams", () => {
    expect(recoupPreset.duration).toBe(26);
    expect(recoupScenes.map((s) => s.id)).toEqual([
      "leak",
      "ledger",
      "pitch",
      "retry",
      "result",
      "brand",
    ]);

    let end = 0;
    for (const scene of recoupScenes) {
      expect(scene.start).toBeCloseTo(end);
      end = scene.start + scene.duration;
    }
    expect(end).toBe(26);

    for (const seam of recoupSeams) {
      const boundary = recoupScenes.find((s) => s.id === seam.to)!.start;
      expect(seam.at).toBeLessThan(boundary);
      expect(seam.at + seam.duration).toBeGreaterThan(boundary);
      // One outline changing is what makes this a film rather than a slideshow.
      expect(seam.carrier).toBe("rcpCard");
    }
  });

  it("is built on one 3D camera rig and real glass panes", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(recoupPreset, root);

    // Depth is authored, never faked with scale: the rig is preserve-3d and
    // the panes sit at distinct z values inside it.
    const cam = root.querySelector('[data-edit="rcpCam"]')!;
    expect(cam.hasAttribute("data-camera-world")).toBe(true);
    runtime.seek(6.5);
    const depths = ["rcpCard", "rcpPlateB", "rcpPlateC", "rcpPlateD"].map(
      (id) =>
        Number(
          gsap.getProperty(root.querySelector(`[data-edit="${id}"]`)!, "z"),
        ),
    );
    expect(new Set(depths).size).toBe(4);

    // Every pane is glass: a translucent plate over a moving ground.
    expect(root.querySelectorAll(".lg").length).toBeGreaterThanOrEqual(5);
    expect(root.querySelectorAll(".lg-spec").length).toBeGreaterThanOrEqual(5);

    runtime.destroy();
    root.remove();
  });

  it("keeps one carrier outside every scene and seeks deterministically", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(recoupPreset, root);

    expect(runtime.timeline.duration()).toBeCloseTo(26);
    expect(root.innerHTML).not.toContain("__ASSET_");

    // The carrier survives every beat's clear only by living outside them.
    const carrier = root.querySelector('[data-edit="rcpCard"]')!;
    expect(carrier.closest("[data-scene]")).toBeNull();
    expect(carrier.hasAttribute("data-transition-carrier")).toBe(true);

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
    runtime.seek(25.9);
    runtime.seek(0);
    for (const time of [1.4, 5.6, 8.6, 11.2, 13.6, 16.4, 19.8, 23.8]) {
      runtime.seek(time);
      const before = state();
      runtime.seek(25.9);
      runtime.seek(0);
      runtime.seek(time);
      expect(state()).toEqual(before);
    }

    runtime.destroy();
    root.remove();
  });

  it("shows a real interface whose arithmetic agrees with itself", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(recoupPreset, root);

    // Four real declined charges with real decline reasons, not filler bars.
    const world = root
      .querySelector('[data-edit="rcpCam"]')!
      .textContent!.replace(/\s+/g, " ");
    expect(world).toContain("Insufficient funds");
    expect(world).toContain("Card expired");
    expect(root.querySelectorAll(".rcp-plate-in").length).toBe(4);

    // A viewer who pauses and adds up the charges must not catch the film
    // lying: at-risk, recovered and the rate all have to reconcile.
    const amounts = [...root.querySelectorAll(".rcp-plate-in .rcp-amount")].map(
      (el) => Number(el.textContent!.replace(/[^0-9.]/g, "")),
    );
    const atRisk = amounts.reduce((sum, value) => sum + value, 0);
    expect(atRisk).toBe(7410);

    runtime.seek(21.2);
    const recovered = Number(
      root
        .querySelector('[data-edit="rcpRecoveredValue"]')!
        .textContent!.replace(/[^0-9.]/g, ""),
    );
    const rate = Number(
      root
        .querySelector('[data-edit="rcpRateValue"]')!
        .textContent!.replace(/[^0-9.]/g, ""),
    );
    expect(recovered).toBe(6795);
    expect(rate).toBeCloseTo((recovered / atRisk) * 100, 1);

    // Money is grouped, not printed as a bare integer.
    expect(
      root.querySelector('[data-edit="rcpRecoveredValue"]')!.textContent,
    ).toBe("$6,795");

    runtime.destroy();
    root.remove();
  });
});

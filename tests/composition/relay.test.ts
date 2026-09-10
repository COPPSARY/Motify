import { describe, expect, it } from "vitest";
import gsap from "gsap";
import { relayPreset, relayScenes } from "../../src/compositions/presets/relay";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("Relay review and handoff film", () => {
  it("keeps the approved brief through delivery and restores it after reverse seeks", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(relayPreset, root);
    const get = (id: string) => root.querySelector(`[data-edit="${id}"]`)!;
    expect(runtime.timeline.duration()).toBe(26);
    expect(
      relayScenes.reduce((end, scene) => {
        expect(scene.start).toBe(end);
        return end + scene.duration;
      }, 0),
    ).toBe(26);
    expect(get("relayPaper").closest("[data-scene]")).toBeNull();
    runtime.seek(12);
    for (const name of ["Copy", "Sound", "Final"]) {
      expect(
        gsap.getProperty(get(`relay${name}Check`), "strokeDashoffset"),
      ).toBe(0);
    }
    runtime.seek(20);
    expect(gsap.getProperty(get("relayDeliveredFace"), "opacity")).toBe(1);
    expect(get("relayDeliveredFace").textContent).toContain("Version 04");
    const state = () =>
      [...root.querySelectorAll("[data-edit]")].map((el) =>
        ["x", "y", "width", "height", "scaleX", "rotationY", "opacity"].map(
          (p) => gsap.getProperty(el, p),
        ),
      );
    for (const at of [2.5, 7.6, 12.5, 16.2, 19.6, 24.5]) {
      runtime.seek(at);
      const before = state();
      runtime.seek(25.99);
      runtime.seek(0);
      runtime.seek(at);
      expect(state()).toEqual(before);
    }
    runtime.destroy();
    root.remove();
  });
});

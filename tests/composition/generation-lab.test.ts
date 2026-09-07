import { describe, expect, it } from "vitest";
import { motionlyPromoPreset } from "../../src/compositions/presets";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("Motionly Promo Preset", () => {
  it("defines motionly promo composition properly", () => {
    expect(motionlyPromoPreset.duration).toBeGreaterThan(0);
    expect(motionlyPromoPreset.fps).toBe(60);
    expect(motionlyPromoPreset.scenes.length).toBeGreaterThan(0);
  });

  it("mounts and seeks across key timestamps", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(motionlyPromoPreset, root);

    expect(runtime.timeline.duration()).toBeGreaterThan(0);

    for (const t of [0, 2.0, 5.0, 10.0, 15.0]) {
      expect(() => runtime.seek(t)).not.toThrow();
    }

    runtime.destroy();
    root.remove();
  });
});

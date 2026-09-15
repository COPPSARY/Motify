import { describe, expect, it } from "vitest";
import { motifyPreset } from "../../src/compositions/presets";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("Motify launch film preset", () => {
  it("mounts the complete 52-second film and seeks deterministically", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(motifyPreset, root);

    expect(motifyPreset.duration).toBe(52);
    expect(motifyPreset.fps).toBe(60);
    expect(motifyPreset.scenes).toHaveLength(9);
    expect(runtime.timeline.duration()).toBe(52);
    expect(root.textContent).toContain("Meet Motify");

    for (const at of [0, 10.2, 22.5, 36.15, 51.9]) {
      expect(() => runtime.seek(at)).not.toThrow();
    }

    runtime.destroy();
    root.remove();
  });
});

import { describe, expect, it } from "vitest";
import gsap from "gsap";
import { recoupPreset } from "../../src/compositions/presets/recoup";
import { tesseraPreset } from "../../src/compositions/presets/tessera";
import { relayPreset } from "../../src/compositions/presets/relay";
import { CompositionRuntime } from "../../src/composition/runtime";

/**
 * The opening frame is a frame like any other.
 *
 * `timeline.totalTime(t)` is a no-op when the playhead already sits at `t`, so
 * nothing re-renders. At the origin that silently dropped every zero-duration
 * `set()` authored at position 0 — the entire opening state of a composition —
 * because a timeline is created at 0 and immediately seeked to 0. The preview
 * opened on unposed elements at their raw CSS defaults and only corrected
 * itself once the playhead moved. `CompositionRuntime.renderAt` forces the
 * render; this guards it for every preset.
 */
describe("the first frame is the authored opening state", () => {
  for (const [label, preset] of [
    ["Recoup", recoupPreset],
    ["Tessera", tesseraPreset],
    ["Relay", relayPreset],
  ] as const) {
    it(`${label} opens on the same frame you get by scrubbing back to 0`, () => {
      const root = document.createElement("div");
      document.body.append(root);
      const runtime = new CompositionRuntime(preset as never, root);

      const pose = () =>
        [...root.querySelectorAll("[data-edit]")].map((el) =>
          ["xPercent", "yPercent", "opacity", "scaleX"]
            .map((p) => String(gsap.getProperty(el as HTMLElement, p)))
            .join(","),
        );

      runtime.seek(0);
      const opening = pose();
      runtime.seek(0.05);
      runtime.seek(0);
      expect(pose()).toEqual(opening);

      // A composition centres its layers at position 0, so an opening frame
      // that never flushed those sets leaves everything at xPercent 0.
      expect(opening.some((p) => p.startsWith("-50,"))).toBe(true);

      runtime.destroy();
      root.remove();
    });
  }
});

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

describe("deferred entrances do not flash before they start", () => {
  const film = (
    build: (
      els: Record<string, HTMLElement>,
      timeline: gsap.core.Timeline,
    ) => void,
  ) => ({
    id: "deferred",
    title: "Deferred",
    width: 1920,
    height: 1080,
    fps: 60,
    duration: 4,
    scenes: [{ id: "scene-01", label: "One", start: 0, duration: 4 }],
    build({
      root,
      timeline,
    }: {
      root: HTMLElement;
      timeline: gsap.core.Timeline;
    }) {
      root.innerHTML =
        '<h1 data-edit="headline">Hi</h1><p data-edit="kicker">K</p><ul data-edit="list"><li>a</li><li>b</li><li>c</li></ul>';
      const el = (id: string) =>
        root.querySelector<HTMLElement>('[data-edit="' + id + '"]')!;
      build(
        { headline: el("headline"), kicker: el("kicker"), list: el("list") },
        timeline,
      );
    },
  });

  const mount = (definition: ReturnType<typeof film>) => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(definition as never, root);
    return { root, runtime };
  };
  const opacity = (el: Element) => Number(gsap.getProperty(el, "opacity"));

  it("holds an immediateRender:false entrance at its from state until it plays", () => {
    let kicker!: HTMLElement;
    const { runtime, root } = mount(
      film((els, timeline) => {
        kicker = els.kicker!;
        timeline.fromTo(
          kicker,
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.5, immediateRender: false },
          1,
        );
      }),
    );
    expect(opacity(kicker)).toBe(0);
    runtime.seek(0.5);
    expect(opacity(kicker)).toBe(0);
    expect(gsap.getProperty(kicker, "y")).toBe(24);
    runtime.seek(2);
    expect(opacity(kicker)).toBe(1);
    // Scrubbing back before the entrance hides it again.
    runtime.seek(0.5);
    expect(opacity(kicker)).toBe(0);
    runtime.seek(0);
    expect(opacity(kicker)).toBe(0);
    runtime.destroy();
    root.remove();
  });

  it("hides every staggered item until its own turn", () => {
    let list!: HTMLElement;
    const { runtime, root } = mount(
      film((els, timeline) => {
        list = els.list!;
        timeline.fromTo(
          list.children,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, stagger: 0.5, immediateRender: false },
          0,
        );
      }),
    );
    runtime.seek(0.2);
    expect([...list.children].map(opacity)).toEqual([expect.any(Number), 0, 0]);
    runtime.seek(3);
    expect([...list.children].map(opacity)).toEqual([1, 1, 1]);
    runtime.destroy();
    root.remove();
  });

  it("leaves a property alone when an earlier tween owns its opening state", () => {
    let headline!: HTMLElement;
    const { runtime, root } = mount(
      film((els, timeline) => {
        headline = els.headline!;
        timeline.to(headline, { opacity: 0.5, duration: 0.5 }, 0.5);
        timeline.fromTo(
          headline,
          { opacity: 0 },
          { opacity: 1, duration: 0.5, immediateRender: false },
          2,
        );
      }),
    );
    expect(opacity(headline)).toBe(1);
    runtime.destroy();
    root.remove();
  });
});

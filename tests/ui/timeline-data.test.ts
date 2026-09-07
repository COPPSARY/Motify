import { describe, expect, it } from "vitest";
import gsap from "gsap";
import type { SceneDefinition } from "../../src/composition/types";
import {
  deriveSceneTracks,
  formatTimelineSeconds,
} from "../../src/ui/timeline-data";

function scene(overrides: Partial<SceneDefinition> = {}): SceneDefinition {
  return {
    id: "intro",
    label: "Intro",
    start: 0,
    duration: 10,
    accent: "#fff",
    ...overrides,
  };
}

describe("timeline editor data", () => {
  it("formats floating-point timing without precision noise", () => {
    expect(formatTimelineSeconds(4.65 * 1.5)).toBe("6.98s");
    expect(formatTimelineSeconds(11.625)).toBe("11.63s");
    expect(formatTimelineSeconds(5)).toBe("5s");
  });

  it("only exposes authored tracks backed by registered editable elements", () => {
    const authored: SceneDefinition = {
      id: "intro",
      label: "Intro",
      start: 0,
      duration: 3,
      accent: "#fff",
      tracks: [
        { id: "real-layer", label: "Real", kind: "Text", start: 0, end: 2 },
        {
          id: "missing-layer",
          label: "Missing",
          kind: "Text",
          start: 1,
          end: 3,
        },
      ],
    };
    const registered = new Map([
      ["real-layer", document.createElement("span")],
    ]);

    expect(
      deriveSceneTracks(authored, registered).map((track) => track.id),
    ).toEqual(["real-layer"]);
  });

  it("reports clips in master-timeline seconds, including nested timelines", () => {
    const shell = document.createElement("div");
    const badge = document.createElement("div");
    const timeline = gsap.timeline({ paused: true });
    timeline.to(shell, { x: 40, duration: 1 }, 2);
    const nested = gsap.timeline();
    // Parent-relative 0.5s inside a nested timeline placed at 5s on the master.
    nested.to(badge, { y: 20, duration: 1 }, 0.5);
    timeline.add(nested, 5);

    const tracks = deriveSceneTracks(
      scene(),
      new Map([
        ["shell", shell],
        ["badge", badge],
      ]),
      timeline,
    );
    const byId = new Map(tracks.map((track) => [track.id, track]));

    expect(byId.get("shell")?.start).toBeCloseTo(2, 2);
    expect(byId.get("shell")?.end).toBeCloseTo(3, 2);
    expect(byId.get("badge")?.start).toBeCloseTo(5.5, 2);
    expect(byId.get("badge")?.end).toBeCloseTo(6.5, 2);

    timeline.kill();
  });

  it("credits a child tween to its registered ancestor", () => {
    const headline = document.createElement("h1");
    const word = document.createElement("span");
    headline.append(word);
    const timeline = gsap.timeline({ paused: true });
    timeline.to(word, { y: 0, duration: 0.5 }, 3);

    const tracks = deriveSceneTracks(
      scene(),
      new Map([["headline", headline]]),
      timeline,
    );

    expect(tracks[0]?.start).toBeCloseTo(3, 2);
    expect(tracks[0]?.end).toBeCloseTo(3.5, 2);

    timeline.kill();
  });

  it("omits layers whose motion falls outside the selected beat", () => {
    const early = document.createElement("div");
    const late = document.createElement("div");
    const timeline = gsap.timeline({ paused: true });
    timeline.to(early, { x: 10, duration: 1 }, 0.5);
    timeline.to(late, { x: 10, duration: 1 }, 6);

    const tracks = deriveSceneTracks(
      scene({ start: 5, duration: 4 }),
      new Map([
        ["early", early],
        ["late", late],
      ]),
      timeline,
    );

    expect(tracks.map((track) => track.id)).toEqual(["late"]);
    expect(tracks[0]?.start).toBeCloseTo(6, 2);

    timeline.kill();
  });

  it("falls back to the scene window in master seconds", () => {
    const tracks = deriveSceneTracks(scene({ start: 12, duration: 4 }));
    expect(tracks[0]?.start).toBe(12);
    expect(tracks[0]?.end).toBe(16);
  });
});

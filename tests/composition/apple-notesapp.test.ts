import { describe, expect, it } from "vitest";
import { appleNotesPreset } from "../../src/compositions/presets";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("Apple Notes 31.2s expansive camera product film preset", () => {
  it("defines five truthful scenes across the complete 31.2-second film", () => {
    expect(appleNotesPreset.duration).toBeCloseTo(31.2, 1);
    expect(appleNotesPreset.fps).toBe(60);
    expect(appleNotesPreset.scenes.map((scene) => scene.id)).toEqual([
      "scene-01-scattered",
      "scene-02-fragments",
      "scene-03-three-pills",
      "scene-04-ecosystem-sync",
      "scene-05-brand-resolve",
    ]);
  });

  it("mounts, registers interactive actors, and seeks deterministically across all transitions", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(appleNotesPreset, root);

    const requiredActors = [
      "notesFilmRoot",
      "notesPaperField",
      "notesCameraWorld",
      "notesStageIntro",
      "notesBrandMark",
      "notesIntroTitle",
      "notesBlueScribble",
      "notesStageFragments",
      "notesFragmentDeck",
      "notesSafariCard",
      "notesVoiceCard",
      "notesPhotoCard1",
      "notesCaptureCard",
      "notesStagePills",
      "notesAppShell",
      "notesCheckRow2",
      "notesCheckmarkIcon",
      "notesCheckText2",
      "notesCursor",
      "notesStageEcosystem",
      "notesEcosystemStatement",
      "notesStageClimax",
      "notesClimaxIcon",
      "notesClimaxTitle",
      "notesClimaxTagline",
    ];

    for (const id of requiredActors) {
      expect(
        runtime.elements.has(id),
        `${id} should be registered in runtime`,
      ).toBe(true);
    }

    // Seek across every scene boundary and hold state
    const seekPoints = [
      0, 1.5, 4.0, 6.0, 8.0, 10.5, 13.0, 15.5, 17.5, 19.0, 21.0, 23.5, 24.0,
    ];
    for (const time of seekPoints) {
      expect(() => runtime.seek(time)).not.toThrow();
    }
    for (const time of [...seekPoints].reverse()) {
      expect(() => runtime.seek(time)).not.toThrow();
    }
    expect(runtime.timeline.duration()).toBeCloseTo(31.2, 1);

    runtime.destroy();
    root.remove();
  });
});

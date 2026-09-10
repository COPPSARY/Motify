import { describe, expect, it } from "vitest";
import gsap from "gsap";
import {
  kiriTtsPreset,
  kiriTtsScenes,
  kiriTtsSeams,
} from "../../src/compositions/presets/KiriTTS";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("KiriTTS complete audio workflow", () => {
  it("covers the 48-second story with continuous handoff windows", () => {
    expect(kiriTtsPreset.duration).toBe(48);
    expect(kiriTtsScenes.map((s) => s.id)).toEqual([
      "hook",
      "intro",
      "tts",
      "voices",
      "stt",
      "export",
      "features",
      "brand",
    ]);
    let end = 0;
    for (const scene of kiriTtsScenes) {
      expect(scene.start).toBeCloseTo(end);
      end = scene.start + scene.duration;
    }
    expect(end).toBe(48);
    for (const seam of kiriTtsSeams) {
      const boundary = kiriTtsScenes.find((s) => s.id === seam.to)!.start;
      expect(seam.at).toBeLessThan(boundary);
      expect(seam.at + seam.duration).toBeGreaterThan(boundary);
    }
  });
  it("never instantly hides an outgoing actor and keeps shared objects outside scenes", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(kiriTtsPreset, root);
    expect(runtime.timeline.duration()).toBeCloseTo(48);
    expect(root.innerHTML).not.toContain("__ASSET_");
    for (const id of new Set(kiriTtsSeams.map((s) => s.carrier))) {
      expect(
        root.querySelector(`[data-edit="${id}"]`)!.closest("[data-scene]"),
      ).toBeNull();
    }
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
    runtime.seek(47.9);
    runtime.seek(0);
    const state = () =>
      [...root.querySelectorAll("[data-edit],.motionly-split-item")].map((e) =>
        ["x", "y", "scaleX", "scaleY", "rotation", "opacity"].map((property) =>
          gsap.getProperty(e, property),
        ),
      );
    for (const time of [
      1.5, 4.8, 9.7, 15.9, 18.9, 25.8, 30.5, 36.2, 38.8, 40.3,
    ]) {
      runtime.seek(time);
      const before = state();
      runtime.seek(47.9);
      runtime.seek(0);
      runtime.seek(time);
      expect(state()).toEqual(before);
    }
    const text = (id: string) =>
      root
        .querySelector(`[data-edit="${id}"]`)!
        .textContent!.replace(/\s+/g, " ")
        .trim();
    expect(text("kiriMalySelect")).toContain("Maly");
    expect(text("kiriVoiceMenu")).toMatch(/Nita.*Chanda.*Maly.*Borey/s);
    expect(root.querySelectorAll(".kiri-voice-row")).toHaveLength(13);
    expect(root.querySelectorAll(".kiri-gallery-card")).toHaveLength(3);
    expect(root.querySelectorAll(".kiri-feature-card")).toHaveLength(2);
    for (const time of [8.5, 39.8, 42.5, 47]) {
      runtime.seek(time);
      const mark = root.querySelector('[data-edit="kiriBrandMark"]')!;
      expect(Number(gsap.getProperty(mark, "width"))).toBeCloseTo(300);
      expect(Number(gsap.getProperty(mark, "height"))).toBeCloseTo(300);
    }
    expect(text("kiriSpeakerOne")).toContain(
      "Welcome to Kiri TTS. Let me walk you through the recording.",
    );
    expect(text("kiriSpeakerTwo")).toContain("04.400");
    expect(text("kiriSpeakerThree")).toContain(
      "Great, the transcript is ready to export.",
    );
    expect(text("kiriExportControls")).toMatch(/SRT.*VTT.*JSON.*TXT.*CSV/);
    runtime.destroy();
    root.remove();
  });
});

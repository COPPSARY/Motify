import { describe, expect, it } from "vitest";
import { kiriTtsPreset } from "../../src/compositions/presets";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("KiriTTS SaaS Product Film Preset", () => {
  it("defines 5 authentic acts across 37.05 seconds", () => {
    expect(kiriTtsPreset.duration).toBeCloseTo(37.05, 1);
    expect(kiriTtsPreset.fps).toBe(60);
    expect(kiriTtsPreset.scenes.length).toBe(5);
    expect(kiriTtsPreset.scenes.map((s) => s.id)).toEqual([
      "act-01-linguistic",
      "act-02-tts",
      "act-03-stt",
      "act-04-clone-api",
      "act-05-climax",
    ]);
  });

  it("mounts every authentic actor, camera rig, cursor, and interactive control", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(kiriTtsPreset, root);

    const requiredActors = [
      "kiriFilmRoot",
      "kiriCameraWorld",
      "kiriAmbientGlow",
      "kiriCursor",
      "kiriCursorRipple",
      "kiriTopbar",
      "kiriTopBreadcrumb",
      "kiriBreadcrumbText",
      "kiriTopRightActions",
      "kiriTopCredits",
      "kiriTopAvatar",
      "kiriStageWorkspace",
      "kiriAct1Linguistic",
      "kiriAct1Headline",
      "kiriMonolithicBox",
      "kiriErrorBadge1",
      "kiriUnspacedScript",
      "kiriRobotWave",
      "kiriErrorBadge2",
      "kiriSegmentBeam",
      "kiriSegmentedWords",
      "kiriWordChip1",
      "kiriWordChip2",
      "kiriWordChip3",
      "kiriWordChip4",
      "kiriNativeSolvedBadge",
      "kiriAct2TtsStudio",
      "kiriLineEditor",
      "kiriVoicePill",
      "kiriExprToggles",
      "kiriEditorRow1",
      "kiriTypedKhmer",
      "kiriTtsCaret",
      "kiriEditorRow2",
      "kiriRow2Notice",
      "kiriBtnGenerate",
      "kiriAudioPlayerCard",
      "kiriEqWaveBars",
      "kiriRightSettingsPanel",
      "kiriStabilitySlider",
      "kiriFillStability",
      "kiriThumbStability",
      "kiriSpeedSlider",
      "kiriFillSpeed",
      "kiriThumbSpeed",
      "kiriAct3SttStudio",
      "kiriSttDropCard",
      "kiriDroppedAudioChip",
      "kiriBtnExportSrt",
      "kiriDiarizeStream",
      "kiriDiarizeSpeaker1",
      "kiriTimestampPills",
      "kiriDiarizeSpeaker2",
      "kiriSrtSuccessBadge",
      "kiriAct4CloneApi",
      "kiriCloneCard",
      "kiri10sSampleBadge",
      "kiriProgressRing",
      "kiriProgCircle",
      "kiriVerifiedProfile",
      "kiriAmberDisclaimer",
      "kiriApiCard",
      "kiriApiHubLogo",
      "kiriEndpointBox",
      "kiriLiveCounter",
      "kiriAct5Climax",
      "kiriClimaxEmblem",
      "kiriClimaxHeadline",
      "kiriClimaxSubtitle",
      "kiriClimaxCtas",
      "kiriBtnGetStarted",
      "kiriCtaShimmer",
      "kiriEditorialStage",
      "kiriBeatIntro",
      "kiriBeatIntroText",
      "kiriBeatObstacle",
      "kiriBeatObstacleText",
      "kiriBeatSolution",
      "kiriBeatSolutionText",
      "kiriBannerStt",
      "kiriBannerClone",
    ];

    for (const id of requiredActors) {
      expect(
        runtime.elements.has(id),
        `${id} should be registered in KiriTTS runtime`,
      ).toBe(true);
    }

    // Seek across every scene boundary and interactive timestamp
    const seekPoints = [
      0, 2.0, 5.0, 5.5, 7.0, 9.65, 11.5, 12.0, 14.5, 16.65, 18.5, 20.0, 22.0,
      24.5, 26.5, 28.5,
    ];
    for (const time of seekPoints) {
      expect(() => runtime.seek(time)).not.toThrow();
    }
    for (const time of [...seekPoints].reverse()) {
      expect(() => runtime.seek(time)).not.toThrow();
    }

    expect(runtime.timeline.duration()).toBeCloseTo(37.05, 1);

    runtime.destroy();
    root.remove();
  });
});

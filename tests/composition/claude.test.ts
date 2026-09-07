import { describe, expect, it } from "vitest";
import { claudePreset } from "../../src/compositions/presets";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("Claude Calorie & Climax preset", () => {
  it("defines 4 authentic scenes across 24.5 seconds", () => {
    expect(claudePreset.duration).toBe(24.5);
    expect(claudePreset.fps).toBe(60);
    expect(claudePreset.scenes.length).toBe(4);
    expect(claudePreset.scenes.map((scene) => scene.id)).toEqual([
      "scene-01-calorie-inquiry",
      "scene-02-newchat-imagegen",
      "scene-03-claude-mobile",
      "scene-04-climax",
    ]);
  });

  it("mounts every authentic actor, camera, cursor, and interactive element", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(claudePreset, root);

    const requiredActors = [
      "claudeFilmRoot",
      "claudeCameraWorld",
      "claudeAmbientGlow",
      "claudeSidebar",
      "claudeSideBtnNew",
      "claudeStageWorkspace",
      "claudeHomeView",
      "claudeGreetingBox",
      "claudeSparkIcon",
      "claudeGreeting",
      "claudePromptShell",
      "claudeBorderBeamRect",
      "claudeAttachedChip",
      "claudePlaceholder",
      "claudeTypedInput",
      "claudePromptCaret",
      "claudeBtnAdd",
      "claudeModelBadge",
      "claudeBtnSend",
      "claudeScene2PromptView",
      "claudePromptShell2",
      "claudePlaceholder2",
      "claudeTypedInput2",
      "claudePromptCaret2",
      "claudeBtnAdd2",
      "claudePlusDropdown",
      "claudeDropdownCreateImage",
      "claudeBtnSend2",
      "claudeDraggedImage",
      "claudeCursor",
      "claudeCursorRipple",
      "claudeReplyThread",
      "claudeUserMessagePill",
      "claudeResponseText",
      "claudeArtifactCard",
      "claudeCalorieDetails",
      "claudeStreamSpark",
      "claudeBottomChatBar1",
      "claudeImageGenThread",
      "claudeSkyUserPill",
      "claudeThinkingRow",
      "claudeThinkingPill",
      "claudeThinkingText",
      "claudeSkyResponse",
      "claudeSkyResponseHeadline",
      "claudeSkyCard",
      "claudeBottomChatBar2",
      "claudeClimaxSequence",
      "claudeClimaxPrefix",
      "claudeClimaxEverywhereBox",
      "claudeClimaxEverywhere",
    ];

    for (const id of requiredActors) {
      expect(
        runtime.elements.has(id),
        `${id} should be registered in Claude runtime`,
      ).toBe(true);
    }

    for (const time of [
      0, 1.4, 2.5, 5.0, 7.8, 10.5, 14.0, 17.8, 20.0, 22.0, 24.5,
    ]) {
      expect(() => runtime.seek(time)).not.toThrow();
    }
    expect(runtime.timeline.duration()).toBeCloseTo(24.5, 1);

    runtime.destroy();
    root.remove();
  });
});

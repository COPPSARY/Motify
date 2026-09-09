import { describe, expect, it } from "vitest";
import { resolveGenerationBasis } from "../../src/ai/generation-basis";
import { buildMotionlyUserMessage } from "../../src/ai/generation-guidance";
import { claudePreset } from "../../src/compositions/presets";
import claudeHtmlSource from "../../src/compositions/presets/claude/composition.html?raw";
import claudeTimelineSource from "../../src/compositions/presets/claude/timeline.js?raw";
import claudeAdapterSource from "../../src/compositions/presets/claude/index.ts?raw";
import { splitCompositionSource } from "../../src/cloud/project-source";
import {
  BLANK_COMPOSITION_ID,
  blankProjectFiles,
  blankScenes,
} from "../../src/ui/blank-project";

const blankComposition = {
  id: BLANK_COMPOSITION_ID,
  duration: 5,
  scenes: blankScenes,
};

const claudeFiles = splitCompositionSource(
  claudeHtmlSource,
  claudeTimelineSource,
  claudeAdapterSource,
);

describe("a fresh editor generates a film instead of editing a preset", () => {
  it("opens on a blank project, not on a preset", () => {
    expect(blankProjectFiles["composition.html"]).not.toContain("Claude");
    expect(blankProjectFiles["composition.html"].length).toBeLessThan(600);
    expect(blankScenes).toHaveLength(1);
  });

  it("treats the empty stage as a new film, not an existing project", () => {
    const basis = resolveGenerationBasis(blankProjectFiles, blankComposition);
    expect(basis.generationProfile).toBe("claude-foundation-v1");
    expect(basis.files["composition.html"]).not.toContain(
      blankProjectFiles["composition.html"],
    );
  });

  it("never sends preset source when the user has not opened a preset", async () => {
    const basis = resolveGenerationBasis(blankProjectFiles, blankComposition);
    const message = await buildMotionlyUserMessage(
      "30 second ad for Northstar, a habit tracker",
      {
        compositionHtml: basis.files["composition.html"],
        timelineJs: basis.files["timeline.js"],
        generationProfile: basis.generationProfile,
      },
    );
    expect(message).toContain("CREATE a new composition from scratch");
    expect(message).not.toContain("EDIT the existing composition");
    expect(message).not.toContain(claudePreset.title);
    expect(message).not.toContain("calorie");
  });

  it("edits in place once the user opens a preset on purpose", () => {
    const basis = resolveGenerationBasis(claudeFiles, claudePreset);
    expect(basis.generationProfile).toBe("existing");
    expect(basis.files).toBe(claudeFiles);
    expect(basis.duration).toBe(claudePreset.duration);
  });
});

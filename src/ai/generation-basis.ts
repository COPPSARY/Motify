import type { ProjectSourceFiles } from "../cloud/projects-api";
import type { SceneDefinition } from "../composition/types";
import {
  GENERATION_FOUNDATION_PROFILE,
  foundationFiles,
  foundationScenes,
} from "./generation-foundation";

export type GenerationProfile = "claude-foundation-v1" | "existing";

export interface GenerationBasis {
  files: ProjectSourceFiles;
  duration: number;
  scenes: readonly SceneDefinition[];
  generationProfile: GenerationProfile;
}

/** The parts of the mounted composition the basis decision depends on. */
export interface BasisComposition {
  id: string;
  duration: number;
  scenes: readonly SceneDefinition[];
}

/**
 * Below this the stage holds a scaffold, not a film: the blank project's
 * markup is a stage element and nothing else.
 */
const AUTHORED_COMPOSITION_MIN_LENGTH = 1200;

/**
 * What the next generation is actually working on.
 *
 * "existing" prints the current source under an EDIT instruction, so it must
 * mean the user's own film — a project they generated, opened, or picked from
 * the Presets tab. An empty editor is a `claude-foundation-v1` CREATE instead,
 * where foundation metadata supplies compatibility defaults. Its complete
 * markup and timeline are omitted from the model message to avoid UI anchoring.
 */
export function resolveGenerationBasis(
  files: ProjectSourceFiles,
  composition: BasisComposition,
): GenerationBasis {
  const currentSource = files["composition.html"] ?? "";
  const needsFoundation =
    currentSource.length < AUTHORED_COMPOSITION_MIN_LENGTH ||
    (composition.id.startsWith("dynamic-comp-") &&
      !currentSource.includes(GENERATION_FOUNDATION_PROFILE));
  if (needsFoundation) {
    return {
      files: {
        "composition.html": foundationFiles.compositionHtml,
        "styles.css": "",
        "timeline.js": foundationFiles.timelineJs,
        "index.ts": "",
      },
      duration: 20,
      scenes: foundationScenes,
      generationProfile: "claude-foundation-v1",
    };
  }
  return {
    files,
    duration: composition.duration,
    scenes: composition.scenes,
    generationProfile: "existing",
  };
}

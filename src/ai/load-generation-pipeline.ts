export type GenerationPipeline = typeof import("./generation-pipeline");

let pipeline: Promise<GenerationPipeline> | null = null;

/**
 * Loads the generation pipeline once; later calls share the same download.
 * Kept apart from the pipeline itself so importing this costs nothing.
 */
export function loadGenerationPipeline(): Promise<GenerationPipeline> {
  pipeline ??= import("./generation-pipeline");
  return pipeline;
}

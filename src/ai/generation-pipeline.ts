/**
 * Everything a generation needs: the model client, the system prompt, the
 * validators and the frame observer. Loaded through `loadGenerationPipeline`
 * so it never ships with the first page load.
 */
export { BackendConversationResponse, generateWithDirectAi } from "./direct-ai";
export {
  isFatalRenderFailure,
  validateGeneratedComposition,
} from "./validate-generation";
export { userEditedIds } from "./generation-guidance";
export { resolveGenerationBasis } from "./generation-basis";
export { observeCandidateFilm } from "../ui/frame-capture";

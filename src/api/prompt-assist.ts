import { fetchApi } from "./client";

/**
 * The prompt enhancer: rewrites a prompt the person wrote into a detailed one.
 * Free; it runs on a free model on the server and is rate limited per person.
 */

export type PromptSurface = "composer" | "guided" | "footage";

/** How many files of each kind sit next to the prompt, so the enhancer plans only what they can do. */
export interface PromptAttachments {
  images: number;
  videos: number;
  audio: number;
}

/** Counts attached files by their type. */
export function countAttachments(
  files: ReadonlyArray<{ mimeType?: string; type?: string }>,
  extraAudio = 0,
): PromptAttachments {
  const kind = (file: { mimeType?: string; type?: string }) =>
    file.mimeType ?? file.type ?? "";
  return {
    images: files.filter((file) => kind(file).startsWith("image/")).length,
    videos: files.filter((file) => kind(file).startsWith("video/")).length,
    audio:
      files.filter((file) => kind(file).startsWith("audio/")).length +
      extraAudio,
  };
}

export interface EnhancedPrompt {
  enhanced: string;
}

export async function enhancePrompt(input: {
  prompt: string;
  surface: PromptSurface;
  /** Whose Brand DNA tells the enhancer what the product is. */
  workspaceId?: string;
  /** The brand picked in the composer; null for none, absent for the default one. */
  brandId?: string | null;
  attachments?: PromptAttachments;
}): Promise<EnhancedPrompt> {
  const response = await fetchApi("/v1/prompts/enhance", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return ((await response.json()) as { data: EnhancedPrompt }).data;
}

import { fetchApi } from "./client";

/**
 * The prompt enhancer: rewrites a prompt the person wrote into a detailed one.
 * Free to the person; the server pays for the model call and rate limits it per person.
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

/** How an image was attached: to place in the film, as a style reference, or as the logo. */
export type PromptImageRole = "asset" | "reference" | "logo";

/** An attached image the page can show: `src` is any URL an <img> can load (usually a blob: URL). */
export interface PromptImageSource {
  name: string;
  role: PromptImageRole;
  src: string;
}

/** An attached image as the enhancer receives it. */
export interface PromptImage {
  name: string;
  role: PromptImageRole;
  dataUrl: string;
}

/** The most images the server looks at. */
export const MAX_PROMPT_IMAGES = 6;
/** Longest side of an image sent to the enhancer: enough to read a screenshot, small enough to send fast. */
const MAX_PROMPT_IMAGE_SIDE = 1024;

/**
 * Downscales the attached images so the enhancer can look at them. An image
 * that cannot be read (a broken or cross-origin URL) is left out rather than
 * failing the enhance.
 */
export async function preparePromptImages(
  sources: readonly PromptImageSource[],
): Promise<PromptImage[]> {
  const prepared = await Promise.all(
    sources.slice(0, MAX_PROMPT_IMAGES).map(async (source) => {
      try {
        return {
          name: source.name.slice(0, 200) || "image",
          role: source.role,
          dataUrl: await downscaleImage(source.src, source.role === "logo"),
        };
      } catch {
        return null;
      }
    }),
  );
  return prepared.filter((image): image is PromptImage => image !== null);
}

function downscaleImage(
  src: string,
  keepTransparency: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(
        1,
        MAX_PROMPT_IMAGE_SIDE /
          Math.max(image.naturalWidth, image.naturalHeight, 1),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("No canvas"));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // A logo keeps its transparency; a photo or screenshot travels as JPEG.
      resolve(
        keepTransparency
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", 0.85),
      );
    };
    image.onerror = () => reject(new Error("Image could not be read"));
    image.src = src;
  });
}

export async function enhancePrompt(input: {
  prompt: string;
  surface: PromptSurface;
  /** Whose Brand DNA tells the enhancer what the product is. */
  workspaceId?: string;
  /** The brand picked in the composer; null for none, absent for the default one. */
  brandId?: string | null;
  attachments?: PromptAttachments;
  /** The attached images themselves, so the enhancer plans from what they show. */
  images?: PromptImage[];
}): Promise<EnhancedPrompt> {
  const response = await fetchApi("/v1/prompts/enhance", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return ((await response.json()) as { data: EnhancedPrompt }).data;
}

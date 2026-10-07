import type { AssetIntent } from "../stores/local-assets";

/**
 * Reads an explicit image-use instruction from the user's own words.
 *
 * A bare attachment is intentionally left undecided here so callers can
 * choose the safest fallback for their context. The composer defaults that
 * case to an asset, while an already-attached project image keeps its saved
 * role until the user clearly changes it.
 */
export function inferAssetIntent(message: string): AssetIntent | null {
  const text = message.toLowerCase().replace(/\u2019/g, "'");

  // Reference-only wording wins when a sentence also contains a placement
  // verb, as in "do not show this image" or "use this as a reference".
  const useAsReference = [
    /\bas\s+(?:a\s+|an\s+|the\s+)?(?:visual\s+|style\s+|design\s+|layout\s+|motion\s+|animation\s+)?reference\b/,
    /\b(?:for|as)\s+(?:visual\s+|style\s+|design\s+)?inspiration\b/,
    /\b(?:reference|inspiration)\s+only\b/,
    /\b(?:match|mimic|follow|copy|borrow)\b[\s\S]{0,60}\b(?:style|look|layout|palette|colou?r|aesthetic|composition|spacing|typography|motion)\b/,
    /\b(?:do\s+not|don't|never)\s+(?:show|display|place|include|insert|render|put)\b/,
  ];
  if (useAsReference.some((pattern) => pattern.test(text))) return "reference";

  const placeExplicitly = [
    /\b(?:use|show|display|place|insert|include|feature|put|render|animate)\b[\s\S]{0,60}\b(?:this|that|the|attached|pasted|uploaded|my)?\s*(?:image|photo|picture|logo|product|product shot|screenshot|asset)\b/,
    /\b(?:use|put|place|show|display|include|feature|insert|render)\b[\s\S]{0,80}\b(?:in|inside|on|into|within)\s+(?:the\s+)?(?:video|film|animation|scene|(?:closing\s+)?frame|screen|composition)\b/,
    /\b(?:this|that|the|attached|pasted|uploaded)\s+(?:image|photo|picture|logo|product|product shot|screenshot|asset)\b[\s\S]{0,60}\b(?:in|inside|on|into)\s+(?:the\s+)?(?:video|film|animation|scene|frame|screen|composition)\b/,
    /\b(?:this|it|here)\s+(?:is\s+)?(?:my|our|their|the)\s+(?:product|logo|product shot|photo|image|screenshot)\b/,
    /\b(?:as|for)\s+(?:the\s+)?(?:background|hero image|product shot|logo|end card|closing frame|thumbnail)\b/,
  ];
  if (placeExplicitly.some((pattern) => pattern.test(text))) return "asset";

  return null;
}

/**
 * Explicit wording can change a saved role. With no such wording, a manual or
 * persisted choice is kept; only a brand-new ambiguous paste defaults to use.
 */
export function resolveAssetIntent(
  message: string,
  current?: AssetIntent,
): AssetIntent {
  return inferAssetIntent(message) ?? current ?? "asset";
}

/** Singular wording must not silently reclassify several attached images. */
export function appliesToAllImages(message: string): boolean {
  return /\b(?:all|every|these|those)\s+(?:(?:attached|pasted|uploaded|project)\s+)?(?:images|photos|pictures|logos|screenshots|assets)\b/i.test(
    message,
  );
}

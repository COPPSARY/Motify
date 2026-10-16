import type { PromptTemplate } from "../../api/prompt-templates";

/** The last template list loaded this session, so coming back to the page is instant. */
let cached: PromptTemplate[] | null = null;

export function cachedPromptTemplates(): PromptTemplate[] | null {
  return cached;
}

export function rememberPromptTemplates(templates: PromptTemplate[]): void {
  cached = templates;
}

/** Tests start each case from an empty cache. */
export function forgetPromptTemplates(): void {
  cached = null;
}

import { fetchApi } from "./client";

/** An editable input of a template, such as the concept or the colours. */
export interface PromptTemplateField {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
  placeholder: string;
  type: "text" | "number" | "textarea";
  min?: number;
  max?: number;
  step?: number;
}

/** A piece of the prompt: literal text, or a field's value with optional text around it. */
export type PromptTemplateSegment =
  { text: string } | { field: string; before?: string; after?: string };

export interface PromptTemplate {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  categories: string[];
  /** A signed preview URL, or null when the file is missing. */
  video: string | null;
  aspectRatio: "16:9" | "1:1" | "4:5" | "9:16";
  fields: PromptTemplateField[];
  prompt: PromptTemplateSegment[];
  defaultPrompt: string;
}

/** The value a field holds: what the person typed, else its default. */
export function fieldValue(
  field: PromptTemplateField,
  values: Readonly<Record<string, string>>,
): string {
  const typed = values[field.key]?.trim();
  return typed ? typed : field.defaultValue;
}

/** The template's prompt with each field filled in, ready to paste into Tiffy. */
export function renderPrompt(
  template: Pick<PromptTemplate, "fields" | "prompt">,
  values: Readonly<Record<string, string>> = {},
): string {
  const byKey = new Map(template.fields.map((field) => [field.key, field]));
  return template.prompt
    .map((segment) => {
      if ("text" in segment) return segment.text;
      const field = byKey.get(segment.field);
      if (!field) return "";
      return `${segment.before ?? ""}${fieldValue(field, values)}${segment.after ?? ""}`;
    })
    .join("");
}

export async function fetchPromptTemplates(): Promise<PromptTemplate[]> {
  const response = await fetchApi("/v1/prompt-templates");
  const { data } = (await response.json()) as { data?: PromptTemplate[] };
  if (!Array.isArray(data)) {
    throw new Error("The templates response was not understood.");
  }
  return data;
}

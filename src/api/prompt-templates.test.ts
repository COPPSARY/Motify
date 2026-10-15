import { describe, expect, it } from "vitest";

import {
  fieldValue,
  renderPrompt,
  type PromptTemplate,
} from "./prompt-templates";

const field = (key: string, defaultValue: string) => ({
  key,
  label: key,
  description: "",
  defaultValue,
  placeholder: "",
  type: "text" as const,
});

const template: Pick<PromptTemplate, "fields" | "prompt"> = {
  fields: [field("concept", "One seat"), field("colors", "sky blue")],
  prompt: [
    { text: "Make a video about " },
    { field: "concept" },
    { text: ". " },
    { field: "colors", before: "Use ", after: " throughout." },
  ],
};

describe("renderPrompt", () => {
  it("fills every field with its default", () => {
    expect(renderPrompt(template)).toBe(
      "Make a video about One seat. Use sky blue throughout.",
    );
  });

  it("uses what the person typed, and falls back when it is blank", () => {
    expect(
      renderPrompt(template, { concept: "  Fresh coffee ", colors: "  " }),
    ).toBe("Make a video about Fresh coffee. Use sky blue throughout.");
    expect(fieldValue(template.fields[0]!, { concept: "" })).toBe("One seat");
  });

  it("drops a segment that points at an unknown field", () => {
    expect(
      renderPrompt({ fields: [], prompt: [{ text: "A" }, { field: "nope" }] }),
    ).toBe("A");
  });
});

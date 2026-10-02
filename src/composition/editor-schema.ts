import type {
  EditorFieldBinding,
  EditorFieldDefinition,
  EditorFieldType,
  EditorGroupDefinition,
} from "./types";

const FIELD_TYPES = new Set<EditorFieldType>([
  "text",
  "number",
  "color",
  "image",
  "select",
  "range",
  "toggle",
]);

const SAFE_STYLE_PROPERTIES = new Set([
  "color",
  "backgroundColor",
  "borderRadius",
  "fontSize",
  "fontWeight",
  "fill",
  "height",
  "letterSpacing",
  "lineHeight",
  "opacity",
  "stroke",
  "width",
]);

const SAFE_ATTRIBUTES = new Set(["alt", "href", "src", "title"]);

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function numberAttribute(
  element: HTMLElement,
  name: string,
): number | undefined {
  const raw = element.getAttribute(name);
  if (raw === null || raw.trim() === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inferType(element: HTMLElement): EditorFieldType {
  if (element instanceof HTMLImageElement) return "image";
  if (element instanceof SVGElement) return "color";
  return "text";
}

function inferBinding(
  element: HTMLElement,
  type: EditorFieldType,
): { binding: EditorFieldBinding; property?: string } {
  if (type === "image") return { binding: "attribute", property: "src" };
  if (type === "color") {
    return element instanceof SVGElement
      ? { binding: "style", property: "fill" }
      : { binding: "style", property: "color" };
  }
  if (type === "number" || type === "range") {
    return { binding: "style", property: "fontSize" };
  }
  return { binding: "text" };
}

function fieldFromElement(element: HTMLElement): EditorFieldDefinition | null {
  const id = element.dataset["field"]?.trim();
  if (!id) return null;
  const requestedType = element.dataset["fieldType"] as
    EditorFieldType | undefined;
  const type =
    requestedType && FIELD_TYPES.has(requestedType)
      ? requestedType
      : inferType(element);
  const inferred = inferBinding(element, type);
  const requestedBinding = element.dataset["fieldBinding"] as
    EditorFieldBinding | undefined;
  const binding = requestedBinding ?? inferred.binding;
  const property = element.dataset["fieldProperty"] ?? inferred.property;

  if (
    binding === "style" &&
    (!property || !SAFE_STYLE_PROPERTIES.has(property))
  ) {
    return null;
  }
  if (
    binding === "attribute" &&
    (!property || !SAFE_ATTRIBUTES.has(property))
  ) {
    return null;
  }
  if (binding === "css-variable" && (!property || !property.startsWith("--"))) {
    return null;
  }

  return {
    id,
    label: element.dataset["fieldLabel"]?.trim() || titleCase(id),
    type,
    binding,
    target: element,
    property,
    min: numberAttribute(element, "data-field-min"),
    max: numberAttribute(element, "data-field-max"),
    step: numberAttribute(element, "data-field-step"),
    unit: element.dataset["fieldUnit"],
    options: element.dataset["fieldOptions"]
      ?.split("|")
      .map((option) => option.trim())
      .filter(Boolean),
  };
}

function fallbackFields(element: HTMLElement): EditorFieldDefinition[] {
  const image =
    element instanceof HTMLImageElement
      ? element
      : element.querySelectorAll<HTMLImageElement>("img").length === 1
        ? element.querySelector<HTMLImageElement>("img")
        : null;
  if (image) {
    return [
      {
        id: "image",
        label: image.alt.trim() || "Image",
        type: "image",
        binding: "attribute",
        property: "src",
        target: image,
      },
    ];
  }
  const tag = element.tagName.toLowerCase();
  if (/^(h[1-6]|p|span|strong|em|small|button)$/.test(tag)) {
    return [
      {
        id: "content",
        label: "Content",
        type: "text",
        binding: "text",
        target: element,
      },
    ];
  }
  const headingOrTextChild = element.querySelectorAll<HTMLElement>(
    "h1, h2, h3, h4, h5, h6, p, .editorial-thought, .motionly-text-motion-layer",
  );
  if (headingOrTextChild.length === 1 && headingOrTextChild[0]) {
    return [
      {
        id: "content",
        label: "Content",
        type: "text",
        binding: "text",
        target: headingOrTextChild[0],
      },
    ];
  }
  if (
    !element.querySelector("div, section, article, table, ul, ol, img, svg") &&
    Boolean(element.textContent?.trim())
  ) {
    return [
      {
        id: "content",
        label: "Content",
        type: "text",
        binding: "text",
        target: element,
      },
    ];
  }
  return [];
}

export function readEditorGroup(
  id: string,
  element: HTMLElement,
): EditorGroupDefinition {
  const declared = Array.from(
    element.querySelectorAll<HTMLElement>("[data-field]"),
  )
    .map(fieldFromElement)
    .filter((field): field is EditorFieldDefinition => field !== null);
  if (element.dataset["field"]) {
    const rootField = fieldFromElement(element);
    if (rootField) declared.unshift(rootField);
  }
  const explicit = declared.length > 0;
  return {
    id,
    label: element.dataset["editLabel"]?.trim() || titleCase(id),
    element,
    explicit,
    fields: explicit ? declared : fallbackFields(element),
    allowTransform: element.dataset["editTransform"] !== "false",
    allowAppearance: explicit
      ? element.dataset["editAppearance"] === "true"
      : true,
  };
}

/**
 * Returns the one DOM node that visually owns a text-only editor group.
 * Generated compositions commonly register a positioning wrapper while the
 * declared Content field sits one level inside it. Typography belongs on that
 * field target; transforms still belong on the registered wrapper.
 */
export function editorGroupTextTarget(
  group: EditorGroupDefinition,
): HTMLElement | null {
  const textFields = group.fields.filter((field) => field.binding === "text");
  const target = textFields[0]?.target;
  if (!target || textFields.some((field) => field.target !== target))
    return null;
  const hasDifferentVisualTarget = group.fields.some(
    (field) =>
      field.target !== target &&
      field.binding !== "css-variable" &&
      field.type !== "toggle",
  );
  return hasDifferentVisualTarget ? null : target;
}

export function editorFieldValue(field: EditorFieldDefinition): string {
  if (field.binding === "text") {
    return (field.target.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  if (field.binding === "attribute") {
    return field.target.getAttribute(field.property ?? "") ?? "";
  }
  const style = getComputedStyle(field.target);
  if (field.binding === "css-variable") {
    return style.getPropertyValue(field.property ?? "").trim();
  }
  return style[field.property as keyof CSSStyleDeclaration]?.toString() ?? "";
}

export function applyEditorField(
  field: EditorFieldDefinition,
  value: string | boolean,
): void {
  const normalized = typeof value === "boolean" ? String(value) : value;
  if (field.binding === "text") {
    field.target.textContent = normalized;
  } else if (field.binding === "attribute") {
    field.target.setAttribute(field.property ?? "", normalized);
  } else if (field.binding === "css-variable") {
    field.target.style.setProperty(field.property ?? "", normalized);
  } else if (field.property) {
    const unit =
      field.unit ??
      (field.type === "number" || field.type === "range" ? "px" : "");
    const cssProperty = field.property.replace(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`,
    );
    field.target.style.setProperty(cssProperty, `${normalized}${unit}`);
  }
}

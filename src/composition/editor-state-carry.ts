import type { RuntimeEditorState } from "./types";

/**
 * Hand edits live only in the editor, keyed by `data-edit` id; the AI edits
 * source. Carrying every hand edit onto a regenerated film re-applied the old
 * text, colour, size or position over exactly the layers the AI had just
 * changed, so the preview kept showing the old film while the saved project,
 * which the AI had just overwritten, showed the new one after a reload.
 *
 * A hand edit therefore survives only on a layer the AI left alone: the same
 * markup, the same stylesheet rules reaching it, and the same timeline lines
 * naming it. Anything the AI touched is shown as the AI wrote it.
 */
export function carryEditorState(
  editorState: Partial<RuntimeEditorState> | undefined,
  previous: { html: string; timelineJs: string },
  next: { html: string; timelineJs: string },
): Partial<RuntimeEditorState> | undefined {
  if (!editorState) return undefined;
  const before = layerFingerprints(previous.html, previous.timelineJs);
  const after = layerFingerprints(next.html, next.timelineJs);
  const untouched = (id: string): boolean => {
    const was = before.get(id);
    return was !== undefined && was === after.get(id);
  };
  return {
    elements: pick(editorState.elements, untouched),
    animations: pick(editorState.animations, untouched),
    tweens: pick(editorState.tweens, (key) =>
      untouched(key.split(":tween")[0] ?? ""),
    ),
  };
}

function pick<T>(
  record: Record<string, T> | undefined,
  keep: (key: string) => boolean,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([key]) => keep(key)),
  );
}

/** One string per `data-edit` layer that changes whenever the AI changes it. */
export function layerFingerprints(
  html: string,
  timelineJs: string,
): Map<string, string> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root: ParentNode =
    doc.querySelector("template")?.content ?? doc.body ?? doc;
  const rules = styleRules(root, doc);
  const timelineLines = timelineJs
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const fingerprints = new Map<string, string>();
  root.querySelectorAll<HTMLElement>("[data-edit]").forEach((element) => {
    const id = element.dataset["edit"];
    if (!id || fingerprints.has(id)) return;
    const names = [id, ...Array.from(element.classList)];
    fingerprints.set(
      id,
      [
        ownMarkup(element),
        rules
          .filter((rule) => matches(element, rule.selector))
          .map((rule) => rule.text)
          .join("\n"),
        timelineLines
          .filter((line) => names.some((name) => line.includes(name)))
          .join("\n"),
      ].join("\u0000"),
    );
  });
  return fingerprints;
}

/** Tag, attributes and the element's own text, but not its children's. */
function ownMarkup(element: Element): string {
  const attributes = Array.from(element.attributes)
    .map((attribute) => `${attribute.name}=${attribute.value}`)
    .sort()
    .join(" ");
  const text = Array.from(element.childNodes)
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent?.trim() ?? "")
    .join(" ");
  return `${element.tagName} ${attributes} ${text}`;
}

interface StyleRule {
  selector: string;
  text: string;
}

function styleRules(root: ParentNode, doc: Document): StyleRule[] {
  const css = Array.from(root.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .concat(
      Array.from(doc.head?.querySelectorAll("style") ?? []).map(
        (style) => style.textContent ?? "",
      ),
    )
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: StyleRule[] = [];
  // Flat rules only; at-rule bodies such as @media are read as their inner rules.
  for (const match of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? "").trim();
    const body = (match[2] ?? "").replace(/\s+/g, " ").trim();
    if (selector) rules.push({ selector, text: `${selector}{${body}}` });
  }
  return rules;
}

function matches(element: Element, selector: string): boolean {
  return selector.split(",").some((part) => {
    // Pseudo-elements and states still style the layer; match on the base.
    const base = part.replace(/::?[a-z-]+(\([^)]*\))?/gi, "").trim();
    if (!base) return false;
    try {
      return element.matches(base);
    } catch {
      return false;
    }
  });
}

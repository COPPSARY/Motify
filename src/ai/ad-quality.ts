/**
 * Conservative source evidence of repeated application chrome. This is not a
 * visual score: it only identifies navigation authored in distinct scenes.
 * Shared carriers, content cards, code, and a single focused UI shot are allowed.
 * Uses a tag stack so browser and server callers do not require a DOM parser.
 */
export function applicationChromeScenes(html: string): readonly string[] {
  const source = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const stack: { tag: string; scene?: string }[] = [];
  const scenes = new Set<string>();
  const voidTag =
    /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;
  for (const match of source.matchAll(
    /<\/?([\w-]+)\b(?:"[^"]*"|'[^']*'|[^'">])*>/g,
  )) {
    const token = match[0];
    const tag = (match[1] ?? "").toLowerCase();
    if (token.startsWith("</")) {
      const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (index >= 0) stack.length = index;
      continue;
    }
    const scene =
      /\bdata-scene=["']([^"']+)["']/i.exec(token)?.[1] ?? stack.at(-1)?.scene;
    const attributes = Array.from(
      token.matchAll(/\b(?:class|data-edit|role)=["']([^"']+)["']/gi),
    )
      .map((entry) => entry[1])
      .join(" ");
    if (
      scene &&
      (tag === "aside" ||
        tag === "nav" ||
        /\b(?:sidebar|navigation)\b/i.test(attributes))
    ) {
      scenes.add(scene);
    }
    if (!voidTag.test(tag) && !token.endsWith("/>")) stack.push({ tag, scene });
  }
  return [...scenes];
}

/** Repeated editorial subtitle wrappers recreate the rejected slide layout. */
export function editorialSubtitleCount(html: string): number {
  const markup = html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  return Array.from(
    markup.matchAll(/<\w+\b[^>]*\bclass=["']([^"']+)["'][^>]*>/g),
  ).filter((match) =>
    /\b(?:editorial|headline|hero|scene)[-_](?:subtitle|subheading)\b/i.test(
      match[1] ?? "",
    ),
  ).length;
}

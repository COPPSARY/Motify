import type { GeneratedComposition } from "./generation-guidance";

/**
 * Deterministic repairs for the parts of the quality contract that are pure
 * markup bookkeeping.
 *
 * Asking a model a second time to add an attribute it forgot costs a round
 * trip, usually rewrites choreography that was already good, and sometimes
 * comes back missing the attribute again. Anything we can prove correct from
 * the markup alone is fixed here instead, so the model only ever gets asked
 * about work that needs judgement.
 */

const TAG_PATTERN = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

/** Wrappers and metadata that never host the composition's own markers. */
const NON_VISUAL_TAGS = new Set([
  "template",
  "html",
  "head",
  "body",
  "style",
  "script",
  "meta",
  "link",
  "title",
  "base",
]);

interface OpenTag {
  /** Index of the `<`. */
  start: number;
  name: string;
  attributes: string;
}

function openTags(html: string): OpenTag[] {
  const tags: OpenTag[] = [];
  TAG_PATTERN.lastIndex = 0;
  for (
    let match = TAG_PATTERN.exec(html);
    match !== null;
    match = TAG_PATTERN.exec(html)
  ) {
    tags.push({
      start: match.index,
      name: (match[1] ?? "").toLowerCase(),
      attributes: match[2] ?? "",
    });
  }
  return tags;
}

/** Inserts an attribute immediately after the tag name, preserving the rest. */
function withAttribute(html: string, tag: OpenTag, attribute: string): string {
  const insertAt = tag.start + 1 + tag.name.length;
  return `${html.slice(0, insertAt)} ${attribute}${html.slice(insertAt)}`;
}

function visualTags(html: string): OpenTag[] {
  return openTags(html).filter((tag) => !NON_VISUAL_TAGS.has(tag.name));
}

/**
 * The element the film is mounted into: the outermost tag that is not a
 * document or template wrapper.
 */
function rootTag(html: string): OpenTag | undefined {
  return visualTags(html)[0];
}

/** Roles that name the moving subject a handoff would actually carry. */
const DECLARED_CARRIER_ROLE =
  /data-edit=["'][^"']*(?:carrier|surface|workspace|canvas|shell)[^"']*["']/i;

/** Persistent containers, used only when nothing more specific is authored. */
const CONTAINER_ROLE =
  /data-edit=["'][^"']*(?:stage|world|frame|board)[^"']*["']/i;

/**
 * The element that should conserve visual mass across scene boundaries: a
 * declared carrier role if the model authored one, then the camera world, then
 * a generic persistent container, and finally the mounted root. Every candidate
 * genuinely survives the whole film, so marking one describes the DOM rather
 * than making a claim about it.
 */
function carrierTag(html: string): OpenTag | undefined {
  const tags = visualTags(html);
  return (
    tags.find((tag) => DECLARED_CARRIER_ROLE.test(tag.attributes)) ??
    tags.find((tag) => /data-camera-world(?:[\s=]|$)/i.test(tag.attributes)) ??
    tags.find((tag) => CONTAINER_ROLE.test(tag.attributes)) ??
    tags[0]
  );
}

export interface MarkupRepair {
  result: GeneratedComposition;
  /** Human-readable description of each repair that was applied. */
  applied: readonly string[];
}

export function repairGeneratedMarkup(
  result: GeneratedComposition,
): MarkupRepair {
  let html = result.compositionHtml;
  const applied: string[] = [];

  // Only template.content is mounted. Models sometimes place otherwise valid
  // authored CSS before/after </template>, leaving the film entirely unstyled.
  // Move those style elements into the mounted source in their original order.
  const template =
    /^(.*?)(<template\b[^>]*>)([\s\S]*?)(<\/template\s*>)([\s\S]*)$/is.exec(
      html,
    );
  if (template) {
    const styles = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;
    const before = template[1] ?? "";
    const after = template[5] ?? "";
    const leading = before.match(styles) ?? [];
    const trailing = after.match(styles) ?? [];
    if (leading.length || trailing.length) {
      html =
        before.replace(styles, "") +
        template[2] +
        leading.join("\n") +
        template[3] +
        trailing.join("\n") +
        template[4] +
        after.replace(styles, "");
      applied.push("moved authored styles inside the mounted template");
    }
  }

  if (!/data-transition-carrier(?:[\s=>]|$)/i.test(html)) {
    const carrier = carrierTag(html);
    if (carrier) {
      html = withAttribute(html, carrier, "data-transition-carrier");
      applied.push("marked the persistent transition carrier");
    }
  }

  if (
    !/data-motionly-generation-profile=["']claude-foundation-v1["']/i.test(html)
  ) {
    const root = rootTag(html);
    if (root) {
      html = withAttribute(
        html,
        root,
        'data-motionly-generation-profile="claude-foundation-v1"',
      );
      applied.push("restored the generation foundation marker");
    }
  }

  /**
   * An infinite repeat makes the parent timeline infinite, and this runtime is
   * built on a finite, seekable one: preview, scrubbing, and export all seek
   * the same timeline. GSAP reports such a composition as ~1e10 seconds, which
   * fails the duration ceiling and costs the user the whole generation.
   *
   * Bounding the tween to a single play is the smallest change that restores a
   * seekable film, so an ambient loop degrades to one pass instead of taking
   * the composition down with it.
   */
  let timelineJs = result.timelineJs;
  if (/repeat\s*:\s*-\s*1/.test(timelineJs)) {
    timelineJs = timelineJs.replace(/repeat\s*:\s*-\s*1/g, "repeat: 0");
    applied.push("bounded an infinite ambient loop so the film stays seekable");
  }

  if (applied.length === 0) return { result, applied };
  return { result: { ...result, compositionHtml: html, timelineJs }, applied };
}

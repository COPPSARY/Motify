import { mountFilm, type FilmInput } from "./mount";

/**
 * Counts the visual tells of a templated, generic film in the mounted DOM.
 * These are counts for a benchmark, not a quality score and not faults: a pill
 * can be a real control in a real interface. They show whether a change to the
 * pipeline made the tells more or less common across many films.
 */
export interface SlopCounts {
  /** Painted capsules: wider than tall with fully rounded ends. */
  pills: number;
  /** A small label directly above a headline with a subtitle directly below. */
  kickerHeadlineSubtitle: number;
  /** Blurred or radial-gradient shapes with no content, and glowing text. */
  glowBlobs: number;
  /** Scene changes where both scenes are half-transparent at the cut. */
  crossFades: number;
}

export async function measureSlop(input: FilmInput): Promise<SlopCounts> {
  const film = mountFilm(input);
  try {
    await document.fonts.ready;
    const { width, height } = film.runtime.mountedSize;
    const scenes = [...(input.scenes ?? [])].sort((a, b) => a.start - b.start);
    const pills = new Set<Element>();
    const stacks = new Set<Element>();
    const glows = new Set<Element>();
    for (const scene of scenes) {
      film.seek(scene.start + scene.duration / 2);
      const visible = Array.from(
        film.root.querySelectorAll<HTMLElement>("*"),
      ).filter((node) => shown(node, film.root, width, height));
      for (const node of visible) {
        if (isPill(node)) pills.add(node);
        if (isGlow(node, width, height)) glows.add(node);
      }
      for (const headline of visible.filter(
        (node) => ownText(node) && fontSize(node) >= 64,
      )) {
        if (hasKickerAndSubtitle(headline, visible)) stacks.add(headline);
      }
    }
    let crossFades = 0;
    for (let index = 1; index < scenes.length; index += 1) {
      const cut = scenes[index]!.start;
      film.seek(cut);
      const outgoing = film.root.querySelector(
        `[data-scene="${scenes[index - 1]!.id}"]`,
      );
      const incoming = film.root.querySelector(
        `[data-scene="${scenes[index]!.id}"]`,
      );
      const half = (node: Element | null) => {
        if (!node) return false;
        const opacity = Number(getComputedStyle(node).opacity);
        return opacity > 0.15 && opacity < 0.85;
      };
      if (half(outgoing) && half(incoming)) crossFades += 1;
    }
    return {
      pills: pills.size,
      kickerHeadlineSubtitle: stacks.size,
      glowBlobs: glows.size,
      crossFades,
    };
  } finally {
    film.destroy();
  }
}

function shown(
  node: HTMLElement,
  root: HTMLElement,
  width: number,
  height: number,
): boolean {
  let opacity = 1;
  for (
    let current: HTMLElement | null = node;
    current && current !== root.parentElement;
    current = current.parentElement
  ) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    opacity *= Number(style.opacity);
  }
  if (opacity < 0.1) return false;
  const origin = root.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  return (
    rect.width > 1 &&
    rect.height > 1 &&
    rect.left - origin.left < width &&
    rect.top - origin.top < height &&
    rect.right > origin.left &&
    rect.bottom > origin.top
  );
}

function ownText(node: Element): boolean {
  return Array.from(node.childNodes).some(
    (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
  );
}

function fontSize(node: Element): number {
  return parseFloat(getComputedStyle(node).fontSize) || 0;
}

function painted(style: CSSStyleDeclaration): boolean {
  return (
    style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
    style.backgroundImage !== "none" ||
    parseFloat(style.borderTopWidth) > 0
  );
}

function isPill(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  if (rect.height < 14 || rect.height > 160 || rect.width < rect.height * 1.6)
    return false;
  const style = getComputedStyle(node);
  const radius = parseFloat(style.borderTopLeftRadius);
  return (
    painted(style) &&
    (radius >= rect.height / 2 - 1 || style.borderTopLeftRadius.endsWith("%"))
  );
}

function isGlow(node: HTMLElement, width: number, height: number): boolean {
  const style = getComputedStyle(node);
  if (ownText(node) && maxShadowBlur(style.textShadow) >= 8) return true;
  if (ownText(node) || node.querySelector("img, svg, video")) return false;
  const rect = node.getBoundingClientRect();
  if (rect.width * rect.height < width * height * 0.01) return false;
  const blur = /blur\((\d+(?:\.\d+)?)px\)/.exec(style.filter);
  if (blur && Number(blur[1]) >= 20) return true;
  return (
    style.backgroundImage.includes("radial-gradient") &&
    parseFloat(style.borderTopLeftRadius) >=
      Math.min(rect.width, rect.height) * 0.4
  );
}

function maxShadowBlur(shadow: string): number {
  if (shadow === "none") return 0;
  return Math.max(
    0,
    ...Array.from(
      shadow.matchAll(
        /(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/g,
      ),
      (match) => Number(match[3]),
    ),
  );
}

function hasKickerAndSubtitle(
  headline: HTMLElement,
  visible: HTMLElement[],
): boolean {
  const box = headline.getBoundingClientRect();
  const size = fontSize(headline);
  const texts = visible.filter(
    (node) =>
      node !== headline &&
      ownText(node) &&
      !node.contains(headline) &&
      !headline.contains(node),
  );
  const overlaps = (rect: DOMRect) =>
    rect.left < box.right && rect.right > box.left;
  const kicker = texts.some((node) => {
    const rect = node.getBoundingClientRect();
    return (
      overlaps(rect) &&
      rect.bottom <= box.top + 4 &&
      box.top - rect.bottom < 80 &&
      fontSize(node) <= size * 0.35
    );
  });
  const subtitle = texts.some((node) => {
    const rect = node.getBoundingClientRect();
    const ratio = fontSize(node) / size;
    return (
      overlaps(rect) &&
      rect.top >= box.bottom - 4 &&
      rect.top - box.bottom < 100 &&
      ratio >= 0.2 &&
      ratio <= 0.6
    );
  });
  return kicker && subtitle;
}

/**
 * What a viewer reads as content in a rendered frame, measured from the live
 * DOM. Shared by the generation validator (is there anything to look at?) and
 * the smart reframer (where is it?).
 */

export function isVisiblyRendered(
  element: HTMLElement,
  root: HTMLElement,
): boolean {
  for (
    let current: HTMLElement | null = element;
    current && current !== root;
    current = current.parentElement
  ) {
    const style = getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity || "1") <= 0.02
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Atmosphere: the lit ground a beat sits in, rather than anything in it.
 *
 * This is how blank beats were shipping. Every emptiness check asked whether
 * *something* was on screen, and a single decorative bloom answered yes — it
 * carries a `data-edit` id, it is painted, and it covers plenty of the canvas,
 * so a frame holding nothing but a blurred purple glow passed "renders no
 * visible foreground", "holds a blank frame" and the subject floor at once.
 *
 * Identified conservatively. A heavy blur or an explicit background role is
 * unambiguous; the id keywords are limited to words that only ever name
 * atmosphere. Nothing here catches a sharp gradient sphere or a colour field
 * used as an actual subject, because those are real shots in the catalogue.
 */
export function isAtmosphere(element: HTMLElement): boolean {
  if (element.dataset["backgroundRole"]) return true;
  if ((element.textContent ?? "").trim().length > 0) return false;
  if (element.querySelector("img, svg, video, canvas")) return false;
  const id = element.dataset["edit"]?.toLowerCase() ?? "";
  if (
    /(?:^|-)(?:glow|bloom|aura|halo|vignette|grain|noise|backdrop|ambient)(?:-|$)/.test(
      id,
    )
  ) {
    return true;
  }
  const blur = /blur\(([\d.]+)px\)/.exec(
    getComputedStyle(element).filter ?? "",
  );
  return blur ? Number(blur[1]) >= 12 : false;
}

export function hasMeaningfulContent(element: HTMLElement): boolean {
  if (["IMG", "SVG", "VIDEO", "CANVAS"].includes(element.tagName)) return true;
  if ((element.textContent ?? "").trim().length >= 2) return true;
  if (isAtmosphere(element)) return false;
  const id = element.dataset["edit"]?.toLowerCase() ?? "";
  return Boolean(id && !/^(stage|camera-world|world|background)$/.test(id));
}

export function visibleElements(
  root: HTMLElement,
  rootRect: DOMRect,
  hasLayout: boolean,
): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("*"))
    .filter((element) => hasMeaningfulContent(element))
    .filter((element) => isVisiblyRendered(element, root))
    .filter((element) => {
      if (!hasLayout) return true;
      const rect = element.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return false;
      return (
        rect.right > rootRect.left &&
        rect.left < rootRect.right &&
        rect.bottom > rootRect.top &&
        rect.top < rootRect.bottom
      );
    });
}

/** Whether an element paints its own surface rather than just holding others. */
export function isPainted(style: CSSStyleDeclaration): boolean {
  if (style.backgroundImage && style.backgroundImage !== "none") return true;
  const background = style.backgroundColor || "";
  const alpha = /rgba?\([^)]*?,\s*([\d.]+)\s*\)/.exec(background);
  if (alpha) return Number(alpha[1]) > 0.06;
  return Boolean(background) && background !== "transparent";
}

/**
 * The elements a viewer reads as objects in the frame: something painted, or
 * carrying its own text, or an image. Bare wrappers do not count, so a
 * full-width invisible container cannot stand in for a subject, and grounds are
 * excluded by the upper bound.
 */
export function frameSubjects(
  elements: readonly HTMLElement[],
  canvasArea: number,
): HTMLElement[] {
  return elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    const share = (rect.width * rect.height) / canvasArea;
    if (share < 0.004 || share > 0.6) return false;
    if (["IMG", "SVG", "VIDEO", "CANVAS"].includes(element.tagName))
      return true;
    // The ground a beat sits in is not one of the beat's subjects.
    if (isAtmosphere(element)) return false;
    if (isPainted(getComputedStyle(element))) return true;
    return Array.from(element.childNodes).some(
      (node) =>
        node.nodeType === Node.TEXT_NODE &&
        (node.textContent ?? "").trim().length > 0,
    );
  });
}

export interface SelectionHitTestOptions {
  root: HTMLElement;
  elements: ReadonlyMap<string, HTMLElement>;
  clientX: number;
  clientY: number;
  /** Injectable for deterministic DOM tests. */
  pointStack?: readonly Element[];
}

function elementArea(element: Element): number {
  const rect = element.getBoundingClientRect();
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function containsPoint(element: Element, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom
  );
}

/**
 * Opacity-zero descendants still participate in browser hit testing. Checking
 * the complete branch prevents a hidden face inside a visible scene wrapper
 * from stealing selection from the content the user can actually see.
 */
export function isElementActuallyVisible(
  element: Element,
  root: HTMLElement,
): boolean {
  for (
    let node: Element | null = element;
    node && root.contains(node);
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) <= 0.01
    ) {
      return false;
    }
    if (node === root) break;
  }
  return true;
}

function ownsExplicitEditorContent(element: Element): boolean {
  return (
    element.hasAttribute("data-field") ||
    element.querySelector("[data-field]") !== null
  );
}

/**
 * Full-canvas layout owners are useful in the timeline but should not win a
 * canvas click over their registered children. Size alone is not enough:
 * giant kinetic type and full-bleed images are legitimate selectable subjects.
 */
function isStructuralWrapper(
  element: HTMLElement,
  root: HTMLElement,
  rootArea: number,
  registered: readonly HTMLElement[],
): boolean {
  if (elementArea(element) / rootArea < 0.85) return false;
  if (ownsExplicitEditorContent(element)) return false;

  const containsRegisteredChild = registered.some(
    (candidate) => candidate !== element && element.contains(candidate),
  );
  if (!containsRegisteredChild) return false;

  const isMountedStage =
    element === root.firstElementChild && element.tagName === "MAIN";
  return (
    isMountedStage ||
    element.hasAttribute("data-camera-world") ||
    element.hasAttribute("data-scene")
  );
}

function registeredAncestors(
  element: Element,
  root: HTMLElement,
  elements: ReadonlyMap<string, HTMLElement>,
): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  for (
    let node = element.closest<HTMLElement>("[data-motionly-id]");
    node && root.contains(node);
    node =
      node.parentElement?.closest<HTMLElement>("[data-motionly-id]") ?? null
  ) {
    const id = node.dataset["motionlyId"] ?? "";
    // Duplicate authored ids can leave stale data attributes in the DOM. Only
    // the element owned by the runtime map is a valid selection target.
    if (id && elements.get(id) === node) ancestors.push(node);
  }
  return ancestors;
}

function isTextualOwner(element: HTMLElement): boolean {
  return (
    /^(B|BUTTON|EM|H[1-6]|P|SMALL|SPAN|STRONG)$/.test(element.tagName) ||
    element.hasAttribute("data-motionly-split-unit") ||
    element.querySelector(
      '[data-field][data-field-binding="text"], [data-field][data-field-type="text"], .motionly-text-motion-layer, .motionly-split-item',
    ) !== null
  );
}

function domDepth(element: Element, root: HTMLElement): number {
  let depth = 0;
  for (
    let node = element.parentElement;
    node && root.contains(node);
    node = node.parentElement
  ) {
    depth += 1;
  }
  return depth;
}

/**
 * Resolves a canvas click to one registered editable owner. The browser's
 * painted stack is authoritative; bounding-box inference is only a fallback
 * for authored layers that intentionally use pointer-events:none.
 */
export function editableElementAtPoint({
  root,
  elements,
  clientX,
  clientY,
  pointStack = document.elementsFromPoint(clientX, clientY),
}: SelectionHitTestOptions): HTMLElement | null {
  const registered = Array.from(new Set(elements.values())).filter((element) =>
    root.contains(element),
  );
  const rootArea = Math.max(1, elementArea(root));

  for (const paintedElement of pointStack) {
    if (!root.contains(paintedElement)) continue;
    if (!isElementActuallyVisible(paintedElement, root)) continue;

    for (const editable of registeredAncestors(
      paintedElement,
      root,
      elements,
    )) {
      if (!isElementActuallyVisible(editable, root)) continue;
      if (isStructuralWrapper(editable, root, rootArea, registered)) continue;
      return editable;
    }
  }

  const boxed = registered.filter(
    (element) =>
      isElementActuallyVisible(element, root) &&
      !isStructuralWrapper(element, root, rootArea, registered) &&
      containsPoint(element, clientX, clientY),
  );
  const innermost = boxed.filter(
    (element) =>
      !boxed.some((other) => other !== element && element.contains(other)),
  );

  innermost.sort((a, b) => {
    const textDifference =
      Number(isTextualOwner(b)) - Number(isTextualOwner(a));
    if (textDifference) return textDifference;
    const areaDifference = elementArea(a) - elementArea(b);
    if (areaDifference) return areaDifference;
    const depthDifference = domDepth(b, root) - domDepth(a, root);
    if (depthDifference) return depthDifference;
    // Equal-size siblings are painted in DOM order; the later one is on top.
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
      ? 1
      : -1;
  });
  return innermost[0] ?? null;
}

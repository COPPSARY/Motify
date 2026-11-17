export interface SelectionHitTestOptions {
  root: HTMLElement;
  elements: ReadonlyMap<string, HTMLElement>;
  clientX: number;
  clientY: number;
  /** Injectable for deterministic DOM tests. */
  pointStack?: readonly Element[];
}

/** A layer painting this share of the frame is a backdrop to click through. */
const FRAME_COVERING_SHARE = 0.85;
/** Alpha below this (of 255) reads as empty. */
const TRANSPARENT_ALPHA = 16;
/** Among backdrops, the first at least this visible at the point is the one seen. */
const SEEN_BACKDROP = 0.5;
/** Images are sampled at most this size; selection needs no finer pixels. */
const ALPHA_SAMPLE_EDGE = 512;

const alphaSamples = new WeakMap<
  HTMLImageElement,
  { src: string; pixels: ImageData | null }
>();

/** The image's pixels at selection resolution; null when they cannot be read. */
function alphaSample(image: HTMLImageElement): ImageData | null {
  if (!image.complete || image.naturalWidth === 0) return null;
  let sample = alphaSamples.get(image);
  if (!sample || sample.src !== image.currentSrc) {
    let pixels: ImageData | null = null;
    try {
      const scale = Math.min(
        1,
        ALPHA_SAMPLE_EDGE / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      }
    } catch {
      // A cross-origin image cannot be read.
    }
    sample = { src: image.currentSrc, pixels };
    alphaSamples.set(image, sample);
  }
  return sample.pixels;
}

/**
 * The image's alpha where the pointer is, 0 to 1; null when unknown (not yet
 * loaded, cross-origin, no canvas), which callers treat as opaque.
 */
function alphaAt(image: HTMLImageElement, x: number, y: number): number | null {
  const pixels = alphaSample(image);
  const rect = image.getBoundingClientRect();
  if (!pixels || rect.width <= 0 || rect.height <= 0) return null;
  const column = Math.min(
    pixels.width - 1,
    Math.max(0, Math.floor(((x - rect.left) / rect.width) * pixels.width)),
  );
  const row = Math.min(
    pixels.height - 1,
    Math.max(0, Math.floor(((y - rect.top) / rect.height) * pixels.height)),
  );
  return pixels.data[(row * pixels.width + column) * 4 + 3]! / 255;
}

function elementArea(element: Element): number {
  const rect = element.getBoundingClientRect();
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

/**
 * How much of the frame a layer paints, 0 to 1. A box is not what it paints:
 * an imported Photoshop layer is often far larger than the frame and mostly
 * transparent (a logo's letters, a shape mostly off the canvas), so an image
 * is measured by its painted pixels inside the frame, anything else by its
 * box inside the frame.
 */
function frameShare(element: HTMLElement, frame: DOMRect): number {
  const frameArea = Math.max(1, frame.width * frame.height);
  const rect = element.getBoundingClientRect();
  const image = element instanceof HTMLImageElement ? element : null;
  const pixels = image ? alphaSample(image) : null;
  if (!pixels) {
    const width =
      Math.min(rect.right, frame.right) - Math.max(rect.left, frame.left);
    const height =
      Math.min(rect.bottom, frame.bottom) - Math.max(rect.top, frame.top);
    return (Math.max(0, width) * Math.max(0, height)) / frameArea;
  }
  const cellWidth = rect.width / pixels.width;
  const cellHeight = rect.height / pixels.height;
  let painted = 0;
  for (let row = 0; row < pixels.height; row += 1) {
    const y = rect.top + (row + 0.5) * cellHeight;
    if (y < frame.top || y > frame.bottom) continue;
    for (let column = 0; column < pixels.width; column += 1) {
      const x = rect.left + (column + 0.5) * cellWidth;
      if (x < frame.left || x > frame.right) continue;
      // Faint counts: a translucent overlay still covers what it covers. Whether
      // it is the one seen at the point is decided separately.
      if (
        pixels.data[(row * pixels.width + column) * 4 + 3]! >= TRANSPARENT_ALPHA
      )
        painted += 1;
    }
  }
  return (painted * cellWidth * cellHeight) / frameArea;
}

/** The element's opacity as drawn: its own times every ancestor's, to the root. */
function drawnOpacity(element: Element, root: HTMLElement): number {
  let opacity = 1;
  for (
    let node: Element | null = element;
    node && root.contains(node);
    node = node.parentElement
  ) {
    opacity *= Number(getComputedStyle(node).opacity) || 0;
    if (node === root) break;
  }
  return opacity;
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
  const frame = root.getBoundingClientRect();
  /**
   * Layers that paint most of the frame (a background, a texture, a light
   * leak, a vignette drawn last) would otherwise take every click on the
   * canvas. They yield to any other layer under the pointer; where only they
   * are, the topmost one actually seen there is chosen, not a faint overlay.
   * Text never yields: a giant headline is the thing being clicked.
   */
  const backdrops: { element: HTMLElement; seen: number }[] = [];

  for (const paintedElement of pointStack) {
    if (!root.contains(paintedElement)) continue;
    if (!isElementActuallyVisible(paintedElement, root)) continue;
    // An image's transparent pixels show what is beneath them, so a click
    // there is a click on what is beneath.
    let alpha = 1;
    if (paintedElement instanceof HTMLImageElement) {
      const measured = alphaAt(paintedElement, clientX, clientY);
      if (measured !== null && measured * 255 < TRANSPARENT_ALPHA) continue;
      alpha = measured ?? 1;
    }

    for (const editable of registeredAncestors(
      paintedElement,
      root,
      elements,
    )) {
      if (!isElementActuallyVisible(editable, root)) continue;
      if (isStructuralWrapper(editable, root, rootArea, registered)) continue;
      if (
        !isTextualOwner(editable) &&
        frameShare(editable, frame) >= FRAME_COVERING_SHARE
      ) {
        if (!backdrops.some((backdrop) => backdrop.element === editable)) {
          backdrops.push({
            element: editable,
            seen: alpha * drawnOpacity(paintedElement, root),
          });
        }
        // Its registered ancestors cover the frame too.
        break;
      }
      return editable;
    }
  }
  if (backdrops.length > 0) {
    return (
      backdrops.find((backdrop) => backdrop.seen >= SEEN_BACKDROP) ??
      backdrops[0]!
    ).element;
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

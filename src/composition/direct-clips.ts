import type { ClipPicture, ClipPictures } from "./frame-render";

/**
 * Clips an export draws straight onto the frame's canvas.
 *
 * An exported frame is the film's page drawn as an SVG image. A clip has to go
 * into that image as a full-size JPEG: reading its decoded frame back from the
 * GPU to encode it, then decoding it again inside the image, costs most of a
 * second a frame. Instead, a clip the page shows plainly is drawn onto the
 * canvas first, exactly where and how the page shows it, and the page is drawn
 * over it with the clip left out: the captions, titles and cards above it
 * stay where they were.
 *
 * Only what can be drawn exactly is drawn this way: positioned boxes with 2D
 * transforms, opacity, overflow clipping, blur and object-fit. A clip under a
 * mask, a clip path, a blend mode, or with anything painted beneath it (a
 * card, a picture, a clip that is not drawn this way) goes into the image as
 * before, and so does every clip after it, so stacking order is kept.
 */

/** How the page under the directly drawn clips is filled before them. */
export interface DirectClipPlan {
  /** Clips drawn on the canvas; the image must leave them out. */
  clips: Set<HTMLVideoElement>;
  /** Elements whose background was painted on the canvas; the image leaves it out. */
  blanked: HTMLElement[];
  /** Paints the background and the clips, `scale` times the page's size. */
  draw(context: CanvasRenderingContext2D, scale: number): void;
}

type Draw = (context: CanvasRenderingContext2D, scale: number) => void;

const OPAQUE_NOTHING = /^(transparent|rgba\([^)]*,\s*0\))$/;
const BLURS = /^(?:\s*blur\(([\d.]+)px\))+\s*$/;
const PAINTING_TAGS = new Set([
  "IMG",
  "VIDEO",
  "CANVAS",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "BUTTON",
  "PICTURE",
]);
const SILENT_TAGS = new Set([
  "STYLE",
  "SCRIPT",
  "TEMPLATE",
  "AUDIO",
  "SOURCE",
  "NOSCRIPT",
]);

function transparent(color: string): boolean {
  return OPAQUE_NOTHING.test(color.trim());
}

function hasText(element: Element): boolean {
  for (const node of Array.from(element.childNodes))
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      return true;
  return false;
}

/** Whether `element` itself puts any pixels on the page (its children aside). */
export function paints(element: Element, style: CSSStyleDeclaration): boolean {
  if (PAINTING_TAGS.has(element.tagName) || element instanceof SVGElement)
    return true;
  if (hasText(element)) return true;
  if (!transparent(style.backgroundColor) || style.backgroundImage !== "none")
    return true;
  if (style.boxShadow !== "none") return true;
  for (const side of ["Top", "Right", "Bottom", "Left"] as const)
    if (
      parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) >
        0 &&
      style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none"
    )
      return true;
  if (parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== "none")
    return true;
  const view = element.ownerDocument.defaultView ?? window;
  for (const pseudo of ["::before", "::after"]) {
    const content = view.getComputedStyle(element, pseudo).content;
    if (content && content !== "none" && content !== "normal") return true;
  }
  return false;
}

/** Whether anything visible is painted before `video` in page order, below it. */
function paintedBelow(
  root: HTMLElement,
  video: HTMLVideoElement,
  drawn: ReadonlySet<HTMLVideoElement>,
): boolean {
  const view = root.ownerDocument.defaultView ?? window;
  const walk = (element: Element): boolean | "reached" => {
    for (const child of Array.from(element.children)) {
      if (child === video) return "reached";
      if (SILENT_TAGS.has(child.tagName)) continue;
      if (child.contains(video)) {
        // An ancestor: its own paint is checked with the clip's chain.
        const inner = walk(child);
        if (inner) return inner;
        continue;
      }
      if (drawn.has(child as HTMLVideoElement)) continue;
      const style = view.getComputedStyle(child);
      if (style.display === "none" || parseFloat(style.opacity) === 0) continue;
      if (style.visibility !== "hidden" && paints(child, style)) return true;
      if (child instanceof SVGElement) continue;
      const inner = walk(child);
      if (inner) return inner;
    }
    return false;
  };
  return walk(root) === true;
}

/** Where a clip's picture sits inside its box, for its object-fit and object-position. */
export function fitted(
  box: { width: number; height: number },
  picture: ClipPicture,
  fit: string,
  position: string,
): { x: number; y: number; width: number; height: number } | null {
  const { displayWidth: width, displayHeight: height } = picture;
  if (width <= 0 || height <= 0) return null;
  let scaleX = box.width / width;
  let scaleY = box.height / height;
  if (fit === "cover") scaleX = scaleY = Math.max(scaleX, scaleY);
  else if (fit === "contain") scaleX = scaleY = Math.min(scaleX, scaleY);
  else if (fit !== "fill") return null;
  const parts = position.trim().split(/\s+/);
  if (parts.length !== 2 || !parts.every((part) => part.endsWith("%")))
    return null;
  const [px, py] = parts.map((part) => parseFloat(part) / 100) as [
    number,
    number,
  ];
  const drawWidth = width * scaleX;
  const drawHeight = height * scaleY;
  return {
    // The page lays a fitted picture out on whole pixels.
    x: Math.round((box.width - drawWidth) * px),
    y: Math.round((box.height - drawHeight) * py),
    width: drawWidth,
    height: drawHeight,
  };
}

/** A linear-gradient mask, in its element's own box. */
interface GradientMask {
  from: [number, number];
  to: [number, number];
  stops: Array<{ offset: number; alpha: number }>;
  width: number;
  height: number;
}

/** Splits `text` at commas outside parentheses. */
function topLevelParts(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

function colorAlpha(color: string): number | null {
  const value = color.trim();
  if (value === "transparent") return 0;
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(value)) return 1;
  const match = /^rgba?\(([^)]*)\)$/.exec(value);
  if (!match) return null;
  const channels = match[1]!.split(/[\s,/]+/).filter(Boolean);
  if (channels.length === 3) return 1;
  if (channels.length !== 4) return null;
  const alpha = channels[3]!;
  return alpha.endsWith("%") ? parseFloat(alpha) / 100 : parseFloat(alpha);
}

/**
 * The element's mask as a gradient the canvas can draw, or null when it has
 * a mask this cannot reproduce (anything but one plain linear gradient
 * sized to the element, top to bottom or side to side).
 */
export function gradientMask(
  style: CSSStyleDeclaration,
  width: number,
  height: number,
): GradientMask | null {
  const image =
    style.maskImage && style.maskImage !== "none"
      ? style.maskImage
      : style.getPropertyValue("-webkit-mask-image");
  const size =
    style.maskSize || style.getPropertyValue("-webkit-mask-size") || "auto";
  if (size !== "auto" && size !== "auto auto") return null;
  const match = /^linear-gradient\((.*)\)$/.exec(image.trim());
  if (!match) return null;
  const parts = topLevelParts(match[1]!);
  let from: [number, number] = [0, 0];
  let to: [number, number] = [0, height];
  if (/^to /.test(parts[0]!) || /deg$/.test(parts[0]!)) {
    const direction = parts.shift()!;
    if (direction === "to bottom" || direction === "180deg") to = [0, height];
    else if (direction === "to top" || direction === "0deg") {
      from = [0, height];
      to = [0, 0];
    } else if (direction === "to right" || direction === "90deg")
      to = [width, 0];
    else if (direction === "to left" || direction === "270deg") {
      from = [width, 0];
      to = [0, 0];
    } else return null;
  }
  const stops: Array<{ offset: number | null; alpha: number }> = [];
  for (const part of parts) {
    const stop = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(part);
    const alpha = stop ? colorAlpha(stop[1]!) : null;
    if (!stop || alpha === null) return null;
    stops.push({
      offset: stop[2] === undefined ? null : parseFloat(stop[2]) / 100,
      alpha,
    });
  }
  if (stops.length < 2) return null;
  stops[0]!.offset ??= 0;
  stops[stops.length - 1]!.offset ??= 1;
  // Stops without a position are spread evenly between their neighbours.
  for (let index = 1; index < stops.length - 1; index += 1) {
    if (stops[index]!.offset !== null) continue;
    let next = index + 1;
    while (stops[next]!.offset === null) next += 1;
    const before = stops[index - 1]!.offset!;
    const after = stops[next]!.offset!;
    for (let fill = index; fill < next; fill += 1)
      stops[fill]!.offset =
        before + ((after - before) * (fill - index + 1)) / (next - index + 1);
  }
  let last = 0;
  return {
    from,
    to,
    width,
    height,
    stops: stops.map((stop) => {
      // A stop before an earlier one sits on it, as in CSS.
      last = Math.min(1, Math.max(last, stop.offset!));
      return { offset: last, alpha: stop.alpha };
    }),
  };
}

let layerCanvas: HTMLCanvasElement | undefined;

/** One scratch canvas for masked clips, cleared for each: allocating one a frame is slow. */
function maskLayer(
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  layerCanvas ??= document.createElement("canvas");
  if (layerCanvas.width !== width || layerCanvas.height !== height) {
    layerCanvas.width = width;
    layerCanvas.height = height;
  }
  const context = layerCanvas.getContext("2d");
  context?.clearRect(0, 0, width, height);
  return context;
}

/**
 * The elements that, with `drawn` clips and `unseen` elements gone, hold
 * nothing that paints: out of the flow, painting nothing themselves, and
 * holding only such elements. The page image leaves out the outermost of
 * them, so a clip's moving frame does not change the image every frame.
 */
export function emptyHolders(
  root: HTMLElement,
  drawn: ReadonlySet<Element>,
  unseen: ReadonlySet<Element>,
): HTMLElement[] {
  const view = root.ownerDocument.defaultView ?? window;
  const holders: HTMLElement[] = [];
  const empty = (element: Element): boolean => {
    if (drawn.has(element) || unseen.has(element)) return true;
    if (SILENT_TAGS.has(element.tagName)) return true;
    if (!(element instanceof HTMLElement)) return false;
    const style = view.getComputedStyle(element);
    if (style.position !== "absolute" && style.position !== "fixed")
      return false;
    if (paints(element, style)) return false;
    const children = Array.from(element.children);
    const each = children.map(empty);
    return each.every(Boolean);
  };
  const walk = (element: Element) => {
    for (const child of Array.from(element.children)) {
      // Style sheets and the like paint nothing but are never left out.
      if (SILENT_TAGS.has(child.tagName)) continue;
      if (child instanceof HTMLElement && !drawn.has(child) && empty(child)) {
        if (!unseen.has(child)) holders.push(child);
        continue;
      }
      walk(child);
    }
  };
  walk(root);
  return holders;
}

/**
 * How to draw `video` exactly as the page shows it, or null when it cannot
 * be. `fill` receives a full-page background color the clip sits on, which
 * the caller paints first and leaves out of the image.
 */
function clipDraw(
  root: HTMLElement,
  video: HTMLVideoElement,
  picture: ClipPicture,
  backgrounds: Map<HTMLElement, string>,
): Draw | null {
  const view = root.ownerDocument.defaultView ?? window;
  const chain: HTMLElement[] = [];
  for (
    let node: HTMLElement | null = video;
    node && node !== root;
    node = node.parentElement
  )
    chain.unshift(node);
  if (chain[0]?.parentElement !== root) return null;
  const steps: Array<{
    matrix: DOMMatrix;
    clip: { width: number; height: number } | null;
  }> = [];
  let opacity = 1;
  let blur = 0;
  let accumulated = new DOMMatrix();
  const masks: Array<{ matrix: DOMMatrix; mask: GradientMask }> = [];
  for (const node of chain) {
    const style = view.getComputedStyle(node);
    if (
      style.position !== "absolute" ||
      node.offsetParent !== node.parentElement
    )
      return null;
    if (
      style.translate !== "none" ||
      style.rotate !== "none" ||
      style.scale !== "none" ||
      style.clipPath !== "none" ||
      style.mixBlendMode !== "normal" ||
      ((style as CSSStyleDeclaration & { backdropFilter?: string })
        .backdropFilter ?? "none") !== "none"
    )
      return null;
    const transform =
      style.transform === "none"
        ? new DOMMatrix()
        : new DOMMatrix(style.transform);
    if (!transform.is2D) return null;
    const [ox = 0, oy = 0] = style.transformOrigin.split(" ").map(parseFloat);
    const matrix = new DOMMatrix()
      .translate(node.offsetLeft, node.offsetTop)
      .translate(ox, oy)
      .multiply(transform)
      .translate(-ox, -oy);
    accumulated = accumulated.multiply(matrix);
    const masked =
      (style.maskImage && style.maskImage !== "none") ||
      (style.getPropertyValue("-webkit-mask-image") || "none") !== "none";
    if (masked) {
      const mask = gradientMask(style, node.offsetWidth, node.offsetHeight);
      if (!mask) return null;
      masks.push({ matrix: DOMMatrix.fromMatrix(accumulated), mask });
    }
    opacity *= parseFloat(style.opacity);
    if (style.filter !== "none") {
      const match = BLURS.exec(style.filter);
      if (!match) return null;
      // Blur scales with the element's own transform and every one above it.
      const factor = Math.sqrt(
        Math.abs(accumulated.a * accumulated.d - accumulated.b * accumulated.c),
      );
      for (const radius of style.filter.matchAll(/blur\(([\d.]+)px\)/g))
        blur = Math.hypot(blur, parseFloat(radius[1]!) * factor);
    }
    if (node !== video) {
      if (hasText(node)) return null;
      const painted =
        !transparent(style.backgroundColor) || style.backgroundImage !== "none";
      if (painted) {
        // A full-page solid backdrop (the film's black) is painted first, on the canvas.
        const full =
          node === chain[0] &&
          matrix.isIdentity &&
          node.offsetWidth === root.clientWidth &&
          node.offsetHeight === root.clientHeight &&
          style.backgroundImage === "none";
        if (!full) return null;
        backgrounds.set(node, style.backgroundColor);
      }
      if (style.boxShadow !== "none" || parseFloat(style.borderTopWidth) > 0)
        return null;
    }
    const clips =
      node === video ||
      style.overflowX !== "visible" ||
      style.overflowY !== "visible";
    steps.push({
      matrix,
      clip: clips
        ? { width: node.clientWidth, height: node.clientHeight }
        : null,
    });
  }
  const style = view.getComputedStyle(video);
  if (style.visibility === "hidden" || opacity <= 0) return null;
  const place = fitted(
    { width: video.clientWidth, height: video.clientHeight },
    picture,
    style.objectFit,
    style.objectPosition,
  );
  if (!place) return null;
  const paint = (context: CanvasRenderingContext2D, scale: number) => {
    context.save();
    context.setTransform(scale, 0, 0, scale, 0, 0);
    for (const step of steps) {
      const { a, b, c, d, e, f } = step.matrix;
      context.transform(a, b, c, d, e, f);
      if (step.clip) {
        context.beginPath();
        context.rect(0, 0, step.clip.width, step.clip.height);
        context.clip();
      }
    }
    context.globalAlpha = Math.min(1, opacity);
    // The page scales a clip with a high-quality filter; so does the canvas.
    context.imageSmoothingQuality = "high";
    if (blur > 0) context.filter = `blur(${blur * scale}px)`;
    picture.draw(context, place.x, place.y, place.width, place.height);
    context.restore();
  };
  if (masks.length === 0) return paint;
  // A masked clip is drawn on a layer of its own, the mask cut out of it there.
  return (context, scale) => {
    const layerContext = maskLayer(context.canvas.width, context.canvas.height);
    if (!layerContext) return;
    paint(layerContext, scale);
    for (const { matrix, mask } of masks) {
      layerContext.save();
      layerContext.setTransform(scale, 0, 0, scale, 0, 0);
      const { a, b, c, d, e, f } = matrix;
      layerContext.transform(a, b, c, d, e, f);
      const gradient = layerContext.createLinearGradient(
        mask.from[0],
        mask.from[1],
        mask.to[0],
        mask.to[1],
      );
      for (const stop of mask.stops)
        gradient.addColorStop(stop.offset, `rgba(0,0,0,${stop.alpha})`);
      // Everything outside the mask's box goes too, as CSS clips a mask to it.
      layerContext.globalCompositeOperation = "destination-in";
      layerContext.fillStyle = gradient;
      layerContext.fillRect(0, 0, mask.width, mask.height);
      layerContext.restore();
    }
    context.drawImage(layerContext.canvas, 0, 0);
  };
}

/**
 * The clips on screen that can be drawn straight onto the canvas, in page
 * order, stopping at the first one that cannot (everything after it may
 * stack above something the image draws).
 */
export function planDirectClips(
  root: HTMLElement,
  pictures: ClipPictures | undefined,
): DirectClipPlan | null {
  if (!pictures || pictures.size === 0) return null;
  const view = root.ownerDocument.defaultView ?? window;
  const rootStyle = view.getComputedStyle(root);
  if (rootStyle.backgroundImage !== "none") return null;
  const videos = Array.from(root.querySelectorAll("video")).filter(
    (video) => view.getComputedStyle(video).visibility !== "hidden",
  );
  const clips = new Set<HTMLVideoElement>();
  const backgrounds = new Map<HTMLElement, string>();
  const draws: Draw[] = [];
  for (const video of videos) {
    const picture = pictures.get(video);
    if (!picture) break;
    const found = new Map<HTMLElement, string>();
    const draw = clipDraw(root, video, picture, found);
    if (!draw || paintedBelow(root, video, clips)) break;
    clips.add(video);
    found.forEach((color, element) => backgrounds.set(element, color));
    draws.push(draw);
  }
  if (clips.size === 0) return null;
  const fills: string[] = [];
  if (!transparent(rootStyle.backgroundColor))
    fills.push(rootStyle.backgroundColor);
  backgrounds.forEach((color) => fills.push(color));
  return {
    clips,
    blanked: [
      ...(transparent(rootStyle.backgroundColor) ? [] : [root]),
      ...backgrounds.keys(),
    ],
    draw(context, scale) {
      for (const color of fills) {
        context.save();
        context.fillStyle = color;
        context.fillRect(0, 0, context.canvas.width, context.canvas.height);
        context.restore();
      }
      for (const draw of draws) draw(context, scale);
    },
  };
}

/** The element in `clone` at the same place as `element` in `source`. */
export function counterpart(
  source: Element,
  clone: Element,
  element: Element,
): HTMLElement | null {
  const path: number[] = [];
  for (
    let node: Element | null = element;
    node && node !== source;
    node = node.parentElement
  ) {
    const parent = node.parentElement;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.children, node));
  }
  let target: Element | undefined = clone;
  for (const index of path) target = target?.children[index];
  return (target as HTMLElement | undefined) ?? null;
}

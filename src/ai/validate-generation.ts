import { createDynamicComposition } from "../composition/dynamic-compiler";
import { CompositionRuntime } from "../composition/runtime";
import type { SceneDefinition } from "../composition/types";
import { seamsFromResult, type SeamDirection } from "./seam-plan";
import type { DirectAiResult } from "./direct-ai";

/**
 * Requests that are allowed to change the shape of the film rather than edit
 * the one on screen: an explicit structural edit, a duration change, or — the
 * common case — a request to author a new film outright. "Make an ad for my
 * issue tracker" is not an edit to the current composition, so holding its
 * output to the previous composition's layers rejects exactly the work the
 * user asked for.
 */
const STRUCTURAL_REQUEST =
  /\b(add|insert|remove|delete|reorder|replace|redesign|rebuild|regenerate|recreate|rewrite)\b[\s\S]{0,30}\b(scene|timeline|composition|film|video|entire|whole|complete)\b|\b(change|extend|shorten|set|make|hold|linger|stretch|trim)\b[\s\S]{0,32}\b(duration|length|timing|longer|shorter|slower|faster)\b|\b(make|create|build|generate|design|produce|animate|film|storyboard)\b[\s\S]{0,48}\b(ad|advert|advertisement|film|video|promo|commercial|animation|composition|reel|teaser|trailer|spot|intro|explainer|walkthrough|demo)\b|\bfrom scratch\b|\bstart over\b/i;

/** Hard ceiling on a composition's running time. */
const MAX_COMPOSITION_SECONDS = 300;

/** Executable carrier handoffs. Opacity is not one of them. */
const PHYSICAL_HANDOFF =
  /\b(?:morph|matchCut|cutTheCurve|zoomThrough|inverseZoomThrough|particleReassemble)\s*\(/g;

function isVisiblyRendered(element: HTMLElement, root: HTMLElement): boolean {
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
function isAtmosphere(element: HTMLElement): boolean {
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

function hasMeaningfulContent(element: HTMLElement): boolean {
  if (["IMG", "SVG", "VIDEO", "CANVAS"].includes(element.tagName)) return true;
  if ((element.textContent ?? "").trim().length >= 2) return true;
  if (isAtmosphere(element)) return false;
  const id = element.dataset["edit"]?.toLowerCase() ?? "";
  return Boolean(id && !/^(stage|camera-world|world|background)$/.test(id));
}

function visibleElements(
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

/** Leaf elements that own their own visible text run. */
function textLeaves(elements: readonly HTMLElement[]): HTMLElement[] {
  return elements.filter((element) => {
    const text = (element.textContent ?? "").trim();
    if (text.length < 3) return false;
    return !Array.from(element.children).some(
      (child) => (child.textContent ?? "").trim().length > 0,
    );
  });
}

function overlapRatio(first: DOMRect, second: DOMRect): number {
  const width = Math.max(
    0,
    Math.min(first.right, second.right) - Math.max(first.left, second.left),
  );
  const height = Math.max(
    0,
    Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
  );
  const smallerArea = Math.max(
    1,
    Math.min(first.width * first.height, second.width * second.height),
  );
  return (width * height) / smallerArea;
}

/**
 * Text that spills outside the pill, plate, or card holding it. The final
 * resolve is where this shows up most — a sentence sized for the canvas dropped
 * into a lockup sized for a word — and it reads as broken rather than stylish,
 * so it is reported as an error the repair pass can name.
 */
function assertTextFitsItsCarrier(
  elements: readonly HTMLElement[],
  root: HTMLElement,
  scene: SceneDefinition,
  time: number,
): void {
  for (const leaf of textLeaves(elements)) {
    const carrier = leaf.parentElement;
    if (!carrier || carrier === root) continue;
    const style = getComputedStyle(carrier);
    // Only carriers that actually claim to bound their content: a plain
    // wrapper with visible overflow is doing its job by growing.
    const bounded =
      style.overflow !== "visible" ||
      Number.parseFloat(style.borderRadius) > 0 ||
      style.backgroundColor !== "rgba(0, 0, 0, 0)";
    if (!bounded) continue;
    const inner = carrier.getBoundingClientRect();
    if (inner.width < 8 || inner.height < 8) continue;
    const text = leaf.getBoundingClientRect();
    if (text.width < 8 || text.height < 8) continue;
    const spillX = Math.max(inner.left - text.left, text.right - inner.right);
    const spillY = Math.max(inner.top - text.top, text.bottom - inner.bottom);
    // A few pixels is antialiasing and descender slop, not a broken layout.
    if (spillX <= 4 && spillY <= 4) continue;
    throw new Error(
      `Scene ${scene.id} lets text escape its container around ${time.toFixed(
        2,
      )}s: "${(leaf.textContent ?? "").trim().slice(0, 40)}" overflows by ${Math.round(
        Math.max(spillX, spillY),
      )}px.`,
    );
  }
}

/** Whether an element paints its own surface rather than just holding others. */
function isPainted(style: CSSStyleDeclaration): boolean {
  if (style.backgroundImage && style.backgroundImage !== "none") return true;
  const background = style.backgroundColor || "";
  const alpha = /rgba?\([^)]*?,\s*([\d.]+)\s*\)/.exec(background);
  if (alpha) return Number(alpha[1]) > 0.06;
  return Boolean(background) && background !== "transparent";
}

/** Something a viewer can actually read or recognise inside this element. */
function holdsVisibleContent(element: HTMLElement, root: HTMLElement): boolean {
  for (const child of element.querySelectorAll<HTMLElement>("*")) {
    if (!isVisiblyRendered(child, root)) continue;
    const rect = child.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    if (["IMG", "SVG", "VIDEO", "CANVAS", "PATH"].includes(child.tagName)) {
      return true;
    }
    if ((child.textContent ?? "").trim().length > 0) return true;
  }
  // Own text only. `textContent` includes the text of hidden descendants, so
  // reading it here would let a plate whose every face is faded out claim it
  // still has something in it — the exact case this check exists for.
  return Array.from(element.childNodes).some(
    (node) =>
      node.nodeType === Node.TEXT_NODE &&
      (node.textContent ?? "").trim().length > 0,
  );
}

/**
 * The elements a viewer reads as objects in the frame: something painted, or
 * carrying its own text, or an image. Bare wrappers do not count, so a
 * full-width invisible container cannot stand in for a subject, and grounds are
 * excluded by the upper bound.
 */
function frameSubjects(
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

/**
 * The smallest a beat's largest object may be before the frame reads as empty.
 *
 * The skill already sets the target from the other direction — an isolated
 * control occupies 25-45% of frame height, a proof artifact 55-80% of frame
 * width — so this is only the floor: below it the film is a handful of small
 * cards adrift in white, which is the most-reported complaint about generated
 * output and, until now, the one failure with a repair remedy written for it
 * and no check to emit it.
 */
const MIN_SUBJECT_SHARE = 0.03;

/**
 * Calibrated against real output rather than taste. The reported film's cards
 * measure 1.1% of the frame each; a deliberate closing lockup — a brand pill on
 * open ground — measures about 5.9%. Three percent sits well clear of both, so
 * the check rejects the frame that has nothing to look at without touching a
 * composition that chose to be small.
 */

function assertFrameHasASubject(
  elements: readonly HTMLElement[],
  rootRect: DOMRect,
  scene: SceneDefinition,
  time: number,
): void {
  const canvasArea = Math.max(1, rootRect.width * rootRect.height);
  const subjects = frameSubjects(elements, canvasArea);
  if (subjects.length === 0) return;
  const largest = Math.max(
    ...subjects.map((element) => {
      const rect = element.getBoundingClientRect();
      return (rect.width * rect.height) / canvasArea;
    }),
  );
  if (largest >= MIN_SUBJECT_SHARE) return;
  throw new Error(
    `Scene ${scene.id} is small cards floating in empty space around ${time.toFixed(
      2,
    )}s: its largest of ${subjects.length} objects covers ${(
      largest * 100
    ).toFixed(
      1,
    )}% of the frame, so there is nothing for the viewer to look at. Give this beat one subject at a readable size — a sentence spanning most of the frame, an object at 25-45% of frame height, or a proof artifact at 55-80% of frame width — and let anything else support it.`,
  );
}

/**
 * A painted plate with nothing in it.
 *
 * This is how the carrier pattern fails. The film builds one box whose outline
 * morphs while its contents swap, gives that box its own background, border and
 * radius, and then schedules the outgoing face out before the incoming face is
 * up — or morphs the geometry a beat early. The box itself is still lit, so the
 * viewer watches a coloured rectangle sit in the middle of the frame for a beat
 * and a half. It is the most visible way a generated film reads as broken, and
 * no source check can see it: the markup is correct and the timeline is busy.
 *
 * Grounds are excluded by the upper bound — a full-bleed colour beat is a
 * legitimate empty surface — and accents and rules by the lower one.
 */
function assertNoEmptyPlates(
  elements: readonly HTMLElement[],
  root: HTMLElement,
  rootRect: DOMRect,
  scene: SceneDefinition,
  time: number,
): void {
  const canvasArea = Math.max(1, rootRect.width * rootRect.height);
  for (const element of elements) {
    // Only a container that has been emptied, never a shape that never held
    // anything. A hero-object film is *about* a painted shape — a mark, a
    // facet, a device body, a colour field — and those have no children by
    // design. The defect is a box built to hold faces whose faces are all
    // currently down.
    if (element.childElementCount === 0) continue;
    const rect = element.getBoundingClientRect();
    const share = (rect.width * rect.height) / canvasArea;
    if (share < 0.02 || share > 0.6) continue;
    if (!isPainted(getComputedStyle(element))) continue;
    if (holdsVisibleContent(element, root)) continue;
    const id =
      element.dataset["edit"] ?? (element.className || element.tagName);
    throw new Error(
      `Scene ${scene.id} shows an empty plate around ${time.toFixed(
        2,
      )}s: "${id}" is a painted shape covering ${Math.round(
        share * 100,
      )}% of the frame with nothing inside it.`,
    );
  }
}

function assertNoOverlappingText(
  elements: readonly HTMLElement[],
  scene: SceneDefinition,
  time: number,
): void {
  const leaves = textLeaves(elements);
  for (let index = 0; index < leaves.length; index += 1) {
    const first = leaves[index];
    if (!first) continue;
    const firstText = (first.textContent ?? "").trim().replace(/\s+/g, " ");
    const firstRect = first.getBoundingClientRect();
    for (let next = index + 1; next < leaves.length; next += 1) {
      const second = leaves[next];
      if (!second) continue;
      if (first.contains(second) || second.contains(first)) continue;
      const secondText = (second.textContent ?? "").trim().replace(/\s+/g, " ");
      const ratio = overlapRatio(firstRect, second.getBoundingClientRect());
      if (firstText === secondText) {
        if (ratio > 0.72) {
          throw new Error(
            `Scene ${scene.id} stacks duplicate text around ${time.toFixed(2)}s.`,
          );
        }
        continue;
      }
      // Two different text runs sharing a quarter of the smaller one's box is
      // already unreadable on screen; the old two-thirds threshold let a
      // resolve whose lines collided pass as acceptable.
      if (ratio > 0.25) {
        throw new Error(
          `Scene ${scene.id} overlaps unrelated text around ${time.toFixed(
            2,
          )}s: "${firstText.slice(0, 32)}" collides with "${secondText.slice(
            0,
            32,
          )}".`,
        );
      }
    }
  }
}

interface RenderWindow {
  readonly from: number;
  readonly until: number;
}

/**
 * When each scene's layers are allowed on screen: its own interval, widened at
 * both ends by the seams that carry it in and out.
 *
 * A morph or a match-cut needs both sides of the boundary present while the
 * carrier crosses. Requiring every `data-scene` layer to be gone by the next
 * beat's first frame therefore forbade the one thing that makes a transition a
 * transition, and the cheapest way to satisfy it was to hide the outgoing beat
 * and show the next — a hard cut with a helper call attached. Seams straddle
 * their cut, so a beat arrives slightly early and leaves slightly late, by
 * exactly the length of the declared handoff and no longer.
 */
function sceneRenderWindows(
  scenes: readonly SceneDefinition[],
  seams: readonly SeamDirection[],
): ReadonlyMap<string, RenderWindow> {
  const windows = new Map<string, RenderWindow>();
  for (const scene of scenes) {
    windows.set(scene.id, {
      from: scene.start,
      until: scene.start + scene.duration,
    });
  }
  for (const seam of seams) {
    const outgoing = windows.get(seam.from);
    if (outgoing) {
      windows.set(seam.from, {
        from: outgoing.from,
        until: Math.max(outgoing.until, seam.at + seam.duration),
      });
    }
    const incoming = windows.get(seam.to);
    if (incoming) {
      windows.set(seam.to, {
        from: Math.min(incoming.from, seam.at),
        until: incoming.until,
      });
    }
  }
  return windows;
}

/** The nearest scene owner for an element, including the element itself. */
function sceneOwner(element: HTMLElement, root: HTMLElement): string | null {
  for (
    let current: HTMLElement | null = element;
    current && current !== root;
    current = current.parentElement
  ) {
    const owner = current.dataset["scene"]?.trim();
    if (owner) return owner;
  }
  return null;
}

/**
 * Content authored for one declared beat, rather than a persistent ground or
 * carrier that happens to remain visible while that beat is empty.
 */
function sceneVisualElements(
  root: HTMLElement,
  rootRect: DOMRect,
  sceneId: string,
): HTMLElement[] {
  const hasLayout = rootRect.width > 0 && rootRect.height > 0;
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-scene], [data-scene] *"),
  )
    .filter((element) => sceneOwner(element, root) === sceneId)
    .filter((element) => isVisiblyRendered(element, root))
    .filter((element) => !isAtmosphere(element))
    .filter((element) => {
      const ownsText = Array.from(element.childNodes).some(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          (node.textContent ?? "").trim().length > 0,
      );
      const recognizable =
        ["IMG", "SVG", "VIDEO", "CANVAS"].includes(element.tagName) ||
        ownsText ||
        isPainted(getComputedStyle(element));
      if (!recognizable) return false;
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

/**
 * A storyboard entry is not proof that a beat exists. Models sometimes return
 * four or five scene records while only authoring one visible DOM layer. The
 * global frame checks then see a persistent carrier or background and accept
 * every timestamp, leaving empty scene buttons in the editor.
 */
function assertSceneRendersOwnedContent(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scene: SceneDefinition,
  limit: number,
): void {
  const rootRect = root.getBoundingClientRect();
  for (const progress of [0.25, 0.5, 0.75]) {
    const time = Math.max(
      0,
      Math.min(limit, scene.start + scene.duration * progress),
    );
    runtime.seek(time);
    if (sceneVisualElements(root, rootRect, scene.id).length > 0) return;
  }
  throw new Error(
    `Scene ${scene.id} never renders visible scene content. Its storyboard entry is present, but every layer owned by data-scene="${scene.id}" is empty, hidden, or off screen.`,
  );
}

/**
 * A layer that belongs to another beat but is still on screen. Generated films
 * fail this when an outgoing scene is faded but never cleared, so the new beat
 * is composited over the old one.
 */
function assertNoStaleLayers(
  elements: readonly HTMLElement[],
  scene: SceneDefinition,
  sceneIds: ReadonlySet<string>,
  time: number,
  windows: ReadonlyMap<string, RenderWindow>,
): void {
  for (const element of elements) {
    const owner = element.dataset["scene"]?.trim();
    if (!owner || owner === scene.id) continue;
    if (!sceneIds.has(owner)) continue;
    const window = windows.get(owner);
    if (window && time >= window.from && time <= window.until) continue;
    throw new Error(
      `Scene ${scene.id} still shows the stale layer from ${owner} around ${time.toFixed(
        2,
      )}s.`,
    );
  }
}

/** Share of the canvas the visible foreground actually paints, clipped to it. */
function coverageRatio(
  visible: readonly HTMLElement[],
  rootRect: DOMRect,
): number {
  const canvasArea = Math.max(1, rootRect.width * rootRect.height);
  const covered = visible.reduce((total, element) => {
    const rect = element.getBoundingClientRect();
    const width = Math.max(
      0,
      Math.min(rect.right, rootRect.right) - Math.max(rect.left, rootRect.left),
    );
    const height = Math.max(
      0,
      Math.min(rect.bottom, rootRect.bottom) - Math.max(rect.top, rootRect.top),
    );
    return total + width * height;
  }, 0);
  return covered / canvasArea;
}

/**
 * The frames a transition actually occupies.
 *
 * Scene frames are sampled at 0.25, 0.5 and 0.8 of each beat, which is always
 * well inside it. A seam at 4.6s running 0.8s covers 4.6-5.4s, while the beat
 * before it is sampled at 4.0s and the beat after at 6.25s — so the entire
 * handoff went unlooked at, and the near-blank floor below never applied to the
 * one stretch of film most likely to be empty.
 *
 * What that let through, in an exported film: at every boundary both scenes
 * switched off and the only thing left on the canvas was the transition carrier
 * — a ~40px pill covering 0.08% of a 1920x1080 frame, alone on an empty stage
 * for a fifth of a second. A carrier is supposed to enter matching the outgoing
 * surface and leave matching the incoming one, so the swap happens underneath
 * it; one that stays a dot reads as a stray dot, because that is what it is.
 */
function assertSeamFramesHoldTheFilm(
  runtime: CompositionRuntime,
  root: HTMLElement,
  seams: readonly SeamDirection[],
  limit: number,
): void {
  for (const seam of seams) {
    if (seam.duration <= 0) continue;
    for (const progress of [0.25, 0.5, 0.75]) {
      const time = Math.max(
        0,
        Math.min(limit, seam.at + seam.duration * progress),
      );
      runtime.seek(time);
      const rootRect = root.getBoundingClientRect();
      const hasLayout = rootRect.width > 0 && rootRect.height > 0;
      const visible = visibleElements(root, rootRect, hasLayout);
      const where = `the ${seam.from} to ${seam.to} handoff at ${time.toFixed(2)}s`;
      if (visible.length === 0) {
        throw new Error(
          `The composition renders no visible foreground during ${where}; the outgoing beat leaves before the incoming one arrives, so the film cuts to an empty stage.`,
        );
      }
      if (!hasLayout) continue;
      if (coverageRatio(visible, rootRect) < 0.03) {
        throw new Error(
          `The composition renders a near-blank frame during ${where}; carry the outgoing surface into the incoming one so the handoff covers the cut, instead of hiding both beats and leaving the carrier alone on the canvas.`,
        );
      }
      assertNoShapeOverContent(visible, root, rootRect, where);
    }
  }
}

/**
 * A plain painted shape parked on top of readable content mid-cut.
 *
 * The exported film that prompted this dragged a 190px violet square across
 * every boundary; each time it landed dead centre over the headline or the table
 * rows, so "Collect everything into one workspace" read as "Collect ev■g into
 * one w■e". It passed every other check — the frame was not blank and the seam
 * executed a real move. What gives it away is geometry: a small, painted, empty
 * box covering most of a line of text that is not inside it.
 *
 * Limited to the seam window and to empty painted boxes, so a cursor, an icon,
 * a badge or a card that holds its own words is never mistaken for one.
 */
function assertNoShapeOverContent(
  visible: readonly HTMLElement[],
  root: HTMLElement,
  rootRect: DOMRect,
  where: string,
): void {
  const canvasArea = Math.max(1, rootRect.width * rootRect.height);
  const texts = textLeaves(visible);
  for (const shape of visible) {
    if ((shape.textContent ?? "").trim()) continue;
    if (shape.querySelector("img, svg, video, canvas")) continue;
    if (isAtmosphere(shape)) continue;
    if (!isPainted(getComputedStyle(shape))) continue;
    const box = shape.getBoundingClientRect();
    const share = (box.width * box.height) / canvasArea;
    // From a ~50px box up. The parked dot measured 80px — 0.31% of the frame —
    // and slipped under a 0.4% floor set for the 190px square. Anything smaller,
    // like a caret, cannot hide a glyph and is ruled out by the coverage test.
    if (share < 0.0012 || share > 0.08) continue;
    for (const text of texts) {
      if (shape.contains(text) || text.contains(shape)) continue;
      if (!paintsAbove(shape, text, root)) continue;
      const line = text.getBoundingClientRect();
      const across =
        Math.min(box.right, line.right) - Math.max(box.left, line.left);
      const down =
        Math.min(box.bottom, line.bottom) - Math.max(box.top, line.top);
      /*
       * Measured against the glyphs, not the element. A headline wrapping onto
       * two lines is ~180px tall, so judging by its box let an 80px dot sitting
       * squarely on a word pass as "not covering" it.
       */
      const glyph =
        Number.parseFloat(getComputedStyle(text).fontSize) ||
        Math.min(line.height, 48);
      if (across < Math.min(glyph * 0.8, line.width * 0.5)) continue;
      if (down < glyph * 0.5) continue;
      throw new Error(
        `A shape covers the beat's content during ${where}: an empty box sits over "${(
          text.textContent ?? ""
        )
          .trim()
          .slice(
            0,
            40,
          )}". Remove the shape: a dot, pill or square laid over the words reads as a glitch, and a cut is carried by zoomThrough, inverseZoomThrough or cutTheCurve, never by a shape.`,
      );
    }
  }
}

/** The nearest numeric z-index on the way up to the root; 0 when none is set. */
function stackLevel(element: HTMLElement, root: HTMLElement): number {
  for (
    let current: HTMLElement | null = element;
    current && current !== root;
    current = current.parentElement
  ) {
    const z = Number.parseInt(getComputedStyle(current).zIndex, 10);
    if (Number.isFinite(z)) return z;
  }
  return 0;
}

/**
 * Whether `shape` is painted over `text`. The validation root is parked far
 * off screen, so `elementFromPoint` cannot answer; z-index decides first, and
 * at equal levels the later element in document order paints on top.
 */
function paintsAbove(
  shape: HTMLElement,
  text: HTMLElement,
  root: HTMLElement,
): boolean {
  const shapeLevel = stackLevel(shape, root);
  const textLevel = stackLevel(text, root);
  if (shapeLevel !== textLevel) return shapeLevel > textLevel;
  return Boolean(
    text.compareDocumentPosition(shape) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

function assertVisibleSceneFrame(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scene: SceneDefinition,
  sceneIds: ReadonlySet<string>,
  time: number,
  windows: ReadonlyMap<string, RenderWindow>,
): void {
  runtime.seek(time);
  const rootRect = root.getBoundingClientRect();
  const hasLayout = rootRect.width > 0 && rootRect.height > 0;
  const visible = visibleElements(root, rootRect, hasLayout);
  if (visible.length === 0) {
    throw new Error(
      `Scene ${scene.id} renders no visible foreground around ${time.toFixed(2)}s.`,
    );
  }
  assertNoStaleLayers(visible, scene, sceneIds, time, windows);

  if (!hasLayout) return;

  if (coverageRatio(visible, rootRect) < 0.03) {
    throw new Error(
      `Scene ${scene.id} renders a near-blank frame around ${time.toFixed(2)}s.`,
    );
  }

  assertFrameHasASubject(visible, rootRect, scene, time);
  assertNoEmptyPlates(visible, root, rootRect, scene, time);
  assertNoOverlappingText(visible, scene, time);
  assertTextFitsItsCarrier(visible, root, scene, time);
  /*
   * Not just mid-cut. The next export parked an 80px violet dot on "one
   * wo●space" and held it there for eleven seconds of beats, where the seam
   * sampling never looks.
   */
  assertNoShapeOverContent(
    visible,
    root,
    rootRect,
    `scene ${scene.id} around ${time.toFixed(2)}s`,
  );
}

/** Inline styles GSAP writes, used to prove a beat actually develops. */
function frameSignature(root: HTMLElement): string {
  return Array.from(root.querySelectorAll<HTMLElement>("*"))
    .map((element, index) => {
      const style = element.style;
      return [
        element.dataset["edit"] ?? index,
        style.transform,
        style.opacity,
        style.display,
        style.visibility,
        (element.textContent ?? "").trim().length,
      ].join("|");
    })
    .join(";");
}

/**
 * The longest stretch of genuinely identical frames in the film.
 *
 * assertSceneDevelops only asks whether a beat changed at all between three
 * samples, so a scene that enters in its first second and then freezes for four
 * passes it. That freeze is what makes generated films read as a slideshow of
 * stills, and it is invisible to every static check because the timeline source
 * looks busy. Measuring rendered frames is the only way to see it.
 *
 * Reported rather than thrown: a film with a long hold still runs, seeks, and
 * exports, and handing the user nothing is worse than handing them a slow film
 * with a note saying which part is slow.
 */
function deadAirWarnings(
  runtime: CompositionRuntime,
  root: HTMLElement,
  duration: number,
): string[] {
  const step = 0.25;
  /** A readable hold runs to about 1.6s; past 2.5s the frame reads as frozen. */
  const limit = 2.5;
  let previous = "";
  let runStart = 0;
  let worst = { length: 0, start: 0 };
  for (let time = 0; time <= duration; time += step) {
    runtime.seek(Math.min(time, duration));
    const signature = frameSignature(root);
    if (signature !== previous) {
      previous = signature;
      runStart = time;
      continue;
    }
    const length = time - runStart;
    if (length > worst.length) worst = { length, start: runStart };
  }
  // A final settle is meant to sit still, so only flag it if it is extreme.
  const endsTheFilm = worst.start + worst.length >= duration - step * 2;
  const ceiling = endsTheFilm ? limit * 1.8 : limit;
  if (worst.length <= ceiling) return [];
  return [
    `The film holds a completely still frame for ${worst.length.toFixed(
      1,
    )}s from ${worst.start.toFixed(
      1,
    )}s. Give that stretch its own action or shorten the beat.`,
  ];
}

function assertSceneDevelops(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scene: SceneDefinition,
  limit: number,
): void {
  const signatures = new Set<string>();
  for (const progress of [0.05, 0.5, 0.95]) {
    const time = Math.max(
      0,
      Math.min(limit, scene.start + scene.duration * progress),
    );
    runtime.seek(time);
    signatures.add(frameSignature(root));
  }
  if (signatures.size <= 1) {
    throw new Error(
      `Scene ${scene.id} never changes; it is a static slide rather than a directed beat.`,
    );
  }
}

/**
 * Scene boundaries should conserve visual mass; a multi-scene timeline whose
 * only boundary mechanism is opacity reads as a slideshow.
 *
 * This is direction, not correctness: such a film still renders, seeks, and
 * exports correctly, so it is reported as a warning the caller can surface
 * rather than an error that leaves the user with nothing.
 */
function carrierContinuityWarnings(
  timelineJs: string,
  html: string,
  scenes: readonly SceneDefinition[],
  seams: readonly SeamDirection[],
): string[] {
  if (scenes.length < 2) return [];
  // Declared seams are checked against the rendered film instead, which is
  // both stricter and specific about which boundary failed.
  if (seams.length > 0) return [];
  const warnings: string[] = [];
  if (Array.from(timelineJs.matchAll(PHYSICAL_HANDOFF)).length === 0) {
    warnings.push(
      "Scenes are joined without a morph, match-cut, or particle handoff, so the film cuts like a slideshow.",
    );
  }
  if (!/data-transition-carrier(?:\s|=|>)/i.test(html)) {
    warnings.push(
      "No persistent transition carrier is marked, so scene boundaries do not conserve visual mass.",
    );
  }
  return warnings;
}

/**
 * How far outside a seam to sample. Far enough that the carrier has settled on
 * each side, close enough that it is still the same shot.
 */
const SEAM_MARGIN = 0.15;

/**
 * A box has to change by more than this across a morph for the handoff to be
 * visible; below it the "morph" is the same object sitting still.
 */
const MORPH_MIN_CHANGE = 0.12;

/** The `data-scene` beat a carrier is trapped inside, if any. */
function enclosingScene(
  element: HTMLElement,
  root: HTMLElement,
): string | null {
  for (
    let current: HTMLElement | null = element;
    current && current !== root;
    current = current.parentElement
  ) {
    const owner = current.dataset["scene"]?.trim();
    if (owner) return owner;
  }
  return null;
}

/**
 * The one boundary check that cannot be satisfied by calling a helper.
 *
 * Every other continuity check in this codebase reads source: it counts
 * `morph(` occurrences or greps for `data-transition-carrier`. A model passes
 * all of them by calling the helper on an element that is hidden, off camera,
 * or already gone — which is exactly the output that reads as a hard cut. This
 * seeks the composition to both sides of each declared seam and asks whether
 * the named carrier was actually on screen for both, and whether it changed.
 *
 * Reported rather than thrown: the film still runs, seeks, and exports, and the
 * static seam checks already block a plan that names a carrier no element
 * declares. This one describes what the boundary looked like when it ran.
 */
function seamRenderWarnings(
  runtime: CompositionRuntime,
  root: HTMLElement,
  seams: readonly SeamDirection[],
  duration: number,
): string[] {
  const warnings: string[] = [];
  const rootRect = root.getBoundingClientRect();
  const hasLayout = rootRect.width > 0 && rootRect.height > 0;

  for (const seam of seams) {
    const before = Math.max(0, seam.at - SEAM_MARGIN);
    const after = Math.min(duration, seam.at + seam.duration + SEAM_MARGIN);

    runtime.seek(before);
    // Matched by dataset rather than by selector: a carrier id is model-authored
    // and may hold characters a selector would have to escape, and `CSS.escape`
    // is not available in every environment this validation runs in.
    const entering = Array.from(
      root.querySelectorAll<HTMLElement>("[data-edit]"),
    ).find((element) => element.dataset["edit"]?.trim() === seam.carrier);
    if (!entering) {
      warnings.push(
        `The carrier "${seam.carrier}" for the seam at ${seam.at.toFixed(1)}s is not in the rendered composition.`,
      );
      continue;
    }
    const visibleEntering = isVisiblyRendered(entering, root);
    const enteringRect = entering.getBoundingClientRect();

    /**
     * A beat handing itself off. When the carrier is the outgoing beat's own
     * container, it is supposed to be gone after the cut — the incoming beat is
     * what must be on screen. Judging it as a persistent carrier reported every
     * clean zoom-through as a hard cut and told the model to "move the carrier
     * out of every data-scene subtree", which is an instruction to invent a
     * standalone shape and drag it across the cut: the stray square that sat
     * on top of the words in exported films.
     */
    if (entering.dataset["scene"]?.trim() === seam.from) {
      runtime.seek(after);
      const incoming = Array.from(
        root.querySelectorAll<HTMLElement>("[data-scene]"),
      ).find(
        (element) =>
          element.dataset["scene"]?.trim() === seam.to &&
          !element.parentElement?.closest("[data-scene]"),
      );
      if (!visibleEntering || !incoming || !isVisiblyRendered(incoming, root)) {
        warnings.push(
          `The handoff at ${seam.at.toFixed(1)}s does not carry "${seam.from}" into "${seam.to}": ${
            visibleEntering
              ? `"${seam.to}" is not on screen once it finishes`
              : `"${seam.from}" is already gone before it starts`
          }.`,
        );
      }
      continue;
    }

    runtime.seek(after);
    const visibleLeaving = isVisiblyRendered(entering, root);
    const leavingRect = entering.getBoundingClientRect();

    if (!visibleEntering && !visibleLeaving) {
      /**
       * Almost always the same cause: the carrier was authored *inside* a
       * `data-scene` container, and clearing that beat clears the carrier with
       * it. The placement rule only forbade the carrier from carrying a
       * `data-scene` tag of its own, so a nested carrier obeyed the letter of
       * it and still vanished at every boundary — and the complaint that came
       * back was unactionable, which is why repair passes could not clear it.
       */
      const trap = enclosingScene(entering, root);
      warnings.push(
        trap
          ? `The seam at ${seam.at.toFixed(
              1,
            )}s is a hard cut: its carrier "${seam.carrier}" lives inside the scene container "${trap}", so it is cleared along with that beat and never crosses anything. Move the carrier out of every data-scene subtree — it belongs directly in the camera world, as a sibling of the scene containers.`
          : `The seam at ${seam.at.toFixed(
              1,
            )}s is a hard cut: its carrier "${seam.carrier}" is hidden on both sides of the boundary.`,
      );
      continue;
    }
    if (!visibleEntering || !visibleLeaving) {
      const missing = visibleEntering ? "after" : "before";
      const trap = enclosingScene(entering, root);
      warnings.push(
        trap
          ? `The carrier "${seam.carrier}" is not on screen ${missing} its seam at ${seam.at.toFixed(
              1,
            )}s because it lives inside the scene container "${trap}" and is cleared with that beat. Move the carrier out of every data-scene subtree, directly into the camera world.`
          : `The carrier "${seam.carrier}" is not on screen ${missing} its seam at ${seam.at.toFixed(
              1,
            )}s, so nothing visibly crosses that boundary.`,
      );
      continue;
    }
    if (!hasLayout) continue;

    // The carrier arriving in its new beat with nothing in it yet. Transient
    // rather than the sustained empty plate the scene frames reject outright,
    // so it is named rather than thrown.
    if (
      isPainted(getComputedStyle(entering)) &&
      !holdsVisibleContent(entering, root)
    ) {
      warnings.push(
        `The carrier "${seam.carrier}" comes out of its seam at ${seam.at.toFixed(
          1,
        )}s as an empty painted shape; bring the incoming content up before the handoff finishes, or drop the carrier's own background so it is a container rather than a box.`,
      );
    }

    // A morph is the carrier's own outline changing; a match-cut is the
    // carrier holding its silhouette across the cut. Only the first has a
    // geometric signature this can check.
    if (seam.mechanism !== "morph") continue;
    const widthChange = relativeChange(enteringRect.width, leavingRect.width);
    const heightChange = relativeChange(
      enteringRect.height,
      leavingRect.height,
    );
    const moved =
      Math.hypot(
        leavingRect.left - enteringRect.left,
        leavingRect.top - enteringRect.top,
      ) / Math.max(1, Math.hypot(rootRect.width, rootRect.height));
    if (
      Math.max(widthChange, heightChange) < MORPH_MIN_CHANGE &&
      moved < MORPH_MIN_CHANGE
    ) {
      warnings.push(
        `The morph at ${seam.at.toFixed(1)}s does not change its carrier "${
          seam.carrier
        }": the element has the same size and position on both sides, so the beats swap behind a static object.`,
      );
    }
  }
  return warnings;
}

function relativeChange(first: number, second: number): number {
  const base = Math.max(1, Math.max(first, second));
  return Math.abs(first - second) / base;
}

/**
 * Whether consecutive beats are the same film.
 *
 * The seam checks ask whether the carrier a generation *declared* crosses its
 * boundary. This asks the blunter question the viewer actually asks: is
 * anything at all on screen on both sides of the cut? A film can declare a
 * perfectly sound carrier chain and still build every beat out of a fresh set
 * of elements, and what plays back is four unrelated layouts in a row — the
 * "why is each scene separate" report. Nothing in the source reveals it,
 * because each beat is individually well made.
 */
function assertBeatsShareMaterial(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scenes: readonly SceneDefinition[],
  limit: number,
): void {
  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0) return;
  const canvasArea = rootRect.width * rootRect.height;
  const subjectsAt = (time: number): Set<HTMLElement> => {
    runtime.seek(Math.max(0, Math.min(limit, time)));
    const visible = visibleElements(root, rootRect, true);
    return new Set(frameSubjects(visible, canvasArea));
  };
  for (let index = 0; index < scenes.length - 1; index += 1) {
    const scene = scenes[index];
    const next = scenes[index + 1];
    if (!scene || !next) continue;
    const cut = scene.start + scene.duration;
    const before = subjectsAt(cut - 0.15);
    const after = subjectsAt(cut + 0.15);
    // An empty side of the cut used to be skipped, which is precisely the
    // dead-frame dissolve: the outgoing beat is gone, the incoming one has not
    // arrived, and the boundary passes through an empty screen.
    if (before.size === 0 || after.size === 0) {
      const side = before.size === 0 ? "before" : "after";
      throw new Error(
        `The cut from ${scene.id} to ${next.id} at ${cut.toFixed(
          1,
        )}s passes through an empty frame: nothing is on screen ${side} it. Overlap the two beats so the incoming material is already arriving as the outgoing material leaves, instead of clearing the frame between them.`,
      );
    }
    const shared = [...before].filter((element) => after.has(element));
    if (shared.length > 0) continue;
    throw new Error(
      `Nothing survives the cut from ${scene.id} to ${next.id} at ${cut.toFixed(
        1,
      )}s: every object on screen is replaced at once, so the beats read as separate films rather than one. Build ${next.id} around something already on screen in ${scene.id} — keep that element visible across the boundary and let it become the subject of the beat after it.`,
    );
  }
}

/**
 * A stretch of film with nothing on screen.
 *
 * The per-beat frame checks sample inside each scene, so a blank hole that
 * opens between two beats — the fade-to-white a generation reaches for when it
 * does not know how to get from one layout to another — falls through the gap
 * between their samples. This walks the whole timeline instead.
 *
 * The opening moments are exempt: a film is allowed to begin on an empty ground
 * and bring its first beat in.
 */
function assertNoDeadFrames(
  runtime: CompositionRuntime,
  root: HTMLElement,
  duration: number,
): void {
  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0) return;
  const canvasArea = rootRect.width * rootRect.height;
  const step = 0.2;
  /** Two consecutive blank samples is a hole; one is a crossover. */
  const minimumRun = 0.4;
  let runStart: number | null = null;
  for (let time = 0.4; time <= duration; time += step) {
    runtime.seek(Math.min(time, duration));
    const visible = visibleElements(root, rootRect, true);
    const covered = frameSubjects(visible, canvasArea).reduce(
      (total, element) => {
        const rect = element.getBoundingClientRect();
        return total + rect.width * rect.height;
      },
      0,
    );
    const blank = covered / canvasArea < 0.01;
    if (!blank) {
      runStart = null;
      continue;
    }
    if (runStart === null) runStart = time;
    if (time - runStart < minimumRun) continue;
    throw new Error(
      `The film holds a blank frame from ${runStart.toFixed(
        1,
      )}s: everything leaves the screen before the next beat arrives. Never dissolve through an empty frame — keep the ground and at least one object on screen and move the material spatially instead.`,
    );
  }
}

/**
 * Whether the film ever puts a real statement on screen.
 *
 * Across every studied reference an editorial line spans 45-85% of the frame,
 * and none contains a statement under roughly 70px at 1080. Generated output
 * lands at 28-40px inside a pill with a grey subtitle beneath it, which is why
 * the films read as slide decks and why a viewer cannot tell what is being
 * claimed. Measured as a share of frame width so it holds at any canvas size.
 */
function assertFilmMakesAStatement(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scenes: readonly SceneDefinition[],
  limit: number,
): void {
  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0) return;
  // Shorter than the briefest real film the skill contemplates. A two-second
  // composition is a fragment or a fixture, and asking it for an editorial
  // statement is asking the wrong question.
  if (limit < 8) return;
  let widest = 0;
  const sample = (time: number): void => {
    runtime.seek(Math.max(0, Math.min(limit, time)));
    for (const leaf of textLeaves(visibleElements(root, rootRect, true))) {
      const rect = leaf.getBoundingClientRect();
      if (rect.height < 8) continue;
      widest = Math.max(widest, rect.width / rootRect.width);
    }
  };
  for (const scene of scenes) {
    for (const progress of [0.3, 0.6, 0.9]) {
      sample(scene.start + scene.duration * progress);
    }
  }
  if (widest >= 0.3) return;
  throw new Error(
    `The film never states anything: its largest line of type spans only ${(
      widest * 100
    ).toFixed(
      0,
    )}% of the frame. Give the one beat that has to land a statement spanning 60-75% of the frame width — about 180-215px at 1080 — centred, with no subtitle beneath it. Other beats may carry much smaller lines; what is missing is a moment that lands.`,
  );
}

/**
 * Type running off the edge of the frame.
 *
 * `visibleElements` only asks whether an element intersects the viewport, so a
 * line half outside it counts as on screen and passes every other check. The
 * result is a resolve reading "Build your company's workspace in Not" with the
 * mark itself cut away, which is the single most obviously broken thing a
 * viewer can be shown.
 *
 * Sampled late in each beat only. Type is *supposed* to arrive cropped and
 * oversized; what must not happen is that it is still clipped once it has
 * settled.
 */
function assertTypeStaysInFrame(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scenes: readonly SceneDefinition[],
  limit: number,
): void {
  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0) return;
  /** Antialiasing and descender slop, not a broken layout. */
  const tolerance = 8;
  const check = (time: number, scene: SceneDefinition): void => {
    runtime.seek(Math.max(0, Math.min(limit, time)));
    for (const leaf of textLeaves(visibleElements(root, rootRect, true))) {
      const rect = leaf.getBoundingClientRect();
      const over = Math.max(
        rootRect.left - rect.left,
        rect.right - rootRect.right,
        rootRect.top - rect.top,
        rect.bottom - rootRect.bottom,
      );
      if (over <= tolerance) continue;
      throw new Error(
        `Scene ${scene.id} lets settled type run ${Math.round(
          over,
        )}px outside the frame around ${time.toFixed(2)}s: "${(
          leaf.textContent ?? ""
        )
          .trim()
          .slice(
            0,
            40,
          )}" is cut off by the edge of the canvas. Size the line to fit inside the viewport with margins, and centre it; a statement that spans more than 85% of the frame width is too long for its font size.`,
      );
    }
  };
  for (const scene of scenes) {
    // Late in the beat: the entrance is allowed to be cropped, the hold is not.
    check(scene.start + scene.duration * 0.65, scene);
    check(scene.start + scene.duration * 0.92, scene);
  }
  const last = scenes.at(-1);
  if (last) check(limit, last);
}

/**
 * Objects that settle half outside the canvas.
 *
 * `assertTypeStaysInFrame` has always measured this for type, and only for
 * type, so a headline running off the edge was caught while the device mock,
 * the card, the logo or the image beside it could settle anywhere. Nothing in
 * the source reveals it: the markup centres the object and the timeline moves
 * it, and only the composed result says where it actually landed.
 *
 * It matters most where there is no one watching. A local film is rendered and
 * the frames go back to the model, which can see an object hanging off the
 * edge whether or not a check has words for it. A cloud film has no such eyes,
 * so on that path this measurement is the only thing between a clipped subject
 * and a shipped film.
 *
 * Judged by how much of the object is lost rather than by pixels alone: a
 * decorative shape bleeding a few pixels past the edge is a composition, while
 * a card with a third of itself outside the frame is a mistake.
 */
function assertSubjectsStayInFrame(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scenes: readonly SceneDefinition[],
  limit: number,
): void {
  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0) return;
  const canvasArea = rootRect.width * rootRect.height;
  /** Below this share of itself on screen, the object reads as cut off. */
  const minimumVisible = 0.85;
  /** Antialiasing and deliberate bleed, not a broken layout. */
  const tolerance = 24;
  const check = (time: number, scene: SceneDefinition): void => {
    runtime.seek(Math.max(0, Math.min(limit, time)));
    const visible = visibleElements(root, rootRect, true);
    for (const subject of frameSubjects(visible, canvasArea)) {
      // Type has its own check, with a tighter tolerance and a better message.
      if (textLeaves([subject]).length > 0) continue;
      const rect = subject.getBoundingClientRect();
      const over = Math.max(
        rootRect.left - rect.left,
        rect.right - rootRect.right,
        rootRect.top - rect.top,
        rect.bottom - rootRect.bottom,
      );
      if (over <= tolerance) continue;
      const shown =
        (Math.max(
          0,
          Math.min(rect.right, rootRect.right) -
            Math.max(rect.left, rootRect.left),
        ) *
          Math.max(
            0,
            Math.min(rect.bottom, rootRect.bottom) -
              Math.max(rect.top, rootRect.top),
          )) /
        Math.max(1, rect.width * rect.height);
      if (shown >= minimumVisible) continue;
      const name = subject.dataset["edit"] ?? subject.tagName.toLowerCase();
      throw new Error(
        `Scene ${scene.id} leaves "${name}" ${Math.round(
          (1 - shown) * 100,
        )}% outside the frame around ${time.toFixed(
          2,
        )}s, ${Math.round(over)}px past the edge. An object that has settled must sit inside the canvas with margins; move it back into frame, or size it to fit, and let the camera travel instead of the object leaving.`,
      );
    }
  };
  for (const scene of scenes) {
    // Late in the beat: an object is allowed to enter from off-screen, and is
    // not allowed to still be hanging off the edge once the beat has settled.
    check(scene.start + scene.duration * 0.65, scene);
    check(scene.start + scene.duration * 0.92, scene);
  }
}

/** Which edge an element runs past, and by how far. */
function overflow(
  rect: DOMRect,
  rootRect: DOMRect,
): { edge: string; px: number } {
  const edges = [
    { edge: "left", px: rootRect.left - rect.left },
    { edge: "right", px: rect.right - rootRect.right },
    { edge: "top", px: rootRect.top - rect.top },
    { edge: "bottom", px: rect.bottom - rootRect.bottom },
  ];
  return edges.reduce((worst, candidate) =>
    candidate.px > worst.px ? candidate : worst,
  );
}

/** At most this many objects per moment; past it the line stops being read. */
const ACCOUNT_SUBJECTS = 6;

/**
 * What the film actually puts on screen at given moments, measured.
 *
 * The repair loop's complaints name faults one at a time — this overlaps, that
 * is too small — and a model reading them has to imagine the frame they came
 * out of. This is that frame, written down: every object the viewer can see,
 * its size and where it sits, as a share of the canvas.
 *
 * It exists for the cloud path. A local repair attaches real rendered frames
 * and the model can simply look; a cloud generation happens inside the backend,
 * where the only channel from this editor is the text of the message, so the
 * picture has to arrive as numbers. Those numbers are unavailable from the
 * source at any price: the markup says `left: 50%` and the timeline says
 * `xPercent: -50`, and only the composed result says the card ended up three
 * quarters off the right edge.
 */
export function describeRenderedFrames(
  runtime: CompositionRuntime,
  root: HTMLElement,
  moments: readonly number[],
): string[] {
  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0) return [];
  const canvasArea = rootRect.width * rootRect.height;
  const share = (value: number, total: number): number =>
    Math.round((value / total) * 100);
  return moments.map((time) => {
    runtime.seek(Math.max(0, time));
    const visible = visibleElements(root, rootRect, true);
    const subjects = frameSubjects(visible, canvasArea)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .sort(
        (first, second) =>
          second.rect.width * second.rect.height -
          first.rect.width * first.rect.height,
      )
      .slice(0, ACCOUNT_SUBJECTS);
    if (subjects.length === 0) {
      return `${time.toFixed(2)}s: nothing on screen.`;
    }
    const described = subjects.map(({ element, rect }) => {
      const name = element.dataset["edit"] ?? element.tagName.toLowerCase();
      const text = (element.textContent ?? "").trim();
      const label = text ? ` "${text.slice(0, 32)}"` : "";
      const centreX = share(
        rect.left + rect.width / 2 - rootRect.left,
        rootRect.width,
      );
      const centreY = share(
        rect.top + rect.height / 2 - rootRect.top,
        rootRect.height,
      );
      const size = `${share(rect.width, rootRect.width)}x${share(
        rect.height,
        rootRect.height,
      )}%`;
      const past = overflow(rect, rootRect);
      const clipped =
        past.px > 1 ? `, ${Math.round(past.px)}px past the ${past.edge}` : "";
      return `${name}${label} ${size} centred ${centreX},${centreY}%${clipped}`;
    });
    return `${time.toFixed(2)}s: ${described.join("; ")}.`;
  });
}

/**
 * Beats that are the same picture with different words.
 *
 * The skill already requires adjacent beats to differ in framing, and this is
 * the shape the requirement exists to prevent: a headline on the upper third
 * and a small panel under it, five times, with the camera never moving. Nothing
 * in the source reveals it — every beat is individually well formed — so it is
 * measured as the geometry of what each beat actually puts on screen.
 */
function assertBeatsAreFramedDifferently(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scenes: readonly SceneDefinition[],
  limit: number,
): void {
  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0 || scenes.length < 3) return;
  const canvasArea = rootRect.width * rootRect.height;
  const framings = scenes.map((scene) => {
    runtime.seek(
      Math.max(0, Math.min(limit, scene.start + scene.duration * 0.7)),
    );
    const subjects = frameSubjects(
      visibleElements(root, rootRect, true),
      canvasArea,
    );
    let widest: DOMRect | null = null;
    for (const element of subjects) {
      const rect = element.getBoundingClientRect();
      if (!widest || rect.width * rect.height > widest.width * widest.height) {
        widest = rect;
      }
    }
    return widest;
  });

  let repeats = 0;
  const offenders: string[] = [];
  for (let index = 0; index < framings.length - 1; index += 1) {
    const first = framings[index];
    const second = framings[index + 1];
    if (!first || !second) continue;
    const centreShift =
      Math.hypot(
        first.left + first.width / 2 - (second.left + second.width / 2),
        first.top + first.height / 2 - (second.top + second.height / 2),
      ) / Math.hypot(rootRect.width, rootRect.height);
    const sizeRatio =
      Math.min(first.width * first.height, second.width * second.height) /
      Math.max(
        1,
        Math.max(first.width * first.height, second.width * second.height),
      );
    if (centreShift < 0.04 && sizeRatio > 0.85) {
      repeats += 1;
      offenders.push(`${scenes[index]?.id} and ${scenes[index + 1]?.id}`);
    }
  }
  if (repeats < 2) return;
  throw new Error(
    `The film is one composition repeated: ${offenders
      .slice(0, 3)
      .join(
        ", ",
      )} put their subject at the same size in the same place. Adjacent beats must change framing — a wide after a macro, a full-bleed after a detail — and the camera must move between them, instead of swapping the copy inside a fixed layout.`,
  );
}

/**
 * A statement sharing its beat with objects that compete for the eye.
 *
 * In every reference film an editorial beat is one line on an otherwise empty
 * ground, held for a second and a half with nothing beside it. Generated films
 * put a headline on the upper third and park two or three small cards
 * underneath, and the beat then says nothing, because the viewer cannot tell
 * whether to read the sentence or inspect the cards.
 *
 * A full-bleed ground behind the type is fine — it is excluded by the same
 * 60% ceiling `frameSubjects` uses everywhere — and so is one inline icon, so
 * the rule only fires when a statement is genuinely sharing the frame.
 */
function assertStatementsStandAlone(
  runtime: CompositionRuntime,
  root: HTMLElement,
  scenes: readonly SceneDefinition[],
  limit: number,
): void {
  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0) return;
  const canvasArea = rootRect.width * rootRect.height;
  for (const scene of scenes) {
    // Late in the beat: an outgoing beat's material may still be leaving early
    // on, and that overlap is the transition, not competition.
    const time = Math.max(
      0,
      Math.min(limit, scene.start + scene.duration * 0.75),
    );
    runtime.seek(time);
    const visible = visibleElements(root, rootRect, true);
    const subjects = frameSubjects(visible, canvasArea);
    if (subjects.length === 0) continue;

    // Is this beat led by type? Only then does the rule apply.
    const statement = textLeaves(visible)
      .filter(
        (leaf) => leaf.getBoundingClientRect().width / rootRect.width > 0.3,
      )
      .sort(
        (first, second) =>
          second.getBoundingClientRect().width -
          first.getBoundingClientRect().width,
      )[0];
    if (!statement) continue;

    const competing = subjects.filter((element) => {
      if (element === statement) return false;
      if (element.contains(statement) || statement.contains(element)) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      // An inline icon sized to the type is part of the sentence.
      const asTall = rect.height / statement.getBoundingClientRect().height;
      return asTall > 1.6 && (rect.width * rect.height) / canvasArea > 0.02;
    });
    if (competing.length === 0) continue;
    const named = competing
      .slice(0, 3)
      .map(
        (element) => element.dataset["edit"] ?? element.tagName.toLowerCase(),
      )
      .join(", ");
    throw new Error(
      `Scene ${scene.id} makes its statement compete with ${competing.length} other object${
        competing.length === 1 ? "" : "s"
      } (${named}) at ${time.toFixed(
        1,
      )}s. A beat that exists to say something holds the sentence alone on the ground — no cards under it, no panels beside it. Move that material into its own beat and alternate statement, material, statement.`,
    );
  }
}

function assertAssetsUsed(html: string, tokens: readonly string[]): void {
  const missing = tokens.filter((token) => !html.includes(token));
  if (missing.length > 0) {
    throw new Error(
      `AI did not use ${missing.length} attached image${missing.length === 1 ? "" : "s"}.`,
    );
  }
  const unsourced = tokens.filter((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(
      `(?:(?:src|srcset|href|data-src|xlink:href)\\s*=\\s*["']?[^"'>]{0,80}|url\\(\\s*["']?[^"')]{0,80})${escaped}`,
      "i",
    ).test(html);
  });
  if (unsourced.length > 0) {
    throw new Error(
      `AI referenced ${unsourced.length} attached image${
        unsourced.length === 1 ? "" : "s"
      } without rendering it as a visible source.`,
    );
  }
}

/**
 * The runtime pads a short timeline out to the composition duration, so
 * `timeline.duration()` cannot reveal a film that stops early. Measure the last
 * authored tween instead: filler tweens on plain objects do not count.
 */
function authoredEnd(timeline: gsap.core.Timeline): number {
  let end = 0;
  for (const child of timeline.getChildren(false, true, true)) {
    const asTween = child as gsap.core.Tween;
    const targets =
      typeof asTween.targets === "function" ? asTween.targets() : null;
    const meaningful =
      targets === null ||
      targets.some((target) => target instanceof Element) ||
      typeof child.vars?.["onUpdate"] === "function";
    if (!meaningful) continue;
    end = Math.max(end, child.endTime());
  }
  return end;
}

function editIds(source: string): Set<string> {
  const documentNode = new DOMParser().parseFromString(source, "text/html");
  const template = documentNode.querySelector("template");
  const scope: ParentNode = template?.content ?? documentNode;
  return new Set(
    Array.from(scope.querySelectorAll<HTMLElement>("[data-edit]"))
      .map((element) => element.dataset["edit"]?.trim() ?? "")
      .filter(Boolean),
  );
}

const SCENE_ACCENTS = ["#6366f1", "#22d3ee", "#f59e0b", "#f472b6", "#34d399"];

function wholeFilmScene(duration: number): SceneDefinition {
  return {
    id: "scene-01",
    label: "01 · Scene",
    start: 0,
    duration,
    accent: SCENE_ACCENTS[0] ?? "#6366f1",
  };
}

/**
 * Models routinely author `data-scene` beats in the markup and then omit the
 * top-level scenes array. Reading the beats back off the DOM keeps the
 * storyboard the user sees matching the film they are watching; the split is
 * even because the markup records which beats exist, not where they cut.
 */
function scenesFromMarkup(
  html: string,
  duration: number,
): readonly SceneDefinition[] {
  const ids: string[] = [];
  for (const match of html.matchAll(/data-scene=["']([^"']+)["']/gi)) {
    const id = (match[1] ?? "").trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  if (ids.length < 2) return [wholeFilmScene(duration)];
  const span = duration / ids.length;
  return ids.map((id, index) => ({
    id,
    label: `${String(index + 1).padStart(2, "0")} · ${id}`,
    start: index * span,
    duration: span,
    accent: SCENE_ACCENTS[index % SCENE_ACCENTS.length] ?? "#6366f1",
  }));
}

function sceneIdsFromMarkup(html: string): readonly string[] {
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  const template = documentNode.querySelector("template");
  const scope: ParentNode = template?.content ?? documentNode;
  return Array.from(scope.querySelectorAll<HTMLElement>("[data-scene]"))
    .map((element) => element.dataset["scene"]?.trim() ?? "")
    .filter(Boolean);
}

function assertDeclaredScenesAreAuthored(
  scenes: readonly SceneDefinition[],
  html: string,
): void {
  if (scenes.length < 2) return;
  const declaredIds = scenes.map((scene) => scene.id.trim());
  const uniqueIds = new Set(declaredIds);
  if (uniqueIds.size !== declaredIds.length) {
    throw new Error(
      "AI returned duplicate scene IDs, so multiple storyboard entries point at the same beat.",
    );
  }
  const authoredIds = new Set(sceneIdsFromMarkup(html));
  const missing = declaredIds.filter((id) => !authoredIds.has(id));
  if (missing.length === 0) return;
  throw new Error(
    `AI declared ${scenes.length} scenes but did not author data-scene layers for: ${missing.join(
      ", ",
    )}. Every storyboard scene must have visible composition content.`,
  );
}

interface NormalizedScenes {
  /** The storyboard the editor shows and the runtime navigates. */
  readonly scenes: readonly SceneDefinition[];
  /**
   * The beats the frame assertions run against. Inferred boundaries record
   * which beats exist, not where they cut, so checking a beat's frames against
   * a guessed window would reject correct films for being at the wrong moment.
   * When the cuts are unknown, the whole film is validated as one beat.
   */
  readonly validated: readonly SceneDefinition[];
}

function normalizedScenes(
  result: DirectAiResult,
  previousScenes: readonly SceneDefinition[],
  allowStructuralChange: boolean,
  duration: number,
  replacesPreviousComposition: boolean,
): NormalizedScenes {
  if (!allowStructuralChange && previousScenes.length > 0) {
    return { scenes: previousScenes, validated: previousScenes };
  }
  if (result.scenes?.length) {
    return { scenes: result.scenes, validated: result.scenes };
  }
  // Replaying the beats of footage that no longer exists would validate the
  // new film against the previous film's cuts.
  if (replacesPreviousComposition || previousScenes.length === 0) {
    return {
      scenes: scenesFromMarkup(result.compositionHtml, duration),
      validated: [wholeFilmScene(duration)],
    };
  }
  return { scenes: previousScenes, validated: previousScenes };
}

/**
 * Which render failures are worth refusing the film over.
 *
 * A composition that renders no frame, includes an empty declared beat, or
 * deletes layers the user shaped by hand leaves the editor unusable or destroys
 * work only the user can redo. Directorial faults such as small framing, weak
 * continuity, or overflowing type can still ship after the repair loop has
 * spent its passes, with an honest note attached.
 */
export function isFatalRenderFailure(message: string): boolean {
  return /renders no visible foreground|near-blank frame|passes through an empty frame|never renders visible scene content|did not author data-scene layers|duplicate scene IDs|no finite playable duration|no explicit data-edit layers|invalid composition duration|past the .{0,20}ceiling|removed layers you edited|did not use \d+ attached image|without rendering it as a visible source|does not parse|must export or define/i.test(
    message,
  );
}

export interface ValidatedGeneration {
  result: DirectAiResult;
  duration: number;
  scenes: readonly SceneDefinition[];
  /** Directorial notes about output that is correct but not yet cinematic. */
  warnings: readonly string[];
}

export function validateGeneratedComposition(
  result: DirectAiResult,
  options: {
    prompt: string;
    previousHtml: string;
    previousDuration: number;
    previousScenes: readonly SceneDefinition[];
    requiredAssetTokens?: readonly string[];
    renderedHtml?: string;
    /**
     * Which composition this generation started from. The bundled foundation is
     * scaffolding, not the user's work: its layers exist to be replaced, so
     * protecting them rejects every first film a user ever asks for.
     */
    generationProfile?: "claude-foundation-v1" | "existing";
    /**
     * Layers the user has moved, resized, restyled, or retimed by hand. Only
     * these are unrecoverable if an edit drops them; the rest of the previous
     * composition was authored by the model and it may re-cut its own work.
     */
    userEditedIds?: readonly string[];
    /**
     * Report directorial frame failures instead of throwing them.
     *
     * The generation loop validates every candidate strictly, so a weak beat
     * drives a repair pass. Once the loop has spent its passes, the winning
     * candidate is validated again to produce the scenes and duration the
     * editor mounts — and that second call must not throw for a fault the loop
     * already tried and failed to fix, or the user gets an error where their
     * film should be.
     */
    lenient?: boolean;
  },
): ValidatedGeneration {
  const allowStructuralChange =
    options.generationProfile === "claude-foundation-v1" ||
    STRUCTURAL_REQUEST.test(options.prompt);
  const previousIds = editIds(options.previousHtml);
  const nextIds = editIds(result.compositionHtml);
  if (nextIds.size === 0) {
    throw new Error("AI composition has no explicit data-edit layers.");
  }
  const droppedLayers = allowStructuralChange
    ? []
    : [...previousIds].filter((id) => !nextIds.has(id));
  // Losing a layer the user shaped by hand destroys work only they can redo.
  const droppedUserWork = droppedLayers.filter((id) =>
    (options.userEditedIds ?? []).includes(id),
  );
  if (droppedUserWork.length > 0) {
    throw new Error(
      `AI edit removed layers you edited by hand: ${droppedUserWork.slice(0, 8).join(", ")}.`,
    );
  }

  assertAssetsUsed(result.compositionHtml, options.requiredAssetTokens ?? []);

  const requestedDuration = Number(result.duration);
  let duration =
    allowStructuralChange && Number.isFinite(requestedDuration)
      ? requestedDuration
      : options.previousDuration;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > MAX_COMPOSITION_SECONDS
  ) {
    throw new Error("AI returned an invalid composition duration.");
  }
  /**
   * A storyboard that runs a little past the declared duration is arithmetic,
   * not a broken film.
   *
   * Models routinely write six beats of five seconds and then declare a 20s
   * duration, and this threw before the frames were ever inspected — outside
   * the lenient path — so the user got "Scene scene-06 falls outside the
   * composition duration" and an empty canvas instead of a film that plays. The
   * timeline overrun a few lines below is already handled by extending the
   * composition to fit and saying so; the storyboard gets the same treatment.
   * Genuinely malformed beats still fail below, and the ceiling still holds.
   */
  const declaredEnd = Math.max(
    0,
    ...(result.scenes ?? []).map(
      (scene) => Number(scene.start) + Number(scene.duration),
    ),
  );
  const sceneOverrunWarnings: string[] = [];
  if (
    allowStructuralChange &&
    Number.isFinite(declaredEnd) &&
    declaredEnd > duration + 1 / 30 &&
    declaredEnd <= MAX_COMPOSITION_SECONDS
  ) {
    sceneOverrunWarnings.push(
      `The storyboard runs ${declaredEnd.toFixed(1)}s against a declared ${duration.toFixed(1)}s, so the composition was extended to fit its beats.`,
    );
    duration = declaredEnd;
  }
  const { scenes, validated } = normalizedScenes(
    result,
    options.previousScenes,
    allowStructuralChange,
    duration,
    options.generationProfile === "claude-foundation-v1",
  );
  const requiresAuthoredSceneLayers =
    allowStructuralChange && (result.scenes?.length ?? 0) > 1;
  if (requiresAuthoredSceneLayers) {
    assertDeclaredScenesAreAuthored(scenes, result.compositionHtml);
  }
  for (const scene of scenes) {
    if (
      !Number.isFinite(scene.start) ||
      !Number.isFinite(scene.duration) ||
      scene.start < 0 ||
      scene.duration <= 0 ||
      scene.start + scene.duration > duration + 1 / 30
    ) {
      throw new Error(
        `Scene ${scene.id} falls outside the composition duration.`,
      );
    }
  }
  const seams = seamsFromResult(result.seams);
  const warnings = [
    ...sceneOverrunWarnings,
    ...carrierContinuityWarnings(
      result.timelineJs,
      result.compositionHtml,
      scenes,
      seams,
    ),
  ];
  const recomposed = droppedLayers.filter(
    (id) => !droppedUserWork.includes(id),
  );
  if (recomposed.length > 0) {
    warnings.push(
      `This edit re-cut ${recomposed.length} layer${
        recomposed.length === 1 ? "" : "s"
      } rather than editing them in place (${recomposed.slice(0, 5).join(", ")}).`,
    );
  }

  const composition = createDynamicComposition(
    options.renderedHtml ?? result.compositionHtml,
    result.timelineJs,
    { title: result.title, duration, scenes },
  );
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;left:-100000px;top:-100000px;width:1920px;height:1080px";
  document.body.append(root);
  let runtime: CompositionRuntime | null = null;
  try {
    runtime = new CompositionRuntime(composition, root);
    const actualDuration = runtime.timeline.duration();
    if (!Number.isFinite(actualDuration) || actualDuration <= 0) {
      throw new Error("AI timeline has no finite playable duration.");
    }
    // The film is as long as its motion. A timeline that runs past the
    // requested length is the model answering "hold this longer", not an
    // error, so the composition adopts it rather than rejecting the edit.
    if (actualDuration > duration + 1 / composition.fps) {
      if (actualDuration > MAX_COMPOSITION_SECONDS) {
        throw new Error(
          `AI timeline runs ${actualDuration.toFixed(2)}s, past the ${MAX_COMPOSITION_SECONDS}s ceiling.`,
        );
      }
      duration = actualDuration;
      warnings.push(
        `The timeline runs ${actualDuration.toFixed(1)}s, so the composition was extended to match.`,
      );
    }
    const lastAuthored = authoredEnd(runtime.timeline);
    if (scenes.length >= 2 && lastAuthored < duration * 0.7) {
      throw new Error(
        `AI timeline stops at ${lastAuthored.toFixed(
          2,
        )}s and leaves the rest of the ${duration.toFixed(2)}s composition frozen.`,
      );
    }
    const sceneIds = new Set(validated.map((scene) => scene.id));
    const windows = sceneRenderWindows(validated, seams);
    const limit = Math.max(0, duration - 1 / composition.fps);
    // Captured so the closure keeps the non-null narrowing the mount gives us.
    const mounted = runtime;
    const inspectFrames = (): void => {
      // Check every declared beat first. A weaker global-frame complaint (for
      // example, an empty future layer being treated as stale) must not mask a
      // missing scene and let lenient validation ship it as a warning.
      if (requiresAuthoredSceneLayers) {
        for (const scene of validated) {
          assertSceneRendersOwnedContent(mounted, root, scene, limit);
        }
      }
      for (const scene of validated) {
        for (const progress of [0.25, 0.5, 0.8]) {
          const time = Math.min(limit, scene.start + scene.duration * progress);
          assertVisibleSceneFrame(
            mounted,
            root,
            scene,
            sceneIds,
            Math.max(0, time),
            windows,
          );
        }
        assertSceneDevelops(mounted, root, scene, limit);
      }
      assertSeamFramesHoldTheFilm(mounted, root, seams, limit);
      assertBeatsShareMaterial(mounted, root, validated, limit);
      assertNoDeadFrames(mounted, root, limit);
      assertFilmMakesAStatement(mounted, root, validated, limit);
      assertTypeStaysInFrame(mounted, root, validated, limit);
      assertSubjectsStayInFrame(mounted, root, validated, limit);
      assertBeatsAreFramedDifferently(mounted, root, validated, limit);
      assertStatementsStandAlone(mounted, root, validated, limit);
      const finalScene = validated.at(-1);
      if (finalScene) {
        assertVisibleSceneFrame(
          mounted,
          root,
          finalScene,
          sceneIds,
          limit,
          windows,
        );
      }
    };
    try {
      inspectFrames();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!options.lenient || isFatalRenderFailure(message)) throw error;
      warnings.push(message);
    }
    warnings.push(...seamRenderWarnings(runtime, root, seams, limit));
    warnings.push(...deadAirWarnings(runtime, root, limit));
  } finally {
    runtime?.destroy();
    root.remove();
  }
  return { result, duration, scenes, warnings };
}

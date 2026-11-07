/**
 * Stock slots: the places a film asks for a stock photo or clip.
 *
 * The generation marks a scene that wants real-world footage with an empty
 * element and the words to search for, in the same pass that writes the film:
 *
 *   <img data-motify-stock="photo" data-stock-query="barista pouring latte">
 *   <video data-motify-video data-motify-stock="video" data-stock-query="city at night" data-start="3">
 *
 * The chat searches Pixabay with those words and the person picks a result,
 * which is stored as a workspace asset and written into the slot's `src` as a
 * `motify-asset://` token, so preview and export draw it like any upload.
 *
 * Edits splice only the slot's own opening tag, leaving every other byte of
 * the film as it was. Placement uses the individual `translate`, `scale` and
 * `z-index` properties, which compose with whatever transform the film's own
 * script animates, so moving a picture never fights its motion.
 */

export type StockKind = "photo" | "video";

export interface StockCredit {
  id: number;
  creator: string;
  creatorUrl: string;
  sourceUrl: string;
}

export interface StockPlacement {
  /** Offset from where the film puts it, in canvas pixels. */
  x: number;
  y: number;
  scale: number;
  /** CSS z-index; null leaves the film's stacking alone. */
  layer: number | null;
  fit: "cover" | "contain";
}

export interface StockClip {
  /** Film second the clip starts playing. */
  start: number;
  /** Clip second it starts from. */
  trim: number;
  loop: boolean;
}

export interface StockSlot {
  /** Position among the film's slots, in document order. */
  index: number;
  kind: StockKind;
  query: string;
  /** The picked asset, once there is one. */
  assetId: string | null;
  credit: StockCredit | null;
  placement: StockPlacement;
  clip: StockClip | null;
}

export interface StockSlotPatch {
  pick?: { assetId: string; credit: StockCredit };
  query?: string;
  placement?: Partial<StockPlacement>;
  clip?: Partial<StockClip>;
}

const ASSET_TOKEN =
  /^motify-asset:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** An opening <img> or <video> tag; quoted attribute values may contain `>`. */
const MEDIA_TAG = /<(img|video)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const SCRIPT_BLOCK = /<script\b[\s\S]*?<\/script\s*>/gi;

interface TagMatch {
  start: number;
  end: number;
  element: HTMLElement;
}

/** Slot tags in document order, skipping anything inside a <script>. */
function slotTags(html: string): TagMatch[] {
  const scripts = Array.from(html.matchAll(SCRIPT_BLOCK), (match) => ({
    from: match.index ?? 0,
    to: (match.index ?? 0) + match[0].length,
  }));
  const insideScript = (offset: number) =>
    scripts.some(({ from, to }) => offset >= from && offset < to);
  const tags: TagMatch[] = [];
  for (const match of html.matchAll(MEDIA_TAG)) {
    const start = match.index ?? 0;
    if (insideScript(start) || !/data-motify-stock/i.test(match[0])) continue;
    const element = parseTag(match[0], (match[1] ?? "img").toLowerCase());
    if (!element || !isStockKind(element.dataset["motifyStock"])) continue;
    tags.push({ start, end: start + match[0].length, element });
  }
  return tags;
}

function parseTag(tag: string, name: string): HTMLElement | null {
  const template = document.createElement("template");
  template.innerHTML = name === "video" ? `${tag}</video>` : tag;
  const element = template.content.firstElementChild;
  return element instanceof HTMLElement ? element : null;
}

/** The element's opening tag as HTML, without children or a closing tag. */
function openingTag(element: HTMLElement): string {
  const html = element.outerHTML;
  return element.tagName === "VIDEO"
    ? html.replace(/<\/video>\s*$/i, "")
    : html;
}

function isStockKind(value: unknown): value is StockKind {
  return value === "photo" || value === "video";
}

function seconds(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function pixels(value: string): [number, number] {
  const [x = "0", y = "0"] = value.trim().split(/\s+/);
  const read = (part: string) => {
    const parsed = Number.parseFloat(part);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return [read(x), read(y)];
}

function readSlot(element: HTMLElement, index: number): StockSlot {
  const kind = element.dataset["motifyStock"] as StockKind;
  const src = element.getAttribute("src") ?? "";
  const id = Number.parseInt(element.dataset["stockId"] ?? "", 10);
  const [x, y] = pixels(element.style.translate);
  const scale = Number.parseFloat(element.style.scale);
  const layer = Number.parseInt(element.style.zIndex, 10);
  return {
    index,
    kind,
    query: (element.dataset["stockQuery"] ?? "").trim(),
    assetId: ASSET_TOKEN.exec(src)?.[1] ?? null,
    credit:
      Number.isFinite(id) && id > 0
        ? {
            id,
            creator: element.dataset["stockCreator"] ?? "",
            creatorUrl: element.dataset["stockCreatorUrl"] ?? "",
            sourceUrl: element.dataset["stockSource"] ?? "",
          }
        : null,
    placement: {
      x,
      y,
      scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
      layer: Number.isFinite(layer) ? layer : null,
      fit: element.style.objectFit === "contain" ? "contain" : "cover",
    },
    clip:
      kind === "video"
        ? {
            start: seconds(element.dataset["start"]),
            trim: seconds(element.dataset["trim"]),
            loop: element.hasAttribute("loop"),
          }
        : null,
  };
}

/** Every stock slot in a film's HTML, filled or not. */
export function parseStockSlots(html: string): StockSlot[] {
  if (!/data-motify-stock/i.test(html)) return [];
  return slotTags(html).map((tag, index) => readSlot(tag.element, index));
}

const round = (value: number, places = 2) =>
  Math.round(value * 10 ** places) / 10 ** places;

/**
 * Writes a patch onto a slot element: the same function edits the film's
 * source and the mounted preview, so what is saved is what is shown. The
 * caller passes the src the element should load; the source keeps the token.
 */
export function applyStockPatch(
  element: HTMLElement,
  patch: StockSlotPatch,
  src?: string,
): void {
  if (patch.pick) {
    element.setAttribute("src", src ?? `motify-asset://${patch.pick.assetId}`);
    element.dataset["stockId"] = String(patch.pick.credit.id);
    element.dataset["stockCreator"] = patch.pick.credit.creator;
    element.dataset["stockCreatorUrl"] = patch.pick.credit.creatorUrl;
    element.dataset["stockSource"] = patch.pick.credit.sourceUrl;
    if (element.tagName === "IMG" && !element.hasAttribute("alt"))
      element.setAttribute("alt", "");
  }
  if (patch.query !== undefined)
    element.dataset["stockQuery"] = patch.query.trim().slice(0, 100);
  const placement = patch.placement;
  if (placement) {
    if (placement.x !== undefined || placement.y !== undefined) {
      const [x, y] = pixels(element.style.translate);
      const nextX = round(placement.x ?? x);
      const nextY = round(placement.y ?? y);
      element.style.translate =
        nextX === 0 && nextY === 0 ? "" : `${nextX}px ${nextY}px`;
    }
    if (placement.scale !== undefined) {
      const scale = round(Math.min(5, Math.max(0.1, placement.scale)));
      element.style.scale = scale === 1 ? "" : String(scale);
    }
    if (placement.layer !== undefined)
      element.style.zIndex =
        placement.layer === null ? "" : String(Math.round(placement.layer));
    if (placement.fit !== undefined) element.style.objectFit = placement.fit;
  }
  const clip = patch.clip;
  if (clip && element.tagName === "VIDEO") {
    if (clip.start !== undefined)
      element.dataset["start"] = String(round(Math.max(0, clip.start)));
    if (clip.trim !== undefined)
      element.dataset["trim"] = String(round(Math.max(0, clip.trim)));
    if (clip.loop !== undefined) element.toggleAttribute("loop", clip.loop);
  }
  if (element.getAttribute("style") === "") element.removeAttribute("style");
}

/** The film's HTML with one slot changed; unchanged when there is no such slot. */
export function updateStockSlot(
  html: string,
  index: number,
  patch: StockSlotPatch,
): string {
  const tag = slotTags(html)[index];
  if (!tag) return html;
  applyStockPatch(tag.element, patch);
  return `${html.slice(0, tag.start)}${openingTag(tag.element)}${html.slice(tag.end)}`;
}

/**
 * The slot elements of a mounted film, in the same order as in its source:
 * inside a raw film's frame, or in the composition root itself.
 */
export function mountedStockElements(root: ParentNode): HTMLElement[] {
  const frame = root.querySelector<HTMLIFrameElement>(
    "iframe[data-motify-raw]",
  );
  const scope: ParentNode = frame?.contentDocument ?? root;
  return Array.from(
    scope.querySelectorAll<HTMLElement>("[data-motify-stock]"),
  ).filter((element) => isStockKind(element.dataset["motifyStock"]));
}

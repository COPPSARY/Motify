import { describe, expect, it } from "vitest";

import {
  applyStockPatch,
  mountedStockElements,
  parseStockSlots,
  updateStockSlot,
} from "./stock-slots";

const ASSET = "11111111-1111-4111-8111-111111111111";

const FILM = `<!doctype html>
<html><head><style>.hero { position: absolute; inset: 0; }</style></head>
<body>
  <div class="scene">
    <img class="hero" data-motify-stock="photo" data-stock-query="barista pouring latte art" alt="" style="position:absolute; left:0; top:0; width:100%; height:100%; object-fit:cover">
    <h1>Morning, made.</h1>
    <video data-motify-video data-motify-stock="video" data-stock-query="city traffic at night" data-start="3" data-trim="0" muted playsinline loop style="position:absolute; inset:0"></video>
    <img src="motify-asset://${ASSET}" alt="logo">
  </div>
  <script>
    const decoy = '<img data-motify-stock="photo" data-stock-query="not a slot">';
    window.DURATION = 8;
    window.seek = (t) => { document.querySelector('.hero').style.transform = 'scale(' + (1 + t / 40) + ')'; };
  </script>
</body></html>`;

describe("parseStockSlots", () => {
  it("finds the film's photo and video slots in order, ignoring scripts and plain media", () => {
    const slots = parseStockSlots(FILM);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      index: 0,
      kind: "photo",
      query: "barista pouring latte art",
      assetId: null,
      credit: null,
      clip: null,
      placement: { x: 0, y: 0, scale: 1, layer: null, fit: "cover" },
    });
    expect(slots[1]).toMatchObject({
      index: 1,
      kind: "video",
      query: "city traffic at night",
      clip: { start: 3, trim: 0, loop: true },
    });
  });

  it("returns nothing for a film without slots", () => {
    expect(parseStockSlots("<html><body><h1>Hi</h1></body></html>")).toEqual(
      [],
    );
  });
});

describe("updateStockSlot", () => {
  const credit = {
    id: 42,
    creator: "Ana",
    creatorUrl: "https://pixabay.com/users/Ana-7/",
    sourceUrl: "https://pixabay.com/photos/coffee-42/",
  };

  it("writes a pick into the slot and changes nothing else in the film", () => {
    const next = updateStockSlot(FILM, 0, {
      pick: { assetId: ASSET, credit },
    });
    const [slot] = parseStockSlots(next);
    expect(slot).toMatchObject({ assetId: ASSET, credit });

    const before = FILM.split(/<img class="hero"[^>]*>/);
    const after = next.split(/<img class="hero"[^>]*>/);
    expect(after).toEqual(before);
    expect(next).toContain(`src="motify-asset://${ASSET}"`);
  });

  it("places, scales, layers and refits a picture", () => {
    const next = updateStockSlot(FILM, 0, {
      placement: { x: 24, y: -10.456, scale: 1.25, layer: 3, fit: "contain" },
    });
    expect(parseStockSlots(next)[0]!.placement).toEqual({
      x: 24,
      y: -10.46,
      scale: 1.25,
      layer: 3,
      fit: "contain",
    });
    // The film's own transform animation is untouched.
    expect(next).toContain(".style.transform = 'scale('");
  });

  it("times, trims and loops a clip", () => {
    const next = updateStockSlot(FILM, 1, {
      clip: { start: 1.5, trim: 2.25, loop: false },
    });
    expect(parseStockSlots(next)[1]!.clip).toEqual({
      start: 1.5,
      trim: 2.25,
      loop: false,
    });
    expect(next).toContain("</video>");
  });

  it("clamps out-of-range values and drops neutral ones", () => {
    const moved = updateStockSlot(FILM, 0, {
      placement: { x: 5, scale: 40 },
    });
    expect(parseStockSlots(moved)[0]!.placement.scale).toBe(5);
    const reset = updateStockSlot(moved, 0, {
      placement: { x: 0, y: 0, scale: 1 },
    });
    expect(parseStockSlots(reset)[0]!.placement).toMatchObject({
      x: 0,
      y: 0,
      scale: 1,
    });
    expect(reset).not.toContain("translate");
  });

  it("leaves the film alone for a slot that does not exist", () => {
    expect(updateStockSlot(FILM, 7, { query: "x" })).toBe(FILM);
  });
});

describe("mountedStockElements", () => {
  it("finds the slots of a film mounted in the editor root", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<img data-motify-stock="photo"><video data-motify-stock="video"></video><img data-motify-stock="other">';
    const elements = mountedStockElements(root);
    expect(elements.map((element) => element.tagName)).toEqual([
      "IMG",
      "VIDEO",
    ]);
    applyStockPatch(elements[0]!, { placement: { layer: 2 } });
    expect(elements[0]!.style.zIndex).toBe("2");
  });
});

import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StockItem, StockSearchResult } from "../../api/stock";
import type { StockSlot } from "../../composition/stock-slots";
import StockGallery from "./StockGallery.svelte";

function item(id: number, overrides: Partial<StockItem> = {}): StockItem {
  return {
    provider: "pixabay",
    kind: "photo",
    id,
    thumbnailUrl: `https://cdn.pixabay.com/${id}_150.jpg`,
    previewUrl: `https://pixabay.com/get/${id}_640.jpg`,
    width: 1920,
    height: 1080,
    tags: ["coffee", "cup"],
    creator: { name: "Ana", profileUrl: "https://pixabay.com/users/Ana-7/" },
    sourceUrl: `https://pixabay.com/photos/coffee-${id}/`,
    ...overrides,
  };
}

function slot(overrides: Partial<StockSlot> = {}): StockSlot {
  return {
    index: 0,
    kind: "photo",
    query: "barista latte art",
    assetId: null,
    credit: null,
    placement: { x: 0, y: 0, scale: 1, layer: null, fit: "cover" },
    clip: null,
    ...overrides,
  };
}

function result(items: StockItem[], hasMore = false): StockSearchResult {
  return {
    items,
    page: 1,
    totalHits: items.length,
    hasMore,
    attribution: { name: "Pixabay", url: "https://pixabay.com/" },
  };
}

async function settle() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
    await tick();
  }
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  document.body.innerHTML = "";
});

function setup(
  slots: StockSlot[],
  search: ReturnType<typeof vi.fn>,
  options: { onPick?: ReturnType<typeof vi.fn> } = {},
) {
  const onPick = options.onPick ?? vi.fn().mockResolvedValue(undefined);
  const onAdjust = vi.fn();
  const target = document.createElement("div");
  document.body.append(target);
  const component = mount(StockGallery, {
    target,
    props: { slots, search, onPick, onAdjust, orientation: "horizontal" },
  });
  cleanup = () => unmount(component);
  return { target, onPick, onAdjust };
}

describe("StockGallery", () => {
  it("searches an empty slot with its own words and says what it is looking for", async () => {
    let resolve!: (value: StockSearchResult) => void;
    const search = vi.fn(
      () => new Promise<StockSearchResult>((done) => (resolve = done)),
    );
    const { target } = setup([slot()], search);
    await settle();

    expect(target.textContent).toContain("Finding matching photos…");
    expect(search).toHaveBeenCalledWith({
      kind: "photo",
      query: "barista latte art",
      page: 1,
      orientation: "horizontal",
    });

    resolve(result([item(1), item(2)]));
    await settle();
    expect(target.querySelectorAll(".stock-tile")).toHaveLength(2);
    expect(target.textContent).toContain("Photos and videos from");
    expect(
      target.querySelector('a[href="https://pixabay.com/"]'),
    ).not.toBeNull();
  });

  it("calls a video slot B-roll", async () => {
    const search = vi.fn(
      (_input: { orientation?: string }) =>
        new Promise<StockSearchResult>(() => undefined),
    );
    const { target } = setup(
      [slot({ kind: "video", clip: { start: 0, trim: 0, loop: true } })],
      search,
    );
    await settle();
    expect(target.textContent).toContain("Finding matching B-roll…");
    expect(search.mock.calls[0]![0]).not.toHaveProperty("orientation");
  });

  it("previews a result with its credit, then places it", async () => {
    const search = vi.fn().mockResolvedValue(result([item(7)]));
    const { target, onPick } = setup([slot()], search);
    await settle();

    (target.querySelector(".stock-tile") as HTMLButtonElement).click();
    flushSync();
    expect(
      target.querySelector(".stock-preview img")?.getAttribute("src"),
    ).toBe("https://pixabay.com/get/7_640.jpg");
    expect(
      target.querySelector('a[href="https://pixabay.com/photos/coffee-7/"]'),
    ).not.toBeNull();

    const use = Array.from(target.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Use this photo"),
    )!;
    use.click();
    await settle();
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ index: 0 }),
      expect.objectContaining({ id: 7 }),
    );
  });

  it("loads more options on request", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce(result([item(1)], true))
      .mockResolvedValueOnce({ ...result([item(2)]), page: 2 });
    const { target } = setup([slot()], search);
    await settle();

    const more = Array.from(target.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Show more options"),
    )!;
    more.click();
    await settle();
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
    expect(target.querySelectorAll(".stock-tile")).toHaveLength(2);
  });

  it("shows a search failure instead of retrying forever", async () => {
    const search = vi
      .fn()
      .mockRejectedValue(new Error("Stock search is busy right now."));
    const { target } = setup([slot()], search);
    await settle();
    expect(target.querySelector('[role="alert"]')?.textContent).toContain(
      "Stock search is busy right now.",
    );
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("keeps a placed pick closed, with its credit and placement controls", async () => {
    const search = vi.fn().mockResolvedValue(result([item(1)]));
    const placed = slot({
      assetId: "11111111-1111-4111-8111-111111111111",
      credit: {
        id: 9,
        creator: "Ana",
        creatorUrl: "https://pixabay.com/users/Ana-7/",
        sourceUrl: "https://pixabay.com/photos/coffee-9/",
      },
      kind: "video",
      clip: { start: 2, trim: 0, loop: false },
    });
    const { target, onAdjust } = setup([placed], search);
    await settle();

    expect(search).not.toHaveBeenCalled();
    expect(target.textContent).toContain("Video by");
    expect(target.textContent).toContain("1/1 chosen");

    const adjust = Array.from(target.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Adjust"),
    )!;
    adjust.click();
    flushSync();

    const forward = target.querySelector(
      'button[aria-label="Bring forward"]',
    ) as HTMLButtonElement;
    forward.click();
    expect(onAdjust).toHaveBeenLastCalledWith(placed, {
      placement: { layer: 1 },
    });

    const trim = Array.from(target.querySelectorAll("label"))
      .find((label) => label.textContent?.includes("Trim"))!
      .querySelector("input")!;
    trim.value = "1.5";
    trim.dispatchEvent(new Event("change"));
    expect(onAdjust).toHaveBeenLastCalledWith(placed, { clip: { trim: 1.5 } });

    const findAlternatives = Array.from(target.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Find alternatives"),
    )!;
    findAlternatives.click();
    await settle();
    expect(search).toHaveBeenCalledTimes(1);
  });
});

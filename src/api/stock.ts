import { fetchApi } from "./client";

export type StockKind = "photo" | "video";
export type StockOrientation = "horizontal" | "vertical" | "all";

/** A Pixabay result as the backend sends it: preview URLs only, never a download link. */
export interface StockItem {
  provider: "pixabay";
  kind: StockKind;
  id: number;
  thumbnailUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  durationSeconds?: number;
  tags: string[];
  creator: { name: string; profileUrl: string };
  sourceUrl: string;
}

export interface StockSearchResult {
  items: StockItem[];
  page: number;
  totalHits: number;
  hasMore: boolean;
  attribution: { name: string; url: string };
}

export interface ImportedStock {
  asset: { id: string; token: string; contentType: string };
  attribution: {
    provider: "pixabay";
    creator: { name: string; profileUrl: string };
    sourceUrl: string;
  };
}

/** Searches stock media through the backend, which holds the Pixabay key and caches for a day. */
export async function searchStock(
  input: {
    kind: StockKind;
    query: string;
    page?: number;
    orientation?: StockOrientation;
  },
  signal?: AbortSignal,
): Promise<StockSearchResult> {
  const params = new URLSearchParams({
    kind: input.kind,
    q: input.query.trim().slice(0, 100),
    page: String(input.page ?? 1),
  });
  if (input.orientation) params.set("orientation", input.orientation);
  const response = await fetchApi(`/v1/stock/search?${params}`, {
    ...(signal ? { signal } : {}),
  });
  return ((await response.json()) as { data: StockSearchResult }).data;
}

/** Downloads a pick into the project's workspace and attaches it, returning its asset token. */
export async function importStock(
  projectId: string,
  kind: StockKind,
  id: number,
): Promise<ImportedStock> {
  const response = await fetchApi(
    `/v1/projects/${encodeURIComponent(projectId)}/stock`,
    { method: "POST", body: JSON.stringify({ kind, id }) },
  );
  return ((await response.json()) as { data: ImportedStock }).data;
}

/** The photo orientation that suits a canvas, so a portrait film is offered portrait photos. */
export function orientationFor(
  width: number,
  height: number,
): StockOrientation {
  if (width > height * 1.1) return "horizontal";
  if (height > width * 1.1) return "vertical";
  return "all";
}

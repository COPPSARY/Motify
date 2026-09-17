export type AppMode = "local" | "cloud";

export function readAppMode(document: Document): AppMode {
  return document
    .querySelector('meta[name="motify-mode"]')
    ?.getAttribute("content") === "local"
    ? "local"
    : "cloud";
}

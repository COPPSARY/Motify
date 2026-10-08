/** The path of the Brand DNA page. */
export const BRAND_ROUTE = "/brand";

export function isBrandRoute(pathname: string): boolean {
  return /^\/brand\/?$/.test(pathname);
}

/**
 * Pages of the cloud editor that have their own URL. The create page is "/"
 * and an open video is `/p/:id`; these are the rest.
 */
export const HOME_PAGES = [
  "videos",
  "templates",
  "music",
  "assets",
  "storyboard",
  "settings",
  "support",
] as const;

export type HomePageRoute = (typeof HOME_PAGES)[number];

export function homePagePath(page: HomePageRoute | null): string {
  return page ? `/${page}` : "/";
}

/**
 * The page a path names: null for the create page, undefined for a path that
 * is not a home page at all (an open video, the Brand DNA page).
 */
export function homePageFromPath(
  pathname: string,
): HomePageRoute | null | undefined {
  const name = /^\/([a-z]*)\/?$/.exec(pathname)?.[1];
  if (name === undefined) return undefined;
  if (name === "") return null;
  return (HOME_PAGES as readonly string[]).includes(name)
    ? (name as HomePageRoute)
    : undefined;
}

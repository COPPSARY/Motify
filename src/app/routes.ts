/** The path of the Brand DNA page. */
export const BRAND_ROUTE = "/brand";

/** The Prompt Templates page, where a new account goes after Brand DNA. */
export const PROMPTS_ROUTE = "/templates";

export function isBrandRoute(pathname: string): boolean {
  return /^\/brand\/?$/.test(pathname);
}

/**
 * Pages of the cloud editor that have their own URL. The create page is "/"
 * and an open video is `/p/:id`; these are the rest.
 */
export const HOME_PAGES = [
  "videos",
  "films",
  "templates",
  "music",
  "assets",
  "storyboard",
  "settings",
  "billing",
  "support",
] as const;

export type HomePageRoute = (typeof HOME_PAGES)[number];

/** Old paths that still open their page: Prompt Templates lived at /prompts. */
const HOME_PAGE_ALIASES: Readonly<Record<string, HomePageRoute>> = {
  prompts: "templates",
};

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
  if (Object.hasOwn(HOME_PAGE_ALIASES, name)) return HOME_PAGE_ALIASES[name];
  return (HOME_PAGES as readonly string[]).includes(name)
    ? (name as HomePageRoute)
    : undefined;
}

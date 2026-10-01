/** The path of the Brand DNA page. */
export const BRAND_ROUTE = "/brand";

export function isBrandRoute(pathname: string): boolean {
  return /^\/brand\/?$/.test(pathname);
}

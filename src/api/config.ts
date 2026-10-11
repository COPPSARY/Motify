const configuredApiUrl = (
  import.meta.env["VITE_MOTIFY_API_URL"] as string | undefined
)?.trim();

// A deployment can also serve the API through its own origin.
export const MOTIFY_API_URL = configuredApiUrl
  ? configuredApiUrl.replace(/\/+$/, "")
  : typeof window !== "undefined"
    ? window.location.origin
    : "";

const configuredSiteUrl = (
  import.meta.env["VITE_MOTIFY_SITE_URL"] as string | undefined
)?.trim();

/** The marketing site, which hosts plans and checkout. */
export const MOTIFY_SITE_URL = (
  configuredSiteUrl || "https://motify.video"
).replace(/\/+$/, "");

export const PRICING_URL = `${MOTIFY_SITE_URL}/pricing`;

/** Resolve admin-authored site paths away from the editor subdomain. */
export function motifySiteHref(href: string): string {
  const value = href.trim();
  if (/^https:\/\//i.test(value)) return value;
  return `${MOTIFY_SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

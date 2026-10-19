const configuredApiUrl = (
  import.meta.env["VITE_MOTIFY_API_URL"] as string | undefined
)?.trim();

export function resolveMotifyApiUrl(
  configured: string | undefined,
  browserUrl: URL | undefined,
  development: boolean,
): string {
  if (configured?.trim()) return configured.trim().replace(/\/+$/, "");

  // Vite serves the editor on 5173, while the local auth API runs on 3000.
  // Without VITE_MOTIFY_API_URL, posting credentials to Vite returns the SPA.
  if (
    development &&
    browserUrl?.hostname === "localhost" &&
    browserUrl.port === "5173"
  ) {
    return "http://localhost:3000";
  }

  // A deployed editor may serve the API through its own origin.
  return browserUrl?.origin ?? "";
}

export const MOTIFY_API_URL = resolveMotifyApiUrl(
  configuredApiUrl,
  typeof window === "undefined" ? undefined : new URL(window.location.href),
  import.meta.env.DEV,
);

const configuredSiteUrl = (
  import.meta.env["VITE_MOTIFY_SITE_URL"] as string | undefined
)?.trim();

/** The marketing site, which hosts plans and checkout. */
export const MOTIFY_SITE_URL = (
  configuredSiteUrl || "https://motify.video"
).replace(/\/+$/, "");

export const PRICING_URL = `${MOTIFY_SITE_URL}/pricing`;
export const TEMPLATES_URL = `${MOTIFY_SITE_URL}/templates`;
export const TERMS_URL = `${MOTIFY_SITE_URL}/terms`;
export const PRIVACY_URL = `${MOTIFY_SITE_URL}/privacy`;

/** Resolve admin-authored site paths away from the editor subdomain. */
export function motifySiteHref(href: string): string {
  const value = href.trim();
  if (/^https:\/\//i.test(value)) return value;
  return `${MOTIFY_SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

const configuredApiUrl = (
  import.meta.env["VITE_MOTIFY_API_URL"] as string | undefined
)?.trim();

// A deployment can also serve the API through its own origin.
export const MOTIFY_API_URL = configuredApiUrl
  ? configuredApiUrl.replace(/\/+$/, "")
  : typeof window !== "undefined"
    ? window.location.origin
    : "";

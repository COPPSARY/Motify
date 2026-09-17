import { currentCsrfToken } from "../auth";
import { MOTIFY_API_URL } from "./config";

export const API_URL = MOTIFY_API_URL;

interface ApiErrorEnvelope {
  error?: { message?: string };
}

export async function fetchApi(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${API_URL}${path}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const csrfToken = currentCsrfToken();
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as ApiErrorEnvelope;
    throw new Error(payload.error?.message || `API error: ${response.status}`);
  }

  return response;
}

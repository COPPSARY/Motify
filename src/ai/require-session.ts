/**
 * Server-side account gate for generation.
 *
 * The editor asks for a sign-in before it sends a prompt, but that check lives
 * in the browser and a request can be replayed without it. Every generation
 * spends provider budget, so the endpoints verify the caller's Motify session
 * against the API before calling a model.
 *
 * A deployment with no `MOTIFY_API_URL` has no session service to ask — the
 * self-hosted local editor running on its own key — and is left ungated.
 */
export class UnauthenticatedGenerationError extends Error {
  readonly status = 401;

  constructor(message = "Sign in to Motify to generate.") {
    super(message);
    this.name = "UnauthenticatedGenerationError";
  }
}

type EnvSource = Record<string, string | undefined>;

export function motifySessionApiUrl(env: EnvSource): string {
  const configured = (
    env["MOTIFY_API_URL"] ??
    env["VITE_MOTIFY_API_URL"] ??
    ""
  ).trim();
  return configured.replace(/\/+$/, "");
}

export async function requireMotifySession(
  cookieHeader: string | undefined,
  env: EnvSource,
): Promise<void> {
  const apiUrl = motifySessionApiUrl(env);
  if (!apiUrl) return;
  if (!cookieHeader) throw new UnauthenticatedGenerationError();

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/v1/auth/me`, {
      headers: { Accept: "application/json", Cookie: cookieHeader },
    });
  } catch {
    throw new UnauthenticatedGenerationError(
      "Motify could not verify your session. Try signing in again.",
    );
  }
  if (!response.ok) throw new UnauthenticatedGenerationError();
}

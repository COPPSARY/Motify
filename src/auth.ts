import { MOTIFY_API_URL } from "./api/config";

export interface MotionlyUser {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

interface AuthResponse {
  readonly data: { readonly user: MotionlyUser; readonly csrfToken: string };
}

interface SignUpResponse {
  readonly data: {
    readonly verificationRequired: boolean;
    readonly user?: MotionlyUser;
    readonly csrfToken?: string;
    /** True when this sign-up created the account; onboarding follows. */
    readonly newAccount?: boolean;
  };
}

interface AuthErrorEnvelope {
  readonly error?: { readonly code?: string; readonly message?: string };
}

/** A failed credential call, carrying the backend's own code so callers can
 * react to `ACCOUNT_ALREADY_EXISTS` or `EMAIL_NOT_VERIFIED` by name. */
export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

let csrfToken = "";

export function currentCsrfToken(): string {
  return csrfToken;
}

async function authFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`${MOTIFY_API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as AuthErrorEnvelope;
    throw new AuthError(
      response.status,
      payload.error?.code ?? "AUTH_REQUEST_FAILED",
      payload.error?.message ?? `Authentication failed (${response.status}).`,
    );
  }
  return response;
}

export async function currentMotionlyUser(): Promise<MotionlyUser | null> {
  try {
    const response = await fetch(`${MOTIFY_API_URL}/v1/auth/me`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const session = ((await response.json()) as AuthResponse).data;
    csrfToken = session.csrfToken;
    return session.user;
  } catch {
    return null;
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<MotionlyUser> {
  const response = await authFetch("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const session = ((await response.json()) as AuthResponse).data;
  csrfToken = session.csrfToken;
  return session.user;
}

export async function resendSignupOtp(email: string): Promise<void> {
  await authFetch("/v1/auth/otp/send", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<{ user: MotionlyUser; newAccount: boolean }> {
  const response = await authFetch("/v1/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      token,
      referralCode: currentReferralCode(),
    }),
  });
  const session = ((await response.json()) as SignUpResponse).data;
  if (!session.user || !session.csrfToken)
    throw new Error("OTP verification did not return a session.");
  csrfToken = session.csrfToken;
  return { user: session.user, newAccount: session.newAccount === true };
}

/** Returns the signed-in user when email confirmation is disabled; null while a verification mail is pending. */
export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<{ user: MotionlyUser; newAccount: boolean } | null> {
  const response = await authFetch("/v1/auth/sign-up", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      returnTo: returnToUrl(),
      referralCode: currentReferralCode(),
    }),
  });
  const {
    verificationRequired,
    user,
    csrfToken: sessionCsrfToken,
    newAccount,
  } = ((await response.json()) as SignUpResponse).data;
  if (verificationRequired) return null;
  if (!user || !sessionCsrfToken)
    throw new Error("Sign-up did not return a session.");
  csrfToken = sessionCsrfToken;
  return { user, newAccount: newAccount === true };
}

export async function signOut(): Promise<void> {
  try {
    await authFetch("/v1/auth/logout", { method: "POST" });
  } finally {
    csrfToken = "";
  }
}

/**
 * Where the API should send the browser once the round trip finishes. Without
 * it a login started in the editor lands on the marketing site, stranding the
 * prompt the user came here to run.
 */
function returnToUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const url = new URL(window.location.href);
  url.searchParams.delete("prompt");
  return url.toString();
}

export function motionlyLoginUrl(): string {
  const url = new URL(
    "/v1/auth/google",
    MOTIFY_API_URL || window.location.origin,
  );
  const returnTo = returnToUrl();
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  const referralCode = currentReferralCode();
  if (referralCode) url.searchParams.set("referralCode", referralCode);
  return url.toString();
}

/** Cello also persists this value; reading URL/cookie synchronously keeps OAuth links ordinary anchors. */
export function currentReferralCode(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const fromUrl = new URL(window.location.href).searchParams.get("ucc")?.trim();
  const fromCookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("cello-referral="))
    ?.slice("cello-referral=".length);
  let cookieValue = "";
  try {
    cookieValue = fromCookie ? decodeURIComponent(fromCookie) : "";
  } catch {
    // Ignore a malformed third-party cookie rather than breaking authentication.
  }
  const value = fromUrl || cookieValue;
  return value && value.length <= 255 ? value : undefined;
}

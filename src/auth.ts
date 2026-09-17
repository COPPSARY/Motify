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

let csrfToken = "";

export function currentCsrfToken(): string {
  return csrfToken;
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

export function motionlyLoginUrl(): string {
  return `${MOTIFY_API_URL}/v1/auth/google`;
}

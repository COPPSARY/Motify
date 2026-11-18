import { MAX_FILM_SECONDS, requestedFilmSeconds } from "../ai/film-length";

/**
 * The longest film a free account can make, in seconds: the server's
 * `FREE_MAX_FILM_SECONDS` (film-limits.ts in the backend), which it also sends
 * as the subscription's `maxFilmSeconds` entitlement. Used only while that
 * entitlement has not arrived, as on an older API node or before sign-in.
 */
export const FREE_MAX_SECONDS = 10;

/**
 * The longest film this person can make, or null for no limit. A local
 * project runs on the browser's own key, so the plan does not apply. Before a
 * signed-in person's plan is read the limit is unknown, and nothing is locked
 * that a subscriber would then see unlock.
 */
export function filmLimit(state: {
  cloud: boolean;
  signedIn: boolean;
  planRead: boolean;
  /** The server's entitlement: a number, null for none, undefined when not sent. */
  entitled: number | null | undefined;
  paid: boolean;
}): number | null {
  if (!state.cloud) return null;
  if (!state.signedIn) return FREE_MAX_SECONDS;
  if (!state.planRead) return null;
  if (state.entitled !== undefined) return state.entitled;
  return state.paid ? null : FREE_MAX_SECONDS;
}

/** What a locked length says on hover, and under the Length field. */
export function lengthLimitTip(maxSeconds: number): string {
  return `Free plan videos are up to ${maxSeconds} seconds. Upgrade for longer videos.`;
}

/**
 * A note for a prompt that asks for a longer video than will be made: past
 * the plan's length, or past the three minutes Motify's AI makes for anyone.
 * Null when the prompt names no length, or one that fits.
 */
export function lengthWarning(
  prompt: string,
  maxSeconds: number | null,
): string | null {
  const asked = requestedFilmSeconds(prompt);
  if (asked === undefined) return null;
  const cap = Math.min(maxSeconds ?? MAX_FILM_SECONDS, MAX_FILM_SECONDS);
  if (asked <= cap) return null;
  if (cap < MAX_FILM_SECONDS) {
    return `Free plan videos are up to ${cap} seconds, so this one will be ${cap} seconds. Upgrade for longer videos.`;
  }
  return `Our AI makes videos up to ${MAX_FILM_SECONDS / 60} minutes maximum, so this one will be ${MAX_FILM_SECONDS / 60} minutes.`;
}

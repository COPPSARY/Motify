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

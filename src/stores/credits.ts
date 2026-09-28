import { readonly, writable } from "svelte/store";

import { fetchCreditBalance } from "../api/credits";

export type CreditStatus = "idle" | "loading" | "ready" | "error";

const balance = writable<number | null>(null);
const status = writable<CreditStatus>("idle");
const charge = writable<number | null>(null);

/**
 * The signed-in user's balance as the server last reported it, or null until
 * it has. Readonly on purpose: it changes only when the server says so, either
 * because `refreshCredits` asked it or because a response carried the new
 * balance. The UI never computes it and no component sets it.
 */
export const creditBalance = readonly(balance);
export const creditStatus = readonly(status);
/** What the latest request cost, in credits, for the confirmation shown after it. */
export const lastCreditCharge = readonly(charge);

let request = 0;

/** Asks the server for the balance. A newer call, or a sign-out, supersedes an older one. */
export async function refreshCredits(): Promise<void> {
  const current = ++request;
  status.set("loading");
  try {
    const next = await fetchCreditBalance();
    if (current !== request) return;
    balance.set(next);
    status.set("ready");
  } catch {
    if (current !== request) return;
    // Keep the last known balance: a failed refresh is not a reason to say 0.
    status.set("error");
  }
}

/**
 * Takes the balance a generation response reported, so the pill is right the
 * moment the answer arrives. Any refresh still in flight is older than this
 * response and is dropped.
 */
export function applyServerCharge(credits: {
  charged: number;
  remaining: number;
}): void {
  const valid = (value: number) => Number.isFinite(value) && value >= 0;
  if (!valid(credits.charged) || !valid(credits.remaining)) return;
  request += 1;
  balance.set(credits.remaining);
  status.set("ready");
  charge.set(credits.charged);
}

/** Forgets the last request's cost, before the next one starts. */
export function clearLastCharge(): void {
  charge.set(null);
}

/** Forgets the balance, so the next account never briefly sees the last one's. */
export function resetCredits(): void {
  request += 1;
  balance.set(null);
  status.set("idle");
  charge.set(null);
}

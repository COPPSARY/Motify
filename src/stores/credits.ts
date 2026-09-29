import { readonly, writable } from "svelte/store";

import { fetchCreditBalance } from "../api/credits";

export type CreditStatus = "idle" | "loading" | "ready" | "error";

const balance = writable<number | null>(null);
const status = writable<CreditStatus>("idle");

/**
 * The signed-in user's balance as the server last reported it, or null until
 * it has. Readonly on purpose: the only way it changes is `refreshCredits`
 * asking the server, never a value the UI computes or a component sets.
 */
export const creditBalance = readonly(balance);
export const creditStatus = readonly(status);

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

/** Forgets the balance, so the next account never briefly sees the last one's. */
export function resetCredits(): void {
  request += 1;
  balance.set(null);
  status.set("idle");
}

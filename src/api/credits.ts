import { fetchApi } from "./client";

export type CreditEntryKind =
  "SIGNUP_GRANT" | "RESERVE" | "SETTLE" | "REFUND" | "ADJUSTMENT";

export interface CreditEntry {
  id: string;
  kind: CreditEntryKind;
  /** Credits, signed: a spend is negative. */
  amount: number;
  description: string;
  createdAt: string;
}

export interface CreditHistoryPage {
  entries: CreditEntry[];
  nextCursor: string | null;
}

/**
 * Credits are read-only from the browser. The server owns every balance change
 * and there is no endpoint to set one, so this module only ever asks what the
 * balance is. Nothing here, or anywhere in the editor, can grant or spend.
 */

function isCredits(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function fetchCreditBalance(): Promise<number> {
  const response = await fetchApi("/v1/credits");
  const { data } = (await response.json()) as {
    data?: { balance?: unknown };
  };
  const balance = data?.balance;
  if (!isCredits(balance) || balance < 0) {
    throw new Error("The credits response was not understood.");
  }
  return balance;
}

export async function fetchCreditHistory(
  cursor?: string,
): Promise<CreditHistoryPage> {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  const response = await fetchApi(`/v1/credits/history?${query}`);
  const { data } = (await response.json()) as {
    data?: { entries?: unknown; nextCursor?: unknown };
  };
  if (!data || !Array.isArray(data.entries)) {
    throw new Error("The credit history response was not understood.");
  }
  const entries = (data.entries as CreditEntry[]).filter(
    (entry) =>
      typeof entry?.id === "string" &&
      isCredits(entry.amount) &&
      typeof entry.description === "string" &&
      typeof entry.createdAt === "string",
  );
  return {
    entries,
    nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
  };
}

/** The chat message for a request the server refused because the account could not pay. */
export function insufficientCreditsMessage(
  details: Record<string, unknown> | undefined,
): string {
  const balance = details?.["balance"];
  return isCredits(balance)
    ? `You don't have enough credits for this request. You have ${formatCredits(balance)} left.`
    : "You don't have enough credits for this request.";
}

/**
 * Shows a balance the way a person counts: whole credits, or one decimal when
 * a generation left a fraction. It rounds down so the screen never promises
 * more than the account holds.
 */
export function formatCredits(credits: number): string {
  const floored = Math.floor(Math.max(0, credits) * 10 + 1e-6) / 10;
  return Number.isInteger(floored)
    ? floored.toLocaleString("en-US")
    : floored.toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
}

/** A signed entry amount, always showing its direction: `+50`, `-3.4`. */
export function formatCreditChange(amount: number): string {
  const magnitude = formatCredits(Math.abs(amount));
  return amount < 0 ? `-${magnitude}` : `+${magnitude}`;
}

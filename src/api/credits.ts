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
 * What a request is expected to cost, ahead of sending it. Fixed for the
 * deployment, not a prediction for this particular message: `typical` is
 * what an average generation costs, `min` is the fewest credits a request
 * needs to be accepted at all, and `max` is the most any single request can
 * ever cost. The real charge is only known once the request finishes.
 */
export interface CreditEstimate {
  typical: number;
  min: number;
  max: number;
}

export interface CreditSnapshot {
  balance: number;
  /** Absent when the deployment is not charging for requests. */
  estimate: CreditEstimate | null;
}

/**
 * Credits are read-only from the browser. The server owns every balance change
 * and there is no endpoint to set one, so this module only ever asks what the
 * balance is. Nothing here, or anywhere in the editor, can grant or spend.
 */

function isCredits(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCreditEstimate(value: unknown): value is CreditEstimate {
  const estimate = value as Partial<CreditEstimate> | null | undefined;
  return (
    typeof estimate === "object" &&
    estimate !== null &&
    isCredits(estimate.typical) &&
    isCredits(estimate.min) &&
    isCredits(estimate.max)
  );
}

export async function fetchCreditSnapshot(): Promise<CreditSnapshot> {
  const response = await fetchApi("/v1/credits");
  const { data } = (await response.json()) as {
    data?: { balance?: unknown; estimate?: unknown };
  };
  const balance = data?.balance;
  if (!isCredits(balance) || balance < 0) {
    throw new Error("The credits response was not understood.");
  }
  return {
    balance,
    estimate: isCreditEstimate(data?.estimate) ? data.estimate : null,
  };
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

/**
 * A short instruction — the length `typical` already assumes a message
 * costs around. Scaling is relative to it, so a message near this length
 * keeps the server's average, and a much longer or shorter one moves the
 * shown number up or down as it's typed.
 */
const TYPICAL_MESSAGE_CHARS = 60;
/** How far the length of a message alone is allowed to move the estimate. */
const MIN_LENGTH_SCALE = 0.5;
const MAX_LENGTH_SCALE = 2.5;

/**
 * A rough, live guide to what a message might cost, scaled off its length
 * around the server's own average. This is not a prediction: the real cost
 * is only known once the model answers, because a short edit and a long
 * brief can return films of similar size. It exists so the composer's hint
 * visibly responds to what is typed, clamped to what the deployment would
 * actually accept (`min`) or ever charge (`max`) for one request.
 */
export function estimateMessageCredits(
  estimate: CreditEstimate,
  messageLength: number,
): number {
  const scale = Math.min(
    MAX_LENGTH_SCALE,
    Math.max(MIN_LENGTH_SCALE, messageLength / TYPICAL_MESSAGE_CHARS),
  );
  return Math.min(
    estimate.max,
    Math.max(estimate.min, estimate.typical * scale),
  );
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

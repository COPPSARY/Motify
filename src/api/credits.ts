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
 * What the server prices messages from: `typical` is what this user's recent
 * requests cost on average at today's prices (the price of a message of
 * `TYPICAL_MESSAGE_CHARS`), `min` is the fewest credits a request needs to
 * be accepted at all, and `max` is the most any single request can ever cost.
 * See `estimateMessageCredits` for the price of a given message.
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
 * The message length `typical` is the price of. Scaling is relative to it,
 * so a message near this length costs the server's average, and a much
 * longer or shorter one moves the price up or down as it's typed.
 */
const TYPICAL_MESSAGE_CHARS = 60;
/** How far the length of a message alone moves its price. */
const MIN_LENGTH_SCALE = 0.5;
const MAX_LENGTH_SCALE = 2.5;
/** Prices are whole tenths of a credit, worked in the server's hundredths. */
const CREDIT_UNITS = 100;
const QUOTE_STEP_UNITS = 10;

/**
 * What a message will be charged: the server's typical cost scaled by the
 * message's trimmed length, rounded to a tenth of a credit, and kept within
 * what one request can cost. The server prices with this same formula
 * (`quoteMessageUnits` in the backend's credit-pricing.ts), in the same whole
 * hundredths, and charges it: the editor sends this number with the message,
 * and a request whose number is out of date is refused rather than charged.
 */
export function estimateMessageCredits(
  estimate: CreditEstimate,
  messageLength: number,
): number {
  const scale = Math.min(
    MAX_LENGTH_SCALE,
    Math.max(MIN_LENGTH_SCALE, messageLength / TYPICAL_MESSAGE_CHARS),
  );
  const typicalUnits = Math.round(estimate.typical * CREDIT_UNITS);
  const quote =
    Math.round((typicalUnits * scale) / QUOTE_STEP_UNITS) * QUOTE_STEP_UNITS;
  const units = Math.min(
    Math.round(estimate.max * CREDIT_UNITS),
    Math.max(Math.round(estimate.min * CREDIT_UNITS), quote),
  );
  return units / CREDIT_UNITS;
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

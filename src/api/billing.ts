import { fetchApi } from "./client";

/** One paid Bakong payment in the account's billing history. */
export interface BillingHistoryEntry {
  paymentId: string;
  paidAt: string;
  kind: "PLAN" | "CREDIT_PACK";
  description: string;
  amount: number;
  currency: string;
  receiptNumber: string;
  mode: "live" | "sandbox";
}

export interface ReceiptLineItem {
  description: string;
  /** The plan period this line pays for; null for a credit pack. */
  period: { start: string; end: string } | null;
  details: string[];
  quantity: number;
  unitPrice: number;
  amount: number;
}

/** A paid payment's receipt, as the server issues it (and prints it in the PDF). */
export interface PaymentReceipt {
  paymentId: string;
  mode: "live" | "sandbox";
  kind: "PLAN" | "CREDIT_PACK";
  invoiceNumber: string;
  receiptNumber: string;
  paidAt: string;
  currency: string;
  billTo: { name: string; email: string };
  paymentMethod: {
    type: string;
    account: string | null;
    transactionHash: string | null;
  };
  lineItems: ReceiptLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
}

/** Who issues receipts; the server's PDF prints the same block. */
export const RECEIPT_SELLER = {
  name: "Motify",
  handle: "@motify",
  addressLines: ["Phnom Penh 120101", "Cambodia"],
  email: "billing@motify.video",
} as const;

export interface BillingHistoryPage {
  entries: BillingHistoryEntry[];
  /** Pass back to load the next (older) page; null on the last page. */
  nextCursor: string | null;
}

/** The account's paid payments, newest first, a page at a time. */
export async function fetchBillingHistory(
  cursor?: string,
): Promise<BillingHistoryPage> {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("before", cursor);
  const response = await fetchApi(`/v1/payments?${query}`);
  const { data } = (await response.json()) as {
    data?: { entries?: unknown; nextCursor?: unknown };
  };
  if (!data || !Array.isArray(data.entries)) {
    throw new Error("The billing history response was not understood.");
  }
  const entries = (data.entries as BillingHistoryEntry[]).filter(
    (entry) =>
      typeof entry?.paymentId === "string" &&
      typeof entry.paidAt === "string" &&
      typeof entry.description === "string" &&
      typeof entry.amount === "number" &&
      typeof entry.currency === "string",
  );
  return {
    entries,
    nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
  };
}

export async function fetchReceipt(paymentId: string): Promise<PaymentReceipt> {
  const response = await fetchApi(
    `/v1/payments/${encodeURIComponent(paymentId)}/receipt`,
  );
  const { data } = (await response.json()) as { data?: PaymentReceipt };
  if (
    !data ||
    typeof data.receiptNumber !== "string" ||
    !Array.isArray(data.lineItems)
  ) {
    throw new Error("The receipt response was not understood.");
  }
  return data;
}

/** Saves the server-rendered receipt PDF as `Receipt-<number>.pdf`. */
export async function downloadReceiptPdf(
  receipt: PaymentReceipt,
): Promise<void> {
  const response = await fetchApi(
    `/v1/payments/${encodeURIComponent(receipt.paymentId)}/receipt.pdf`,
  );
  const url = URL.createObjectURL(await response.blob());
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `Receipt-${receipt.receiptNumber}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser a moment to start the download before the blob goes away.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

// Bakong payments settle in Cambodia, so receipts show the same dates wherever they are opened.
const RECEIPT_TIME_ZONE = "Asia/Phnom_Penh";

export function formatReceiptMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}

/** "October 15, 2026" */
export function formatReceiptDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: RECEIPT_TIME_ZONE,
  }).format(new Date(value));
}

/** "Oct 15, 2026" */
export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: RECEIPT_TIME_ZONE,
  }).format(new Date(value));
}

/** The lines under a line item: its period ("Oct 15 – Nov 14, 2026"), then credits and other details. */
export function receiptLineDetails(item: ReceiptLineItem): string[] {
  if (!item.period) return item.details;
  const range = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: RECEIPT_TIME_ZONE,
  })
    .formatRange(new Date(item.period.start), new Date(item.period.end))
    // Intl's thin spaces around the dash, as plain ones like the PDF.
    .replace(/[\u2009\u202f\u00a0]/g, " ");
  return [range, ...item.details];
}

/** "Bakong KHQR - se•••@aclb" */
export function receiptPaymentMethod(receipt: PaymentReceipt): string {
  const { type, account } = receipt.paymentMethod;
  return account ? `${type} - ${account}` : type;
}

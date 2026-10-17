import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downloadReceiptPdf,
  fetchBillingHistory,
  fetchReceipt,
  receiptLineDetails,
  receiptPaymentMethod,
  type PaymentReceipt,
} from "./billing";

function respond(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const receipt: PaymentReceipt = {
  paymentId: "payment-1",
  mode: "live",
  kind: "PLAN",
  invoiceNumber: "MTF-7Q2KX9P4LM",
  receiptNumber: "8A1F-9C03-BE7D",
  paidAt: "2026-10-15T08:00:00.000Z",
  currency: "USD",
  billTo: { name: "Prom Sereyreaksa", email: "buyer@example.com" },
  paymentMethod: {
    type: "Bakong KHQR",
    account: "se•••@aclb",
    transactionHash: "hash-1",
  },
  lineItems: [
    {
      description: "Motify Pro · Monthly",
      period: {
        start: "2026-10-15T08:00:00.000Z",
        end: "2026-11-14T08:00:00.000Z",
      },
      details: ["300 credits"],
      quantity: 1,
      unitPrice: 20,
      amount: 20,
    },
  ],
  subtotal: 20,
  discount: 0,
  total: 20,
  amountPaid: 20,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("billing API", () => {
  it("reads the billing history from /v1/payments with the session cookie", async () => {
    const fetchMock = respond({
      data: {
        nextCursor: "2026-10-15T08:00:00.000Z",
        entries: [
          {
            paymentId: "payment-1",
            paidAt: "2026-10-15T08:00:00.000Z",
            kind: "PLAN",
            description: "Motify Pro · Monthly",
            amount: 20,
            currency: "USD",
            receiptNumber: "8A1F-9C03-BE7D",
            mode: "live",
          },
          { paymentId: 7 },
        ],
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const history = await fetchBillingHistory();

    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]?.description).toBe("Motify Pro · Monthly");
    expect(history.nextCursor).toBe("2026-10-15T08:00:00.000Z");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/payments\?limit=20$/);
    expect(init.credentials).toBe("include");
  });

  it("asks for the next page with the cursor", async () => {
    const fetchMock = respond({ data: { entries: [], nextCursor: null } });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchBillingHistory("2026-10-15T08:00:00.000Z"),
    ).resolves.toEqual({ entries: [], nextCursor: null });
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain(
      "before=2026-10-15T08%3A00%3A00.000Z",
    );
  });

  it("rejects a billing history it does not understand", async () => {
    vi.stubGlobal("fetch", respond({ data: [] }));
    await expect(fetchBillingHistory()).rejects.toThrow("not understood");
  });

  it("reads one receipt", async () => {
    const fetchMock = respond({ data: receipt });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchReceipt("payment-1")).resolves.toEqual(receipt);
    expect((fetchMock.mock.calls[0] as [string])[0]).toMatch(
      /\/v1\/payments\/payment-1\/receipt$/,
    );
  });

  it("keeps the server's status when a receipt is not the user's", async () => {
    vi.stubGlobal(
      "fetch",
      respond(
        { error: { code: "PAYMENT_NOT_FOUND", message: "Payment not found." } },
        404,
      ),
    );
    await expect(fetchReceipt("payment-2")).rejects.toMatchObject({
      status: 404,
      code: "PAYMENT_NOT_FOUND",
    });
  });

  it("downloads the server's PDF under the receipt number", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(new Blob(["%PDF-1.3"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:receipt"),
        revokeObjectURL: vi.fn(),
      }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("Receipt-8A1F-9C03-BE7D.pdf");
        expect(this.href).toBe("blob:receipt");
      });

    await downloadReceiptPdf(receipt);

    expect((fetchMock.mock.calls[0] as [string])[0]).toMatch(
      /\/v1\/payments\/payment-1\/receipt\.pdf$/,
    );
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});

describe("receipt formatting", () => {
  it("shows a plan's period before its details", () => {
    expect(receiptLineDetails(receipt.lineItems[0]!)).toEqual([
      "Oct 15 – Nov 14, 2026",
      "300 credits",
    ]);
  });

  it("names the payment method with the masked Bakong account", () => {
    expect(receiptPaymentMethod(receipt)).toBe("Bakong KHQR - se•••@aclb");
    expect(
      receiptPaymentMethod({
        ...receipt,
        paymentMethod: { ...receipt.paymentMethod, account: null },
      }),
    ).toBe("Bakong KHQR");
  });
});

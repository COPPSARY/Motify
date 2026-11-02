<script lang="ts">
  import { onMount, tick } from "svelte";
  import { Download, X } from "lucide-svelte";
  import { ApiRequestError } from "../../api/client";
  import {
    RECEIPT_SELLER,
    downloadReceiptPdf,
    fetchReceipt,
    formatReceiptDate,
    formatReceiptMoney,
    receiptDiscounts,
    receiptLineDetails,
    receiptPaymentMethod,
    type PaymentReceipt,
  } from "../../api/billing";

  export let paymentId: string;
  export let onClose: () => void;

  let dialog: HTMLDivElement;
  let receipt: PaymentReceipt | null = null;
  let state: "loading" | "ready" | "not-found" | "not-paid" | "error" =
    "loading";
  let downloading = false;
  let downloadError = "";

  $: money = (amount: number) =>
    formatReceiptMoney(amount, receipt?.currency ?? "USD");
  $: paidOn = receipt ? formatReceiptDate(receipt.paidAt) : "";

  onMount(() => {
    void tick().then(() => dialog?.focus());
    void load();
  });

  async function load(): Promise<void> {
    state = "loading";
    try {
      receipt = await fetchReceipt(paymentId);
      state = "ready";
    } catch (error) {
      const status = error instanceof ApiRequestError ? error.status : 0;
      state =
        status === 404 || status === 400
          ? "not-found"
          : status === 409
            ? "not-paid"
            : "error";
    }
  }

  async function download(): Promise<void> {
    if (!receipt || downloading) return;
    downloading = true;
    downloadError = "";
    try {
      await downloadReceiptPdf(receipt);
    } catch {
      downloadError = "The PDF could not be downloaded. Please try again.";
    } finally {
      downloading = false;
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") onClose();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="receipt-overlay" role="presentation" on:click|self={onClose}>
  <div
    class="receipt-dialog"
    role="dialog"
    aria-modal="true"
    aria-label="Receipt"
    tabindex="-1"
    bind:this={dialog}
  >
    <header class="receipt-dialog__bar">
      <button
        type="button"
        class="receipt-dialog__download"
        disabled={!receipt || downloading}
        on:click={() => void download()}
        ><Download size={15} />
        {downloading ? "Preparing PDF…" : "Download PDF"}</button
      >
      <button
        type="button"
        class="receipt-dialog__close"
        aria-label="Close receipt"
        on:click={onClose}><X size={16} /></button
      >
    </header>
    {#if downloadError}<p class="receipt-dialog__error" role="alert">
        {downloadError}
      </p>{/if}

    {#if state === "loading"}
      <p class="receipt-dialog__status">Loading receipt…</p>
    {:else if state === "not-found"}
      <p class="receipt-dialog__status">
        This receipt was not found. Receipts are only visible to the account
        that paid.
      </p>
    {:else if state === "not-paid"}
      <p class="receipt-dialog__status">
        This payment is not confirmed yet. Its receipt appears once Bakong
        confirms it.
      </p>
    {:else if state === "error"}
      <p class="receipt-dialog__status">
        The receipt could not be loaded.
        <button type="button" on:click={() => void load()}>Try again</button>
      </p>
    {:else if receipt}
      <article class="receipt-sheet">
        <div class="receipt-sheet__top">
          <div>
            <h2 class="receipt-sheet__title">
              Receipt
              {#if receipt.mode === "sandbox"}<span
                  class="receipt-sheet__sandbox">Sandbox · no money moved</span
                >{/if}
            </h2>
            <dl class="receipt-sheet__meta">
              <div>
                <dt>Invoice number</dt>
                <dd>{receipt.invoiceNumber}</dd>
              </div>
              <div>
                <dt>Receipt number</dt>
                <dd>{receipt.receiptNumber}</dd>
              </div>
              <div>
                <dt>Date paid</dt>
                <dd>{paidOn}</dd>
              </div>
            </dl>
          </div>
          <svg
            class="receipt-sheet__logo"
            viewBox="24 24 72 72"
            width="34"
            height="34"
            aria-label="Motify"
            role="img"
          >
            <path d="M24 24L58 58H24Z" /><path d="M96 24V58H62Z" /><path
              d="M24 62H58V96H24Z"
            /><path d="M62 62H96V96A34 34 0 0 1 62 62Z" />
          </svg>
        </div>

        <div class="receipt-sheet__parties">
          <address>
            <span
              ><strong>{RECEIPT_SELLER.name}</strong>
              <span class="receipt-sheet__muted">{RECEIPT_SELLER.handle}</span
              ></span
            >
            {#each RECEIPT_SELLER.addressLines as line}<span>{line}</span
              >{/each}
            <span>{RECEIPT_SELLER.email}</span>
          </address>
          <address>
            <strong>Bill to</strong>
            <span>{receipt.billTo.name}</span>
            <span>{receipt.billTo.email}</span>
          </address>
        </div>

        <h3 class="receipt-sheet__headline">
          {money(receipt.amountPaid)} paid on {paidOn}
        </h3>

        <table class="receipt-sheet__table">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" class="num optional">Qty</th>
              <th scope="col" class="num optional">Unit price</th>
              <th scope="col" class="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each receipt.lineItems as item}
              <tr>
                <td>
                  {item.description}
                  {#each receiptLineDetails(item) as line}<span
                      class="receipt-sheet__detail">{line}</span
                    >{/each}
                </td>
                <td class="num optional">{item.quantity}</td>
                <td class="num optional">{money(item.unitPrice)}</td>
                <td class="num">{money(item.amount)}</td>
              </tr>
            {/each}
          </tbody>
        </table>

        <dl class="receipt-sheet__totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{money(receipt.subtotal)}</dd>
          </div>
          {#each receiptDiscounts(receipt) as row (row.label)}<div>
              <dt>{row.label}</dt>
              <dd>-{money(row.amount)}</dd>
            </div>{/each}
          <div>
            <dt>Total</dt>
            <dd>{money(receipt.total)}</dd>
          </div>
          <div class="paid">
            <dt>Amount paid</dt>
            <dd>{money(receipt.amountPaid)}</dd>
          </div>
        </dl>

        <h3 class="receipt-sheet__section">Payment history</h3>
        <table class="receipt-sheet__table">
          <thead>
            <tr>
              <th scope="col">Payment method</th>
              <th scope="col" class="optional">Date</th>
              <th scope="col" class="num">Amount paid</th>
              <th scope="col" class="num">Receipt number</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{receiptPaymentMethod(receipt)}</td>
              <td class="optional">{paidOn}</td>
              <td class="num">{money(receipt.amountPaid)}</td>
              <td class="num">{receipt.receiptNumber}</td>
            </tr>
          </tbody>
        </table>
        {#if receipt.paymentMethod.transactionHash}
          <p class="receipt-sheet__hash">
            Bakong transaction hash: {receipt.paymentMethod.transactionHash}
          </p>
        {/if}
      </article>
    {/if}
  </div>
</div>

<script lang="ts">
  import { onMount } from "svelte";
  import { Download, RefreshCcw } from "lucide-svelte";
  import {
    downloadReceiptPdf,
    fetchBillingHistory,
    fetchReceipt,
    formatReceiptMoney,
    formatShortDate,
    type BillingHistoryEntry,
  } from "../../api/billing";

  /** Opens a payment's receipt. */
  export let onOpenReceipt: (paymentId: string) => void;

  let entries: BillingHistoryEntry[] = [];
  let nextCursor: string | null = null;
  let state: "loading" | "ready" | "error" = "loading";
  let loadingMore = false;
  let moreError = false;
  let downloading: string | null = null;

  async function load(): Promise<void> {
    state = "loading";
    try {
      const page = await fetchBillingHistory();
      entries = page.entries;
      nextCursor = page.nextCursor;
      state = "ready";
    } catch {
      state = "error";
    }
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) return;
    loadingMore = true;
    moreError = false;
    try {
      const page = await fetchBillingHistory(nextCursor);
      entries = [...entries, ...page.entries];
      nextCursor = page.nextCursor;
    } catch {
      moreError = true;
    } finally {
      loadingMore = false;
    }
  }

  async function download(entry: BillingHistoryEntry): Promise<void> {
    if (downloading) return;
    downloading = entry.paymentId;
    try {
      await downloadReceiptPdf(await fetchReceipt(entry.paymentId));
    } catch {
      // The receipt view has its own download and error message.
      onOpenReceipt(entry.paymentId);
    } finally {
      downloading = null;
    }
  }

  onMount(() => void load());
</script>

{#if state === "loading"}
  <p class="me-invoices-empty">Loading invoices…</p>
{:else if state === "error"}
  <p class="me-invoices-empty">
    Invoices are unavailable.
    <button type="button" class="me-settings-link" on:click={() => void load()}
      ><RefreshCcw size={13} /> Try again</button
    >
  </p>
{:else if entries.length === 0}
  <p class="me-invoices-empty">
    No payments yet. Receipts for plans and credit packs you buy appear here.
  </p>
{:else}
  <table class="me-invoices">
    <thead>
      <tr>
        <th scope="col">Date</th>
        <th scope="col">Description</th>
        <th scope="col" class="me-invoices__num">Amount</th>
        <th scope="col" class="me-invoices__status">Status</th>
        <th scope="col"><span class="sr-only">Receipt</span></th>
      </tr>
    </thead>
    <tbody>
      {#each entries as entry (entry.paymentId)}
        <tr>
          <td class="me-invoices__date">{formatShortDate(entry.paidAt)}</td>
          <td>
            <button
              type="button"
              class="me-invoices__open"
              on:click={() => onOpenReceipt(entry.paymentId)}
              >{entry.description}</button
            >
            <span class="me-invoices__number">#{entry.receiptNumber}</span>
          </td>
          <td class="me-invoices__num"
            >{formatReceiptMoney(entry.amount, entry.currency)}</td
          >
          <td class="me-invoices__status">
            <span class="me-invoices__paid">Paid</span>
            {#if entry.mode === "sandbox"}<span class="me-invoices__sandbox"
                >Sandbox</span
              >{/if}
          </td>
          <td class="me-invoices__actions">
            <button
              type="button"
              class="me-invoices__download"
              aria-label={`Download receipt PDF for ${entry.description}, ${formatShortDate(entry.paidAt)}`}
              title="Download PDF"
              disabled={downloading === entry.paymentId}
              on:click={() => void download(entry)}
              ><Download size={15} /></button
            >
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if nextCursor}
    <div class="me-invoices-more">
      <button
        type="button"
        class="me-invoices-more__button"
        disabled={loadingMore}
        on:click={() => void loadMore()}
        >{loadingMore ? "Loading…" : "Load more"}</button
      >
      {#if moreError}<span>Couldn’t load more. Try again.</span>{/if}
    </div>
  {/if}
{/if}

<script lang="ts">
  import { ArrowUpRight, BadgePercent, Check, Copy, X } from "lucide-svelte";
  import { PRICING_URL } from "../../api/config";

  /** Called when the person heads to pricing to redeem, for analytics. */
  export let onRedeem: (() => void) | null = null;

  const DISCOUNT_CODE = "MOTIFY50";

  let dialog: HTMLDialogElement;
  let view: "offer" | "confirm" = "offer";
  let copied = false;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  function openDialog(): void {
    view = "offer";
    copied = false;
    dialog.showModal();
  }

  async function copyCode(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(DISCOUNT_CODE);
      return true;
    } catch {
      return false;
    }
  }

  async function copyFromButton(): Promise<void> {
    if (!(await copyCode())) return;
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 2200);
  }

  /** Leaving the offer asks once; leaving the confirmation closes for real. */
  function requestClose(): void {
    if (view === "offer") view = "confirm";
    else dialog.close();
  }

  function onCancel(event: Event): void {
    if (view !== "offer") return;
    event.preventDefault();
    view = "confirm";
  }

  function closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) requestClose();
  }

  function redeem(): void {
    void copyCode();
    onRedeem?.();
    dialog.close();
  }
</script>

<button
  type="button"
  class="me-referral-button me-referral-button--compact me-discount-button"
  aria-label="Get 50% off with code {DISCOUNT_CODE}"
  on:click={openDialog}
>
  <BadgePercent size={15} aria-hidden="true" />
  <span>Get 50% off</span>
  <small>Limited</small>
</button>

<dialog
  bind:this={dialog}
  class="me-referral-dialog me-discount"
  aria-labelledby="discount-title"
  aria-describedby="discount-description"
  on:click={closeOnBackdrop}
  on:cancel={onCancel}
  on:close={() => (view = "offer")}
>
  <div class="me-referral-dialog__panel me-discount__panel">
    <button
      type="button"
      class="me-referral-dialog__close me-discount__close"
      aria-label="Close"
      on:click={requestClose}
    >
      <X size={18} />
    </button>

    {#if view === "offer"}
      <span class="me-discount__eyebrow">Limited-time offer</span>
      <h2 id="discount-title">Get 50% off your plan</h2>
      <p id="discount-description" class="me-discount__lede">
        Use this code at checkout and upgrade for half the price.
      </p>

      <div class="me-discount__code">
        <strong>{DISCOUNT_CODE}</strong>
        <button
          type="button"
          class="me-discount__copy"
          class:is-copied={copied}
          aria-label={copied ? "Code copied" : "Copy code"}
          title={copied ? "Copied" : "Copy code"}
          on:click={copyFromButton}
        >
          {#if copied}<Check size={16} />{:else}<Copy size={16} />{/if}
        </button>
      </div>
      <p class="me-discount__copied" aria-live="polite">
        {copied ? "Copied to your clipboard" : ""}
      </p>

      <div class="me-discount__where">
        <p class="me-discount__where-title">Where to use it</p>
        <p class="me-discount__where-hint">
          Pick a plan, then paste the code into <b>Promo code</b> at checkout.
        </p>
        <div class="me-discount__checkout" aria-hidden="true">
          <span class="me-discount__checkout-label">Promo code</span>
          <span class="me-discount__checkout-row">
            <span class="me-discount__checkout-input"
              >{DISCOUNT_CODE}<i class="me-discount__caret"></i></span
            >
            <span class="me-discount__checkout-apply">Apply</span>
          </span>
        </div>
      </div>

      <a
        class="me-discount__redeem"
        href={PRICING_URL}
        target="_blank"
        rel="noopener"
        on:click={redeem}
      >
        Redeem it <ArrowUpRight size={15} aria-hidden="true" />
      </a>
    {:else}
      <span class="me-discount__icon" aria-hidden="true"
        ><BadgePercent size={22} /></span
      >
      <h2 id="discount-title">Leave 50% on the table?</h2>
      <p id="discount-description" class="me-discount__lede">
        {DISCOUNT_CODE} is only around for a limited time. Once it’s gone, it’s
        full price.
      </p>
      <button
        type="button"
        class="me-discount__redeem"
        on:click={() => (view = "offer")}
      >
        Keep my 50% off
      </button>
      <button
        type="button"
        class="me-discount__decline"
        on:click={() => dialog.close()}
      >
        No thanks, I’ll pay full price
      </button>
    {/if}
  </div>
</dialog>

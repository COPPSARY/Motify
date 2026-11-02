<script lang="ts">
  import { ArrowRight, Sparkles, X } from "lucide-svelte";
  import { PRICING_URL } from "../../api/config";
  import {
    dismissOutOfCredits,
    outOfCreditsPrompt,
  } from "../../stores/credits";

  /** Called when the person heads to pricing, for analytics. */
  export let onUpgrade: (() => void) | null = null;

  let dialog: HTMLDialogElement;

  $: if (dialog) {
    if ($outOfCreditsPrompt && !dialog.open) dialog.showModal();
    else if (!$outOfCreditsPrompt && dialog.open) dialog.close();
  }

  function closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) dialog.close();
  }

  function upgrade(): void {
    onUpgrade?.();
    dialog.close();
  }
</script>

<dialog
  bind:this={dialog}
  class="me-referral-dialog me-out-of-credits"
  aria-labelledby="out-of-credits-title"
  aria-describedby="out-of-credits-description"
  on:click={closeOnBackdrop}
  on:close={dismissOutOfCredits}
>
  <div class="me-referral-dialog__panel me-out-of-credits__panel">
    <button
      type="button"
      class="me-referral-dialog__close me-out-of-credits__close"
      aria-label="Close"
      on:click={() => dialog.close()}
    >
      <X size={18} />
    </button>
    <span class="me-out-of-credits__icon" aria-hidden="true"
      ><Sparkles size={22} /></span
    >
    <h2 id="out-of-credits-title">Oh no, you’re out of credits!</h2>
    <p id="out-of-credits-description">
      Upgrade to keep making more amazing work.
    </p>
    <p class="me-out-of-credits__promo">
      Use code <strong>MOTIFY50</strong> at checkout for 50% off.
    </p>
    <a
      class="me-out-of-credits__upgrade"
      href={PRICING_URL}
      target="_blank"
      rel="noopener"
      on:click={upgrade}
    >
      Upgrade <ArrowRight size={15} aria-hidden="true" />
    </a>
  </div>
</dialog>

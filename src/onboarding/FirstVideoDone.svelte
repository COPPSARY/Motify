<script lang="ts">
  import { ArrowRight, PartyPopper, X } from "lucide-svelte";
  import { PRICING_URL } from "../api/config";
  import type { BillingPlanOffer } from "../api/billing-plans";
  import { videosPerMonth } from "./first-video";

  /** The plans on sale; empty when they could not be loaded, which skips the offer. */
  export let plans: readonly BillingPlanOffer[] = [];
  /** Whether the one-time plan offer follows the celebration. */
  export let offerDue = false;
  /** What a video like the one they just made costs, in credits. */
  export let creditsPerVideo = 0;
  /** Called when the offer is first shown, so it is recorded and never shown again. */
  export let onOfferShown: () => void = () => undefined;
  /** Called when they head to pricing, with the plan they picked. */
  export let onUpgrade: (planId: string) => void = () => undefined;
  /** Opens Brand DNA ("make it yours"). */
  export let onBrand: () => void = () => undefined;
  /** Closes the whole thing. */
  export let onClose: () => void;

  let stage: "celebrate" | "offer" = "celebrate";
  $: showOffer = offerDue && plans.length > 0;

  function carryOn() {
    if (showOffer) {
      stage = "offer";
      onOfferShown();
    } else onClose();
  }

  function makeItYours() {
    onClose();
    onBrand();
  }

  function pick(plan: BillingPlanOffer) {
    onUpgrade(plan.id);
    window.open(PRICING_URL, "_blank", "noopener");
    onClose();
  }

  const CONFETTI = Array.from({ length: 18 }, (_, index) => index);
</script>

<div class="fvd" role="dialog" aria-modal="true" aria-labelledby="fvd-title">
  <div class="fvd__card">
    <button
      type="button"
      class="fvd__close"
      aria-label="Close"
      on:click={onClose}
    >
      <X size={18} />
    </button>

    {#if stage === "celebrate"}
      <div class="fvd__confetti" aria-hidden="true">
        {#each CONFETTI as index (index)}
          <i style={`--i: ${index}`}></i>
        {/each}
      </div>
      <span class="fvd__icon" aria-hidden="true"><PartyPopper size={26} /></span
      >
      <h2 id="fvd-title">Your first video is ready!</h2>
      <p>
        Nice work. It&rsquo;s open in the editor, where you can ask Tiffy to
        change anything.
      </p>
      <div class="fvd__actions">
        <button type="button" class="fvd__primary" on:click={carryOn}>
          Keep going <ArrowRight size={15} aria-hidden="true" />
        </button>
        <button type="button" class="fvd__ghost" on:click={makeItYours}>
          Make it yours with your brand
        </button>
      </div>
    {:else}
      <h2 id="fvd-title">Make more like this</h2>
      <p>
        Your welcome credits cover a few videos. A plan gives you more every
        month.
      </p>
      <ul class="fvd__plans">
        {#each plans as plan (plan.id)}
          {@const count = videosPerMonth(plan.credits, creditsPerVideo)}
          <li>
            <div>
              <strong>{plan.name}</strong>
              <span>
                {plan.credits} credits a month{count > 0
                  ? `, about ${count} videos like this`
                  : ""}
              </span>
            </div>
            <button type="button" class="fvd__plan" on:click={() => pick(plan)}>
              ${plan.price}/mo
            </button>
          </li>
        {/each}
      </ul>
      <p class="fvd__note">Paid plans also go ahead of the free queue.</p>
      <button type="button" class="fvd__ghost" on:click={onClose}
        >Maybe later</button
      >
    {/if}
  </div>
</div>

<style>
  .fvd {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.6);
  }
  .fvd__card {
    position: relative;
    width: min(440px, 100%);
    overflow: hidden;
    padding: 28px 24px 22px;
    border: 1px solid var(--sl-border-strong, #2a2a33);
    border-radius: 16px;
    background: var(--sl-panel, #14141a);
    color: var(--sl-text, #f4f4f6);
    text-align: center;
  }
  .fvd__close {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 6px;
    border: 0;
    background: transparent;
    color: var(--sl-muted, #9a9aa6);
    cursor: pointer;
  }
  .fvd__icon {
    display: inline-grid;
    place-items: center;
    width: 52px;
    height: 52px;
    margin-bottom: 10px;
    border-radius: 50%;
    background: color-mix(
      in srgb,
      var(--sl-brand-cobalt, #4f6bff) 20%,
      transparent
    );
    color: var(--sl-brand-cobalt, #4f6bff);
  }
  h2 {
    margin: 0 0 6px;
    font-size: 21px;
    font-weight: 600;
  }
  p {
    margin: 0 0 18px;
    color: var(--sl-muted, #9a9aa6);
    font-size: 14px;
  }
  .fvd__actions {
    display: grid;
    gap: 8px;
  }
  .fvd__primary,
  .fvd__plan {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    padding: 0 18px;
    border: 0;
    border-radius: 9px;
    background: var(--sl-brand-cobalt, #4f6bff);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .fvd__primary:hover,
  .fvd__plan:hover {
    background: var(--sl-brand-cobalt-hover, #3f58e6);
  }
  .fvd__ghost {
    min-height: 40px;
    border: 0;
    background: transparent;
    color: var(--sl-muted, #9a9aa6);
    font-size: 13.5px;
    cursor: pointer;
  }
  .fvd__plans {
    display: grid;
    gap: 10px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
    text-align: left;
  }
  .fvd__plans li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--sl-border-strong, #2a2a33);
    border-radius: 12px;
  }
  .fvd__plans strong {
    display: block;
    font-size: 15px;
  }
  .fvd__plans span {
    color: var(--sl-muted, #9a9aa6);
    font-size: 12.5px;
  }
  .fvd__note {
    margin: 0 0 8px;
    font-size: 12.5px;
  }
  .fvd__confetti {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .fvd__confetti i {
    position: absolute;
    top: -10px;
    left: calc(var(--i) * 5.6%);
    width: 7px;
    height: 12px;
    border-radius: 2px;
    background: hsl(calc(var(--i) * 41), 85%, 60%);
    animation: fvd-fall 2.4s ease-in calc(var(--i) * 0.07s) both;
  }
  @keyframes fvd-fall {
    to {
      transform: translateY(320px) rotate(540deg);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fvd__confetti {
      display: none;
    }
  }
  .fvd__primary:focus-visible,
  .fvd__plan:focus-visible,
  .fvd__ghost:focus-visible,
  .fvd__close:focus-visible {
    outline: 2px solid var(--sl-accent-hover, #8fa0ff);
    outline-offset: 2px;
  }
</style>

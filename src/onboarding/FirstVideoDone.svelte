<script lang="ts">
  import { onMount } from "svelte";
  import { Check, X } from "lucide-svelte";
  import { PRICING_URL } from "../api/config";
  import type { BillingPlanOffer } from "../api/billing-plans";
  import type {
    OnboardingMonthlyVideos,
    OnboardingRating,
  } from "../api/onboarding";
  import {
    REVISION_IDEAS,
    TYPICAL_VIDEO_CREDITS,
    VOLUME_CHOICES,
    recommendPlan,
    videosPerMonth,
  } from "./first-video";

  /** The plans on sale; empty when they could not be loaded, which skips the offer. */
  export let plans: readonly BillingPlanOffer[] = [];
  /** Whether the one-time plan offer comes at the end. */
  export let offerDue = false;
  /** What a video like the one they just made costs, in credits. */
  export let creditsPerVideo = 0;
  /** How many videos a month they said they would make, which decides the plan we recommend. */
  export let monthlyVideos: OnboardingMonthlyVideos | undefined = undefined;
  /** Where to begin: the review of a fresh video, or straight to the offer after they revised it. */
  export let startAt: "review" | "offer" = "review";
  /** Called with their answer to "do you like it?". */
  export let onRate: (rating: OnboardingRating) => void = () => undefined;
  /** Called with a change they picked to try; the dialog closes and the offer follows once it is done. */
  export let onRevise: (idea: string) => void = () => undefined;
  /** Called when the offer is first shown, so it is recorded and never shown again. */
  export let onOfferShown: () => void = () => undefined;
  /** Called when they head to pricing, with the plan they picked. */
  export let onUpgrade: (planId: string) => void = () => undefined;
  /** Closes the whole thing. */
  export let onClose: () => void;

  let stage: "review" | "revise" | "offer" = "review";
  let rating: OnboardingRating | null = null;

  $: showOffer = offerDue && plans.length > 0;
  $: perVideo = creditsPerVideo > 0 ? creditsPerVideo : TYPICAL_VIDEO_CREDITS;
  $: recommended = recommendPlan(plans, monthlyVideos, perVideo);
  $: ordered = recommended
    ? [recommended, ...plans.filter((plan) => plan.id !== recommended.id)]
    : [...plans];
  $: said = VOLUME_CHOICES.find((choice) => choice.id === monthlyVideos);

  onMount(() => {
    if (startAt === "offer") toOffer();
  });

  function rate(value: OnboardingRating) {
    rating = value;
    onRate(value);
    stage = "revise";
  }

  /** The offer is the last step: with none due, they are done. */
  function toOffer() {
    if (showOffer) {
      stage = "offer";
      onOfferShown();
    } else onClose();
  }

  function pick(plan: BillingPlanOffer) {
    onUpgrade(plan.id);
    window.open(PRICING_URL, "_blank", "noopener");
    onClose();
  }

  // Fixed, spread-out values so the burst looks scattered and is the same every time.
  const CONFETTI = Array.from({ length: 28 }, (_, index) => ({
    left: (index * 37 + 11) % 100,
    delay: ((index * 53) % 45) / 100,
    duration: 1.7 + ((index * 29) % 12) / 10,
    drift: ((index * 61) % 70) - 35,
    spin: 360 + ((index * 47) % 400),
  }));
</script>

<div class="fvd" role="dialog" aria-modal="true" aria-labelledby="fvd-title">
  <div class="fvd__card">
    <button
      type="button"
      class="fvd__close"
      aria-label="Close"
      on:click={onClose}
    >
      <X size={16} />
    </button>

    {#if stage === "review"}
      <div class="fvd__confetti" aria-hidden="true">
        {#each CONFETTI as piece, index (index)}
          <i
            style={`--x: ${piece.left}%; --delay: ${piece.delay}s; --dur: ${piece.duration}s; --drift: ${piece.drift}px; --spin: ${piece.spin}deg`}
          ></i>
        {/each}
      </div>
      <span class="fvd__badge" aria-hidden="true"><Check size={22} /></span>
      <h2 id="fvd-title">Your first video is ready</h2>
      <p>Do you like it?</p>
      <div class="fvd__pair">
        <button
          type="button"
          class="fvd__primary"
          on:click={() => rate("liked")}
        >
          Love it
        </button>
        <button
          type="button"
          class="fvd__secondary"
          on:click={() => rate("not-quite")}
        >
          Not quite
        </button>
      </div>
    {:else if stage === "revise"}
      <h2 id="fvd-title">
        {rating === "liked"
          ? "Nice. You can still change anything."
          : "No problem. You can change anything."}
      </h2>
      <p>Just tell Tiffy what to change, in plain words. Try one:</p>
      <div class="fvd__ideas">
        {#each REVISION_IDEAS as idea (idea)}
          <button
            type="button"
            class="fvd__idea"
            on:click={() => onRevise(idea)}
          >
            {idea}
          </button>
        {/each}
      </div>
      <button type="button" class="fvd__ghost" on:click={toOffer}
        >Skip for now</button
      >
    {:else}
      <h2 id="fvd-title">Make more like this</h2>
      <p>
        {#if recommended && said}
          You said {said.detail.toLowerCase()} a month, so {recommended.name} fits
          you best.
        {:else}
          Your welcome credits cover a few videos. A plan gives you more every
          month.
        {/if}
      </p>
      <ul class="fvd__plans">
        {#each ordered as plan (plan.id)}
          {@const count = videosPerMonth(plan.credits, perVideo)}
          <li class:is-best={recommended?.id === plan.id}>
            <div>
              <strong>
                {plan.name}
                {#if recommended?.id === plan.id}
                  <em class="fvd__best">Best for you</em>
                {/if}
              </strong>
              <span>
                {plan.credits} credits a month{count > 0
                  ? ` · about ${count} videos`
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
    width: min(420px, 100%);
    overflow: hidden;
    box-sizing: border-box;
    padding: 28px 24px 20px;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.11));
    border-radius: 12px;
    background: var(--sl-panel, #111);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
    color: var(--sl-text, #ededed);
    text-align: center;
  }
  .fvd__close {
    position: absolute;
    top: 10px;
    right: 10px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--sl-muted, #858585);
    cursor: pointer;
  }
  .fvd__close:hover {
    color: var(--sl-text, #ededed);
  }
  .fvd__badge {
    display: inline-grid;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-bottom: 12px;
    border-radius: 50%;
    background: var(--sl-brand-signal-soft, rgba(124, 247, 197, 0.1));
    color: var(--sl-brand-signal, #7cf7c5);
  }
  h2 {
    margin: 0 0 6px;
    font-size: 19px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.02em;
  }
  p {
    margin: 0 0 18px;
    color: var(--sl-text-soft, #b4b4b4);
    font-size: 13.5px;
    line-height: 1.5;
  }
  .fvd__pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .fvd__primary,
  .fvd__secondary,
  .fvd__plan {
    min-height: 40px;
    padding: 0 16px;
    border-radius: 8px;
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .fvd__primary,
  .fvd__plan {
    border: 0;
    background: var(--sl-brand-cobalt, #1f45b0);
    color: #fff;
  }
  .fvd__primary:hover,
  .fvd__plan:hover {
    background: var(--sl-brand-cobalt-hover, #2752c9);
  }
  .fvd__secondary {
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.11));
    background: var(--sl-surface, #1a1a1a);
    color: var(--sl-text, #ededed);
  }
  .fvd__secondary:hover {
    background: var(--sl-surface-hover, #222);
  }
  .fvd__ideas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }
  .fvd__idea {
    min-height: 38px;
    padding: 0 10px;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.11));
    border-radius: 8px;
    background: var(--sl-surface, #1a1a1a);
    color: var(--sl-text, #ededed);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .fvd__idea:hover {
    background: var(--sl-surface-hover, #222);
  }
  .fvd__ghost {
    min-height: 36px;
    border: 0;
    background: transparent;
    color: var(--sl-muted, #858585);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .fvd__ghost:hover {
    color: var(--sl-text, #ededed);
  }
  .fvd__plans {
    display: grid;
    gap: 8px;
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
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.11));
    border-radius: 10px;
  }
  .fvd__plans li.is-best {
    border-color: var(--sl-brand-cobalt, #1f45b0);
    background: var(--sl-surface, #1a1a1a);
  }
  .fvd__plans strong {
    display: block;
    font-size: 14.5px;
    font-weight: 600;
  }
  .fvd__plans span {
    color: var(--sl-muted, #858585);
    font-size: 12.5px;
  }
  .fvd__best {
    margin-left: 6px;
    padding: 2px 7px;
    border-radius: 6px;
    background: var(--sl-accent-soft, rgba(199, 199, 204, 0.12));
    color: var(--sl-text, #ededed);
    font-size: 11px;
    font-style: normal;
    font-weight: 500;
    vertical-align: middle;
  }
  .fvd__note {
    margin: 0 0 6px;
    font-size: 12.5px;
  }
  /* A short burst in the brand colors: a reward, not a decoration. */
  .fvd__confetti {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .fvd__confetti i {
    position: absolute;
    top: -10px;
    left: var(--x);
    width: 6px;
    height: 11px;
    border-radius: 2px;
    background: var(--sl-brand-cobalt, #1f45b0);
    animation: fvd-fall var(--dur) ease-in var(--delay) both;
  }
  .fvd__confetti i:nth-child(4n + 2) {
    background: var(--sl-brand-cobalt-hover, #2752c9);
  }
  .fvd__confetti i:nth-child(4n + 3) {
    background: var(--sl-brand-signal, #7cf7c5);
  }
  .fvd__confetti i:nth-child(4n) {
    background: var(--sl-accent, #c7c7cc);
  }
  @keyframes fvd-fall {
    to {
      transform: translate(var(--drift), 300px) rotate(var(--spin));
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fvd__confetti {
      display: none;
    }
  }
  .fvd__primary:focus-visible,
  .fvd__secondary:focus-visible,
  .fvd__idea:focus-visible,
  .fvd__plan:focus-visible,
  .fvd__ghost:focus-visible,
  .fvd__close:focus-visible {
    outline: 2px solid var(--sl-accent-hover, #dedee2);
    outline-offset: 2px;
  }
</style>

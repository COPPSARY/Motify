<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { ArrowUpRight, X } from "lucide-svelte";
  import type { PromotionBanner as Banner } from "../cloud/projects-api";
  import { countdown, promotionSale } from "../cloud/promotion-sale";
  import { mountGlobe } from "./auth/globe";

  export let banner: Banner;
  export let href: string | null = null;
  export let onDismiss: () => void;

  $: sale = promotionSale(banner);
  $: clock = countdown(new Date(banner.endsAt).getTime());

  let canvas: HTMLCanvasElement;
  let stopGlobe: (() => void) | undefined;

  onMount(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stopGlobe = mountGlobe(canvas, {
      still,
      placement: "horizon",
      tint: "cobalt",
    });
  });
  onDestroy(() => stopGlobe?.());
</script>

<aside
  class="promotion-banner"
  data-promotion-banner={banner.id}
  aria-label="Promotion"
>
  <canvas bind:this={canvas} class="promotion-globe" aria-hidden="true"
  ></canvas>
  <span class="promotion-dots" aria-hidden="true"></span>

  <button
    class="promotion-close"
    type="button"
    aria-label="Dismiss promotion"
    on:click={onDismiss}
  >
    <X size={14} />
  </button>

  <div class="promotion-body">
    <div class="promotion-lead">
      <span class="promotion-eyebrow">{banner.title}</span>
      {#if sale}
        <strong class="promotion-percent">{sale.percent}<small>%</small></strong
        >
      {:else}
        <strong class="promotion-title">{banner.message}</strong>
      {/if}
    </div>
    <div class="promotion-side">
      <span class="promotion-clock" aria-label="Time left">
        {#if $clock.days !== "00"}<span><b>{$clock.days}</b><i>d</i></span>{/if}
        <span><b>{$clock.hours}</b><i>h</i></span>
        <span><b>{$clock.minutes}</b><i>m</i></span>
        <span><b>{$clock.seconds}</b><i>s</i></span>
      </span>
      {#if href}
        <a
          class="promotion-cta"
          {href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
        >
          {#if sale}Claim {sale.percent}% off{:else}{banner.ctaLabel ??
              "See offer"}{/if}
          <ArrowUpRight size={13} />
        </a>
      {/if}
    </div>
  </div>
</aside>

<style>
  .promotion-banner {
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 180;
    box-sizing: border-box;
    width: min(380px, calc(100vw - 32px));
    height: 128px;
    overflow: hidden;
    isolation: isolate;
    border: 1px solid rgba(39, 88, 230, 0.4);
    border-radius: 14px;
    background:
      radial-gradient(
        70% 60% at 50% 0%,
        rgba(31, 69, 176, 0.18),
        transparent 70%
      ),
      #07080a;
    box-shadow:
      0 0 0 1px rgba(39, 88, 230, 0.12),
      0 24px 60px -18px rgba(31, 69, 176, 0.6),
      0 18px 44px rgba(0, 0, 0, 0.45);
    color: #fff;
    font-family:
      "SF Pro Display",
      Inter,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    text-align: center;
    animation: promotion-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @keyframes promotion-in {
    from {
      opacity: 0;
      transform: translateY(14px) scale(0.98);
    }
  }

  .promotion-globe {
    position: absolute;
    inset: 0;
    z-index: -2;
    width: 100%;
    height: 100%;
  }
  .promotion-dots {
    position: absolute;
    inset: 0;
    z-index: -1;
    background-image: radial-gradient(
      rgba(255, 255, 255, 0.07) 1px,
      transparent 1px
    );
    background-size: 16px 16px;
    mask-image: linear-gradient(180deg, #000, transparent 55%);
    pointer-events: none;
  }

  .promotion-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    height: 100%;
    padding: 14px 18px 22px 18px;
    box-sizing: border-box;
  }
  .promotion-lead {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    min-width: 0;
    text-align: left;
  }
  .promotion-eyebrow {
    padding: 3px 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    background: rgba(7, 8, 10, 0.6);
    color: rgba(255, 255, 255, 0.72);
    font-size: 9.5px;
    font-weight: 500;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .promotion-percent {
    font-size: 44px;
    font-weight: 700;
    line-height: 0.95;
    letter-spacing: -0.06em;
    background: linear-gradient(180deg, #ffffff 35%, #9db4ff 80%, #2758e6 115%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    white-space: nowrap;
  }
  .promotion-percent small {
    margin-left: 2px;
    font-size: 0.6em;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .promotion-title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .promotion-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 9px;
    flex-shrink: 0;
  }
  .promotion-clock {
    display: flex;
    gap: 3px;
  }
  .promotion-clock span {
    display: flex;
    align-items: baseline;
    gap: 1px;
    padding: 3px 5px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 7px;
    background: rgba(7, 8, 10, 0.7);
    backdrop-filter: blur(6px);
  }
  .promotion-clock b {
    font-size: 13px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .promotion-clock i {
    color: rgba(255, 255, 255, 0.45);
    font-size: 9px;
    font-style: normal;
  }

  .promotion-cta {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    border-radius: 999px;
    background: #1f45b0;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.14),
      0 8px 22px -8px rgba(39, 88, 230, 0.9);
    color: #fff;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    white-space: nowrap;
    transition: background-color 0.15s ease;
  }
  .promotion-cta:hover {
    background: #2758e6;
  }

  .promotion-close {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: rgba(7, 8, 10, 0.5);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
  }
  .promotion-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  @media (max-width: 640px) {
    .promotion-banner {
      right: 12px;
      bottom: 12px;
      width: calc(100vw - 24px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .promotion-banner {
      animation: none;
    }
  }
</style>

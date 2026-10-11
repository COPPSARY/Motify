<script lang="ts">
  import { ArrowUpRight, Tag, X } from "lucide-svelte";
  import type { PromotionBanner as Banner } from "../cloud/projects-api";

  export let banner: Banner;
  export let href: string | null = null;
  export let onDismiss: () => void;
</script>

<aside
  class="promotion-banner"
  data-promotion-banner={banner.id}
  aria-label="Promotion"
>
  <button
    class="promotion-close"
    type="button"
    aria-label="Dismiss promotion"
    on:click={onDismiss}
  >
    <X size={14} />
  </button>
  <div class="promotion-icon" aria-hidden="true"><Tag size={15} /></div>
  <div class="promotion-copy">
    <strong>{banner.title}</strong>
    <p>{banner.message}</p>
    {#if banner.plan}<span class="promotion-plan">{banner.plan.name}</span>{/if}
  </div>
  {#if href && banner.ctaLabel}
    <a
      class="promotion-cta"
      {href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
    >
      {banner.ctaLabel}<ArrowUpRight size={13} />
    </a>
  {/if}
</aside>

<style>
  .promotion-banner {
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 180;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 10px;
    width: min(340px, calc(100vw - 32px));
    padding: 13px 38px 13px 13px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    background: rgba(22, 23, 27, 0.94);
    box-shadow: 0 16px 44px rgba(0, 0, 0, 0.34);
    color: #f4f4f5;
    font-family:
      Inter,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    backdrop-filter: blur(18px);
  }

  .promotion-icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: rgba(111, 154, 255, 0.14);
    color: #8eb2ff;
  }

  .promotion-copy {
    min-width: 0;
  }
  .promotion-copy strong {
    display: block;
    padding-right: 4px;
    font-size: 13px;
    line-height: 1.35;
  }
  .promotion-copy p {
    margin: 3px 0 0;
    color: #aeb2ba;
    font-size: 12px;
    line-height: 1.45;
  }
  .promotion-plan {
    display: inline-flex;
    margin-top: 8px;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    color: #d9dce2;
    font-size: 10px;
    font-weight: 600;
  }
  .promotion-close {
    position: absolute;
    top: 9px;
    right: 9px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #777c85;
    cursor: pointer;
  }
  .promotion-close:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #fff;
  }
  .promotion-cta {
    grid-column: 2;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: fit-content;
    margin-top: -1px;
    color: #8eb2ff;
    font-size: 11px;
    font-weight: 650;
    text-decoration: none;
  }
  .promotion-cta:hover {
    color: #b6ccff;
  }

  @media (max-width: 640px) {
    .promotion-banner {
      right: 12px;
      bottom: 12px;
      width: calc(100vw - 24px);
    }
  }
</style>

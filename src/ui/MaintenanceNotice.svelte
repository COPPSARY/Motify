<script module lang="ts">
  /** The notice is a production-only disclaimer; dev and staging builds skip it. */
  export function isMaintenanceNoticeEnabled(): boolean {
    const env = String(import.meta.env["VITE_DD_ENV"] ?? "").toLowerCase();
    return env === "prod" || env === "production";
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";

  const visible = isMaintenanceNoticeEnabled();
  let card: HTMLDivElement | undefined;

  // The card has no actions, so keep keyboard focus on it instead of letting
  // Tab reach the page behind the overlay.
  function trapFocus(event: KeyboardEvent) {
    if (visible && event.key === "Tab") {
      event.preventDefault();
      card?.focus();
    }
  }

  onMount(() => {
    if (visible) card?.focus();
  });
</script>

<svelte:window on:keydown|capture={trapFocus} />

{#if visible}
  <div class="maintenance-overlay" data-maintenance-notice>
    <div
      class="maintenance-card"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
      aria-describedby="maintenance-body"
      tabindex="-1"
      bind:this={card}
    >
      <div class="maintenance-header">
        <h3 id="maintenance-title">We'll be right back.</h3>
      </div>

      <div id="maintenance-body" class="maintenance-body">
        <p>
          Railway, our hosting provider, was recently compromised. While we
          secure the service, we're also fixing bugs and improving features.
        </p>
        <p>
          We're pausing for a moment and will come back once Railway has
          resolved the issue.
        </p>
        <p class="maintenance-thanks">
          <strong
            >We're sorry for the inconvenience, and thank you for your patience.</strong
          >
        </p>
      </div>
    </div>
  </div>
{/if}

<style>
  .maintenance-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(3, 4, 8, 0.72);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: maintenanceFadeIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .maintenance-card {
    box-sizing: border-box;
    width: 100%;
    max-width: 440px;
    padding: 24px 26px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    background: rgba(18, 20, 26, 0.96);
    box-shadow:
      0 24px 64px -12px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(255, 255, 255, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
    color: #e5e7eb;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
      "Inter", sans-serif;
    outline: none;
    animation: maintenancePopIn 0.36s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes maintenanceFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes maintenancePopIn {
    from {
      opacity: 0;
      transform: scale(0.94) translateY(12px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .maintenance-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }

  .maintenance-header h3 {
    margin: 0;
    color: #ffffff;
    font-size: 22px;
    font-weight: 650;
    letter-spacing: -0.015em;
  }

  .maintenance-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: #9ca3af;
    font-size: 15.5px;
    line-height: 1.6;
  }

  .maintenance-body p {
    margin: 0;
  }

  .maintenance-thanks {
    margin-top: 2px;
    color: #f3f4f6;
  }

  .maintenance-thanks strong {
    color: #ffffff;
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .maintenance-overlay {
      padding: 16px;
    }

    .maintenance-card {
      padding: 20px;
    }
  }
</style>

<script module lang="ts">
  export const STORAGE_KEY = "motionly_early_notice_dismissed";
</script>

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Sparkles } from "lucide-svelte";

  function checkDismissed(): boolean {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(STORAGE_KEY) === "true";
      }
    } catch {
      // Fallback if localStorage access is restricted
    }
    return false;
  }

  let isAcknowledged = checkDismissed();
  let isDismissing = false;
  let isButtonEnabled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    if (isAcknowledged) return;

    // The "I understand" button must be disabled for exactly 3 seconds after the card appears.
    // No countdown or timer is shown to the user; it simply becomes enabled.
    timer = setTimeout(() => {
      isButtonEnabled = true;
    }, 3000);
  });

  onDestroy(() => {
    if (timer) clearTimeout(timer);
    if (dismissTimer) clearTimeout(dismissTimer);
  });

  function handleDismiss() {
    if (!isButtonEnabled || isDismissing) return;
    isDismissing = true;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, "true");
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }

    // Smooth exit animation before unmounting from DOM
    dismissTimer = setTimeout(() => {
      isAcknowledged = true;
      isDismissing = false;
    }, 280);
  }
</script>

{#if !isAcknowledged}
  <div
    class="motionly-notice-overlay"
    class:is-dismissing={isDismissing}
    role="presentation"
  >
    <div
      class="motionly-notice-card"
      class:is-dismissing={isDismissing}
      role="dialog"
      aria-modal="true"
      aria-label="Early development notice"
    >
      <div class="notice-card-header">
        <span class="notice-badge">
          <Sparkles size={12} class="notice-badge-icon" />
          <span>Beta</span>
        </span>
        <h3 class="notice-title">We’re still early.</h3>
      </div>

      <div class="notice-card-body">
        <p>
          If the animation quality isn’t quite where you expected, we’re sorry.
          Motify is still in early development, and generation quality depends
          heavily on the AI models powering it.
        </p>
        <p>
          We’re actively testing and improving our generation pipeline and
          working toward better AI models and better results.
        </p>
        <p class="notice-thanks">
          <strong>Thank you for your patience while we build Motify.</strong>
        </p>
      </div>

      <div class="notice-card-footer">
        <button
          type="button"
          class="notice-action-btn"
          disabled={!isButtonEnabled}
          on:click={handleDismiss}
        >
          I understand
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .motionly-notice-overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(3, 4, 8, 0.62);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: overlayFadeIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .motionly-notice-overlay.is-dismissing {
    animation: overlayFadeOut 0.28s cubic-bezier(0.4, 0, 1, 1) forwards;
  }

  @keyframes overlayFadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes overlayFadeOut {
    0% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  .motionly-notice-card {
    position: relative;
    width: 100%;
    max-width: 440px;
    box-sizing: border-box;
    padding: 24px 26px;
    background: rgba(18, 20, 26, 0.94);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    box-shadow:
      0 24px 64px -12px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(255, 255, 255, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
    color: #e5e7eb;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
      "Inter", sans-serif;
    animation: cardPopIn 0.36s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    pointer-events: auto;
    overflow: hidden;
  }

  .motionly-notice-card.is-dismissing {
    animation: cardPopOut 0.28s cubic-bezier(0.4, 0, 1, 1) forwards;
  }

  @keyframes cardPopIn {
    0% {
      opacity: 0;
      transform: scale(0.94) translateY(12px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes cardPopOut {
    0% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
    100% {
      opacity: 0;
      transform: scale(0.95) translateY(10px);
    }
  }

  .notice-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .notice-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2.5px 8px;
    border-radius: 6px;
    background: rgba(10, 132, 255, 0.14);
    border: 1px solid rgba(10, 132, 255, 0.28);
    color: #38bdf8;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .notice-title {
    margin: 0;
    font-size: 16px;
    font-weight: 650;
    color: #ffffff;
    letter-spacing: -0.015em;
  }

  .notice-card-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 13.5px;
    line-height: 1.6;
    color: #9ca3af;
  }

  .notice-card-body p {
    margin: 0;
  }

  .notice-thanks {
    color: #f3f4f6;
    margin-top: 2px;
  }

  .notice-thanks strong {
    color: #ffffff;
    font-weight: 600;
  }

  .notice-card-footer {
    margin-top: 20px;
    display: flex;
  }

  .notice-action-btn {
    width: 100%;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
    outline: none;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .notice-action-btn:disabled {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.32);
    cursor: not-allowed;
    box-shadow: none;
  }

  .notice-action-btn:not(:disabled) {
    background: #0a84ff;
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(10, 132, 255, 0.35);
  }

  .notice-action-btn:not(:disabled):hover {
    background: #0077ed;
    box-shadow: 0 6px 20px rgba(10, 132, 255, 0.45);
    transform: translateY(-1px);
  }

  .notice-action-btn:not(:disabled):active {
    background: #006cdb;
    transform: translateY(0);
  }

  @media (max-width: 640px) {
    .motionly-notice-overlay {
      padding: 16px;
    }

    .motionly-notice-card {
      padding: 20px;
      max-width: 100%;
    }
  }
</style>

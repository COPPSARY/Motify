<script lang="ts">
  import { onMount } from "svelte";
  import { Mic } from "lucide-svelte";

  /** Called when the user closes the card (button, backdrop or Escape). */
  export let onClose: () => void;

  let button: HTMLButtonElement;

  /** Render on <body>: a blurred or transformed ancestor would trap position: fixed. */
  function portal(node: HTMLElement) {
    document.body.append(node);
    return { destroy: () => node.remove() };
  }

  onMount(() => button?.focus());

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") onClose();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div
  class="voice-soon-overlay"
  use:portal
  role="presentation"
  on:pointerdown|self={onClose}
>
  <div
    class="voice-soon-card"
    role="dialog"
    aria-modal="true"
    aria-label="Voice over is coming soon"
  >
    <div class="voice-soon-header">
      <span class="voice-soon-badge">
        <Mic size={12} aria-hidden="true" />
        <span>Coming soon</span>
      </span>
      <h3 class="voice-soon-title">Voice over is on its way.</h3>
    </div>

    <div class="voice-soon-body">
      <p>
        Soon you’ll be able to add a voice over to your videos and choose how it
        sounds, from the gender, tone and pace to a voice that matches your
        brand.
      </p>
      <p>
        Tiffy will write the script, narrate it and sync it to your animation
        automatically.
      </p>
      <p class="voice-soon-thanks">
        <strong>Thank you for your patience while we build Motify.</strong>
      </p>
    </div>

    <div class="voice-soon-footer">
      <button
        type="button"
        class="voice-soon-action"
        bind:this={button}
        on:click={onClose}
      >
        Got it
      </button>
    </div>
  </div>
</div>

<style>
  .voice-soon-overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(3, 4, 8, 0.62);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .voice-soon-card {
    width: 100%;
    max-width: 440px;
    box-sizing: border-box;
    padding: 24px 26px;
    background: rgba(18, 20, 26, 0.94);
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
    animation: voiceSoonPopIn 0.36s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes voiceSoonPopIn {
    0% {
      opacity: 0;
      transform: scale(0.94) translateY(12px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .voice-soon-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .voice-soon-badge {
    flex: none;
    white-space: nowrap;
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

  .voice-soon-title {
    margin: 0;
    font-size: 16px;
    font-weight: 650;
    color: #ffffff;
    letter-spacing: -0.015em;
  }

  .voice-soon-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 13.5px;
    line-height: 1.6;
    color: #9ca3af;
  }

  .voice-soon-body p {
    margin: 0;
  }

  .voice-soon-thanks strong {
    color: #ffffff;
    font-weight: 600;
  }

  .voice-soon-footer {
    margin-top: 20px;
    display: flex;
  }

  .voice-soon-action {
    width: 100%;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: #0a84ff;
    color: #ffffff;
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(10, 132, 255, 0.35);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .voice-soon-action:hover {
    background: #0077ed;
    box-shadow: 0 6px 20px rgba(10, 132, 255, 0.45);
  }

  @media (max-width: 640px) {
    .voice-soon-overlay {
      padding: 16px;
    }

    .voice-soon-card {
      padding: 20px;
    }
  }
</style>

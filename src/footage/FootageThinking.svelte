<script lang="ts">
  import { onDestroy } from "svelte";
  import { Sparkles } from "lucide-svelte";

  /**
   * The AI at work, shown over the video: a scan sweeping the frame and its
   * thoughts arriving one by one, from its reading of the clips to the
   * decisions it is making. `inline` is the start page's compact feed.
   */
  export let lines: string[] = [];
  export let title = "Motify is editing";
  export let inline = false;

  const STEP_MS = 1900;
  let shown = 1;
  const timer = setInterval(() => {
    // The last thought stays, still working, until the edit is back.
    if (shown < lines.length) shown += 1;
  }, STEP_MS);
  onDestroy(() => clearInterval(timer));

  $: visible = lines.slice(0, Math.max(1, shown)).slice(-4);
</script>

<div
  class="fx-thinking"
  class:fx-thinking--inline={inline}
  role="status"
  aria-live="polite"
>
  {#if !inline}<span class="fx-thinking__scan" aria-hidden="true"></span>{/if}
  <div class="fx-thinking__panel">
    <div class="fx-thinking__head">
      <Sparkles size={14} aria-hidden="true" />
      <strong>{title}</strong>
      <span class="fx-thinking__dots" aria-hidden="true"
        ><i></i><i></i><i></i></span
      >
    </div>
    <ol>
      {#each visible as line, index (line)}
        <li class:fx-thinking__now={index === visible.length - 1}>{line}</li>
      {/each}
    </ol>
  </div>
</div>

<style>
  .fx-thinking {
    position: absolute;
    inset: 0;
    z-index: 8;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 18px;
    overflow: hidden;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      rgba(7, 7, 8, 0.15),
      rgba(7, 7, 8, 0.55) 60%,
      rgba(7, 7, 8, 0.8)
    );
  }

  .fx-thinking--inline {
    position: relative;
    inset: auto;
    padding: 10px 0 0;
    background: none;
  }

  .fx-thinking__scan {
    position: absolute;
    left: 0;
    right: 0;
    top: -20%;
    height: 18%;
    background: linear-gradient(
      to bottom,
      transparent,
      color-mix(in srgb, var(--fx-ui, #7c5cff) 28%, transparent),
      transparent
    );
    animation: fx-thinking-scan 2.6s ease-in-out infinite;
  }

  .fx-thinking__panel {
    position: relative;
    width: min(440px, 100%);
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    background: rgba(14, 14, 16, 0.78);
    backdrop-filter: blur(8px);
    color: #f4f4f5;
  }

  .fx-thinking--inline .fx-thinking__panel {
    width: 100%;
    border-color: var(--sl-border, rgba(255, 255, 255, 0.12));
    background: transparent;
    backdrop-filter: none;
    color: inherit;
    padding: 0;
    border: 0;
  }

  .fx-thinking__head {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
  }

  .fx-thinking--inline .fx-thinking__head {
    display: none;
  }

  .fx-thinking__dots {
    display: inline-flex;
    gap: 3px;
  }

  .fx-thinking__dots i {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.3;
    animation: fx-thinking-dot 1.2s infinite;
  }

  .fx-thinking__dots i:nth-child(2) {
    animation-delay: 0.2s;
  }

  .fx-thinking__dots i:nth-child(3) {
    animation-delay: 0.4s;
  }

  ol {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 5px;
  }

  li {
    font-size: 12.5px;
    line-height: 1.4;
    opacity: 0.5;
    animation: fx-thinking-in 0.35s ease-out both;
  }

  li.fx-thinking__now {
    opacity: 1;
  }

  li.fx-thinking__now::before {
    content: "› ";
    color: var(--fx-ui, #7c5cff);
  }

  @keyframes fx-thinking-scan {
    0% {
      top: -20%;
    }
    100% {
      top: 102%;
    }
  }

  @keyframes fx-thinking-dot {
    0%,
    100% {
      opacity: 0.25;
    }
    50% {
      opacity: 1;
    }
  }

  @keyframes fx-thinking-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fx-thinking__scan,
    .fx-thinking__dots i,
    li {
      animation: none;
    }
  }
</style>

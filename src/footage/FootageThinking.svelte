<script lang="ts">
  import { onDestroy } from "svelte";
  import { Sparkles } from "lucide-svelte";

  import { workProgress } from "./thinking";

  /**
   * The AI at work, shown over the video: a progress bar that runs quickly to
   * about 90% and then creeps while the model really works, the thought it is
   * on, and the ones before it fading out. `inline` is the start page's
   * compact version, inside its step list.
   */
  export let lines: string[] = [];
  export let title = "Motify is editing";
  export let inline = false;

  const STEP_MS = 1800;
  const started = Date.now();
  let elapsed = 0;
  let shown = 1;
  const clock = setInterval(() => {
    elapsed = (Date.now() - started) / 1000;
    // The last thought stays, still working, until the edit is back.
    shown = Math.min(lines.length, 1 + Math.floor((elapsed * 1000) / STEP_MS));
  }, 100);
  onDestroy(() => clearInterval(clock));

  $: percent = Math.floor(workProgress(elapsed) * 100);
  $: current = lines[Math.max(0, shown - 1)] ?? "Working";
  $: before = lines.slice(Math.max(0, shown - 4), Math.max(0, shown - 1));
</script>

<div
  class="fx-thinking"
  class:fx-thinking--inline={inline}
  role="status"
  aria-live="polite"
>
  {#if !inline}<span class="fx-thinking__scan" aria-hidden="true"></span>{/if}
  <div class="fx-thinking__panel">
    {#if !inline}
      <div class="fx-thinking__head">
        <span class="fx-thinking__badge"
          ><Sparkles size={14} aria-hidden="true" /></span
        >
        <strong>{title}</strong>
        <span class="fx-thinking__percent">{percent}%</span>
      </div>
    {/if}
    <div
      class="fx-thinking__bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={title}
    >
      <span style:width={`${percent}%`}></span>
    </div>
    {#if inline}<span class="fx-thinking__percent fx-thinking__percent--inline"
        >{percent}%</span
      >{/if}
    <ol class="fx-thinking__past" aria-hidden="true">
      {#each before as line, index (line)}
        <li style:opacity={0.25 + (0.45 * (index + 1)) / (before.length + 1)}>
          {line}
        </li>
      {/each}
    </ol>
    {#key current}
      <p class="fx-thinking__now">{current}</p>
    {/key}
  </div>
</div>

<style>
  .fx-thinking {
    position: absolute;
    inset: 0;
    z-index: 8;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    overflow: hidden;
    pointer-events: none;
    background: rgba(8, 8, 10, 0.55);
    backdrop-filter: blur(6px) saturate(0.9);
  }

  .fx-thinking--inline {
    position: relative;
    inset: auto;
    display: block;
    padding: 10px 0 0;
    background: none;
    backdrop-filter: none;
  }

  .fx-thinking__scan {
    position: absolute;
    left: 0;
    right: 0;
    top: -25%;
    height: 22%;
    background: linear-gradient(
      to bottom,
      transparent,
      color-mix(in srgb, var(--fx-ui, #7c5cff) 22%, transparent),
      transparent
    );
    animation: fx-thinking-scan 2.8s ease-in-out infinite;
  }

  .fx-thinking__panel {
    position: relative;
    width: min(420px, 100%);
    padding: 18px 20px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    background: rgba(16, 16, 19, 0.86);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    color: #f4f4f5;
  }

  .fx-thinking--inline .fx-thinking__panel {
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: inherit;
  }

  .fx-thinking__head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    font-size: 14px;
  }

  .fx-thinking__badge {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--fx-ui, #7c5cff) 26%, transparent);
    color: color-mix(in srgb, var(--fx-ui, #7c5cff) 70%, #fff);
    animation: fx-thinking-pulse 1.6s ease-in-out infinite;
  }

  .fx-thinking__percent {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    opacity: 0.75;
  }

  .fx-thinking__percent--inline {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    text-align: right;
  }

  .fx-thinking__bar {
    position: relative;
    height: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.09);
    overflow: hidden;
  }

  .fx-thinking--inline .fx-thinking__bar {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }

  .fx-thinking__bar span {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--fx-ui, #7c5cff) 70%, #fff),
      var(--fx-ui, #7c5cff)
    );
    transition: width 0.3s ease-out;
  }

  .fx-thinking__bar span::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.45),
      transparent
    );
    transform: translateX(-100%);
    animation: fx-thinking-shine 1.4s ease-in-out infinite;
  }

  .fx-thinking__past {
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 4px;
  }

  .fx-thinking__past li {
    font-size: 12px;
    line-height: 1.4;
  }

  .fx-thinking__past li::before {
    content: "✓ ";
    color: var(--fx-ui, #7c5cff);
  }

  .fx-thinking__now {
    margin: 6px 0 0;
    font-size: 14.5px;
    line-height: 1.45;
    font-weight: 500;
    animation: fx-thinking-in 0.4s ease-out both;
  }

  .fx-thinking--inline .fx-thinking__now {
    font-size: 12.5px;
  }

  .fx-thinking__now::before {
    content: "› ";
    color: var(--fx-ui, #7c5cff);
  }

  @keyframes fx-thinking-scan {
    0% {
      top: -25%;
    }
    100% {
      top: 105%;
    }
  }

  @keyframes fx-thinking-shine {
    to {
      transform: translateX(100%);
    }
  }

  @keyframes fx-thinking-pulse {
    50% {
      transform: scale(1.08);
    }
  }

  @keyframes fx-thinking-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fx-thinking__scan,
    .fx-thinking__badge,
    .fx-thinking__bar span::after,
    .fx-thinking__now {
      animation: none;
    }
  }
</style>

<script lang="ts">
  import { onDestroy } from "svelte";
  import type { ProgressView } from "../stores/generation-progress";

  /** The running generation as the editor reports it; null until the backend says anything. */
  export let view: ProgressView | null = null;

  const TIPS = [
    "Tiffy writes the film, checks it, then fixes anything that looks off.",
    'When it\'s ready, ask for changes in plain words: "make the title bigger".',
    "Your welcome credits cover this video.",
    "You can look around while you wait. Your video keeps building.",
  ];

  let tip = 0;
  const timer = setInterval(() => (tip = (tip + 1) % TIPS.length), 6000);
  onDestroy(() => clearInterval(timer));
</script>

<div class="fvw" role="status" aria-live="polite">
  <strong>Making your first video</strong>
  <span class="fvw__line">
    {view?.label ?? "Reading your brief"}{view?.eta ? ` · ${view.eta}` : ""}
  </span>
  <div class="fvw__bar" aria-hidden="true">
    <span style={`width: ${Math.round((view?.fraction ?? 0.08) * 100)}%`}
    ></span>
  </div>
  <span class="fvw__tip">{TIPS[tip]}</span>
</div>

<style>
  .fvw {
    position: fixed;
    left: 50%;
    bottom: 20px;
    z-index: 55;
    display: grid;
    gap: 6px;
    width: min(420px, calc(100vw - 32px));
    padding: 14px 16px;
    transform: translateX(-50%);
    border: 1px solid var(--sl-border-strong, #2a2a33);
    border-radius: 14px;
    background: var(--sl-panel, #14141a);
    color: var(--sl-text, #f4f4f6);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    font-size: 13.5px;
  }
  .fvw__line,
  .fvw__tip {
    color: var(--sl-muted, #9a9aa6);
    font-size: 12.5px;
  }
  .fvw__bar {
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--sl-border-strong, #2a2a33);
  }
  .fvw__bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--sl-brand-cobalt, #4f6bff);
    transition: width 1s linear;
  }
</style>

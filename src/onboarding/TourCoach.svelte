<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type { TourStep } from "./tour";

  /**
   * Spotlight and a short card pointing at one part of the app at a time.
   * Targets are found by `data-tour`; a step whose target isn't on screen is
   * skipped rather than pointing at nothing.
   */
  export let steps: readonly TourStep[];
  export let index: number;
  export let onNext: () => void;
  export let onBack: () => void;
  export let onDone: (skipped: boolean) => void;

  const GAP = 12;
  const PAD = 6;
  const CARD_WIDTH = 300;

  let card: HTMLDivElement | undefined;
  let hole = { top: 0, left: 0, width: 0, height: 0 };
  let position = { top: 0, left: 0 };
  let visible = false;
  let frame = 0;

  $: step = steps[index];
  $: last = index === steps.length - 1;
  $: if (step) void show(step);

  function target(current: TourStep): HTMLElement | null {
    const element = document.querySelector<HTMLElement>(
      `[data-tour="${current.target}"]`,
    );
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? element : null;
  }

  async function show(current: TourStep) {
    visible = false;
    await tick();
    if (current !== step) return;
    const element = target(current);
    if (!element) {
      if (last) onDone(false);
      else onNext();
      return;
    }
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
    visible = true;
    await tick();
    card?.focus();
  }

  function measure() {
    if (!step) return;
    const element = target(step);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    hole = {
      top: rect.top - PAD,
      left: rect.left - PAD,
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    };
    const width = Math.min(CARD_WIDTH, window.innerWidth - GAP * 2);
    const height = card?.offsetHeight ?? 150;
    // Targets in the left panel get the card beside them, not over the preview.
    const besideLeftPanel =
      rect.right < window.innerWidth * 0.35 &&
      rect.right + GAP + width <= window.innerWidth - GAP;
    if (besideLeftPanel) {
      position = {
        left: rect.right + GAP + PAD,
        top: clamp(
          rect.top + rect.height / 2 - height / 2,
          GAP,
          window.innerHeight - height - GAP,
        ),
      };
      return;
    }
    const below = rect.bottom + GAP + PAD;
    const top =
      below + height <= window.innerHeight - GAP
        ? below
        : Math.max(GAP, rect.top - GAP - PAD - height);
    position = {
      top,
      left: clamp(
        rect.left + rect.width / 2 - width / 2,
        GAP,
        window.innerWidth - width - GAP,
      ),
    };
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function onViewportChange() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDone(true);
    }
  }

  onMount(() => {
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
  });

  onDestroy(() => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("scroll", onViewportChange, true);
  });
</script>

{#if step}
  <div class="tour" class:tour--visible={visible} aria-hidden={!visible}>
    <div
      class="tour__hole"
      style:top={`${hole.top}px`}
      style:left={`${hole.left}px`}
      style:width={`${hole.width}px`}
      style:height={`${hole.height}px`}
    ></div>
    <div
      bind:this={card}
      class="tour__card"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      tabindex="-1"
      style:top={`${position.top}px`}
      style:left={`${position.left}px`}
      on:keydown={keydown}
    >
      <div class="tour__meta">
        <span>{index + 1} of {steps.length}</span>
        <button type="button" class="tour__skip" on:click={() => onDone(true)}
          >Skip tour</button
        >
      </div>
      <h2 id="tour-title">{step.title}</h2>
      <p id="tour-body">{step.body}</p>
      <div class="tour__actions">
        {#if index > 0}
          <button type="button" class="tour__back" on:click={onBack}
            >Back</button
          >
        {/if}
        <button
          type="button"
          class="tour__next"
          on:click={() => (last ? onDone(false) : onNext())}
        >
          {last ? "Got it" : "Next"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tour {
    position: fixed;
    inset: 0;
    z-index: 1000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 160ms ease;
  }
  .tour--visible {
    opacity: 1;
  }
  /* The dimmed page is the hole's shadow, so the target stays bright and clickable. */
  .tour__hole {
    position: fixed;
    border-radius: 10px;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.5),
      0 0 0 100vmax rgba(0, 0, 0, 0.62);
    transition:
      top 200ms ease,
      left 200ms ease,
      width 200ms ease,
      height 200ms ease;
  }
  .tour__card {
    position: fixed;
    width: min(300px, calc(100vw - 24px));
    padding: 14px 16px 16px;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.11));
    border-radius: 12px;
    background: var(--sl-panel, #111);
    color: var(--sl-text, #ededed);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
    pointer-events: auto;
    outline: none;
  }
  .tour__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--sl-muted, #8a8a8a);
    font-size: 12px;
  }
  .tour__skip,
  .tour__back {
    padding: 0;
    border: 0;
    background: none;
    color: var(--sl-muted, #8a8a8a);
    font: inherit;
    cursor: pointer;
  }
  .tour__skip:hover,
  .tour__back:hover {
    color: var(--sl-text, #ededed);
  }
  .tour__card h2 {
    margin: 10px 0 4px;
    font-size: 15px;
    font-weight: 600;
  }
  .tour__card p {
    margin: 0;
    color: var(--sl-text-soft, #b5b5b5);
    font-size: 13px;
    line-height: 1.5;
  }
  .tour__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 14px;
    margin-top: 14px;
    font-size: 13px;
  }
  .tour__next {
    padding: 7px 14px;
    border: 0;
    border-radius: 8px;
    background: var(--sl-brand-cobalt, #1f45b0);
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .tour__next:hover {
    background: #2758e6;
  }
  @media (prefers-reduced-motion: reduce) {
    .tour,
    .tour__hole {
      transition: none;
    }
  }
</style>

<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { mountGlobe } from "./globe";

  /** The right half of sign-in: a dark globe in dots, turning slowly. */

  let canvas: HTMLCanvasElement;
  let stop: () => void = () => {};

  onMount(() => {
    // No matchMedia (tests, old webviews): draw it still rather than guess.
    const still =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    stop = mountGlobe(canvas, { still });
  });

  onDestroy(() => stop());
</script>

<div class="auth-showcase" aria-hidden="true">
  <canvas bind:this={canvas} class="auth-showcase__globe"></canvas>
</div>

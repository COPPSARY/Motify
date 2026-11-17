<script lang="ts">
  import { Check, Loader2 } from "lucide-svelte";
  import FootageThinking from "../footage/FootageThinking.svelte";

  /**
   * PSD to Video while Tiffy animates the imported design: the PSD page's
   * steps, carried on over the editor, so the person waits on one page and
   * meets the editor with the video done. The bar runs to about 90% and
   * creeps, as on /footage.
   */

  export let name: string;
  /** Layer names, top first. */
  export let layers: readonly string[];
  /** Shows the editor now; the animation carries on in its chat. */
  export let onSkip: () => void;

  $: lines = [
    `Reading your ${layers.length} layer${layers.length === 1 ? "" : "s"}`,
    ...layers.slice(0, 3).map((layer) => `Looking at “${layer}”`),
    "Working out what belongs together and what comes first",
    "Planning how each layer arrives",
    "Timing the motion to the length you picked",
    "Holding the finished design on screen at the end",
  ];
</script>

<div class="psd-generating">
  <section class="fs psd" aria-labelledby="psd-generating-title">
    <header class="fs-head">
      <span class="fs-badge">Beta</span>
      <h1 id="psd-generating-title">Animating {name}</h1>
      <p>
        Tiffy is turning your layers into a video. The editor opens when it is
        ready.
      </p>
    </header>
    <div class="fs-progress" role="status" aria-live="polite">
      <ol>
        <li class="fs-done">
          <span class="fs-dot"><Check size={13} /></span>
          <span
            ><strong>Uploading the layers</strong><small
              >Every layer kept where Photoshop placed it</small
            ></span
          >
        </li>
        <li class="fs-now">
          <span class="fs-dot"><Loader2 size={13} class="fx-spin" /></span>
          <span
            ><strong>Animating your layers</strong><small
              >Usually under a minute</small
            ><FootageThinking inline {lines} /></span
          >
        </li>
        <li>
          <span class="fs-dot"></span>
          <span
            ><strong>Opening the editor</strong><small
              >Preview, edit and re-animate from there</small
            ></span
          >
        </li>
      </ol>
    </div>
    <button type="button" class="psd-generating__skip" on:click={onSkip}
      >Open the editor now</button
    >
  </section>
</div>

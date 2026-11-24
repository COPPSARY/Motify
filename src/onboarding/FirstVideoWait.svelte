<script lang="ts">
  import { onDestroy } from "svelte";

  const TIPS = [
    "Tiffy writes the film, checks it, then fixes anything that looks off.",
    'When it\'s ready, ask for changes in plain words, like "make the title bigger".',
    "Your welcome credits cover this video.",
    "You can look around while you wait. Your video keeps building.",
  ];

  let tip = 0;
  const timer = setInterval(() => (tip = (tip + 1) % TIPS.length), 6000);
  onDestroy(() => clearInterval(timer));
</script>

<!-- Sits under the editor's own "Generating your video" status, which already shows the phase, the time left and the bar. -->
<p class="fvw" aria-live="off">{TIPS[tip]}</p>

<style>
  .fvw {
    max-width: 320px;
    margin: 14px auto 0;
    color: var(--sl-muted, #9a9aa6);
    font-size: 12.5px;
    line-height: 1.5;
    text-align: center;
  }
</style>

<script lang="ts">
  import gsap from "gsap";

  export let speed: number;
  export let ease: string;
  export let tweenCount: number;
  export let onSpeed: (speed: number) => void;
  export let onEase: (ease: string) => void;

  const easePresets = [
    { label: "Smooth", value: "power3.inOut" },
    { label: "Snappy", value: "back.out(1.35)" },
    { label: "Soft", value: "sine.inOut" },
    { label: "Linear", value: "none" },
    { label: "Elastic", value: "elastic.out(1, 0.3)" },
    { label: "Bounce", value: "bounce.out" },
    { label: "Expo", value: "expo.out" },
    { label: "Circ", value: "circ.out" },
  ] as const;

  function easePath(easeName: string): string {
    const easing = gsap.parseEase(easeName);
    return Array.from({ length: 25 }, (_, index) => {
      const progress = index / 24;
      const x = 4 + progress * 72;
      const y = 28 - easing(progress) * 24;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }

  function changeSpeed(event: Event): void {
    onSpeed(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

<div class="me-section-title me-appearance-title">Animation</div>
<div class="me-animation-editor">
  <label class="me-property-group" for="property-animation-speed">
    <span class="me-property-label-row">
      <span class="me-property-label">Speed</span>
      <output>{speed.toFixed(2)}×</output>
    </span>
    <input
      id="property-animation-speed"
      class="me-custom-slider"
      aria-label="Animation speed"
      type="range"
      min="0.25"
      max="2"
      step="0.05"
      value={speed}
      on:input={changeSpeed}
      disabled={tweenCount === 0}
    />
  </label>
  <div class="me-ease-grid" aria-label="Easing presets">
    {#each easePresets as preset}
      <button
        class="me-ease-preset"
        class:me-active={ease === preset.value}
        type="button"
        aria-label={`${preset.label} easing`}
        on:click={() => onEase(preset.value)}
        disabled={tweenCount === 0}
      >
        <svg viewBox="0 0 80 32" aria-hidden="true">
          <path d="M4 28H76M4 28V4" class="me-ease-axis"></path>
          <path d={easePath(preset.value)} class="me-ease-curve"></path>
        </svg>
        <span>{preset.label}</span>
      </button>
    {/each}
  </div>
  <small class="me-animation-help">
    {#if tweenCount > 0}
      Controls the overall timing for this layer's animation.
    {:else}
      This layer has no authored GSAP tweens yet.
    {/if}
  </small>
</div>

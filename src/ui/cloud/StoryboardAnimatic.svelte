<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Pause, Play } from "lucide-svelte";
  import type { StoryboardBeat } from "../../cloud/projects-api";
  import {
    DEFAULT_CANVAS,
    type CanvasAspect,
  } from "../../composition/canvas-frame";
  import { CompositionRuntime } from "../../composition/runtime";
  import { storyboardAnimatic } from "../../onboarding/storyboard-animatic";

  export let beats: readonly StoryboardBeat[];
  export let seconds: number;
  export let aspect: CanvasAspect;
  /** Each attached picture's thumbnail URL, by upload id. */
  export let pictures: ReadonlyMap<string, string>;
  /** The beat on screen, by index; -1 before the sketch has drawn. */
  export let activeIndex = -1;

  let frame: HTMLDivElement;
  let host: HTMLDivElement;
  let runtime: CompositionRuntime | null = null;
  let unsubscribe: (() => void) | null = null;
  let filmWidth = 1920;
  let filmHeight = 1080;
  let scale = 1;
  let time = 0;
  let playing = false;
  let mounted = false;
  let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
  /** What the sketch on screen was drawn from. */
  let builtKey = "";
  let resize: ResizeObserver | undefined;

  // Edits redraw the sketch, a moment after the typing stops.
  $: sketchKey = JSON.stringify([beats, seconds, aspect, [...pictures]]);
  $: if (mounted) scheduleRebuild(sketchKey);

  onMount(() => {
    mounted = true;
    // Without a ResizeObserver the sketch keeps the size it was drawn at.
    if (typeof ResizeObserver !== "undefined") {
      resize = new ResizeObserver(fit);
      resize.observe(frame);
    }
    const still = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    build(0, !still);
  });

  onDestroy(() => {
    clearTimeout(rebuildTimer);
    resize?.disconnect();
    teardown();
  });

  function scheduleRebuild(key: string) {
    clearTimeout(rebuildTimer);
    if (key === builtKey) return;
    rebuildTimer = setTimeout(() => {
      if (runtime) build(time, playing);
    }, 250);
  }

  function build(at: number, play: boolean) {
    teardown();
    builtKey = sketchKey;
    const definition = storyboardAnimatic({ beats, seconds, aspect, pictures });
    filmWidth = definition.width;
    filmHeight = definition.height;
    fit();
    runtime = new CompositionRuntime(definition, host, {
      canvas: { aspect, framing: DEFAULT_CANVAS.framing },
    });
    unsubscribe = runtime.subscribe((snapshot) => {
      time = snapshot.time;
      playing = snapshot.playing;
      const beat = Number(snapshot.sceneId.replace("beat-", ""));
      activeIndex = Number.isInteger(beat) ? beat - 1 : -1;
    });
    runtime.seek(Math.min(at, seconds));
    if (play) runtime.play();
  }

  function teardown() {
    unsubscribe?.();
    unsubscribe = null;
    runtime?.destroy();
    runtime = null;
  }

  function fit() {
    if (frame) scale = frame.clientWidth / filmWidth;
  }

  function toggle() {
    if (!runtime) return;
    if (playing) runtime.pause();
    else runtime.play();
  }

  function scrub(event: Event) {
    runtime?.seek(Number((event.currentTarget as HTMLInputElement).value));
  }

  /** Shows a beat from its start. */
  export function seek(to: number) {
    runtime?.seek(to);
  }

  function clock(value: number): string {
    return `${value.toFixed(1)}s`;
  }
</script>

<div class="gs-sketch">
  <div
    class="gs-sketch-frame"
    bind:this={frame}
    style:aspect-ratio={`${filmWidth} / ${filmHeight}`}
    style:max-width={`calc(60vh * ${filmWidth} / ${filmHeight})`}
  >
    <div
      class="gs-sketch-host"
      bind:this={host}
      style:transform={`scale(${scale})`}
      aria-hidden="true"
    ></div>
  </div>
  <div class="gs-sketch-controls">
    <button
      type="button"
      aria-label={playing ? "Pause the sketch" : "Play the sketch"}
      on:click={toggle}
    >
      {#if playing}<Pause size={15} />{:else}<Play size={15} />{/if}
    </button>
    <input
      type="range"
      min="0"
      max={seconds}
      step={1 / 30}
      value={time}
      aria-label="Position in the sketch"
      on:input={scrub}
    />
    <span class="gs-sketch-time">{clock(time)} / {clock(seconds)}</span>
  </div>
  <small class="gs-hint"
    >A rough sketch of the timing. Grey boxes are designed in the film; your
    pictures are shown as they'll be used.</small
  >
</div>

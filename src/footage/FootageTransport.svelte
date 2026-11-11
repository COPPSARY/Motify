<script lang="ts">
  import {
    Captions,
    Maximize2,
    Pause,
    Play,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
  } from "lucide-svelte";
  import {
    FOOTAGE_FORMATS,
    placeSegments,
    type FootageEdit,
    type FootageFormat,
  } from "./edit";

  /**
   * The bar under the footage preview: timecode, play, jump between cuts,
   * captions on or off, format and sound. It replaces the scene bar, which
   * has nothing to say about a cut made of clips.
   */

  export let edit: FootageEdit;
  export let time = 0;
  export let duration = 0;
  export let playing = false;
  export let muted = false;
  export let onTogglePlay: () => void;
  export let onSeek: (time: number) => void;
  export let onToggleMute: () => void;
  export let onFormat: (format: FootageFormat) => void;
  export let onToggleCaptions: () => void;
  export let onFit: () => void;

  $: fps = edit.fps || 30;
  $: cuts = placeSegments(edit).map((item) => item.start);

  function timecode(seconds: number): string {
    const whole = Math.max(0, seconds);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const secs = Math.floor(whole % 60);
    const frame = Math.min(fps - 1, Math.floor((whole % 1) * fps));
    const two = (value: number) => String(value).padStart(2, "0");
    return `${two(hours)}:${two(minutes)}:${two(secs)}|${two(frame)}`;
  }

  function previousCut(): void {
    const earlier = cuts.filter((cut) => cut < time - 0.05);
    onSeek(earlier.length > 0 ? earlier[earlier.length - 1]! : 0);
  }

  function nextCut(): void {
    const later = cuts.find((cut) => cut > time + 0.05);
    onSeek(later ?? Math.max(0, duration - 0.01));
  }
</script>

<div class="fx-transport" role="toolbar" aria-label="Playback">
  <div class="fx-transport__side">
    <button
      type="button"
      class="fx-transport__icon"
      class:fx-on={edit.captions.enabled}
      aria-pressed={edit.captions.enabled}
      title="Captions on or off"
      on:click={onToggleCaptions}><Captions size={16} /></button
    >
    <div class="fx-transport__formats" role="group" aria-label="Format">
      {#each FOOTAGE_FORMATS as format (format)}
        <button
          type="button"
          class:fx-on={edit.format === format}
          aria-pressed={edit.format === format}
          on:click={() => onFormat(format)}>{format}</button
        >
      {/each}
    </div>
  </div>
  <div class="fx-transport__center">
    <span class="fx-timecode" aria-label="Playhead">{timecode(time)}</span>
    <div class="fx-transport__buttons">
      <button
        type="button"
        class="fx-transport__icon"
        aria-label="Previous cut"
        title="Previous cut"
        on:click={previousCut}><SkipBack size={16} /></button
      >
      <button
        type="button"
        class="fx-transport__play"
        aria-label={playing ? "Pause" : "Play"}
        on:click={onTogglePlay}
      >
        {#if playing}<Pause size={17} />{:else}<Play size={17} />{/if}
      </button>
      <button
        type="button"
        class="fx-transport__icon"
        aria-label="Next cut"
        title="Next cut"
        on:click={nextCut}><SkipForward size={16} /></button
      >
    </div>
    <span class="fx-duration">{timecode(duration)}</span>
  </div>
  <div class="fx-transport__side fx-transport__side--end">
    <button
      type="button"
      class="fx-transport__icon"
      aria-label={muted ? "Sound on" : "Mute"}
      title={muted ? "Sound on" : "Mute"}
      on:click={onToggleMute}
    >
      {#if muted}<VolumeX size={16} />{:else}<Volume2 size={16} />{/if}
    </button>
    <button
      type="button"
      class="fx-transport__icon"
      aria-label="Fit preview"
      title="Fit preview"
      on:click={onFit}><Maximize2 size={15} /></button
    >
  </div>
</div>

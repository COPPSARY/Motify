<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    RefreshCw,
    Sparkles,
    Trash2,
  } from "lucide-svelte";
  import { formatCredits } from "../../api/credits";
  import type { Storyboard } from "../../cloud/projects-api";
  import type { CanvasAspect } from "../../composition/canvas-frame";
  import {
    beatTime,
    moveBeat,
    removeBeat,
    STORYBOARD_CREDITS,
  } from "../../onboarding/guided-tools";
  import StoryboardAnimatic from "./StoryboardAnimatic.svelte";

  /** The storyboard on screen; edits change it in place, so going back keeps them. */
  export let storyboard: Storyboard;
  export let seconds: number;
  export let aspect: CanvasAspect;
  /** Each attached picture by upload id: its thumbnail and what the film does with it. */
  export let pictures: ReadonlyMap<string, { url: string; role: string }>;
  /** The film's price, or null when credits are not charged. */
  export let price: number | null;
  /** True when credits are charged, so the preview's own price is shown. */
  export let charged = false;
  export let busy = false;
  export let disabled = false;
  export let onBack: () => void;
  export let onRetry: () => void;
  export let onGenerate: (storyboard: Storyboard) => void;

  let heading: HTMLHeadingElement | undefined;
  let sketch: StoryboardAnimatic | undefined;
  let activeIndex = -1;

  $: sketchPictures = new Map(
    [...pictures].map(([id, picture]) => [id, picture.url]),
  );

  onMount(async () => {
    await tick();
    heading?.focus();
  });

  function move(index: number, offset: -1 | 1) {
    storyboard = {
      ...storyboard,
      beats: moveBeat(storyboard.beats, index, offset, seconds),
    };
  }

  function remove(index: number) {
    storyboard = {
      ...storyboard,
      beats: removeBeat(storyboard.beats, index, seconds),
    };
  }
</script>

<section class="gs-fields gs-board" aria-labelledby="gs-board-title">
  <header class="gs-form-head">
    <span class="gs-tip">Storyboard</span>
    <h1 id="gs-board-title" tabindex="-1" bind:this={heading}>
      Here's the plan
    </h1>
    <p>
      Check the order and the words before we make it, and change anything you
      like. How each screen looks still comes from your pictures.
    </p>
  </header>

  <StoryboardAnimatic
    bind:this={sketch}
    bind:activeIndex
    beats={storyboard.beats}
    {seconds}
    {aspect}
    pictures={sketchPictures}
  />

  <ol class="gs-beats">
    {#each storyboard.beats as beat, index (index)}
      <li class="gs-panel gs-beat" class:is-active={index === activeIndex}>
        <div class="gs-beat-head">
          <button
            type="button"
            class="gs-beat-number"
            aria-label={`Play from beat ${index + 1}`}
            on:click={() => sketch?.seek(beat.start)}>{index + 1}</button
          >
          <input
            class="gs-beat-title"
            aria-label={`Beat ${index + 1} name`}
            maxlength="80"
            bind:value={beat.title}
          />
          <span class="gs-beat-time">{beatTime(beat)}</span>
          <span class="gs-beat-tools">
            <button
              type="button"
              aria-label={`Move beat ${index + 1} earlier`}
              disabled={index === 0}
              on:click={() => move(index, -1)}><ArrowUp size={14} /></button
            >
            <button
              type="button"
              aria-label={`Move beat ${index + 1} later`}
              disabled={index === storyboard.beats.length - 1}
              on:click={() => move(index, 1)}><ArrowDown size={14} /></button
            >
            <button
              type="button"
              aria-label={`Remove beat ${index + 1}`}
              disabled={storyboard.beats.length <= 1}
              on:click={() => remove(index)}><Trash2 size={14} /></button
            >
          </span>
        </div>

        {#if beat.shows.some((id) => pictures.has(id))}
          <div class="gs-beat-shows">
            {#each beat.shows as id (id)}
              {@const picture = pictures.get(id)}
              {#if picture}
                <span class="gs-beat-picture" title={picture.role}>
                  <img src={picture.url} alt="" />
                  <small>{picture.role}</small>
                </span>
              {/if}
            {/each}
          </div>
        {/if}

        <label class="gs-beat-field">
          <span>What happens</span>
          <textarea rows="2" maxlength="400" bind:value={beat.action}
          ></textarea>
        </label>
        <div class="gs-beat-row">
          <label class="gs-beat-field">
            <span>On screen</span>
            <input
              maxlength="300"
              placeholder="No words"
              bind:value={beat.text}
            />
          </label>
          <label class="gs-beat-field">
            <span>Camera</span>
            <input maxlength="200" bind:value={beat.camera} />
          </label>
        </div>
      </li>
    {/each}
  </ol>

  <label class="gs-panel gs-beat-field">
    <span>Ends on</span>
    <input maxlength="400" bind:value={storyboard.ending} />
  </label>

  <div class="gs-actions">
    <button
      type="button"
      class="gs-generate"
      disabled={disabled || busy}
      on:click={() => onGenerate(storyboard)}
    >
      <span class="gs-generate-label"
        ><Sparkles size={16} /> Make this video</span
      >
      {#if price !== null}
        <span class="gs-price">≈ {formatCredits(price)} credits</span>
      {/if}
    </button>
    <div class="gs-board-secondary">
      <button type="button" class="gs-secondary" on:click={onBack}
        ><ArrowLeft size={15} /> Back to options</button
      >
      <button
        type="button"
        class="gs-secondary"
        disabled={disabled || busy}
        on:click={onRetry}
        ><RefreshCw size={14} />
        {busy ? "Planning…" : "Try another plan"}
        {#if charged}<span class="gs-secondary-price"
            >{formatCredits(STORYBOARD_CREDITS)} credit</span
          >{/if}</button
      >
    </div>
  </div>
</section>

<script lang="ts">
  import { onMount } from "svelte";
  import { fetchPromptTemplates } from "../api/prompt-templates";
  import { categoriesOf } from "./interests";
  import {
    DEFAULT_FORMAT,
    FORMAT_CHOICES,
    MAX_INTERESTS,
    type WelcomeAnswers,
  } from "./first-video";

  /** Called with the answers when the person is ready to make their first video. */
  export let onDone: (answers: WelcomeAnswers) => void;
  /** Called when they would rather start on their own; nothing is saved. */
  export let onSkip: () => void;
  /** A prompt carried over from the landing page, which becomes the first video. */
  export let heldPrompt = "";

  let categories: string[] = [];
  let loaded = false;
  let picked = new Set<string>();
  let format: WelcomeAnswers["format"] = DEFAULT_FORMAT;
  let businessName = "";
  let step = 0;

  onMount(() => {
    void load();
  });

  async function load() {
    try {
      categories = categoriesOf(await fetchPromptTemplates()).map(
        (category) => category.name,
      );
    } catch {
      // Never block the first video on the category list: those questions are skipped.
    }
    loaded = true;
  }

  // With no categories to choose between, the interests question is left out.
  $: steps = [
    ...(categories.length > 0 ? (["interests"] as const) : []),
    "format",
    "name",
  ] as const;
  $: current = steps[Math.min(step, steps.length - 1)]!;
  $: last = step >= steps.length - 1;
  $: percent = Math.round(((step + 1) / steps.length) * 100);

  function toggle(name: string) {
    const next = new Set(picked);
    if (next.has(name)) next.delete(name);
    else if (next.size < MAX_INTERESTS) next.add(name);
    picked = next;
  }

  function next() {
    if (!last) {
      step += 1;
      return;
    }
    onDone({
      interests: [...picked],
      format,
      businessName: businessName.trim(),
    });
  }

  $: canContinue = current === "interests" ? picked.size > 0 : true;
</script>

<div class="wf" role="dialog" aria-modal="true" aria-labelledby="wf-title">
  <div class="wf__card">
    <div
      class="wf__progress"
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={loaded ? percent : 0}
    >
      <span style={`width: ${loaded ? percent : 0}%`}></span>
    </div>
    <p class="wf__count">
      {loaded
        ? `Step ${Math.min(step + 1, steps.length)} of ${steps.length}`
        : "One moment"}
    </p>

    {#if !loaded}
      <h2 id="wf-title">Getting things ready…</h2>
    {:else if current === "interests"}
      <h2 id="wf-title">What do you want to make?</h2>
      <p class="wf__sub">
        Pick up to {MAX_INTERESTS}. Your first video starts from this.
      </p>
      <div class="wf__chips" role="group" aria-label="Categories">
        {#each categories as name (name)}
          <button
            type="button"
            class="wf__chip"
            class:is-on={picked.has(name)}
            aria-pressed={picked.has(name)}
            disabled={!picked.has(name) && picked.size >= MAX_INTERESTS}
            on:click={() => toggle(name)}>{name}</button
          >
        {/each}
      </div>
    {:else if current === "format"}
      <h2 id="wf-title">Where will it be seen?</h2>
      <p class="wf__sub">We&rsquo;ll shape the video to fit.</p>
      <div class="wf__formats" role="radiogroup" aria-label="Format">
        {#each FORMAT_CHOICES as choice (choice.id)}
          <button
            type="button"
            role="radio"
            class="wf__format"
            class:is-on={format === choice.id}
            aria-checked={format === choice.id}
            on:click={() => (format = choice.id)}
          >
            <strong>{choice.label}</strong>
            <span>{choice.hint}</span>
          </button>
        {/each}
      </div>
    {:else}
      <h2 id="wf-title">What&rsquo;s it for?</h2>
      <p class="wf__sub">
        {heldPrompt
          ? "We'll use the idea you came with. Add your business name if you like."
          : "Your business or project name. You can skip this."}
      </p>
      <input
        class="wf__input"
        type="text"
        maxlength="80"
        placeholder="e.g. Kampot Pepper"
        aria-label="Business or project name"
        bind:value={businessName}
        on:keydown={(event) => event.key === "Enter" && next()}
      />
    {/if}

    {#if loaded}
      <div class="wf__actions">
        <button
          type="button"
          class="wf__primary"
          disabled={!canContinue}
          on:click={next}
        >
          {last ? "Make my first video" : "Continue"}
        </button>
        {#if step > 0}
          <button type="button" class="wf__ghost" on:click={() => (step -= 1)}
            >Back</button
          >
        {/if}
        <button type="button" class="wf__ghost wf__skip" on:click={onSkip}>
          Skip for now
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .wf {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 16px;
    overflow-y: auto;
    background: var(--sl-bg, #0b0b0f);
  }
  .wf__card {
    width: min(560px, 100%);
    padding: 28px;
    border: 1px solid var(--sl-border-strong, #2a2a33);
    border-radius: 16px;
    background: var(--sl-panel, #14141a);
    color: var(--sl-text, #f4f4f6);
  }
  .wf__progress {
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--sl-border-strong, #2a2a33);
  }
  .wf__progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--sl-brand-cobalt, #4f6bff);
    transition: width 0.3s ease;
  }
  .wf__count {
    margin: 10px 0 18px;
    color: var(--sl-muted, #9a9aa6);
    font-size: 12.5px;
  }
  h2 {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 600;
  }
  .wf__sub {
    margin: 0 0 18px;
    color: var(--sl-muted, #9a9aa6);
    font-size: 14px;
  }
  .wf__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 22px;
  }
  .wf__chip,
  .wf__format {
    border: 1px solid var(--sl-border-strong, #2a2a33);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
  }
  .wf__chip {
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 13.5px;
  }
  .wf__chip.is-on,
  .wf__format.is-on {
    border-color: var(--sl-brand-cobalt, #4f6bff);
    background: color-mix(
      in srgb,
      var(--sl-brand-cobalt, #4f6bff) 18%,
      transparent
    );
  }
  .wf__chip:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .wf__formats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 22px;
  }
  .wf__format {
    display: grid;
    gap: 2px;
    padding: 14px;
    border-radius: 12px;
    text-align: left;
  }
  .wf__format span {
    color: var(--sl-muted, #9a9aa6);
    font-size: 12.5px;
  }
  .wf__input {
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 22px;
    padding: 12px 14px;
    border: 1px solid var(--sl-border-strong, #2a2a33);
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  .wf__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .wf__primary {
    min-height: 42px;
    padding: 0 20px;
    border: 0;
    border-radius: 9px;
    background: var(--sl-brand-cobalt, #4f6bff);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .wf__primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .wf__ghost {
    min-height: 42px;
    padding: 0 12px;
    border: 0;
    background: transparent;
    color: var(--sl-muted, #9a9aa6);
    font-size: 13.5px;
    cursor: pointer;
  }
  .wf__skip {
    margin-left: auto;
  }
  :global(.code-editor-scope) .wf__primary:focus-visible,
  .wf__chip:focus-visible,
  .wf__format:focus-visible,
  .wf__ghost:focus-visible {
    outline: 2px solid var(--sl-accent-hover, #8fa0ff);
    outline-offset: 2px;
  }
</style>

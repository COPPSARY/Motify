<script lang="ts">
  import { onMount } from "svelte";
  import { fetchPromptTemplates } from "../api/prompt-templates";
  import { categoriesOf } from "./interests";

  /** The most categories a person can pick, so the list they land on stays short. */
  const MAX_PICKS = 3;

  /** Called with the picked categories; none when the templates could not be loaded. */
  export let onDone: (categories: string[]) => void;

  let categories: string[] = [];
  let picked = new Set<string>();
  let status: "loading" | "ready" | "error" = "loading";

  onMount(() => {
    void load();
  });

  async function load() {
    try {
      categories = categoriesOf(await fetchPromptTemplates()).map(
        (category) => category.name,
      );
      status = "ready";
      // Nothing to choose between, so go straight on.
      if (categories.length === 0) onDone([]);
    } catch {
      status = "error";
      // Never block onboarding on a picker.
      onDone([]);
    }
  }

  function toggle(name: string) {
    const next = new Set(picked);
    if (next.has(name)) next.delete(name);
    else if (next.size < MAX_PICKS) next.add(name);
    picked = next;
  }
</script>

<div class="ip" role="dialog" aria-modal="true" aria-labelledby="ip-title">
  <div class="ip__card">
    <h2 id="ip-title">What do you want to make?</h2>
    <p>Pick up to 3. We&rsquo;ll show matching templates.</p>

    {#if status === "ready"}
      <div class="bd-chips" role="group" aria-label="Categories">
        {#each categories as name (name)}
          <button
            type="button"
            class="bd-chip"
            class:is-on={picked.has(name)}
            aria-pressed={picked.has(name)}
            disabled={!picked.has(name) && picked.size >= MAX_PICKS}
            on:click={() => toggle(name)}>{name}</button
          >
        {/each}
      </div>
    {/if}

    <div class="ip__actions">
      <button
        type="button"
        class="bd-btn bd-btn--primary"
        disabled={status !== "ready" || picked.size === 0}
        on:click={() => onDone([...picked])}>Show templates</button
      >
    </div>
  </div>
</div>

<style>
  .ip {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 16px;
    background: var(--bd-bg);
    overflow-y: auto;
  }
  .ip__card {
    width: min(560px, 100%);
    padding: 28px;
    border: 1px solid var(--bd-border-strong);
    border-radius: 16px;
    background: var(--bd-surface);
    color: var(--bd-text);
  }
  .ip__card h2 {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 600;
  }
  .ip__card p {
    margin: 0 0 18px;
    color: var(--bd-soft);
    font-size: 14px;
  }
  .ip__card .bd-chips {
    margin-bottom: 22px;
  }
  .ip__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
</style>

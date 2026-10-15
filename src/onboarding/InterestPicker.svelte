<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowRight, Check } from "lucide-svelte";
  import { fetchPromptTemplates } from "../api/prompt-templates";
  import { categoriesOf, type CategoryCount } from "./interests";

  /** Called with the picked categories, or none to see every template. */
  export let onDone: (categories: string[]) => void;

  let categories: CategoryCount[] = [];
  let picked = new Set<string>();
  let status: "loading" | "ready" | "error" = "loading";

  onMount(() => {
    void load();
  });

  async function load() {
    try {
      categories = categoriesOf(await fetchPromptTemplates());
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
    else next.add(name);
    picked = next;
  }
</script>

<div class="ip" role="dialog" aria-modal="true" aria-labelledby="ip-title">
  <div class="ip__card">
    <small>Step 2 of 4</small>
    <h2 id="ip-title">What do you want to make?</h2>
    <p>
      Pick a few and we&rsquo;ll show templates that fit, instead of all of
      them. You can change this any time.
    </p>

    {#if status === "loading"}
      <p class="ip__state" role="status">Loading&hellip;</p>
    {:else}
      <div class="ip__chips" role="group" aria-label="Template categories">
        {#each categories as category (category.name)}
          <button
            type="button"
            class="ip__chip"
            class:is-on={picked.has(category.name)}
            aria-pressed={picked.has(category.name)}
            on:click={() => toggle(category.name)}
          >
            {#if picked.has(category.name)}<Check size={13} />{/if}
            {category.name}
            <em>{category.count}</em>
          </button>
        {/each}
      </div>
    {/if}

    <div class="ip__actions">
      <button
        type="button"
        class="ip__primary"
        disabled={status !== "ready" || picked.size === 0}
        on:click={() => onDone([...picked])}
      >
        Show these templates <ArrowRight size={15} />
      </button>
      <button type="button" class="ip__link" on:click={() => onDone([])}
        >Show me everything</button
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
    background: var(--bd-bg, #0c0c0e);
    overflow-y: auto;
  }
  .ip__card {
    width: min(560px, 100%);
    padding: 28px;
    border: 1px solid var(--bd-border-strong, rgba(255, 255, 255, 0.14));
    border-radius: 16px;
    background: var(--bd-surface, #151518);
    color: var(--bd-text, #f3f3f5);
  }
  .ip__card small {
    color: var(--bd-muted, #85858f);
    font-size: 12px;
  }
  .ip__card h2 {
    margin: 6px 0 8px;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .ip__card p {
    margin: 0 0 18px;
    color: var(--bd-soft, #c9c9d1);
    font-size: 14px;
    line-height: 1.5;
  }
  .ip__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 22px;
  }
  .ip__chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--bd-border-strong, rgba(255, 255, 255, 0.14));
    border-radius: 999px;
    background: none;
    color: var(--bd-soft, #c9c9d1);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .ip__chip em {
    color: var(--bd-faint, #585862);
    font-size: 11px;
    font-style: normal;
  }
  .ip__chip:hover {
    color: var(--bd-text, #f3f3f5);
  }
  .ip__chip.is-on {
    border-color: transparent;
    background: var(--bd-text, #f3f3f5);
    color: var(--bd-accent-ink, #111113);
  }
  .ip__chip.is-on em {
    color: inherit;
    opacity: 0.6;
  }
  .ip__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
  }
  .ip__primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border: 0;
    border-radius: 9px;
    background: var(--bd-text, #f3f3f5);
    color: var(--bd-accent-ink, #111113);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .ip__primary:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .ip__link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--bd-muted, #85858f);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .ip__link:hover {
    color: var(--bd-text, #f3f3f5);
  }
</style>

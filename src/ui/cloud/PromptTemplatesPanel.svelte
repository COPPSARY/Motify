<script lang="ts">
  import { onMount } from "svelte";
  import { Check, Copy, Info, SendHorizontal } from "lucide-svelte";
  import {
    fetchPromptTemplates,
    renderPrompt,
    type PromptTemplate,
  } from "../../api/prompt-templates";
  import { categoriesOf } from "../../onboarding/interests";

  /** Puts a prompt in Tiffy's composer on the create page. */
  export let onUse: (prompt: string) => void;
  export let onNotice: (message: string) => void;
  /** Categories to start filtered to, such as the ones a new account picked. */
  export let initialCategories: string[] = [];

  const COPY_HINT =
    "Copy this prompt, then change it to fit your own idea and attach references (a logo, a screenshot, a song) in Tiffy for a better result.";
  const COPY_TOOLTIP =
    "Copy it, tweak it to your idea, and add references for a better result.";

  let templates: PromptTemplate[] = [];
  let status: "loading" | "ready" | "error" = "loading";
  let selectedSlug = "";
  let values: Record<string, string> = {};
  /** The prompt as edited by hand; null until they type in it, and reset when a field changes. */
  let manualPrompt: string | null = null;
  let copied = false;
  /** Templates in any of these categories show; none means all of them. */
  let activeCategories = new Set<string>(initialCategories);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  $: categories = categoriesOf(templates);
  $: filter = realCategories(activeCategories, categories);
  $: visible = withCategories(templates, filter);
  $: selected = templates.find((item) => item.slug === selectedSlug) ?? null;
  $: rendered = selected ? renderPrompt(selected, values) : "";
  $: prompt = manualPrompt ?? rendered;

  onMount(() => {
    void load();
    return () => clearTimeout(copiedTimer);
  });

  /** A saved pick that no template uses would hide everything, so only real categories count. */
  function realCategories(
    wanted: ReadonlySet<string>,
    known: readonly { name: string }[],
  ): string[] {
    return [...wanted].filter((name) =>
      known.some((item) => item.name === name),
    );
  }

  function withCategories(
    all: readonly PromptTemplate[],
    names: readonly string[],
  ): PromptTemplate[] {
    return names.length === 0
      ? [...all]
      : all.filter((item) =>
          item.categories.some((name) => names.includes(name)),
        );
  }

  /** The open template always belongs to the list on screen, so Copy is never about a hidden one. */
  function keepSelectionVisible() {
    const shown = withCategories(
      templates,
      realCategories(activeCategories, categoriesOf(templates)),
    );
    const first = shown[0];
    if (first && !shown.some((item) => item.slug === selectedSlug))
      select(first);
  }

  async function load() {
    status = "loading";
    try {
      templates = await fetchPromptTemplates();
      status = "ready";
      keepSelectionVisible();
    } catch {
      status = "error";
    }
  }

  function toggleCategory(name: string) {
    const next = new Set(activeCategories);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setCategories(next);
  }

  function setCategories(next: Set<string>) {
    activeCategories = next;
    keepSelectionVisible();
  }

  function select(template: PromptTemplate) {
    selectedSlug = template.slug;
    values = {};
    manualPrompt = null;
    copied = false;
  }

  function setField(key: string, value: string) {
    values = { ...values, [key]: value };
    manualPrompt = null;
  }

  async function copy() {
    if (!prompt.trim()) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const area = document.createElement("textarea");
      area.value = prompt;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) {
        onNotice("Could not copy. Select the prompt and copy it by hand.");
        return;
      }
    }
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 2200);
  }
</script>

{#if status === "loading"}
  <p class="pt-state" role="status">Loading templates…</p>
{:else if status === "error"}
  <div class="pt-state" role="alert">
    <p>Templates could not be loaded.</p>
    <button type="button" class="pt-btn" on:click={load}>Try again</button>
  </div>
{:else}
  <div class="pt-filter" role="group" aria-label="Filter by category">
    <button
      type="button"
      class="pt-chip"
      class:is-on={filter.length === 0}
      aria-pressed={filter.length === 0}
      on:click={() => setCategories(new Set())}>All</button
    >
    {#each categories as category (category.name)}
      <button
        type="button"
        class="pt-chip"
        class:is-on={filter.includes(category.name)}
        aria-pressed={filter.includes(category.name)}
        on:click={() => toggleCategory(category.name)}>{category.name}</button
      >
    {/each}
  </div>
  <div class="pt">
    <ul class="pt-grid" aria-label="Prompt templates" data-tour="prompts-grid">
      {#each visible as template (template.slug)}
        <li>
          <button
            type="button"
            class="pt-card"
            class:is-selected={template.slug === selectedSlug}
            aria-pressed={template.slug === selectedSlug}
            on:click={() => select(template)}
          >
            <span class="pt-card__media" data-aspect={template.aspectRatio}>
              {#if template.video}
                <video
                  src={template.video}
                  muted
                  loop
                  playsinline
                  preload="metadata"
                  aria-hidden="true"
                  on:mouseenter={(event) => void event.currentTarget.play()}
                  on:mouseleave={(event) => event.currentTarget.pause()}
                ></video>
              {/if}
            </span>
            <span class="pt-card__meta">
              <small>{template.eyebrow}</small>
              <strong>{template.title}</strong>
            </span>
          </button>
        </li>
      {/each}
    </ul>

    {#if selected}
      <section class="pt-detail" aria-labelledby="pt-detail-title">
        <header>
          <small>{selected.eyebrow} · {selected.aspectRatio}</small>
          <h2 id="pt-detail-title">{selected.title}</h2>
          <p>{selected.description}</p>
        </header>

        <div class="pt-fields">
          {#each selected.fields as field (field.key)}
            <label class="pt-field">
              <span>{field.label}</span>
              {#if field.type === "textarea"}
                <textarea
                  rows="3"
                  placeholder={field.placeholder}
                  value={values[field.key] ?? field.defaultValue}
                  on:input={(event) =>
                    setField(field.key, event.currentTarget.value)}
                ></textarea>
              {:else}
                <input
                  type={field.type}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? field.defaultValue}
                  on:input={(event) =>
                    setField(field.key, event.currentTarget.value)}
                />
              {/if}
              <small>{field.description}</small>
            </label>
          {/each}
        </div>

        <label class="pt-field">
          <span>Prompt</span>
          <textarea
            class="pt-prompt"
            rows="9"
            value={prompt}
            on:input={(event) => (manualPrompt = event.currentTarget.value)}
          ></textarea>
        </label>

        <p class="pt-hint"><Info size={14} /> {COPY_HINT}</p>
        <div class="pt-actions">
          <button
            type="button"
            class="pt-btn pt-btn--primary"
            data-tour="prompts-copy"
            data-tooltip={COPY_TOOLTIP}
            on:click={copy}
          >
            {#if copied}<Check size={15} /> Copied{:else}<Copy size={15} /> Copy prompt{/if}
          </button>
          <button
            type="button"
            class="pt-btn"
            on:click={() => onUse(prompt)}
            disabled={!prompt.trim()}
          >
            <SendHorizontal size={15} /> Use in Tiffy
          </button>
        </div>
      </section>
    {/if}
  </div>
{/if}

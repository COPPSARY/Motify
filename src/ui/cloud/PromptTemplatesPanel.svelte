<script lang="ts">
  import { onMount } from "svelte";
  import { Check, Copy, SendHorizontal } from "lucide-svelte";
  import {
    fetchPromptTemplates,
    renderPrompt,
    type PromptTemplate,
  } from "../../api/prompt-templates";
  import { categoriesOf } from "../../onboarding/interests";
  import { lazyVideo } from "./lazy-video";
  import {
    cachedPromptTemplates,
    rememberPromptTemplates,
  } from "./prompt-template-cache";

  /** Puts a prompt in Tiffy's composer on the create page. */
  export let onUse: (prompt: string, assets: File[]) => void;
  export let onNotice: (message: string) => void;
  /** Categories a new account picked; with just one, the page opens filtered to it. */
  export let initialCategories: string[] = [];

  const COPY_TOOLTIP =
    "Copy it, edit it to fit your idea, and add references for better results.";

  let templates: PromptTemplate[] = [];
  let status: "loading" | "ready" | "error" = "loading";
  let selectedSlug = "";
  let values: Record<string, string> = {};
  /** The prompt as edited by hand; null until they type in it, and reset when a field changes. */
  let manualPrompt: string | null = null;
  let copied = false;
  /** Their own images, video or audio; they go to Tiffy with the prompt, not with Copy. */
  let assets: File[] = [];
  /** They looked at the example and want it as it is. */
  let keepExample = false;
  /** After a copy, what to do next; it stays until another template is opened. */
  let copyNote = false;
  /** Only templates in this category show; null means all of them. */
  let activeCategory: string | null =
    initialCategories.length === 1 ? (initialCategories[0] ?? null) : null;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  $: categories = categoriesOf(templates);
  $: filter = realCategory(activeCategory, categories);
  $: visible = inCategory(templates, filter);
  $: selected = templates.find((item) => item.slug === selectedSlug) ?? null;
  $: rendered = selected ? renderPrompt(selected, values) : "";
  $: prompt = manualPrompt ?? rendered;
  $: isSample = selected ? stillSample(selected, values, manualPrompt) : false;
  /** Copy and Use stay off while the template still holds its example, unless they chose to keep it. */
  $: blocked = isSample && !keepExample;

  onMount(() => {
    void load();
    return () => clearTimeout(copiedTimer);
  });

  /** A saved pick that no template uses would hide everything, so only a real category counts. */
  function realCategory(
    wanted: string | null,
    known: readonly { name: string }[],
  ): string | null {
    return known.some((item) => item.name === wanted) ? wanted : null;
  }

  function inCategory(
    all: readonly PromptTemplate[],
    name: string | null,
  ): PromptTemplate[] {
    return name === null
      ? [...all]
      : all.filter((item) => item.categories.includes(name));
  }

  /** "9:16" as a CSS aspect-ratio, so each preview keeps its video's shape. */
  function cssRatio(ratio: PromptTemplate["aspectRatio"]): string {
    return ratio.replace(":", " / ");
  }

  /** The open template always belongs to the list on screen, so Copy is never about a hidden one. */
  function keepSelectionVisible() {
    const shown = inCategory(
      templates,
      realCategory(activeCategory, categoriesOf(templates)),
    );
    const first = shown[0];
    if (first && !shown.some((item) => item.slug === selectedSlug))
      select(first);
  }

  async function load() {
    // Show the cached list at once and refresh it behind it; only a first load shows "Loading…".
    const cached = cachedPromptTemplates();
    if (cached) show(cached);
    else status = "loading";
    try {
      const fresh = await fetchPromptTemplates();
      rememberPromptTemplates(fresh);
      show(fresh);
    } catch {
      if (!cached) status = "error";
    }
  }

  function show(list: PromptTemplate[]) {
    templates = list;
    status = "ready";
    keepSelectionVisible();
  }

  function setCategory(name: string | null) {
    activeCategory = name;
    keepSelectionVisible();
  }

  function select(template: PromptTemplate) {
    selectedSlug = template.slug;
    values = {};
    manualPrompt = null;
    keepExample = false;
    copied = false;
    copyNote = false;
  }

  function setField(key: string, value: string) {
    values = { ...values, [key]: value };
    manualPrompt = null;
  }

  /**
   * The fields open on the template's own example (its product, its story), so
   * a prompt nobody has touched describes someone else's film. A template with
   * no text to change has nothing to personalise and is never a sample.
   */
  function stillSample(
    template: PromptTemplate,
    typed: Readonly<Record<string, string>>,
    edited: string | null,
  ): boolean {
    if (edited !== null) return false;
    const personal = template.fields.filter((field) => field.type !== "number");
    return (
      personal.length > 0 &&
      personal.every((field) => !typed[field.key]?.trim())
    );
  }

  function addAssets(event: Event & { currentTarget: HTMLInputElement }) {
    const picked = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = "";
    assets = [
      ...assets,
      ...picked.filter(
        (file) =>
          !assets.some(
            (held) =>
              held.name === file.name &&
              held.size === file.size &&
              held.lastModified === file.lastModified,
          ),
      ),
    ];
  }

  function useInTiffy() {
    onUse(prompt, assets);
    assets = [];
  }

  async function copy() {
    if (!prompt.trim() || blocked) return;
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
    copyNote = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 2200);
  }
</script>

{#if status === "loading"}
  <p class="pt-state" role="status">Loading…</p>
{:else if status === "error"}
  <div class="pt-state" role="alert">
    <p>Templates could not be loaded.</p>
    <button type="button" class="pt-btn" on:click={load}>Try again</button>
  </div>
{:else}
  <div class="me-chip-row" role="group" aria-label="Categories">
    <button
      type="button"
      class="me-chip"
      class:me-active={filter === null}
      aria-pressed={filter === null}
      on:click={() => setCategory(null)}>All</button
    >
    {#each categories as category (category.name)}
      <button
        type="button"
        class="me-chip"
        class:me-active={filter === category.name}
        aria-pressed={filter === category.name}
        on:click={() => setCategory(category.name)}>{category.name}</button
      >
    {/each}
  </div>
  <div class="pt">
    <ul class="pt-grid" aria-label="Prompt templates" data-tour="prompts-grid">
      {#each visible as template (template.slug)}
        <li>
          <button
            type="button"
            class="me-template-card pt-card"
            class:is-selected={template.slug === selectedSlug}
            aria-pressed={template.slug === selectedSlug}
            on:click={() => select(template)}
          >
            <span
              class="pt-media"
              style:aspect-ratio={cssRatio(template.aspectRatio)}
            >
              <span class="pt-ratio">{template.aspectRatio}</span>
              {#if template.video}
                <video
                  use:lazyVideo={template.video}
                  muted
                  loop
                  playsinline
                  preload="none"
                  aria-hidden="true"
                ></video>
              {/if}
            </span>
            <span class="me-template-meta"
              ><strong>{template.title}</strong></span
            >
          </button>
        </li>
      {/each}
    </ul>

    {#if selected}
      <section class="pt-detail" aria-labelledby="pt-detail-title">
        <h2 id="pt-detail-title">{selected.title}</h2>

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
            </label>
          {/each}
        </div>

        <div class="pt-field pt-assets">
          <span>Your assets</span>
          <input
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            aria-label="Add your own images, video or audio"
            on:change={addAssets}
          />
          <small
            >Logos, product photos or screenshots. They go to Tiffy with "Use in
            Tiffy", not with Copy.</small
          >
          {#if assets.length > 0}
            <ul class="pt-asset-list">
              {#each assets as file (file.name + file.size + file.lastModified)}
                <li>
                  {file.name}
                  <button
                    type="button"
                    class="pt-link"
                    aria-label={`Remove ${file.name}`}
                    on:click={() =>
                      (assets = assets.filter((held) => held !== file))}
                    >Remove</button
                  >
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        {#if blocked}
          <p class="pt-note pt-sample" role="status">
            These fields hold the template's example. Replace them with your own
            product and idea first, or keep the example as it is.

            <button
              type="button"
              class="pt-link"
              on:click={() => (keepExample = true)}>Keep the example</button
            >
          </p>
        {/if}

        <label class="pt-field">
          <span>Prompt</span>
          <textarea
            class="pt-prompt"
            rows="9"
            value={prompt}
            on:input={(event) => (manualPrompt = event.currentTarget.value)}
          ></textarea>
        </label>

        <div class="pt-actions">
          <button
            type="button"
            class="pt-btn pt-btn--primary"
            data-tour="prompts-copy"
            disabled={blocked}
            data-tooltip={COPY_TOOLTIP}
            on:click={copy}
          >
            {#if copied}<Check size={15} /> Copied{:else}<Copy size={15} /> Copy prompt{/if}
          </button>
          <button
            type="button"
            class="pt-btn"
            on:click={useInTiffy}
            disabled={!prompt.trim() || blocked}
          >
            <SendHorizontal size={15} /> Use in Tiffy
          </button>
        </div>
        {#if copyNote}
          <p class="pt-note" role="status">
            Edit it for your own product, and add references in Tiffy for better
            results.
          </p>
        {/if}
      </section>
    {/if}
  </div>
{/if}

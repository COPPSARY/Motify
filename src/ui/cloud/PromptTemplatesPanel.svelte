<script lang="ts">
  import { onMount } from "svelte";
  import {
    ArrowLeft,
    Check,
    Copy,
    ImagePlus,
    RotateCcw,
    SendHorizontal,
    X,
  } from "lucide-svelte";
  import {
    fetchPromptTemplates,
    fieldValue,
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

  let templates: PromptTemplate[] = [];
  let status: "loading" | "ready" | "error" = "loading";
  let selectedSlug = "";
  let values: Record<string, string> = {};
  let copied = false;
  /** Their own images, video or audio; they go to Tiffy with the prompt, not with Copy. */
  let assets: File[] = [];
  /** They looked at the example and want it as it is. */
  let keepExample = false;
  /** A drag is over the assets box. */
  let dragging = false;
  /** Only templates in this category show; null means all of them. */
  let activeCategory: string | null =
    initialCategories.length === 1 ? (initialCategories[0] ?? null) : null;
  /** Settings about how it looks and runs, rather than what it says; they sit folded away. */
  const LOOK_KEYS = new Set([
    "colors",
    "color",
    "typography",
    "style",
    "length",
    "tempo",
    "format",
  ]);

  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  $: categories = categoriesOf(templates);
  $: filter = realCategory(activeCategory, categories);
  $: visible = inCategory(templates, filter);
  $: selected = templates.find((item) => item.slug === selectedSlug) ?? null;
  $: rendered = selected ? renderPrompt(selected, values) : "";
  $: prompt = rendered;
  $: contentFields = selected
    ? selected.fields.filter((item) => !LOOK_KEYS.has(item.key))
    : [];
  $: lookFields = selected
    ? selected.fields.filter((item) => LOOK_KEYS.has(item.key))
    : [];
  $: isSample = selected ? stillSample(selected, values) : false;
  /** The field that says what the film is about; it is the one to change first. */
  $: subjectKey = selected ? subjectOf(selected)?.key : undefined;
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
    // A template that is no longer in the list takes its page with it.
    if (selectedSlug && !list.some((item) => item.slug === selectedSlug))
      close();
  }

  function setCategory(name: string | null) {
    activeCategory = name;
  }

  function select(template: PromptTemplate) {
    selectedSlug = template.slug;
    values = {};
    keepExample = false;
    copied = false;
    assets = [];
  }

  /** Back to the grid; what they typed is not kept for the next template. */
  function close() {
    selectedSlug = "";
    values = {};
    assets = [];
    keepExample = false;
    copied = false;
  }

  function setField(key: string, value: string) {
    values = { ...values, [key]: value };
  }

  /** Whether the person has put their own words in this field, rather than leaving the template's example. */
  function isCustomized(
    field: PromptTemplate["fields"][number],
    typed: Readonly<Record<string, string>>,
  ): boolean {
    const value = typed[field.key]?.trim();
    return Boolean(value) && value !== field.defaultValue;
  }

  /**
   * The fields open on the template's own example, so a prompt nobody has made
   * theirs describes someone else's film. A template's first field is what the
   * film is about (its product, concept or script), so until that one is
   * changed it is still the example; fonts, colours or length alone don't make
   * it theirs. A template with no text to change is never a sample.
   */
  /** The field that says what the film is about: the first one that is not about how it looks or runs. */
  function subjectOf(
    template: PromptTemplate,
  ): PromptTemplate["fields"][number] | undefined {
    const words = template.fields.filter((item) => item.type !== "number");
    return words.find((item) => !LOOK_KEYS.has(item.key)) ?? words[0];
  }

  function stillSample(
    template: PromptTemplate,
    typed: Readonly<Record<string, string>>,
  ): boolean {
    const subject = subjectOf(template);
    return subject !== undefined && !isCustomized(subject, typed);
  }

  /** One piece of the live preview: the template's own words, or what a field now holds. */
  function segmentText(
    template: PromptTemplate,
    segment: PromptTemplate["prompt"][number],
    typed: Readonly<Record<string, string>>,
  ): string {
    if ("text" in segment) return segment.text;
    const field = template.fields.find((item) => item.key === segment.field);
    if (!field) return "";
    return `${segment.before ?? ""}${fieldValue(field, typed)}${segment.after ?? ""}`;
  }

  function segmentField(
    template: PromptTemplate,
    segment: PromptTemplate["prompt"][number],
  ) {
    return "field" in segment
      ? template.fields.find((item) => item.key === segment.field)
      : undefined;
  }

  function reset() {
    values = {};
    keepExample = false;
    copied = false;
  }

  function addFiles(picked: File[]) {
    const wanted = picked.filter((file) =>
      /^(image|video|audio)\//.test(file.type),
    );
    if (wanted.length < picked.length)
      onNotice("Only images, video and audio can be added.");
    assets = [
      ...assets,
      ...wanted.filter(
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

  function pickAssets(event: Event & { currentTarget: HTMLInputElement }) {
    addFiles([...(event.currentTarget.files ?? [])]);
    event.currentTarget.value = "";
  }

  function dropAssets(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    addFiles([...(event.dataTransfer?.files ?? [])]);
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
{:else if selected}
  <section class="ptd" aria-labelledby="ptd-title">
    <button type="button" class="ptd-back" on:click={close}>
      <ArrowLeft size={15} /> All templates
    </button>

    <div class="ptd-layout">
      <div
        class="ptd-media"
        style:aspect-ratio={cssRatio(selected.aspectRatio)}
      >
        <span class="pt-ratio">{selected.aspectRatio}</span>
        {#if selected.video}
          <video
            use:lazyVideo={selected.video}
            muted
            loop
            playsinline
            preload="none"
            aria-hidden="true"
          ></video>
        {/if}
      </div>

      <div class="ptd-form">
        <h2 id="ptd-title">{selected.title}</h2>
        {#if selected.special}
          <p class="ptd-sub">
            Run this in your coding agent with your codebase open, then paste
            the <code>&lt;direction&gt;</code> and
            <code>&lt;structure&gt;</code> it returns into Motify.
          </p>
        {/if}

        <div class="ptd-fields">
          {#each contentFields as field (field.key)}
            <label
              class="ptd-field"
              class:is-start={blocked && field.key === subjectKey}
            >
              <span class="ptd-label">{field.label}</span>
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
              <small class="ptd-hint"
                >{field.description}{#if field.min !== undefined && field.max !== undefined}
                  ({field.min}–{field.max}){/if}</small
              >
            </label>
          {/each}
        </div>

        {#if lookFields.length > 0}
          <details class="ptd-look">
            <summary>Look and timing</summary>
            <div class="ptd-fields">
              {#each lookFields as field (field.key)}
                <label
                  class="ptd-field"
                  class:is-start={blocked && field.key === subjectKey}
                >
                  <span class="ptd-label">{field.label}</span>
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
                  <small class="ptd-hint"
                    >{field.description}{#if field.min !== undefined && field.max !== undefined}
                      ({field.min}–{field.max}){/if}</small
                  >
                </label>
              {/each}
            </div>
          </details>
        {/if}

        {#if !selected.special}
          <div class="ptd-assets">
            <label
              class="ptd-drop"
              class:is-over={dragging}
              on:dragover|preventDefault={() => (dragging = true)}
              on:dragleave={() => (dragging = false)}
              on:drop={dropAssets}
            >
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                on:change={pickAssets}
              />
              <ImagePlus size={18} />
              <span
                ><strong>Add your own images</strong>
                <em>logo, photos, screenshots</em></span
              >
            </label>
            {#if assets.length > 0}
              <ul class="ptd-files">
                {#each assets as file (file.name + file.size + file.lastModified)}
                  <li>
                    <span>{file.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      on:click={() =>
                        (assets = assets.filter((held) => held !== file))}
                      ><X size={13} /></button
                    >
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}

        {#if blocked}
          <p class="ptd-sample" role="status">
            Replace the highlighted field with your own idea, or
            <button
              type="button"
              class="pt-link"
              on:click={() => (keepExample = true)}>keep the example</button
            >.
          </p>
        {/if}

        <div class="ptd-actions">
          {#if !selected.special}
            <button
              type="button"
              class="pt-btn pt-btn--primary ptd-use"
              on:click={useInTiffy}
              disabled={!prompt.trim() || blocked}
            >
              <SendHorizontal size={15} /> Use in Tiffy
            </button>
          {/if}
          <button
            type="button"
            class="pt-btn ptd-copy"
            class:pt-btn--primary={selected.special}
            on:click={copy}
            disabled={blocked}
          >
            {#if copied}<Check size={15} /> Copied{:else}<Copy size={15} />
              {selected.special ? "Copy agent prompt" : "Copy prompt"}{/if}
          </button>
          <button type="button" class="pt-link ptd-reset" on:click={reset}>
            <RotateCcw size={13} /> Reset
          </button>
        </div>

        <details class="ptd-prompt">
          <summary>See the full prompt</summary>
          <div class="pt-preview" aria-label="Prompt preview">
            {#each selected.prompt as segment}
              {@const field = segmentField(selected, segment)}
              {#if field}
                <mark class:is-changed={isCustomized(field, values)}
                  >{segmentText(selected, segment, values)}</mark
                >
              {:else}
                <span>{segmentText(selected, segment, values)}</span>
              {/if}
            {/each}
          </div>
        </details>
      </div>
    </div>
  </section>
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
  <ul class="pt-grid" aria-label="Prompt templates" data-tour="prompts-grid">
    {#each visible as template (template.slug)}
      <li>
        <button
          type="button"
          class="me-template-card pt-card"
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
          <span class="me-template-meta"><strong>{template.title}</strong></span
          >
        </button>
      </li>
    {/each}
  </ul>
{/if}

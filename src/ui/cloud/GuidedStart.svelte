<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import {
    ArrowLeft,
    ArrowRight,
    ImagePlus,
    LayoutList,
    Sparkles,
    X,
  } from "lucide-svelte";
  import { loadAssetObjectUrl } from "../../api/assets";
  import { formatCredits } from "../../api/credits";
  import {
    fetchPromptTemplates,
    type PromptTemplate,
  } from "../../api/prompt-templates";
  import type { Storyboard } from "../../cloud/projects-api";
  import type { CanvasAspect } from "../../composition/canvas-frame";
  import {
    ASPECT_OPTIONS,
    clampSeconds,
    estimateToolCredits,
    GUIDED_TOOLS,
    guideMessage,
    LANGUAGE_OPTIONS,
    LENGTH_PRESETS,
    MAX_SECONDS,
    MIN_SECONDS,
    missingInput,
    STORYBOARD_CREDITS,
    toolVideo,
    type GuidedLanguage,
    type GuidedTool,
    type GuideResult,
    type ImageSlot,
  } from "../../onboarding/guided-tools";
  import { creditEstimate } from "../../stores/credits";
  import type { AssetIntent } from "../../stores/local-assets";
  import {
    cachedPromptTemplates,
    rememberPromptTemplates,
  } from "./prompt-template-cache";
  import GuidedStoryboard from "./GuidedStoryboard.svelte";

  /** True while a tool's form is on screen; the page hides its composer then. */
  export let open = false;
  /** A generation is running, so nothing new can be started. */
  export let disabled = false;
  /** The selected Brand DNA: it says what the film is about and brings its logo. */
  export let brand: { name: string; logoAssetId: string | null } | null = null;
  /** Sends the request; false keeps the form open (signing in, say). */
  export let onGenerate: (result: GuideResult) => Promise<boolean>;
  export let onPick: (tool: GuidedTool) => void = () => undefined;
  /** Opens the full Prompt Templates page; without it the link is not shown. */
  export let onExplore: (() => void) | null = null;
  /**
   * Plans the storyboard for these choices, uploading the pictures, and says
   * which upload each picture became; null when it could not (signing in, say).
   * Without it there is no preview.
   */
  export let onStoryboard:
    | ((result: GuideResult) => Promise<{
        storyboard: Storyboard;
        uploads: ReadonlyMap<File, string>;
      } | null>)
    | null = null;

  interface Picked {
    file: File;
    url: string;
  }

  let templates: PromptTemplate[] = [];
  let tool: GuidedTool | null = null;
  let images: Record<AssetIntent, Picked[]> = { reference: [], asset: [] };
  /** Kept apart from the pictures, so the model is told which one is the logo. */
  let logo: Picked | null = null;
  let logoInput: HTMLInputElement;
  let aspect: CanvasAspect = "16:9";
  let seconds = 15;
  let customSeconds = "";
  let customLength = false;
  let language: GuidedLanguage = "en";
  let instructions = "";
  let triedGenerate = false;
  let sending = false;
  let brandLogoUrl: string | null = null;
  let brandLogoFor: string | null = null;
  let heading: HTMLHeadingElement | undefined;
  const inputs: Partial<Record<AssetIntent, HTMLInputElement>> = {};
  /**
   * The last storyboard and the choices it was planned for. Reopening it with
   * the same choices costs nothing; changing any of them plans a new one.
   */
  let board: {
    key: string;
    storyboard: Storyboard;
    uploads: ReadonlyMap<File, string>;
  } | null = null;
  let showBoard = false;
  let planning = false;

  $: open = tool !== null;
  $: lengthValue = customLength
    ? clampSeconds(Number.parseFloat(customSeconds))
    : seconds;
  $: price = estimateToolCredits(lengthValue ?? seconds, $creditEstimate);
  $: missing = tool
    ? missingInput(tool, {
        instructions,
        images: images.reference.length + images.asset.length + (logo ? 1 : 0),
        hasBrand: brand !== null,
      })
    : null;
  $: slots = tool ? slotsOf(tool) : [];
  $: boardPictures = board ? picturesOf(board.uploads) : new Map();
  $: void showBrandLogo(brand?.logoAssetId ?? null);

  onMount(() => {
    const cached = cachedPromptTemplates();
    if (cached) templates = cached;
    fetchPromptTemplates()
      .then((fresh) => {
        rememberPromptTemplates(fresh);
        templates = fresh;
      })
      .catch(() => {
        // Without templates the tools still work; they just show no demo.
      });
  });

  onDestroy(() => {
    clearImages();
    if (brandLogoUrl) URL.revokeObjectURL(brandLogoUrl);
  });

  function slotsOf(
    current: GuidedTool,
  ): { intent: AssetIntent; slot: ImageSlot }[] {
    const reference = { intent: "reference" as const, slot: current.reference };
    if (!current.placed) return [reference];
    const placed = { intent: "asset" as const, slot: current.placed };
    return current.lead === "asset" ? [placed, reference] : [reference, placed];
  }

  async function showBrandLogo(assetId: string | null) {
    if (assetId === brandLogoFor) return;
    brandLogoFor = assetId;
    if (brandLogoUrl) URL.revokeObjectURL(brandLogoUrl);
    brandLogoUrl = null;
    if (!assetId) return;
    try {
      const url = await loadAssetObjectUrl(assetId);
      if (brandLogoFor === assetId) brandLogoUrl = url;
      else URL.revokeObjectURL(url);
    } catch {
      // The Brand Kit logo is still used; only its thumbnail is missing.
    }
  }

  /** The demo videos play from the start, whatever the motion setting: they show what each tool makes. */
  function markReady(event: Event) {
    (event.currentTarget as HTMLVideoElement).dataset["ready"] = "true";
  }

  async function pick(next: GuidedTool) {
    tool = next;
    clearImages();
    board = null;
    showBoard = false;
    aspect = next.aspect;
    seconds = 15;
    customLength = false;
    customSeconds = "";
    language = "en";
    instructions = "";
    triedGenerate = false;
    onPick(next);
    await tick();
    heading?.focus();
  }

  function back() {
    tool = null;
    clearImages();
    board = null;
    showBoard = false;
  }

  function clearImages() {
    for (const image of [...images.reference, ...images.asset]) {
      URL.revokeObjectURL(image.url);
    }
    images = { reference: [], asset: [] };
    if (logo) URL.revokeObjectURL(logo.url);
    logo = null;
  }

  function setLogo(files: readonly File[]) {
    const file = files.find((item) => item.type.startsWith("image/"));
    if (!file) return;
    if (logo) URL.revokeObjectURL(logo.url);
    logo = { file, url: URL.createObjectURL(file) };
  }

  function removeLogo() {
    if (logo) URL.revokeObjectURL(logo.url);
    logo = null;
  }

  function onLogoFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    setLogo(Array.from(input.files ?? []));
    input.value = "";
  }

  function onLogoDrop(event: DragEvent) {
    event.preventDefault();
    setLogo(Array.from(event.dataTransfer?.files ?? []));
  }

  function addImages(intent: AssetIntent, max: number, files: readonly File[]) {
    const room = max - images[intent].length;
    const accepted = files
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, room));
    images = {
      ...images,
      [intent]: [
        ...images[intent],
        ...accepted.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ],
    };
  }

  function removeImage(intent: AssetIntent, index: number) {
    const list = [...images[intent]];
    const [removed] = list.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.url);
    images = { ...images, [intent]: list };
  }

  function onFiles(intent: AssetIntent, max: number, event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    addImages(intent, max, Array.from(input.files ?? []));
    input.value = "";
  }

  function onDrop(intent: AssetIntent, max: number, event: DragEvent) {
    event.preventDefault();
    addImages(intent, max, Array.from(event.dataTransfer?.files ?? []));
  }

  function setPresetLength(value: number) {
    customLength = false;
    seconds = value;
  }

  async function setCustomLength() {
    customLength = true;
    customSeconds ||= String(seconds);
    await tick();
    document.getElementById("guide-seconds")?.focus();
  }

  /** The form as a request, or null (with the problem shown) when it is not ready. */
  function readForm(): GuideResult | null {
    if (!tool) return null;
    triedGenerate = true;
    // Read fresh, not from the reactive values: an answer typed this tick is not in them yet.
    const length = customLength
      ? clampSeconds(Number.parseFloat(customSeconds))
      : seconds;
    if (length === null) {
      document.getElementById("guide-seconds")?.focus();
      return null;
    }
    const gap = missingInput(tool, {
      instructions,
      images: images.reference.length + images.asset.length + (logo ? 1 : 0),
      hasBrand: brand !== null,
    });
    if (gap) return null;
    return {
      tool: { id: tool.id, seconds: length, language, look: tool.look },
      message: guideMessage(tool, {
        aspect,
        seconds: length,
        language,
        instructions,
      }),
      aspect,
      files: [
        ...images.reference.map(({ file }) => ({
          file,
          intent: "reference" as const,
        })),
        ...(logo
          ? [{ file: logo.file, intent: "asset" as const, logo: true as const }]
          : []),
        ...images.asset.map(({ file }) => ({ file, intent: "asset" as const })),
      ],
    };
  }

  /** What a storyboard was planned from: every choice, and which pictures. */
  function boardKey(result: GuideResult): string {
    const picked = [
      ...images.reference,
      ...images.asset,
      ...(logo ? [logo] : []),
    ];
    return JSON.stringify([
      result.tool,
      result.message,
      result.files.map((item) => [
        picked.find((entry) => entry.file === item.file)?.url,
        item.intent,
        item.logo,
      ]),
    ]);
  }

  /** Each uploaded picture's thumbnail, and what the film does with it, by upload id. */
  function picturesOf(uploads: ReadonlyMap<File, string>) {
    const pictures = new Map<string, { url: string; role: string }>();
    const add = (list: readonly Picked[], role: string) => {
      for (const item of list) {
        const id = uploads.get(item.file);
        if (id) pictures.set(id, { url: item.url, role });
      }
    };
    add(images.reference, "Rebuilt");
    add(images.asset, "As is");
    if (logo) add([logo], "Logo");
    return pictures;
  }

  async function send(result: GuideResult) {
    sending = true;
    try {
      if (await onGenerate(result)) back();
    } finally {
      sending = false;
    }
  }

  async function generate() {
    if (sending) return;
    const result = readForm();
    if (result) await send(result);
  }

  /** Shows the storyboard for these choices, planning one unless it is already here. */
  async function preview(fresh = false) {
    if (!onStoryboard || planning || sending) return;
    const result = readForm();
    if (!result) return;
    const key = boardKey(result);
    if (!fresh && board?.key === key) {
      showBoard = true;
      return;
    }
    planning = true;
    try {
      const planned = await onStoryboard(result);
      if (planned) {
        board = { key, ...planned };
        showBoard = true;
      }
    } finally {
      planning = false;
    }
  }

  async function generateFromBoard(storyboard: Storyboard) {
    if (sending) return;
    const result = readForm();
    if (result) await send({ ...result, tool: { ...result.tool, storyboard } });
  }
</script>

{#if tool}
  {@const demo = toolVideo(tool, templates)}
  <section class="gs-form" aria-labelledby="gs-form-title">
    <button type="button" class="gs-back" on:click={back}
      ><ArrowLeft size={15} /> All tools</button
    >
    <div class="gs-form-grid">
      <aside class="gs-example">
        <span class="gs-media" data-type={tool.id}>
          {#if demo}
            <video
              src={demo}
              autoplay
              muted
              loop
              playsinline
              preload="auto"
              aria-hidden="true"
              on:loadeddata={markReady}
            ></video>
          {/if}
        </span>
        <p class="gs-note">
          Made with this tool. Yours takes the same look, with your own content.
        </p>
      </aside>

      {#if showBoard && board}
        <GuidedStoryboard
          bind:storyboard={board.storyboard}
          seconds={lengthValue ?? seconds}
          {aspect}
          pictures={boardPictures}
          {price}
          charged={$creditEstimate !== null}
          busy={planning || sending}
          {disabled}
          onBack={() => (showBoard = false)}
          onRetry={() => void preview(true)}
          onGenerate={(storyboard) => void generateFromBoard(storyboard)}
        />
      {:else}
        <form class="gs-fields" on:submit|preventDefault={generate} novalidate>
          <header class="gs-form-head">
            <span class="gs-tip">{tool.tip}</span>
            <h1 id="gs-form-title" tabindex="-1" bind:this={heading}>
              {tool.title}
            </h1>
            <p>{tool.summary}</p>
          </header>

          {#each slots as { intent, slot } (intent)}
            {#if intent === "asset"}
              <section class="gs-panel">
                <div class="gs-slot-head">
                  <strong>Shown in your video</strong>
                  <span class="gs-badge is-placed">Used as they are</span>
                </div>
                <div class="gs-split" class:gs-split--single={!tool.logo}>
                  {#if tool.logo}
                    <div class="gs-half">
                      <span class="gs-half-label">Logo</span>
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div
                        class="gs-drop"
                        on:dragover|preventDefault
                        on:drop={onLogoDrop}
                      >
                        {#if logo}
                          <span class="gs-thumb gs-thumb--logo">
                            <img src={logo.url} alt={logo.file.name} />
                            <button
                              type="button"
                              aria-label="Remove this logo"
                              on:click={removeLogo}><X size={13} /></button
                            >
                          </span>
                        {:else if brand?.logoAssetId}
                          <span
                            class="gs-thumb gs-thumb--logo"
                            title="Your Brand Kit logo"
                          >
                            {#if brandLogoUrl}
                              <img
                                src={brandLogoUrl}
                                alt="Your Brand Kit logo"
                              />
                            {/if}
                          </span>
                        {/if}
                        <button
                          type="button"
                          class="gs-add"
                          on:click={() => logoInput.click()}
                          ><ImagePlus size={18} /><span
                            >{logo || brand?.logoAssetId
                              ? "Replace"
                              : "Add"}</span
                          ></button
                        >
                      </div>
                      <small class="gs-hint"
                        >{!logo && brand?.logoAssetId
                          ? "From your Brand Kit."
                          : "Only ever used as your logo."}</small
                      >
                      <input
                        bind:this={logoInput}
                        class="gs-file"
                        type="file"
                        accept="image/*"
                        on:change={onLogoFile}
                      />
                    </div>
                  {/if}

                  <div class="gs-half">
                    <span class="gs-half-label">{slot.label}</span>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="gs-drop"
                      on:dragover|preventDefault
                      on:drop={(event) => onDrop("asset", slot.max, event)}
                    >
                      {#each images.asset as image, index (image.url)}
                        <span class="gs-thumb">
                          <img src={image.url} alt={image.file.name} />
                          <button
                            type="button"
                            aria-label={`Remove ${image.file.name}`}
                            on:click={() => removeImage("asset", index)}
                            ><X size={13} /></button
                          >
                        </span>
                      {/each}
                      {#if images.asset.length < slot.max}
                        <button
                          type="button"
                          class="gs-add"
                          on:click={() => inputs.asset?.click()}
                          ><ImagePlus size={18} /><span>Add</span></button
                        >
                      {/if}
                    </div>
                    <small class="gs-hint">{slot.hint} Up to {slot.max}.</small>
                    <input
                      bind:this={inputs.asset}
                      class="gs-file"
                      type="file"
                      accept="image/*"
                      multiple
                      on:change={(event) => onFiles("asset", slot.max, event)}
                    />
                  </div>
                </div>
              </section>
            {:else}
              <section class="gs-panel">
                <div class="gs-slot-head">
                  <strong>{slot.label}</strong>
                  <span class="gs-badge">Used as reference only</span>
                </div>
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="gs-drop"
                  on:dragover|preventDefault
                  on:drop={(event) => onDrop("reference", slot.max, event)}
                >
                  {#each images.reference as image, index (image.url)}
                    <span class="gs-thumb">
                      <img src={image.url} alt={image.file.name} />
                      <button
                        type="button"
                        aria-label={`Remove ${image.file.name}`}
                        on:click={() => removeImage("reference", index)}
                        ><X size={13} /></button
                      >
                    </span>
                  {/each}
                  {#if images.reference.length < slot.max}
                    <button
                      type="button"
                      class="gs-add"
                      on:click={() => inputs.reference?.click()}
                      ><ImagePlus size={18} /><span>Add</span></button
                    >
                  {/if}
                </div>
                <small class="gs-hint">{slot.hint} Up to {slot.max}.</small>
                <input
                  bind:this={inputs.reference}
                  class="gs-file"
                  type="file"
                  accept="image/*"
                  multiple
                  on:change={(event) => onFiles("reference", slot.max, event)}
                />
              </section>
            {/if}
          {/each}

          <section class="gs-panel gs-settings">
            <fieldset class="gs-setting">
              <legend>Aspect ratio</legend>
              <div class="gs-segments gs-segments--4">
                {#each ASPECT_OPTIONS as option (option.aspect)}
                  <button
                    type="button"
                    class="gs-segment"
                    class:is-selected={aspect === option.aspect}
                    aria-pressed={aspect === option.aspect}
                    on:click={() => (aspect = option.aspect)}
                  >
                    <span
                      class="gs-shape"
                      style:aspect-ratio={option.aspect.replace(":", " / ")}
                      aria-hidden="true"
                    ></span>
                    <span class="gs-segment-text"
                      ><strong>{option.aspect}</strong><small
                        >{option.label}</small
                      ></span
                    >
                  </button>
                {/each}
              </div>
            </fieldset>

            <fieldset
              class="gs-setting"
              class:is-invalid={triedGenerate && lengthValue === null}
            >
              <legend>Length</legend>
              <div class="gs-segments gs-segments--4">
                {#each LENGTH_PRESETS as preset (preset)}
                  <button
                    type="button"
                    class="gs-segment"
                    class:is-selected={!customLength && seconds === preset}
                    aria-pressed={!customLength && seconds === preset}
                    on:click={() => setPresetLength(preset)}
                    >{preset} sec</button
                  >
                {/each}
                {#if customLength}
                  <label class="gs-segment gs-custom is-selected">
                    <input
                      id="guide-seconds"
                      type="number"
                      inputmode="numeric"
                      min={MIN_SECONDS}
                      max={MAX_SECONDS}
                      aria-label="Length in seconds"
                      bind:value={customSeconds}
                    />
                    sec
                  </label>
                {:else}
                  <button
                    type="button"
                    class="gs-segment"
                    aria-pressed="false"
                    on:click={setCustomLength}>Custom</button
                  >
                {/if}
              </div>
              {#if customLength}
                <small class="gs-hint"
                  >Any length from {MIN_SECONDS} to {MAX_SECONDS} seconds.</small
                >
              {/if}
            </fieldset>

            <fieldset class="gs-setting">
              <legend>Video language</legend>
              <div class="gs-segments gs-segments--2">
                {#each LANGUAGE_OPTIONS as option (option.language)}
                  <button
                    type="button"
                    class="gs-segment"
                    class:is-selected={language === option.language}
                    aria-pressed={language === option.language}
                    on:click={() => (language = option.language)}
                    >{option.native === option.label
                      ? option.label
                      : `${option.native} · ${option.label}`}</button
                  >
                {/each}
              </div>
            </fieldset>
          </section>

          <label
            class="gs-panel gs-instructions"
            class:is-invalid={triedGenerate &&
              tool.instructions.required &&
              !instructions.trim()}
          >
            <span class="gs-slot-head"
              ><strong>{tool.instructions.label}</strong
              >{#if !tool.instructions.required}<em>Optional</em>{/if}</span
            >
            <textarea
              id="guide-instructions"
              rows="3"
              placeholder={tool.instructions.placeholder}
              bind:value={instructions}
            ></textarea>
          </label>

          <div class="gs-actions">
            {#if triedGenerate && missing}
              <p class="gs-missing" role="alert">{missing}</p>
            {/if}
            <button
              type="submit"
              class="gs-generate"
              disabled={disabled || sending}
            >
              <span class="gs-generate-label"
                ><Sparkles size={16} />
                {sending ? "Preparing…" : "Generate video"}</span
              >
              {#if price !== null}
                <span class="gs-price">≈ {formatCredits(price)} credits</span>
              {/if}
            </button>
            {#if onStoryboard}
              <button
                type="button"
                class="gs-secondary"
                disabled={disabled || sending || planning}
                on:click={() => void preview()}
                ><LayoutList size={15} />
                {planning
                  ? "Planning your storyboard…"
                  : "Preview the plan first"}
                {#if $creditEstimate !== null}<span class="gs-secondary-price"
                    >{formatCredits(STORYBOARD_CREDITS)} credit</span
                  >{/if}</button
              >
            {/if}
            <small
              >{price !== null
                ? "An estimate for this length. You can keep editing the video in chat afterwards."
                : "You can keep editing the video in chat afterwards."}</small
            >
          </div>
        </form>
      {/if}
    </div>
  </section>
{:else}
  <section class="gs-start" aria-labelledby="gs-start-title">
    <header class="gs-start-head">
      <h2 id="gs-start-title">Or start with a tool</h2>
      <p>Add your pictures, pick a few options, and we handle the prompt.</p>
    </header>
    <ul class="gs-cards">
      {#each GUIDED_TOOLS as item (item.id)}
        {@const preview = toolVideo(item, templates)}
        <li>
          <button
            type="button"
            class="gs-card"
            {disabled}
            on:click={() => pick(item)}
          >
            <span class="gs-media" data-type={item.id}>
              {#if preview}
                <video
                  src={preview}
                  autoplay
                  muted
                  loop
                  playsinline
                  preload="auto"
                  aria-hidden="true"
                  on:loadeddata={markReady}
                ></video>
              {/if}
              <span class="gs-start-pill" aria-hidden="true"
                >Start <ArrowRight size={13} /></span
              >
            </span>
            <span class="gs-tip">{item.tip}</span>
            <strong>{item.title}</strong>
            <small>{item.summary}</small>
          </button>
        </li>
      {/each}
    </ul>
    {#if onExplore}
      <button type="button" class="gs-explore" on:click={onExplore}
        >Explore more templates <ArrowRight size={14} /></button
      >
    {/if}
  </section>
{/if}

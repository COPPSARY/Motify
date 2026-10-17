<script lang="ts">
  import { tick } from "svelte";
  import {
    ArrowLeft,
    ArrowUp,
    ChevronDown,
    Dna,
    Film,
    History,
    Image as ImageIcon,
    Images,
    Lock,
    Music,
    Plus,
    Upload,
    Wand2,
    RotateCcw,
    RectangleHorizontal,
    RectangleVertical,
    Square,
    X,
  } from "lucide-svelte";
  import TiffyMark from "./TiffyMark.svelte";
  import VersionsPanel from "./VersionsPanel.svelte";
  import type {
    AudioTrack,
    GenerationEffort,
    GenerationModel,
    ProjectsApi,
  } from "../../cloud/projects-api";
  import { formatCredits } from "../../api/credits";
  import { generationStore } from "../../stores/generation";
  import { creditBalance, creditEstimate } from "../../stores/credits";
  import type {
    AssetIntent,
    LocalAssetReference,
  } from "../../stores/local-assets";
  import type { CanvasAspect } from "../../composition/canvas-frame";
  import type { BrandProfileSummary } from "../../cloud/brand-dna";

  interface MessageAttachment {
    id: string;
    name: string;
    previewUrl?: string;
    intent?: AssetIntent;
    /** A song scoring the film, or a clip, rather than an image placed in it. */
    kind?: "audio" | "video";
  }

  interface AssistantMessage {
    role: "assistant" | "user";
    text: string;
    attachments?: MessageAttachment[];
    /** What the request this reply answered was charged, in credits. */
    credits?: number;
  }

  export let assistantMessages: AssistantMessage[];
  export let assistantDraft: string;
  export let composerInput: HTMLTextAreaElement;
  export let activityVerb: string;
  export let classifiedAssets: LocalAssetReference[];
  export let stagedPreviews: Record<string, string>;
  export let uploadingMedia: boolean;
  export let uploadProgress: number;
  export let uploadPreview: string | null;
  export let uploadName: string;
  export let isErrorMessage: (text: string) => boolean;
  export let handleFixError: (message: string) => Promise<void>;
  /** A transient failure: offer to resend the same request instead of Fix. */
  export let isRetryMessage: (text: string) => boolean = () => false;
  export let retryLastPrompt: () => Promise<void> = async () => {};
  export let removeStagedAsset: (asset: LocalAssetReference) => void;
  export let submitAssistant: (event: SubmitEvent) => Promise<void>;
  export let resizeComposer: () => void;
  export let composerKeydown: (event: KeyboardEvent) => void;
  export let handlePaste: (event: ClipboardEvent) => Promise<void>;
  export let onAttach: () => void;
  /** Songs chosen for the next message; they are sent with it and cleared. */
  export let selectedAudio: AudioTrack[] = [];
  export let removeSelectedAudio: (track: AudioTrack) => void = () => undefined;
  /** Files dropped on the panel: songs go to the library, images to the prompt. */
  export let onDropFiles: (files: File[]) => void = () => undefined;
  /**
   * `hero` is the centered "what would you like to create?" prompt shown
   * before a video exists; `panel` is the chat that sits beside an open video.
   */
  export let variant: "panel" | "hero" = "panel";
  /** Canvas for the first generation; existing videos keep their saved size. */
  export let generationAspect: CanvasAspect = "16:9";
  /** Reasoning depth sent with every cloud generation. */
  export let generationEffort: GenerationEffort = "medium";
  /** The model sent with every cloud generation. */
  export let generationModel: GenerationModel = "flash";
  /** Cloud only: a local project runs on the browser's own provider key. */
  export let modelPicker = false;
  /** Pro needs a paid plan; locked, it is shown faded and opens pricing instead. */
  export let modelLocked = true;
  export let onSelectModel: (model: GenerationModel) => void = () => undefined;
  export let onUpgradeModel: () => void = () => undefined;
  /** Long prompts get a time expectation while the run is active. */
  export let longGeneration = false;
  /** The open video's name, shown in the panel header. */
  export let title = "";
  /** Leaves the video for the home page; the header shows a back button when set. */
  export let onBack: (() => void) | null = null;
  /** The Brand DNA currently chosen for this video. */
  export let brandName: string | null = null;
  export let brandProfiles: BrandProfileSummary[] = [];
  export let selectedBrand: string | null = "default";
  export let onSelectBrand: (id: string | null) => void | Promise<void> = () =>
    undefined;
  export let onManageBrand: () => void = () => undefined;
  /** Library pickers offered from the composer's add menu. */
  export let onOpenMusic: (() => void) | null = null;
  export let onOpenAssets: (() => void) | null = null;
  /**
   * The open cloud video's history. Null for a local or unsaved video, which
   * has none; the header then shows no versions button.
   */
  export let versions: {
    api: Pick<ProjectsApi, "listVersions" | "updateVersion">;
    projectId: string;
    revision: number;
    onRestore: (revision: number) => Promise<void>;
  } | null = null;

  let versionsOpen = false;
  $: if (!versions) versionsOpen = false;

  let dragDepth = 0;
  let addMenuOpen = false;
  let addMenu: HTMLDivElement;
  let aspectMenuOpen = false;
  let effortMenuOpen = false;
  let modelMenuOpen = false;
  let modelPickerWrap: HTMLDivElement;
  let modelButton: HTMLButtonElement;
  let brandMenuOpen = false;
  let brandPicker: HTMLDivElement;
  let brandButton: HTMLButtonElement;
  let aspectPicker: HTMLDivElement;
  let aspectButton: HTMLButtonElement;
  let effortPicker: HTMLDivElement;
  let effortButton: HTMLButtonElement;
  let aspectOptionButtons: HTMLButtonElement[] = [];
  $: hasLibraries = Boolean(onOpenMusic || onOpenAssets);
  $: accepting = !$generationStore.isActive && !uploadingMedia;
  $: dragOver = accepting && dragDepth > 0;
  /**
   * `$creditEstimate` is fixed for the deployment (see the store); it is
   * null on a deployment that is not charging for requests.
   */
  $: insufficientCredits =
    $creditEstimate !== null &&
    $creditBalance !== null &&
    $creditBalance < $creditEstimate.min;

  /**
   * Keeps the newest message and the run's progress in view: a long prompt
   * would otherwise push the progress below the fold, out of sight.
   */
  let messagesList: HTMLDivElement | undefined;
  $: void scrollToLatest(
    messagesList,
    assistantMessages.length,
    $generationStore.isActive,
  );

  async function scrollToLatest(
    list: HTMLDivElement | undefined,
    ..._changes: unknown[]
  ): Promise<void> {
    if (!list) return;
    await tick();
    list.scrollTop = list.scrollHeight;
  }

  const aspectOptions: readonly { value: CanvasAspect; label: string }[] = [
    { value: "16:9", label: "16:9 · Landscape" },
    { value: "1:1", label: "1:1 · Square" },
    { value: "4:5", label: "4:5 · Portrait" },
    { value: "9:16", label: "9:16 · Vertical" },
  ];
  const mediumEffortOption: {
    value: GenerationEffort;
    label: string;
    description: string;
  } = {
    value: "medium",
    label: "Medium",
    description: "Balanced quality and wait time",
  };
  const effortOptions: readonly (typeof mediumEffortOption)[] = [
    mediumEffortOption,
    {
      value: "high",
      label: "High",
      description: "More thorough and usually slower",
    },
  ];
  const flashModelOption: {
    value: GenerationModel;
    label: string;
    description: string;
    paid: boolean;
  } = {
    value: "flash",
    label: "Flash",
    description: "Fast and capable",
    paid: false,
  };
  const modelOptions: readonly (typeof flashModelOption)[] = [
    flashModelOption,
    {
      value: "pro",
      label: "Pro",
      description: "Our most capable model",
      paid: true,
    },
  ];
  $: selectedModel =
    modelOptions.find((option) => option.value === generationModel) ??
    flashModelOption;
  const activitySteps = [
    "Reading your brief",
    "Planning the scene flow",
    "Building the motion",
    "Checking the result",
  ] as const;
  $: activityStepIndex = Math.max(
    0,
    activitySteps.findIndex((step) => step === activityVerb),
  );
  $: selectedEffort =
    effortOptions.find((option) => option.value === generationEffort) ??
    mediumEffortOption;
  $: selectedAspect = aspectOptions.find(
    (option) => option.value === generationAspect,
  ) ?? { value: "16:9", label: "16:9 · Landscape" };

  function carriesFiles(event: DragEvent): boolean {
    return Boolean(event.dataTransfer?.types.includes("Files"));
  }

  function onDragEnter(event: DragEvent): void {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
  }

  function onDragOver(event: DragEvent): void {
    if (!carriesFiles(event)) return;
    // Cancelling the default is what stops the browser opening the dropped file.
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = accepting ? "copy" : "none";
    }
  }

  function onDragLeave(): void {
    dragDepth = Math.max(0, dragDepth - 1);
  }

  function onDrop(event: DragEvent): void {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    const files = [...(event.dataTransfer?.files ?? [])];
    if (accepting && files.length > 0) onDropFiles(files);
  }

  function addClicked(): void {
    if (hasLibraries) {
      addMenuOpen = !addMenuOpen;
      aspectMenuOpen = false;
      effortMenuOpen = false;
    } else onAttach();
  }

  function pickFromMenu(action: (() => void) | null): void {
    addMenuOpen = false;
    action?.();
  }

  async function openAspectMenu(focusIndex?: number): Promise<void> {
    if ($generationStore.isActive) return;
    aspectMenuOpen = true;
    addMenuOpen = false;
    effortMenuOpen = false;
    if (focusIndex === undefined) return;
    await tick();
    aspectOptionButtons[focusIndex]?.focus();
  }

  function toggleAspectMenu(): void {
    if (aspectMenuOpen) aspectMenuOpen = false;
    else void openAspectMenu();
  }

  function selectAspect(value: CanvasAspect): void {
    generationAspect = value;
    aspectMenuOpen = false;
    aspectButton?.focus();
  }

  function pickModel(option: (typeof modelOptions)[number]): void {
    modelMenuOpen = false;
    if (option.paid && modelLocked) {
      onUpgradeModel();
      return;
    }
    onSelectModel(option.value);
    modelButton?.focus();
  }

  function selectEffort(value: GenerationEffort): void {
    generationEffort = value;
    effortMenuOpen = false;
    effortButton?.focus();
  }

  function aspectButtonKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const selectedIndex = aspectOptions.findIndex(
        (option) => option.value === generationAspect,
      );
      void openAspectMenu(selectedIndex < 0 ? 0 : selectedIndex);
    }
  }

  function aspectOptionKeydown(event: KeyboardEvent, index: number): void {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (index + 1) % aspectOptions.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (index - 1 + aspectOptions.length) % aspectOptions.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = aspectOptions.length - 1;
    } else if (event.key === "Escape") {
      event.preventDefault();
      aspectMenuOpen = false;
      aspectButton?.focus();
      return;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      aspectOptionButtons[nextIndex]?.focus();
    }
  }

  function closeMenus(event: PointerEvent): void {
    if (addMenuOpen && !addMenu?.contains(event.target as Node)) {
      addMenuOpen = false;
    }
    if (aspectMenuOpen && !aspectPicker?.contains(event.target as Node)) {
      aspectMenuOpen = false;
    }
    if (effortMenuOpen && !effortPicker?.contains(event.target as Node)) {
      effortMenuOpen = false;
    }
    if (modelMenuOpen && !modelPickerWrap?.contains(event.target as Node)) {
      modelMenuOpen = false;
    }
    if (brandMenuOpen && !brandPicker?.contains(event.target as Node))
      brandMenuOpen = false;
  }
</script>

<svelte:window on:pointerdown={closeMenus} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="ai-chat-panel"
  class:is-hero={variant === "hero"}
  class:is-drag-over={dragOver}
  data-drop-hint="Drop images or songs to add them"
  aria-label="Tiffy"
  data-tour={variant === "panel" ? "tiffy" : undefined}
  data-ph-no-autocapture
  on:dragenter={onDragEnter}
  on:dragover={onDragOver}
  on:dragleave={onDragLeave}
  on:drop={onDrop}
>
  {#if variant === "hero"}
    <h1 class="ai-hero-title">What are we making today?</h1>
  {:else}
    <header class="ai-chat-header" class:has-history={Boolean(versions)}>
      {#if onBack}
        <button
          type="button"
          class="ai-chat-back"
          data-tour="home"
          aria-label="Back to home"
          title={$generationStore.isActive
            ? "Tiffy is still working on this video"
            : "Back to home"}
          disabled={$generationStore.isActive}
          on:click={() => onBack?.()}><ArrowLeft size={17} /></button
        >
      {:else}
        <TiffyMark size={24} />
      {/if}
      <span class="ai-chat-identity">
        <strong>{title || "Tiffy"}</strong>
        <small>Tiffy · changes preview live</small>
      </span>
      {#if versions}
        <button
          type="button"
          class="ai-chat-history"
          class:is-open={versionsOpen}
          aria-label={versionsOpen ? "Back to chat" : "Versions"}
          aria-pressed={versionsOpen}
          title="Versions"
          on:click={() => (versionsOpen = !versionsOpen)}
          ><History size={16} /></button
        >
      {/if}
    </header>
  {/if}
  {#if variant === "panel" && versionsOpen && versions}
    <VersionsPanel
      api={versions.api}
      projectId={versions.projectId}
      revision={versions.revision}
      busy={$generationStore.isActive}
      onRestore={async (revision) => {
        await versions?.onRestore(revision);
        versionsOpen = false;
      }}
      onClose={() => (versionsOpen = false)}
    />
  {:else if variant === "panel"}
    <div class="ai-chat-messages" aria-live="polite" bind:this={messagesList}>
      {#if assistantMessages.length === 0}
        <div class="ai-chat-message assistant">
          Tell me what to change — copy, colors, pacing, music — and I’ll update
          the video.
        </div>
      {/if}
      {#each assistantMessages as message}
        <div
          class:assistant={message.role === "assistant"}
          class:user={message.role === "user"}
          class:is-error={message.role === "assistant" &&
            (isErrorMessage(message.text) || isRetryMessage(message.text))}
          class="ai-chat-message"
        >
          {#if message.attachments?.length}
            <div class="ai-message-attachments">
              {#each message.attachments as attachment (attachment.id)}
                <span
                  class="ai-message-attachment"
                  class:is-image={Boolean(attachment.previewUrl)}
                  title={attachment.name}
                >
                  {#if attachment.previewUrl && attachment.kind === "video"}
                    <!-- The first frame stands for the clip; it never plays here. -->
                    <video
                      class="ai-message-attachment-image"
                      src={attachment.previewUrl}
                      muted
                      playsinline
                      preload="metadata"
                      aria-label={attachment.name}
                    ></video>
                  {:else if attachment.previewUrl}
                    <img
                      class="ai-message-attachment-image"
                      src={attachment.previewUrl}
                      alt={attachment.name}
                    />
                  {:else}
                    <span
                      class="ai-message-attachment-thumb ai-attachment-fallback"
                      aria-hidden="true"
                      >{#if attachment.kind === "audio"}<Music
                          size={12}
                        />{:else}<ImageIcon size={12} />{/if}</span
                    >
                  {/if}
                  {#if !attachment.previewUrl}
                    <span class="ai-message-attachment-name"
                      >{attachment.name}</span
                    >
                  {/if}
                </span>
              {/each}
            </div>
          {/if}
          <div>{message.text}</div>
          {#if message.role === "assistant" && message.credits}
            <div class="ai-message-credits">
              Used {formatCredits(message.credits)} credits
            </div>
          {/if}
          {#if message.role === "assistant" && isErrorMessage(message.text)}
            <button
              class="ai-fix-btn"
              disabled={$generationStore.isActive}
              on:click={() => handleFixError(message.text)}
            >
              <Wand2 size={12} />
              Fix
            </button>
          {/if}
          {#if message.role === "assistant" && isRetryMessage(message.text)}
            <button
              class="ai-fix-btn"
              disabled={$generationStore.isActive}
              on:click={() => retryLastPrompt()}
            >
              <RotateCcw size={12} />
              Retry
            </button>
          {/if}
        </div>
      {/each}
      {#if $generationStore.isActive}
        <details class="ai-chat-activity" open>
          <summary aria-live="polite">
            <span class="ai-chat-activity-spinner" aria-hidden="true"></span>
            <span>{activityVerb}…</span>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          {#if longGeneration}
            <p>
              This may take a few minutes. You can check back when it’s done.
            </p>
          {/if}
          <ol aria-label="Generation progress">
            {#each activitySteps as step, index}
              <li
                class:is-complete={index < activityStepIndex}
                class:is-active={index === activityStepIndex}
                aria-current={index === activityStepIndex ? "step" : undefined}
              >
                <span class="ai-chat-step-marker" aria-hidden="true"
                ></span>{step}
              </li>
            {/each}
          </ol>
        </details>
      {/if}
    </div>
  {/if}
  {#if classifiedAssets.length > 0}
    <div class="ai-chat-attachments" aria-label="Attached images and videos">
      {#each classifiedAssets as asset (asset.id)}
        <span
          class="ai-attachment"
          class:is-reference={asset.intent === "reference"}
          title={`${asset.name} — ${asset.intent === "reference" ? "reference" : asset.intent === "asset" ? "project media" : "intent inferred from your prompt"}`}
        >
          {#if stagedPreviews[asset.id] && asset.mimeType.startsWith("video/")}
            <video
              class="ai-attachment-thumb"
              src={stagedPreviews[asset.id]}
              muted
              playsinline
              preload="metadata"
              aria-label={asset.name}
            ></video>
          {:else if stagedPreviews[asset.id]}
            <img
              class="ai-attachment-thumb"
              src={stagedPreviews[asset.id]}
              alt={asset.name}
            />
          {:else}
            <span class="ai-attachment-thumb ai-attachment-fallback"
              >{#if asset.mimeType.startsWith("video/")}<Film
                  size={11}
                />{:else}<ImageIcon size={11} />{/if}</span
            >
          {/if}
          <span class="ai-attachment-name">{asset.name}</span>
          <span class="ai-attachment-intent-tag"
            >{asset.intent === "reference"
              ? "reference"
              : asset.intent === "asset"
                ? "media"
                : "auto"}</span
          >
          <button
            class="ai-attachment-remove"
            type="button"
            aria-label={`Remove ${asset.name}`}
            disabled={$generationStore.isActive}
            on:click={() => removeStagedAsset(asset)}><X size={11} /></button
          >
        </span>
      {/each}
    </div>
  {/if}
  {#if selectedAudio.length > 0}
    <div class="ai-chat-attachments" aria-label="Music for this message">
      {#each selectedAudio as track (track.id)}
        <span
          class="ai-attachment is-music"
          title={`${track.title} — soundtrack for this film`}
        >
          <span class="ai-attachment-thumb ai-attachment-fallback"
            ><Music size={11} /></span
          >
          <span class="ai-attachment-name">{track.title}</span>
          <span class="ai-attachment-intent-tag">music</span>
          <button
            class="ai-attachment-remove"
            type="button"
            aria-label={`Remove ${track.title}`}
            disabled={$generationStore.isActive}
            on:click={() => removeSelectedAudio(track)}><X size={11} /></button
          >
        </span>
      {/each}
    </div>
  {/if}
  {#if uploadingMedia}
    <div class="ai-upload-progress" role="status" aria-live="polite">
      {#if uploadPreview}
        <img class="ai-upload-thumb" src={uploadPreview} alt={uploadName} />
      {:else}
        <span class="ai-upload-thumb ai-attachment-fallback"
          ><ImageIcon size={16} /></span
        >
      {/if}
      <div class="ai-upload-progress-body">
        <span>Uploading {uploadName || "image"} &mdash; {uploadProgress}%</span>
        <progress
          value={uploadProgress}
          max="100"
          aria-label={`Image upload ${uploadProgress}%`}
        ></progress>
      </div>
      <span>Uploading image — {uploadProgress}%</span>
      <progress
        value={uploadProgress}
        max="100"
        aria-label={`Image upload ${uploadProgress}%`}
      ></progress>
    </div>
  {/if}
  {#if insufficientCredits}
    <p class="ai-composer-credit-hint is-low" role="status">
      Not enough credits — you have {formatCredits($creditBalance ?? 0)} left.
    </p>
  {/if}
  <form class="ai-chat-composer" on:submit={submitAssistant}>
    <div class="ai-brand-picker" bind:this={brandPicker}>
      <button
        type="button"
        class="ai-brand-chip"
        data-tour="brand"
        bind:this={brandButton}
        class:is-unset={!brandName}
        aria-label="Choose Brand DNA"
        aria-expanded={brandMenuOpen}
        aria-haspopup="menu"
        title="Choose a Brand DNA or turn it off"
        disabled={$generationStore.isActive}
        on:click={() => {
          brandMenuOpen = !brandMenuOpen;
          aspectMenuOpen = false;
          effortMenuOpen = false;
          addMenuOpen = false;
        }}
        on:keydown={(event) => {
          if (event.key === "Escape") brandMenuOpen = false;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            brandMenuOpen = true;
            void tick().then(() =>
              brandPicker
                .querySelector<HTMLButtonElement>(".ai-brand-menu button")
                ?.focus(),
            );
          }
        }}
      >
        <Dna size={14} /><span
          >{selectedBrand === null
            ? "No brand"
            : (brandName ?? "Set up brand")}</span
        ><ChevronDown size={12} />
      </button>
      {#if brandMenuOpen}
        <div
          class="ai-brand-menu"
          role="menu"
          tabindex="-1"
          aria-label="Brand DNA profiles"
          on:keydown={(event) => {
            if (event.key === "Escape") {
              brandMenuOpen = false;
              brandButton.focus();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const buttons = [
                ...brandPicker.querySelectorAll<HTMLButtonElement>(
                  ".ai-brand-menu button",
                ),
              ];
              const index = buttons.findIndex(
                (button) => button === document.activeElement,
              );
              buttons[
                (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  buttons.length) %
                  buttons.length
              ]?.focus();
            }
          }}
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={selectedBrand === null}
            on:click={() => {
              brandMenuOpen = false;
              void onSelectBrand(null);
            }}>No brand <span>Off until selected</span></button
          >
          {#each brandProfiles as profile (profile.id)}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selectedBrand ===
                (profile.isDefault ? "default" : profile.id)}
              on:click={() => {
                brandMenuOpen = false;
                void onSelectBrand(profile.isDefault ? "default" : profile.id);
              }}>{profile.name}</button
            >
          {/each}
          <button
            type="button"
            role="menuitem"
            on:click={() => {
              brandMenuOpen = false;
              onManageBrand();
            }}>Manage Brand DNA</button
          >
        </div>
      {/if}
    </div>
    <textarea
      class="ai-composer-input"
      data-tour="prompt"
      aria-label="Assistant prompt"
      rows={variant === "hero" ? 2 : 1}
      placeholder={variant === "hero"
        ? "Describe your video, or paste your script in plain words…"
        : "What should we change?"}
      bind:this={composerInput}
      bind:value={assistantDraft}
      on:input={resizeComposer}
      on:keydown={composerKeydown}
      on:paste={handlePaste}
      disabled={$generationStore.isActive}
    ></textarea>
    <div class="ai-composer-bar">
      <div class="ai-composer-add-wrap" bind:this={addMenu}>
        <button
          class="ai-composer-add"
          data-tour="attach"
          type="button"
          aria-label="Attach an image or song"
          aria-haspopup={hasLibraries ? "menu" : undefined}
          aria-expanded={hasLibraries ? addMenuOpen : undefined}
          title="Attach images or songs, or drop or paste them here"
          disabled={uploadingMedia || $generationStore.isActive}
          on:click={addClicked}><Plus size={17} /></button
        >
        {#if addMenuOpen}
          <div class="ai-add-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              on:click={() => pickFromMenu(onAttach)}
              ><Upload size={15} /> Upload image or song</button
            >
            {#if onOpenAssets}
              <button
                type="button"
                role="menuitem"
                on:click={() => pickFromMenu(onOpenAssets)}
                ><Images size={15} /> From assets</button
              >
            {/if}
            {#if onOpenMusic}
              <button
                type="button"
                role="menuitem"
                on:click={() => pickFromMenu(onOpenMusic)}
                ><Music size={15} /> From music library</button
              >
            {/if}
          </div>
        {/if}
      </div>
      {#if variant === "hero"}
        <div class="ai-aspect-picker-wrap" bind:this={aspectPicker}>
          <button
            class="ai-aspect-picker"
            data-tour="aspect"
            class:is-open={aspectMenuOpen}
            type="button"
            aria-label={`Video aspect ratio: ${selectedAspect.label}`}
            aria-haspopup="listbox"
            aria-expanded={aspectMenuOpen}
            aria-controls="ai-aspect-options"
            title="Choose the canvas before Tiffy creates your video"
            disabled={$generationStore.isActive}
            bind:this={aspectButton}
            on:click={toggleAspectMenu}
            on:keydown={aspectButtonKeydown}
          >
            {#if generationAspect === "16:9"}
              <RectangleHorizontal size={15} aria-hidden="true" />
            {:else if generationAspect === "1:1"}
              <Square size={15} aria-hidden="true" />
            {:else}
              <RectangleVertical size={15} aria-hidden="true" />
            {/if}
            <span>{selectedAspect.label}</span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          {#if aspectMenuOpen}
            <div
              class="ai-aspect-menu"
              id="ai-aspect-options"
              role="listbox"
              aria-label="Video aspect ratio"
            >
              {#each aspectOptions as option, index (option.value)}
                <button
                  type="button"
                  role="option"
                  aria-selected={generationAspect === option.value}
                  class:is-selected={generationAspect === option.value}
                  bind:this={aspectOptionButtons[index]}
                  on:click={() => selectAspect(option.value)}
                  on:keydown={(event) => aspectOptionKeydown(event, index)}
                >
                  {#if option.value === "16:9"}
                    <RectangleHorizontal size={16} aria-hidden="true" />
                  {:else if option.value === "1:1"}
                    <Square size={16} aria-hidden="true" />
                  {:else}
                    <RectangleVertical size={16} aria-hidden="true" />
                  {/if}
                  <span>{option.label}</span>
                  <i aria-hidden="true"></i>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      {#if modelPicker}
        <div class="ai-effort-picker-wrap" bind:this={modelPickerWrap}>
          <button
            class="ai-effort-picker ai-model-picker"
            data-tour="model"
            class:is-open={modelMenuOpen}
            type="button"
            aria-label={`Model: ${selectedModel.label}`}
            aria-haspopup="menu"
            aria-expanded={modelMenuOpen}
            title="Choose the model Tiffy builds with"
            disabled={$generationStore.isActive}
            bind:this={modelButton}
            on:click={() => {
              modelMenuOpen = !modelMenuOpen;
              effortMenuOpen = false;
              aspectMenuOpen = false;
              brandMenuOpen = false;
              addMenuOpen = false;
            }}
            on:keydown={(event) => {
              if (event.key === "Escape") modelMenuOpen = false;
            }}
          >
            <span>{selectedModel.label}</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
          {#if modelMenuOpen}
            <div
              class="ai-effort-menu ai-model-menu"
              role="menu"
              aria-label="Model"
            >
              {#each modelOptions as option (option.value)}
                {@const locked = option.paid && modelLocked}
                <button
                  type="button"
                  role="menuitemradio"
                  class:is-locked={locked}
                  aria-checked={generationModel === option.value}
                  title={locked ? "Upgrade to use Pro" : undefined}
                  on:click={() => pickModel(option)}
                >
                  <span
                    ><strong>{option.label}</strong><small
                      >{locked
                        ? "Upgrade to unlock"
                        : option.description}</small
                    ></span
                  >
                  {#if locked}<Lock size={14} aria-hidden="true" />{/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      <div class="ai-effort-picker-wrap" bind:this={effortPicker}>
        <button
          class="ai-effort-picker"
          data-tour="effort"
          class:is-open={effortMenuOpen}
          type="button"
          aria-label={`Reasoning effort: ${selectedEffort.label}`}
          aria-haspopup="menu"
          aria-expanded={effortMenuOpen}
          title="Choose how thoroughly Tiffy reasons before building"
          disabled={$generationStore.isActive}
          bind:this={effortButton}
          on:click={() => {
            effortMenuOpen = !effortMenuOpen;
            modelMenuOpen = false;
            aspectMenuOpen = false;
            brandMenuOpen = false;
            addMenuOpen = false;
          }}
          on:keydown={(event) => {
            if (event.key === "Escape") effortMenuOpen = false;
          }}
        >
          <span>Effort: {selectedEffort.label}</span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>
        {#if effortMenuOpen}
          <div class="ai-effort-menu" role="menu" aria-label="Reasoning effort">
            {#each effortOptions as option (option.value)}
              <button
                type="button"
                role="menuitemradio"
                aria-checked={generationEffort === option.value}
                on:click={() => selectEffort(option.value)}
              >
                <span
                  ><strong>{option.label}</strong><small
                    >{option.description}</small
                  ></span
                >
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <button
        class="ai-composer-send"
        aria-label={insufficientCredits
          ? "Send message to Tiffy (not enough credits)"
          : "Send message to Tiffy"}
        disabled={!assistantDraft.trim() ||
          $generationStore.isActive ||
          uploadingMedia ||
          insufficientCredits}
        type="submit"
      >
        <ArrowUp size={17} aria-hidden="true" />
      </button>
    </div>
  </form>
</section>

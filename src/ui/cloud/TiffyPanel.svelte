<script lang="ts">
  import {
    ArrowLeft,
    ArrowUp,
    Coins,
    Dna,
    History,
    Image as ImageIcon,
    Images,
    Music,
    Plus,
    Upload,
    Wand2,
    RotateCcw,
    X,
  } from "lucide-svelte";
  import TiffyMark from "./TiffyMark.svelte";
  import VersionsPanel from "./VersionsPanel.svelte";
  import type { AudioTrack, ProjectsApi } from "../../cloud/projects-api";
  import { estimateMessageCredits, formatCredits } from "../../api/credits";
  import { generationStore } from "../../stores/generation";
  import { creditBalance, creditEstimate } from "../../stores/credits";
  import type {
    AssetIntent,
    LocalAssetReference,
  } from "../../stores/local-assets";

  interface MessageAttachment {
    id: string;
    name: string;
    previewUrl?: string;
    intent?: AssetIntent;
    /** A song scoring the film rather than an image placed in it. */
    kind?: "audio";
  }

  interface AssistantMessage {
    role: "assistant" | "user";
    text: string;
    attachments?: MessageAttachment[];
  }

  export let assistantMessages: AssistantMessage[];
  export let assistantDraft: string;
  export let composerInput: HTMLTextAreaElement;
  export let activityVerb: string;
  export let pendingAssets: LocalAssetReference[];
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
  export let classifyStagedAsset: (
    asset: LocalAssetReference,
    intent: AssetIntent,
  ) => void;
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
  /** The open video's name, shown in the panel header. */
  export let title = "";
  /** Leaves the video for the home page; the header shows a back button when set. */
  export let onBack: (() => void) | null = null;
  /**
   * The person's Brand DNA, which every generation uses. Null while it has
   * not been set up (or cannot be read).
   */
  export let brandName: string | null = null;
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
  // A rough, live guide scaled off the draft's own length — see
  // `estimateMessageCredits`. The real cost is only known once the request
  // finishes, so this is shown only once there is something to size it from;
  // an empty composer has nothing to base a number on.
  $: draftLength = assistantDraft.trim().length;
  $: estimatedCredits = $creditEstimate
    ? estimateMessageCredits($creditEstimate, draftLength)
    : 0;
  // With something to send, the button says what it will cost; only a
  // balance too low to pay for it needs a line of its own.
  $: showCost = $creditEstimate !== null && draftLength > 0;

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
    if (hasLibraries) addMenuOpen = !addMenuOpen;
    else onAttach();
  }

  function pickFromMenu(action: (() => void) | null): void {
    addMenuOpen = false;
    action?.();
  }

  function closeAddMenu(event: PointerEvent): void {
    if (addMenuOpen && !addMenu?.contains(event.target as Node)) {
      addMenuOpen = false;
    }
  }
</script>

<svelte:window on:pointerdown={closeAddMenu} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="ai-chat-panel"
  class:is-hero={variant === "hero"}
  class:is-drag-over={dragOver}
  data-drop-hint="Drop images or songs to add them"
  aria-label="Tiffy"
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
      <span
        class="ai-chat-state"
        class:is-busy={$generationStore.isActive}
        aria-label={$generationStore.isActive
          ? "Tiffy is working"
          : "Tiffy is ready"}
        title={$generationStore.isActive ? "Working" : "Ready"}
      >
        <span class="sr-only"
          >{$generationStore.isActive ? "Working" : "Ready"}</span
        >
      </span>
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
    <div class="ai-chat-messages" aria-live="polite">
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
                  {#if attachment.previewUrl}
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
        <div class="ai-chat-activity" aria-live="polite">
          <span class="ai-chat-activity-dot"></span>{activityVerb}…
        </div>
      {/if}
    </div>
  {/if}
  {#each pendingAssets as asset (asset.id)}
    <div class="ai-attachment-intent">
      {#if stagedPreviews[asset.id]}
        <img
          class="ai-intent-thumb"
          src={stagedPreviews[asset.id]}
          alt={asset.name}
        />
      {:else}
        <span class="ai-intent-thumb ai-attachment-fallback"
          ><ImageIcon size={16} /></span
        >
      {/if}
      <div class="ai-intent-body">
        <strong class="ai-intent-question"
          >Is this a reference or an asset?</strong
        >
        <span class="ai-intent-name">{asset.name}</span>
        <div class="ai-intent-actions">
          <button
            type="button"
            class="ai-intent-choice"
            on:click={() => classifyStagedAsset(asset, "reference")}
            >Reference<small>Match what it shows</small></button
          >
          <button
            type="button"
            class="ai-intent-choice"
            on:click={() => classifyStagedAsset(asset, "asset")}
            >Asset<small>Put it in the video</small></button
          >
        </div>
      </div>
      <button
        class="ai-attachment-remove"
        type="button"
        aria-label={`Discard ${asset.name}`}
        disabled={$generationStore.isActive}
        on:click={() => removeStagedAsset(asset)}><X size={11} /></button
      >
    </div>
  {/each}
  {#if classifiedAssets.length > 0}
    <div class="ai-chat-attachments" aria-label="Attached images">
      {#each classifiedAssets as asset (asset.id)}
        <span
          class="ai-attachment"
          class:is-reference={asset.intent === "reference"}
          title={`${asset.name} — ${asset.intent === "reference" ? "reference" : "project media"}`}
        >
          {#if stagedPreviews[asset.id]}
            <img
              class="ai-attachment-thumb"
              src={stagedPreviews[asset.id]}
              alt={asset.name}
            />
          {:else}
            <span class="ai-attachment-thumb ai-attachment-fallback"
              ><ImageIcon size={11} /></span
            >
          {/if}
          <span class="ai-attachment-name">{asset.name}</span>
          <span class="ai-attachment-intent-tag"
            >{asset.intent === "reference" ? "reference" : "media"}</span
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
    <textarea
      class="ai-composer-input"
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
          type="button"
          aria-label="Attach an image or song"
          aria-haspopup={hasLibraries ? "menu" : undefined}
          aria-expanded={hasLibraries ? addMenuOpen : undefined}
          title="Attach an image or song, or drop one here"
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
      <button
        type="button"
        class="ai-brand-chip"
        class:is-unset={!brandName}
        title={brandName
          ? `Tiffy uses the ${brandName} Brand DNA for every video. Click to edit it.`
          : "Set up your Brand DNA so every video is on brand."}
        on:click={onManageBrand}
      >
        <Dna size={14} /><span>{brandName ?? "Set up brand"}</span>
      </button>
      <button
        class="ai-composer-send"
        class:is-generate={showCost}
        aria-label={insufficientCredits
          ? "Send message to Tiffy (not enough credits)"
          : "Send message to Tiffy"}
        title={showCost
          ? `Uses about ${formatCredits(estimatedCredits)} credits`
          : undefined}
        disabled={!assistantDraft.trim() ||
          $generationStore.isActive ||
          uploadingMedia ||
          pendingAssets.length > 0 ||
          insufficientCredits}
        type="submit"
      >
        {#if showCost}
          <span>Generate</span>
          <span class="ai-send-cost"
            ><Coins size={13} aria-hidden="true" />{formatCredits(
              estimatedCredits,
            )}</span
          >
        {:else}
          <ArrowUp size={17} />
        {/if}
      </button>
    </div>
  </form>
</section>

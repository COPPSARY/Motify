<script lang="ts">
  import {
    ArrowUp,
    Image as ImageIcon,
    Music,
    Plus,
    Wand2,
    X,
  } from "lucide-svelte";
  import TiffyMark from "./TiffyMark.svelte";
  import type { AudioTrack } from "../../cloud/projects-api";
  import { generationStore } from "../../stores/generation";
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

  let dragDepth = 0;
  $: accepting = !$generationStore.isActive && !uploadingMedia;
  $: dragOver = accepting && dragDepth > 0;

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
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="ai-chat-panel"
  class:is-drag-over={dragOver}
  data-drop-hint="Drop images or songs to add them"
  aria-label="Tiffy"
  data-ph-no-autocapture
  on:dragenter={onDragEnter}
  on:dragover={onDragOver}
  on:dragleave={onDragLeave}
  on:drop={onDrop}
>
  <header class="ai-chat-header">
    <span class="ai-chat-identity">
      <TiffyMark size={24} />
      <strong>Tiffy</strong>
    </span>
    <span class="ai-chat-state" class:is-busy={$generationStore.isActive}
      >{$generationStore.isActive ? "Working" : "Ready"}</span
    >
  </header>
  <div class="ai-chat-messages" aria-live="polite">
    <div class="ai-chat-message assistant">
      Hi, I’m Tiffy. Describe a scene, transition, camera move, or timing change
      and I’ll build it with GSAP.
    </div>
    {#each assistantMessages as message}
      <div
        class:assistant={message.role === "assistant"}
        class:user={message.role === "user"}
        class:is-error={message.role === "assistant" &&
          isErrorMessage(message.text)}
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
      </div>
    {/each}
    {#if $generationStore.isActive}
      <div class="ai-chat-activity" aria-live="polite">
        <span class="ai-chat-activity-dot"></span>{activityVerb}…
      </div>
    {/if}
  </div>
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
  <form class="ai-chat-composer" on:submit={submitAssistant}>
    <button
      class="ai-composer-add"
      type="button"
      aria-label="Attach an image or song"
      title="Attach an image or song, or drop one here"
      disabled={uploadingMedia || $generationStore.isActive}
      on:click={() => onAttach()}><Plus size={17} /></button
    >
    <textarea
      class="ai-composer-input"
      aria-label="Assistant prompt"
      rows="1"
      placeholder="Ask Tiffy anything"
      bind:this={composerInput}
      bind:value={assistantDraft}
      on:input={resizeComposer}
      on:keydown={composerKeydown}
      on:paste={handlePaste}
      disabled={$generationStore.isActive}
    ></textarea>
    <button
      class="ai-composer-send"
      aria-label="Send message to Tiffy"
      disabled={!assistantDraft.trim() ||
        $generationStore.isActive ||
        uploadingMedia ||
        pendingAssets.length > 0}
      type="submit"><ArrowUp size={17} /></button
    >
  </form>
</section>

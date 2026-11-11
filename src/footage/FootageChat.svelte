<script lang="ts">
  import { tick } from "svelte";
  import { uploadAsset } from "../api/assets";
  import {
    ArrowUp,
    Captions,
    ImagePlus,
    Loader2,
    ChevronDown,
    Clapperboard,
    Film,
    Sparkles,
    Type,
    X,
  } from "lucide-svelte";
  import TiffyMark from "../ui/cloud/TiffyMark.svelte";

  /**
   * The footage editor's chat: the right column of a footage project, where the
   * person asks for changes in words. It looks and behaves like Tiffy's chat;
   * the tools for editing by hand are in the left column (FootagePanel).
   */

  export let messages: Array<{
    role: "user" | "assistant";
    text: string;
    credits?: number;
  }>;
  /** An AI request is running. */
  export let busy = false;
  /** What it is doing, shown while busy. */
  export let activity = "";
  export let clipCount = 0;
  export let clipsReady = 0;
  /** Whether a cut exists yet; before it does, the brief form is open. */
  export let hasCut = false;
  export let brief = "";
  /**
   * What is selected in the timeline or the preview. A message sent with a
   * selection is about those parts only.
   */
  export let selection: Array<{
    id: string;
    kind: "clip" | "title" | "caption";
    label: string;
  }> = [];
  export let onDeselect: (id: string) => void = () => undefined;
  export let onClearSelection: () => void = () => undefined;
  /** Where attached pictures are uploaded. */
  export let workspaceId = "";
  /** An instruction, with the pictures attached to it (a logo, a product photo). */
  export let onInstruct: (instruction: string, assetIds: string[]) => void;
  export let onRoughCut: (options: {
    brief: string;
    seconds: number;
    captionLanguage: string;
    music: boolean;
  }) => void;

  let draft = "";
  let input: HTMLTextAreaElement;
  let list: HTMLDivElement;
  let recutOpen = !hasCut;
  let recutBrief = brief;
  let seconds = 30;
  let captionLanguage = "km";
  let music = true;

  const SUGGESTIONS = [
    "Make the intro shorter",
    "Use the best product shots first",
    "Make it more energetic",
    "Add English under the Khmer captions",
    "Remove the first five seconds",
    "End with: order on Telegram",
  ];

  // New messages scroll into view, as in Tiffy.
  $: if (list && (messages.length || busy))
    void tick().then(() => list.scrollTo({ top: list.scrollHeight }));

  // ---- pictures ---------------------------------------------------------------------
  interface Picture {
    key: string;
    preview: string;
    assetId?: string;
    error?: string;
  }
  let pictures: Picture[] = [];
  let pictureInput: HTMLInputElement;
  $: uploadingPictures = pictures.some(
    (picture) => !picture.assetId && !picture.error,
  );

  async function attach(files: Iterable<File>): Promise<void> {
    const images = [...files].filter((file) =>
      /^image\/(png|jpeg|webp|gif)$/.test(file.type),
    );
    for (const file of images.slice(0, Math.max(0, 4 - pictures.length))) {
      const picture: Picture = {
        key: `${file.name}-${Math.random()}`,
        preview: URL.createObjectURL(file),
      };
      pictures = [...pictures, picture];
      try {
        picture.assetId = await uploadAsset(workspaceId, file);
      } catch (error) {
        picture.error =
          error instanceof Error ? error.message : "Upload failed";
      }
      pictures = [...pictures];
    }
  }

  function paste(event: ClipboardEvent): void {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.some((file) => file.type.startsWith("image/"))) {
      event.preventDefault();
      void attach(files);
    }
  }

  function detach(picture: Picture): void {
    URL.revokeObjectURL(picture.preview);
    pictures = pictures.filter((item) => item !== picture);
  }

  function send(text = draft): void {
    const value = text.trim();
    if (!value || busy || uploadingPictures) return;
    onInstruct(
      value,
      pictures.flatMap((picture) => (picture.assetId ? [picture.assetId] : [])),
    );
    pictures.forEach((picture) => URL.revokeObjectURL(picture.preview));
    pictures = [];
    draft = "";
    resize();
  }

  function resize(): void {
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  function keydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      send();
    }
  }

  function recut(): void {
    if (busy || clipCount === 0) return;
    onRoughCut({ brief: recutBrief, seconds, captionLanguage, music });
    recutOpen = false;
  }
</script>

<aside class="me-properties-panel fx-chat-column" aria-label="Edit with AI">
  <section class="ai-chat-panel fx-chat">
    <header class="ai-chat-header">
      <TiffyMark size={24} />
      <span class="ai-chat-identity">
        <strong>Tiffy</strong>
        <small>Edits your footage · every change can be undone</small>
      </span>
      <button
        type="button"
        class="ai-chat-history fx-recut-toggle"
        class:is-open={recutOpen}
        aria-pressed={recutOpen}
        title={hasCut ? "Re-cut from a brief" : "Cut my video"}
        on:click={() => (recutOpen = !recutOpen)}
        ><Clapperboard size={16} /></button
      >
    </header>

    {#if recutOpen}
      <form class="fx-recut" on:submit|preventDefault={recut}>
        <div class="fx-recut__head">
          <strong>{hasCut ? "Re-cut from a brief" : "Cut my video"}</strong>
          <small>{clipsReady}/{clipCount} clips ready</small>
        </div>
        <textarea
          rows="3"
          lang="km"
          bind:value={recutBrief}
          placeholder="Create a 30-second Khmer promotional video for my new coffee menu, with Khmer subtitles, animated titles and music."
        ></textarea>
        <div class="fx-recut__row">
          <div class="fx-pills" role="group" aria-label="Length">
            {#each [15, 30, 45, 60] as option (option)}
              <button
                type="button"
                class:fx-on={seconds === option}
                on:click={() => (seconds = option)}>{option}s</button
              >
            {/each}
          </div>
        </div>
        <div class="fx-recut__row">
          <select bind:value={captionLanguage} aria-label="Subtitles">
            <option value="km">Khmer subtitles</option>
            <option value="km+en">Khmer + English</option>
            <option value="en">English subtitles</option>
            <option value="auto">As spoken</option>
            <option value="none">No subtitles</option>
          </select>
          <label class="fx-check"
            ><input type="checkbox" bind:checked={music} /> Music</label
          >
        </div>
        <button
          type="submit"
          class="fx-primary"
          disabled={busy || clipCount === 0}
        >
          <Sparkles size={14} />
          {hasCut ? "Re-cut with AI" : "Create the first cut"}
        </button>
        <p class="fx-hint">
          {hasCut
            ? "This replaces the current cut; Undo brings it back. "
            : ""}10 credits.
        </p>
      </form>
    {/if}

    <div class="ai-chat-messages" aria-live="polite" bind:this={list}>
      {#if messages.length === 0}
        <div class="ai-chat-message assistant">
          Tell me what to change in your video: what to cut, which shots to use,
          the pace, the captions or the titles. You can also trim, split and
          move clips yourself in the timeline.
        </div>
      {/if}
      {#each messages as message, index (index)}
        <div
          class="ai-chat-message"
          class:assistant={message.role === "assistant"}
          class:user={message.role === "user"}
        >
          <div>{message.text}</div>
          {#if message.role === "assistant" && message.credits}
            <div class="ai-message-credits">Used {message.credits} credits</div>
          {/if}
        </div>
      {/each}
      {#if busy}
        <details class="ai-chat-activity" open>
          <summary aria-live="polite">
            <span class="ai-chat-activity-spinner" aria-hidden="true"></span>
            <span>{activity || "Working"}…</span>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
        </details>
      {/if}
    </div>

    {#if hasCut && !busy}
      <div class="fx-suggestions" aria-label="Suggestions">
        {#each SUGGESTIONS as suggestion (suggestion)}
          <button type="button" on:click={() => send(suggestion)}
            >{suggestion}</button
          >
        {/each}
      </div>
    {/if}

    <p class="fx-price">
      Each AI edit costs 10 credits · editing by hand is free
    </p>
    <form
      class="ai-chat-composer"
      on:submit|preventDefault={() => send()}
      on:dragover|preventDefault
      on:drop|preventDefault={(event) =>
        void attach(event.dataTransfer?.files ?? [])}
    >
      {#if pictures.length > 0}
        <div class="fx-pictures" aria-label="Attached pictures">
          {#each pictures as picture (picture.key)}
            <span
              class="fx-picture"
              class:fx-picture--error={picture.error}
              title={picture.error ?? "Attached picture"}
            >
              <img src={picture.preview} alt="" />
              {#if !picture.assetId && !picture.error}<span
                  class="fx-picture__busy"
                  ><Loader2 size={12} class="fx-spin" /></span
                >{/if}
              <button
                type="button"
                aria-label="Remove picture"
                on:click={() => detach(picture)}><X size={10} /></button
              >
            </span>
          {/each}
        </div>
      {/if}
      {#if selection.length > 0}
        <div class="fx-focus" aria-label="Selected parts">
          <span class="fx-focus__label">Editing</span>
          {#each selection as item (item.id)}
            <span class="fx-focus__chip" title={item.label}>
              {#if item.kind === "clip"}<Film
                  size={11}
                />{:else if item.kind === "title"}<Type
                  size={11}
                />{:else}<Captions size={11} />{/if}
              <span>{item.label}</span>
              <button
                type="button"
                aria-label={`Unselect ${item.label}`}
                on:click={() => onDeselect(item.id)}><X size={11} /></button
              >
            </span>
          {/each}
          {#if selection.length > 1}
            <button
              type="button"
              class="fx-focus__clear"
              on:click={onClearSelection}>Clear</button
            >
          {/if}
        </div>
      {/if}
      <textarea
        class="ai-composer-input"
        aria-label="Tell Tiffy what to change"
        rows="1"
        lang="km"
        placeholder={!hasCut
          ? "Cut the video first, then ask for changes"
          : selection.length > 0
            ? `What should change in ${selection.length === 1 ? "this part" : `these ${selection.length} parts`}?`
            : "What should we change? Select clips or text to change just them."}
        bind:this={input}
        bind:value={draft}
        on:input={resize}
        on:keydown={keydown}
        on:paste={paste}
        disabled={busy || !hasCut}
      ></textarea>
      <div class="ai-composer-bar">
        <button
          type="button"
          class="fx-attach"
          title="Attach a picture (a logo, a product photo), or paste one"
          aria-label="Attach a picture"
          disabled={busy || !hasCut || pictures.length >= 4}
          on:click={() => pictureInput.click()}><ImagePlus size={16} /></button
        >
        <input
          bind:this={pictureInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          on:change={(event) => {
            void attach((event.currentTarget as HTMLInputElement).files ?? []);
            (event.currentTarget as HTMLInputElement).value = "";
          }}
        />
        <button
          class="ai-composer-send"
          aria-label="Send to Tiffy"
          disabled={!draft.trim() || busy || !hasCut || uploadingPictures}
          type="submit"><ArrowUp size={17} aria-hidden="true" /></button
        >
      </div>
    </form>
  </section>
</aside>

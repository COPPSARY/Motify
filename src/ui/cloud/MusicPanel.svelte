<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    Check,
    CircleAlert,
    Music,
    Pause,
    Pencil,
    Play,
    Search,
    Trash2,
    Upload,
    X,
  } from "lucide-svelte";
  import {
    AUDIO_ACCEPT,
    addTrackToLibrary,
    formatTrackDuration,
    isAudioFile,
  } from "../../api/audio";
  import { fetchAudioBlob } from "../../api/audio-tokens";
  import type {
    AudioLibraryScope,
    AudioTrack,
    AudioTrackMetadata,
    ProjectsApi,
  } from "../../cloud/projects-api";
  import {
    MAX_SELECTED_AUDIO,
    deselectAudioTrack,
    forgetTrack,
    musicError,
    musicFilter,
    musicStatus,
    musicTracks,
    projectAudio,
    refreshMusicLibrary,
    replaceTrack,
    selectedAudio,
  } from "../../stores/music-library";

  export let api: ProjectsApi;
  export let workspaceId: string;
  /** Whether a generation is running; a film is not edited underneath it. */
  export let busy = false;
  export let onUse: (track: AudioTrack) => void;
  export let onRemoveFromProject: (track: AudioTrack) => Promise<void>;
  export let onNotice: (message: string) => void;

  interface UploadRow {
    id: string;
    name: string;
    progress: number;
    error: string;
  }

  interface EditDraft {
    title: string;
    artist: string;
    genre: string;
    /** A number input binds a number (or null when blank), not a string. */
    bpm: string | number | null;
    moods: string;
  }

  const SCOPES: Array<{ id: AudioLibraryScope; label: string }> = [
    { id: "all", label: "All" },
    { id: "workspace", label: "My uploads" },
    { id: "system", label: "Built-in" },
  ];

  let fileInput: HTMLInputElement;
  let dragDepth = 0;
  let uploads: UploadRow[] = [];
  let query = $musicFilter.query;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  let editingId = "";
  let draft: EditDraft = emptyDraft();
  let editError = "";
  let saving = false;
  let confirmDeleteId = "";
  let removingFromProject = "";
  let rowErrors: Record<string, string> = {};

  let previewId = "";
  let previewLoading = false;
  let previewPlaying = false;
  let previewObjectUrl = "";
  const player = typeof Audio === "undefined" ? null : new Audio();
  if (player) {
    player.addEventListener("play", () => (previewPlaying = true));
    player.addEventListener("pause", () => (previewPlaying = false));
    player.addEventListener("ended", () => {
      previewId = "";
      previewPlaying = false;
    });
  }

  $: dragging = dragDepth > 0;
  $: if (workspaceId) void refreshMusicLibrary(api, workspaceId);
  $: selectedIds = new Set($selectedAudio.map((track) => track.id));
  $: projectIds = new Set($projectAudio.map((track) => track.id));
  $: atLimit = $selectedAudio.length >= MAX_SELECTED_AUDIO;

  onDestroy(() => {
    clearTimeout(searchTimer);
    player?.pause();
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  });

  function emptyDraft(): EditDraft {
    return { title: "", artist: "", genre: "", bpm: "", moods: "" };
  }

  function messageOf(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  function describe(track: AudioTrack): string {
    return [
      track.artist,
      track.genre,
      formatTrackDuration(track.durationMs),
      track.bpm ? `${track.bpm} BPM` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

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
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(): void {
    dragDepth = Math.max(0, dragDepth - 1);
  }

  async function onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    dragDepth = 0;
    await addFiles([...(event.dataTransfer?.files ?? [])]);
  }

  async function onPick(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = "";
    await addFiles(files);
  }

  async function addFiles(files: File[]): Promise<void> {
    if (!workspaceId) {
      onNotice("Sign in to add music.");
      return;
    }
    const songs = files.filter(isAudioFile);
    if (songs.length < files.length) {
      onNotice("Only audio files can be added here: MP3, WAV, M4A, OGG, AAC.");
    }
    for (const file of songs) await addFile(file);
  }

  async function addFile(file: File): Promise<void> {
    const row: UploadRow = {
      id: crypto.randomUUID(),
      name: file.name,
      progress: 0,
      error: "",
    };
    uploads = [...uploads, row];
    const update = (patch: Partial<UploadRow>) => {
      uploads = uploads.map((item) =>
        item.id === row.id ? { ...item, ...patch } : item,
      );
    };
    try {
      const track = await addTrackToLibrary(
        api,
        workspaceId,
        file,
        (progress) => update({ progress }),
      );
      uploads = uploads.filter((item) => item.id !== row.id);
      await refreshMusicLibrary(api, workspaceId);
      onNotice(`${track.title} added to your music library.`);
    } catch (error) {
      update({ error: messageOf(error, "Upload failed.") });
    }
  }

  function dismissUpload(id: string): void {
    uploads = uploads.filter((item) => item.id !== id);
  }

  function chooseScope(scope: AudioLibraryScope): void {
    musicFilter.update((filter) => ({ ...filter, scope }));
    void refreshMusicLibrary(api, workspaceId);
  }

  function onSearchInput(): void {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      musicFilter.update((filter) => ({ ...filter, query: query.trim() }));
      void refreshMusicLibrary(api, workspaceId);
    }, 250);
  }

  function setRowError(id: string, message: string): void {
    rowErrors = { ...rowErrors, [id]: message };
  }

  function clearRowError(id: string): void {
    if (!rowErrors[id]) return;
    const next = { ...rowErrors };
    delete next[id];
    rowErrors = next;
  }

  async function previewSource(track: AudioTrack): Promise<string> {
    const { url } = await api.getAudioAccess(track.id);
    // A signed link streams straight from storage. Local development storage
    // needs the session cookie, so it is fetched and played from memory.
    if (/^https?:\/\//i.test(url)) return url;
    const blob = await fetchAudioBlob(track.id);
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = URL.createObjectURL(blob);
    return previewObjectUrl;
  }

  function stopPreview(): void {
    player?.pause();
    previewId = "";
    previewPlaying = false;
  }

  async function togglePreview(track: AudioTrack): Promise<void> {
    if (!player) return;
    clearRowError(track.id);
    if (previewId === track.id && previewPlaying) {
      player.pause();
      return;
    }
    if (previewId === track.id && player.src && !previewLoading) {
      await player.play().catch(() => undefined);
      return;
    }
    stopPreview();
    previewId = track.id;
    previewLoading = true;
    try {
      const source = await previewSource(track);
      if (previewId !== track.id) return;
      player.src = source;
      await player.play();
    } catch (error) {
      if (previewId === track.id) previewId = "";
      setRowError(track.id, messageOf(error, "Could not play this track."));
    } finally {
      previewLoading = false;
    }
  }

  function startEdit(track: AudioTrack): void {
    editingId = track.id;
    editError = "";
    confirmDeleteId = "";
    draft = {
      title: track.title,
      artist: track.artist ?? "",
      genre: track.genre ?? "",
      bpm: track.bpm ? String(track.bpm) : "",
      moods: track.moodTags.join(", "),
    };
  }

  function cancelEdit(): void {
    editingId = "";
    editError = "";
  }

  /** Only what changed is sent; blank optional fields clear the stored value. */
  function buildPatch(
    track: AudioTrack,
    values: EditDraft,
  ): AudioTrackMetadata | string {
    const title = values.title.trim();
    if (!title) return "A track needs a title.";
    if (title.length > 100) return "Title is limited to 100 characters.";
    const artist = values.artist.trim() || null;
    const genre = values.genre.trim() || null;
    if ((artist?.length ?? 0) > 100)
      return "Artist is limited to 100 characters.";
    if ((genre?.length ?? 0) > 40) return "Genre is limited to 40 characters.";

    let bpm: number | null = null;
    const rawBpm = String(values.bpm ?? "").trim();
    if (rawBpm) {
      bpm = Number(rawBpm);
      if (!Number.isInteger(bpm) || bpm < 20 || bpm > 300) {
        return "BPM must be a whole number from 20 to 300.";
      }
    }
    const moodTags = [
      ...new Set(
        values.moods
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (moodTags.length > 10) return "Use at most 10 mood tags.";
    if (moodTags.some((tag) => tag.length > 40)) {
      return "Mood tags are limited to 40 characters.";
    }

    const patch: AudioTrackMetadata = {};
    if (title !== track.title) patch.title = title;
    if (artist !== track.artist) patch.artist = artist;
    if (genre !== track.genre) patch.genre = genre;
    if (bpm !== track.bpm) patch.bpm = bpm;
    if (moodTags.join("\u0000") !== track.moodTags.join("\u0000")) {
      patch.moodTags = moodTags;
    }
    return patch;
  }

  async function saveEdit(track: AudioTrack): Promise<void> {
    const patch = buildPatch(track, draft);
    if (typeof patch === "string") {
      editError = patch;
      return;
    }
    if (Object.keys(patch).length === 0) {
      cancelEdit();
      return;
    }
    saving = true;
    try {
      replaceTrack(await api.updateAudioTrack(track.id, patch));
      cancelEdit();
    } catch (error) {
      editError = messageOf(error, "Could not save changes.");
    } finally {
      saving = false;
    }
  }

  async function deleteTrack(track: AudioTrack): Promise<void> {
    try {
      await api.removeAudioTrack(track.id);
      if (previewId === track.id) stopPreview();
      forgetTrack(track.id);
      confirmDeleteId = "";
      onNotice(`${track.title} deleted from your music library.`);
    } catch (error) {
      confirmDeleteId = "";
      setRowError(track.id, messageOf(error, "Could not delete this track."));
    }
  }

  async function removeFromProject(track: AudioTrack): Promise<void> {
    removingFromProject = track.id;
    try {
      await onRemoveFromProject(track);
    } catch (error) {
      setRowError(track.id, messageOf(error, "Could not remove this track."));
    } finally {
      removingFromProject = "";
    }
  }

  function toggleUse(track: AudioTrack): void {
    if (selectedIds.has(track.id)) deselectAudioTrack(track.id);
    else onUse(track);
  }
</script>

<div class="me-panel-content music-panel">
  {#if !workspaceId}
    <div class="music-empty">
      <Music size={22} aria-hidden="true" />
      <strong>Sign in to use music</strong>
      <p class="panel-copy">
        Your music library lives in your workspace. Sign in to add songs and
        score your films to them.
      </p>
    </div>
  {:else}
    <div
      class="music-dropzone"
      class:is-drag-active={dragging}
      role="group"
      aria-label="Add music"
      on:dragenter={onDragEnter}
      on:dragover={onDragOver}
      on:dragleave={onDragLeave}
      on:drop={onDrop}
    >
      <button
        class="music-add-btn"
        type="button"
        on:click={() => fileInput.click()}
        ><Upload size={14} /> Add music</button
      >
      <p class="music-drop-hint">
        {dragging ? "Drop to add" : "or drop songs here"} · MP3, WAV, M4A, OGG, AAC
        · up to 50 MB
      </p>
      <input
        bind:this={fileInput}
        type="file"
        accept={AUDIO_ACCEPT}
        multiple
        hidden
        on:change={onPick}
      />
    </div>

    {#each uploads as upload (upload.id)}
      <div
        class="music-upload"
        class:is-error={Boolean(upload.error)}
        role="status"
      >
        <span class="music-upload-name" title={upload.name}>{upload.name}</span>
        {#if upload.error}
          <span class="music-upload-error">{upload.error}</span>
          <button
            class="music-icon-btn"
            type="button"
            aria-label={`Dismiss ${upload.name}`}
            on:click={() => dismissUpload(upload.id)}><X size={12} /></button
          >
        {:else}
          <progress
            value={upload.progress}
            max="100"
            aria-label={`Uploading ${upload.name}`}
          ></progress>
          <span class="music-upload-percent">{upload.progress}%</span>
        {/if}
      </div>
    {/each}

    {#if $projectAudio.length > 0}
      <h3 class="me-category-title music-section-title">In this project</h3>
      <ul class="music-list">
        {#each $projectAudio as track (track.id)}
          <li class="music-item">
            <div class="music-row is-compact">
              <button
                class="music-play"
                type="button"
                aria-label={previewId === track.id && previewPlaying
                  ? `Pause ${track.title}`
                  : `Play ${track.title}`}
                on:click={() => togglePreview(track)}
              >
                {#if previewId === track.id && previewPlaying}<Pause
                    size={13}
                  />{:else}<Play size={13} />{/if}
              </button>
              <div class="music-info">
                <strong class="music-title">{track.title}</strong>
                <span class="music-meta">{describe(track)}</span>
              </div>
              <button
                class="music-icon-btn"
                type="button"
                aria-label={`Remove ${track.title} from this project`}
                title={busy
                  ? "Wait for Tiffy to finish"
                  : "Remove from this project"}
                disabled={busy || removingFromProject === track.id}
                on:click={() => removeFromProject(track)}
                ><X size={13} /></button
              >
            </div>
            {#if rowErrors[track.id]}
              <p class="music-row-error" role="alert">{rowErrors[track.id]}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <h3 class="me-category-title music-section-title">Music library</h3>
    <div class="music-toolbar">
      <div class="music-filter" role="group" aria-label="Filter music">
        {#each SCOPES as scope (scope.id)}
          <button
            class="music-chip"
            class:is-active={$musicFilter.scope === scope.id}
            type="button"
            aria-pressed={$musicFilter.scope === scope.id}
            on:click={() => chooseScope(scope.id)}>{scope.label}</button
          >
        {/each}
      </div>
      <label class="music-search">
        <Search size={13} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search title, artist, mood"
          aria-label="Search music"
          bind:value={query}
          on:input={onSearchInput}
        />
      </label>
    </div>

    {#if $musicStatus === "error"}
      <p class="music-row-error" role="alert">
        <CircleAlert size={12} aria-hidden="true" />
        {$musicError}
        <button
          class="music-link"
          type="button"
          on:click={() => refreshMusicLibrary(api, workspaceId)}>Retry</button
        >
      </p>
    {:else if $musicStatus === "loading" && $musicTracks.length === 0}
      <p class="panel-copy">Loading your music…</p>
    {:else if $musicTracks.length === 0}
      <p class="panel-copy">
        {#if $musicFilter.query}
          No songs match “{$musicFilter.query}”.
        {:else if $musicFilter.scope === "system"}
          No built-in tracks yet.
        {:else}
          No songs yet. Add one above and Tiffy can score your film to it.
        {/if}
      </p>
    {/if}

    <ul class="music-list">
      {#each $musicTracks as track (track.id)}
        <li class="music-item" class:is-playing={previewId === track.id}>
          <div class="music-row">
            <button
              class="music-play"
              type="button"
              aria-label={previewId === track.id && previewPlaying
                ? `Pause ${track.title}`
                : `Play ${track.title}`}
              disabled={previewLoading && previewId === track.id}
              on:click={() => togglePreview(track)}
            >
              {#if previewId === track.id && previewPlaying}<Pause
                  size={13}
                />{:else}<Play size={13} />{/if}
            </button>
            <div class="music-info">
              <strong class="music-title" title={track.title}
                >{track.title}</strong
              >
              <span class="music-meta">{describe(track)}</span>
              {#if track.scope === "system" || track.moodTags.length > 0}
                <span class="music-tags">
                  {#if track.scope === "system"}
                    <span
                      class="music-badge"
                      title={track.license
                        ? `License: ${track.license}`
                        : "Provided by Motify"}>Built-in</span
                    >
                  {/if}
                  {#each track.moodTags as tag}
                    <span class="music-tag">{tag}</span>
                  {/each}
                </span>
              {/if}
            </div>
            <div class="music-actions">
              {#if confirmDeleteId === track.id}
                <span class="music-confirm">Delete?</span>
                <button
                  class="music-icon-btn is-danger"
                  type="button"
                  aria-label={`Confirm deleting ${track.title}`}
                  on:click={() => deleteTrack(track)}
                  ><Check size={13} /></button
                >
                <button
                  class="music-icon-btn"
                  type="button"
                  aria-label="Keep this track"
                  on:click={() => (confirmDeleteId = "")}
                  ><X size={13} /></button
                >
              {:else}
                <button
                  class="music-use"
                  class:is-selected={selectedIds.has(track.id)}
                  type="button"
                  disabled={projectIds.has(track.id) ||
                    (atLimit && !selectedIds.has(track.id))}
                  title={projectIds.has(track.id)
                    ? "Already scoring this project"
                    : atLimit && !selectedIds.has(track.id)
                      ? `Up to ${MAX_SELECTED_AUDIO} songs per message`
                      : "Use in your next message to Tiffy"}
                  aria-pressed={selectedIds.has(track.id)}
                  on:click={() => toggleUse(track)}
                >
                  {#if projectIds.has(track.id)}In project
                  {:else if selectedIds.has(track.id)}<Check size={12} /> Selected
                  {:else}Use{/if}
                </button>
                {#if track.scope === "workspace"}
                  <button
                    class="music-icon-btn"
                    type="button"
                    aria-label={`Edit ${track.title}`}
                    title="Edit details"
                    on:click={() => startEdit(track)}
                    ><Pencil size={12} /></button
                  >
                  <button
                    class="music-icon-btn"
                    type="button"
                    aria-label={`Delete ${track.title}`}
                    title={projectIds.has(track.id)
                      ? "Remove it from the project first"
                      : "Delete from library"}
                    disabled={projectIds.has(track.id)}
                    on:click={() => (confirmDeleteId = track.id)}
                    ><Trash2 size={12} /></button
                  >
                {/if}
              {/if}
            </div>
          </div>

          {#if editingId === track.id}
            <form
              class="music-edit"
              on:submit|preventDefault={() => saveEdit(track)}
            >
              <label>
                Title
                <input
                  type="text"
                  maxlength="100"
                  required
                  bind:value={draft.title}
                />
              </label>
              <label>
                Artist
                <input type="text" maxlength="100" bind:value={draft.artist} />
              </label>
              <label>
                Genre
                <input type="text" maxlength="40" bind:value={draft.genre} />
              </label>
              <label>
                BPM
                <input
                  type="number"
                  min="20"
                  max="300"
                  step="1"
                  placeholder="e.g. 128"
                  title="Helps Tiffy cut to the beat"
                  bind:value={draft.bpm}
                />
              </label>
              <label class="is-wide">
                Mood
                <input
                  type="text"
                  placeholder="upbeat, hopeful, cinematic"
                  bind:value={draft.moods}
                />
              </label>
              {#if editError}<p class="music-row-error" role="alert">
                  {editError}
                </p>{/if}
              <div class="music-edit-actions">
                <button class="music-use" type="button" on:click={cancelEdit}
                  >Cancel</button
                >
                <button
                  class="music-use is-primary"
                  type="submit"
                  disabled={saving}>{saving ? "Saving…" : "Save"}</button
                >
              </div>
            </form>
          {/if}

          {#if rowErrors[track.id]}
            <p class="music-row-error" role="alert">{rowErrors[track.id]}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

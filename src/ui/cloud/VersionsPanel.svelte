<script lang="ts">
  import {
    History,
    LoaderCircle,
    Pencil,
    Pin,
    PinOff,
    RefreshCcw,
    RotateCcw,
    X,
  } from "lucide-svelte";
  import type { ProjectsApi, ProjectVersion } from "../../cloud/projects-api";
  import "../styles/versions-panel.css";

  export let api: Pick<ProjectsApi, "listVersions" | "updateVersion">;
  export let projectId: string;
  /** The loaded project revision; the list reloads whenever it moves. */
  export let revision = 0;
  /** True while Tiffy is working, when restoring would race her save. */
  export let busy = false;
  export let onRestore: (revision: number) => Promise<void>;
  export let onClose: () => void;
  export let now: () => number = () => Date.now();

  let versions: ProjectVersion[] = [];
  let loading = false;
  let error = "";
  let loadedKey = "";
  let restoring = 0;
  let renaming = 0;
  let renameDraft = "";
  let request = 0;

  $: loadKey = `${projectId}:${revision}`;
  $: if (projectId && loadKey !== loadedKey) {
    loadedKey = loadKey;
    void refresh();
  }

  async function refresh(): Promise<void> {
    const id = ++request;
    loading = true;
    error = "";
    try {
      const listed = await api.listVersions(projectId);
      if (id === request) versions = listed;
    } catch {
      if (id === request) error = "Versions could not be loaded.";
    } finally {
      if (id === request) loading = false;
    }
  }

  async function restore(version: ProjectVersion): Promise<void> {
    if (busy || restoring) return;
    restoring = version.revision;
    error = "";
    try {
      await onRestore(version.revision);
    } catch {
      error = `Version ${version.revision} could not be restored.`;
    } finally {
      restoring = 0;
    }
  }

  async function update(
    version: ProjectVersion,
    patch: { label?: string | null; pinned?: boolean },
  ): Promise<void> {
    const previous = versions;
    versions = versions.map((candidate) =>
      candidate.revision === version.revision
        ? { ...candidate, ...patch }
        : candidate,
    );
    try {
      await api.updateVersion(projectId, version.revision, patch);
    } catch {
      versions = previous;
      error = "That change could not be saved.";
    }
  }

  function startRename(version: ProjectVersion): void {
    renaming = version.revision;
    renameDraft = version.label ?? "";
  }

  function finishRename(version: ProjectVersion, save: boolean): void {
    if (renaming !== version.revision) return;
    renaming = 0;
    const label = renameDraft.trim().slice(0, 80) || null;
    if (save && label !== version.label) void update(version, { label });
  }

  function renameKeydown(event: KeyboardEvent, version: ProjectVersion): void {
    if (event.key === "Enter") finishRename(version, true);
    if (event.key === "Escape") finishRename(version, false);
  }

  function focusOnMount(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }

  function describe(version: ProjectVersion): string {
    switch (version.source) {
      case "initial":
        return "Before history began";
      case "generation":
        return "Tiffy";
      case "manual_edit":
        return "Edited by hand";
      case "restore":
        return version.restoredFromRevision
          ? `Restored from version ${version.restoredFromRevision}`
          : "Restored";
    }
  }

  function ago(createdAt: string): string {
    const seconds = Math.max(
      0,
      Math.round((now() - new Date(createdAt).getTime()) / 1000),
    );
    if (seconds < 45) return "just now";
    const steps: Array<[number, string]> = [
      [60, "minute"],
      [60, "hour"],
      [24, "day"],
      [30, "month"],
      [12, "year"],
    ];
    let value = seconds / 60;
    let unit = "minute";
    for (let index = 1; index < steps.length; index += 1) {
      const [size, next] = steps[index]!;
      if (value < size) break;
      value /= size;
      unit = next;
    }
    const rounded = Math.max(1, Math.round(value));
    return `${rounded} ${unit}${rounded === 1 ? "" : "s"} ago`;
  }
</script>

<section class="versions-panel" aria-label="Version history">
  <header class="versions-head">
    <History size={16} />
    <strong>Versions</strong>
    <button
      type="button"
      class="versions-icon-btn"
      aria-label="Reload versions"
      title="Reload"
      disabled={loading}
      on:click={() => void refresh()}><RefreshCcw size={14} /></button
    >
    <button
      type="button"
      class="versions-icon-btn"
      aria-label="Back to chat"
      title="Back to chat"
      on:click={onClose}><X size={15} /></button
    >
  </header>

  {#if error}
    <p class="versions-error" role="alert">{error}</p>
  {/if}

  {#if loading && versions.length === 0}
    <p class="versions-empty">
      <LoaderCircle size={14} class="versions-spin" /> Loading versions…
    </p>
  {:else if versions.length === 0 && !error}
    <p class="versions-empty">
      Every prompt and saved edit becomes a version you can go back to.
    </p>
  {:else}
    <ol class="versions-list">
      {#each versions as version (version.revision)}
        <li class="versions-item" class:is-current={version.current}>
          <div class="versions-item-head">
            {#if renaming === version.revision}
              <input
                class="versions-rename"
                aria-label={`Name version ${version.revision}`}
                maxlength="80"
                placeholder={`Version ${version.revision}`}
                bind:value={renameDraft}
                use:focusOnMount
                on:keydown={(event) => renameKeydown(event, version)}
                on:blur={() => finishRename(version, true)}
              />
            {:else}
              <span class="versions-name">
                {version.label ?? `Version ${version.revision}`}
                {#if version.label}<small>v{version.revision}</small>{/if}
              </span>
            {/if}
            {#if version.current}
              <span class="versions-badge">Current</span>
            {/if}
            {#if version.pinned}
              <Pin size={12} aria-label="Pinned" class="versions-pinned" />
            {/if}
          </div>
          {#if version.prompt}
            <p class="versions-prompt" title={version.prompt}>
              “{version.prompt}”
            </p>
          {/if}
          <div class="versions-meta">
            <span>{describe(version)}</span>
            <span aria-hidden="true">·</span>
            <time datetime={version.createdAt}>{ago(version.createdAt)}</time>
          </div>
          <div class="versions-actions">
            {#if !version.current}
              <button
                type="button"
                class="versions-restore"
                disabled={busy || restoring !== 0}
                title={busy
                  ? "Wait for Tiffy to finish"
                  : `Make version ${version.revision} the current film`}
                on:click={() => void restore(version)}
              >
                {#if restoring === version.revision}
                  <LoaderCircle size={13} class="versions-spin" /> Restoring…
                {:else}
                  <RotateCcw size={13} /> Restore
                {/if}
              </button>
            {/if}
            <button
              type="button"
              class="versions-icon-btn"
              aria-label={`Rename version ${version.revision}`}
              title="Rename"
              on:click={() => startRename(version)}><Pencil size={13} /></button
            >
            <button
              type="button"
              class="versions-icon-btn"
              aria-label={version.pinned
                ? `Unpin version ${version.revision}`
                : `Pin version ${version.revision}`}
              title={version.pinned
                ? "Unpin"
                : "Pin: keep this version when old ones are cleared"}
              on:click={() => void update(version, { pinned: !version.pinned })}
            >
              {#if version.pinned}<PinOff size={13} />{:else}<Pin
                  size={13}
                />{/if}
            </button>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</section>

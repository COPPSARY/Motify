<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    Film,
    Image as ImageIcon,
    LoaderCircle,
    Plus,
    RefreshCcw,
    Settings2,
    Upload,
  } from "lucide-svelte";
  import { loadAssetObjectUrl, uploadAsset } from "../../api/assets";
  import type { BrandAsset } from "../../cloud/brand-dna";
  import {
    ProjectsApi,
    type ProjectAssetSummary,
    type WorkspaceAsset,
  } from "../../cloud/projects-api";
  import "../styles/assets-panel.css";

  export let api: ProjectsApi;
  export let workspaceId: string;
  export let projectId = "";
  export let busy = false;
  export let onUse: (asset: WorkspaceAsset) => void = () => undefined;
  export let onManageBrand: () => void = () => undefined;
  export let onNotice: (message: string) => void = () => undefined;

  let fileInput: HTMLInputElement;
  let loading = false;
  let uploading = false;
  let uploadProgress = 0;
  let error = "";
  let loadedKey = "";
  let refreshVersion = 0;
  let workspaceAssets: WorkspaceAsset[] = [];
  let brandAssets: BrandAsset[] = [];
  let projectAssets: ProjectAssetSummary[] = [];
  let previews: Record<string, string> = {};

  $: loadKey = `${workspaceId}:${projectId}`;
  $: if (workspaceId && loadKey !== loadedKey) {
    loadedKey = loadKey;
    void refresh();
  }
  $: brandIds = new Set(brandAssets.map((asset) => asset.assetId));
  $: projectIds = new Set(projectAssets.map((asset) => asset.id));
  $: brandItems = brandAssets.flatMap((asset) => {
    const workspaceAsset = workspaceAssets.find(
      (candidate) => candidate.id === asset.assetId,
    );
    return workspaceAsset ? [workspaceAsset] : [];
  });
  $: videoItems = projectAssets.flatMap((asset) => {
    if (brandIds.has(asset.id)) return [];
    const workspaceAsset = workspaceAssets.find(
      (candidate) => candidate.id === asset.id,
    );
    return workspaceAsset ? [workspaceAsset] : [];
  });
  $: libraryItems = workspaceAssets.filter(
    (asset) => !brandIds.has(asset.id) && !projectIds.has(asset.id),
  );

  onDestroy(() => revokePreviews());

  async function refresh(): Promise<void> {
    if (!workspaceId) return;
    const version = ++refreshVersion;
    loading = true;
    error = "";
    try {
      const [assets, brand, attached] = await Promise.all([
        api.listWorkspaceAssets(workspaceId),
        api.getBrand(workspaceId).catch(() => null),
        projectId
          ? api.listProjectAssets(projectId).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (version !== refreshVersion) return;
      workspaceAssets = assets;
      brandAssets = brand?.assets ?? [];
      projectAssets = attached;
      await loadPreviews(assets, version);
    } catch (reason) {
      if (version !== refreshVersion) return;
      error =
        reason instanceof Error
          ? reason.message
          : "Assets could not be loaded.";
    } finally {
      if (version === refreshVersion) loading = false;
    }
  }

  async function loadPreviews(
    assets: readonly WorkspaceAsset[],
    version: number,
  ): Promise<void> {
    const entries = await Promise.all(
      assets.map(async (asset) => {
        if (
          !asset.contentType.startsWith("image/") &&
          !asset.contentType.startsWith("video/")
        ) {
          return [asset.id, ""] as const;
        }
        try {
          return [asset.id, await loadAssetObjectUrl(asset.id)] as const;
        } catch {
          return [asset.id, ""] as const;
        }
      }),
    );
    if (version !== refreshVersion) {
      entries.forEach(([, url]) => {
        if (url) URL.revokeObjectURL(url);
      });
      return;
    }
    revokePreviews();
    previews = Object.fromEntries(entries);
  }

  function revokePreviews(): void {
    Object.values(previews).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    previews = {};
  }

  async function uploadFiles(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    if (!workspaceId || files.length === 0 || uploading) return;
    uploading = true;
    uploadProgress = 0;
    try {
      for (const [index, file] of files.entries()) {
        await uploadAsset(workspaceId, file, (progress) => {
          uploadProgress = Math.round(
            ((index + progress / 100) / files.length) * 100,
          );
        });
      }
      onNotice(`${files.length} asset${files.length === 1 ? "" : "s"} added.`);
      await refresh();
    } catch (reason) {
      error = reason instanceof Error ? reason.message : "Upload failed.";
    } finally {
      uploading = false;
      uploadProgress = 0;
      input.value = "";
    }
  }

  function displayName(asset: WorkspaceAsset): string {
    return asset.label?.trim() || asset.fileName;
  }
</script>

{#snippet assetCard(
  asset: WorkspaceAsset,
  source: "brand" | "video" | "library",
)}
  <article class="asset-library-card">
    <div class="asset-library-preview">
      {#if previews[asset.id] && asset.contentType.startsWith("image/")}
        <img src={previews[asset.id]} alt={displayName(asset)} />
      {:else if previews[asset.id] && asset.contentType.startsWith("video/")}
        <video src={previews[asset.id]} muted preload="metadata"></video>
      {:else if asset.contentType.startsWith("video/")}
        <Film size={20} />
      {:else}
        <ImageIcon size={20} />
      {/if}
    </div>
    <div class="asset-library-copy">
      <strong title={displayName(asset)}>{displayName(asset)}</strong>
      <small
        >{source === "brand"
          ? "Brand asset"
          : source === "video"
            ? "In this video"
            : asset.contentType.split("/")[0]}</small
      >
    </div>
    {#if source !== "video"}
      <button
        type="button"
        class="asset-library-use"
        disabled={busy}
        aria-label={`Add ${displayName(asset)} to the next prompt`}
        title="Add to next prompt"
        on:click={() => onUse(asset)}><Plus size={14} /></button
      >
    {/if}
  </article>
{/snippet}

<section class="asset-library-panel" aria-label="Assets">
  <input
    bind:this={fileInput}
    class="sr-only"
    type="file"
    accept="image/*,video/*"
    multiple
    on:change={uploadFiles}
  />
  <div class="asset-library-actions">
    <button
      type="button"
      disabled={uploading}
      on:click={() => fileInput.click()}
    >
      {#if uploading}<LoaderCircle
          class="asset-library-spin"
          size={14}
        />{:else}<Upload size={14} />{/if}
      {uploading ? `${uploadProgress}%` : "Upload"}
    </button>
    <button
      type="button"
      aria-label="Refresh assets"
      title="Refresh"
      on:click={refresh}
      disabled={loading}
    >
      <RefreshCcw size={14} />
    </button>
  </div>

  {#if error}
    <p class="asset-library-error">{error}</p>
  {/if}

  {#if brandItems.length > 0}
    <div class="asset-library-heading">
      <h3>Brand assets</h3>
      <button
        type="button"
        on:click={onManageBrand}
        aria-label="Manage Brand Kit"
        title="Manage Brand Kit"><Settings2 size={14} /></button
      >
    </div>
    <div class="asset-library-list">
      {#each brandItems as asset (asset.id)}{@render assetCard(
          asset,
          "brand",
        )}{/each}
    </div>
  {/if}

  {#if videoItems.length > 0}
    <div class="asset-library-heading"><h3>Current video</h3></div>
    <div class="asset-library-list">
      {#each videoItems as asset (asset.id)}{@render assetCard(
          asset,
          "video",
        )}{/each}
    </div>
  {/if}

  <div class="asset-library-heading"><h3>Workspace assets</h3></div>
  {#if loading && workspaceAssets.length === 0}
    <p class="asset-library-empty">Loading assets…</p>
  {:else if libraryItems.length === 0}
    <p class="asset-library-empty">
      No other media yet. Upload an image or video to reuse it here.
    </p>
  {:else}
    <div class="asset-library-list">
      {#each libraryItems as asset (asset.id)}{@render assetCard(
          asset,
          "library",
        )}{/each}
    </div>
  {/if}
</section>

<script lang="ts">
  import { ImagePlus, LoaderCircle, RefreshCcw, Trash2 } from "lucide-svelte";
  import { BRAND_IMAGE_ACCEPT, type BrandAsset } from "../cloud/brand-dna";

  /**
   * The images the brand holds in one role. A single slot (logo, favicon)
   * shows one large preview with replace/remove; a gallery shows a grid.
   */
  export let assets: BrandAsset[];
  export let previews: Record<string, string>;
  export let single = false;
  export let uploading = 0;
  export let disabled = false;
  export let emptyLabel = "Drop an image or click to upload";
  export let small = false;
  /** Smaller tiles in a scrolling column, for side-by-side galleries. */
  export let compact = false;
  export let onupload: (files: File[]) => void;
  export let onremove: (assetId: string) => void;

  let input: HTMLInputElement;
  let dragging = false;

  function pick() {
    if (!disabled) input.click();
  }

  function receive(files: FileList | null | undefined) {
    const list = [...(files ?? [])].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (list.length) onupload(single ? list.slice(0, 1) : list);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    if (!disabled) receive(event.dataTransfer?.files);
  }

  function describe(asset: BrandAsset) {
    const size =
      asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : "";
    return `${asset.fileName}${size}`;
  }
</script>

<input
  bind:this={input}
  type="file"
  accept={BRAND_IMAGE_ACCEPT}
  multiple={!single}
  hidden
  on:change={(event) => {
    receive(event.currentTarget.files);
    event.currentTarget.value = "";
  }}
/>

{#if single && assets[0]}
  {@const asset = assets[0]}
  <div class="brand-slot" class:is-small={small}>
    <div class="brand-slot__frame">
      {#if previews[asset.assetId]}
        <img src={previews[asset.assetId]} alt={asset.fileName} />
      {:else}
        <LoaderCircle class="brand-spin" size={18} />
      {/if}
    </div>
    <div class="brand-slot__meta">
      <span class="brand-slot__name">{describe(asset)}</span>
      <div class="brand-slot__actions">
        <button type="button" class="brand-btn" on:click={pick} {disabled}>
          {#if uploading}<LoaderCircle
              class="brand-spin"
              size={14}
            />{:else}<RefreshCcw size={14} />{/if}
          Replace
        </button>
        <button
          type="button"
          class="brand-btn brand-btn--danger"
          on:click={() => onremove(asset.assetId)}
          {disabled}><Trash2 size={14} /> Remove</button
        >
      </div>
    </div>
  </div>
{:else}
  <div
    class="brand-gallery"
    class:is-single={single}
    class:is-compact={compact}
  >
    {#each single ? [] : assets as asset (asset.assetId)}
      <figure class="brand-tile">
        {#if previews[asset.assetId]}
          <img src={previews[asset.assetId]} alt={asset.fileName} />
        {:else}
          <LoaderCircle class="brand-spin" size={18} />
        {/if}
        <button
          type="button"
          class="brand-tile__remove"
          aria-label={`Remove ${asset.fileName}`}
          on:click={() => onremove(asset.assetId)}
          {disabled}><Trash2 size={13} /></button
        >
        <figcaption title={describe(asset)}>{asset.fileName}</figcaption>
      </figure>
    {/each}
    {#each Array(single ? 0 : uploading) as _}
      <div class="brand-tile is-pending">
        <LoaderCircle class="brand-spin" size={18} />
      </div>
    {/each}
    <button
      type="button"
      class="brand-drop"
      class:is-dragging={dragging}
      class:is-small={small}
      {disabled}
      on:click={pick}
      on:dragover|preventDefault={() => (dragging = true)}
      on:dragleave={() => (dragging = false)}
      on:drop={drop}
    >
      {#if single && uploading}
        <LoaderCircle class="brand-spin" size={20} />
        <span>Uploading…</span>
      {:else}
        <ImagePlus size={20} strokeWidth={1.7} />
        <span>{emptyLabel}</span>
        <small>PNG, JPG, WebP, GIF or SVG</small>
      {/if}
    </button>
  </div>
{/if}

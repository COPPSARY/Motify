<script lang="ts">
  import {
    Check,
    EyeOff,
    Folder,
    Image as ImageIcon,
    Loader2,
    Sparkles,
    TriangleAlert,
    Type,
    Upload,
  } from "lucide-svelte";
  import { formatCredits } from "../api/credits";
  import {
    PSD_MAX_LAYERS,
    PSD_TO_VIDEO_CREDITS,
    PsdImportError,
    drawsPixels,
    flattenLayers,
    readPsdFile,
    type PsdDocument,
    type PsdImportProgress,
    type PsdLayerNode,
  } from "./psd-import";

  /**
   * PSD to Video's start page (/psd): pick a .psd, see the layers Motify
   * found and what did not carry over, then turn it into a video: the layers
   * are uploaded, and Tiffy animates them before the editor opens.
   */

  export let workspaceId: string;
  /** The longest film the plan allows, in seconds; null for no limit. */
  export let maxSeconds: number | null = null;
  export let onSignIn: () => void;
  export let onCreate: (
    input: { document: PsdDocument; seconds: number; instructions: string },
    onProgress: (progress: PsdImportProgress) => void,
  ) => Promise<void>;

  const LENGTHS = [5, 8, 10, 15] as const;

  let fileInput: HTMLInputElement;
  let dragOver = false;
  let reading = "";
  /** How far the layers are matched to Photoshop's picture, 0..1; null before. */
  let matching: number | null = null;
  let error = "";
  let psd: PsdDocument | null = null;
  let seconds = 8;
  /** How the person wants it to move, in their own words; optional. */
  let instructions = "";
  let progress: PsdImportProgress | null = null;

  $: lengths = LENGTHS.filter(
    (value) => maxSeconds === null || value <= maxSeconds,
  );
  $: if (!lengths.includes(seconds as (typeof LENGTHS)[number]))
    seconds = lengths.at(-1) ?? 5;
  $: rows = psd ? layerRows(psd.layers, 0) : [];
  $: layerCount = psd ? flattenLayers(psd.layers).length : 0;
  $: notes = psd ? noteList(psd) : [];

  /** Top layer first, as in Photoshop's Layers panel. */
  function layerRows(
    layers: readonly PsdLayerNode[],
    depth: number,
  ): { layer: PsdLayerNode; depth: number }[] {
    return [...layers]
      .reverse()
      .flatMap((layer) => [
        { layer, depth },
        ...layerRows(layer.children, depth + 1),
      ]);
  }

  function noteList(document: PsdDocument): string[] {
    return [
      ...document.notes,
      ...(document.missingFonts.length > 0
        ? [
            `Motify doesn't include ${document.missingFonts.join(", ")}. Text in ${document.missingFonts.length === 1 ? "that font" : "those fonts"} shows in a similar font unless it is installed on this computer; switch a text layer to Image to keep its exact look.`,
          ]
        : []),
      ...flattenLayers(document.layers).flatMap((layer) =>
        layer.notes.map((note) => `${layer.name}: ${note}`),
      ),
    ];
  }

  async function open(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (fileInput) fileInput.value = "";
    if (!file) return;
    error = "";
    psd = null;
    reading = file.name;
    // Let the page say so before the parser takes the main thread.
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      psd = await readPsdFile(file, (share) => {
        matching = share;
      });
    } catch (failure) {
      error =
        failure instanceof PsdImportError
          ? failure.message
          : `This file could not be opened: ${failure instanceof Error ? failure.message : "unknown error"}.`;
    } finally {
      reading = "";
      matching = null;
    }
  }

  function toggleTextAsImage(layer: PsdLayerNode): void {
    layer.textAsImage = !layer.textAsImage;
    psd = psd;
  }

  async function create(): Promise<void> {
    if (!psd || progress) return;
    error = "";
    progress = { step: "upload", done: 0, total: 0 };
    try {
      await onCreate({ document: psd, seconds, instructions }, (next) => {
        progress = next;
      });
    } catch (failure) {
      error =
        failure instanceof Error
          ? failure.message
          : "The design could not be imported.";
    } finally {
      progress = null;
    }
  }

  /** Draws a layer, or the whole design, scaled to fit its canvas. */
  function paint(
    node: HTMLCanvasElement,
    source: { layer?: PsdLayerNode; document?: PsdDocument },
  ) {
    const draw = (next: typeof source) => {
      const context = node.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, node.width, node.height);
      const width = next.document?.width ?? next.layer?.canvas?.width ?? 0;
      const height = next.document?.height ?? next.layer?.canvas?.height ?? 0;
      if (!width || !height) return;
      const scale = Math.min(node.width / width, node.height / height);
      context.save();
      context.translate(
        (node.width - width * scale) / 2,
        (node.height - height * scale) / 2,
      );
      context.scale(scale, scale);
      if (next.document) {
        drawLayers(context, next.document.layers, 1);
      } else if (next.layer?.canvas) {
        context.drawImage(next.layer.canvas, 0, 0);
      }
      context.restore();
    };
    draw(source);
    return { update: draw };
  }

  /** The design drawn from the layers that will be imported, hidden ones left out. */
  function drawLayers(
    context: CanvasRenderingContext2D,
    layers: readonly PsdLayerNode[],
    alpha: number,
  ): void {
    for (const layer of layers) {
      if (layer.hidden) continue;
      if (layer.kind === "group") {
        drawLayers(context, layer.children, alpha * layer.opacity);
      } else if (layer.canvas) {
        context.globalAlpha = alpha * layer.opacity;
        // Canvas calls CSS's plus-lighter "lighter"; the rest share names.
        context.globalCompositeOperation = (
          layer.blend === "plus-lighter"
            ? "lighter"
            : (layer.blend ?? "source-over")
        ) as GlobalCompositeOperation;
        context.drawImage(layer.canvas, layer.left, layer.top);
      }
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }

  function kindLabel(layer: PsdLayerNode): string {
    if (layer.kind === "group") return "Group";
    if (layer.kind === "text")
      return drawsPixels(layer) ? "Text · image" : "Text";
    return "Image";
  }
</script>

<section class="fs psd" aria-labelledby="psd-title">
  <header class="fs-head">
    <span class="fs-badge">Beta</span>
    <h1 id="psd-title">PSD to Video</h1>
    <p>
      Upload a Photoshop file. Motify keeps every layer where you placed it, so
      each one stays editable, then Tiffy animates them into a video.
    </p>
  </header>

  <div class="fs-card">
    <div class="fs-step">
      <span>1</span><strong>Your Photoshop file</strong>
      {#if psd}<small
          >{psd.width}×{psd.height} px · {layerCount} layer{layerCount === 1
            ? ""
            : "s"}</small
        >{/if}
    </div>
    {#if reading}
      <div class="psd-reading" role="status" aria-live="polite">
        <Loader2 size={18} class="fx-spin" />
        <span
          ><strong
            >{#if matching === null}Reading the layers of {reading}…{:else}Matching
              every layer to Photoshop… {Math.round(
                matching * 100,
              )}%{/if}</strong
          ><small
            >Large files can take a little while. The file stays on this
            computer; only the layers are uploaded when you import.</small
          ></span
        >
      </div>
    {:else if !psd}
      <button
        type="button"
        class="fs-drop"
        class:fs-over={dragOver}
        on:click={() => fileInput.click()}
        on:dragover|preventDefault={() => (dragOver = true)}
        on:dragleave={() => (dragOver = false)}
        on:drop|preventDefault={(event) => {
          dragOver = false;
          void open(event.dataTransfer?.files ?? null);
        }}
      >
        <span class="fs-drop__icon"><Upload size={22} /></span>
        <strong>Drop a .psd file here</strong>
        <small
          >or click to choose · up to 500 MB and {PSD_MAX_LAYERS} layers · keep layers
          named, it helps Tiffy animate them</small
        >
      </button>
    {:else}
      <div class="psd-review">
        <figure class="psd-preview">
          <canvas
            width={480}
            height={480}
            use:paint={{ document: psd }}
            aria-label={`Preview of ${psd.name}`}
          ></canvas>
          <figcaption>{psd.name}</figcaption>
        </figure>
        <ul class="psd-layers" aria-label="Layers found">
          {#each rows as { layer, depth } (layer.id)}
            <li class="psd-layer-row" style:--psd-depth={depth}>
              {#if layer.kind === "group"}
                <span class="psd-thumb psd-thumb--icon"
                  ><Folder size={15} /></span
                >
              {:else if layer.canvas}
                <canvas
                  class="psd-thumb"
                  width={40}
                  height={40}
                  use:paint={{ layer }}
                ></canvas>
              {:else}
                <span class="psd-thumb psd-thumb--icon"><Type size={15} /></span
                >
              {/if}
              <span class="psd-layer-name" title={layer.name}>{layer.name}</span
              >
              {#if layer.hidden}
                <span class="psd-tag" title="Hidden in Photoshop; stays hidden"
                  ><EyeOff size={12} /></span
                >
              {/if}
              {#if layer.notes.length > 0}
                <span
                  class="psd-tag psd-tag--warn"
                  title={layer.notes.join(" ")}
                  ><TriangleAlert size={12} /></span
                >
              {/if}
              {#if layer.kind === "text" && layer.text && layer.canvas}
                <span
                  class="psd-text-mode"
                  role="group"
                  aria-label={`${layer.name} as`}
                >
                  <button
                    type="button"
                    class:fs-on={!layer.textAsImage}
                    aria-pressed={!layer.textAsImage}
                    title="Editable text"
                    on:click={() =>
                      layer.textAsImage && toggleTextAsImage(layer)}
                    ><Type size={12} /></button
                  >
                  <button
                    type="button"
                    class:fs-on={layer.textAsImage}
                    aria-pressed={layer.textAsImage === true}
                    title="Exactly as Photoshop drew it"
                    on:click={() =>
                      !layer.textAsImage && toggleTextAsImage(layer)}
                    ><ImageIcon size={12} /></button
                  >
                </span>
              {:else}
                <span class="psd-kind">{kindLabel(layer)}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
      {#if notes.length > 0}
        <details class="psd-notes">
          <summary
            ><TriangleAlert size={14} />
            {notes.length} thing{notes.length === 1 ? "" : "s"} from Photoshop won't
            carry over exactly</summary
          >
          <ul>
            {#each notes as note, index (index)}<li>{note}</li>{/each}
          </ul>
        </details>
      {/if}
      <button
        type="button"
        class="psd-change"
        disabled={Boolean(progress)}
        on:click={() => fileInput.click()}>Choose another file</button
      >
    {/if}
    <input
      bind:this={fileInput}
      type="file"
      accept=".psd,image/vnd.adobe.photoshop"
      hidden
      on:change={(event) =>
        open((event.currentTarget as HTMLInputElement).files)}
    />
  </div>

  {#if psd}
    <div class="fs-card">
      <div class="fs-step">
        <span>2</span><strong>How long should the video be?</strong>
      </div>
      <div class="fs-segmented" role="group" aria-label="Video length">
        {#each lengths as value (value)}
          <button
            type="button"
            class:fs-on={seconds === value}
            aria-pressed={seconds === value}
            disabled={Boolean(progress)}
            on:click={() => (seconds = value)}>{value}s</button
          >
        {/each}
      </div>
    </div>

    <label class="fs-card psd-prompt">
      <span class="fs-step">
        <span>3</span><strong>How should it move?</strong><small>Optional</small
        >
      </span>
      <textarea
        rows="3"
        maxlength="2000"
        placeholder="e.g. Calm and premium: the product rises in first, the headline types on, the price pops in at the end."
        disabled={Boolean(progress)}
        bind:value={instructions}
      ></textarea>
    </label>
  {/if}

  {#if error}<p class="fs-error" role="alert">{error}</p>{/if}

  {#if progress}
    <div class="fs-progress" role="status" aria-live="polite">
      <ol>
        <li
          class:fs-done={progress.step !== "upload"}
          class:fs-now={progress.step === "upload"}
        >
          <span class="fs-dot"
            >{#if progress.step !== "upload"}<Check size={13} />{:else}<Loader2
                size={13}
                class="fx-spin"
              />{/if}</span
          >
          <span
            ><strong>Uploading the layers</strong><small
              >{progress.done}/{progress.total} images</small
            ></span
          >
        </li>
        <li class:fs-now={progress.step === "open"}>
          <span class="fs-dot"
            >{#if progress.step === "open"}<Loader2
                size={13}
                class="fx-spin"
              />{/if}</span
          >
          <span
            ><strong>Animating your layers</strong><small
              >The editor opens when the video is ready</small
            ></span
          >
        </li>
      </ol>
    </div>
  {/if}

  {#if psd}
    <footer class="fs-foot" hidden={Boolean(progress)}>
      {#if workspaceId}
        <small
          >Tiffy reads the layers and animates each one · {formatCredits(
            PSD_TO_VIDEO_CREDITS,
          )} credits, whatever the length. You can preview, edit and re-animate in
          the editor.</small
        >
        <button type="button" class="fs-primary" on:click={() => void create()}
          ><Sparkles size={16} /> Generate video</button
        >
      {:else}
        <!-- The file was read on this computer; saving it needs an account. -->
        <small>Sign in to turn these layers into a video.</small>
        <button type="button" class="fs-primary" on:click={onSignIn}
          >Sign in to generate</button
        >
      {/if}
    </footer>
  {/if}
</section>

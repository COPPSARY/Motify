<script lang="ts">
  import { onMount, tick } from "svelte";
  import { ArrowRight, Download, X } from "lucide-svelte";
  import {
    CANVAS_ASPECTS,
    type CanvasAspect,
    type CanvasFraming,
    type CanvasSettings,
  } from "../composition/canvas-frame";
  import {
    FPS_CHOICES,
    FREE_MAX_HEIGHT,
    QUALITY_LABELS,
    RESOLUTION_HEIGHTS,
    SPEED_CHOICES,
    defaultExportSettings,
    estimateExport,
    formatBytes,
    formatDuration,
    loadSavedExportSettings,
    outputSize,
    resolveRange,
    saveExportSettings,
    type ExportFormat,
    type ExportHistoryItem,
    type ExportQuality,
    type ExportRangeMode,
    type ExportSettings,
  } from "../composition/export-options";

  export let width: number;
  export let height: number;
  export let fps: number;
  export let duration: number;
  export let currentScene: {
    label: string;
    start: number;
    duration: number;
  } | null = null;
  export let defaultName = "";
  export let aspect: CanvasAspect = "16:9";
  export let framing: CanvasFraming = "fit";
  export let framingApplies = false;
  /** Changes the editor's canvas, so the preview follows the choice. */
  export let onCanvasChange: (settings: Partial<CanvasSettings>) => void = () =>
    undefined;
  export let paid = false;
  export let exporting = false;
  export let progress = 0;
  export let statusText = "";
  export let etaSeconds: number | undefined = undefined;
  export let history: ExportHistoryItem[] = [];
  /** The newest finished export, shown as a result card. */
  export let result: ExportHistoryItem | null = null;
  export let support: { video: boolean; mp4: boolean; webm: boolean } | null =
    null;
  export let onStart: (settings: ExportSettings) => void;
  export let onCancel: () => void;
  export let onClose: () => void;
  export let onDownload: (item: ExportHistoryItem) => void;
  /** Receives the canvas the dialog draws live frames into. */
  export let onPreviewCanvas: (canvas: HTMLCanvasElement | null) => void = () =>
    undefined;

  const FORMATS: { value: ExportFormat; label: string }[] = [
    { value: "mp4", label: "MP4" },
    { value: "webm", label: "WebM" },
    { value: "png", label: "PNG" },
  ];
  const RANGES: { value: ExportRangeMode; label: string }[] = [
    { value: "full", label: "Full" },
    { value: "scene", label: "Scene" },
    { value: "selection", label: "Custom" },
  ];
  const QUALITIES = Object.keys(QUALITY_LABELS) as ExportQuality[];

  let settings: ExportSettings = {
    ...defaultExportSettings(fps, duration),
    ...loadSavedExportSettings(),
  };
  // The name is per export, so it starts from the project's title.
  settings.filename = defaultName;
  let previewCanvas: HTMLCanvasElement | undefined;
  let dialog: HTMLDivElement | undefined;

  const heightLocked = (value: number): boolean =>
    !paid && value > FREE_MAX_HEIGHT;
  const heightLabel = (value: number): string =>
    value === 2160 ? "4K" : `${value}p`;
  const formatUnsupported = (format: ExportFormat): boolean =>
    support !== null && format !== "png" && !support[format];

  $: size = outputSize(width, height, settings.height);
  $: range = resolveRange(settings, duration, currentScene ?? undefined);
  $: estimate = estimateExport(settings, width, height, range);
  $: isStill = settings.format === "png";
  $: blockedReason = formatUnsupported(settings.format)
    ? support && !support.video
      ? "Use the latest Chrome or Edge to export video."
      : `This browser cannot encode ${settings.format.toUpperCase()}.`
    : "";
  $: selectionInvalid =
    settings.range === "selection" &&
    !(
      settings.selectionEnd > settings.selectionStart &&
      settings.selectionStart >= 0 &&
      settings.selectionEnd <= duration + 1e-6
    );
  $: percent = Math.round(progress * 100);
  $: onPreviewCanvas(exporting ? (previewCanvas ?? null) : null);

  onMount(() => {
    onPreviewCanvas(null);
    if (heightLocked(settings.height)) settings.height = FREE_MAX_HEIGHT;
    void tick().then(() => dialog?.focus());
    return () => onPreviewCanvas(null);
  });

  function start(): void {
    if (blockedReason || selectionInvalid || exporting) return;
    saveExportSettings(settings);
    onStart(settings);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !exporting) onClose();
  }

  function number(event: Event): number {
    return Number((event.currentTarget as HTMLInputElement).value);
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="export-overlay" role="presentation">
  <div
    class="export-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="export-title"
    tabindex="-1"
    bind:this={dialog}
  >
    <button
      class="export-close"
      aria-label="Close"
      disabled={exporting}
      on:click={onClose}><X size={16} /></button
    >
    <h3 id="export-title">Export settings</h3>

    {#if exporting}
      <canvas
        class="export-live"
        width={Math.min(size.width, 640)}
        height={Math.round(
          (Math.min(size.width, 640) / size.width) * size.height,
        )}
        bind:this={previewCanvas}
      ></canvas>
      <div
        class="export-bar"
        role="progressbar"
        aria-label="Export progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percent}
      >
        <span style={`width:${percent}%`}></span>
      </div>
      <p class="export-sub" aria-live="polite">
        {statusText || "Preparing…"}{etaSeconds === undefined
          ? ""
          : ` · ${formatDuration(etaSeconds)} left`}
      </p>
      <button class="export-secondary" on:click={onCancel}>Cancel</button>
    {:else if result}
      <p class="export-sub">{result.name} · {formatBytes(result.bytes)}</p>
      <p class="export-sub">{result.detail}</p>
      <div class="export-row-buttons">
        <button class="export-secondary" on:click={onClose}>Done</button>
        <button class="export-primary" on:click={() => onDownload(result!)}
          ><Download size={15} /> Download</button
        >
      </div>
    {:else}
      <p class="export-sub">
        {#if isStill}
          {size.width}×{size.height}
        {:else}
          Estimated output file size
          <span class="export-chip">≈ {formatBytes(estimate.bytes)}</span>
        {/if}
      </p>

      <div class="export-field">
        <label class="export-label" for="export-name">File name</label>
        <div class="export-name">
          <input
            id="export-name"
            type="text"
            maxlength="100"
            autocomplete="off"
            spellcheck="false"
            placeholder="motify-video"
            bind:value={settings.filename}
            on:keydown={(event) => event.key === "Enter" && start()}
          />
          <span>.{settings.format}</span>
        </div>
      </div>

      <div class="export-top">
        <div class="export-field">
          <span class="export-label" id="lbl-format">Format</span>
          <div class="seg" role="radiogroup" aria-labelledby="lbl-format">
            {#each FORMATS as option (option.value)}
              <button
                role="radio"
                aria-checked={settings.format === option.value}
                class:on={settings.format === option.value}
                disabled={formatUnsupported(option.value)}
                on:click={() => (settings.format = option.value)}
                >{option.label}</button
              >
            {/each}
          </div>
        </div>
        <div class="export-field narrow" class:off={isStill}>
          <label class="export-label" for="export-fps">Frame rate</label>
          <select id="export-fps" bind:value={settings.fps} disabled={isStill}>
            {#each FPS_CHOICES as option (option)}
              <option value={option}>{option} FPS</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="export-field">
        <span class="export-label" id="lbl-aspect">Canvas</span>
        <div class="seg" role="radiogroup" aria-labelledby="lbl-aspect">
          {#each CANVAS_ASPECTS as option (option)}
            <button
              role="radio"
              aria-checked={aspect === option}
              class:on={aspect === option}
              on:click={() => onCanvasChange({ aspect: option })}
              >{option}</button
            >
          {/each}
        </div>
      </div>

      {#if framingApplies}
        <div class="export-field">
          <span class="export-label" id="lbl-framing">Framing</span>
          <div class="seg" role="radiogroup" aria-labelledby="lbl-framing">
            {#each ["fit", "fill"] as const as option (option)}
              <button
                role="radio"
                aria-checked={framing === option}
                class:on={framing === option}
                on:click={() => onCanvasChange({ framing: option })}
                >{option === "fit" ? "Fit" : "Fill"}</button
              >
            {/each}
          </div>
        </div>
      {/if}

      <div class="export-field">
        <span class="export-label" id="lbl-res">Resolution</span>
        <div class="seg" role="radiogroup" aria-labelledby="lbl-res">
          {#each RESOLUTION_HEIGHTS as option (option)}
            <button
              role="radio"
              aria-checked={settings.height === option}
              class:on={settings.height === option}
              disabled={heightLocked(option)}
              on:click={() => (settings.height = option)}
              >{heightLabel(option)}</button
            >
          {/each}
        </div>
      </div>

      <div class="export-field" class:off={isStill}>
        <span class="export-label" id="lbl-quality">Compression</span>
        <div class="seg" role="radiogroup" aria-labelledby="lbl-quality">
          {#each QUALITIES as option (option)}
            <button
              role="radio"
              aria-checked={settings.quality === option}
              class:on={settings.quality === option}
              disabled={isStill}
              on:click={() => (settings.quality = option)}
              >{QUALITY_LABELS[option]}</button
            >
          {/each}
        </div>
      </div>

      <div class="export-field" class:off={isStill}>
        <span class="export-label" id="lbl-speed">Speed</span>
        <div class="seg" role="radiogroup" aria-labelledby="lbl-speed">
          {#each SPEED_CHOICES as option (option)}
            <button
              role="radio"
              aria-checked={settings.speed === option}
              class:on={settings.speed === option}
              disabled={isStill}
              on:click={() => (settings.speed = option)}
              >{option === 1 ? "Default" : option}</button
            >
          {/each}
        </div>
      </div>

      <div class="export-field" class:off={isStill}>
        <span class="export-label" id="lbl-range">Range</span>
        <div class="seg" role="radiogroup" aria-labelledby="lbl-range">
          {#each RANGES as option (option.value)}
            <button
              role="radio"
              aria-checked={settings.range === option.value}
              class:on={settings.range === option.value}
              disabled={isStill || (option.value === "scene" && !currentScene)}
              on:click={() => (settings.range = option.value)}
              >{option.label}</button
            >
          {/each}
        </div>
        {#if settings.range === "selection" && !isStill}
          <div class="export-custom">
            <input
              type="number"
              aria-label="Start in seconds"
              min="0"
              max={duration}
              step="0.1"
              value={settings.selectionStart}
              on:input={(event) => (settings.selectionStart = number(event))}
            />
            <span>to</span>
            <input
              type="number"
              aria-label="End in seconds"
              min="0"
              max={duration}
              step="0.1"
              value={settings.selectionEnd}
              on:input={(event) => (settings.selectionEnd = number(event))}
            />
            <span>s</span>
          </div>
        {/if}
      </div>

      {#if blockedReason || selectionInvalid}
        <div class="export-box" role="status">
          {#if blockedReason}
            <strong>{blockedReason}</strong>
          {:else if selectionInvalid}
            <strong>Enter a valid range.</strong>
          {/if}
        </div>
      {/if}

      {#if history.length > 0}
        <div class="export-history">
          {#each history as item (item.id)}
            <button on:click={() => onDownload(item)}
              ><Download size={12} />
              {item.name} · {formatBytes(item.bytes)}</button
            >
          {/each}
        </div>
      {/if}

      <button
        class="export-primary"
        disabled={Boolean(blockedReason) || selectionInvalid}
        on:click={start}
      >
        Confirm and export <ArrowRight size={16} />
      </button>
    {/if}
  </div>
</div>

<style>
  /* Motify's editor palette: near-black panels, hairline borders, and a pale
     accent with dark ink. Fallbacks keep it right outside .code-editor-scope. */
  .export-overlay {
    --bg: var(--sl-bg, #0a0a0a);
    --panel: var(--sl-panel, #111111);
    --surface: var(--sl-surface, #1a1a1a);
    --surface-hover: var(--sl-surface-hover, #222222);
    --border: var(--sl-border, rgba(255, 255, 255, 0.06));
    --border-strong: var(--sl-border-strong, rgba(255, 255, 255, 0.11));
    --text: var(--sl-text, #ededed);
    --soft: var(--sl-text-soft, #b4b4b4);
    --muted: var(--sl-muted, #858585);
    --accent: var(--sl-accent, #c7c7cc);
    --accent-hover: var(--sl-accent-hover, #dedee2);
    --ink: var(--sl-accent-ink, #111113);
    --radius: var(--sl-radius, 8px);
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(3px);
    font-family: inherit;
  }
  .export-dialog {
    position: relative;
    width: min(400px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow: auto;
    padding: 18px;
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    background: var(--panel);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
    color: var(--text);
    outline: none;
    display: grid;
    gap: 14px;
  }
  h3 {
    margin: 0;
    padding-right: 32px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .export-close {
    position: absolute;
    top: 12px;
    right: 12px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--radius);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition:
      background-color 0.14s ease,
      color 0.14s ease;
  }
  .export-close:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text);
  }
  .export-close:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .export-sub {
    margin: -6px 0 0;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .export-chip {
    margin-left: 4px;
    padding: 2px 7px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
  }
  .export-top {
    display: flex;
    gap: 10px;
  }
  .export-field {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .export-top .export-field:first-child {
    flex: 1;
  }
  .export-field.narrow {
    width: 112px;
  }
  .export-field.off {
    opacity: 0.4;
  }
  .export-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--soft);
  }
  .seg {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
  }
  .seg button {
    flex: 1;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--radius);
    background: transparent;
    color: var(--soft);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.14s ease,
      color 0.14s ease;
  }
  .seg button:hover:not(:disabled):not(.on) {
    background: var(--surface-hover);
    color: var(--text);
  }
  .seg button.on {
    background: var(--accent);
    color: var(--ink);
  }
  .seg button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  select,
  input {
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 13px;
  }
  .export-name {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 13px;
  }
  .export-name input {
    flex: 1;
    min-width: 0;
  }
  .export-custom {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--muted);
  }
  .export-custom input {
    width: 76px;
    height: 28px;
  }
  .export-box {
    padding: 9px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--surface);
    font-size: 12px;
    color: var(--soft);
  }
  .export-history {
    display: grid;
    gap: 2px;
  }
  .export-history button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }
  .export-history button:hover {
    color: var(--text);
  }
  .export-primary,
  .export-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 36px;
    border: 0;
    border-radius: var(--radius);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.14s ease,
      color 0.14s ease;
  }
  .export-primary {
    flex: 1;
    background: var(--accent);
    color: var(--ink);
  }
  .export-primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  .export-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .export-secondary {
    padding: 0 16px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text);
  }
  .export-secondary:hover {
    background: var(--surface-hover);
  }
  .export-row-buttons {
    display: flex;
    gap: 8px;
  }
  .export-live {
    width: 100%;
    height: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #000;
  }
  .export-bar {
    height: 4px;
    border-radius: 2px;
    background: var(--surface-hover);
    overflow: hidden;
  }
  .export-bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.15s linear;
  }
  button:focus-visible,
  select:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .export-bar span,
    .seg button,
    .export-primary {
      transition: none;
    }
  }
</style>

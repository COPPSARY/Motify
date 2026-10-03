<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    Check,
    FileType,
    Italic,
    LoaderCircle,
    Trash2,
    Upload,
    X,
  } from "lucide-svelte";
  import { loadAssetObjectUrl } from "../api/assets";
  import {
    BRAND_FONT_ROLES,
    BRAND_FONT_WEIGHTS,
    BRAND_LIMITS,
    PRESET_FONTS,
    newItemId,
    type BrandFont,
    type BrandFontRole,
  } from "../cloud/brand-dna";
  import {
    FONT_ACCEPT,
    collectFontFiles,
    guessFamily,
    guessStyle,
    guessWeight,
  } from "./font-files";

  /**
   * The brand's typefaces: pick from typefaces that are guaranteed to render,
   * or drop the brand's own files. Uploaded files are loaded into the page with
   * the FontFace API so every preview is set in the real font.
   */
  export let fonts: BrandFont[];
  export let disabled = false;
  /** Uploads one font file and links it to the brand; resolves to its asset id. */
  export let upload: (file: File) => Promise<string>;
  export let onnotice: (message: string) => void = () => {};

  const WEIGHT_NAMES: Record<number, string> = {
    100: "Thin",
    200: "ExtraLight",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "SemiBold",
    700: "Bold",
    800: "ExtraBold",
    900: "Black",
  };

  let input: HTMLInputElement;
  let dragging = false;
  let uploading = 0;
  const loaded = new Set<string>();
  const objectUrls: string[] = [];

  $: void loadExisting(fonts);

  onDestroy(() => objectUrls.forEach((url) => URL.revokeObjectURL(url)));

  /** The family name the page registers a brand font's files under. */
  function previewFamily(font: BrandFont): string {
    if (font.source === "upload") return `"bdf-${font.id}", Inter, sans-serif`;
    return (
      PRESET_FONTS.find((preset) => preset.family === font.family)?.stack ??
      `"${font.family.replace(/"/g, "")}", Inter, sans-serif`
    );
  }

  async function register(
    font: BrandFont,
    file: { assetId: string; weight: number; style: string },
    source: string,
  ) {
    const key = `${font.id}:${file.assetId}`;
    if (loaded.has(key)) return;
    loaded.add(key);
    try {
      const face = new FontFace(`bdf-${font.id}`, `url("${source}")`, {
        weight: String(file.weight),
        style: file.style,
      });
      document.fonts.add(await face.load());
    } catch {
      loaded.delete(key);
    }
  }

  async function loadExisting(current: readonly BrandFont[]) {
    for (const font of current) {
      if (font.source !== "upload") continue;
      for (const file of font.files) {
        if (loaded.has(`${font.id}:${file.assetId}`)) continue;
        try {
          const url = await loadAssetObjectUrl(file.assetId);
          objectUrls.push(url);
          await register(font, file, url);
        } catch {
          // The row still shows the family name; only the preview is plain.
        }
      }
    }
  }

  function nextRole(): BrandFontRole {
    const taken = new Set(fonts.map((font) => font.role));
    if (!taken.has("heading")) return "heading";
    if (!taken.has("body")) return "body";
    return "accent";
  }

  function isPicked(family: string) {
    return fonts.some(
      (font) => font.source === "preset" && font.family === family,
    );
  }

  function togglePreset(family: string) {
    if (isPicked(family)) {
      fonts = fonts.filter(
        (font) => !(font.source === "preset" && font.family === family),
      );
      return;
    }
    if (fonts.length >= BRAND_LIMITS.fonts) {
      onnotice(`A brand can have up to ${BRAND_LIMITS.fonts} typefaces.`);
      return;
    }
    fonts = [
      ...fonts,
      {
        id: newItemId(),
        family,
        role: nextRole(),
        source: "preset",
        files: [],
      },
    ];
  }

  async function receive(list: FileList | File[] | null | undefined) {
    if (disabled || !list) return;
    const { fonts: files, skipped } = await collectFontFiles([...list]);
    if (skipped.length) onnotice(`Skipped ${skipped.join(", ")}.`);
    uploading += files.length;
    for (const file of files) {
      try {
        const family = guessFamily(file.name);
        let font = fonts.find(
          (entry) =>
            entry.source === "upload" &&
            entry.family.toLowerCase() === family.toLowerCase(),
        );
        if (!font) {
          if (fonts.length >= BRAND_LIMITS.fonts) {
            onnotice(`A brand can have up to ${BRAND_LIMITS.fonts} typefaces.`);
            continue;
          }
          font = {
            id: newItemId(),
            family,
            role: nextRole(),
            source: "upload",
            files: [],
          };
          fonts = [...fonts, font];
        }
        if (font.files.length >= BRAND_LIMITS.fontFiles) continue;
        const assetId = await upload(file);
        const entry = {
          assetId,
          weight: guessWeight(file.name),
          style: guessStyle(file.name),
        };
        const target = font;
        fonts = fonts.map((candidate) =>
          candidate.id === target.id
            ? { ...candidate, files: [...candidate.files, entry] }
            : candidate,
        );
        const url = URL.createObjectURL(file);
        objectUrls.push(url);
        await register(target, entry, url);
      } catch (error) {
        onnotice(
          error instanceof Error
            ? error.message
            : `${file.name} could not be uploaded.`,
        );
      } finally {
        uploading -= 1;
      }
    }
    // A family whose every upload failed is not worth keeping.
    fonts = fonts.filter(
      (font) => font.source !== "upload" || font.files.length > 0,
    );
  }

  function updateFile(
    fontId: string,
    assetId: string,
    patch: Partial<{ weight: number; style: "normal" | "italic" }>,
  ) {
    fonts = fonts.map((font) =>
      font.id !== fontId
        ? font
        : {
            ...font,
            files: font.files.map((file) =>
              file.assetId === assetId ? { ...file, ...patch } : file,
            ),
          },
    );
    // Re-register under the new weight/style so the preview follows.
    const font = fonts.find((entry) => entry.id === fontId);
    const file = font?.files.find((entry) => entry.assetId === assetId);
    if (font && file) {
      loaded.delete(`${font.id}:${assetId}`);
      void loadAssetObjectUrl(assetId)
        .then((url) => {
          objectUrls.push(url);
          return register(font, file, url);
        })
        .catch(() => undefined);
    }
  }

  function removeFile(fontId: string, assetId: string) {
    fonts = fonts
      .map((font) =>
        font.id !== fontId
          ? font
          : {
              ...font,
              files: font.files.filter((file) => file.assetId !== assetId),
            },
      )
      .filter((font) => font.source !== "upload" || font.files.length > 0);
  }

  function removeFont(fontId: string) {
    fonts = fonts.filter((font) => font.id !== fontId);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    void receive(event.dataTransfer?.files);
  }
</script>

<div class="bd-type">
  {#if fonts.length}
    <ul class="bd-type__chosen">
      {#each fonts as font (font.id)}
        <li class="bd-type__font">
          <span
            class="bd-type__aa"
            style={`font-family: ${previewFamily(font)}`}>Aa</span
          >
          <div class="bd-type__meta">
            {#if font.source === "upload"}
              <input
                class="bd-input bd-input--bare bd-type__family"
                maxlength="80"
                aria-label="Family name"
                bind:value={font.family}
              />
            {:else}
              <span class="bd-type__family bd-type__family--static"
                >{font.family}</span
              >
            {/if}
            {#if font.source === "upload"}
              <div class="bd-type__files">
                {#each font.files as file (file.assetId)}
                  <span class="bd-file">
                    <select
                      aria-label="Weight"
                      value={file.weight}
                      on:change={(event) =>
                        updateFile(font.id, file.assetId, {
                          weight: Number(event.currentTarget.value),
                        })}
                    >
                      {#each BRAND_FONT_WEIGHTS as weight}
                        <option value={weight}
                          >{weight} {WEIGHT_NAMES[weight]}</option
                        >
                      {/each}
                    </select>
                    <button
                      type="button"
                      class="bd-file__italic"
                      class:is-on={file.style === "italic"}
                      aria-pressed={file.style === "italic"}
                      title="Italic"
                      on:click={() =>
                        updateFile(font.id, file.assetId, {
                          style: file.style === "italic" ? "normal" : "italic",
                        })}><Italic size={12} /></button
                    >
                    <button
                      type="button"
                      class="bd-file__remove"
                      aria-label="Remove file"
                      on:click={() => removeFile(font.id, file.assetId)}
                      ><X size={12} /></button
                    >
                  </span>
                {/each}
              </div>
            {:else}
              <span class="bd-type__note">Ready to use</span>
            {/if}
          </div>
          <select
            class="bd-input bd-select bd-type__role"
            bind:value={font.role}
          >
            {#each BRAND_FONT_ROLES as role}
              <option value={role}>{role}</option>
            {/each}
          </select>
          <button
            type="button"
            class="bd-icon"
            aria-label={`Remove ${font.family}`}
            on:click={() => removeFont(font.id)}><Trash2 size={14} /></button
          >
        </li>
      {/each}
    </ul>
  {/if}

  <div class="bd-type__presets" role="group" aria-label="Ready-made typefaces">
    {#each PRESET_FONTS as preset (preset.family)}
      <button
        type="button"
        class="bd-preset"
        class:is-on={isPicked(preset.family)}
        aria-pressed={isPicked(preset.family)}
        on:click={() => togglePreset(preset.family)}
      >
        <span class="bd-preset__aa" style={`font-family: ${preset.stack}`}
          >Aa</span
        >
        <span class="bd-preset__name">{preset.family}</span>
        <span class="bd-preset__kind">{preset.kind}</span>
        {#if isPicked(preset.family)}<span class="bd-preset__check"
            ><Check size={11} strokeWidth={3} /></span
          >{/if}
      </button>
    {/each}
  </div>

  <input
    bind:this={input}
    type="file"
    accept={FONT_ACCEPT}
    multiple
    hidden
    on:change={(event) => {
      void receive(event.currentTarget.files);
      event.currentTarget.value = "";
    }}
  />
  <button
    type="button"
    class="bd-fontdrop"
    class:is-dragging={dragging}
    {disabled}
    on:click={() => input.click()}
    on:dragover|preventDefault={() => (dragging = true)}
    on:dragleave={() => (dragging = false)}
    on:drop={drop}
  >
    {#if uploading}
      <LoaderCircle class="brand-spin" size={18} />
      <span>Uploading {uploading} file{uploading === 1 ? "" : "s"}…</span>
    {:else}
      <span class="bd-fontdrop__icon"><FileType size={18} /></span>
      <span class="bd-fontdrop__text">
        <strong>Drop your brand fonts</strong>
        <small
          >.ttf, .otf, .woff, .woff2, or a .zip of them. Weights are read from
          the file names.</small
        >
      </span>
      <span class="bd-fontdrop__cta"><Upload size={14} /> Browse</span>
    {/if}
  </button>
</div>

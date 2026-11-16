<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowLeft, Check, Sparkles } from "lucide-svelte";

  import { CAPTION_LOOKS } from "./presets";
  import type { FootageFormat } from "./edit";

  /**
   * The last step before a video is made, after "Create my video": its shape,
   * its subtitles and how they look, each shown as it will look rather than
   * named in a list.
   */
  export let format: FootageFormat;
  export let captionLanguage: string;
  export let captionStyle: string;
  export let busy = false;
  export let onClose: () => void;
  export let onConfirm: () => void;

  const SHAPES: Array<{
    value: FootageFormat;
    label: string;
    hint: string;
    w: number;
    h: number;
  }> = [
    {
      value: "9:16",
      label: "Vertical",
      hint: "TikTok · Reels · Shorts",
      w: 54,
      h: 96,
    },
    {
      value: "1:1",
      label: "Square",
      hint: "Facebook · Instagram",
      w: 80,
      h: 80,
    },
    { value: "16:9", label: "Wide", hint: "YouTube · website", w: 120, h: 68 },
  ];

  const LANGUAGES: Array<{ value: string; label: string; sample: string }> = [
    { value: "km", label: "Khmer", sample: "សួស្តី" },
    { value: "km+en", label: "Khmer + English", sample: "សួស្តី · Hello" },
    { value: "en", label: "English", sample: "Hello" },
    { value: "auto", label: "As spoken", sample: "Auto" },
    { value: "none", label: "None", sample: "—" },
  ];

  let dialog: HTMLDivElement;
  onMount(() => dialog?.focus());

  function keydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !busy) onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="fsu-backdrop" on:click|self={() => !busy && onClose()}>
  <div
    class="fsu"
    role="dialog"
    aria-modal="true"
    aria-labelledby="fsu-title"
    tabindex="-1"
    bind:this={dialog}
    on:keydown={keydown}
  >
    <header>
      <h2 id="fsu-title">How should it look?</h2>
      <p>You can change all of this in the editor later.</p>
    </header>

    <section aria-labelledby="fsu-shape">
      <h3 id="fsu-shape">Shape</h3>
      <div class="fsu-shapes" role="radiogroup" aria-labelledby="fsu-shape">
        {#each SHAPES as shape (shape.value)}
          <button
            type="button"
            role="radio"
            aria-checked={format === shape.value}
            class="fsu-shape"
            class:fsu-on={format === shape.value}
            on:click={() => (format = shape.value)}
          >
            <span class="fsu-shape__stage">
              <span
                class="fsu-shape__frame"
                style:width={`${shape.w}px`}
                style:height={`${shape.h}px`}
              >
                <span class="fsu-shape__subject"></span>
                <span class="fsu-shape__caption"></span>
              </span>
            </span>
            <strong>{shape.label} <small>{shape.value}</small></strong>
            <small>{shape.hint}</small>
            {#if format === shape.value}<span class="fsu-tick"
                ><Check size={12} /></span
              >{/if}
          </button>
        {/each}
      </div>
    </section>

    <section aria-labelledby="fsu-subs">
      <h3 id="fsu-subs">Subtitles</h3>
      <div class="fsu-chips" role="radiogroup" aria-labelledby="fsu-subs">
        {#each LANGUAGES as language (language.value)}
          <button
            type="button"
            role="radio"
            aria-checked={captionLanguage === language.value}
            class:fsu-on={captionLanguage === language.value}
            on:click={() => (captionLanguage = language.value)}
          >
            <span lang="km">{language.sample}</span>
            {language.label}
          </button>
        {/each}
      </div>
    </section>

    {#if captionLanguage !== "none"}
      <section aria-labelledby="fsu-look">
        <h3 id="fsu-look">Caption look</h3>
        <div class="fsu-looks" role="radiogroup" aria-labelledby="fsu-look">
          {#each CAPTION_LOOKS as look (look.value)}
            <button
              type="button"
              role="radio"
              aria-checked={captionStyle === look.value}
              class="fsu-look"
              class:fsu-on={captionStyle === look.value}
              on:click={() => (captionStyle = look.value)}
            >
              <span class={`fsu-sample fsu-sample--${look.value}`}>
                {#if look.value === "stack"}
                  <span class="s1">the <em>BIG</em></span>
                  <span class="s2">idea <em>starts</em> here</span>
                {:else if look.value === "bold"}
                  BIG IDEA HERE
                {:else if look.value === "box"}
                  <span>Big idea here</span>
                {:else if look.value === "minimal"}
                  big idea here
                {:else}
                  Big idea here
                {/if}
              </span>
              <span class="fsu-look__name">{look.label}</span>
            </button>
          {/each}
          <button
            type="button"
            role="radio"
            aria-checked={captionStyle === ""}
            class="fsu-look"
            class:fsu-on={captionStyle === ""}
            on:click={() => (captionStyle = "")}
          >
            <span class="fsu-sample fsu-sample--auto"
              ><Sparkles size={18} aria-hidden="true" /></span
            >
            <span class="fsu-look__name">Let the AI choose</span>
          </button>
        </div>
      </section>
    {/if}

    <footer>
      <button type="button" class="fsu-back" disabled={busy} on:click={onClose}
        ><ArrowLeft size={15} /> Back</button
      >
      <button
        type="button"
        class="fs-primary"
        disabled={busy}
        on:click={onConfirm}><Sparkles size={16} /> Create my video</button
      >
    </footer>
    <small class="fsu-cost"
      >About a minute · 10 credits · the AI picks the length your footage needs</small
    >
  </div>
</div>

<style>
  .fsu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(4, 4, 6, 0.66);
    backdrop-filter: blur(4px);
  }

  .fsu {
    width: min(640px, 100%);
    max-height: calc(100vh - 32px);
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px;
    border: 1px solid var(--sl-border, rgba(255, 255, 255, 0.08));
    border-radius: 18px;
    background: var(--sl-panel, #111114);
    color: var(--sl-text, #f4f4f5);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
    outline: none;
  }

  header h2 {
    margin: 0;
    font-size: 19px;
  }

  header p {
    margin: 4px 0 0;
    color: var(--sl-text-soft, #a1a1aa);
    font-size: 13px;
  }

  h3 {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--sl-text-soft, #a1a1aa);
  }

  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  .fsu-on {
    border-color: var(--fs-blue-hover, #2752c9) !important;
    background: var(--fs-blue-soft, rgba(39, 82, 201, 0.14)) !important;
  }

  .fsu-shapes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .fsu-shape {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 10px;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    background: transparent;
    text-align: center;
  }

  .fsu-shape small {
    color: var(--sl-text-soft, #a1a1aa);
    font-size: 11.5px;
  }

  .fsu-shape strong small {
    margin-left: 4px;
    font-weight: 500;
  }

  .fsu-shape__stage {
    display: grid;
    place-items: center;
    height: 104px;
    margin-bottom: 6px;
  }

  .fsu-shape__frame {
    position: relative;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.75);
    border-radius: 9px;
    background: linear-gradient(160deg, #2c3e66, #151b2c 70%);
  }

  .fsu-shape__subject {
    position: absolute;
    left: 50%;
    bottom: -18%;
    width: 46%;
    aspect-ratio: 1 / 1.25;
    transform: translateX(-50%);
    border-radius: 50% 50% 18% 18%;
    background: rgba(255, 255, 255, 0.22);
  }

  .fsu-shape__caption {
    position: absolute;
    left: 22%;
    right: 22%;
    bottom: 16%;
    height: 4px;
    border-radius: 2px;
    background: #fff;
  }

  .fsu-tick {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--fs-blue, #1f45b0);
    color: #fff;
  }

  .fsu-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .fsu-chips button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.12));
    border-radius: 999px;
    background: transparent;
    font-size: 13px;
  }

  .fsu-chips button span {
    padding: 1px 7px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    font-size: 12px;
  }

  .fsu-looks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
    gap: 10px;
  }

  .fsu-look {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    background: transparent;
  }

  .fsu-look__name {
    font-size: 12.5px;
    padding: 0 4px 2px;
    text-align: left;
  }

  .fsu-sample {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 74px;
    border-radius: 8px;
    background:
      linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent 70%),
      linear-gradient(150deg, #5b6f8f, #232a3a);
    color: #fff;
    text-align: center;
    line-height: 1.05;
  }

  .fsu-sample--stack .s1 {
    font:
      300 11px Georgia,
      "Fraunces",
      serif;
  }

  .fsu-sample--stack em {
    font:
      italic 900 22px "Inter",
      sans-serif;
    color: #ffd60a;
  }

  .fsu-sample--stack .s2 {
    font:
      300 11px Georgia,
      "Fraunces",
      serif;
  }

  .fsu-sample--stack .s2 em {
    font-size: 16px;
    color: #ff5fa2;
  }

  .fsu-sample--bold {
    font:
      italic 900 17px "Inter",
      sans-serif;
    letter-spacing: -0.01em;
    -webkit-text-stroke: 3px #000;
    paint-order: stroke fill;
  }

  .fsu-sample--box span {
    padding: 3px 8px;
    border-radius: 5px;
    background: var(--fs-blue, #1f45b0);
    font:
      700 13px "Inter",
      sans-serif;
  }

  .fsu-sample--clean {
    font:
      600 14px "Inter",
      sans-serif;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  }

  .fsu-sample--serif {
    font:
      500 16px "Fraunces",
      Georgia,
      serif;
    font-style: italic;
  }

  .fsu-sample--minimal {
    font:
      300 12px "Inter",
      sans-serif;
    letter-spacing: 0.02em;
    opacity: 0.92;
  }

  .fsu-sample--auto {
    background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--fs-blue, #1f45b0) 60%, #000),
      #16161a
    );
  }

  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .fsu-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 14px;
    min-height: 44px;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    background: transparent;
  }

  .fsu-cost {
    margin-top: -8px;
    color: var(--sl-text-soft, #a1a1aa);
    font-size: 12px;
    text-align: right;
  }

  @media (max-width: 520px) {
    .fsu-shapes {
      grid-template-columns: 1fr;
    }

    .fsu-shape__stage {
      height: auto;
    }
  }
</style>

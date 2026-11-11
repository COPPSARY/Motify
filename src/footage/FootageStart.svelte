<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    Check,
    Loader2,
    Music,
    Plus,
    Sparkles,
    Upload,
    X,
  } from "lucide-svelte";
  import {
    VIDEO_ACCEPT,
    VIDEO_MAX_BYTES,
    isVideoFile,
    uploadAsset,
    withVideoType,
  } from "../api/assets";
  import { STAGE_LABEL, clipStatuses, watchClips } from "./clips";
  import type { FootageClip, FootageFormat } from "./edit";

  /**
   * The footage editor's start page (/footage): the clips, what the video
   * should say, and its shape. Clips upload, and start being read, while the
   * brief is written; "Create my video" opens the editor and starts the cut.
   */

  export let workspaceId: string;
  export let onCreate: (
    input: {
      clips: FootageClip[];
      localFiles?: Record<string, File>;
      brief: string;
      seconds: number;
      format: FootageFormat;
      captionLanguage: string;
      music: boolean;
    },
    onProgress: (step: "clips" | "cut" | "open") => void,
  ) => Promise<void>;
  export let onSignIn: () => void;

  /** After Create: which step the video is on, until the editor opens. */
  let step: "clips" | "cut" | "open" | null = null;

  interface Item {
    key: string;
    name: string;
    preview: string;
    progress: number;
    /** The file, when this browser can play it: the editor shows it until the server's copy is ready. */
    file?: File;
    clip?: FootageClip;
    error?: string;
  }

  let fileInput: HTMLInputElement;
  let items: Item[] = [];
  let brief = "";
  let seconds = 30;
  let format: FootageFormat = "9:16";
  let captionLanguage = "km";
  let music = true;
  let creating = false;
  let error = "";
  let dragOver = false;

  const FORMATS: Array<{ value: FootageFormat; label: string; hint: string }> =
    [
      { value: "9:16", label: "Vertical", hint: "TikTok · Reels · Shorts" },
      { value: "1:1", label: "Square", hint: "Facebook · Instagram feed" },
      { value: "16:9", label: "Wide", hint: "YouTube · website" },
    ];

  const EXAMPLES = [
    {
      label: "Coffee shop promo",
      text: "Create a 30-second Khmer promotional video for my new coffee menu. Open with the best drink shot, keep my explanation short, show the price, and end with how to order.",
    },
    {
      label: "Talking video",
      text: "Make a fast talking video from my clips like a TikTok creator: cut the pauses and mistakes, show what I mention on screen, and end with Follow.",
    },
    {
      label: "Product launch",
      text: "Introduce our new product in 30 seconds: the problem, the product in use, three key features, the price, and a call to action.",
    },
  ];

  $: uploading = items.some((item) => !item.clip && !item.error);
  $: ready = items.filter((item) => item.clip).map((item) => item.clip!);
  $: canCreate = ready.length > 0 && !uploading && !creating;

  onDestroy(() => items.forEach((item) => URL.revokeObjectURL(item.preview)));

  function localInfo(
    file: File,
  ): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);
      const done = (value: {
        duration: number;
        width: number;
        height: number;
      }) => {
        URL.revokeObjectURL(url);
        resolve(value);
      };
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        done({
          duration: Number.isFinite(video.duration) ? video.duration : 5,
          width: video.videoWidth,
          height: video.videoHeight,
        });
      // A format this browser cannot open (HEVC .mov) is read by the server instead.
      video.onerror = () => done({ duration: 5, width: 0, height: 0 });
      video.src = url;
    });
  }

  async function add(files: FileList | null): Promise<void> {
    const videos = Array.from(files ?? []).filter(isVideoFile);
    if (videos.length === 0) {
      error = "Choose .mp4, .mov or .webm videos.";
      return;
    }
    error = "";
    await Promise.all(
      videos.map(async (raw) => {
        const file = withVideoType(raw);
        const item: Item = {
          key: `${file.name}-${file.size}-${Math.random()}`,
          name: file.name,
          preview: URL.createObjectURL(file),
          progress: 0,
        };
        items = [...items, item];
        try {
          if (file.size > VIDEO_MAX_BYTES) throw new Error("Over 50 MB");
          const info = await localInfo(file);
          const assetId = await uploadAsset(workspaceId, file, (progress) => {
            item.progress = progress;
            items = [...items];
          });
          item.clip = { assetId, name: file.name, ...info, hasAudio: true };
          if (info.width > 0) item.file = file;
          // Reading starts now, while the brief is written.
          watchClips([assetId]);
        } catch (failure) {
          item.error =
            failure instanceof Error ? failure.message : "Upload failed";
        }
        items = [...items];
      }),
    );
    if (fileInput) fileInput.value = "";
  }

  function remove(item: Item): void {
    URL.revokeObjectURL(item.preview);
    items = items.filter((candidate) => candidate !== item);
  }

  async function create(): Promise<void> {
    if (!canCreate) return;
    creating = true;
    error = "";
    try {
      const localFiles = Object.fromEntries(
        items.flatMap((item) =>
          item.clip && item.file ? [[item.clip.assetId, item.file]] : [],
        ),
      );
      await onCreate(
        {
          clips: ready,
          brief,
          seconds,
          format,
          captionLanguage,
          music,
          localFiles,
        },
        (next) => (step = next),
      );
    } catch (failure) {
      error =
        failure instanceof Error
          ? failure.message
          : "The video could not be created.";
    } finally {
      creating = false;
      step = null;
    }
  }

  const clock = (value: number) => {
    const whole = Math.max(0, Math.round(value));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  };
</script>

<section class="fs" aria-labelledby="fs-title">
  <header class="fs-head">
    <h1 id="fs-title">Turn your raw clips into a video</h1>
    <p>
      Upload what you filmed. Motify watches and listens to every clip, cuts the
      best moments into a video with Khmer subtitles, cards and music, and you
      can change anything afterwards.
    </p>
  </header>

  {#if !workspaceId}
    <div class="fs-card fs-signin">
      <p>Sign in to upload your footage.</p>
      <button type="button" class="fs-primary" on:click={onSignIn}
        >Sign in</button
      >
    </div>
  {:else}
    <div class="fs-card">
      <div class="fs-step">
        <span>1</span><strong>Your clips</strong><small
          >{ready.length} ready{uploading ? " · uploading…" : ""}</small
        >
      </div>
      {#if items.length === 0}
        <button
          type="button"
          class="fs-drop"
          class:fs-over={dragOver}
          on:click={() => fileInput.click()}
          on:dragover|preventDefault={() => (dragOver = true)}
          on:dragleave={() => (dragOver = false)}
          on:drop|preventDefault={(event) => {
            dragOver = false;
            void add(event.dataTransfer?.files ?? null);
          }}
        >
          <span class="fs-drop__icon"><Upload size={22} /></span>
          <strong>Drop your videos here</strong>
          <small
            >or click to choose · .mp4 .mov .webm · up to 50 MB each · phone
            footage is fine</small
          >
        </button>
      {:else}
        <ul
          class="fs-clips"
          on:dragover|preventDefault
          on:drop|preventDefault={(event) =>
            void add(event.dataTransfer?.files ?? null)}
        >
          {#each items as item (item.key)}
            <li class="fs-clip" class:fs-clip--error={item.error}>
              <!-- The first frame stands for the clip; it never plays here. -->
              <video
                src={`${item.preview}#t=0.5`}
                muted
                playsinline
                preload="metadata"
              ></video>
              <span class="fs-clip__state">
                {#if item.error}<X size={12} />
                  {item.error}{:else if item.clip}{@const status =
                    $clipStatuses[
                      item.clip.assetId
                    ]}{#if status?.status === "ready"}<Check size={12} />
                    {clock(
                      item.clip.duration,
                    )}{:else if status?.status === "failed"}<X size={12} /> Couldn’t
                    read{:else}<Loader2 size={12} class="fx-spin" />
                    {STAGE_LABEL[
                      status?.stage ?? "queued"
                    ]}…{/if}{:else}<Loader2 size={12} class="fx-spin" /> Uploading
                  {item.progress}%{/if}
              </span>
              {#if !item.clip && !item.error}<span
                  class="fs-clip__bar"
                  style:width={`${item.progress}%`}
                ></span>{/if}
              <span class="fs-clip__name" title={item.name}>{item.name}</span>
              <button
                type="button"
                class="fs-clip__remove"
                aria-label={`Remove ${item.name}`}
                on:click={() => remove(item)}><X size={12} /></button
              >
            </li>
          {/each}
          <li>
            <button
              type="button"
              class="fs-add"
              on:click={() => fileInput.click()}
              ><Plus size={18} /><span>Add more</span></button
            >
          </li>
        </ul>
      {/if}
      <input
        bind:this={fileInput}
        type="file"
        accept={VIDEO_ACCEPT}
        multiple
        hidden
        on:change={(event) =>
          add((event.currentTarget as HTMLInputElement).files)}
      />
    </div>

    <div class="fs-card">
      <div class="fs-step">
        <span>2</span><strong>What should the video say?</strong><small
          >Khmer or English</small
        >
      </div>
      <textarea
        rows="4"
        lang="km"
        bind:value={brief}
        placeholder="e.g. Create a 30-second Khmer promotional video for my new coffee menu. Show the best drinks, keep my explanation short, and end with how to order."
      ></textarea>
      <div class="fs-examples">
        <span>Try:</span>
        {#each EXAMPLES as example (example.label)}
          <button type="button" on:click={() => (brief = example.text)}
            >{example.label}</button
          >
        {/each}
      </div>
    </div>

    <div class="fs-card">
      <div class="fs-step"><span>3</span><strong>Shape</strong></div>
      <div class="fs-formats" role="radiogroup" aria-label="Format">
        {#each FORMATS as option (option.value)}
          <button
            type="button"
            role="radio"
            aria-checked={format === option.value}
            class="fs-format"
            class:fs-on={format === option.value}
            on:click={() => (format = option.value)}
          >
            <span
              class={`fs-shape fs-shape--${option.value.replace(":", "x")}`}
              aria-hidden="true"
            ></span>
            <strong>{option.label} <small>{option.value}</small></strong>
            <small>{option.hint}</small>
          </button>
        {/each}
      </div>
      <div class="fs-options">
        <div class="fs-option">
          <span>Length</span>
          <div class="fs-segmented" role="group" aria-label="Length">
            {#each [15, 30, 60] as option (option)}
              <button
                type="button"
                class:fs-on={seconds === option}
                aria-pressed={seconds === option}
                on:click={() => (seconds = option)}>{option}s</button
              >
            {/each}
          </div>
        </div>
        <label class="fs-option">
          <span>Subtitles</span>
          <select bind:value={captionLanguage}>
            <option value="km">Khmer</option>
            <option value="km+en">Khmer + English</option>
            <option value="en">English</option>
            <option value="auto">As spoken</option>
            <option value="none">None</option>
          </select>
        </label>
        <label class="fs-option fs-switch">
          <span><Music size={14} /> Background music</span>
          <input type="checkbox" role="switch" bind:checked={music} />
        </label>
      </div>
    </div>

    {#if error}<p class="fs-error" role="alert">{error}</p>{/if}

    {#if step}
      {@const preparedCount = ready.filter(
        (clip) => $clipStatuses[clip.assetId]?.status === "ready",
      ).length}
      <div class="fs-progress" role="status" aria-live="polite">
        <ol>
          <li class:fs-done={step !== "clips"} class:fs-now={step === "clips"}>
            <span class="fs-dot"
              >{#if step !== "clips"}<Check size={13} />{:else}<Loader2
                  size={13}
                  class="fx-spin"
                />{/if}</span
            >
            <span
              ><strong>Getting your clips ready</strong><small
                >{preparedCount}/{ready.length} prepared · Motify watches and listens
                to each one</small
              ></span
            >
          </li>
          <li class:fs-done={step === "open"} class:fs-now={step === "cut"}>
            <span class="fs-dot"
              >{#if step === "open"}<Check
                  size={13}
                />{:else if step === "cut"}<Loader2
                  size={13}
                  class="fx-spin"
                />{/if}</span
            >
            <span
              ><strong>Cutting your video</strong><small
                >Picking the best moments, captions and cards</small
              ></span
            >
          </li>
          <li class:fs-now={step === "open"}>
            <span class="fs-dot"
              >{#if step === "open"}<Loader2
                  size={13}
                  class="fx-spin"
                />{/if}</span
            >
            <span
              ><strong>Opening the editor</strong><small
                >You can change anything from there</small
              ></span
            >
          </li>
        </ol>
      </div>
    {/if}

    <footer class="fs-foot" hidden={Boolean(step)}>
      <small
        >{ready.length === 0
          ? "Add at least one clip to start."
          : "The first cut takes about a minute and costs 10 credits. Every change can be undone."}</small
      >
      <button
        type="button"
        class="fs-primary"
        disabled={!canCreate}
        on:click={create}
      >
        {#if creating}<Loader2 size={16} class="fx-spin" /> Opening the editor…{:else if uploading}<Loader2
            size={16}
            class="fx-spin"
          /> Uploading…{:else}<Sparkles size={16} /> Create my video{/if}
      </button>
    </footer>
  {/if}
</section>

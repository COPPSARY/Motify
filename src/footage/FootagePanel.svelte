<script lang="ts">
  import {
    AlertTriangle,
    ChevronDown,
    Captions,
    Clapperboard,
    Film,
    Loader2,
    Music,
    Plus,
    RefreshCw,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Type,
    Upload,
  } from "lucide-svelte";
  import { tick } from "svelte";
  import { importStock, searchStock, type StockItem } from "../api/stock";
  import {
    VIDEO_ACCEPT,
    isVideoFile,
    uploadAsset,
    withVideoType,
  } from "../api/assets";
  import { clipStatuses, retryClip, STAGE_LABEL, watchClips } from "./clips";
  import { footageFileUrl, seedLocalClip, translateCaptions } from "./api";
  import {
    FOOTAGE_CARD_TEMPLATES,
    FOOTAGE_CARD_THEMES,
    FOOTAGE_FORMATS,
    FOOTAGE_TITLE_STYLES,
    FOOTAGE_TRANSITIONS,
    addClip,
    addCard,
    addCutaway,
    addPicture,
    addTitle,
    appendClip,
    clipOf,
    editDuration,
    newId,
    placeCues,
    removeClip,
    setFormat,
    updateCue,
    updateSegment,
    removeCutaway,
    updateCard,
    updateCutaway,
    updateTitle,
    type FootageEdit,
    type FootageCard,
    type FootageTitleStyle,
  } from "./edit";

  export let edit: FootageEdit;
  export let workspaceId: string;
  /** The project stock footage is brought into. */
  export let projectId = "";
  /** Asks Motify's generator to make (or remake) a card. */
  export let onGenerateCard: (segmentId: string) => void = () => undefined;
  export let time = 0;
  /** What is selected; the inspector edits it when it is one thing. */
  export let selectedIds: string[] = [];
  export let onChange: (next: FootageEdit, label: string) => void;
  export let onSeek: (time: number) => void;
  export let onSelect: (id: string, additive: boolean) => void;
  export let onNotice: (message: string) => void;
  export let listSongs: () => Promise<
    Array<{
      id: string;
      title: string;
      durationMs: number;
      moodTags?: string[];
    }>
  >;

  /**
   * The left column of a footage project: the tools for editing by hand. The
   * chat on the right (FootageChat) is where the person asks the AI.
   */
  type Tab = "edit" | "clips" | "text" | "audio" | "look";
  let tab: Tab = "clips";
  // Selecting something opens its settings.
  let lastSelection = "";
  $: if (selectedIds.join(",") !== lastSelection) {
    lastSelection = selectedIds.join(",");
    if (selectedIds.length > 0) tab = "edit";
  }
  const RAIL = [
    {
      tab: "edit" as const,
      label: "Selected",
      title: "Selected",
      icon: SlidersHorizontal,
    },
    {
      tab: "clips" as const,
      label: "Clips",
      title: "Your footage",
      icon: Film,
    },
    {
      tab: "text" as const,
      label: "Text",
      title: "Titles & captions",
      icon: Type,
    },
    {
      tab: "audio" as const,
      label: "Audio",
      title: "Music & sound",
      icon: Music,
    },
    {
      tab: "look" as const,
      label: "Format",
      title: "Format & colours",
      icon: Clapperboard,
    },
  ];

  /** Opens the file picker for more clips (the top bar's Upload button). */
  export async function upload(): Promise<void> {
    tab = "clips";
    await tick();
    fileInput?.click();
  }

  $: selectedId = selectedIds.length === 1 ? selectedIds[0]! : "";
  $: segment = edit.segments.find((item) => item.id === selectedId);
  $: cutaway = (edit.cutaways ?? []).find((item) => item.id === selectedId);
  /** The selected card: cut in (a segment) or over talk (an overlay). */
  $: cardHost = segment?.card
    ? { id: segment.id, card: segment.card, overlay: false }
    : cutaway?.kind === "card" && cutaway.card
      ? { id: cutaway.id, card: cutaway.card, overlay: true }
      : null;
  $: title = edit.titles.find((item) => item.id === selectedId);
  $: cue = edit.captions.cues.find((item) => item.id === selectedId);
  $: total = editDuration(edit);
  $: watchClips(edit.clips.map((clip) => clip.assetId));
  $: readyCount = edit.clips.filter(
    (clip) => $clipStatuses[clip.assetId]?.status === "ready",
  ).length;

  // ---- clips ------------------------------------------------------------------------------

  // ---- cards ----------------------------------------------------------------------------

  const CARD_PRESETS: Array<{ label: string; card: FootageCard }> = [
    {
      label: "Spotlight",
      card: {
        template: "spotlight",
        theme: "paper",
        eyebrow: "ថ្មី",
        title: "Motify",
        label: "AI VIDEO",
        big: "2.0",
      },
    },
    {
      label: "Statement",
      card: { template: "statement", theme: "dark", title: "កាត់វីដេអូដោយ AI" },
    },
    {
      label: "List",
      card: {
        template: "list",
        theme: "paper",
        title: "ហេតុអ្វីជ្រើសរើសយើង",
        items: ["លឿន", "ងាយស្រួល", "តម្លៃសមរម្យ"],
      },
    },
    {
      label: "Ending",
      card: {
        template: "end",
        theme: "accent",
        title: "Motify",
        label: "សាកល្បងឥតគិតថ្លៃ",
        eyebrow: "motify.app",
      },
    },
  ];

  function newCard(card: FootageCard): void {
    const next = addCard(edit, time, { ...card });
    const added = next.segments.find(
      (item) => !edit.segments.some((old) => old.id === item.id),
    );
    onChange(next, "Add card");
    // Over talk, it is an overlay at the playhead; select it there.
    const overlay = (next.cutaways ?? []).find(
      (item) => !(edit.cutaways ?? []).some((old) => old.id === item.id),
    );
    if (overlay) {
      onSelect(overlay.id, false);
      onSeek(time + 0.6);
    } else if (added) {
      onSelect(added.id, false);
      let at = 0;
      for (const item of next.segments) {
        if (item.id === added.id) break;
        at += item.out - item.in;
      }
      onSeek(at + 0.6);
    }
  }

  // ---- stock footage --------------------------------------------------------------------

  let stockQuery = "";
  let stockItems: StockItem[] = [];
  let stockSearching = false;
  let stockError = "";
  let stockImporting = 0;

  async function findStock(): Promise<void> {
    const query = stockQuery.trim();
    if (!query || stockSearching) return;
    stockSearching = true;
    stockError = "";
    try {
      const result = await searchStock({
        kind: "video",
        query,
        orientation: edit.format === "16:9" ? "horizontal" : "vertical",
      });
      stockItems = result.items.slice(0, 12);
      if (stockItems.length === 0)
        stockError = "Nothing found. Try other words, in English.";
    } catch (error) {
      stockError =
        error instanceof Error ? error.message : "Stock search failed.";
    } finally {
      stockSearching = false;
    }
  }

  /** Brings a stock clip into the project and cuts it in, muted, at the end. */
  async function useStock(item: StockItem): Promise<void> {
    if (!projectId || stockImporting) return;
    stockImporting = item.id;
    try {
      const imported = await importStock(projectId, "video", item.id);
      const assetId = imported.asset.id;
      let next = addClip(edit, {
        assetId,
        name: `Stock · ${stockQuery.trim() || item.tags[0] || "B-roll"}`.slice(
          0,
          120,
        ),
        duration: item.durationSeconds ?? 8,
        width: item.width,
        height: item.height,
        hasAudio: false,
      });
      // Over the talk at the playhead when there is talk there; otherwise at the end.
      const over = addCutaway(
        next,
        time,
        assetId,
        Math.min(1, Math.max(0, (item.durationSeconds ?? 4) - 3)),
        2.5,
      );
      if (over !== next) {
        onChange(over, "Add B-roll");
      } else {
        next = appendClip(next, assetId);
        const added = next.segments[next.segments.length - 1]!;
        next = updateSegment(next, added.id, {
          volume: 0,
          out: Math.min(added.out, 3),
        });
        onChange(next, "Add stock clip");
      }
    } catch (error) {
      onNotice(
        error instanceof Error
          ? error.message
          : "That stock clip could not be added.",
      );
    } finally {
      stockImporting = 0;
    }
  }

  let uploads: Array<{ name: string; progress: number; error?: string }> = [];
  let dragOver = false;
  /** The clip whose details are open. */
  let openClip = "";
  /** 16.4 -> "0:16". */
  const clock = (seconds: number) => {
    const whole = Math.max(0, Math.round(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  };
  let fileInput: HTMLInputElement;
  let posters: Record<string, string> = {};
  $: for (const clip of edit.clips) {
    if (posters[clip.assetId] !== undefined) continue;
    if ($clipStatuses[clip.assetId]?.status !== "ready") continue;
    posters[clip.assetId] = "";
    void footageFileUrl(clip.assetId, "poster.jpg")
      .then((url) => (posters = { ...posters, [clip.assetId]: url }))
      .catch(() => undefined);
  }

  // A clip's real length and sound are known once the backend has read it.
  $: {
    let next = edit;
    for (const clip of edit.clips) {
      const media = $clipStatuses[clip.assetId]?.media;
      if (!media) continue;
      const duration = media.durationMs / 1000;
      if (
        Math.abs(duration - clip.duration) > 0.05 ||
        media.hasAudio !== clip.hasAudio
      )
        next = {
          ...next,
          clips: next.clips.map((item) =>
            item.assetId === clip.assetId
              ? {
                  ...item,
                  duration,
                  hasAudio: media.hasAudio,
                  width: media.width,
                  height: media.height,
                }
              : item,
          ),
          segments: next.segments.map((item) =>
            item.assetId === clip.assetId
              ? { ...item, out: Math.min(item.out, duration) }
              : item,
          ),
        };
    }
    if (next !== edit) onChange(next, "");
  }

  async function addFiles(files: FileList | null): Promise<void> {
    const all = Array.from(files ?? []);
    const videos = all.filter(isVideoFile);
    const images = all.filter((file) =>
      /^image\/(png|jpeg|webp|gif)$/.test(file.type),
    );
    if (videos.length === 0 && images.length === 0) {
      onNotice(
        "Choose .mp4, .mov or .webm videos, or .png, .jpg or .webp pictures.",
      );
      return;
    }
    if (images.length > 0) await addPictures(images);
    if (videos.length === 0) {
      if (fileInput) fileInput.value = "";
      return;
    }
    let next = edit;
    await Promise.all(
      videos.map(async (raw) => {
        const file = withVideoType(raw);
        const entry = { name: file.name, progress: 0 };
        uploads = [...uploads, entry];
        try {
          const meta = await localVideoInfo(file);
          const assetId = await uploadAsset(workspaceId, file, (progress) => {
            entry.progress = progress;
            uploads = [...uploads];
          });
          if (meta.width > 0) seedLocalClip(assetId, file);
          next = addClip(next, {
            assetId,
            name: file.name,
            ...meta,
            hasAudio: true,
          });
          uploads = uploads.filter((item) => item !== entry);
        } catch (error) {
          entry.progress = 0;
          (entry as { error?: string }).error =
            error instanceof Error ? error.message : "Upload failed";
          uploads = [...uploads];
        }
      }),
    );
    if (next !== edit) onChange(next, "Add clips");
    if (fileInput) fileInput.value = "";
  }

  /** Pictures (a logo, a product photo), each full frame over the talk at the playhead. */
  async function addPictures(images: File[]): Promise<void> {
    let next = edit;
    let at = time;
    for (const file of images.slice(0, 6)) {
      const entry = { name: file.name, progress: 0 };
      uploads = [...uploads, entry];
      try {
        const assetId = await uploadAsset(workspaceId, file, (progress) => {
          entry.progress = progress;
          uploads = [...uploads];
        });
        const added = addPicture(next, at, assetId);
        if (added === next) throw new Error("Add a clip first");
        next = added;
        at += 3;
        uploads = uploads.filter((item) => item !== entry);
      } catch (error) {
        (entry as { error?: string }).error =
          error instanceof Error ? error.message : "Upload failed";
        uploads = [...uploads];
      }
    }
    if (next !== edit) {
      onChange(next, images.length > 1 ? "Add pictures" : "Add picture");
      const added = next.cutaways?.[next.cutaways.length - 1];
      if (added) onSelect(added.id, false);
    }
  }

  function localVideoInfo(
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
      // A format this browser cannot open (HEVC .mov) is read by the backend instead.
      video.onerror = () => done({ duration: 5, width: 0, height: 0 });
      video.src = url;
    });
  }

  function addMoment(assetId: string, start: number, end: number): void {
    const placedIndex = edit.segments.length - 1;
    const next = appendClip(edit, assetId, placedIndex);
    const added = next.segments[placedIndex + 1];
    if (!added) return;
    onChange(
      updateSegment(next, added.id, { in: start, out: end }),
      "Add moment",
    );
  }

  // ---- text -------------------------------------------------------------------------------

  $: shownCues = placeCues(edit);
  let translating = false;
  async function translateAll(language: string): Promise<void> {
    if (translating || edit.captions.cues.length === 0) return;
    translating = true;
    try {
      const cues = await translateCaptions(
        edit.captions.cues.slice(0, 600),
        language,
      );
      const byId = new Map(cues.map((item) => [item.id, item]));
      onChange(
        {
          ...edit,
          captions: {
            ...edit.captions,
            language,
            cues: edit.captions.cues.map((item) => byId.get(item.id) ?? item),
          },
        },
        `Translate captions`,
      );
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Translation failed.");
    } finally {
      translating = false;
    }
  }

  function newTitle(style: FootageTitleStyle): void {
    const next = addTitle(edit, time, style);
    onChange(next, "Add title");
    onSelect(next.titles[next.titles.length - 1]!.id, false);
  }

  // ---- audio ------------------------------------------------------------------------------

  let songs: Array<{
    id: string;
    title: string;
    durationMs: number;
    moodTags?: string[];
  }> = [];
  let songsLoaded = false;
  $: if (tab === "audio" && !songsLoaded) {
    songsLoaded = true;
    void listSongs()
      .then((list) => (songs = list))
      .catch(() => onNotice("The music library could not be loaded."));
  }

  const num = (event: Event) =>
    Number((event.currentTarget as HTMLInputElement).value);
  const text = (event: Event) =>
    (event.currentTarget as HTMLInputElement).value;
  const fmt = (value: number) => value.toFixed(1);
</script>

<aside class="fx-panel" aria-label="Footage editor">
  <nav class="fx-rail" aria-label="Footage tools">
    {#each RAIL as item (item.tab)}
      <button
        type="button"
        class:fx-on={tab === item.tab}
        aria-pressed={tab === item.tab}
        title={item.label}
        on:click={() => (tab = item.tab)}
        ><svelte:component this={item.icon} size={18} /><span>{item.label}</span
        ></button
      >
    {/each}
  </nav>
  <div class="fx-library">
    <header class="fx-library__head">
      <strong>{RAIL.find((item) => item.tab === tab)?.title}</strong>
      <small
        >{tab === "edit"
          ? selectedIds.length > 1
            ? `${selectedIds.length} selected`
            : ""
          : tab === "clips"
            ? `${readyCount}/${edit.clips.length} ready`
            : tab === "text"
              ? `${edit.titles.length} titles`
              : tab === "look"
                ? edit.format
                : ""}</small
      >
    </header>
    <div class="fx-panel__body">
      {#if tab === "edit"}
        {#if cutaway && !cardHost}
          {@const shown = clipOf(edit, cutaway.assetId)}
          {@const picture = cutaway.kind === "image"}
          <section class="fx-card fx-card--selected">
            <header>
              <strong
                >{picture
                  ? "Picture"
                  : `B-roll · ${shown?.name ?? "clip"}`}</strong
              ><small>{fmt(cutaway.duration)} s</small>
            </header>
            <p class="fx-hint">
              Covers the picture while {clipOf(edit, cutaway.over)?.name ??
                "the talk"} keeps playing its sound and captions underneath.
            </p>
            <label
              >Layout
              <select
                value={cutaway.layout ?? "full"}
                on:change={(e) =>
                  cutaway &&
                  onChange(
                    updateCutaway(edit, cutaway.id, {
                      layout: text(e) === "top" ? ("top" as const) : undefined,
                    }),
                    "Overlay layout",
                  )}
              >
                <option value="top"
                  >{edit.format === "16:9"
                    ? "Left half, speaker on the right"
                    : "Top half, speaker below"}</option
                >
                <option value="full">Full frame</option>
              </select>
            </label>
            <div class="fx-grid2">
              <label hidden={picture}
                >From (s) in the clip<input
                  type="number"
                  step="0.1"
                  min="0"
                  value={fmt(cutaway.in)}
                  on:change={(e) =>
                    onChange(
                      updateCutaway(edit, cutaway.id, {
                        in: Math.max(
                          0,
                          Math.min(
                            (shown?.duration ?? 60) - cutaway.duration,
                            num(e),
                          ),
                        ),
                      }),
                      "B-roll start",
                    )}
                /></label
              >
              <label
                >Length (s)<input
                  type="number"
                  step="0.1"
                  min="0.3"
                  max="8"
                  value={fmt(cutaway.duration)}
                  on:change={(e) =>
                    onChange(
                      updateCutaway(edit, cutaway.id, {
                        duration: Math.max(0.3, Math.min(8, num(e))),
                      }),
                      "B-roll length",
                    )}
                /></label
              >
            </div>
            <button
              type="button"
              class="fx-link fx-danger"
              on:click={() => {
                onChange(
                  removeCutaway(edit, cutaway.id),
                  picture ? "Delete picture" : "Delete B-roll",
                );
                onSelect("", false);
              }}
              ><Trash2 size={12} /> Remove this {picture
                ? "picture"
                : "B-roll"}</button
            >
          </section>
        {:else if cardHost}
          {@const card = cardHost.card}
          {@const cardId = cardHost.id}
          <section class="fx-card fx-card--selected">
            <header>
              <strong>{cardHost.overlay ? "Card over talk" : "Card"}</strong
              ><small
                >{fmt(
                  cutaway && cardHost.overlay
                    ? cutaway.duration
                    : segment
                      ? segment.out - segment.in
                      : 0,
                )} s</small
              >
            </header>
            <div class="fx-motion">
              {#if card.film?.state === "generating"}
                <span
                  ><Loader2 size={13} class="fx-spin" /> Motify is making this card…</span
                >
              {:else if card.film?.state === "ready"}
                <span
                  ><Sparkles size={13} /> Made by Motify’s motion generator</span
                >
                <button
                  type="button"
                  class="fx-link"
                  on:click={() => onGenerateCard(cardId)}
                  ><RefreshCw size={12} /> Make another</button
                >
              {:else}
                <span
                  >{card.film?.state === "failed"
                    ? "The motion card failed; this simple card stands in."
                    : "A simple card. Motify can make a full motion graphic of it."}</span
                >
                <button
                  type="button"
                  class="fx-primary"
                  on:click={() => onGenerateCard(cardId)}
                  ><Sparkles size={13} /> Make it with Motify AI</button
                >
              {/if}
              <small class="fx-hint"
                >Change the words first: the card is made from them. Priced like
                a short film.</small
              >
            </div>
            <div class="fx-grid2">
              <label
                >Layout
                <select
                  value={card.template}
                  on:change={(e) =>
                    onChange(
                      updateCard(edit, cardId, {
                        template: text(e) as FootageCard["template"],
                      }),
                      "Card layout",
                    )}
                >
                  {#each FOOTAGE_CARD_TEMPLATES as option (option)}<option
                      value={option}>{option}</option
                    >{/each}
                </select>
              </label>
              <label
                >Look
                <select
                  value={card.theme}
                  on:change={(e) =>
                    onChange(
                      updateCard(edit, cardId, {
                        theme: text(e) as FootageCard["theme"],
                      }),
                      "Card look",
                    )}
                >
                  {#each FOOTAGE_CARD_THEMES as option (option)}<option
                      value={option}>{option}</option
                    >{/each}
                </select>
              </label>
            </div>
            <label
              >Small line on top<input
                type="text"
                lang="km"
                value={card.eyebrow ?? ""}
                on:change={(e) =>
                  onChange(
                    updateCard(edit, cardId, {
                      eyebrow: text(e) || undefined,
                    }),
                    "Card text",
                  )}
              /></label
            >
            <label
              >Title<input
                type="text"
                lang="km"
                value={card.title}
                on:change={(e) =>
                  onChange(
                    updateCard(edit, cardId, { title: text(e) }),
                    "Card text",
                  )}
              /></label
            >
            <label
              >{card.template === "end" ? "Call to action" : "Label"}<input
                type="text"
                lang="km"
                value={card.label ?? ""}
                on:change={(e) =>
                  onChange(
                    updateCard(edit, cardId, {
                      label: text(e) || undefined,
                    }),
                    "Card text",
                  )}
              /></label
            >
            {#if card.template === "spotlight"}
              <label
                >Big number or price<input
                  type="text"
                  value={card.big ?? ""}
                  on:change={(e) =>
                    onChange(
                      updateCard(edit, cardId, {
                        big: text(e) || undefined,
                      }),
                      "Card text",
                    )}
                /></label
              >
            {/if}
            {#if card.template === "list"}
              <label
                >Items, one per line<textarea
                  rows="4"
                  lang="km"
                  value={(card.items ?? []).join("\n")}
                  on:change={(e) =>
                    onChange(
                      updateCard(edit, cardId, {
                        items: (e.currentTarget as HTMLTextAreaElement).value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .slice(0, 4),
                      }),
                      "Card text",
                    )}
                ></textarea></label
              >
            {/if}
            {#if cardHost.overlay && cutaway}
              <p class="fx-hint">
                Covers the picture while the talk underneath keeps playing its
                sound and captions.
              </p>
              <label
                >Length (s)<input
                  type="number"
                  step="0.1"
                  min="0.6"
                  max="8"
                  value={fmt(cutaway.duration)}
                  on:change={(e) =>
                    cutaway &&
                    onChange(
                      updateCutaway(edit, cutaway.id, {
                        duration: Math.max(0.6, Math.min(8, num(e))),
                      }),
                      "Card length",
                    )}
                /></label
              >
              <button
                type="button"
                class="fx-link fx-danger"
                on:click={() => {
                  if (cutaway)
                    onChange(removeCutaway(edit, cutaway.id), "Delete card");
                  onSelect("", false);
                }}><Trash2 size={12} /> Remove this card</button
              >
            {:else if segment}
              <div class="fx-grid2">
                <label
                  >Length (s)<input
                    type="number"
                    step="0.1"
                    min="0.6"
                    max="8"
                    value={fmt(segment.out - segment.in)}
                    on:change={(e) =>
                      onChange(
                        updateSegment(edit, segment.id, {
                          in: 0,
                          out: Math.min(8, Math.max(0.6, num(e))),
                        }),
                        "Card length",
                      )}
                  /></label
                >
                <label
                  >Transition in
                  <select
                    value={segment.transition}
                    on:change={(e) =>
                      onChange(
                        updateSegment(edit, segment.id, {
                          transition: text(e) as typeof segment.transition,
                        }),
                        "Transition",
                      )}
                  >
                    {#each FOOTAGE_TRANSITIONS as option (option)}<option
                        value={option}>{option}</option
                      >{/each}
                  </select>
                </label>
              </div>
            {/if}
          </section>
        {:else if segment}
          {@const clip = clipOf(edit, segment.assetId)}
          <section class="fx-card fx-card--selected">
            <header>
              <strong>{clip?.name ?? "Clip"}</strong><small
                >{fmt(segment.out - segment.in)} s</small
              >
            </header>
            <div class="fx-grid2">
              <label
                >In (s)<input
                  type="number"
                  step="0.1"
                  min="0"
                  value={fmt(segment.in)}
                  on:change={(e) =>
                    onChange(
                      updateSegment(edit, segment.id, {
                        in: Math.max(0, Math.min(num(e), segment.out - 0.3)),
                      }),
                      "Trim start",
                    )}
                /></label
              >
              <label
                >Out (s)<input
                  type="number"
                  step="0.1"
                  min="0"
                  value={fmt(segment.out)}
                  on:change={(e) =>
                    onChange(
                      updateSegment(edit, segment.id, {
                        out: Math.min(
                          clip?.duration ?? segment.out,
                          Math.max(num(e), segment.in + 0.3),
                        ),
                      }),
                      "Trim end",
                    )}
                /></label
              >
              <label
                >Transition in
                <select
                  value={segment.transition}
                  on:change={(e) =>
                    onChange(
                      updateSegment(edit, segment.id, {
                        transition: text(e) as typeof segment.transition,
                      }),
                      "Transition",
                    )}
                >
                  {#each FOOTAGE_TRANSITIONS as option (option)}<option
                      value={option}>{option}</option
                    >{/each}
                </select>
              </label>
              <label
                >Layout
                <select
                  value={segment.layout === "split" && segment.overlay
                    ? segment.overlay.assetId
                    : ""}
                  on:change={(e) => {
                    const assetId = text(e);
                    onChange(
                      updateSegment(
                        edit,
                        segment.id,
                        assetId
                          ? {
                              layout: "split",
                              overlay: {
                                assetId,
                                in:
                                  segment.overlay?.assetId === assetId
                                    ? segment.overlay.in
                                    : 0,
                              },
                            }
                          : { layout: "full", overlay: undefined },
                      ),
                      assetId ? "Split screen" : "Full frame",
                    );
                  }}
                >
                  <option value="">Full frame</option>
                  {#each edit.clips.filter((item) => item.assetId !== segment.assetId) as other (other.assetId)}
                    <option value={other.assetId}
                      >Split · {other.name} on top</option
                    >
                  {/each}
                </select>
              </label>
              {#if segment.layout === "split" && segment.overlay}
                <label
                  >Top clip from (s)<input
                    type="number"
                    step="0.1"
                    min="0"
                    value={fmt(segment.overlay.in)}
                    on:change={(e) =>
                      onChange(
                        updateSegment(edit, segment.id, {
                          overlay: {
                            ...segment.overlay!,
                            in: Math.max(0, num(e)),
                          },
                        }),
                        "Split start",
                      )}
                  /></label
                >
              {/if}
              <label class="fx-check"
                ><input
                  type="checkbox"
                  checked={(segment.punch ?? 1) > 1}
                  on:change={(e) =>
                    onChange(
                      updateSegment(edit, segment.id, {
                        punch: (e.currentTarget as HTMLInputElement).checked
                          ? 1.08
                          : 1,
                      }),
                      "Punch-in",
                    )}
                /> Closer framing</label
              >
              <label
                >Push-in<input
                  type="range"
                  min="1"
                  max="1.3"
                  step="0.02"
                  value={segment.zoom}
                  on:change={(e) =>
                    onChange(
                      updateSegment(edit, segment.id, { zoom: num(e) }),
                      "Push-in",
                    )}
                /></label
              >
              <label
                >Volume<input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={segment.volume}
                  on:change={(e) =>
                    onChange(
                      updateSegment(edit, segment.id, { volume: num(e) }),
                      "Clip volume",
                    )}
                /></label
              >
              <label title="J-cut: this clip's sound starts before its picture"
                >J-cut (s)<input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={fmt(segment.audioLead)}
                  on:change={(e) =>
                    onChange(
                      updateSegment(edit, segment.id, {
                        audioLead: Math.max(0, Math.min(2, num(e))),
                      }),
                      "J-cut",
                    )}
                /></label
              >
              <label
                title="L-cut: this clip's sound runs on under the next picture"
                >L-cut (s)<input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={fmt(segment.audioTail)}
                  on:change={(e) =>
                    onChange(
                      updateSegment(edit, segment.id, {
                        audioTail: Math.max(0, Math.min(2, num(e))),
                      }),
                      "L-cut",
                    )}
                /></label
              >
            </div>
          </section>
        {:else if title}
          <section class="fx-card fx-card--selected">
            <header><strong>Title</strong><small>{title.style}</small></header>
            <label
              >Text<input
                type="text"
                lang="km"
                value={title.text}
                on:change={(e) =>
                  onChange(
                    updateTitle(edit, title.id, { text: text(e) }),
                    "Title text",
                  )}
              /></label
            >
            <label
              >Second line<input
                type="text"
                lang="km"
                value={title.sub ?? ""}
                on:change={(e) =>
                  onChange(
                    updateTitle(edit, title.id, { sub: text(e) || undefined }),
                    "Title text",
                  )}
              /></label
            >
            <label
              >Colour<input
                type="color"
                value={title.color ??
                  (title.style === "headline" ? edit.theme.accent : "#ffffff")}
                on:change={(e) =>
                  onChange(
                    updateTitle(edit, title.id, { color: text(e) }),
                    "Title colour",
                  )}
              /></label
            >
            <div class="fx-grid2">
              <label
                >Style
                <select
                  value={title.style}
                  on:change={(e) =>
                    onChange(
                      updateTitle(edit, title.id, {
                        style: text(e) as FootageTitleStyle,
                      }),
                      "Title style",
                    )}
                >
                  {#each FOOTAGE_TITLE_STYLES as option (option)}<option
                      value={option}>{option}</option
                    >{/each}
                </select>
              </label>
              <label
                >Position
                <select
                  value={title.position}
                  on:change={(e) =>
                    onChange(
                      updateTitle(edit, title.id, {
                        position: text(e) as typeof title.position,
                      }),
                      "Title position",
                    )}
                >
                  <option value="top">top</option><option value="center"
                    >center</option
                  ><option value="bottom">bottom</option>
                </select>
              </label>
              <label
                >Start (s)<input
                  type="number"
                  step="0.1"
                  min="0"
                  value={fmt(title.start)}
                  on:change={(e) =>
                    onChange(
                      updateTitle(edit, title.id, {
                        start: Math.max(0, Math.min(total - 0.3, num(e))),
                      }),
                      "Move title",
                    )}
                /></label
              >
              <label
                >Length (s)<input
                  type="number"
                  step="0.1"
                  min="0.4"
                  value={fmt(title.duration)}
                  on:change={(e) =>
                    onChange(
                      updateTitle(edit, title.id, {
                        duration: Math.max(0.4, num(e)),
                      }),
                      "Title length",
                    )}
                /></label
              >
            </div>
          </section>
        {:else if cue}
          <section class="fx-card fx-card--selected">
            <header><strong>Caption</strong></header>
            <label
              >Text<textarea
                rows="2"
                lang="km"
                value={cue.text}
                on:change={(e) =>
                  onChange(
                    updateCue(edit, cue.id, {
                      text: (e.currentTarget as HTMLTextAreaElement).value,
                    }),
                    "Edit caption",
                  )}
              ></textarea></label
            >
            <label
              >Second line<input
                type="text"
                value={cue.alt ?? ""}
                on:change={(e) =>
                  onChange(
                    updateCue(edit, cue.id, { alt: text(e) || undefined }),
                    "Edit caption",
                  )}
              /></label
            >
          </section>
        {/if}
        {#if !cutaway && !segment && !title && !cue}
          <div class="fx-empty-bin">
            <SlidersHorizontal size={22} />
            <strong
              >{selectedIds.length > 1
                ? `${selectedIds.length} things selected`
                : "Nothing selected"}</strong
            >
            <small
              >{selectedIds.length > 1
                ? "Ask the chat to change them together, or select one to edit it here."
                : "Click a clip, card, caption or overlay in the timeline or the preview to edit it here."}</small
            >
          </div>
        {/if}
      {:else if tab === "clips"}
        <button
          type="button"
          class="fx-upload-btn"
          class:fx-over={dragOver}
          title=".mp4, .mov or .webm, up to 50 MB each"
          on:click={() => fileInput.click()}
          on:dragover|preventDefault={() => (dragOver = true)}
          on:dragleave={() => (dragOver = false)}
          on:drop|preventDefault={(e) => {
            dragOver = false;
            void addFiles(e.dataTransfer?.files ?? null);
          }}><Upload size={15} /> Upload videos or pictures</button
        >
        <input
          bind:this={fileInput}
          type="file"
          accept={`${VIDEO_ACCEPT},image/png,image/jpeg,image/webp,image/gif`}
          multiple
          hidden
          on:change={(e) =>
            addFiles((e.currentTarget as HTMLInputElement).files)}
        />
        {#each uploads as upload (upload.name)}
          <div class="fx-upload" class:fx-error={upload.error}>
            <span>{upload.name}</span>
            {#if upload.error}<small>{upload.error}</small>{:else}<progress
                max="100"
                value={upload.progress}
              ></progress>{/if}
          </div>
        {/each}

        <form class="fx-stock" on:submit|preventDefault={findStock}>
          <span class="fx-asset__label">Stock B-roll</span>
          <div class="fx-stock__row">
            <input
              type="search"
              placeholder="Search Pixabay, e.g. coffee shop"
              bind:value={stockQuery}
              aria-label="Search stock footage"
            />
            <button
              type="submit"
              disabled={stockSearching || !stockQuery.trim()}
              >{stockSearching ? "…" : "Search"}</button
            >
          </div>
          {#if stockError}<p class="fx-hint">{stockError}</p>{/if}
          {#if stockItems.length > 0}
            <div class="fx-stock__grid">
              {#each stockItems as item (item.id)}
                <button
                  type="button"
                  class="fx-stock__item"
                  title={`${item.tags.join(", ")} · by ${item.creator.name} on Pixabay`}
                  disabled={stockImporting !== 0 || !projectId}
                  on:click={() => useStock(item)}
                  style:background-image={`url(${item.thumbnailUrl})`}
                >
                  {#if stockImporting === item.id}<span class="fx-stock__busy"
                      ><Loader2 size={14} class="fx-spin" /></span
                    >{/if}
                  {#if item.durationSeconds}<span class="fx-asset__duration"
                      >{clock(item.durationSeconds)}</span
                    >{/if}
                </button>
              {/each}
            </div>
            <small class="fx-hint"
              >Videos from <a
                href="https://pixabay.com/"
                target="_blank"
                rel="noopener">Pixabay</a
              >. Click one to lay it over the talk at the playhead.</small
            >
          {/if}
        </form>
        <ul class="fx-bin">
          {#each edit.clips as clip (clip.assetId)}
            {@const status = $clipStatuses[clip.assetId]}
            {@const uses = edit.segments.filter(
              (segment) => segment.assetId === clip.assetId,
            ).length}
            {@const open = openClip === clip.assetId}
            <li class="fx-asset" class:fx-asset--open={open}>
              <div
                class="fx-asset__thumb"
                style:background-image={posters[clip.assetId]
                  ? `url(${posters[clip.assetId]})`
                  : undefined}
              >
                {#if status?.status === "failed"}
                  <span class="fx-asset__state fx-asset__state--bad"
                    ><AlertTriangle size={12} /> Couldn’t read</span
                  >
                {:else if status?.status !== "ready"}
                  <span class="fx-asset__state"
                    ><Loader2 size={12} class="fx-spin" />
                    {STAGE_LABEL[status?.stage ?? "queued"]}…</span
                  >
                {/if}
                {#if uses > 0}<span class="fx-asset__used"
                    >In video{uses > 1 ? ` ×${uses}` : ""}</span
                  >{/if}
                <span class="fx-asset__duration">{clock(clip.duration)}</span>
                <button
                  type="button"
                  class="fx-asset__add"
                  title="Add the whole clip to the end"
                  on:click={() =>
                    onChange(appendClip(edit, clip.assetId), "Add clip")}
                  ><Plus size={14} /> Add</button
                >
              </div>
              <div class="fx-asset__meta">
                <span class="fx-asset__name" title={clip.name}>{clip.name}</span
                >
                <span class="fx-asset__tags">
                  {#if status?.transcript?.words.length}<span
                      >Speech · {status.transcript.language.toUpperCase()}</span
                    >{:else if status?.media && !status.media.hasAudio}<span
                      >No sound</span
                    >{/if}
                  {#if status?.analysis?.moments.length}<span
                      >{status.analysis.moments.length} moments</span
                    >{/if}
                </span>
                <button
                  type="button"
                  class="fx-asset__more"
                  aria-expanded={open}
                  title={open ? "Hide details" : "Details and best moments"}
                  on:click={() => (openClip = open ? "" : clip.assetId)}
                >
                  <ChevronDown size={15} />
                </button>
              </div>
              {#if open}
                <div class="fx-asset__details">
                  {#if status?.status === "failed"}
                    <p class="fx-warn">{status.error}</p>
                    <button
                      type="button"
                      class="fx-link"
                      on:click={() => retryClip(clip.assetId)}
                      ><RefreshCw size={12} /> Try again</button
                    >
                  {/if}
                  {#if status?.analysis?.summary}<p class="fx-asset__summary">
                      {status.analysis.summary}
                    </p>{/if}
                  {#if status?.analysis?.moments.length}
                    <span class="fx-asset__label">Best moments</span>
                    <ul class="fx-moment-list">
                      {#each status.analysis.moments as moment (`${moment.start}-${moment.end}`)}
                        <li>
                          <button
                            type="button"
                            title={`${moment.label} (add to the end of the video)`}
                            on:click={() =>
                              addMoment(clip.assetId, moment.start, moment.end)}
                          >
                            <span class="fx-moment-time"
                              >{clock(moment.start)}–{clock(moment.end)}</span
                            >
                            <span class="fx-moment-label">{moment.label}</span>
                            <Plus size={13} />
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                  {#if status?.analysis?.issues.length}
                    <span class="fx-asset__label">Watch out for</span>
                    <p class="fx-asset__issues">
                      {status.analysis.issues.join(" · ")}
                    </p>
                  {/if}
                  <button
                    type="button"
                    class="fx-link"
                    title="Show this clip over the talk at the playhead; the speaker keeps talking underneath"
                    on:click={() => {
                      const next = addCutaway(
                        edit,
                        time,
                        clip.assetId,
                        status?.analysis?.moments[0]?.start ?? 0,
                        2.5,
                      );
                      if (next === edit)
                        onNotice(
                          "Move the playhead over talk to put B-roll on it.",
                        );
                      else onChange(next, "Add B-roll");
                    }}
                    ><Plus size={12} /> B-roll over the talk at the playhead</button
                  >
                  <button
                    type="button"
                    class="fx-link fx-danger"
                    on:click={() => {
                      openClip = "";
                      onChange(removeClip(edit, clip.assetId), "Remove clip");
                    }}><Trash2 size={12} /> Remove from this video</button
                  >
                </div>
              {/if}
            </li>
          {:else}
            <li class="fx-empty-bin">
              <Film size={22} />
              <strong>No clips yet</strong>
              <small>Upload your raw footage to start.</small>
            </li>
          {/each}
        </ul>
      {:else if tab === "text"}
        <section class="fx-card">
          <header>
            <strong><Clapperboard size={14} /> Motion cards</strong>
          </header>
          <p class="fx-hint">
            Full-screen animated cards between your shots: a name, a price, a
            list, the ending. Added after the clip at the playhead.
          </p>
          <div class="fx-chips">
            {#each CARD_PRESETS as preset (preset.label)}
              <button type="button" on:click={() => newCard(preset.card)}
                ><Plus size={11} /> {preset.label}</button
              >
            {/each}
          </div>
        </section>
        <section class="fx-card">
          <header>
            <strong><Type size={14} /> Text over the video</strong>
          </header>
          <p class="fx-hint">
            Captions already show what is said. Add text on top only when you
            need it.
          </p>
          <div class="fx-chips">
            <button type="button" on:click={() => newTitle("headline")}
              ><Plus size={11} /> Headline</button
            >
            <button type="button" on:click={() => newTitle("kinetic")}
              ><Plus size={11} /> Big statement</button
            >
            <button type="button" on:click={() => newTitle("badge")}
              ><Plus size={11} /> Price badge</button
            >
            <button type="button" on:click={() => newTitle("lower-third")}
              ><Plus size={11} /> Name / place</button
            >
            <button type="button" on:click={() => newTitle("cta")}
              ><Plus size={11} /> Call to action</button
            >
          </div>
          <ul class="fx-list">
            {#each edit.titles as item (item.id)}
              <li>
                <button
                  type="button"
                  class:fx-on={selectedIds.includes(item.id)}
                  on:click={(e) => {
                    onSelect(item.id, e.ctrlKey || e.metaKey || e.shiftKey);
                    onSeek(item.start + 0.001);
                  }}
                  ><span>{item.text}</span><small
                    >{fmt(item.start)}s · {item.style}</small
                  ></button
                >
              </li>
            {/each}
          </ul>
        </section>
        <section class="fx-card">
          <header>
            <strong><Captions size={14} /> Captions</strong><small
              >{edit.captions.language}</small
            >
          </header>
          <div class="fx-grid2">
            <label class="fx-check"
              ><input
                type="checkbox"
                checked={edit.captions.enabled}
                on:change={(e) =>
                  onChange(
                    {
                      ...edit,
                      captions: {
                        ...edit.captions,
                        enabled: (e.currentTarget as HTMLInputElement).checked,
                      },
                    },
                    "Captions on/off",
                  )}
              /> Show captions</label
            >
            <label
              >Style
              <select
                value={edit.captions.style}
                on:change={(e) =>
                  onChange(
                    {
                      ...edit,
                      captions: {
                        ...edit.captions,
                        style: text(e) as FootageEdit["captions"]["style"],
                      },
                    },
                    "Caption style",
                  )}
              >
                <option value="clean">White</option><option value="pop"
                  >Yellow</option
                ><option value="box">Box</option>
              </select>
            </label>
            <label
              >Colour<input
                type="color"
                value={edit.captions.color ??
                  (edit.captions.style === "pop"
                    ? edit.theme.accent
                    : "#ffffff")}
                on:change={(e) =>
                  onChange(
                    { ...edit, captions: { ...edit.captions, color: text(e) } },
                    "Caption colour",
                  )}
              /></label
            >
            <label
              >Position
              <select
                value={edit.captions.position}
                on:change={(e) =>
                  onChange(
                    {
                      ...edit,
                      captions: {
                        ...edit.captions,
                        position: text(e) as "bottom" | "center",
                      },
                    },
                    "Caption position",
                  )}
              >
                <option value="bottom">bottom</option><option value="center"
                  >center</option
                >
              </select>
            </label>
            <label
              >Translate to
              <select
                disabled={translating || edit.captions.cues.length === 0}
                on:change={(e) => {
                  const value = text(e);
                  (e.currentTarget as HTMLSelectElement).value = "";
                  if (value) void translateAll(value);
                }}
              >
                <option value=""
                  >{translating ? "Translating…" : "Choose…"}</option
                ><option value="km">Khmer</option><option value="en"
                  >English</option
                >
              </select>
            </label>
          </div>
          {#if edit.captions.cues.length === 0}
            <p class="fx-hint">
              Captions come from what is said in your clips. Cut the video with
              AI to make them.
            </p>
            <button
              type="button"
              on:click={() =>
                onChange(
                  {
                    ...edit,
                    captions: {
                      ...edit.captions,
                      enabled: true,
                      cues: [
                        ...edit.captions.cues,
                        ...(edit.segments[0]
                          ? [
                              {
                                id: newId("c"),
                                assetId: edit.segments[0].assetId,
                                start: edit.segments[0].in,
                                end: Math.min(
                                  edit.segments[0].out,
                                  edit.segments[0].in + 2,
                                ),
                                text: "អត្ថបទ",
                              },
                            ]
                          : []),
                      ],
                    },
                  },
                  "Add caption",
                )}><Plus size={11} /> Add a caption by hand</button
            >
          {/if}
          <ul class="fx-cues">
            {#each shownCues as placed, index (`${placed.cue.id}-${index}`)}
              <li class:fx-on={selectedIds.includes(placed.cue.id)}>
                <button
                  type="button"
                  class="fx-cue-time"
                  on:click={(e) => {
                    onSelect(
                      placed.cue.id,
                      e.ctrlKey || e.metaKey || e.shiftKey,
                    );
                    onSeek(placed.start + 0.001);
                  }}>{fmt(placed.start)}</button
                >
                <input
                  type="text"
                  lang="km"
                  value={placed.cue.text}
                  on:focus={() => onSelect(placed.cue.id, false)}
                  on:change={(e) =>
                    onChange(
                      updateCue(edit, placed.cue.id, { text: text(e) }),
                      "Edit caption",
                    )}
                />
              </li>
            {/each}
          </ul>
        </section>
      {:else if tab === "audio"}
        <section class="fx-card">
          <header><strong><Music size={14} /> Music</strong></header>
          {#if edit.music}
            <p class="fx-now">♪ {edit.music.title}</p>
            <label
              >Volume<input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={edit.music.volume}
                on:change={(e) =>
                  onChange(
                    { ...edit, music: { ...edit.music!, volume: num(e) } },
                    "Music volume",
                  )}
              /></label
            >
            <label class="fx-check"
              ><input
                type="checkbox"
                checked={edit.music.duck}
                on:change={(e) =>
                  onChange(
                    {
                      ...edit,
                      music: {
                        ...edit.music!,
                        duck: (e.currentTarget as HTMLInputElement).checked,
                      },
                    },
                    "Music ducking",
                  )}
              /> Lower the music under speech</label
            >
            <button
              type="button"
              class="fx-danger"
              on:click={() =>
                onChange({ ...edit, music: null }, "Remove music")}
              ><Trash2 size={12} /> Remove music</button
            >
          {/if}
          <ul class="fx-list">
            {#each songs as song (song.id)}
              <li>
                <button
                  type="button"
                  class:fx-on={edit.music?.trackId === song.id}
                  on:click={() =>
                    onChange(
                      {
                        ...edit,
                        music: {
                          trackId: song.id,
                          title: song.title,
                          volume: edit.music?.volume ?? 0.25,
                          duck: edit.music?.duck ?? true,
                        },
                      },
                      "Change music",
                    )}
                  ><span>{song.title}</span><small
                    >{(song.moodTags ?? []).slice(0, 2).join(", ")} · {Math.round(
                      song.durationMs / 1000,
                    )}s</small
                  ></button
                >
              </li>
            {:else}
              <li class="fx-hint">
                {songsLoaded ? "No songs in the library." : "Loading…"}
              </li>
            {/each}
          </ul>
        </section>
        <section class="fx-card">
          <header><strong>Sound effects</strong></header>
          <label class="fx-check"
            ><input
              type="checkbox"
              checked={edit.sfx !== false}
              on:change={(e) =>
                onChange(
                  {
                    ...edit,
                    sfx: (e.currentTarget as HTMLInputElement).checked,
                  },
                  "Sound effects",
                )}
            /> Whoosh on transitions, pop on cards</label
          >
        </section>
        <section class="fx-card">
          <header><strong>Clip sound</strong></header>
          <p class="fx-hint">
            Select a clip in the timeline to set its volume or a J/L-cut.
            "Remove silences" in the timeline cuts out pauses.
          </p>
          <button
            type="button"
            on:click={() =>
              onChange(
                {
                  ...edit,
                  segments: edit.segments.map((item) => ({
                    ...item,
                    volume: 0,
                  })),
                },
                "Mute all clips",
              )}>Mute every clip (music only)</button
          >
        </section>
      {:else}
        <section class="fx-card">
          <header><strong><Clapperboard size={14} /> Format</strong></header>
          <div class="fx-pills" role="group" aria-label="Format">
            {#each FOOTAGE_FORMATS as option (option)}
              <button
                type="button"
                class:fx-on={edit.format === option}
                on:click={() =>
                  onChange(setFormat(edit, option), `Format ${option}`)}
                >{option}{option === "9:16"
                  ? " · TikTok, Reels"
                  : option === "16:9"
                    ? " · YouTube"
                    : " · Feed"}</button
              >
            {/each}
          </div>
        </section>
        <section class="fx-card">
          <header><strong>Colours</strong></header>
          <div class="fx-grid2">
            <label
              >Accent<input
                type="color"
                value={edit.theme.accent}
                on:change={(e) =>
                  onChange(
                    { ...edit, theme: { ...edit.theme, accent: text(e) } },
                    "Accent colour",
                  )}
              /></label
            >
            <label
              >Text on accent<input
                type="color"
                value={edit.theme.ink}
                on:change={(e) =>
                  onChange(
                    { ...edit, theme: { ...edit.theme, ink: text(e) } },
                    "Text colour",
                  )}
              /></label
            >
          </div>
        </section>
      {/if}
    </div>
  </div>
</aside>

<script lang="ts">
  import {
    Captions,
    Eraser,
    Film,
    Layers,
    Music,
    Redo2,
    Scissors,
    Trash2,
    Type,
    Undo2,
    VolumeX,
    ZoomIn,
    ZoomOut,
  } from "lucide-svelte";
  import { clipStatuses } from "./clips";
  import { footageFileUrl } from "./api";
  import {
    clipOf,
    cutawayFrame,
    cutawayMaxLength,
    editDuration,
    trimCutawayStart,
    moveSegment,
    placeCues,
    placeCutaways,
    placeSegments,
    moveCutaway,
    removeCutaway,
    removeFillers,
    removeSegment,
    removeSilences,
    updateCutaway,
    removeTitle,
    splitAt,
    trimSegment,
    updateTitle,
    MIN_SEGMENT,
    type FootageEdit,
  } from "./edit";

  /** The edit on screen. */
  export let edit: FootageEdit;
  /** The playhead, in seconds. */
  export let time = 0;
  /** What is selected: segment, title and caption ids. */
  export let selectedIds: string[] = [];
  export let canUndo = false;
  export let canRedo = false;
  export let onChange: (next: FootageEdit, label: string) => void;
  export let onSeek: (time: number) => void;
  /** `additive` (Ctrl, Cmd or Shift held) adds to the selection or takes it out of it. */
  export let onSelect: (id: string, additive: boolean) => void;
  export let onUndo: () => void;
  export let onRedo: () => void;

  let scroller: HTMLDivElement;
  let width = 800;
  let zoom = 1;
  const LABEL = 92;

  $: total = Math.max(0.5, editDuration(edit));
  $: fitPps = Math.max(18, (width - LABEL - 24) / total);
  $: pps = fitPps * zoom;
  $: placed = placeSegments(edit);
  $: cues = placeCues(edit);
  $: cutaways = placeCutaways(edit);
  $: selectedCutaways = (edit.cutaways ?? []).filter((cut) =>
    selectedIds.includes(cut.id),
  );
  $: ticks = tickValues(total, pps);
  $: selectedSegments = edit.segments.filter((s) => selectedIds.includes(s.id));
  $: selectedTitles = edit.titles.filter((t) => selectedIds.includes(t.id));

  function tickValues(duration: number, pixelsPerSecond: number): number[] {
    const step =
      [0.5, 1, 2, 5, 10, 15, 30, 60].find(
        (candidate) => candidate * pixelsPerSecond >= 56,
      ) ?? 60;
    return Array.from(
      { length: Math.floor(duration / step) + 1 },
      (_, index) => Math.round(index * step * 100) / 100,
    );
  }

  const format = (seconds: number) => {
    const whole = Math.max(0, seconds);
    const minutes = Math.floor(whole / 60);
    const rest = whole - minutes * 60;
    return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
  };

  // Filmstrips, one per clip, from the backend's strip.jpg.
  let strips: Record<string, string> = {};
  $: for (const clip of edit.clips) {
    if (strips[clip.assetId] !== undefined) continue;
    if ($clipStatuses[clip.assetId]?.status !== "ready") continue;
    strips[clip.assetId] = "";
    void footageFileUrl(clip.assetId, "strip.jpg")
      .then((url) => (strips = { ...strips, [clip.assetId]: url }))
      .catch(() => undefined);
  }

  // ---- dragging -----------------------------------------------------------------------

  type Drag =
    | { kind: "move"; id: string; x0: number; dx: number }
    | { kind: "trim-in" | "trim-out"; id: string; x0: number; dx: number }
    | {
        kind: "title-move" | "title-length";
        id: string;
        x0: number;
        dx: number;
      }
    | {
        kind: "cut-move" | "cut-start" | "cut-length";
        id: string;
        x0: number;
        dx: number;
      }
    | { kind: "seek"; x0: number; dx: number; lane: boolean };
  let drag: Drag | null = null;

  function timeFromPointer(event: PointerEvent): number {
    const rect = scroller.getBoundingClientRect();
    const x = event.clientX - rect.left + scroller.scrollLeft - LABEL;
    return Math.max(0, Math.min(total, x / pps));
  }

  function startSeek(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    // The ruler only moves the playhead; a plain click on an empty track also deselects (see end()).
    const lane = !(event.currentTarget as HTMLElement).classList.contains(
      "fx-ruler",
    );
    drag = { kind: "seek", x0: event.clientX, dx: 0, lane };
    onSeek(timeFromPointer(event));
  }

  function start(
    event: PointerEvent,
    next: Exclude<Drag, { kind: "seek" }>,
  ): void {
    event.stopPropagation();
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag = next;
  }

  function move(event: PointerEvent): void {
    if (!drag) return;
    if (drag.kind === "seek") {
      drag = { ...drag, dx: event.clientX - drag.x0 };
      onSeek(timeFromPointer(event));
      return;
    }
    drag = { ...drag, dx: event.clientX - drag.x0 };
  }

  function end(event: PointerEvent): void {
    const finished = drag;
    drag = null;
    if (!finished) return;
    if (finished.kind === "seek") {
      // A deliberate click on empty track deselects; dragging the playhead never does.
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      if (
        finished.lane &&
        Math.abs(finished.dx) < 4 &&
        !additive &&
        selectedIds.length > 0
      )
        onSelect("", false);
      return;
    }
    const seconds = finished.dx / pps;
    if (Math.abs(finished.dx) < 4) {
      // A click: select it and go to it.
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      onSelect(finished.id, additive);
      if (additive) return;
      const segment = placed.find((item) => item.segment.id === finished.id);
      const title = edit.titles.find((item) => item.id === finished.id);
      const cutaway = cutaways.find((item) => item.cutaway.id === finished.id);
      if (segment) onSeek(segment.start + 0.001);
      else if (title) onSeek(title.start + 0.001);
      else if (cutaway) onSeek(cutaway.start + 0.001);
      return;
    }
    switch (finished.kind) {
      case "move": {
        const from = placed.find((item) => item.segment.id === finished.id);
        if (!from) return;
        const centre = (from.start + from.end) / 2 + seconds;
        const others = placed.filter((item) => item.segment.id !== finished.id);
        const index = others.filter(
          (item) => (item.start + item.end) / 2 < centre,
        ).length;
        onChange(moveSegment(edit, finished.id, index), "Move clip");
        break;
      }
      case "trim-in": {
        const segment = edit.segments.find((s) => s.id === finished.id);
        if (segment)
          onChange(
            trimSegment(edit, segment.id, { in: segment.in + seconds }),
            "Trim start",
          );
        break;
      }
      case "trim-out": {
        const segment = edit.segments.find((s) => s.id === finished.id);
        if (segment)
          onChange(
            trimSegment(edit, segment.id, { out: segment.out + seconds }),
            "Trim end",
          );
        break;
      }
      case "title-move": {
        const title = edit.titles.find((t) => t.id === finished.id);
        if (title)
          onChange(
            updateTitle(edit, title.id, {
              start:
                Math.round(
                  Math.max(0, Math.min(total - 0.3, title.start + seconds)) *
                    100,
                ) / 100,
            }),
            "Move title",
          );
        break;
      }
      case "cut-move": {
        const cutaway = cutaways.find(
          (item) => item.cutaway.id === finished.id,
        );
        if (cutaway) {
          const next = moveCutaway(
            edit,
            finished.id,
            Math.max(0, cutaway.start + seconds),
          );
          if (next !== edit) onChange(next, "Move B-roll");
        }
        break;
      }
      case "cut-start": {
        const cutaway = cutaways.find(
          (item) => item.cutaway.id === finished.id,
        );
        if (cutaway) {
          const next = trimCutawayStart(
            edit,
            finished.id,
            Math.max(0, cutaway.start + seconds),
          );
          if (next !== edit) onChange(next, "Overlay start");
        }
        break;
      }
      case "cut-length": {
        const cutaway = cutaways.find(
          (item) => item.cutaway.id === finished.id,
        );
        if (cutaway)
          onChange(
            updateCutaway(edit, finished.id, {
              // From what it shows now, so one cut short by a card grows from there.
              duration:
                Math.round(
                  Math.max(
                    0.3,
                    Math.min(
                      cutawayMaxLength(edit, cutaway.cutaway),
                      cutaway.end - cutaway.start + seconds,
                    ),
                  ) * 100,
                ) / 100,
            }),
            "Overlay length",
          );
        break;
      }
      case "title-length": {
        const title = edit.titles.find((t) => t.id === finished.id);
        if (title)
          onChange(
            updateTitle(edit, title.id, {
              duration:
                Math.round(
                  Math.max(
                    0.4,
                    Math.min(total - title.start, title.duration + seconds),
                  ) * 100,
                ) / 100,
            }),
            "Title length",
          );
        break;
      }
    }
    void event;
  }

  /** A segment's box while it is dragged: moved, or with an edge pulled. */
  function segmentBox(item: (typeof placed)[number], current: Drag | null) {
    let left = item.start * pps;
    let boxWidth = (item.end - item.start) * pps;
    if (
      current &&
      current.kind !== "seek" &&
      "id" in current &&
      current.id === item.segment.id
    ) {
      const clip = clipOf(edit, item.segment.assetId);
      if (current.kind === "move") left += current.dx;
      if (current.kind === "trim-in") {
        const shift = Math.max(
          -item.segment.in * pps,
          Math.min(current.dx, boxWidth - MIN_SEGMENT * pps),
        );
        left += shift;
        boxWidth -= shift;
      }
      if (current.kind === "trim-out") {
        const room =
          ((clip?.duration ?? item.segment.out) - item.segment.out) * pps;
        boxWidth = Math.max(
          MIN_SEGMENT * pps,
          boxWidth + Math.min(current.dx, room),
        );
      }
    }
    return { left, width: boxWidth };
  }

  function cutawayBox(item: (typeof cutaways)[number], current: Drag | null) {
    let left = item.start * pps;
    let boxWidth = (item.end - item.start) * pps;
    if (current && "id" in current && current.id === item.cutaway.id) {
      if (current.kind === "cut-move") left = Math.max(0, left + current.dx);
      if (current.kind === "cut-start") {
        const shift = Math.max(
          -left,
          Math.min(current.dx, boxWidth - 0.3 * pps),
        );
        left += shift;
        boxWidth -= shift;
      }
      if (current.kind === "cut-length")
        boxWidth = Math.max(0.3 * pps, boxWidth + current.dx);
    }
    return { left, width: boxWidth };
  }

  /** What an overlay is called in the lane: its clip, "Picture", or its card's words. */
  function cutawayName(item: (typeof cutaways)[number]): string {
    const { cutaway } = item;
    if (cutaway.kind === "card")
      return `◆ ${cutaway.card?.title || cutaway.card?.big || "Card"}`;
    const frame = cutawayFrame(cutaway);
    const half = frame.top
      ? " · split"
      : frame.speaker
        ? " · speaker window"
        : frame.box
          ? " · window"
          : "";
    if (cutaway.kind === "image") return `▣ Picture${half}`;
    return `${clipOf(edit, cutaway.assetId)?.name ?? "B-roll"}${half}`;
  }

  function cutawayStrip(item: (typeof cutaways)[number]): string {
    if (item.cutaway.kind && item.cutaway.kind !== "clip") return "";
    const url = strips[item.cutaway.assetId];
    const clip = clipOf(edit, item.cutaway.assetId);
    if (!url || !clip) return "";
    return `background-image:url(${url});background-size:${clip.duration * pps}px 100%;background-position:${-item.trim * pps}px 0`;
  }

  function titleBox(
    title: FootageEdit["titles"][number],
    current: Drag | null,
  ) {
    let left = title.start * pps;
    let boxWidth = title.duration * pps;
    if (current && "id" in current && current.id === title.id) {
      if (current.kind === "title-move") left = Math.max(0, left + current.dx);
      if (current.kind === "title-length")
        boxWidth = Math.max(0.4 * pps, boxWidth + current.dx);
    }
    return { left, width: boxWidth };
  }

  function stripStyle(item: (typeof placed)[number]): string {
    const url = strips[item.segment.assetId];
    const clip = clipOf(edit, item.segment.assetId);
    if (!url || !clip) return "";
    return `background-image:url(${url});background-size:${clip.duration * pps}px 100%;background-position:${-item.segment.in * pps}px 0`;
  }

  // ---- commands -------------------------------------------------------------------------

  function split(): void {
    const next = splitAt(edit, time);
    if (next !== edit) onChange(next, "Split");
  }

  function remove(): void {
    if (
      selectedSegments.length === 0 &&
      selectedTitles.length === 0 &&
      selectedCutaways.length === 0
    )
      return;
    let next = edit;
    for (const cut of selectedCutaways) next = removeCutaway(next, cut.id);
    for (const segment of selectedSegments)
      next = removeSegment(next, segment.id);
    for (const title of selectedTitles) next = removeTitle(next, title.id);
    const count =
      selectedSegments.length + selectedTitles.length + selectedCutaways.length;
    onChange(
      next,
      count > 1
        ? `Delete ${count} items`
        : selectedSegments.length
          ? "Delete clip"
          : selectedCutaways.length
            ? "Delete B-roll"
            : "Delete title",
    );
    onSelect("", false);
  }

  function cutFillers(): void {
    const transcripts = Object.fromEntries(
      edit.clips.map((clip) => [
        clip.assetId,
        $clipStatuses[clip.assetId]?.transcript?.words ?? [],
      ]),
    );
    const next = removeFillers(edit, transcripts);
    const saved = editDuration(edit) - editDuration(next);
    if (next !== edit) onChange(next, `Remove fillers (−${saved.toFixed(1)}s)`);
  }

  function cutSilences(): void {
    const silences = Object.fromEntries(
      edit.clips.map((clip) => [
        clip.assetId,
        $clipStatuses[clip.assetId]?.silences ?? [],
      ]),
    );
    const next = removeSilences(edit, silences);
    const saved = editDuration(edit) - editDuration(next);
    if (saved > 0.05) onChange(next, `Remove silences (−${saved.toFixed(1)}s)`);
  }

  function keydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable]")) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      if (event.shiftKey) onRedo();
      else onUndo();
    } else if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      onRedo();
    } else if (key === "s" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      split();
    } else if (key === "delete" || key === "backspace") {
      event.preventDefault();
      remove();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<section
  class="fx-timeline"
  aria-label="Footage timeline"
  tabindex="0"
  on:keydown={keydown}
  bind:clientWidth={width}
>
  <div class="fx-timeline__bar">
    <div class="fx-timeline__tools">
      <button
        type="button"
        class="fx-tool"
        on:click={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"><Undo2 size={15} /></button
      >
      <button
        type="button"
        class="fx-tool"
        on:click={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"><Redo2 size={15} /></button
      >
      <span class="fx-sep"></span>
      <button
        type="button"
        class="fx-tool fx-tool--label"
        on:click={split}
        title="Split at the playhead (S)"
        ><Scissors size={15} /><span>Split</span></button
      >
      <button
        type="button"
        class="fx-tool fx-tool--label"
        on:click={remove}
        disabled={selectedSegments.length === 0 &&
          selectedTitles.length === 0 &&
          selectedCutaways.length === 0}
        title="Delete what is selected (Del). Ctrl- or Shift-click to select several."
        ><Trash2 size={15} /><span>Delete</span></button
      >
      <button
        type="button"
        class="fx-tool fx-tool--label"
        on:click={cutSilences}
        title="Cut every pause longer than 0.7 s"
        ><VolumeX size={15} /><span>Remove silences</span></button
      >
      <button
        type="button"
        class="fx-tool fx-tool--label"
        on:click={cutFillers}
        title="Cut “um”, “uh”, “អឺ” and other hesitation words"
        ><Eraser size={15} /><span>Remove fillers</span></button
      >
    </div>
    <div class="fx-timeline__tools">
      <span class="fx-time">{format(time)} / {format(total)}</span>
      <button
        type="button"
        class="fx-tool"
        on:click={() => (zoom = Math.max(0.5, zoom / 1.5))}
        aria-label="Zoom out"><ZoomOut size={15} /></button
      >
      <button
        type="button"
        class="fx-tool"
        on:click={() => (zoom = Math.min(12, zoom * 1.5))}
        aria-label="Zoom in"><ZoomIn size={15} /></button
      >
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fx-timeline__scroll"
    bind:this={scroller}
    on:pointermove={move}
    on:pointerup={end}
    on:pointercancel={end}
  >
    <div
      class="fx-timeline__content"
      style:width={`${LABEL + total * pps + 24}px`}
    >
      <div class="fx-row fx-row--ruler">
        <div class="fx-label"></div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fx-lane fx-ruler" on:pointerdown={startSeek}>
          {#each ticks as tick (tick)}
            <span class="fx-tick" style:left={`${tick * pps}px`}
              >{format(tick).replace(/\.0$/, "")}</span
            >
          {/each}
        </div>
      </div>

      <div class="fx-row">
        <div class="fx-label"><Type size={13} /> Titles</div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fx-lane fx-lane--thin" on:pointerdown={startSeek}>
          {#each edit.titles as title (title.id)}
            {@const box = titleBox(title, drag)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="fx-chip fx-chip--title"
              class:fx-selected={selectedIds.includes(title.id)}
              style:left={`${box.left}px`}
              style:width={`${box.width}px`}
              title={title.text}
              on:pointerdown={(event) =>
                start(event, {
                  kind: "title-move",
                  id: title.id,
                  x0: event.clientX,
                  dx: 0,
                })}
            >
              <span class="fx-chip__text">{title.text}</span>
              <span
                class="fx-handle fx-handle--out"
                role="slider"
                aria-label="Title length"
                aria-valuenow={title.duration}
                tabindex="-1"
                on:pointerdown={(event) =>
                  start(event, {
                    kind: "title-length",
                    id: title.id,
                    x0: event.clientX,
                    dx: 0,
                  })}
              ></span>
            </div>
          {/each}
        </div>
      </div>

      <div class="fx-row">
        <div class="fx-label"><Captions size={13} /> Captions</div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fx-lane fx-lane--thin" on:pointerdown={startSeek}>
          {#each cues as cue, index (`${cue.cue.id}-${index}`)}
            <button
              type="button"
              class="fx-chip fx-chip--cue"
              class:fx-selected={selectedIds.includes(cue.cue.id)}
              style:left={`${cue.start * pps}px`}
              style:width={`${Math.max(4, (cue.end - cue.start) * pps - 1)}px`}
              title={cue.cue.text}
              on:pointerdown|stopPropagation={() => undefined}
              on:click={(event) => {
                const additive =
                  event.ctrlKey || event.metaKey || event.shiftKey;
                onSelect(cue.cue.id, additive);
                if (!additive) onSeek(cue.start + 0.001);
              }}><span class="fx-chip__text">{cue.cue.text}</span></button
            >
          {/each}
        </div>
      </div>

      <div class="fx-row fx-row--broll">
        <div class="fx-label"><Layers size={13} /> Overlay</div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fx-lane fx-lane--thin" on:pointerdown={startSeek}>
          {#each cutaways as item, index (`${item.cutaway.id}-${index}`)}
            {@const box = cutawayBox(item, drag)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="fx-chip fx-chip--broll"
              class:fx-chip--card={item.cutaway.kind === "card"}
              class:fx-chip--picture={item.cutaway.kind === "image"}
              class:fx-selected={selectedIds.includes(item.cutaway.id)}
              style:left={`${box.left}px`}
              style:width={`${box.width}px`}
              style={cutawayStrip(item)}
              title={`${cutawayName(item)}: covers the picture; the talk underneath keeps playing`}
              on:pointerdown={(event) =>
                start(event, {
                  kind: "cut-move",
                  id: item.cutaway.id,
                  x0: event.clientX,
                  dx: 0,
                })}
            >
              <span
                class="fx-handle fx-handle--in"
                role="slider"
                aria-label="Overlay start"
                aria-valuenow={item.start}
                tabindex="-1"
                on:pointerdown={(event) =>
                  start(event, {
                    kind: "cut-start",
                    id: item.cutaway.id,
                    x0: event.clientX,
                    dx: 0,
                  })}
              ></span>
              <span class="fx-chip__text">{cutawayName(item)}</span>
              <span
                class="fx-handle fx-handle--out"
                role="slider"
                aria-label="Overlay length"
                aria-valuenow={item.end - item.start}
                tabindex="-1"
                on:pointerdown={(event) =>
                  start(event, {
                    kind: "cut-length",
                    id: item.cutaway.id,
                    x0: event.clientX,
                    dx: 0,
                  })}
              ></span>
            </div>
          {/each}
        </div>
      </div>

      <div class="fx-row fx-row--video">
        <div class="fx-label"><Film size={13} /> Video</div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fx-lane" on:pointerdown={startSeek}>
          {#each placed as item (item.segment.id)}
            {@const box = segmentBox(item, drag)}
            {@const clip = clipOf(edit, item.segment.assetId)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="fx-seg"
              class:fx-seg--card={Boolean(item.segment.card)}
              class:fx-selected={selectedIds.includes(item.segment.id)}
              class:fx-dragging={drag &&
                "id" in drag &&
                drag.id === item.segment.id}
              style:left={`${box.left}px`}
              style:width={`${box.width}px`}
              style={stripStyle(item)}
              title={`${clip?.name ?? "Clip"} · ${item.segment.in.toFixed(1)}–${item.segment.out.toFixed(1)}s`}
              on:pointerdown={(event) =>
                start(event, {
                  kind: "move",
                  id: item.segment.id,
                  x0: event.clientX,
                  dx: 0,
                })}
            >
              <span
                class="fx-handle fx-handle--in"
                role="slider"
                aria-label="Trim start"
                aria-valuenow={item.segment.in}
                tabindex="-1"
                on:pointerdown={(event) =>
                  start(event, {
                    kind: "trim-in",
                    id: item.segment.id,
                    x0: event.clientX,
                    dx: 0,
                  })}
              ></span>
              <span class="fx-seg__name">
                {#if item.segment.transition !== "cut" && item.index > 0}<em
                    >{item.segment.transition}</em
                  >{/if}
                {#if item.segment.card}◆ {item.segment.card.title ||
                    item.segment.card.big ||
                    "Card"}{:else}{clip?.name ?? "Clip"}{/if}
              </span>
              {#if item.segment.audioLead > 0}<span
                  class="fx-jl fx-jl--j"
                  title="J-cut: sound starts early">J</span
                >{/if}
              {#if item.segment.audioTail > 0}<span
                  class="fx-jl fx-jl--l"
                  title="L-cut: sound runs on">L</span
                >{/if}
              <span
                class="fx-handle fx-handle--out"
                role="slider"
                aria-label="Trim end"
                aria-valuenow={item.segment.out}
                tabindex="-1"
                on:pointerdown={(event) =>
                  start(event, {
                    kind: "trim-out",
                    id: item.segment.id,
                    x0: event.clientX,
                    dx: 0,
                  })}
              ></span>
            </div>
          {:else}
            <span class="fx-empty"
              >Add clips from the panel, or let Motify cut them for you.</span
            >
          {/each}
        </div>
      </div>

      <div class="fx-row">
        <div class="fx-label"><Music size={13} /> Music</div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fx-lane fx-lane--thin" on:pointerdown={startSeek}>
          {#if edit.music}
            <div
              class="fx-chip fx-chip--music"
              style:left="0px"
              style:width={`${total * pps}px`}
            >
              <span class="fx-chip__text"
                >♪ {edit.music.title} · {Math.round(
                  edit.music.volume * 100,
                )}%</span
              >
            </div>
          {/if}
        </div>
      </div>

      <span
        class="fx-playhead"
        style:left={`${LABEL + time * pps}px`}
        aria-hidden="true"
      ></span>
    </div>
  </div>
</section>

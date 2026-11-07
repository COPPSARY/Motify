<script lang="ts">
  import {
    ArrowLeft,
    Check,
    ChevronDown,
    ExternalLink,
    Film,
    Image as ImageIcon,
    Layers,
    Search,
  } from "lucide-svelte";
  import {
    searchStock,
    type StockItem,
    type StockOrientation,
    type StockSearchResult,
  } from "../../api/stock";
  import type {
    StockSlot,
    StockSlotPatch,
  } from "../../composition/stock-slots";
  import "../styles/stock-gallery.css";

  /** The open film's stock slots, from its HTML. */
  export let slots: StockSlot[];
  /** Photo orientation that suits the canvas. */
  export let orientation: StockOrientation = "all";
  /** Off while a generation is running: the film is about to change. */
  export let disabled = false;
  export let search: typeof searchStock = searchStock;
  /** Imports the item and writes it into the slot. */
  export let onPick: (slot: StockSlot, item: StockItem) => Promise<void>;
  /** Moves, scales, layers, refits or retimes a filled slot. */
  export let onAdjust: (slot: StockSlot, patch: StockSlotPatch) => void;

  interface SlotState {
    query: string;
    items: StockItem[];
    page: number;
    hasMore: boolean;
    loading: boolean;
    error: string;
    searched: string;
    /** The picker is showing results; a filled slot starts closed. */
    open: boolean;
    adjusting: boolean;
    preview: StockItem | null;
    picking: number | null;
  }

  let states: Record<string, SlotState> = {};

  const keyOf = (slot: StockSlot) => `${slot.index}|${slot.kind}|${slot.query}`;

  $: syncStates(slots);

  function syncStates(current: StockSlot[]): void {
    const next: Record<string, SlotState> = {};
    for (const slot of current) {
      const key = keyOf(slot);
      next[key] = states[key] ?? {
        query: slot.query,
        items: [],
        page: 0,
        hasMore: false,
        loading: false,
        error: "",
        searched: "",
        open: slot.assetId === null,
        adjusting: false,
        preview: null,
        picking: null,
      };
    }
    states = next;
    for (const slot of current) {
      const state = states[keyOf(slot)]!;
      if (state.open && state.page === 0 && !state.loading && !state.error)
        void runSearch(slot, 1);
    }
  }

  function update(slot: StockSlot, patch: Partial<SlotState>): void {
    const key = keyOf(slot);
    const state = states[key];
    if (state) states = { ...states, [key]: { ...state, ...patch } };
  }

  async function runSearch(slot: StockSlot, page: number): Promise<void> {
    const state = states[keyOf(slot)];
    const query = state?.query.trim() ?? "";
    if (!state || !query) return;
    update(slot, { loading: true, error: "" });
    try {
      const result: StockSearchResult = await search({
        kind: slot.kind,
        query,
        page,
        ...(slot.kind === "photo" ? { orientation } : {}),
      });
      const previous = page === 1 ? [] : (states[keyOf(slot)]?.items ?? []);
      const seen = new Set(previous.map((item) => item.id));
      update(slot, {
        items: [
          ...previous,
          ...result.items.filter((item) => !seen.has(item.id)),
        ],
        page,
        hasMore: result.hasMore,
        loading: false,
        searched: query,
      });
    } catch (error) {
      // The page stays where it was; the error stops the automatic search retrying.
      update(slot, {
        loading: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : "Stock search failed. Try again.",
      });
    }
  }

  async function pick(slot: StockSlot, item: StockItem): Promise<void> {
    update(slot, { picking: item.id, error: "" });
    try {
      await onPick(slot, item);
      update(slot, { picking: null, preview: null, open: false });
    } catch (error) {
      update(slot, {
        picking: null,
        error:
          error instanceof Error && error.message
            ? error.message
            : "That item could not be added. Try another one.",
      });
    }
  }

  function submitQuery(slot: StockSlot, event: SubmitEvent): void {
    event.preventDefault();
    void runSearch(slot, 1);
  }

  function openPicker(slot: StockSlot): void {
    const state = states[keyOf(slot)];
    update(slot, { open: !state?.open, adjusting: false });
    if (state && !state.open && state.page === 0) void runSearch(slot, 1);
  }

  function numberFrom(event: Event): number | null {
    const value = Number.parseFloat(
      (event.currentTarget as HTMLInputElement).value,
    );
    return Number.isFinite(value) ? value : null;
  }

  function adjustNumber(
    slot: StockSlot,
    field: "x" | "y" | "scale" | "start" | "trim",
    event: Event,
  ): void {
    const value = numberFrom(event);
    if (value === null) return;
    if (field === "start" || field === "trim")
      onAdjust(slot, { clip: { [field]: value } });
    else onAdjust(slot, { placement: { [field]: value } });
  }

  function loadingLabel(slot: StockSlot): string {
    return slot.kind === "video"
      ? "Finding matching B-roll…"
      : "Finding matching photos…";
  }

  function duration(seconds: number | undefined): string {
    const total = Math.round(seconds ?? 0);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function playPreview(event: Event): void {
    const video = event.currentTarget as HTMLVideoElement;
    void video.play().catch(() => undefined);
  }

  function stopPreview(event: Event): void {
    const video = event.currentTarget as HTMLVideoElement;
    video.pause();
    video.currentTime = 0;
  }
</script>

{#if slots.length > 0}
  <section
    class="stock-gallery"
    aria-label="Stock photos and videos for this film"
  >
    <header class="stock-gallery__head">
      <span class="stock-gallery__title">Visuals for this film</span>
      <span class="stock-gallery__count">
        {slots.filter((slot) => slot.assetId).length}/{slots.length} chosen
      </span>
    </header>

    {#each slots as slot (keyOf(slot))}
      {@const state = states[keyOf(slot)]}
      {#if state}
        <article class="stock-slot" class:is-filled={Boolean(slot.assetId)}>
          <div class="stock-slot__row">
            <span class="stock-slot__kind" aria-hidden="true">
              {#if slot.kind === "video"}<Film size={13} />{:else}<ImageIcon
                  size={13}
                />{/if}
            </span>
            <div class="stock-slot__label">
              <strong>{slot.kind === "video" ? "B-roll" : "Photo"}</strong>
              <span>{slot.query || "No search words"}</span>
            </div>
            {#if slot.assetId}
              <span class="stock-slot__done"><Check size={12} /> Placed</span>
            {/if}
          </div>

          {#if slot.credit}
            <p class="stock-slot__credit">
              {slot.kind === "video" ? "Video" : "Photo"} by
              <a
                href={slot.credit.creatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                >{slot.credit.creator || "a Pixabay contributor"}</a
              >
              on
              <a
                href={slot.credit.sourceUrl}
                target="_blank"
                rel="noopener noreferrer">Pixabay <ExternalLink size={10} /></a
              >
            </p>
          {/if}

          {#if slot.assetId}
            <div class="stock-slot__actions">
              <button
                type="button"
                class="stock-btn"
                aria-expanded={state.open}
                {disabled}
                on:click={() => openPicker(slot)}
              >
                <Search size={12} /> Find alternatives
              </button>
              <button
                type="button"
                class="stock-btn"
                aria-expanded={state.adjusting}
                {disabled}
                on:click={() =>
                  update(slot, { adjusting: !state.adjusting, open: false })}
              >
                <Layers size={12} /> Adjust
                <ChevronDown size={12} />
              </button>
            </div>
          {/if}

          {#if state.adjusting && slot.assetId}
            <div class="stock-adjust" aria-label="Adjust placement">
              <label>
                <span>X</span>
                <input
                  type="number"
                  step="1"
                  value={slot.placement.x}
                  {disabled}
                  on:change={(event) => adjustNumber(slot, "x", event)}
                />
              </label>
              <label>
                <span>Y</span>
                <input
                  type="number"
                  step="1"
                  value={slot.placement.y}
                  {disabled}
                  on:change={(event) => adjustNumber(slot, "y", event)}
                />
              </label>
              <label class="stock-adjust__wide">
                <span>Scale {slot.placement.scale.toFixed(2)}×</span>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={slot.placement.scale}
                  {disabled}
                  on:input={(event) => adjustNumber(slot, "scale", event)}
                />
              </label>
              <div class="stock-adjust__group">
                <span>Layer {slot.placement.layer ?? "auto"}</span>
                <button
                  type="button"
                  class="stock-btn"
                  aria-label="Send backward"
                  {disabled}
                  on:click={() =>
                    onAdjust(slot, {
                      placement: { layer: (slot.placement.layer ?? 0) - 1 },
                    })}>Back</button
                >
                <button
                  type="button"
                  class="stock-btn"
                  aria-label="Bring forward"
                  {disabled}
                  on:click={() =>
                    onAdjust(slot, {
                      placement: { layer: (slot.placement.layer ?? 0) + 1 },
                    })}>Forward</button
                >
              </div>
              <div class="stock-adjust__group">
                <span>Fit</span>
                {#each ["cover", "contain"] as const as fit}
                  <button
                    type="button"
                    class="stock-btn"
                    class:is-active={slot.placement.fit === fit}
                    aria-pressed={slot.placement.fit === fit}
                    {disabled}
                    on:click={() => onAdjust(slot, { placement: { fit } })}
                    >{fit === "cover" ? "Fill" : "Fit"}</button
                  >
                {/each}
              </div>
              {#if slot.clip}
                <label>
                  <span>Starts at (s)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={slot.clip.start}
                    {disabled}
                    on:change={(event) => adjustNumber(slot, "start", event)}
                  />
                </label>
                <label>
                  <span>Trim (s)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={slot.clip.trim}
                    {disabled}
                    on:change={(event) => adjustNumber(slot, "trim", event)}
                  />
                </label>
                <label class="stock-adjust__check">
                  <input
                    type="checkbox"
                    checked={slot.clip.loop}
                    {disabled}
                    on:change={(event) =>
                      onAdjust(slot, {
                        clip: {
                          loop: (event.currentTarget as HTMLInputElement)
                            .checked,
                        },
                      })}
                  />
                  <span>Loop</span>
                </label>
              {/if}
              <button
                type="button"
                class="stock-btn stock-adjust__reset"
                {disabled}
                on:click={() =>
                  onAdjust(slot, {
                    placement: { x: 0, y: 0, scale: 1, layer: null },
                  })}>Reset position</button
              >
            </div>
          {/if}

          {#if state.open}
            {#if state.preview}
              {@const item = state.preview}
              <div class="stock-preview">
                <button
                  type="button"
                  class="stock-btn stock-preview__back"
                  on:click={() => update(slot, { preview: null })}
                >
                  <ArrowLeft size={12} /> Results
                </button>
                {#if item.kind === "video"}
                  <!-- svelte-ignore a11y_media_has_caption -->
                  <video
                    class="stock-preview__media"
                    src={item.previewUrl}
                    poster={item.thumbnailUrl}
                    muted
                    autoplay
                    loop
                    playsinline
                    controls
                  ></video>
                {:else}
                  <img
                    class="stock-preview__media"
                    src={item.previewUrl}
                    alt={item.tags.join(", ")}
                  />
                {/if}
                <p class="stock-slot__credit">
                  {item.width}×{item.height}{#if item.kind === "video"}
                    · {duration(item.durationSeconds)}{/if} · by
                  <a
                    href={item.creator.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer">{item.creator.name}</a
                  >
                  on
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    >Pixabay <ExternalLink size={10} /></a
                  >
                </p>
                <button
                  type="button"
                  class="stock-btn stock-btn--primary"
                  disabled={disabled || state.picking !== null}
                  on:click={() => pick(slot, item)}
                >
                  {#if state.picking === item.id}
                    <span class="stock-spinner" aria-hidden="true"></span> Adding…
                  {:else}
                    Use this {item.kind === "video" ? "clip" : "photo"}
                  {/if}
                </button>
              </div>
            {:else}
              <form
                class="stock-search"
                on:submit={(event) => submitQuery(slot, event)}
              >
                <input
                  type="search"
                  aria-label={`Search ${slot.kind === "video" ? "videos" : "photos"}`}
                  value={state.query}
                  maxlength="100"
                  on:input={(event) =>
                    update(slot, {
                      query: (event.currentTarget as HTMLInputElement).value,
                    })}
                />
                <button
                  type="submit"
                  class="stock-btn"
                  disabled={state.loading}
                >
                  <Search size={12} /> Search
                </button>
              </form>

              {#if state.loading && state.items.length === 0}
                <p class="stock-status" role="status">
                  <span class="stock-spinner" aria-hidden="true"></span>
                  {loadingLabel(slot)}
                </p>
              {:else if state.error}
                <p class="stock-status is-error" role="alert">{state.error}</p>
              {:else if state.items.length === 0 && state.searched}
                <p class="stock-status">
                  Nothing matched “{state.searched}”. Try simpler words.
                </p>
              {/if}

              {#if state.items.length > 0}
                <ul class="stock-grid" aria-label="Results">
                  {#each state.items as item (item.id)}
                    <li>
                      <button
                        type="button"
                        class="stock-tile"
                        title={`${item.tags.join(", ")} — by ${item.creator.name}`}
                        on:click={() => update(slot, { preview: item })}
                      >
                        {#if item.kind === "video"}
                          <video
                            src={item.previewUrl}
                            poster={item.thumbnailUrl}
                            muted
                            loop
                            playsinline
                            preload="none"
                            aria-label={item.tags.join(", ")}
                            on:mouseenter={playPreview}
                            on:mouseleave={stopPreview}
                          ></video>
                          <span class="stock-tile__badge"
                            >{duration(item.durationSeconds)}</span
                          >
                        {:else}
                          <img
                            src={item.thumbnailUrl}
                            alt={item.tags.join(", ")}
                            loading="lazy"
                          />
                        {/if}
                      </button>
                    </li>
                  {/each}
                </ul>
                {#if state.hasMore}
                  <button
                    type="button"
                    class="stock-btn stock-more"
                    disabled={state.loading}
                    on:click={() => runSearch(slot, state.page + 1)}
                  >
                    {state.loading ? loadingLabel(slot) : "Show more options"}
                  </button>
                {/if}
              {/if}
            {/if}
          {/if}
        </article>
      {/if}
    {/each}

    <footer class="stock-gallery__foot">
      Photos and videos from
      <a href="https://pixabay.com/" target="_blank" rel="noopener noreferrer"
        >Pixabay</a
      >
    </footer>
  </section>
{/if}

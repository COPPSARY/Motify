<script lang="ts">
  import { onDestroy } from "svelte";
  import { Coins, Gift, RefreshCcw, TriangleAlert } from "lucide-svelte";
  import {
    fetchCreditHistory,
    formatCreditChange,
    formatCredits,
    type CreditEntry,
  } from "../../api/credits";
  import {
    creditBalance,
    creditStatus,
    refreshCredits,
  } from "../../stores/credits";

  /** One average generation. Below this the next one may not fit. */
  const LOW_BALANCE = 10;

  let open = false;
  let root: HTMLDivElement;
  let entries: CreditEntry[] = [];
  let nextCursor: string | null = null;
  let historyState: "idle" | "loading" | "ready" | "error" = "idle";
  let historyRequest = 0;

  $: known = $creditBalance !== null;
  $: low = $creditBalance !== null && $creditBalance < LOW_BALANCE;
  $: label = known
    ? `${formatCredits($creditBalance ?? 0)} credits`
    : $creditStatus === "error"
      ? "Credits unavailable"
      : "Credits";

  async function loadHistory(cursor?: string): Promise<void> {
    const request = ++historyRequest;
    historyState = "loading";
    try {
      const page = await fetchCreditHistory(cursor);
      if (request !== historyRequest) return;
      entries = cursor ? [...entries, ...page.entries] : page.entries;
      nextCursor = page.nextCursor;
      historyState = "ready";
    } catch {
      if (request !== historyRequest) return;
      historyState = "error";
    }
  }

  function toggle(): void {
    open = !open;
    if (open) {
      void refreshCredits();
      void loadHistory();
    } else {
      historyRequest += 1;
    }
  }

  function close(): void {
    if (!open) return;
    open = false;
    historyRequest += 1;
  }

  function onWindowPointerDown(event: PointerEvent): void {
    if (open && root && !root.contains(event.target as Node)) close();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && open) {
      close();
      root?.querySelector<HTMLButtonElement>(".credits-trigger")?.focus();
    }
  }

  function when(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  onDestroy(() => {
    historyRequest += 1;
  });
</script>

<svelte:window on:pointerdown={onWindowPointerDown} on:keydown={onKeydown} />

<div class="credits-badge" bind:this={root}>
  <button
    type="button"
    class="credits-trigger"
    class:is-low={low}
    class:is-unknown={!known}
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-label={`${label}. View credit activity`}
    title="Credits"
    on:click={toggle}
  >
    {#if low}<TriangleAlert size={14} aria-hidden="true" />{:else}<Coins
        size={14}
        aria-hidden="true"
      />{/if}
    <span class="credits-amount"
      >{known ? formatCredits($creditBalance ?? 0) : "–"}</span
    >
  </button>

  {#if open}
    <div class="credits-popover" role="dialog" aria-label="Credits">
      <div class="credits-summary">
        <span class="credits-summary-icon" aria-hidden="true"
          ><Coins size={16} /></span
        >
        <div>
          <strong class="credits-summary-amount"
            >{known ? formatCredits($creditBalance ?? 0) : "–"}</strong
          >
          <small>credits available</small>
        </div>
        <button
          type="button"
          class="credits-refresh"
          aria-label="Refresh credits"
          title="Refresh"
          disabled={$creditStatus === "loading"}
          on:click={() => {
            void refreshCredits();
            void loadHistory();
          }}
        >
          <RefreshCcw
            size={13}
            class={$creditStatus === "loading" ? "credits-spin" : ""}
          />
        </button>
      </div>

      {#if $creditStatus === "error"}
        <p class="credits-note credits-note--error" role="status">
          Couldn't reach your credit balance. {known
            ? "Showing the last amount we saw."
            : "Try again in a moment."}
        </p>
      {:else if low}
        <p class="credits-note credits-note--low" role="status">
          You're running low on credits.
        </p>
      {/if}

      <h4 class="credits-heading">Recent activity</h4>
      {#if historyState === "loading" && entries.length === 0}
        <p class="credits-empty">Loading…</p>
      {:else if historyState === "error" && entries.length === 0}
        <p class="credits-empty">Activity is unavailable right now.</p>
      {:else if entries.length === 0}
        <p class="credits-empty">No activity yet.</p>
      {:else}
        <ul class="credits-list">
          {#each entries as entry (entry.id)}
            <li class="credits-row">
              <span class="credits-row-icon" aria-hidden="true"
                >{#if entry.kind === "SIGNUP_GRANT"}<Gift
                    size={13}
                  />{:else}<Coins size={13} />{/if}</span
              >
              <span class="credits-row-copy">
                <span>{entry.description}</span>
                <small>{when(entry.createdAt)}</small>
              </span>
              <span class="credits-row-amount" class:is-spend={entry.amount < 0}
                >{formatCreditChange(entry.amount)}</span
              >
            </li>
          {/each}
        </ul>
        {#if nextCursor}
          <button
            type="button"
            class="credits-more"
            disabled={historyState === "loading"}
            on:click={() => void loadHistory(nextCursor ?? undefined)}
          >
            {historyState === "loading" ? "Loading…" : "Show more"}
          </button>
        {/if}
      {/if}
    </div>
  {/if}
</div>

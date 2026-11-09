<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Check, Clapperboard, Send, Users } from "lucide-svelte";
  import { ProjectsApi, type FilmRequest } from "../../cloud/projects-api";
  import {
    isOpenFilmRequest,
    showFilmRequest,
  } from "../../stores/film-requests";

  /** The request on screen; the card keeps it current while it is open. */
  export let request: FilmRequest;
  export let api: Pick<ProjectsApi, "getFilmRequest" | "cancelFilmRequest"> =
    new ProjectsApi();
  /** How often an open request is checked, in milliseconds. */
  export let pollMs = 15_000;

  let cancelling = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  $: open = isOpenFilmRequest(request);
  $: progress = request.queue
    ? Math.max(
        6,
        Math.round(
          ((request.queue.total - request.queue.position + 1) /
            request.queue.total) *
            100,
        ),
      )
    : 100;

  async function refresh(): Promise<void> {
    if (!isOpenFilmRequest(request)) return;
    try {
      showFilmRequest(await api.getFilmRequest(request.id));
    } catch {
      // The next check tries again.
    }
  }

  async function cancel(): Promise<void> {
    if (cancelling) return;
    cancelling = true;
    try {
      showFilmRequest(await api.cancelFilmRequest(request.id));
    } catch {
      await refresh();
    } finally {
      cancelling = false;
    }
  }

  // Coming back from Telegram after connecting shows it straight away.
  const refreshOnReturn = () => {
    if (document.visibilityState === "visible") void refresh();
  };

  onMount(() => {
    timer = setInterval(() => void refresh(), pollMs);
    document.addEventListener("visibilitychange", refreshOnReturn);
  });

  onDestroy(() => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", refreshOnReturn);
  });
</script>

<section
  class="film-queue"
  class:is-done={request.status === "delivered"}
  class:is-cancelled={request.status === "cancelled"}
  aria-live="polite"
  aria-label="Your film request"
>
  {#if request.status === "queued" && request.queue}
    <div class="film-queue__head">
      <span class="film-queue__icon" aria-hidden="true"
        ><Users size={16} /></span
      >
      <div>
        <strong
          >You're #{request.queue.position}
          <span>of {request.queue.total} in the queue</span></strong
        >
        <p>Our team makes your film by hand and sends it to you on Telegram.</p>
      </div>
    </div>
    <div
      class="film-queue__bar"
      role="progressbar"
      aria-label="Place in the queue"
      aria-valuemin={1}
      aria-valuemax={request.queue.total}
      aria-valuenow={request.queue.position}
    >
      <span style:width={`${progress}%`}></span>
    </div>
  {:else if request.status === "in_progress"}
    <div class="film-queue__head">
      <span class="film-queue__icon is-working" aria-hidden="true"
        ><Clapperboard size={16} /></span
      >
      <div>
        <strong>Our team is making your film</strong>
        <p>It will arrive on Telegram as soon as it's ready.</p>
      </div>
    </div>
  {:else if request.status === "delivered"}
    <div class="film-queue__head">
      <span class="film-queue__icon is-done" aria-hidden="true"
        ><Check size={16} /></span
      >
      <div>
        <strong>Your film is ready</strong>
        <p>
          We sent it to {request.telegram.connected
            ? "your Telegram"
            : request.telegram.contact} on Telegram.
        </p>
      </div>
    </div>
  {:else}
    <div class="film-queue__head">
      <span class="film-queue__icon" aria-hidden="true"
        ><Clapperboard size={16} /></span
      >
      <div>
        <strong>Request cancelled</strong>
        <p>Send a new message whenever you're ready.</p>
      </div>
    </div>
  {/if}

  {#if open}
    <div class="film-queue__telegram">
      {#if request.telegram.connected}
        <span class="film-queue__connected"
          ><Check size={13} aria-hidden="true" /> Telegram connected</span
        >
      {:else if request.telegram.connectUrl}
        <a
          class="film-queue__connect"
          href={request.telegram.connectUrl}
          target="_blank"
          rel="noopener"
          ><Send size={14} aria-hidden="true" /> Get it on Telegram</a
        >
        <small
          >Opens our bot, so the video comes straight to you. Or we'll message {request
            .telegram.contact}.</small
        >
      {/if}
      {#if request.status === "queued"}
        <button
          type="button"
          class="film-queue__cancel"
          disabled={cancelling}
          on:click={() => void cancel()}
          >{cancelling ? "Cancelling…" : "Cancel request"}</button
        >
      {/if}
    </div>
  {/if}
</section>

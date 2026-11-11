<script lang="ts">
  import { tick } from "svelte";
  import { Check, Paperclip, Send, X } from "lucide-svelte";
  import type { FilmRequest } from "../../cloud/projects-api";
  import {
    isTelegramContact,
    telegramContact,
  } from "../../stores/film-requests";

  /** True while the dialog is on screen. */
  export let open = false;
  /** The account's email, shown alongside the Telegram the film is sent to. */
  export let email: string;
  /** What they asked for, so they can see what is being sent. */
  export let summary = "";
  /** Pictures and videos going with it. */
  export let attachments = 0;
  /** Sends the request to the team with the Telegram contact, which is required. */
  export let send: (telegram: string) => Promise<FilmRequest>;
  /** Called once the dialog closes; `sent` says whether the request went. */
  export let onClose: (sent: boolean) => void = () => undefined;

  let dialog: HTMLDialogElement;
  let input: HTMLInputElement;
  let telegram = "";
  let tried = false;
  let flashing = false;
  let sending = false;
  let error = "";
  let sent: FilmRequest | null = null;

  $: if (dialog) {
    if (open && !dialog.open) {
      telegram = $telegramContact;
      tried = false;
      flashing = false;
      sending = false;
      error = "";
      sent = null;
      dialog.showModal();
      void tick().then(() => input?.focus());
    } else if (!open && dialog.open) dialog.close();
  }

  $: missing = tried && telegram.trim() === "";
  $: invalid = missing || (tried && !isTelegramContact(telegram));
  $: preview =
    summary.length > 180 ? `${summary.slice(0, 180).trimEnd()}…` : summary;

  /** Replays the red flash on the field each time a send is refused. */
  async function flash(): Promise<void> {
    flashing = false;
    await tick();
    flashing = true;
  }

  async function submit(): Promise<void> {
    if (sending) return;
    tried = true;
    const contact = telegram.trim();
    if (!isTelegramContact(contact)) {
      input?.focus();
      void flash();
      return;
    }
    sending = true;
    error = "";
    try {
      sent = await send(contact);
      telegramContact.set(contact);
    } catch (caught) {
      error =
        caught instanceof Error && caught.message
          ? caught.message
          : "We couldn't send your request. Try again.";
    } finally {
      sending = false;
    }
  }

  function closed(): void {
    open = false;
    onClose(sent !== null);
  }

  function close(): void {
    if (!sending) dialog.close();
  }

  function closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) close();
  }
</script>

<dialog
  bind:this={dialog}
  class="me-referral-dialog me-out-of-credits film-send"
  aria-labelledby="film-send-title"
  aria-describedby="film-send-description"
  on:click={closeOnBackdrop}
  on:cancel={(event) => sending && event.preventDefault()}
  on:close={closed}
>
  <div class="me-referral-dialog__panel me-out-of-credits__panel">
    <button
      type="button"
      class="me-referral-dialog__close me-out-of-credits__close"
      aria-label="Close"
      disabled={sending}
      on:click={close}
    >
      <X size={18} />
    </button>

    {#if sent}
      <span class="me-out-of-credits__icon film-send__done" aria-hidden="true"
        ><Check size={22} /></span
      >
      <h2 id="film-send-title">Got it! Your request is in.</h2>
      <p id="film-send-description">
        {#if sent.queue}You're <strong>#{sent.queue.position}</strong> of
          {sent.queue.total} in line.
        {/if}
        {#if sent.telegram.contact}
          We'll send your film to <strong>{sent.telegram.contact}</strong> on Telegram.
        {:else}
          We'll email your film to <strong>{email}</strong>.
        {/if}
      </p>
      {#if sent.telegram.contact && !sent.telegram.connected && sent.telegram.connectUrl}
        <a
          class="me-out-of-credits__upgrade"
          href={sent.telegram.connectUrl}
          target="_blank"
          rel="noopener"
          ><Send size={15} aria-hidden="true" /> Open Telegram and tap Start</a
        >
        <small class="film-send__note"
          >Telegram only lets us message you after you open our bot once.</small
        >
        <button type="button" class="film-send__secondary" on:click={close}
          >Done</button
        >
      {:else}
        <button
          type="button"
          class="me-out-of-credits__upgrade"
          on:click={close}>Done</button
        >
      {/if}
    {:else}
      <span class="me-out-of-credits__icon" aria-hidden="true"
        ><Send size={22} /></span
      >
      <h2 id="film-send-title">Send us your film request</h2>
      <p id="film-send-description">
        Lots of videos are generating right now, so yours joins the queue. We'll
        send it to you as soon as it's finished.
      </p>
      <form
        class="film-send__form"
        on:submit|preventDefault={submit}
        novalidate
      >
        {#if preview || attachments > 0}
          <div class="film-send__summary">
            {#if preview}<q>{preview}</q>{/if}
            {#if attachments > 0}
              <small
                ><Paperclip size={12} aria-hidden="true" />
                {attachments}
                {attachments === 1 ? "file" : "files"} attached</small
              >
            {/if}
          </div>
        {/if}
        <label class="film-telegram-field">
          <span>Email</span>
          <input type="email" value={email} readonly />
        </label>
        <label
          class="film-telegram-field"
          class:is-invalid={invalid}
          class:is-flashing={flashing}
          on:animationend={() => (flashing = false)}
        >
          <span>Telegram <b class="film-telegram-field__required" aria-hidden="true">*</b></span>
          <input
            bind:this={input}
            bind:value={telegram}
            type="text"
            inputmode="tel"
            autocomplete="tel"
            placeholder="+855 12 345 678 or @username"
            required
            aria-required="true"
            aria-invalid={invalid}
            disabled={sending}
          />
          <small role={invalid ? "alert" : undefined}
            >{missing
              ? "Add your Telegram number or @username so we can send your film."
              : invalid
                ? "Enter the number or @username you use on Telegram."
                : "Your number or @username. We'll send your film there."}</small
          >
        </label>
        {#if error}<p class="film-send__error" role="alert">{error}</p>{/if}
        <button
          type="submit"
          class="me-out-of-credits__upgrade"
          disabled={sending}
          aria-busy={sending}>{sending ? "Sending…" : "Send request"}</button
        >
      </form>
    {/if}
  </div>
</dialog>

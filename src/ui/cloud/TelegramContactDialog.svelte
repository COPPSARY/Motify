<script lang="ts">
  import { tick } from "svelte";
  import { Send, X } from "lucide-svelte";
  import {
    isTelegramContact,
    telegramContact,
  } from "../../stores/film-requests";

  /** True while the dialog is on screen. */
  export let open = false;
  /** Called once a usable contact is saved; the held message is then sent. */
  export let onConfirm: () => void;
  export let onCancel: () => void = () => undefined;

  let dialog: HTMLDialogElement;
  let input: HTMLInputElement;
  let tried = false;
  let confirmed = false;

  $: if (dialog) {
    if (open && !dialog.open) {
      tried = false;
      confirmed = false;
      dialog.showModal();
      void tick().then(() => input?.focus());
    } else if (!open && dialog.open) dialog.close();
  }

  $: invalid = tried && !isTelegramContact($telegramContact);

  function submit(): void {
    tried = true;
    if (!isTelegramContact($telegramContact)) {
      input?.focus();
      return;
    }
    confirmed = true;
    open = false;
    onConfirm();
  }

  function closed(): void {
    open = false;
    if (!confirmed) onCancel();
  }

  function closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) dialog.close();
  }
</script>

<dialog
  bind:this={dialog}
  class="me-referral-dialog me-out-of-credits film-contact"
  aria-labelledby="film-contact-title"
  aria-describedby="film-contact-description"
  on:click={closeOnBackdrop}
  on:close={closed}
>
  <form
    class="me-referral-dialog__panel me-out-of-credits__panel"
    on:submit|preventDefault={submit}
    novalidate
  >
    <button
      type="button"
      class="me-referral-dialog__close me-out-of-credits__close"
      aria-label="Close"
      on:click={() => dialog.close()}
    >
      <X size={18} />
    </button>
    <span class="me-out-of-credits__icon" aria-hidden="true"
      ><Send size={22} /></span
    >
    <h2 id="film-contact-title">Where should we send your film?</h2>
    <p id="film-contact-description">
      Our team is making films by hand right now. We'll send the finished video
      to you on Telegram.
    </p>
    <label
      class="film-telegram-field film-contact__field"
      class:is-invalid={invalid}
    >
      <span>Telegram phone number or @username</span>
      <input
        bind:this={input}
        bind:value={$telegramContact}
        type="text"
        inputmode="tel"
        autocomplete="tel"
        placeholder="+855 12 345 678"
        aria-invalid={invalid}
      />
      {#if invalid}
        <small role="alert"
          >Enter the number or @username you use on Telegram.</small
        >
      {/if}
    </label>
    <button type="submit" class="me-out-of-credits__upgrade"
      >Send to our team</button
    >
  </form>
</dialog>

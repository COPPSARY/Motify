<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Check, Copy, Gift, Mail, X } from "lucide-svelte";
  import type { MotionlyUser } from "../../auth";
  import { bootReferrals, shutdownReferrals } from "../../api/referrals";

  export let user: MotionlyUser;
  export let compact = false;
  let ready = false;
  let rewardCredits: number | null = null;
  let referralLink = "";
  let unavailable = false;
  let copyState: "idle" | "copied" | "error" = "idle";
  let dialog: HTMLDialogElement;

  onMount(() => {
    void bootReferrals(user)
      .then((session) => {
        rewardCredits = session.rewardCredits;
        referralLink = session.link;
        ready = true;
      })
      .catch((error) => {
        console.error("Failed to initialize referrals", error);
        unavailable = true;
      });
  });

  onDestroy(shutdownReferrals);

  function openDialog(): void {
    copyState = "idle";
    dialog.showModal();
  }

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(referralLink);
      copyState = "copied";
    } catch {
      copyState = "error";
    }
  }

  function closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) dialog.close();
  }

  $: emailHref = `mailto:?subject=${encodeURIComponent("Try Motify with me")}&body=${encodeURIComponent(`Join me on Motify and we’ll both get ${rewardCredits ?? 30} credits: ${referralLink}`)}`;
</script>

<button
  type="button"
  class="me-referral-button"
  class:me-referral-button--compact={compact}
  disabled={!ready}
  title={unavailable ? "Referrals are temporarily unavailable" : undefined}
  aria-label={`Refer a friend${rewardCredits === null ? "" : ` and earn ${rewardCredits} credits each`}`}
  on:click={openDialog}
>
  <Gift size={15} aria-hidden="true" />
  <span>Refer a friend</span>
  <small
    >{unavailable
      ? "Unavailable"
      : rewardCredits === null
        ? "Loading…"
        : `${rewardCredits} each`}</small
  >
</button>

<dialog
  bind:this={dialog}
  class="me-referral-dialog"
  aria-labelledby="referral-dialog-title"
  aria-describedby="referral-dialog-description"
  on:click={closeOnBackdrop}
  on:close={() => (copyState = "idle")}
>
  <div class="me-referral-dialog__panel">
    <header class="me-referral-dialog__header">
      <span class="me-referral-dialog__icon" aria-hidden="true"
        ><Gift size={18} /></span
      >
      <div>
        <h2 id="referral-dialog-title">
          Give {rewardCredits ?? 30} credits. Get {rewardCredits ?? 30} credits.
        </h2>
        <p id="referral-dialog-description">
          Invite a friend to Motify. When they create their account, you both
          receive {rewardCredits ?? 30} credits.
        </p>
      </div>
      <button
        type="button"
        class="me-referral-dialog__close"
        aria-label="Close referral dialog"
        on:click={() => dialog.close()}
      >
        <X size={18} />
      </button>
    </header>

    <div class="me-referral-dialog__rewards" aria-label="Referral rewards">
      <p><span>You get</span><strong>{rewardCredits ?? 30} credits</strong></p>
      <p><span>They get</span><strong>{rewardCredits ?? 30} credits</strong></p>
    </div>

    <label class="me-referral-dialog__link">
      <span>Your invite link</span>
      <input
        type="text"
        readonly
        value={referralLink}
        on:focus={(event) => event.currentTarget.select()}
      />
    </label>

    <div class="me-referral-dialog__actions">
      <button
        type="button"
        class="me-referral-dialog__copy"
        on:click={copyLink}
      >
        {#if copyState === "copied"}<Check size={16} /> Copied{:else}<Copy
            size={16}
          /> Copy invite link{/if}
      </button>
      <a href={emailHref}><Mail size={16} /> Email invite</a>
    </div>

    <p
      class:me-referral-dialog__error={copyState === "error"}
      class="me-referral-dialog__status"
      aria-live="polite"
    >
      {copyState === "error"
        ? "Couldn’t copy automatically. Select the link above and copy it."
        : copyState === "copied"
          ? "Invite link copied to your clipboard."
          : "Rewards are added after your friend creates a new account."}
    </p>
  </div>
</dialog>

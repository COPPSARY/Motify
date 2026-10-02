<script lang="ts">
  import { tick } from "svelte";
  import { X } from "lucide-svelte";
  import AuthPanel from "./AuthPanel.svelte";
  import type { MotionlyUser } from "../../auth";

  export let open = false;
  export let mode: "signin" | "signup" = "signin";
  /** Empty keeps the panel's own "Log in to your account" heading. */
  export let title = "";
  export let subtitle = "";
  export let onauthenticated: (
    user: MotionlyUser,
  ) => void | Promise<void> = () => {};
  export let onclose: () => void = () => {};

  let dialogElement: HTMLDivElement;

  $: if (open) void focusDialog();

  async function focusDialog(): Promise<void> {
    await tick();
    dialogElement?.focus();
  }

  function close(): void {
    open = false;
    onclose();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (open && event.key === "Escape") close();
  }

  async function handleAuthenticated(user: MotionlyUser): Promise<void> {
    open = false;
    await onauthenticated(user);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="auth-backdrop">
    <div
      bind:this={dialogElement}
      class="auth-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-panel-title"
      tabindex="-1"
    >
      <button class="auth-dialog__close" on:click={close} aria-label="Close">
        <X size={17} />
      </button>
      <AuthPanel
        bind:mode
        {title}
        {subtitle}
        onauthenticated={handleAuthenticated}
      />
    </div>
  </div>
{/if}

<script lang="ts">
  import { ArrowLeft, Check, Download, Loader2 } from "lucide-svelte";
  import CreditsBadge from "../ui/cloud/CreditsBadge.svelte";

  /** The footage editor's top bar: where you are, history, upload and export. */

  export let title = "";
  /** "saved", "saving" or "unsaved". */
  export let saveState: "saved" | "saving" | "unsaved" = "saved";
  export let exporting = false;
  export let exportLabel = "";
  export let showCredits = true;
  export let onBack: () => void;
  export let onExport: () => void;
</script>

<header class="fx-topbar">
  <div class="fx-topbar__left">
    <button
      type="button"
      class="fx-topbar__icon"
      aria-label="Back to home"
      title="Back to home"
      on:click={onBack}><ArrowLeft size={17} /></button
    >
    <img
      class="fx-topbar__logo"
      src="/logo.svg"
      alt=""
      width="22"
      height="22"
    />
    <nav class="fx-crumbs" aria-label="Location">
      <span>Motify</span>
      <span aria-hidden="true">›</span>
      <strong {title}>{title || "Untitled video"}</strong>
    </nav>
  </div>
  <div class="fx-topbar__right">
    <span
      class="fx-save"
      class:fx-save--busy={saveState !== "saved"}
      aria-live="polite"
    >
      {#if saveState === "saving"}<Loader2 size={13} class="fx-spin" /> Saving…{:else if saveState === "unsaved"}Unsaved
        changes{:else}<Check size={13} /> Saved{/if}
    </span>
    {#if showCredits}<CreditsBadge />{/if}
    <button
      type="button"
      class="fx-topbar__export"
      disabled={exporting}
      on:click={onExport}
    >
      <Download size={15} />
      {exporting ? exportLabel || "Rendering…" : "Export"}
    </button>
  </div>
</header>

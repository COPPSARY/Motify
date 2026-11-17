<script lang="ts">
  import { LoaderCircle, Sparkles } from "lucide-svelte";

  import {
    enhancePrompt,
    type PromptAttachments,
    type PromptSurface,
  } from "../../api/prompt-assist";
  import {
    notifyPromptAssist,
    promptAssistContext,
  } from "../../stores/prompt-assist";
  import "../styles/prompt-assist.css";

  /** The prompt box's text right now. */
  export let value: string;
  export let surface: PromptSurface;
  /** Puts the enhanced prompt into the prompt box, in place of what was there. */
  export let onApply: (text: string) => void;
  /** The app's toast unless a page passes its own. */
  export let onNotice: (message: string) => void = notifyPromptAssist;
  export let disabled = false;
  /** What is attached next to the prompt; absent where the page cannot say. */
  export let attachments: PromptAttachments | undefined = undefined;
  /**
   * True while a prompt is being enhanced. Bind it: the page must not send
   * the prompt box until the enhanced text has replaced it.
   */
  export let enhancing = false;

  $: enabled = $promptAssistContext.enabled;

  async function enhance(text = value): Promise<void> {
    const prompt = text.trim();
    if (enhancing || disabled) return;
    if (prompt.length < 3) {
      onNotice("Write a few words about your video first, then Enhance.");
      return;
    }
    enhancing = true;
    try {
      const { workspaceId, brandId } = $promptAssistContext;
      const { enhanced } = await enhancePrompt({
        prompt,
        surface,
        ...(workspaceId ? { workspaceId } : {}),
        ...(brandId !== undefined ? { brandId } : {}),
        ...(attachments ? { attachments } : {}),
      });
      onApply(enhanced);
    } catch (error) {
      onNotice(
        error instanceof Error && error.message
          ? error.message
          : "Your prompt could not be enhanced. Try again.",
      );
    } finally {
      enhancing = false;
    }
  }
</script>

{#if enabled}
  <button
    type="button"
    class="pa-enhance-button"
    aria-label={enhancing ? "Enhancing prompt" : "Enhance prompt"}
    title={enhancing ? "Enhancing your prompt…" : "Enhance prompt (free)"}
    aria-busy={enhancing}
    disabled={disabled || enhancing}
    on:click={() => enhance()}
  >
    {#if enhancing}
      <LoaderCircle size={16} class="pa-spin" aria-hidden="true" />
    {:else}
      <Sparkles size={16} aria-hidden="true" />
    {/if}
  </button>
{/if}

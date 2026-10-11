<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    Coins,
    Image as ImageIcon,
    LoaderCircle,
    Plus,
    Sparkles,
  } from "lucide-svelte";
  import { loadAssetObjectUrl } from "../../api/assets";
  import { formatCredits } from "../../api/credits";
  import {
    RESOLUTION_CREDIT_COSTS,
    type GenerateStoryboardInput,
    type ProjectsApi,
    type WorkspaceAsset,
  } from "../../cloud/projects-api";
  import {
    applyServerCharge,
    creditBalance,
    creditEstimate,
  } from "../../stores/credits";
  import "../styles/asset-generator.css";

  export let api: Pick<ProjectsApi, "generateStoryboard">;
  export let workspaceId: string;
  export let onUseReference: (asset: WorkspaceAsset) => void = () => undefined;
  export let onNotice: (message: string) => void = () => undefined;

  const aspectRatios: Array<{
    value: GenerateStoryboardInput["aspectRatio"];
    label: string;
  }> = [
    { value: "16:9", label: "Landscape" },
    { value: "9:16", label: "Portrait" },
    { value: "1:1", label: "Square" },
    { value: "4:5", label: "Social" },
    { value: "3:2", label: "Photo" },
    { value: "21:9", label: "Cinematic" },
  ];

  let prompt = "";
  let aspectRatio: GenerateStoryboardInput["aspectRatio"] = "16:9";
  let imageSize: GenerateStoryboardInput["imageSize"] = "2K";
  let generating = false;
  let error = "";
  let generated: WorkspaceAsset | null = null;
  let previewUrl = "";

  $: creditCost = RESOLUTION_CREDIT_COSTS[imageSize] ?? 10;
  $: insufficientCredits =
    $creditEstimate !== null &&
    $creditBalance !== null &&
    $creditBalance < creditCost;

  onDestroy(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  async function generate(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const request = prompt.trim();
    if (!workspaceId || !request || generating || insufficientCredits) return;
    generating = true;
    error = "";
    try {
      const asset = await api.generateStoryboard(workspaceId, {
        prompt: request,
        aspectRatio,
        imageSize,
      });
      if (asset.credits) {
        applyServerCharge(asset.credits);
      }
      const nextPreview = await loadAssetObjectUrl(asset.id);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      generated = asset;
      previewUrl = nextPreview;
      onNotice("Nine-scene storyboard generated and saved to Assets.");
    } catch (reason) {
      error =
        reason instanceof Error
          ? reason.message
          : "The storyboard could not be generated.";
    } finally {
      generating = false;
    }
  }
</script>

<section class="asset-generator" aria-label="Storyboard generation">
  <form class="asset-generator-form" on:submit={generate}>
    <div class="asset-generator-prompt">
      <Sparkles size={18} aria-hidden="true" />
      <textarea
        bind:value={prompt}
        rows="4"
        maxlength="4000"
        aria-label="Storyboard description"
        placeholder="Describe the complete story — for example, a product journey from everyday frustration to a cinematic launch and closing hero shot…"
        disabled={generating}
      ></textarea>
    </div>

    <div class="asset-generator-controls">
      <fieldset>
        <legend>Format</legend>
        <div class="asset-generator-options">
          {#each aspectRatios as option (option.value)}
            <button
              type="button"
              class:is-selected={aspectRatio === option.value}
              aria-pressed={aspectRatio === option.value}
              on:click={() => (aspectRatio = option.value)}
              disabled={generating}
            >
              <span>{option.label}</span><small>{option.value}</small>
            </button>
          {/each}
        </div>
      </fieldset>

      <label class="asset-generator-size">
        <span>Resolution</span>
        <select bind:value={imageSize} disabled={generating}>
          <option value="1K" selected={imageSize === "1K"}
            >1K · Fast (5 credits)</option
          >
          <option value="2K" selected={imageSize === "2K"}
            >2K · Recommended (10 credits)</option
          >
          <option value="4K" selected={imageSize === "4K"}
            >4K · Maximum detail (15 credits)</option
          >
        </select>
      </label>

      <button
        type="submit"
        class="asset-generator-submit"
        disabled={!workspaceId ||
          !prompt.trim() ||
          generating ||
          insufficientCredits}
        title={insufficientCredits
          ? `Not enough credits — requires ${creditCost} credits`
          : `Uses ${creditCost} credits`}
      >
        {#if generating}
          <LoaderCircle class="asset-generator-spin" size={17} />
          <span>Generating…</span>
        {:else}
          <Sparkles size={17} />
          <span>Generate storyboard</span>
          <span class="asset-generator-cost"
            ><Coins size={13} aria-hidden="true" />{creditCost}</span
          >
        {/if}
      </button>
    </div>
    {#if !workspaceId}
      <p class="asset-generator-hint">Sign in to generate and save assets.</p>
    {/if}
    {#if insufficientCredits}
      <p class="asset-generator-credit-hint is-low" role="status">
        Not enough credits — you have {formatCredits($creditBalance ?? 0)} left.
      </p>
    {/if}
    {#if error}<p class="asset-generator-error" role="alert">{error}</p>{/if}
  </form>

  <div
    class="asset-generator-result"
    class:has-result={Boolean(generated)}
    aria-live="polite"
  >
    {#if generated && previewUrl}
      <img src={previewUrl} alt={generated.label ?? generated.fileName} />
      <div class="asset-generator-result-bar">
        <div>
          <strong>Nine-scene storyboard ready</strong>
          <small>{generated.width}×{generated.height} · {imageSize}</small>
        </div>
        <button type="button" on:click={() => onUseReference(generated!)}>
          <Plus size={15} /> Use as reference
        </button>
      </div>
    {:else if generating}
      <div class="asset-generator-wait">
        <LoaderCircle class="asset-generator-spin" size={26} />
        <strong>Creating your nine-scene storyboard</strong>
        <span
          >Nano Banana is composing the complete end-to-end flow ({creditCost} credits).</span
        >
      </div>
    {:else}
      <div class="asset-generator-empty">
        <ImageIcon size={28} />
        <strong>Your nine-scene storyboard will appear here</strong>
        <span
          >Approve the full flow, then add it to your next prompt as a
          reference.</span
        >
      </div>
    {/if}
  </div>
</section>

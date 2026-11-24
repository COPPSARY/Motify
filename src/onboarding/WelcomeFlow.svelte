<script lang="ts">
  import { onMount } from "svelte";
  import {
    ArrowLeft,
    Check,
    Film,
    LayoutDashboard,
    Package,
    Rocket,
  } from "lucide-svelte";
  import TiffyMark from "../ui/cloud/TiffyMark.svelte";
  import { fetchPromptTemplates } from "../api/prompt-templates";
  import type {
    OnboardingGoal,
    OnboardingMonthlyVideos,
    OnboardingRole,
  } from "../api/onboarding";
  import {
    GOAL_CHOICES,
    KIND_CHOICES,
    MAX_KINDS,
    ROLE_CHOICES,
    VOLUME_CHOICES,
    type WelcomeAnswers,
  } from "./first-video";

  /** Called on the last question, with what they told us. The first video's form opens next. */
  export let onDone: (answers: WelcomeAnswers) => void;
  /** Called when they would rather start on their own; nothing is saved. */
  export let onSkip: () => void;

  type StepId = "role" | "volume" | "kinds" | "goal";
  const STEPS: readonly StepId[] = ["role", "volume", "kinds", "goal"];

  const GOAL_ICONS = {
    launch: Rocket,
    showcase: Package,
    feature: LayoutDashboard,
    animation: Film,
  } as const;

  let step = 0;
  let role: OnboardingRole | null = null;
  // Regular is chosen to begin with, as a starting point they can change.
  let volume: OnboardingMonthlyVideos = "6-15";
  let kinds = new Set<string>();
  let goal: OnboardingGoal | null = null;
  let previews: Partial<Record<OnboardingGoal, string>> = {};

  onMount(() => {
    void loadPreviews();
  });

  /** A still from a real template stands behind each category. One with none shows its name alone. */
  async function loadPreviews() {
    try {
      const templates = await fetchPromptTemplates();
      const used = new Set<string>();
      const found: Partial<Record<OnboardingGoal, string>> = {};
      for (const choice of GOAL_CHOICES) {
        const match = templates.find(
          (template) =>
            template.video &&
            !used.has(template.slug) &&
            template.categories.some((name) =>
              choice.categories.includes(name),
            ),
        );
        if (match?.video) {
          used.add(match.slug);
          found[choice.id] = match.video;
        }
      }
      previews = found;
    } catch {
      // The categories work without pictures.
    }
  }

  $: current = STEPS[step]!;
  $: last = step === STEPS.length - 1;
  $: percent = Math.round(((step + 1) / STEPS.length) * 100);
  $: canContinue =
    current === "role"
      ? role !== null
      : current === "goal"
        ? goal !== null
        : true;

  const TITLES: Record<StepId, string> = {
    role: "Which best describes you?",
    volume: "How many videos do you need each month?",
    kinds: "What kinds of videos do you usually make?",
    goal: "What should your first video be?",
  };
  const BUBBLES: Record<StepId, string> = {
    role: "This helps me tailor things for you. You can change it later.",
    volume: "A rough idea is fine. I'll use it to suggest a plan later.",
    kinds: `Pick up to ${MAX_KINDS}. It's only so I can get to know you.`,
    goal: "Next you'll add your pictures, then I'll make it. It takes about 2 minutes.",
  };

  function toggleKind(id: string) {
    const next = new Set(kinds);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_KINDS) next.add(id);
    kinds = next;
  }

  function back() {
    if (step > 0) step -= 1;
  }

  function next() {
    if (!canContinue) return;
    if (!last) {
      step += 1;
      return;
    }
    if (!goal) return;
    onDone({ role, monthlyVideos: volume, interests: [...kinds], goal });
  }

  /** Plays a category's preview while it is the chosen one, and holds on its first frame otherwise. */
  function playWhen(node: HTMLVideoElement, active: boolean) {
    const sync = (on: boolean) => {
      if (on) node.play?.()?.catch?.(() => undefined);
      else node.pause?.();
    };
    sync(active);
    return { update: sync };
  }
</script>

<div class="wf" role="dialog" aria-modal="true" aria-labelledby="wf-title">
  <div class="wf__page">
    <header class="wf__top">
      <button
        type="button"
        class="wf__icon"
        aria-label="Back"
        disabled={step === 0}
        on:click={back}
      >
        <ArrowLeft size={18} />
      </button>
      <div
        class="wf__progress"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percent}
      >
        <span style={`width: ${percent}%`}></span>
      </div>
      <button type="button" class="wf__skip" on:click={onSkip}>Skip</button>
    </header>

    <main class="wf__body">
      <h2 id="wf-title">{TITLES[current]}</h2>

      {#if current === "role"}
        <div
          class="wf__list"
          role="radiogroup"
          aria-label="Which best describes you"
        >
          {#each ROLE_CHOICES as choice (choice.id)}
            <button
              type="button"
              role="radio"
              class="wf__row"
              class:is-on={role === choice.id}
              aria-checked={role === choice.id}
              on:click={() => (role = choice.id)}
            >
              <strong>{choice.label}</strong>
              <span>{choice.detail}</span>
            </button>
          {/each}
        </div>
      {:else if current === "volume"}
        <div class="wf__list" role="radiogroup" aria-label="Videos each month">
          {#each VOLUME_CHOICES as choice (choice.id)}
            <button
              type="button"
              role="radio"
              class="wf__row"
              class:is-on={volume === choice.id}
              aria-checked={volume === choice.id}
              on:click={() => (volume = choice.id)}
            >
              <strong>{choice.label}</strong>
              <span>{choice.detail}</span>
            </button>
          {/each}
        </div>
      {:else if current === "kinds"}
        <div class="wf__kinds" role="group" aria-label="Kinds of video">
          {#each KIND_CHOICES as choice (choice.id)}
            <button
              type="button"
              class="wf__row wf__kind"
              class:is-on={kinds.has(choice.id)}
              aria-pressed={kinds.has(choice.id)}
              disabled={!kinds.has(choice.id) && kinds.size >= MAX_KINDS}
              on:click={() => toggleKind(choice.id)}
            >
              <strong>{choice.label}</strong>
              {#if kinds.has(choice.id)}<Check
                  size={15}
                  aria-hidden="true"
                />{/if}
            </button>
          {/each}
        </div>
      {:else}
        <div class="wf__goals" role="radiogroup" aria-label="Your first video">
          {#each GOAL_CHOICES as choice (choice.id)}
            <button
              type="button"
              role="radio"
              class="wf__goal"
              class:is-on={goal === choice.id}
              aria-checked={goal === choice.id}
              on:click={() => (goal = choice.id)}
            >
              <span class="wf__thumb">
                {#if !previews[choice.id]}
                  <svelte:component this={GOAL_ICONS[choice.id]} size={26} />
                {/if}
                {#if previews[choice.id]}
                  <!-- svelte-ignore a11y-media-has-caption -->
                  <video
                    src={`${previews[choice.id]}#t=0.5`}
                    muted
                    loop
                    playsinline
                    preload="metadata"
                    use:playWhen={goal === choice.id}
                  ></video>
                {/if}
              </span>
              <strong>{choice.label}</strong>
              <span class="wf__detail">{choice.detail}</span>
            </button>
          {/each}
        </div>
      {/if}
    </main>

    <div class="wf__tiffy">
      <TiffyMark size={28} />
      <p>{BUBBLES[current]}</p>
    </div>

    <footer class="wf__footer">
      <button
        type="button"
        class="wf__primary"
        disabled={!canContinue}
        on:click={next}
      >
        {last ? "Add my pictures" : "Continue"}
      </button>
    </footer>
  </div>
</div>

<style>
  .wf {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    justify-content: center;
    background: var(--sl-bg, #0a0a0a);
    color: var(--sl-text, #ededed);
  }
  .wf__page {
    display: flex;
    flex-direction: column;
    width: min(560px, 100%);
    height: 100%;
    box-sizing: border-box;
    padding: 20px 20px 24px;
  }
  .wf__top {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .wf__icon,
  .wf__skip {
    border: 0;
    background: transparent;
    color: var(--sl-muted, #858585);
    cursor: pointer;
    font: inherit;
  }
  .wf__icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 8px;
  }
  .wf__icon:hover:not(:disabled),
  .wf__skip:hover {
    color: var(--sl-text, #ededed);
  }
  .wf__icon:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .wf__skip {
    font-size: 13px;
  }
  .wf__progress {
    flex: 1;
    height: 4px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--sl-border-strong, rgba(255, 255, 255, 0.11));
  }
  .wf__progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--sl-brand-cobalt, #1f45b0);
    transition: width 0.25s ease;
  }
  .wf__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 32px 2px 12px;
  }
  h2 {
    margin: 0 0 20px;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.02em;
  }
  .wf__list {
    overflow: hidden;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.11));
    border-radius: 12px;
    background: var(--sl-panel, #111);
  }
  .wf__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
    padding: 15px 16px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 14.5px;
    text-align: left;
    cursor: pointer;
  }
  .wf__row + .wf__row {
    border-top: 1px solid var(--sl-border, rgba(255, 255, 255, 0.06));
  }
  .wf__row strong {
    font-weight: 500;
  }
  .wf__row span {
    color: var(--sl-muted, #858585);
    font-size: 13px;
  }
  .wf__row:hover:not(:disabled) {
    background: var(--sl-surface, #1a1a1a);
  }
  .wf__row.is-on {
    background: var(--sl-surface, #1a1a1a);
    box-shadow: inset 2px 0 0 var(--sl-brand-cobalt, #1f45b0);
  }
  .wf__row:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .wf__kinds {
    overflow: hidden;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.11));
    border-radius: 12px;
    background: var(--sl-panel, #111);
  }
  .wf__kind :global(svg) {
    color: var(--sl-text, #ededed);
  }
  .wf__goals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .wf__goal {
    display: grid;
    gap: 3px;
    padding: 8px 8px 12px;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.11));
    border-radius: 12px;
    background: var(--sl-panel, #111);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .wf__goal:hover {
    background: var(--sl-surface, #1a1a1a);
  }
  .wf__goal.is-on {
    border-color: var(--sl-brand-cobalt, #1f45b0);
    background: var(--sl-surface, #1a1a1a);
    box-shadow: 0 0 0 1px var(--sl-brand-cobalt, #1f45b0);
  }
  .wf__thumb {
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 10;
    margin-bottom: 8px;
    overflow: hidden;
    border-radius: 8px;
    background: var(--sl-bg, #0a0a0a);
    color: var(--sl-faint, #555);
  }
  .wf__thumb video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .wf__goal strong,
  .wf__detail {
    padding: 0 4px;
  }
  .wf__goal strong {
    font-size: 14px;
    font-weight: 600;
  }
  .wf__detail {
    color: var(--sl-muted, #858585);
    font-size: 12.5px;
  }
  .wf__tiffy {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0 16px;
  }
  .wf__tiffy p {
    margin: 0;
    color: var(--sl-text-soft, #b4b4b4);
    font-size: 13px;
    line-height: 1.45;
  }
  .wf__primary {
    width: 100%;
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    background: var(--sl-brand-cobalt, #1f45b0);
    color: #fff;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .wf__primary:hover:not(:disabled) {
    background: var(--sl-brand-cobalt-hover, #2752c9);
  }
  .wf__primary:disabled {
    background: var(--sl-surface, #1a1a1a);
    color: var(--sl-faint, #555);
    cursor: not-allowed;
  }
  .wf__row:focus-visible,
  .wf__goal:focus-visible,
  .wf__primary:focus-visible,
  .wf__icon:focus-visible,
  .wf__skip:focus-visible {
    outline: 2px solid var(--sl-accent-hover, #dedee2);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .wf__progress span {
      transition: none;
    }
  }
</style>

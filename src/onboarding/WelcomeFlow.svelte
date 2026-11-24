<script lang="ts">
  import { onMount } from "svelte";
  import {
    AppWindow,
    ArrowLeft,
    Bell,
    BookOpen,
    Check,
    Film,
    LayoutDashboard,
    Lightbulb,
    Megaphone,
    Package,
    Rocket,
    Shapes,
    Smartphone,
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
    categoriesForKinds,
    goalsForKinds,
    pickGoalPreviews,
    pickKindExamples,
    type ExampleTemplate,
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

  /** Stands in for a kind of video that has no template example. */
  const KIND_ICONS = {
    ads: Megaphone,
    social: Smartphone,
    demos: AppWindow,
    explainers: Lightbulb,
    intros: Shapes,
    announce: Bell,
    stories: BookOpen,
  } as const;

  let step = 0;
  let role: OnboardingRole | null = null;
  // Regular is chosen to begin with, as a starting point they can change.
  let volume: OnboardingMonthlyVideos = "6-15";
  let kinds = new Set<string>();
  let goal: OnboardingGoal | null = null;
  let templates: ExampleTemplate[] = [];
  /** Shows all four categories, not only the ones that fit what they usually make. */
  let showAllGoals = false;
  /** The tile under the pointer or with focus: its video plays, the others hold on a still. */
  let hoveredKind: string | null = null;
  let hoveredGoal: OnboardingGoal | null = null;
  /** Only where there is a pointer to hover with; elsewhere a tile plays once it is chosen. */
  let canHover = false;

  function measure() {
    canHover = Boolean(window.matchMedia?.("(hover: hover)").matches);
  }

  onMount(() => {
    void loadPreviews();
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  /** A still from a real template stands behind each category. One with none shows its name alone. */
  async function loadPreviews() {
    try {
      templates = await fetchPromptTemplates();
    } catch {
      // The categories work without pictures.
    }
  }

  // What they usually make decides which first videos are offered, and which example stands behind each.
  $: shownGoals = showAllGoals ? GOAL_CHOICES : goalsForKinds([...kinds]);
  $: filtered = shownGoals.length < GOAL_CHOICES.length;
  $: previews = pickGoalPreviews(
    templates,
    shownGoals,
    categoriesForKinds([...kinds]),
  );
  $: kindExamples = pickKindExamples(templates);
  // A category that is no longer offered cannot stay chosen.
  $: if (goal && !shownGoals.some((choice) => choice.id === goal)) goal = null;

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

      {#if current === "kinds" && canHover && Object.keys(kindExamples).length > 0}
        <p class="wf__hint">Hover over a tile to see an example.</p>
      {:else if current === "goal" && filtered}
        <p class="wf__hint">Picked for what you usually make.</p>
      {/if}

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
        <div class="wf__tiles" role="group" aria-label="Kinds of video">
          {#each KIND_CHOICES as choice (choice.id)}
            {@const on = kinds.has(choice.id)}
            <button
              type="button"
              class="wf__tile"
              class:is-on={on}
              style={`aspect-ratio: ${kindExamples[choice.id]?.ratio ?? "4 / 3"}`}
              aria-pressed={on}
              disabled={!on && kinds.size >= MAX_KINDS}
              on:click={() => toggleKind(choice.id)}
              on:mouseenter={() => (hoveredKind = choice.id)}
              on:mouseleave={() => (hoveredKind = null)}
              on:focus={() => (hoveredKind = choice.id)}
              on:blur={() => (hoveredKind = null)}
            >
              {#if kindExamples[choice.id]}
                <!-- svelte-ignore a11y-media-has-caption -->
                <video
                  src={`${kindExamples[choice.id]!.video}#t=0.5`}
                  muted
                  loop
                  playsinline
                  preload="metadata"
                  use:playWhen={hoveredKind === choice.id || (on && !canHover)}
                ></video>
              {:else}
                <span class="wf__tile-icon" aria-hidden="true">
                  <svelte:component
                    this={KIND_ICONS[choice.id as keyof typeof KIND_ICONS]}
                    size={26}
                  />
                </span>
              {/if}
              <span class="wf__tile-label">{choice.label}</span>
              {#if on}
                <span class="wf__tile-check" aria-hidden="true"
                  ><Check size={14} /></span
                >
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <div class="wf__goals" role="radiogroup" aria-label="Your first video">
          {#each shownGoals as choice (choice.id)}
            <button
              type="button"
              role="radio"
              class="wf__goal"
              class:is-on={goal === choice.id}
              aria-checked={goal === choice.id}
              on:click={() => (goal = choice.id)}
              on:mouseenter={() => (hoveredGoal = choice.id)}
              on:mouseleave={() => (hoveredGoal = null)}
              on:focus={() => (hoveredGoal = choice.id)}
              on:blur={() => (hoveredGoal = null)}
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
                    use:playWhen={hoveredGoal === choice.id ||
                      (goal === choice.id && !canHover)}
                  ></video>
                {/if}
              </span>
              <strong>{choice.label}</strong>
              <span class="wf__detail">{choice.detail}</span>
            </button>
          {/each}
        </div>
        {#if filtered}
          <button
            type="button"
            class="wf__link"
            on:click={() => (showAllGoals = true)}
          >
            Show all options
          </button>
        {/if}
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
  /*
   * Stills with the label on top; hovering one plays it, so the grid stays calm.
   * Each tile keeps the shape its video was made in (set inline), and the columns
   * stack them like a masonry wall, so nothing is cropped.
   */
  .wf__tiles {
    columns: 3;
    column-gap: 10px;
  }
  @media (max-width: 480px) {
    .wf__tiles {
      columns: 2;
    }
  }
  .wf__tile {
    position: relative;
    display: block;
    width: 100%;
    margin: 0 0 10px;
    break-inside: avoid;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--sl-border-strong, rgba(255, 255, 255, 0.11));
    border-radius: 12px;
    background: var(--sl-surface, #1a1a1a);
    color: #fff;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .wf__tile video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .wf__tile::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.72),
      rgba(0, 0, 0, 0) 55%
    );
    pointer-events: none;
  }
  .wf__tile-icon {
    position: absolute;
    inset: 0 0 28% 0;
    display: grid;
    place-items: center;
    color: var(--sl-faint, #555);
  }
  .wf__tile-label {
    position: absolute;
    right: 10px;
    bottom: 9px;
    left: 10px;
    z-index: 1;
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .wf__tile-check {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--sl-brand-cobalt, #1f45b0);
    color: #fff;
  }
  .wf__tile:hover:not(:disabled) {
    border-color: var(--sl-muted, #858585);
  }
  .wf__tile.is-on {
    border-color: var(--sl-brand-cobalt, #1f45b0);
    box-shadow: 0 0 0 1px var(--sl-brand-cobalt, #1f45b0);
  }
  .wf__tile:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
  /* Shown whole on the dark box, whatever shape the template is, never cropped. */
  .wf__thumb video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
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
  .wf__hint {
    margin: -12px 0 14px;
    color: var(--sl-muted, #858585);
    font-size: 13px;
  }
  .wf__link {
    margin-top: 14px;
    padding: 4px 0;
    border: 0;
    background: transparent;
    color: var(--sl-muted, #858585);
    font: inherit;
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;
  }
  .wf__link:hover {
    color: var(--sl-text, #ededed);
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
  .wf__tile:focus-visible,
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

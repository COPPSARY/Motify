<script lang="ts">
  import { tick } from "svelte";
  import { Check, ChevronDown, Lock } from "lucide-svelte";
  import {
    FREE_MODEL,
    MODEL_OPTIONS,
    MODELS_PLAN_NAME,
    modelOption,
    type GenerationModel,
    type ModelOption,
  } from "../../cloud/models";

  /**
   * The composer's model picker: every model by its own name and maker. On the
   * free plan only Claude Sonnet 5.5 runs; the others stay listed, locked, and
   * picking one opens pricing instead.
   */
  export let value: GenerationModel = FREE_MODEL;
  /** No paid plan: only the free model can be picked. */
  export let locked = true;
  export let disabled = false;
  /** Which edge the menu lines up with; `end` for a picker near the right. */
  export let align: "start" | "end" = "start";
  export let onSelect: (model: GenerationModel) => void = () => undefined;
  export let onUpgrade: () => void = () => undefined;

  let open = false;
  let wrap: HTMLDivElement;
  let button: HTMLButtonElement;
  let menu: HTMLDivElement | undefined;
  let items: HTMLButtonElement[] = [];
  /** Where the open menu was moved to stay in view; see `place`. */
  let shift = 0;
  let below = false;
  let menuWidth: number | null = null;
  let menuHeight: number | null = null;

  const MENU_WIDTH = 272;
  const EDGE = 8;

  $: selected = modelOption(value);

  function isLocked(option: ModelOption): boolean {
    return option.paid && locked;
  }

  /**
   * The visible area the menu has: the window, cut down by every ancestor that
   * clips what overflows it (the sidebar, the chat column).
   */
  function visibleArea(): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } {
    const area = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    };
    for (let node = wrap.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/hidden|clip|auto|scroll/.test(style.overflowX + style.overflowY)) {
        const rect = node.getBoundingClientRect();
        area.left = Math.max(area.left, rect.left);
        area.top = Math.max(area.top, rect.top);
        area.right = Math.min(area.right, rect.right);
        area.bottom = Math.min(area.bottom, rect.bottom);
      }
    }
    return area;
  }

  /** Narrows, slides and if need be flips the open menu so none of it is cut off. */
  async function place(): Promise<void> {
    shift = 0;
    below = false;
    menuHeight = null;
    const area = visibleArea();
    menuWidth = Math.min(MENU_WIDTH, area.right - area.left - EDGE * 2);
    await tick();
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    if (rect.right > area.right - EDGE) shift = area.right - EDGE - rect.right;
    if (rect.left + shift < area.left + EDGE)
      shift = area.left + EDGE - rect.left;
    // Opens upward; below the button when there is more room there.
    const gap = 8;
    const above = wrap.getBoundingClientRect().top - area.top - gap - EDGE;
    const under =
      area.bottom - wrap.getBoundingClientRect().bottom - gap - EDGE;
    below = rect.height > above && under > above;
    // Room on neither side: the menu scrolls instead of being cut off.
    const room = below ? under : above;
    if (rect.height > room) menuHeight = Math.max(160, room);
  }

  async function show(focusSelected = false): Promise<void> {
    open = true;
    await tick();
    await place();
    if (!focusSelected) return;
    const index = MODEL_OPTIONS.findIndex((option) => option.value === value);
    items[Math.max(0, index)]?.focus();
  }

  function close(refocus = false): void {
    open = false;
    if (refocus) button?.focus();
  }

  function pick(option: ModelOption): void {
    close(true);
    if (isLocked(option)) {
      onUpgrade();
      return;
    }
    onSelect(option.value);
  }

  function upgrade(): void {
    close();
    onUpgrade();
  }

  function buttonKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") close();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      void show(true);
    }
  }

  function menuKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [
      ...wrap.querySelectorAll<HTMLButtonElement>(".mp-menu button"),
    ];
    const index = buttons.findIndex((item) => item === document.activeElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length;
    buttons[next]?.focus();
  }

  function outside(event: PointerEvent): void {
    if (open && !wrap?.contains(event.target as Node)) close();
  }
</script>

<svelte:window on:pointerdown={outside} on:resize={() => open && close()} />

<div class="ai-effort-picker-wrap mp" bind:this={wrap}>
  <button
    class="ai-effort-picker ai-model-picker mp-trigger"
    data-tour="model"
    class:is-open={open}
    type="button"
    aria-label={`Model: ${selected.name} by ${selected.provider}`}
    aria-haspopup="menu"
    aria-expanded={open}
    title="Choose the AI model"
    {disabled}
    bind:this={button}
    on:click={() => (open ? close() : void show())}
    on:keydown={buttonKeydown}
  >
    <span class="mp-logo mp-logo--trigger" aria-hidden="true"
      ><img src={selected.logo} alt="" width="12" height="12" /></span
    >
    <span class="mp-name">{selected.short}</span>
    <ChevronDown size={12} aria-hidden="true" />
  </button>
  {#if open}
    <div
      class="ai-effort-menu ai-model-menu mp-menu"
      class:mp-menu--end={align === "end"}
      class:mp-menu--below={below}
      style:width={menuWidth === null ? undefined : `${menuWidth}px`}
      style:transform={shift ? `translateX(${shift}px)` : undefined}
      style:max-height={menuHeight === null ? undefined : `${menuHeight}px`}
      style:overflow-y={menuHeight === null ? undefined : "auto"}
      bind:this={menu}
      role="menu"
      tabindex="-1"
      aria-label="Model"
      on:keydown={menuKeydown}
    >
      <p class="mp-heading" aria-hidden="true">Model</p>
      {#each MODEL_OPTIONS as option, index (option.value)}
        {@const optionLocked = isLocked(option)}
        <button
          type="button"
          role="menuitemradio"
          class="mp-option"
          class:is-locked={optionLocked}
          aria-checked={value === option.value}
          aria-label={optionLocked
            ? `${option.name} by ${option.provider}, on the ${MODELS_PLAN_NAME} plan and up`
            : `${option.name} by ${option.provider}`}
          bind:this={items[index]}
          on:click={() => pick(option)}
        >
          <span class="mp-logo mp-logo--large" aria-hidden="true"
            ><img src={option.logo} alt="" width="15" height="15" /></span
          >
          <span class="mp-text">
            <strong>{option.name}</strong>
            <small
              >{option.provider}{#if !option.paid}&nbsp;· Free{:else if optionLocked}&nbsp;·
                {MODELS_PLAN_NAME}{/if}</small
            >
          </span>
          {#if optionLocked}
            <Lock size={13} aria-hidden="true" />
          {:else if value === option.value}
            <Check size={15} class="mp-check" aria-hidden="true" />
          {/if}
        </button>
      {/each}
      {#if locked}
        <div class="mp-upsell">
          <p>
            The free plan runs on Claude Sonnet 5.5. Opus 5.5, GPT-6.1 Sol and
            Gemini 4 Argon come with {MODELS_PLAN_NAME} and up.
          </p>
          <button type="button" role="menuitem" on:click={upgrade}
            >See plans</button
          >
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .mp-trigger {
    padding-left: 5px;
  }

  .mp-logo {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    background: #1d1d20;
  }

  .mp-logo img {
    display: block;
  }

  .mp-logo--large {
    width: 28px;
    height: 28px;
    border-radius: 8px;
  }

  .mp .mp-menu {
    width: 272px;
    padding: 6px;
  }

  .mp .mp-menu--end {
    left: auto;
    right: 0;
  }

  .mp .mp-menu--below {
    top: calc(100% + 8px);
    bottom: auto;
  }

  .mp-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* In a narrow composer (the editor's sidebar) the name stays and the mark goes. */
  @container composer (max-width: 300px) {
    .mp {
      min-width: 0;
    }

    .mp-logo--trigger {
      display: none;
    }

    .mp-trigger {
      max-width: 100%;
      gap: 4px;
      padding: 0 7px 0 10px;
    }
  }

  .mp-heading {
    margin: 4px 8px 6px;
    color: var(--sl-muted);
    font-size: 11.5px;
    font-weight: 600;
  }

  .mp .mp-menu .mp-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
  }

  .mp .mp-menu .mp-option > .mp-text {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 1px;
  }

  .mp .mp-menu .mp-option > :global(svg) {
    flex: none;
    color: var(--sl-muted);
  }

  .mp .mp-menu .mp-option > :global(.mp-check) {
    color: #7aa2ff;
  }

  .mp-upsell {
    display: grid;
    gap: 8px;
    margin: 4px 2px 2px;
    padding: 10px 10px 8px;
    border-top: 1px solid var(--sl-border-strong);
  }

  .mp-upsell p {
    margin: 0;
    color: var(--sl-muted);
    font-size: 11.5px;
    line-height: 1.45;
  }

  .mp .mp-menu .mp-upsell button {
    justify-self: start;
    width: auto;
    padding: 6px 12px;
    border-radius: 999px;
    background: #fff;
    color: #111;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
  }

  .mp .mp-menu .mp-upsell button:hover,
  .mp .mp-menu .mp-upsell button:focus-visible {
    background: rgba(255, 255, 255, 0.86);
    color: #111;
  }
</style>

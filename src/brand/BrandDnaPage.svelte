<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import {
    ArrowLeft,
    ArrowRight,
    Check,
    CornerDownLeft,
    LayoutGrid,
    LoaderCircle,
    LogIn,
    MessageCircle,
    Pencil,
    Plus,
    Trash2,
    TriangleAlert,
  } from "lucide-svelte";
  import { currentMotionlyUser } from "../auth";
  import { loadAssetObjectUrl, uploadAsset } from "../api/assets";
  import {
    CloudApiError,
    ProjectsApi,
    type WorkspaceSummary,
  } from "../cloud/projects-api";
  import {
    BRAND_COLOR_ROLES,
    BRAND_LIMITS,
    PRESET_FONTS,
    brandCompleteness,
    cloneBrandDna,
    displayUrl,
    emptyBrandDna,
    newItemId,
    normalizeHex,
    normalizeUrl,
    sameBrandDna,
    type BrandAsset,
    type BrandAssetRole,
    type BrandDna,
    type BrandResource,
  } from "../cloud/brand-dna";
  import AuthDialog from "../ui/auth/AuthDialog.svelte";
  import TiffyMark from "../ui/cloud/TiffyMark.svelte";
  import BrandImages from "./BrandImages.svelte";
  import BrandFonts from "./BrandFonts.svelte";
  import {
    QUESTIONS,
    SECTIONS,
    SKIPPED_REACTIONS,
    firstUnanswered,
    type BrandQuestion,
    type SectionId,
  } from "./brand-questions";
  import "./brand-dna-page.css";

  const api = new ProjectsApi();

  const TONE_SUGGESTIONS = [
    "Confident",
    "Friendly",
    "Playful",
    "Premium",
    "Calm",
    "Bold",
    "Technical",
    "Witty",
    "Warm",
    "Direct",
  ];

  const STARTER_COLORS = [
    "#0a84ff",
    "#101820",
    "#ff5a1f",
    "#f4f1ea",
    "#34c759",
    "#af52de",
  ];

  /** One finished exchange in the thread: what Tiffy asked, and whether it was answered. */
  interface Exchange {
    index: number;
    skipped: boolean;
  }

  let state: "loading" | "guest" | "ready" | "error" = "loading";
  let mode: "chat" | "review" = "chat";
  let loadError = "";
  let authOpen = false;
  let authMode: "signin" | "signup" = "signin";
  let workspaces: WorkspaceSummary[] = [];
  let workspaceId = "";
  let resource: BrandResource | null = null;
  let saved: BrandDna = emptyBrandDna();
  let draft: BrandDna = emptyBrandDna();
  let saving = false;
  let saveError = "";
  let conflict = false;
  let toast = "";
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let previews: Record<string, string> = {};
  let uploading: Partial<Record<BrandAssetRole, number>> = {};
  let toneInput = "";

  /** Chat state. */
  let current = 0;
  let thread: Exchange[] = [];
  let reaction = "";
  let typing = false;
  let finished = false;
  /** Set when an answer was opened from the review page: answering returns there. */
  let editingFromReview = false;
  let threadEnd: HTMLElement;
  let answerInput: HTMLInputElement | HTMLTextAreaElement | undefined;

  $: workspace = workspaces.find((entry) => entry.id === workspaceId) ?? null;
  $: readOnly = workspace?.role === "viewer";
  $: dirty = !sameBrandDna(draft, saved);
  $: assets = resource?.assets ?? [];
  $: completeness = brandCompleteness(draft, assets);
  $: logo = assets.filter((asset) => asset.role === "logo");
  $: favicon = assets.filter((asset) => asset.role === "favicon");
  $: screenshots = assets.filter((asset) => asset.role === "screenshot");
  $: images = assets.filter((asset) => asset.role === "image");
  $: marks = assets.filter(
    (asset) => asset.role === "logo_variant" || asset.role === "icon",
  );
  $: void syncPreviews(assets.filter((asset) => asset.role !== "font"));
  $: question = QUESTIONS[current] ?? QUESTIONS[0]!;
  $: brandName = draft.identity.name.trim();
  $: canAnswer = question.optional || question.answered(draft, assets);
  $: progress = Math.round(
    ((finished ? QUESTIONS.length : current) / QUESTIONS.length) * 100,
  );

  onMount(() => {
    void bootstrap();
    const guard = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  });

  onDestroy(() => {
    Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    if (toastTimer) clearTimeout(toastTimer);
  });

  async function bootstrap() {
    state = "loading";
    try {
      // Sets the CSRF token the asset upload helper sends.
      const user = await currentMotionlyUser();
      if (!user) {
        state = "guest";
        return;
      }
      workspaces = await api.listWorkspaces();
      const requested = new URL(window.location.href).searchParams.get(
        "workspace",
      );
      workspaceId =
        workspaces.find((entry) => entry.id === requested)?.id ??
        workspaces.find((entry) => entry.kind === "personal")?.id ??
        workspaces[0]?.id ??
        "";
      if (!workspaceId) throw new Error("You don't have a workspace yet.");
      await loadBrand();
      state = "ready";
      // A brand that has been started opens on its overview; a new one opens
      // on Tiffy's first question.
      if (resource && resource.revision > 0) mode = "review";
      else void ask(0);
    } catch (error) {
      if (error instanceof CloudApiError && error.status === 401) {
        state = "guest";
        return;
      }
      loadError = messageOf(error, "Brand DNA could not be loaded.");
      state = "error";
    }
  }

  async function loadBrand() {
    applyResource(await api.getBrand(workspaceId));
    conflict = false;
    saveError = "";
  }

  async function changeWorkspace(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const nextWorkspaceId = select.value;
    if (!nextWorkspaceId || nextWorkspaceId === workspaceId) return;
    if (
      dirty &&
      !window.confirm(
        "You have unsaved Brand DNA changes. Switch brands and discard them?",
      )
    ) {
      select.value = workspaceId;
      return;
    }
    workspaceId = nextWorkspaceId;
    state = "loading";
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", workspaceId);
    window.history.replaceState({}, "", url);
    try {
      await loadBrand();
      state = "ready";
      current = 0;
      thread = [];
      reaction = "";
      typing = false;
      finished = false;
      editingFromReview = false;
      mode = resource && resource.revision > 0 ? "review" : "chat";
      if (mode === "chat") void ask(0);
    } catch (error) {
      loadError = messageOf(error, "Brand DNA could not be loaded.");
      state = "error";
    }
  }

  function applyResource(next: BrandResource) {
    resource = next;
    saved = cloneBrandDna(next.dna);
    draft = cloneBrandDna(next.dna);
  }

  async function save(): Promise<boolean> {
    if (!resource || saving || readOnly) return false;
    saving = true;
    saveError = "";
    try {
      applyResource(await api.saveBrand(workspaceId, resource.revision, draft));
      return true;
    } catch (error) {
      if (
        error instanceof CloudApiError &&
        error.code === "BRAND_REVISION_CONFLICT"
      ) {
        conflict = true;
        saveError =
          "Someone else changed this brand. Reload to get their version.";
      } else {
        saveError = messageOf(error, "Brand DNA could not be saved.");
      }
      return false;
    } finally {
      saving = false;
    }
  }

  // ---- conversation -------------------------------------------------------

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /** Tiffy "types" for a beat before each question, then focuses the answer. */
  async function ask(index: number) {
    current = index;
    finished = false;
    typing = !reduceMotion;
    await scrollDown();
    if (typing) await new Promise((resolve) => setTimeout(resolve, 650));
    typing = false;
    await scrollDown();
    answerInput?.focus();
  }

  async function scrollDown() {
    await tick();
    threadEnd?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }

  async function answer(skip = false) {
    if (!skip && !canAnswer) return;
    if (dirty && !readOnly && !(await save())) return;
    // Sending an optional question with nothing in it is a skip, not an answer.
    const skipped = skip || !question.answered(draft, assets);
    thread = [...thread, { index: current, skipped }];
    reaction = skipped
      ? (SKIPPED_REACTIONS[thread.length % SKIPPED_REACTIONS.length] ?? "")
      : question.react(draft);

    if (editingFromReview) {
      editingFromReview = false;
      mode = "review";
      showToast("Saved.");
      return;
    }
    // Skip anything already answered, so a returning brand only sees the gaps.
    let next = current + 1;
    while (next < QUESTIONS.length && QUESTIONS[next]!.answered(draft, assets))
      next += 1;
    if (next >= QUESTIONS.length) {
      finished = true;
      await scrollDown();
      return;
    }
    await ask(next);
  }

  function onKey(event: KeyboardEvent) {
    const multiline = question.kind === "textarea";
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    if (multiline && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    void answer();
  }

  /** Reopens one question: from the thread it continues the chat, from review it comes back. */
  function editQuestion(index: number, fromReview: boolean) {
    editingFromReview = fromReview;
    mode = "chat";
    reaction = "";
    finished = false;
    if (fromReview) thread = [];
    void ask(index);
  }

  /** How far each section of the conversation has got, for the step rail. */
  $: sectionSteps = (Object.keys(SECTIONS) as SectionId[]).map((id) => {
    const entries = sectionQuestions(id);
    const answered = entries.filter(({ entry }) =>
      entry.answered(draft, assets),
    ).length;
    return { id, title: SECTIONS[id], total: entries.length, answered };
  });
  $: currentSection = finished ? null : question.section;

  /** Tiffy jumps to a section: its first open question, or its first question if all are answered. */
  function jumpToSection(section: SectionId) {
    const entries = sectionQuestions(section);
    const open = entries.find(({ entry }) => !entry.answered(draft, assets));
    const target = open ?? entries[0];
    if (!target) return;
    mode = "chat";
    editingFromReview = false;
    reaction = "";
    finished = false;
    void ask(target.index);
  }

  function continueWithTiffy() {
    mode = "chat";
    editingFromReview = false;
    thread = [];
    reaction = "";
    const next = firstUnanswered(draft, assets);
    if (next < 0) {
      finished = true;
      return;
    }
    void ask(next);
  }

  // ---- files --------------------------------------------------------------

  async function linkFile(file: File, role: BrandAssetRole): Promise<string> {
    const assetId = await uploadAsset(workspaceId, file);
    const next = await api.addBrandAsset(workspaceId, { assetId, role });
    if (resource) resource = { ...resource, assets: next.assets };
    return assetId;
  }

  async function upload(role: BrandAssetRole, files: File[]) {
    if (readOnly) return;
    uploading = { ...uploading, [role]: (uploading[role] ?? 0) + files.length };
    for (const file of files) {
      try {
        await linkFile(file, role);
      } catch (error) {
        showToast(messageOf(error, `${file.name} could not be uploaded.`));
      } finally {
        uploading = {
          ...uploading,
          [role]: Math.max(0, (uploading[role] ?? 1) - 1),
        };
      }
    }
  }

  async function removeAsset(assetId: string) {
    if (!resource || readOnly) return;
    try {
      await api.removeBrandAsset(workspaceId, assetId);
      resource = {
        ...resource,
        assets: resource.assets.filter((asset) => asset.assetId !== assetId),
      };
    } catch (error) {
      showToast(messageOf(error, "The image could not be removed."));
    }
  }

  async function syncPreviews(current: readonly BrandAsset[]) {
    const ids = new Set(current.map((asset) => asset.assetId));
    for (const [assetId, url] of Object.entries(previews)) {
      if (ids.has(assetId)) continue;
      URL.revokeObjectURL(url);
      const { [assetId]: _removed, ...rest } = previews;
      previews = rest;
    }
    for (const asset of current) {
      if (previews[asset.assetId]) continue;
      try {
        const url = await loadAssetObjectUrl(asset.assetId);
        previews = { ...previews, [asset.assetId]: url };
      } catch {
        // The tile keeps its spinner; the image itself is still linked.
      }
    }
  }

  // ---- editors ------------------------------------------------------------

  function addColor() {
    if (draft.visual.colors.length >= BRAND_LIMITS.colors) return;
    const count = draft.visual.colors.length;
    const role = count === 0 ? "primary" : count === 1 ? "secondary" : "accent";
    // A different starting swatch each time, so a new palette never reads as one colour.
    const hex = STARTER_COLORS[count % STARTER_COLORS.length] ?? "#0a84ff";
    draft.visual.colors = [
      ...draft.visual.colors,
      { id: newItemId(), name: "", hex, role },
    ];
  }

  function setHex(index: number, value: string) {
    const hex = normalizeHex(value);
    const color = draft.visual.colors[index];
    if (hex && color) color.hex = hex;
    draft = draft;
  }

  function addFeature() {
    if (draft.product.features.length >= BRAND_LIMITS.features) return;
    draft.product.features = [
      ...draft.product.features,
      { id: newItemId(), title: "", description: "" },
    ];
  }

  function toggleTone(tone: string) {
    const has = draft.voice.tone.some(
      (entry) => entry.toLowerCase() === tone.toLowerCase(),
    );
    if (has) {
      draft.voice.tone = draft.voice.tone.filter(
        (entry) => entry.toLowerCase() !== tone.toLowerCase(),
      );
    } else if (draft.voice.tone.length < BRAND_LIMITS.tone) {
      draft.voice.tone = [...draft.voice.tone, tone];
    }
  }

  function addCustomTone() {
    const tone = toneInput.trim().slice(0, 30);
    toneInput = "";
    if (tone) toggleTone(tone);
  }

  function removeAt<T>(list: T[], index: number): T[] {
    return list.filter((_, position) => position !== index);
  }

  /** Text fields are bound through these so one input handles every text question. */
  function textValue(id: string, dna: BrandDna): string {
    switch (id) {
      case "name":
        return dna.identity.name;
      case "website":
        return dna.identity.websiteUrl;
      case "tagline":
        return dna.identity.tagline;
      case "description":
        return dna.product.description;
      case "audience":
        return dna.product.targetAudience;
      case "problem":
        return dna.story.problem;
      case "solution":
        return dna.story.solution;
      case "differentiators":
        return dna.story.differentiators;
      case "proof":
        return dna.story.proof;
      case "writingStyle":
        return dna.voice.writingStyle;
      default:
        return "";
    }
  }

  function setText(id: string, value: string) {
    switch (id) {
      case "name":
        draft.identity.name = value;
        break;
      case "website":
        draft.identity.websiteUrl = value;
        break;
      case "tagline":
        draft.identity.tagline = value;
        break;
      case "description":
        draft.product.description = value;
        break;
      case "audience":
        draft.product.targetAudience = value;
        break;
      case "problem":
        draft.story.problem = value;
        break;
      case "solution":
        draft.story.solution = value;
        break;
      case "differentiators":
        draft.story.differentiators = value;
        break;
      case "proof":
        draft.story.proof = value;
        break;
      case "writingStyle":
        draft.voice.writingStyle = value;
        break;
    }
    draft = draft;
  }

  // ---- helpers ------------------------------------------------------------

  function clip(value: string, length = 140) {
    const flat = value.replace(/\s+/g, " ").trim();
    return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
  }

  function fontStack(family: string, fontId: string, source: string) {
    if (source === "upload") return `"bdf-${fontId}", Inter, sans-serif`;
    return (
      PRESET_FONTS.find((preset) => preset.family === family)?.stack ??
      "Inter, sans-serif"
    );
  }

  function sectionQuestions(section: SectionId) {
    return QUESTIONS.map((entry, index) => ({ entry, index })).filter(
      ({ entry }) => entry.section === section,
    );
  }

  function goBack() {
    if (window.opener && !window.opener.closed) {
      window.opener.focus();
      window.close();
      return;
    }
    window.location.href = "/";
  }

  function showToast(message: string) {
    toast = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ""), 3500);
  }

  function messageOf(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  function handleAuthenticated() {
    authOpen = false;
    void bootstrap();
  }
</script>

<svelte:head><title>Brand DNA · Motionly</title></svelte:head>

<!-- An answer, the way it appears as the user's reply and on the review page. -->
{#snippet answerSummary(entry: BrandQuestion)}
  {#if entry.kind === "logo"}
    {#if logo[0]}
      <span class="bd-sum-logo">
        {#if previews[logo[0].assetId]}<img
            src={previews[logo[0].assetId]}
            alt=""
          />{/if}
      </span>
    {/if}
  {:else if entry.kind === "colors"}
    <span class="bd-sum-swatches">
      {#each draft.visual.colors as color (color.id)}
        <span style={`background:${color.hex}`} title={color.hex}></span>
      {/each}
    </span>
  {:else if entry.kind === "fonts"}
    <span class="bd-sum-fonts">
      {#each draft.visual.fonts as font (font.id)}
        <span
          style={`font-family: ${fontStack(font.family, font.id, font.source)}`}
          >{font.family}</span
        >
      {/each}
    </span>
  {:else if entry.kind === "features"}
    {draft.product.features
      .map((feature) => feature.title)
      .filter(Boolean)
      .join(" · ")}
  {:else if entry.kind === "tone"}
    {draft.voice.tone.join(", ")}
  {:else if entry.kind === "files"}
    {@const files = [...screenshots, ...images, ...marks]}
    <span class="bd-sum-files">
      {#each files.slice(0, 4) as file (file.assetId)}
        <span
          >{#if previews[file.assetId]}<img
              src={previews[file.assetId]}
              alt=""
            />{/if}</span
        >
      {/each}
      {#if files.length > 4}<em>+{files.length - 4}</em>{/if}
    </span>
  {:else if entry.kind === "url"}
    {displayUrl(textValue(entry.id, draft))}
  {:else}
    {clip(textValue(entry.id, draft))}
  {/if}
{/snippet}

<div class="bd">
  <header class="bd-top">
    <button
      type="button"
      class="bd-home"
      on:click={goBack}
      title="Back to Studio"
    >
      <ArrowLeft size={15} />
      <img src="/logo.svg" alt="" />
      <span>Studio</span>
    </button>
    <div class="bd-top__title">
      <strong>Brand DNA</strong>
      {#if state === "ready"}
        <span class="bd-top__meter" aria-label="Brand DNA completeness">
          <span
            style={`width: ${Math.round((completeness.filled / completeness.total) * 100)}%`}
          ></span>
        </span>
      {/if}
    </div>
    {#if state === "ready" && workspaces.length > 1}
      <label class="bd-workspace-picker">
        <span>Brand</span>
        <select value={workspaceId} on:change={changeWorkspace}>
          {#each workspaces as item (item.id)}
            <option value={item.id}>{item.name}</option>
          {/each}
        </select>
      </label>
    {/if}
    {#if state === "ready"}
      <div class="bd-switch" role="tablist" aria-label="View">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "chat"}
          class:is-on={mode === "chat"}
          on:click={() => (mode === "chat" ? null : continueWithTiffy())}
          ><MessageCircle size={14} /> Tiffy</button
        >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "review"}
          class:is-on={mode === "review"}
          on:click={() => {
            editingFromReview = false;
            mode = "review";
          }}><LayoutGrid size={14} /> Overview</button
        >
      </div>
    {:else}
      <span></span>
    {/if}
  </header>

  {#if state === "loading"}
    <div class="bd-state">
      <LoaderCircle class="brand-spin" size={22} />
      <span>Loading Brand DNA…</span>
    </div>
  {:else if state === "guest"}
    <div class="bd-state">
      <TiffyMark size={44} />
      <strong>Sign in so I can learn your brand</strong>
      <span
        >Brand DNA lives in your workspace, so every film you make stays on
        brand.</span
      >
      <button
        type="button"
        class="bd-btn bd-btn--primary"
        on:click={() => {
          authMode = "signin";
          authOpen = true;
        }}><LogIn size={15} /> Sign in</button
      >
    </div>
  {:else if state === "error"}
    <div class="bd-state">
      <TriangleAlert size={26} strokeWidth={1.6} />
      <strong>Brand DNA didn't load</strong>
      <span>{loadError}</span>
      <button type="button" class="bd-btn" on:click={bootstrap}
        >Try again</button
      >
    </div>
  {:else if mode === "chat"}
    <div class="bd-body">
      <nav class="bd-rail" aria-label="Brand DNA sections">
        {#each sectionSteps as step, position (step.id)}
          {@const done = step.answered === step.total}
          <button
            type="button"
            class="bd-step"
            class:is-current={step.id === currentSection}
            class:is-done={done}
            aria-current={step.id === currentSection ? "step" : undefined}
            on:click={() => jumpToSection(step.id)}
          >
            <span class="bd-step__dot">
              {#if done}<Check size={12} strokeWidth={3} />{:else}{position +
                  1}{/if}
            </span>
            <span class="bd-step__text">
              <span class="bd-step__label">{step.title}</span>
              <small>{step.answered} of {step.total}</small>
            </span>
          </button>
        {/each}
      </nav>
      <main class="bd-chat">
        <div class="bd-chat__progress">
          <span style={`width:${progress}%`}></span>
        </div>
        <div class="bd-thread">
          {#if thread.length === 0 && !editingFromReview && current === 0}
            <div class="bd-msg bd-msg--tiffy">
              <TiffyMark size={32} />
              <div class="bd-bubble">
                Hi, I'm Tiffy. Tell me about your brand and every film I make
                will look and sound like you. It takes about three minutes, and
                you can skip anything.
              </div>
            </div>
          {/if}

          {#each thread as exchange, position (position)}
            {@const past = QUESTIONS[exchange.index]}
            {#if past}
              <div class="bd-msg bd-msg--tiffy is-past">
                <span class="bd-avatar-space"></span>
                <div class="bd-bubble">{past.ask(brandName)}</div>
              </div>
              <div class="bd-msg bd-msg--you">
                <button
                  type="button"
                  class="bd-bubble bd-bubble--you"
                  class:is-skipped={exchange.skipped &&
                    !past.answered(draft, assets)}
                  title="Change this answer"
                  on:click={() => editQuestion(exchange.index, false)}
                >
                  {#if exchange.skipped && !past.answered(draft, assets)}
                    Skipped
                  {:else}
                    {@render answerSummary(past)}
                  {/if}
                  <Pencil size={12} />
                </button>
              </div>
            {/if}
          {/each}

          {#if finished}
            <div class="bd-msg bd-msg--tiffy">
              <TiffyMark size={32} />
              <div class="bd-bubble">
                {#if reaction}<span class="bd-reaction">{reaction}</span>{/if}
                That's everything I need. {brandName
                  ? `${brandName}'s`
                  : "Your"} Brand DNA is saved, and every new film will use it.
                <div class="bd-done">
                  <button
                    type="button"
                    class="bd-btn bd-btn--primary"
                    on:click={goBack}
                  >
                    Make a film <ArrowRight size={15} />
                  </button>
                  <button
                    type="button"
                    class="bd-btn"
                    on:click={() => (mode = "review")}
                  >
                    <LayoutGrid size={15} /> Review answers
                  </button>
                </div>
              </div>
            </div>
          {:else}
            <div class="bd-msg bd-msg--tiffy is-current">
              <TiffyMark size={32} />
              {#if typing}
                <div class="bd-bubble bd-typing" aria-label="Tiffy is typing">
                  <span></span><span></span><span></span>
                </div>
              {:else}
                <div class="bd-bubble">
                  {#if reaction && !editingFromReview}<span class="bd-reaction"
                      >{reaction}</span
                    >{/if}
                  {question.ask(brandName)}
                  {#if question.hint}<small>{question.hint}</small>{/if}
                </div>
              {/if}
            </div>

            {#if !typing}
              <div
                class="bd-answer"
                class:is-wide={[
                  "colors",
                  "fonts",
                  "features",
                  "files",
                ].includes(question.kind)}
              >
                <fieldset class="bd-answer__body" disabled={readOnly}>
                  {#if question.kind === "text" || question.kind === "url"}
                    <input
                      bind:this={answerInput}
                      class="bd-input bd-input--big"
                      inputmode={question.kind === "url" ? "url" : "text"}
                      maxlength={question.maxLength}
                      placeholder={question.placeholder}
                      value={textValue(question.id, draft)}
                      on:input={(event) =>
                        setText(question.id, event.currentTarget.value)}
                      on:blur={() =>
                        question.kind === "url" &&
                        setText(
                          question.id,
                          normalizeUrl(textValue(question.id, draft)),
                        )}
                      on:keydown={onKey}
                    />
                  {:else if question.kind === "textarea"}
                    <textarea
                      bind:this={answerInput}
                      class="bd-input bd-textarea"
                      rows="3"
                      maxlength={question.maxLength}
                      placeholder={question.placeholder}
                      value={textValue(question.id, draft)}
                      on:input={(event) =>
                        setText(question.id, event.currentTarget.value)}
                      on:keydown={onKey}
                    ></textarea>
                  {:else if question.kind === "logo"}
                    <div class="bd-marks">
                      <BrandImages
                        single
                        assets={logo}
                        {previews}
                        uploading={uploading.logo ?? 0}
                        disabled={readOnly}
                        emptyLabel="Drop your logo"
                        onupload={(files) => upload("logo", files)}
                        onremove={removeAsset}
                      />
                      <div class="bd-marks__favicon">
                        <span class="bd-label"
                          >Favicon <small>Optional</small></span
                        >
                        <BrandImages
                          single
                          small
                          assets={favicon}
                          {previews}
                          uploading={uploading.favicon ?? 0}
                          disabled={readOnly}
                          emptyLabel="Drop favicon"
                          onupload={(files) => upload("favicon", files)}
                          onremove={removeAsset}
                        />
                      </div>
                    </div>
                  {:else if question.kind === "colors"}
                    <div class="bd-palette">
                      {#each draft.visual.colors as color, index (color.id)}
                        <div class="bd-color">
                          <label
                            class="bd-color__swatch"
                            style={`background:${color.hex}`}
                          >
                            <input
                              type="color"
                              value={color.hex}
                              aria-label="Pick colour"
                              on:input={(event) =>
                                setHex(index, event.currentTarget.value)}
                            />
                          </label>
                          <div class="bd-color__fields">
                            <input
                              class="bd-input bd-input--bare"
                              maxlength="40"
                              placeholder="Name"
                              bind:value={color.name}
                            />
                            <div class="bd-color__row">
                              <input
                                class="bd-input bd-input--bare bd-mono"
                                value={color.hex}
                                maxlength="7"
                                aria-label="Hex value"
                                on:change={(event) => {
                                  setHex(index, event.currentTarget.value);
                                  event.currentTarget.value = color.hex;
                                }}
                              />
                              <select
                                class="bd-input bd-input--bare bd-select"
                                bind:value={color.role}
                              >
                                {#each BRAND_COLOR_ROLES as role}<option
                                    value={role}>{role}</option
                                  >{/each}
                              </select>
                            </div>
                          </div>
                          <button
                            type="button"
                            class="bd-remove"
                            aria-label="Remove colour"
                            on:click={() =>
                              (draft.visual.colors = removeAt(
                                draft.visual.colors,
                                index,
                              ))}><Trash2 size={13} /></button
                          >
                        </div>
                      {/each}
                      {#if draft.visual.colors.length < BRAND_LIMITS.colors}
                        <button
                          type="button"
                          class="bd-color bd-color--add"
                          on:click={addColor}
                        >
                          <Plus size={16} /> Add colour
                        </button>
                      {/if}
                    </div>
                  {:else if question.kind === "fonts"}
                    <BrandFonts
                      bind:fonts={draft.visual.fonts}
                      disabled={readOnly}
                      upload={(file) => linkFile(file, "font")}
                      onnotice={showToast}
                    />
                  {:else if question.kind === "features"}
                    <div class="bd-features">
                      {#each draft.product.features as feature, index (feature.id)}
                        <div class="bd-feature">
                          <span class="bd-feature__n">{index + 1}</span>
                          <div class="bd-feature__fields">
                            <input
                              class="bd-input bd-input--bare bd-feature__title"
                              maxlength="80"
                              placeholder="Feature name"
                              bind:value={feature.title}
                            />
                            <input
                              class="bd-input bd-input--bare"
                              maxlength="300"
                              placeholder="What it does (optional)"
                              bind:value={feature.description}
                            />
                          </div>
                          <button
                            type="button"
                            class="bd-remove"
                            aria-label="Remove feature"
                            on:click={() =>
                              (draft.product.features = removeAt(
                                draft.product.features,
                                index,
                              ))}><Trash2 size={13} /></button
                          >
                        </div>
                      {/each}
                      {#if draft.product.features.length < BRAND_LIMITS.features}
                        <button
                          type="button"
                          class="bd-feature bd-feature--add"
                          on:click={addFeature}
                        >
                          <Plus size={15} /> Add feature
                        </button>
                      {/if}
                    </div>
                  {:else if question.kind === "tone"}
                    <div class="bd-chips">
                      {#each [...new Set( [...TONE_SUGGESTIONS, ...draft.voice.tone] )] as tone}
                        <button
                          type="button"
                          class="bd-chip"
                          class:is-on={draft.voice.tone.some(
                            (entry) =>
                              entry.toLowerCase() === tone.toLowerCase(),
                          )}
                          on:click={() => toggleTone(tone)}>{tone}</button
                        >
                      {/each}
                      <form
                        class="bd-chip-add"
                        on:submit|preventDefault={addCustomTone}
                      >
                        <input
                          maxlength="30"
                          placeholder="+ Your own"
                          bind:value={toneInput}
                        />
                      </form>
                    </div>
                  {:else if question.kind === "files"}
                    <div class="bd-files">
                      <div class="bd-field">
                        <span class="bd-label">Screenshots</span>
                        <BrandImages
                          compact
                          assets={screenshots}
                          {previews}
                          uploading={uploading.screenshot ?? 0}
                          disabled={readOnly}
                          emptyLabel="Drop screenshots"
                          onupload={(files) => upload("screenshot", files)}
                          onremove={removeAsset}
                        />
                      </div>
                      <div class="bd-field">
                        <span class="bd-label">Product images</span>
                        <BrandImages
                          compact
                          assets={images}
                          {previews}
                          uploading={uploading.image ?? 0}
                          disabled={readOnly}
                          emptyLabel="Drop images"
                          onupload={(files) => upload("image", files)}
                          onremove={removeAsset}
                        />
                      </div>
                      <div class="bd-field">
                        <span class="bd-label">Logos &amp; icons</span>
                        <BrandImages
                          compact
                          assets={marks}
                          {previews}
                          uploading={(uploading.logo_variant ?? 0) +
                            (uploading.icon ?? 0)}
                          disabled={readOnly}
                          emptyLabel="Drop logos or icons"
                          onupload={(files) => upload("logo_variant", files)}
                          onremove={removeAsset}
                        />
                      </div>
                    </div>
                  {/if}
                </fieldset>

                <div class="bd-answer__actions">
                  {#if saveError}
                    <span class="bd-answer__error">
                      <TriangleAlert size={14} />
                      {saveError}
                      {#if conflict}<button
                          type="button"
                          class="bd-link"
                          on:click={loadBrand}>Reload</button
                        >{/if}
                    </span>
                  {:else if question.kind === "text" || question.kind === "url"}
                    <span class="bd-answer__hint"
                      ><CornerDownLeft size={12} /> Enter to send</span
                    >
                  {:else if question.kind === "textarea"}
                    <span class="bd-answer__hint">Ctrl + Enter to send</span>
                  {:else}
                    <span></span>
                  {/if}
                  <div class="bd-answer__buttons">
                    {#if question.optional && !editingFromReview}
                      <button
                        type="button"
                        class="bd-btn bd-btn--ghost"
                        on:click={() => answer(true)}
                        disabled={saving}
                      >
                        Skip
                      </button>
                    {/if}
                    {#if editingFromReview}
                      <button
                        type="button"
                        class="bd-btn bd-btn--ghost"
                        on:click={() => {
                          draft = cloneBrandDna(saved);
                          editingFromReview = false;
                          mode = "review";
                        }}>Cancel</button
                      >
                    {/if}
                    <button
                      type="button"
                      class="bd-btn bd-btn--primary"
                      on:click={() => answer()}
                      disabled={saving || conflict || !canAnswer || readOnly}
                    >
                      {#if saving}<LoaderCircle
                          class="brand-spin"
                          size={14}
                        />{/if}
                      {editingFromReview ? "Save" : "Send"}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          {/if}
          <div bind:this={threadEnd} class="bd-thread__end"></div>
        </div>
      </main>
    </div>
  {:else}
    <main class="bd-review">
      <div class="bd-review__inner">
        <header class="bd-review__head">
          <div>
            <h1>{brandName || "Your brand"}</h1>
            <p>
              Everything Tiffy knows about {brandName || "your brand"}. Every
              new film starts from here.
              {completeness.filled} of {completeness.total} essentials filled.
            </p>
          </div>
          {#if firstUnanswered(draft, assets) >= 0}
            <button
              type="button"
              class="bd-btn bd-btn--primary"
              on:click={continueWithTiffy}
            >
              <TiffyMark size={18} /> Continue with Tiffy
            </button>
          {/if}
        </header>
        {#if readOnly}
          <p class="bd-readonly">
            You have view access, so this brand is read-only.
          </p>
        {/if}
        <div class="bd-review__grid">
          {#each Object.entries(SECTIONS) as [section, title] (section)}
            <section class="bd-card">
              <h2>{title}</h2>
              <dl>
                {#each sectionQuestions(section as SectionId) as { entry, index } (entry.id)}
                  <button
                    type="button"
                    class="bd-card__row"
                    disabled={readOnly}
                    on:click={() => editQuestion(index, true)}
                  >
                    <dt>{entry.label}</dt>
                    <dd class:is-empty={!entry.answered(draft, assets)}>
                      {#if entry.answered(draft, assets)}
                        {@render answerSummary(entry)}
                      {:else}
                        Not yet
                      {/if}
                    </dd>
                    <Pencil size={13} />
                  </button>
                {/each}
              </dl>
            </section>
          {/each}
        </div>
      </div>
    </main>
  {/if}

  {#if toast}<div class="bd-toast" role="status">{toast}</div>{/if}

  <AuthDialog
    bind:open={authOpen}
    bind:mode={authMode}
    title="Sign in to Motionly"
    subtitle="Brand DNA is saved to your workspace."
    onauthenticated={handleAuthenticated}
    onclose={() => (authOpen = false)}
  />
</div>

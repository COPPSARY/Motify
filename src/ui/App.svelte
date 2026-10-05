<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { AppMode } from "../app/mode";
  import {
    BRAND_ROUTE,
    homePageFromPath,
    homePagePath,
    type HomePageRoute,
  } from "../app/routes";
  import { currentMotionlyUser, signOut } from "../auth";
  import type { MotionlyUser } from "../auth";
  import AuthDialog from "./auth/AuthDialog.svelte";
  import CreditsBadge from "./cloud/CreditsBadge.svelte";
  import { get } from "svelte/store";
  import { formatCredits } from "../api/credits";
  import { PRICING_URL } from "../api/config";
  import {
    lastCreditCharge,
    refreshCredits,
    resetCredits,
  } from "../stores/credits";
  import {
    ArrowLeft,
    Braces,
    ChevronsUpDown,
    CirclePlay,
    CreditCard,
    Crown,
    Dna,
    Download,
    Eye,
    EyeOff,
    FileText,
    FolderOpen,
    Gift,
    Image as ImageIcon,
    LayoutGrid,
    Layers3,
    LifeBuoy,
    LogOut,
    Mail,
    Maximize2,
    Minus,
    Music2,
    PanelBottomClose,
    PanelBottomOpen,
    Pause,
    Play,
    Plus,
    Save,
    Search,
    Settings,
    Copy,
    Check,
    Sparkles,
    ArrowUp,
    SquarePen,
    Upload,
    X,
  } from "lucide-svelte";
  import { createDynamicComposition } from "../composition/dynamic-compiler";
  import { createGeneratedAdapterSource } from "../composition/generated-adapter";
  import {
    applyEditorField,
    editorGroupTextTarget,
    editorFieldValue,
    readEditorGroup,
  } from "../composition/editor-schema";
  import { hydratePresetAssets } from "../compositions/preset-assets";
  import type { DirectAiResult } from "../ai/direct-ai";
  import {
    loadGenerationPipeline,
    type GenerationPipeline,
  } from "../ai/load-generation-pipeline";
  import {
    CloudApiError,
    GenerationJobLostError,
    ProjectsApi,
    type AudioTrack,
    type BillingPlanId,
    type WorkspaceAsset,
    type WorkspaceSummary,
  } from "../cloud/projects-api";
  import { brandGenerationBrief, type BrandResource } from "../cloud/brand-dna";
  import type { GenerationPlanMemory } from "../ai/generation-guidance";
  import type { GenerationBasis } from "../ai/generation-basis";
  import {
    blankProjectFiles,
    blankScenes,
    createBlankComposition,
  } from "./blank-project";
  import CloudProjectGallery from "../cloud/CloudProjectGallery.svelte";
  import { carryEditorState } from "../composition/editor-state-carry";
  import EarlyNoticeCard from "./EarlyNoticeCard.svelte";
  import { waitForSavedGeneration } from "./background-generation";
  import {
    combineCompositionSource,
    splitCompositionSource,
  } from "../cloud/project-source";
  import type {
    ProjectSourceFiles,
    ProjectSummary,
  } from "../cloud/projects-api";
  import { CompositionRuntime } from "../composition/runtime";
  import type {
    CompositionDefinition,
    EditorFieldDefinition,
    EditorGroupDefinition,
    ElementOverride,
    RuntimeEditorState,
    RuntimeSnapshot,
  } from "../composition/types";
  import {
    loadTemplate,
    type TemplateId,
  } from "../compositions/template-loader";
  import {
    deriveSceneTracks,
    formatTimelineSeconds,
    type SceneTrack,
  } from "./timeline-data";
  import TiffyPanel from "./cloud/TiffyPanel.svelte";
  import MusicPanel from "./cloud/MusicPanel.svelte";
  import AssetsPanel from "./cloud/AssetsPanel.svelte";
  import { generationStore } from "../stores/generation";
  import { hydrateCloudAssetTokens, uploadAsset } from "../api/assets";
  import { AUDIO_ACCEPT, addTrackToLibrary, isAudioFile } from "../api/audio";
  import { AudioSync } from "../composition/audio-sync";
  import { removeAudioTrackFromComposition } from "../composition/composition-audio";
  import {
    MAX_SELECTED_AUDIO,
    deselectAudioTrack,
    refreshMusicLibrary,
    refreshProjectAudio,
    selectAudioTrack,
    selectedAudio,
  } from "../stores/music-library";
  import type { ValidatedGeneration } from "../ai/validate-generation";
  import {
    generationAsset,
    hydrateAssetTokens,
    readLocalAsset,
    storeLocalAsset,
    type LocalAssetReference,
    type AssetIntent,
  } from "../stores/local-assets";
  import { loadProjectDraft, saveProjectDraft } from "../stores/project-drafts";
  import { loadLocalProject, saveLocalProject } from "./local-project";
  import { captureEvent, identifyAnalyticsUser } from "../posthog";
  import {
    editableElementAtPoint,
    isElementActuallyVisible,
  } from "./selection-hit-test";
  import "./styles/editor-shell.css";
  import "./styles/content-panel.css";
  import "./styles/preview-stage.css";
  import "./styles/properties-inspector.css";
  import "./styles/timeline-panel.css";
  import "./styles/editor-theme.css";
  import "./styles/editor-sleek.css";
  import "./styles/music-panel.css";
  import "./styles/credits-badge.css";
  import "./styles/home-shell.css";

  export let mode: AppMode = "cloud";

  /** Full-width pages of the cloud editor; "create" is the page at "/". */
  type HomePage = "create" | HomePageRoute;

  const SUPPORT_EMAIL = "support@motify.video";

  type TemplateCategory =
    "Product launch" | "SaaS" | "AI" | "Explainer" | "Kinetic type";

  interface TemplateCard {
    id: TemplateId;
    name: string;
    duration: string;
    summary: string;
    category: TemplateCategory;
    /** Thumbnail art: a class for its palette and three lines of lettering. */
    thumbnail: string;
    eyebrow: string;
    headline: string;
    accent: string;
    footnote: string;
  }

  type TimelineMode = "project" | "scene";

  interface MessageAttachment {
    id: string;
    name: string;
    previewUrl?: string;
    intent?: AssetIntent;
    /** A song scoring the film rather than an image placed in it. */
    kind?: "audio";
  }

  interface AssistantMessage {
    role: "user" | "assistant";
    text: string;
    attachments?: MessageAttachment[];
  }

  const unsavedDraftKey = "active";

  const textElementTags = new Set([
    "B",
    "BUTTON",
    "EM",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "P",
    "SMALL",
    "SPAN",
    "STRONG",
  ]);

  let previewRoot: HTMLDivElement;
  let previewStage: HTMLDivElement;
  let timelinePanel: HTMLElement;
  let playheadMarker: HTMLSpanElement;
  let scrubbing = false;
  let fileInput: HTMLInputElement;
  let cloudProjects: CloudProjectGallery;
  let mediaInput: HTMLInputElement;
  let stagedAssets: LocalAssetReference[] = [];
  /**
   * Assets that left the composer with a message and are still being generated
   * against. They are gone from the tray - the message carries them now - but
   * the request in flight is still built from them.
   */
  let assetsInFlight: LocalAssetReference[] | null = null;
  // Thumbnails for the attachment chips. Kept apart from assetObjectUrls, which
  // is revoked wholesale on every regeneration.
  let stagedPreviews: Record<string, string> = {};
  let uploadingMedia = false;
  let uploadProgress = 0;
  let uploadPreview: string | null = null;
  let uploadName = "";
  let runtime: CompositionRuntime | null = null;
  let runtimeUnsubscribe: (() => void) | null = null;
  /** Plays the mounted film's music in step with the timeline playhead. */
  let audioSync: AudioSync | null = null;
  /** Songs sent with the message being generated, kept for its repair pass. */
  let audioInFlight: AudioTrack[] | null = null;
  const musicApi = new ProjectsApi();
  // The editor opens on an empty stage. A preset only enters the session when
  // the user opens one, so a first prompt is never read as an edit of it.
  let activeComposition: CompositionDefinition = createBlankComposition();
  let previewLoadSequence = 0;
  let projectStyles: HTMLStyleElement | null = null;
  let snapshot: RuntimeSnapshot = {
    time: 0,
    playing: false,
    sceneId: blankScenes[0]?.id ?? "",
  };
  let selectedSceneId = blankScenes[0]?.id ?? "";
  let selectedId = "";
  let zoom = 1;
  let fitScale = 0.5;
  /**
   * The page shown in the center column instead of the editor. Null means
   * "the default": the editor while a video is open, the create page before.
   */
  let page: HomePageRoute | null =
    mode === "cloud"
      ? (homePageFromPath(window.location.pathname) ?? null)
      : null;
  /** Where the My Videos page draws the project gallery. */
  let videosHost: HTMLElement | null = null;
  let profileMenuOpen = false;
  let supportEmailCopied = false;
  let profileMenu: HTMLDivElement;
  let templateQuery = "";
  /** Until the workspace answers, Recents shows placeholders, not "none". */
  let recentsLoaded = false;
  /** A /p/:id link whose project is still being fetched. */
  let openingProject =
    mode === "cloud" && /^\/p\/[^/]+\/?$/.test(window.location.pathname);
  /** The template whose code is downloading, shown as busy on its card. */
  let openingTemplate: TemplateId | null = null;
  let templateCategory: TemplateCategory | "All" = "All";
  let sidebarProjects: ProjectSummary[] = [];
  /** The signed-in person's Brand DNA. Every video they make is made with it. */
  let brand: BrandResource | null = null;
  let localPanelOpen = false;
  let localPanelView: "presets" | "source" | "assets" = "presets";
  let localAssets: string[] = [];
  // The full layer timeline is opt-in; by default the canvas gets the room and
  // only the scenes bar sits under it.
  let timelineOpen = false;
  let sceneBarScrubbing = false;
  let exporting = false;
  let removeWatermark = false;
  let notice = "";
  let assistantDraft = "";
  let composerInput: HTMLTextAreaElement;
  let assistantMessages: AssistantMessage[] = [];
  // Directorial memory: a follow-up prompt continues this film instead of
  // restarting from a blank stage.
  let generationPlan: GenerationPlanMemory | null = null;
  const activityVerbs = [
    "Composing",
    "Shaping",
    "Animating",
    "Polishing",
    "Rendering",
  ];
  let activityVerb: string = activityVerbs[0] ?? "Composing";
  let activityTimer: ReturnType<typeof setInterval> | undefined;
  let editorRevision = 0;
  let currentUser: MotionlyUser | null = null;
  let authChecked = false;
  let authDialogOpen = false;
  let authDialogMode: "signin" | "signup" = "signin";
  let promptHeldForAuth = "";
  let workspaceId = "";
  let activePlan: BillingPlanId | null = null;
  $: if (!activePlan) removeWatermark = false;
  $: syncPreviewWatermark(runtime, !removeWatermark || !activePlan);
  let pendingLandingPrompt = "";
  let landingPromptStarted = false;
  let draftSaveTimer: ReturnType<typeof setTimeout> | undefined;
  let assetObjectUrls: string[] = [];
  let selectedEditorGroup: EditorGroupDefinition | null = null;
  type ScrubProperty =
    | "x"
    | "y"
    | "scale"
    | "rotation"
    | "fontSize"
    | "letterSpacing"
    | "lineHeight";
  let selectionDrag: {
    pointerId: number;
    mode: "move" | "scale";
    startX: number;
    startY: number;
    x: number;
    y: number;
    scale: number;
    width: number;
  } | null = null;
  // A press on the canvas becomes a move only after the pointer travels a few
  // pixels, so a plain click still just selects.
  const CANVAS_DRAG_THRESHOLD = 3;
  let pendingCanvasDrag: {
    pointerId: number;
    startX: number;
    startY: number;
    id: string;
  } | null = null;
  let suppressPreviewClick = false;
  let numberScrub: {
    pointerId: number;
    property: ScrubProperty;
    startX: number;
    start: number;
    value: number;
  } | null = null;
  let elementPromptOpen = false;
  let elementPromptDraft = "";
  let elementPromptInput: HTMLInputElement;
  // What the last send actually asked Tiffy, so Retry repeats it exactly.
  let lastSentPrompt: { text: string; prompt: string } | null = null;

  let lastGenState = "";

  $: {
    if (
      $generationStore.isActive &&
      $generationStore.message !== lastGenState
    ) {
      lastGenState = $generationStore.message;
      const lastMessage = assistantMessages.at(-1);
      assistantMessages =
        lastMessage?.role === "assistant"
          ? [
              ...assistantMessages.slice(0, -1),
              { role: "assistant", text: $generationStore.message },
            ]
          : [
              ...assistantMessages,
              { role: "assistant", text: $generationStore.message },
            ];
    } else if (
      !$generationStore.isActive &&
      $generationStore.status === "COMPLETED" &&
      lastGenState !== "COMPLETED"
    ) {
      lastGenState = "COMPLETED";
      const completedMessage =
        $generationStore.message ||
        "Done — I updated the project and saved your changes.";
      assistantMessages =
        assistantMessages.at(-1)?.role === "assistant"
          ? [
              ...assistantMessages.slice(0, -1),
              { role: "assistant", text: completedMessage },
            ]
          : [
              ...assistantMessages,
              { role: "assistant", text: completedMessage },
            ];
      scheduleDraftSave();
    } else if (
      $generationStore.status === "AWAITING_APPLY" &&
      lastGenState !== "AWAITING_APPLY"
    ) {
      lastGenState = "AWAITING_APPLY";
      assistantMessages = [
        ...assistantMessages,
        { role: "assistant", text: $generationStore.message },
      ];
      scheduleDraftSave();
    } else if ($generationStore.error && lastGenState !== "ERROR") {
      lastGenState = "ERROR";
      assistantMessages = [
        ...assistantMessages,
        { role: "assistant", text: "Error: " + $generationStore.error },
      ];
      scheduleDraftSave();
    }
  }
  let timelineMode: TimelineMode = "project";
  let sourceOpen = false;
  let cloudFiles: ProjectSourceFiles = { ...blankProjectFiles };
  let cloudProject: ProjectSummary | null = null;
  let localProjectName = "";
  let backendGenerationProjectId = "";
  // A /p/:id link opens straight into its video, so the editor (not the
  // create page) is shown while that project loads.
  let projectStarted =
    mode === "local" || /^\/p\/[^/]+\/?$/.test(window.location.pathname);
  /** Manual edits not yet saved to the cloud project. */
  let sourceDirty = false;

  $: hasEditorProject =
    mode === "local" ||
    projectStarted ||
    Boolean(cloudProject || backendGenerationProjectId);
  $: brandName =
    brand && brand.revision > 0
      ? brand.dna.identity.name.trim() || "Your brand"
      : null;
  $: centerPage =
    mode === "cloud" ? (page ?? (hasEditorProject ? null : "create")) : null;
  $: showInspector =
    mode === "local" || (hasEditorProject && centerPage === null);
  $: projectTitle =
    (cloudProject?.name ?? localProjectName) ||
    activeComposition.title ||
    "Untitled video";

  interface SelectionRect {
    visible: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  }

  let selectionRect: SelectionRect = {
    visible: false,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  };

  onMount(() => {
    const url = new URL(window.location.href);
    const promptFromUrl =
      mode === "cloud" ? (url.searchParams.get("prompt")?.trim() ?? "") : "";
    pendingLandingPrompt =
      mode === "cloud"
        ? promptFromUrl ||
          sessionStorage.getItem("motionly_pending_prompt") ||
          ""
        : "";
    if (pendingLandingPrompt) {
      sessionStorage.setItem("motionly_pending_prompt", pendingLandingPrompt);
      url.searchParams.delete("prompt");
      window.history.replaceState({}, "", url);
    }
    if (mode === "cloud") {
      void currentMotionlyUser().then((user) => {
        currentUser = user;
        authChecked = true;
        if (user) {
          identifyAnalyticsUser(user);
          void refreshCredits();
          void refreshActivePlan();
          void loadBrand();
        }
        // A prompt carried over from motionly.site is what the visitor came
        // for, so a guest is asked to make an account right away.
        else if (pendingLandingPrompt) openAuthDialog("signup");
      });
    }
    mountComposition(activeComposition);
    void restoreStartupProject().finally(() => {
      if (mode === "cloud") void runLandingPrompt();
    });
    const restoreRouteProject = () => syncRouteFromHistory();
    // Brand DNA and plans are managed on their own pages, usually in another
    // tab; coming back picks up a changed brand or a plan just paid for.
    const refreshBrandOnReturn = () => {
      if (document.visibilityState !== "visible" || !currentUser) return;
      void loadBrand();
      void refreshActivePlan();
      void refreshCredits();
    };
    if (mode === "cloud") {
      // Fetch the generation pipeline once the page is idle, so the first
      // prompt rarely waits for it.
      const warm = () => void loadGenerationPipeline();
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(warm);
      } else {
        setTimeout(warm, 1500);
      }
      window.addEventListener("popstate", restoreRouteProject);
      document.addEventListener("visibilitychange", refreshBrandOnReturn);
    }
    let playbackFrame = 0;
    const syncPlaybackUi = () => {
      if (runtime) {
        snapshot = runtime.snapshot;
        if (timelineMode === "project") selectedSceneId = snapshot.sceneId;
        const playheadPosition = `${timelinePlayheadPosition()}%`;
        timelinePanel?.style.setProperty(
          "--playhead-position",
          playheadPosition,
        );
        if (playheadMarker) playheadMarker.style.left = playheadPosition;
      }
      playbackFrame = requestAnimationFrame(syncPlaybackUi);
    };
    playbackFrame = requestAnimationFrame(syncPlaybackUi);
    const observer = new ResizeObserver(() => {
      fitPreview();
      updateSelectionRect();
    });
    observer.observe(previewStage);
    fitPreview();
    updateSelectionRect();
    if (mode === "cloud") {
      activityTimer = setInterval(() => {
        if (!$generationStore.isActive) return;
        const currentIndex = activityVerbs.indexOf(activityVerb);
        const nextIndex = (currentIndex + 1) % activityVerbs.length;
        activityVerb =
          activityVerbs[nextIndex] ?? activityVerbs[0] ?? "Composing";
      }, 1200);
    }
    return () => {
      runtimeUnsubscribe?.();
      audioSync?.dispose();
      cancelAnimationFrame(playbackFrame);
      if (activityTimer) clearInterval(activityTimer);
      if (draftSaveTimer) clearTimeout(draftSaveTimer);
      window.removeEventListener("pointermove", updateSelectionDrag);
      window.removeEventListener("pointerup", endSelectionDrag);
      window.removeEventListener("pointermove", watchCanvasDrag);
      window.removeEventListener("pointerup", cancelCanvasDrag);
      window.removeEventListener("popstate", restoreRouteProject);
      document.removeEventListener("visibilitychange", refreshBrandOnReturn);
      observer.disconnect();
      runtime?.destroy();
      assetObjectUrls.forEach((url) => URL.revokeObjectURL(url));
      projectStyles?.remove();
    };
  });

  function mountComposition(
    composition: CompositionDefinition,
    editorState?: Partial<RuntimeEditorState>,
  ): void {
    const previousSelectedId = selectedId;
    runtimeUnsubscribe?.();
    audioSync?.dispose();
    runtime?.destroy();
    activeComposition = composition;
    selectedId = "";
    selectedEditorGroup = null;
    selectedSceneId = composition.scenes[0]?.id ?? "";
    runtime = new CompositionRuntime(composition, previewRoot);
    audioSync = new AudioSync(previewRoot);
    runtime.importEditorState(editorState);
    if (previousSelectedId && runtime.elements.has(previousSelectedId)) {
      selectedId = previousSelectedId;
      refreshSelectedEditorGroup();
    }
    runtimeUnsubscribe = runtime.subscribe((value) => {
      snapshot = value;
      // An export steps the playhead frame by frame; it must stay silent.
      if (!exporting) audioSync?.sync(value);
      // In scene mode the user has opened one beat to edit it. Following the
      // playhead there would swap the track list out from under a click.
      if (timelineMode === "project") selectedSceneId = value.sceneId;
      updateSelectionRect();
    });
    fitPreview();
    editorRevision += 1;
    // Whatever was just mounted is what the project holds.
    sourceDirty = false;
  }

  function syncPreviewWatermark(
    mountedRuntime: CompositionRuntime | null,
    visible: boolean,
  ): void {
    if (!mountedRuntime) return;
    const existing = mountedRuntime.root.querySelector(
      "[data-motify-watermark]",
    );
    if (!visible) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const { width, height } = mountedRuntime.definition;
    const image = document.createElement("img");
    image.src = "/motify-watermark-smoke.png";
    image.alt = "";
    image.style.cssText = `display:block;width:${Math.round(width * 0.21)}px;height:auto`;

    const watermark = document.createElement("div");
    watermark.dataset["motifyWatermark"] = "";
    watermark.setAttribute("aria-hidden", "true");
    watermark.style.cssText = `position:absolute;right:${Math.round(width * -0.008)}px;bottom:${Math.round(height * -0.007)}px;opacity:.8;z-index:2147483647;pointer-events:none`;
    watermark.append(image);
    mountedRuntime.root.append(watermark);
  }

  function scheduleDraftSave(): void {
    if (typeof localStorage === "undefined") return;
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      if (!runtime) return;
      const projectDraftKey =
        cloudProject?.id || backendGenerationProjectId || unsavedDraftKey;
      saveProjectDraft(projectDraftKey, {
        version: 1,
        updatedAt: Date.now(),
        files: { ...cloudFiles },
        messages: assistantMessages.filter(
          (message) =>
            !/^(Composing|Shaping|Animating|Polishing|Rendering)/.test(
              message.text,
            ),
        ),
        assets: stagedAssets,
        plan: generationPlan ?? undefined,
        editorState: runtime.exportEditorState(),
        metadata: {
          title: activeComposition.title,
          duration: activeComposition.duration,
          scenes: activeComposition.scenes,
        },
        baseRevision: cloudProject?.revision,
      });
      if (localProjectName) {
        void saveLocalProject(cloudFiles).catch((error: unknown) => {
          showNotice(
            error instanceof Error
              ? error.message
              : "Could not save the local Motify project.",
            10000,
          );
        });
      }
    }, 180);
  }

  async function restoreStartupProject(): Promise<void> {
    if (mode === "cloud" && projectIdFromRoute()) return;
    if (mode !== "local") return;
    try {
      const local = await loadLocalProject();
      if (local) {
        localProjectName = local.name;
        localAssets = local.assets ?? [];
        cloudFiles = { ...local.files };
        const composition = createDynamicComposition(
          combineCompositionSource(local.files),
          local.files["timeline.js"],
          local.metadata,
        );
        mountComposition(composition);
        showNotice(`Opened local project ${local.name}.`);
        return;
      }
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Could not open the local Motify project.",
        10000,
      );
    }
  }

  function projectIdFromRoute(): string | null {
    const match = /^\/p\/([^/]+)\/?$/.exec(window.location.pathname);
    return match ? decodeURIComponent(match[1] ?? "") : null;
  }

  function setProjectRoute(projectId: string, replace = false): void {
    const pathname = `/p/${encodeURIComponent(projectId)}`;
    if (window.location.pathname === pathname) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", pathname);
  }

  function clearProjectRoute(): void {
    navigate("/");
  }

  function navigate(pathname: string, replace = false): void {
    if (window.location.pathname === pathname) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", pathname);
  }

  /** Back and forward: show whatever the URL now names. */
  function syncRouteFromHistory(): void {
    const routed = homePageFromPath(window.location.pathname);
    if (routed !== undefined) {
      if (hasEditorProject && !$generationStore.isActive) closeProject();
      page = routed;
    }
    void restoreProjectFromRoute();
  }

  async function restoreProjectFromRoute(): Promise<void> {
    const projectId = projectIdFromRoute();
    if (!projectId) {
      if (cloudProject) closeProject();
      return;
    }
    if (!cloudProjects || cloudProject?.id === projectId) {
      openingProject = false;
      return;
    }
    openingProject = true;
    try {
      await cloudProjects.openProjectById(projectId);
    } finally {
      openingProject = false;
    }
  }

  /** Unloads the open video and returns the editor to its empty state. */
  function closeProject(): void {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    resetAssistantSession();
    projectStarted = false;
    page = null;
    cloudProject = null;
    localProjectName = "";
    backendGenerationProjectId = "";
    cloudFiles = { ...blankProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    timelineMode = "project";
    timelineOpen = false;
    sourceOpen = false;
    generationStore.set({
      isActive: false,
      status: "IDLE",
      stage: "IDLE",
      progress: 0,
      message: "",
    });
    mountComposition(createBlankComposition());
  }

  /**
   * The chat's back button. Edits made by hand are saved first, so leaving a
   * video never drops them; Tiffy's edits are already saved by the backend.
   */
  async function returnHome(): Promise<void> {
    if ($generationStore.isActive) return;
    if (sourceDirty && cloudProject) await saveSource();
    closeProject();
    clearProjectRoute();
  }

  const templateCategories: readonly TemplateCategory[] = [
    "Product launch",
    "SaaS",
    "AI",
    "Explainer",
    "Kinetic type",
  ];

  const templates: readonly TemplateCard[] = [
    {
      id: "claude",
      name: "Claude Calorie & Climax",
      duration: "0:24",
      summary: "Build, macro zoom & climax",
      category: "AI",
      thumbnail: "claude-thumbnail",
      eyebrow: "RESEARCH / REASON / CREATE",
      headline: "CLAUDE",
      accent: "THINKS.",
      footnote: "PROMPT · ARTIFACT · ACTION",
    },
    {
      id: "motify",
      name: "Motify Launch Film",
      duration: "0:52",
      summary: "Product story and showcase",
      category: "Product launch",
      thumbnail: "promo-thumbnail",
      eyebrow: "CODE-FIRST MOTION",
      headline: "MOTIFY",
      accent: "LAUNCH.",
      footnote: "PROMPT · EDIT · EXPORT",
    },
    {
      id: "kiri-tts",
      name: "KiriTTS SaaS Ad",
      duration: "0:28",
      summary: "5 acts, Claude-grade camera",
      category: "SaaS",
      thumbnail: "kiritts-thumbnail",
      eyebrow: "UNIFIED AI VOICE",
      headline: "KIRI",
      accent: "TTS.",
      footnote: "TTS · STT · CLONING · API",
    },
    {
      id: "apple-notes",
      name: "Apple Notes",
      duration: "0:24",
      summary: "2.5D expansive camera",
      category: "Product launch",
      thumbnail: "apple-notes-thumbnail",
      eyebrow: "EXPANSIVE CAMERA",
      headline: "APPLE",
      accent: "NOTES.",
      footnote: "GLASS · ECOSYSTEM · PENCIL",
    },
    {
      id: "tessera",
      name: "Tessera",
      duration: "0:20",
      summary: "Transformation, no UI shell",
      category: "Explainer",
      thumbnail: "tessera-thumbnail",
      eyebrow: "DATA CONTRACT",
      headline: "ONE",
      accent: "SHAPE.",
      footnote: "CORRIDOR · GATE · CONTRACT",
    },
    {
      id: "relay",
      name: "Relay",
      duration: "0:26",
      summary: "Review and handoff",
      category: "SaaS",
      thumbnail: "relay-thumbnail",
      eyebrow: "REVIEW AND HANDOFF",
      headline: "PASS",
      accent: "IT ON.",
      footnote: "26 SECOND PRODUCT FILM",
    },
    {
      id: "recoup",
      name: "Recoup",
      duration: "0:26",
      summary: "Liquid glass, 3D camera",
      category: "SaaS",
      thumbnail: "recoup-thumbnail",
      eyebrow: "FAILED PAYMENT RECOVERY",
      headline: "WIN IT",
      accent: "BACK.",
      footnote: "LIQUID GLASS · 3D CAMERA",
    },
    {
      id: "motionly-promo",
      name: "Motionly Promo",
      duration: "0:20",
      summary: "HTML/CSS + GSAP",
      category: "Kinetic type",
      thumbnail: "promo-thumbnail",
      eyebrow: "KINETIC PRODUCT FILM",
      headline: "MAKE IT",
      accent: "MOVE.",
      footnote: "EDITORIAL · SAAS · GSAP",
    },
  ];

  $: visibleTemplates = templates.filter((template) => {
    const query = templateQuery.trim().toLowerCase();
    return (
      (templateCategory === "All" || template.category === templateCategory) &&
      (!query ||
        `${template.name} ${template.summary} ${template.category}`
          .toLowerCase()
          .includes(query))
    );
  });

  /**
   * Fetches a template's code the first time it is opened, then mounts it as
   * an unsaved video.
   */
  async function openTemplate(template: TemplateCard): Promise<void> {
    if (openingTemplate) return;
    openingTemplate = template.id;
    let loaded: Awaited<ReturnType<typeof loadTemplate>>;
    try {
      loaded = await loadTemplate(template.id);
    } catch {
      showNotice(`${template.name} could not be opened. Try again.`);
      return;
    } finally {
      openingTemplate = null;
    }
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
    backendGenerationProjectId = "";
    clearProjectRoute();
    cloudFiles = { ...loaded.files };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(loaded.composition);
    page = null;
    captureEvent("preset loaded", {
      preset_name: template.id.replace(/-/g, "_"),
    });
    showNotice(`${template.name} template opened.`);
  }

  async function mountSavedProject(
    project: ProjectSummary,
    files: ProjectSourceFiles,
  ): Promise<void> {
    previewLoadSequence += 1;
    resetAssistantSession();
    const draft = loadProjectDraft(project.id);
    if (draft) {
      assistantMessages = draft.messages.map((message) => ({ ...message }));
      generationPlan = draft.plan ?? null;
    }
    projectStyles?.remove();
    projectStyles = null;
    const hydrated = await hydrateCloudAssetTokens(
      combineCompositionSource(files),
    );
    const attachments = await new ProjectsApi().listProjectAssets(project.id);
    stagedAssets = attachments.map((asset) => ({
      id: asset.id,
      uploadId: asset.id,
      name: asset.fileName,
      mimeType: asset.contentType,
      token: asset.token ?? `motify-asset://${asset.id}`,
      intent: asset.role,
    }));
    assetObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    assetObjectUrls = hydrated.objectUrls;
    mountComposition(
      createDynamicComposition(hydrated.source, files["timeline.js"], {
        id: project.id,
        title: project.name,
        width: project.width,
        height: project.height,
        fps: project.fps,
        duration: project.duration,
        scenes: project.scenes,
      }),
      draft?.baseRevision === project.revision ? draft.editorState : undefined,
    );
  }

  function fitPreview(): void {
    if (!previewStage) return;
    const width = Math.max(1, previewStage.clientWidth - 40);
    const height = Math.max(1, previewStage.clientHeight - 40);
    fitScale = Math.min(
      width / activeComposition.width,
      height / activeComposition.height,
    );
    zoom = 1;
  }

  function updateSelectionRect(): void {
    if (!runtime || !selectedId || !previewRoot) {
      selectionRect = { visible: false, left: 0, top: 0, width: 0, height: 0 };
      return;
    }
    const element = runtime.elements.get(selectedId);
    if (!element) {
      selectionRect = { visible: false, left: 0, top: 0, width: 0, height: 0 };
      return;
    }
    if (!isElementActuallyVisible(element, previewRoot)) {
      selectionRect = { visible: false, left: 0, top: 0, width: 0, height: 0 };
      return;
    }
    const rootRect = previewRoot.getBoundingClientRect();
    const textTarget = selectedTextTarget();
    const boundsElement = textTarget ?? element;
    let elRect = boundsElement.getBoundingClientRect();
    // Text often owns a generous CSS line box. A DOM Range follows the
    // rendered words so the outline reflects what the user actually clicked.
    if (textTarget?.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(textTarget);
      if (typeof range.getBoundingClientRect === "function") {
        const textRect = range.getBoundingClientRect();
        if (textRect.width > 0 && textRect.height > 0) elRect = textRect;
      }
    }
    const scale = rootRect.width / activeComposition.width;
    if (scale <= 0 || elRect.width <= 0 || elRect.height <= 0) {
      selectionRect = { visible: false, left: 0, top: 0, width: 0, height: 0 };
      return;
    }
    selectionRect = {
      visible: true,
      left: (elRect.left - rootRect.left) / scale,
      top: (elRect.top - rootRect.top) / scale,
      width: elRect.width / scale,
      height: elRect.height / scale,
    };
  }

  function togglePlayback(): void {
    if (!runtime) return;
    snapshot.playing ? runtime.pause() : runtime.play();
  }

  // Picks the layer the user actually pointed at. The topmost painted element
  // wins; its nearest registered ancestor is the answer. Structural film roots,
  // camera worlds, and scene wrappers are skipped so a click lands on the actual
  // subject. Full-bleed images and giant type remain selectable.
  function editableIdAtPoint(event: MouseEvent): string {
    if (!runtime || !previewRoot) return "";
    return (
      editableElementAtPoint({
        root: previewRoot,
        elements: runtime.elements,
        clientX: event.clientX,
        clientY: event.clientY,
      })?.dataset["motionlyId"] ?? ""
    );
  }

  function selectFromPreview(event: MouseEvent): void {
    if (
      event.target instanceof Element &&
      event.target.closest(".me-selection-overlay")
    ) {
      return;
    }
    // The click that ends a canvas drag must not reselect what lies beneath.
    if (suppressPreviewClick) {
      suppressPreviewClick = false;
      return;
    }
    const hitId = editableIdAtPoint(event);
    if (!hitId) {
      selectElement("");
      return;
    }
    selectElement(hitId);
  }

  function selectElement(id: string): void {
    if (id !== selectedId) {
      elementPromptOpen = false;
      elementPromptDraft = "";
    }
    if (!id) {
      selectedId = "";
      selectedEditorGroup = null;
      updateSelectionRect();
      return;
    }
    timelineMode = "scene";
    selectedSceneId = snapshot.sceneId;
    selectedId = id;
    refreshSelectedEditorGroup();
    updateSelectionRect();
  }

  /**
   * Pressing any editable layer arms a move. Selection outlines stay visual
   * only (a full-rect hit target would block smaller layers), so dragging
   * starts from the same hit test a click uses.
   */
  function pressPreview(event: PointerEvent): void {
    if (event.button !== 0 || !runtime) return;
    if (
      event.target instanceof Element &&
      event.target.closest(".me-selection-overlay")
    ) {
      return;
    }
    const hitId = editableIdAtPoint(event);
    if (!hitId) return;
    pendingCanvasDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      id: hitId,
    };
    window.addEventListener("pointermove", watchCanvasDrag);
    window.addEventListener("pointerup", cancelCanvasDrag);
  }

  function watchCanvasDrag(event: PointerEvent): void {
    const pending = pendingCanvasDrag;
    if (!pending || event.pointerId !== pending.pointerId) return;
    const distance = Math.hypot(
      event.clientX - pending.startX,
      event.clientY - pending.startY,
    );
    if (distance < CANVAS_DRAG_THRESHOLD) return;
    cancelCanvasDrag();
    if (pending.id !== selectedId) selectElement(pending.id);
    if (!selectedEditorGroup?.allowTransform) return;
    suppressPreviewClick = true;
    startSelectionDrag(
      pending.pointerId,
      pending.startX,
      pending.startY,
      "move",
    );
    updateSelectionDrag(event);
  }

  function cancelCanvasDrag(): void {
    pendingCanvasDrag = null;
    window.removeEventListener("pointermove", watchCanvasDrag);
    window.removeEventListener("pointerup", cancelCanvasDrag);
  }

  function handlePreviewKey(event: KeyboardEvent): void {
    // Typing in the element prompt bubbles here; it is not a canvas command.
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, [contenteditable]")
    ) {
      return;
    }
    if (event.key === "Escape") {
      selectElement("");
      return;
    }
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = nudge[event.key];
    if (!direction || !runtime || !selectedId) return;
    if (!selectedEditorGroup?.allowTransform) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const current = currentOverride();
    const patch: ElementOverride = {
      x: (current.x ?? 0) + direction[0] * step,
      y: (current.y ?? 0) + direction[1] * step,
    };
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
    scheduleDraftSave();
  }

  function refreshSelectedEditorGroup(): void {
    const element = selectedId ? runtime?.elements.get(selectedId) : undefined;
    selectedEditorGroup = element ? readEditorGroup(selectedId, element) : null;
  }

  function beginSelectionDrag(
    event: PointerEvent,
    mode: "move" | "scale",
  ): void {
    if (!runtime || !selectedId || !selectedEditorGroup?.allowTransform) return;
    event.preventDefault();
    event.stopPropagation();
    startSelectionDrag(event.pointerId, event.clientX, event.clientY, mode);
  }

  function startSelectionDrag(
    pointerId: number,
    startX: number,
    startY: number,
    mode: "move" | "scale",
  ): void {
    const current = currentOverride();
    selectionDrag = {
      pointerId,
      mode,
      startX,
      startY,
      x: current.x ?? 0,
      y: current.y ?? 0,
      scale: current.scale ?? 1,
      width: Math.max(1, selectionRect.width),
    };
    window.addEventListener("pointermove", updateSelectionDrag);
    window.addEventListener("pointerup", endSelectionDrag, { once: true });
  }

  function updateSelectionDrag(event: PointerEvent): void {
    if (
      !selectionDrag ||
      event.pointerId !== selectionDrag.pointerId ||
      !runtime ||
      !selectedId
    ) {
      return;
    }
    const rootRect = previewRoot.getBoundingClientRect();
    const previewScale = rootRect.width / activeComposition.width || 1;
    const dx = (event.clientX - selectionDrag.startX) / previewScale;
    const dy = (event.clientY - selectionDrag.startY) / previewScale;
    const patch: ElementOverride =
      selectionDrag.mode === "move"
        ? {
            x: Math.round(selectionDrag.x + dx),
            y: Math.round(selectionDrag.y + dy),
          }
        : {
            scale: Math.max(
              0.05,
              selectionDrag.scale * (1 + (dx + dy) / (2 * selectionDrag.width)),
            ),
          };
    runtime.setOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
  }

  function endSelectionDrag(event: PointerEvent): void {
    if (!selectionDrag || event.pointerId !== selectionDrag.pointerId) return;
    window.removeEventListener("pointermove", updateSelectionDrag);
    if (runtime && selectedId) {
      persistSourceOverride(selectedId, runtime.getOverride(selectedId));
    }
    selectionDrag = null;
    scheduleDraftSave();
    // A release off the stage never produces the click that would clear this.
    if (suppressPreviewClick) {
      setTimeout(() => {
        suppressPreviewClick = false;
      }, 0);
    }
  }

  const SCRUB_FIELDS: Record<
    ScrubProperty,
    { step: number; fallback: number; min?: number }
  > = {
    x: { step: 1, fallback: 0 },
    y: { step: 1, fallback: 0 },
    scale: { step: 0.01, fallback: 1, min: 0.05 },
    rotation: { step: 1, fallback: 0 },
    fontSize: { step: 1, fallback: 16, min: 1 },
    letterSpacing: { step: 0.1, fallback: 0 },
    lineHeight: { step: 1, fallback: 16, min: 1 },
  };

  function scrubStartValue(property: ScrubProperty): number {
    const fallback = SCRUB_FIELDS[property].fallback;
    if (
      property === "fontSize" ||
      property === "letterSpacing" ||
      property === "lineHeight"
    ) {
      return numericStyleValue(property, fallback);
    }
    return currentOverride()[property] ?? fallback;
  }

  /**
   * Drag a field's label left or right to change its value, like the number
   * fields in Figma or After Effects. Shift moves 10x faster, Alt 10x finer.
   */
  function beginNumberScrub(
    event: PointerEvent,
    property: ScrubProperty,
  ): void {
    if (event.button !== 0 || !runtime || !selectedId) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const start = scrubStartValue(property);
    numberScrub = {
      pointerId: event.pointerId,
      property,
      startX: event.clientX,
      start,
      value: start,
    };
  }

  function moveNumberScrub(event: PointerEvent): void {
    if (!numberScrub || event.pointerId !== numberScrub.pointerId) return;
    if (!runtime || !selectedId) return;
    const { step, min } = SCRUB_FIELDS[numberScrub.property];
    const factor = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
    const raw =
      numberScrub.start + (event.clientX - numberScrub.startX) * step * factor;
    const precision = step < 1 || factor < 1 ? 100 : 1;
    const value = Math.max(
      min ?? -Infinity,
      Math.round(raw * precision) / precision,
    );
    if (value === numberScrub.value) return;
    numberScrub.value = value;
    runtime.setOverride(selectedId, {
      [numberScrub.property]: value,
    } as ElementOverride);
    editorRevision += 1;
    updateSelectionRect();
  }

  function endNumberScrub(event: PointerEvent): void {
    if (!numberScrub || event.pointerId !== numberScrub.pointerId) return;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    const { property, value, start } = numberScrub;
    numberScrub = null;
    if (!runtime || !selectedId || value === start) return;
    persistSourceOverride(selectedId, {
      [property]: value,
    } as ElementOverride);
    scheduleDraftSave();
  }

  /** Svelte action: makes a field label a horizontal scrubber. */
  function scrubber(node: HTMLElement, property: ScrubProperty) {
    let current = property;
    const down = (event: PointerEvent) => beginNumberScrub(event, current);
    node.classList.add("me-scrub-handle");
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", moveNumberScrub);
    node.addEventListener("pointerup", endNumberScrub);
    node.addEventListener("pointercancel", endNumberScrub);
    return {
      update(next: ScrubProperty) {
        current = next;
      },
      destroy() {
        node.removeEventListener("pointerdown", down);
        node.removeEventListener("pointermove", moveNumberScrub);
        node.removeEventListener("pointerup", endNumberScrub);
        node.removeEventListener("pointercancel", endNumberScrub);
      },
    };
  }

  function scrubTimeFromPointer(event: PointerEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    return (
      currentTimelineStart +
      Math.max(0, Math.min(1, ratio)) * currentTimelineDuration
    );
  }

  function startScrub(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    scrubbing = true;
    runtime?.pause();
    runtime?.seek(scrubTimeFromPointer(event));
    updateSelectionRect();
  }

  function moveScrub(event: PointerEvent): void {
    if (!scrubbing) return;
    runtime?.seek(scrubTimeFromPointer(event));
    updateSelectionRect();
  }

  function endScrub(event: PointerEvent): void {
    if (!scrubbing) return;
    scrubbing = false;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  function scrubKeydown(event: KeyboardEvent): void {
    const frame = 1 / activeComposition.fps;
    const step = event.shiftKey ? frame * 10 : frame;
    const min = currentTimelineStart;
    const max = currentTimelineStart + currentTimelineDuration - frame;
    const moves: Record<string, number> = {
      ArrowLeft: snapshot.time - step,
      ArrowRight: snapshot.time + step,
      Home: min,
      End: max,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    runtime?.pause();
    runtime?.seek(Math.max(min, Math.min(max, next)));
    updateSelectionRect();
  }

  function selectedScene() {
    return (
      activeComposition.scenes.find((scene) => scene.id === selectedSceneId) ??
      activeComposition.scenes[0]
    );
  }

  function sceneTrackList(
    scene: CompositionDefinition["scenes"][number] | undefined,
    _revision: number,
  ): readonly SceneTrack[] {
    if (!scene) return [];
    return deriveSceneTracks(scene, runtime?.elements, runtime?.timeline);
  }

  function buildTimelineTicks(
    start: number,
    duration: number,
    mode: TimelineMode,
  ): number[] {
    const step = mode === "project" ? 5 : duration > 6 ? 2 : 1;
    const values = Array.from(
      { length: Math.floor(duration / step) + 1 },
      (_, index) => start + index * step,
    );
    if (values.at(-1) !== start + duration) values.push(start + duration);
    return values;
  }

  $: void ensureStagedPreviews(stagedAssets);

  // The ruler, the clips, the scrubber, and the playhead must all read one
  // window. These are plain reactive values, not zero-argument helpers, so the
  // template actually re-renders when the window changes.
  $: activeScene =
    activeComposition.scenes.find((scene) => scene.id === selectedSceneId) ??
    activeComposition.scenes[0];
  $: currentTimelineStart =
    timelineMode === "project" ? 0 : (activeScene?.start ?? 0);
  $: currentTimelineDuration =
    timelineMode === "project"
      ? activeComposition.duration
      : (activeScene?.duration ?? activeComposition.duration);
  $: timelineTickValues = buildTimelineTicks(
    currentTimelineStart,
    currentTimelineDuration,
    timelineMode,
  );
  $: sceneTracks = sceneTrackList(activeScene, editorRevision);

  function timelinePlayheadPosition(): number {
    const start = currentTimelineStart;
    const duration = currentTimelineDuration;
    return Math.max(
      0,
      Math.min(100, ((snapshot.time - start) / duration) * 100),
    );
  }

  function enterScene(scene: CompositionDefinition["scenes"][number]): void {
    const arrivalOffset = scene.id === "brand" ? 0.2 : 1.15;
    const visibleFrame = Math.min(
      scene.start + scene.duration - 1 / activeComposition.fps,
      scene.start + arrivalOffset,
    );
    timelineMode = "scene";
    selectedSceneId = scene.id;
    selectedId = "";
    selectedEditorGroup = null;
    runtime?.seek(visibleFrame);
  }

  function showProjectTimeline(): void {
    timelineMode = "project";
    selectedId = "";
    selectedEditorGroup = null;
  }

  // Track spans are master-timeline seconds, so a lane position is simply the
  // offset into the visible window. Clips are clipped to that window instead of
  // overflowing the lane when a layer animates across a scene boundary.
  function trackLeft(
    track: SceneTrack,
    start: number,
    duration: number,
  ): number {
    const visibleStart = Math.max(track.start, start);
    return Math.max(
      0,
      Math.min(100, ((visibleStart - start) / duration) * 100),
    );
  }

  function trackWidth(
    track: SceneTrack,
    start: number,
    duration: number,
  ): number {
    const visible =
      Math.min(track.end, start + duration) - Math.max(track.start, start);
    return Math.max(
      0.8,
      Math.min(
        100 - trackLeft(track, start, duration),
        (visible / duration) * 100,
      ),
    );
  }

  function sceneLeft(scene: CompositionDefinition["scenes"][number]): number {
    return (scene.start / activeComposition.duration) * 100;
  }

  function sceneWidth(scene: CompositionDefinition["scenes"][number]): number {
    return (scene.duration / activeComposition.duration) * 100;
  }

  // Scenes overlap during handoffs, so each pill runs from its own start to the
  // next scene's start. That keeps pills tiled and aligned with the playhead.
  function sceneBarLeft(
    scene: CompositionDefinition["scenes"][number],
  ): number {
    return (scene.start / activeComposition.duration) * 100;
  }

  function sceneBarWidth(index: number): number {
    const scenes = activeComposition.scenes;
    const scene = scenes[index];
    if (!scene) return 0;
    const end = scenes[index + 1]?.start ?? activeComposition.duration;
    return Math.max(
      0,
      ((end - scene.start) / activeComposition.duration) * 100,
    );
  }

  $: sceneBarProgress = Math.max(
    0,
    Math.min(100, (snapshot.time / activeComposition.duration) * 100),
  );

  function seekToScene(scene: CompositionDefinition["scenes"][number]): void {
    selectedSceneId = scene.id;
    runtime?.seek(scene.start);
    updateSelectionRect();
  }

  function sceneBarTime(event: PointerEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    return Math.max(0, Math.min(1, ratio)) * activeComposition.duration;
  }

  function startSceneBarScrub(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    sceneBarScrubbing = true;
    runtime?.pause();
    runtime?.seek(sceneBarTime(event));
    updateSelectionRect();
  }

  function moveSceneBarScrub(event: PointerEvent): void {
    if (!sceneBarScrubbing) return;
    runtime?.seek(sceneBarTime(event));
    updateSelectionRect();
  }

  function endSceneBarScrub(event: PointerEvent): void {
    if (!sceneBarScrubbing) return;
    sceneBarScrubbing = false;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  function sceneBarKeydown(event: KeyboardEvent): void {
    const frame = 1 / activeComposition.fps;
    const step = event.shiftKey ? frame * 10 : frame;
    const max = activeComposition.duration - frame;
    const moves: Record<string, number> = {
      ArrowLeft: snapshot.time - step,
      ArrowRight: snapshot.time + step,
      Home: 0,
      End: max,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    runtime?.pause();
    runtime?.seek(Math.max(0, Math.min(max, next)));
    updateSelectionRect();
  }

  function selectTrack(track: SceneTrack): void {
    const scene = selectedScene();
    if (!runtime || !scene || !runtime.elements.has(track.id)) {
      showNotice(
        `The ${track.label} layer is not registered in this composition.`,
      );
      return;
    }
    // track.start/end are master-timeline seconds; only move the playhead when
    // it is outside the clip, and keep it inside the scene the user is editing.
    if (snapshot.time < track.start || snapshot.time >= track.end) {
      const previewOffset = Math.min(
        0.15,
        Math.max(0, (track.end - track.start) / 3),
      );
      const sceneEnd = scene.start + scene.duration - 1 / activeComposition.fps;
      const target = Math.min(
        track.end - 1 / activeComposition.fps,
        track.start + previewOffset,
      );
      runtime.seek(
        Math.max(scene.start, Math.min(sceneEnd, Math.max(0, target))),
      );
    }
    selectedId = track.id;
    refreshSelectedEditorGroup();
    updateSelectionRect();
  }

  function selectedTrack(): SceneTrack | undefined {
    if (!selectedId) return undefined;
    return activeComposition.scenes
      .flatMap((scene) => scene.tracks ?? [])
      .find((track) => track.id === selectedId);
  }

  function currentOverride(_revision = editorRevision): ElementOverride {
    void _revision;
    return selectedId && runtime ? runtime.getOverride(selectedId) : {};
  }

  function selectedTextTarget(): HTMLElement | null {
    if (!runtime || !selectedId) return null;
    const element = runtime.elements.get(selectedId);
    if (!element) return null;
    const declaredTarget = selectedEditorGroup
      ? editorGroupTextTarget(selectedEditorGroup)
      : null;
    if (declaredTarget) return declaredTarget;
    if (
      element.dataset["motionlySplitUnit"] ||
      element.querySelector(".motionly-text-motion-layer, .motionly-split-item")
    ) {
      return element;
    }
    if (textElementTags.has(element.tagName)) return element;
    const innerTextTags = element.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, h5, h6, p, .editorial-thought",
    );
    if (innerTextTags.length === 1 && innerTextTags[0]) return innerTextTags[0];
    if (
      !element.querySelector(
        "div, section, article, table, ul, ol, img, svg",
      ) &&
      Boolean(element.textContent?.trim())
    ) {
      return element;
    }
    return selectedTrack()?.kind === "Text" ? element : null;
  }

  function isTextEditable(): boolean {
    return selectedTextTarget() !== null;
  }

  function editableTextValue(): string {
    if (!runtime || !selectedId) return "";
    const override = currentOverride().text;
    if (override !== undefined) return override;
    return (runtime.elements.get(selectedId)?.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isSvgSelected(): boolean {
    if (!runtime || !selectedId) return false;
    return runtime.elements.get(selectedId) instanceof SVGElement;
  }

  type ColorProperty = "color" | "backgroundColor" | "fill" | "stroke";

  function normalizedColor(value: string, fallback: string): string {
    const hex = /^#([\da-f]{6})$/i.exec(value.trim());
    if (hex) return `#${hex[1]}`;
    const rgb = /^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?\s*\)$/i.exec(
      value,
    );
    if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) === 0)) return fallback;
    return `#${[rgb[1], rgb[2], rgb[3]]
      .map((channel) => Number(channel).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function colorValue(
    property: ColorProperty,
    fallback: string,
    _revision = editorRevision,
  ): string {
    void _revision;
    const override = currentOverride(_revision)[property];
    if (typeof override === "string")
      return normalizedColor(override, fallback);
    const element =
      property === "color"
        ? selectedTextTarget()
        : selectedId
          ? runtime?.elements.get(selectedId)
          : undefined;
    if (!element) return fallback;
    const style = getComputedStyle(element);
    return normalizedColor(style[property], fallback);
  }

  function isBackgroundTransparent(_revision = editorRevision): boolean {
    void _revision;
    if (!runtime || !selectedId) return true;
    const override = currentOverride(_revision).backgroundColor;
    if (override === "transparent") return true;
    if (typeof override === "string" && override.trim()) {
      return (
        override.trim() === "transparent" ||
        override.trim() === "rgba(0, 0, 0, 0)"
      );
    }
    const element = selectedId ? runtime.elements.get(selectedId) : undefined;
    if (!element) return true;
    const bg = getComputedStyle(element).backgroundColor;
    if (!bg || bg === "transparent") return true;
    const rgb = /^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?\s*\)$/i.exec(
      bg,
    );
    return Boolean(rgb && rgb[4] !== undefined && Number(rgb[4]) === 0);
  }

  function effectiveBackgroundColorHex(_revision = editorRevision): string {
    void _revision;
    const override = currentOverride(_revision).backgroundColor;
    if (override && override !== "transparent") {
      return normalizedColor(override, "#17191c");
    }
    const element = selectedId ? runtime?.elements.get(selectedId) : undefined;
    if (!element) return "#17191c";
    const bg = getComputedStyle(element).backgroundColor;
    return normalizedColor(bg, "#17191c");
  }

  function addBackground(): void {
    if (!runtime || !selectedId) return;
    const patch: ElementOverride = {
      backgroundColor: "#17191c",
      borderRadius: numericStyleValue("borderRadius", 8) || 8,
    };
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
    scheduleDraftSave();
  }

  function clearBackground(): void {
    if (!runtime || !selectedId) return;
    const patch: ElementOverride = { backgroundColor: "transparent" };
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
    scheduleDraftSave();
  }

  function numericStyleValue(
    property: "fontSize" | "borderRadius" | "letterSpacing" | "lineHeight",
    fallback: number,
    _revision = editorRevision,
  ): number {
    void _revision;
    const override = currentOverride(_revision)[property];
    if (typeof override === "number") return override;
    const element =
      property === "borderRadius"
        ? selectedId
          ? runtime?.elements.get(selectedId)
          : undefined
        : selectedTextTarget();
    if (!element) return fallback;
    const parsed = Number.parseFloat(getComputedStyle(element)[property]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function stringStyleValue(
    property: "fontFamily" | "fontWeight" | "fontStyle" | "textAlign",
    fallback: string,
  ): string {
    const override = currentOverride()[property];
    if (typeof override === "string" && override.trim()) return override;
    const element = selectedTextTarget();
    if (!element) return fallback;
    return getComputedStyle(element)[property] || fallback;
  }

  function setNumber(property: keyof ElementOverride, event: Event): void {
    if (!runtime || !selectedId) return;
    const patch = {
      [property]: Number((event.currentTarget as HTMLInputElement).value),
    } as ElementOverride;
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
    scheduleDraftSave();
  }

  function setString(property: keyof ElementOverride, event: Event): void {
    if (!runtime || !selectedId) return;
    const patch = {
      [property]: (event.currentTarget as HTMLInputElement | HTMLSelectElement)
        .value,
    } as ElementOverride;
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
    scheduleDraftSave();
  }

  function setText(event: Event): void {
    if (!runtime || !selectedId) return;
    const patch = { text: (event.currentTarget as HTMLInputElement).value };
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
    scheduleDraftSave();
  }

  function setColor(property: ColorProperty, event: Event): void {
    if (!runtime || !selectedId) return;
    const patch = {
      [property]: (event.currentTarget as HTMLInputElement).value,
    } as ElementOverride;
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
    scheduleDraftSave();
  }

  function toggleSelectedLayer(): void {
    if (!runtime || !selectedId) return;
    const patch = { hidden: !currentOverride().hidden };
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
    scheduleDraftSave();
  }

  function editorFieldInputValue(field: EditorFieldDefinition): string {
    void editorRevision;
    const value = editorFieldValue(field);
    if (field.type === "color") return normalizedColor(value, "#111318");
    if (field.type === "number" || field.type === "range") {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? String(parsed) : "0";
    }
    return value;
  }

  function writeEditorFieldToSource(
    fieldId: string,
    value: string | boolean,
  ): void {
    if (!selectedId) return;
    const documentSource = new DOMParser().parseFromString(
      cloudFiles["composition.html"],
      "text/html",
    );
    const template = documentSource.querySelector("template");
    const scope: ParentNode = template?.content ?? documentSource;
    const groupElement = Array.from(
      scope.querySelectorAll<HTMLElement>("[data-edit]"),
    ).find((element) => element.dataset["edit"] === selectedId);
    if (!groupElement) return;
    const sourceField = readEditorGroup(selectedId, groupElement).fields.find(
      (candidate) => candidate.id === fieldId,
    );
    if (!sourceField) return;
    applyEditorField(sourceField, value);
    cloudFiles = {
      ...cloudFiles,
      "composition.html":
        template?.outerHTML ?? documentSource.body.innerHTML.trim(),
    };
    sourceDirty = true;
    cloudProjects?.setFiles(cloudFiles);
    scheduleDraftSave();
  }

  function changeEditorField(field: EditorFieldDefinition, event: Event): void {
    const input = event.currentTarget as HTMLInputElement | HTMLSelectElement;
    const value =
      input instanceof HTMLInputElement && input.type === "checkbox"
        ? input.checked
        : input.value;
    applyEditorField(field, value);
    writeEditorFieldToSource(field.id, value);
    editorRevision += 1;
    updateSelectionRect();
  }

  async function replaceEditorImage(
    field: EditorFieldDefinition,
    event: Event,
  ): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    uploadingMedia = true;
    uploadProgress = 0;
    beginUploadPreview(file, file.name);
    try {
      const reference = await storeLocalAsset(file, file.name);
      if (workspaceId) {
        reference.uploadId = await uploadAsset(
          workspaceId,
          file,
          (percentage) => (uploadProgress = percentage),
        );
        reference.token = `motify-asset://${reference.uploadId}`;
      }
      stagedAssets = [...stagedAssets, reference];
      const objectUrl = URL.createObjectURL(file);
      assetObjectUrls.push(objectUrl);
      applyEditorField(field, objectUrl);
      writeEditorFieldToSource(field.id, reference.token);
      editorRevision += 1;
      updateSelectionRect();
      showNotice(`${file.name} replaced and saved locally.`);
    } finally {
      uploadingMedia = false;
      uploadProgress = 0;
      clearUploadPreview();
      input.value = "";
      scheduleDraftSave();
    }
  }

  function timecode(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = time - minutes * 60;
    return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
  }

  function openPage(next: HomePage): void {
    profileMenuOpen = false;
    // With no video open the create page is the default view.
    page = next === "create" ? null : next;
    // Inside a video a page is a picker over it, and the URL stays the video's.
    if (mode === "cloud" && !hasEditorProject) navigate(homePagePath(page));
  }

  // The gallery is one instance (it also holds the open project), drawn into
  // the My Videos page while that page is showing.
  $: galleryHost = centerPage === "videos" ? videosHost : null;
  $: if (galleryHost && cloudProjects) void cloudProjects.openManager();
  $: if (centerPage !== "videos") cloudProjects?.closeManager();

  async function copySupportEmail(): Promise<void> {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      supportEmailCopied = true;
      window.setTimeout(() => (supportEmailCopied = false), 2000);
    } catch {
      showNotice(`Email us at ${SUPPORT_EMAIL}.`);
    }
  }

  function closeProfileMenu(event: PointerEvent): void {
    if (profileMenuOpen && !profileMenu?.contains(event.target as Node)) {
      profileMenuOpen = false;
    }
  }

  function handleSidebarNavigation(
    event: CustomEvent<{
      workspaceId: string;
      workspaces: WorkspaceSummary[];
      projects: ProjectSummary[];
    }>,
  ): void {
    sidebarProjects = event.detail.projects;
    recentsLoaded = true;
  }

  /** Reads the person's Brand DNA; null for a guest or when it cannot be read. */
  async function loadBrand(): Promise<BrandResource | null> {
    if (mode !== "cloud" || !currentUser) return null;
    try {
      brand = await new ProjectsApi().getBrand();
      return brand;
    } catch {
      return null;
    }
  }

  /** Brand DNA belongs to the person, so its page takes no workspace. */
  function openBrandKit(): void {
    window.open(BRAND_ROUTE, "_blank", "noopener,noreferrer");
  }

  function openRecentProject(projectId: string): void {
    void cloudProjects?.openProjectById(projectId);
  }

  function useLibraryAsset(asset: WorkspaceAsset): void {
    if (stagedAssets.some((candidate) => candidate.uploadId === asset.id)) {
      showNotice(
        `${asset.label || asset.fileName} is already in the next prompt.`,
      );
      openPage("create");
      return;
    }
    stagedAssets = [
      ...stagedAssets,
      {
        id: asset.id,
        uploadId: asset.id,
        name: asset.label || asset.fileName,
        mimeType: asset.contentType,
        token: `motify-asset://${asset.id}`,
        intent: "asset",
      },
    ];
    openPage("create");
    showNotice(`${asset.label || asset.fileName} added to the next prompt.`);
  }

  function openLocalPanel(tab: "presets" | "source" | "assets"): void {
    sourceOpen = tab === "source";
    localPanelView = tab;
    localPanelOpen = true;
  }

  function openTimelineSource(): void {
    sourceOpen = true;
    showNotice("Opened the HTML source for the active GSAP composition.");
  }

  async function handlePaste(event: ClipboardEvent): Promise<void> {
    if (!event.clipboardData) return;
    let file: File | null = null;
    for (const item of event.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        file = item.getAsFile();
        break;
      }
    }
    if (file) await stageAsset(file, "Pasted image");
  }

  async function handleMediaUpload(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      if (isAudioFile(file)) await addAudioFile(file);
      else await stageAsset(file, file.name);
    }
    input.value = "";
  }

  /**
   * Adds a song to the workspace's music library and picks it for the next
   * message, so "drop a song, describe the film" is one motion.
   */
  async function addAudioFile(file: File): Promise<void> {
    if (!workspaceId) {
      showNotice("Sign in to add music.");
      return;
    }
    uploadingMedia = true;
    uploadProgress = 0;
    uploadName = file.name;
    showNotice(`Adding ${file.name}...`);
    try {
      const track = await addTrackToLibrary(
        musicApi,
        workspaceId,
        file,
        (percentage) => (uploadProgress = percentage),
      );
      void refreshMusicLibrary(musicApi, workspaceId);
      const selected = selectAudioTrack(track);
      captureEvent("media uploaded", { file_type: "audio" });
      showNotice(
        selected
          ? `${track.title} is ready to score your next prompt.`
          : `${track.title} was added to your library. A message can use up to ${MAX_SELECTED_AUDIO} songs.`,
      );
    } catch (error: unknown) {
      showNotice(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      uploadingMedia = false;
      uploadProgress = 0;
      uploadName = "";
    }
  }

  /** Songs and images dropped on the chat; anything else is turned away. */
  async function handleChatDrop(files: File[]): Promise<void> {
    for (const file of files) {
      if (isAudioFile(file)) await addAudioFile(file);
      else if (file.type.startsWith("image/"))
        await stageAsset(file, file.name);
      else showNotice(`${file.name} is not an image or an audio file.`);
    }
  }

  /** Picking a song in the music panel sends you back to the prompt it is for. */
  function useAudioTrack(track: AudioTrack): void {
    if (!selectAudioTrack(track)) {
      showNotice(`A message can use up to ${MAX_SELECTED_AUDIO} songs.`);
      return;
    }
    openPage("create");
    showNotice(`${track.title} will score your next prompt.`);
    void tick().then(() => composerInput?.focus());
  }

  /**
   * Takes a song out of the film: the project stops being scored to it, its
   * player leaves the source, and the change is saved. Detaching comes first,
   * so a failed save can only leave a stale tag for the next generation to
   * drop, never a track the model is told it must use.
   */
  async function removeAudioFromProject(track: AudioTrack): Promise<void> {
    const projectId = cloudProject?.id ?? backendGenerationProjectId;
    if (!projectId) return;
    await musicApi.detachProjectAudio(projectId, track.id);
    void refreshProjectAudio(musicApi, projectId);
    const html = cloudFiles["composition.html"];
    const stripped = removeAudioTrackFromComposition(html, track.id);
    if (stripped === html) {
      showNotice(`${track.title} removed from this project.`);
      return;
    }
    cloudFiles = { ...cloudFiles, "composition.html": stripped };
    const hydrated = await hydrateGenerationAssets(
      hydratePresetAssets(combineCompositionSource(cloudFiles)),
    );
    const previousObjectUrls = assetObjectUrls;
    mountComposition(
      createDynamicComposition(hydrated.source, cloudFiles["timeline.js"], {
        id: activeComposition.id,
        title: activeComposition.title,
        width: activeComposition.width,
        height: activeComposition.height,
        fps: activeComposition.fps,
        duration: activeComposition.duration,
        scenes: activeComposition.scenes,
      }),
      runtime?.exportEditorState(),
    );
    assetObjectUrls = hydrated.objectUrls;
    previousObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    await saveSource();
    showNotice(`${track.title} removed from the film.`);
  }

  async function ensureStagedPreviews(
    assets: readonly LocalAssetReference[],
  ): Promise<void> {
    for (const asset of assets) {
      if (stagedPreviews[asset.id]) continue;
      try {
        const blob = await readLocalAsset(asset.id);
        if (!blob && asset.uploadId) {
          const cloudPreview = await hydrateCloudAssetTokens(asset.token);
          stagedPreviews = {
            ...stagedPreviews,
            [asset.id]: cloudPreview.source,
          };
          continue;
        }

        if (!blob) continue;
        stagedPreviews = {
          ...stagedPreviews,
          [asset.id]: URL.createObjectURL(blob),
        };
      } catch {
        // The chip still renders with its filename if the thumbnail fails.
      }
    }
  }

  async function hydrateGenerationAssets(source: string): Promise<{
    source: string;
    objectUrls: string[];
  }> {
    const local = await hydrateAssetTokens(source, stagedAssets);
    const cloud = await hydrateCloudAssetTokens(local.source);
    return {
      source: cloud.source,
      objectUrls: [...local.objectUrls, ...cloud.objectUrls],
    };
  }

  /**
   * An image the user has not yet told us the purpose of. The prompt is held
   * until they do, because a screenshot used as a reference and a logo used as
   * an asset produce opposite instructions to the model.
   */
  $: openProjectId = cloudProject?.id ?? (backendGenerationProjectId || "");
  $: if (mode === "cloud") {
    void refreshProjectAudio(musicApi, openProjectId || null);
  }

  $: pendingAssets = stagedAssets.filter((asset) => !asset.intent);
  $: classifiedAssets = stagedAssets.filter((asset) => asset.intent);

  async function classifyStagedAsset(
    asset: LocalAssetReference,
    intent: AssetIntent,
  ): Promise<void> {
    if (cloudProject && asset.uploadId) {
      await new ProjectsApi().attachProjectAsset(
        cloudProject.id,
        asset.uploadId,
        intent,
      );
    }
    stagedAssets = stagedAssets.map((item) =>
      item.id === asset.id ? { ...item, intent } : item,
    );
    captureEvent("asset intent chosen", { intent });
    showNotice(
      intent === "reference"
        ? `${asset.name} kept as a reference — it will be matched, not placed on screen.`
        : `${asset.name} moved into project media — it will appear in the film.`,
    );
    scheduleDraftSave();
  }

  async function removeStagedAsset(asset: LocalAssetReference): Promise<void> {
    if (cloudProject && asset.uploadId) {
      await new ProjectsApi().detachProjectAsset(
        cloudProject.id,
        asset.uploadId,
      );
    }
    stagedAssets = stagedAssets.filter((item) => item.id !== asset.id);
    const preview = stagedPreviews[asset.id];
    if (preview) {
      URL.revokeObjectURL(preview);
      const next = { ...stagedPreviews };
      delete next[asset.id];
      stagedPreviews = next;
    }
    showNotice(`${asset.name} will not be sent with the next prompt.`);
    scheduleDraftSave();
  }

  /**
   * A preset is not the user's project: its images, chat, and directorial plan
   * must not ride along into the next generation.
   */
  function resetAssistantSession(): void {
    projectStarted = true;
    Object.values(stagedPreviews).forEach((url) => URL.revokeObjectURL(url));
    stagedPreviews = {};
    stagedAssets = [];
    selectedAudio.set([]);
    assistantMessages = [];
    assistantDraft = "";
    generationPlan = null;
  }

  function beginUploadPreview(file: File, name: string): void {
    clearUploadPreview();
    uploadPreview = URL.createObjectURL(file);
    uploadName = name;
  }

  function clearUploadPreview(): void {
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    uploadPreview = null;
    uploadName = "";
  }

  async function stageAsset(file: File, name: string): Promise<void> {
    uploadingMedia = true;
    uploadProgress = 0;
    beginUploadPreview(file, name);
    showNotice(`Adding ${name}...`);
    try {
      const reference = await storeLocalAsset(file, name);
      if (workspaceId) {
        reference.uploadId = await uploadAsset(
          workspaceId,
          file,
          (percentage) => (uploadProgress = percentage),
        );
        reference.token = `motify-asset://${reference.uploadId}`;
      }
      stagedAssets = [...stagedAssets, reference];
      captureEvent("media uploaded", {
        file_type: file.type.split("/")[0] || "unknown",
      });
      showNotice(`${name} is ready for the next prompt.`);
      scheduleDraftSave();
    } catch (error: unknown) {
      showNotice(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      uploadingMedia = false;
      uploadProgress = 0;
      clearUploadPreview();
    }
  }

  function assistantGenerationBasis(ai: GenerationPipeline): GenerationBasis & {
    editorState?: Partial<RuntimeEditorState>;
  } {
    const basis = ai.resolveGenerationBasis(cloudFiles, activeComposition);
    if (basis.generationProfile === "claude-foundation-v1") return basis;
    return { ...basis, editorState: runtime?.exportEditorState() };
  }

  async function generateAndApplyAssistant(prompt: string): Promise<string> {
    projectStarted = true;
    // Read fresh so an edit made on the Brand DNA page is used right away. A
    // brand that cannot be read must not block generation; the copy loaded
    // earlier is still useful when there is one.
    const [ai, loadedBrand] = await Promise.all([
      loadGenerationPipeline(),
      loadBrand(),
    ]);
    const generationBrand = loadedBrand ?? brand;
    const basis = assistantGenerationBasis(ai);
    if (!cloudProject && !backendGenerationProjectId && workspaceId) {
      const created = await new ProjectsApi().createProject(workspaceId, {
        name: "Untitled Motionly Project",
        width: activeComposition.width,
        height: activeComposition.height,
        fps: activeComposition.fps,
        duration: basis.duration,
        files: basis.files,
      });
      cloudProject = created;
      backendGenerationProjectId = created.id;
      await cloudProjects?.registerActiveProject(created);
      setProjectRoute(created.id, true);
    }
    const currentHtml = combineCompositionSource(basis.files);
    const currentJs = basis.files["timeline.js"] || "";
    const cloudGeneration = Boolean(cloudProject || backendGenerationProjectId);
    const generationAssets = await Promise.all(
      (assetsInFlight ?? stagedAssets).map((asset) =>
        cloudGeneration && asset.uploadId
          ? Promise.resolve({ ...asset, dataBase64: "" })
          : generationAsset(asset),
      ),
    );
    /**
     * Mount, seek and judge one candidate. This runs inside the generation
     * loop, once per pass, so what the frames actually show drives a repair
     * instead of surfacing to the user as an error with a Fix button.
     *
     * Successful validations are kept, keyed by the source they came from, so
     * the pass that ships is not mounted a second time.
     */
    const validations = new Map<string, ValidatedGeneration>();
    const renderKey = (candidate: DirectAiResult): string =>
      `${candidate.compositionHtml}\u0000${candidate.timelineJs}`;
    const validateCandidate = async (
      candidate: DirectAiResult,
      lenient = false,
    ): Promise<ValidatedGeneration> => {
      const rendered = await hydrateGenerationAssets(
        hydratePresetAssets(candidate.compositionHtml),
      );
      try {
        return ai.validateGeneratedComposition(candidate, {
          prompt,
          previousHtml: currentHtml,
          previousDuration: basis.duration,
          previousScenes: basis.scenes,
          requiredAssetTokens: generationAssets
            .filter((asset) => asset.intent === "asset")
            .map((asset) => asset.token),
          renderedHtml: rendered.source,
          generationProfile: basis.generationProfile,
          userEditedIds: ai.userEditedIds(basis.editorState),
          lenient,
        });
      } finally {
        rendered.objectUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    };

    const generationPrompt =
      generationBrand && generationBrand.revision > 0
        ? `${brandGenerationBrief(generationBrand)}\n\nUSER REQUEST:\n${prompt}`
        : prompt;
    const result = await ai.generateWithDirectAi(
      generationPrompt,
      {
        backendProjectId:
          cloudProject?.id ?? (backendGenerationProjectId || undefined),
        compositionHtml: currentHtml,
        timelineJs: currentJs,
        stylesCss: basis.files["styles.css"],
        indexTs: basis.files["index.ts"],
        conversation: assistantMessages,
        editorState: basis.editorState,
        assets: generationAssets,
        audioTrackIds: (audioInFlight ?? $selectedAudio).map(
          (track) => track.id,
        ),
        generationProfile: basis.generationProfile,
        previousPlan: generationPlan ?? undefined,
      },
      (statusMsg) => {
        generationStore.update((state) => ({
          ...state,
          message: statusMsg,
        }));
      },
      async (candidate) => {
        try {
          validations.set(
            renderKey(candidate),
            await validateCandidate(candidate),
          );
          return { ok: true as const };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            ok: false as const,
            message,
            fatal: ai.isFatalRenderFailure(message),
          };
        }
      },
      /**
       * Look at the film a repair pass is about to rewrite. The loop calls
       * this only when it is going to spend a pass, and hands over the very
       * complaints that pass will carry, so what comes back answers the
       * question the prompt is asking.
       */
      async (candidate, complaints) => {
        const rendered = await hydrateGenerationAssets(
          hydratePresetAssets(candidate.compositionHtml),
        );
        try {
          return await ai.observeCandidateFilm({
            renderedHtml: rendered.source,
            timelineJs: candidate.timelineJs,
            title: candidate.title,
            duration: Number(candidate.duration) || basis.duration,
            scenes: candidate.scenes,
            complaints,
          });
        } finally {
          rendered.objectUrls.forEach((url) => URL.revokeObjectURL(url));
        }
      },
    );

    const hydrated = await hydrateGenerationAssets(
      hydratePresetAssets(result.compositionHtml),
    );
    /**
     * The winning pass, mounted once more only if the loop never got a clean
     * validation for it. That second look runs lenient: the loop already spent
     * its repair passes on whatever is still open, so a directorial fault comes
     * back as a note on a film the user can watch rather than an error over an
     * empty canvas.
     */
    const validated =
      validations.get(renderKey(result)) ??
      (await validateCandidate(result, true));
    const title = result.title || "AI Generated Video";
    const adapter = createGeneratedAdapterSource({
      id: activeComposition.id,
      title,
      duration: validated.duration,
      scenes: validated.scenes,
      width: activeComposition.width,
      height: activeComposition.height,
      fps: activeComposition.fps,
    });
    cloudFiles = splitCompositionSource(
      result.compositionHtml,
      result.timelineJs,
      adapter,
    );
    cloudProjects?.setFiles(cloudFiles);
    backendGenerationProjectId =
      result.backendProjectId ?? backendGenerationProjectId;
    if (backendGenerationProjectId) {
      try {
        const latestProject = await new ProjectsApi().getProject(
          backendGenerationProjectId,
        );
        cloudProject = latestProject;
        await cloudProjects?.registerActiveProject(latestProject);
        setProjectRoute(latestProject.id, true);
      } catch {
        // The generated source is usable even if refreshing its gallery card fails.
      }
    }

    const previousObjectUrls = assetObjectUrls;
    const dynamicComp = createDynamicComposition(
      hydrated.source,
      cloudFiles["timeline.js"],
      {
        duration: validated.duration,
        title,
        scenes: validated.scenes,
      },
    );
    mountComposition(
      dynamicComp,
      carryEditorState(
        basis.editorState,
        { html: currentHtml, timelineJs: currentJs },
        { html: result.compositionHtml, timelineJs: result.timelineJs },
      ),
    );
    assetObjectUrls = hydrated.objectUrls;
    previousObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    generationPlan = {
      title,
      subject: prompt,
      duration: validated.duration,
      direction: result.direction,
      seams: result.seams,
      techniques: result.techniques,
    };
    runtime?.seek(0);
    runtime?.play();
    scheduleDraftSave();
    if (validated.warnings.length === 0) return result.reply;
    return `${result.reply}\n\nDirection note: ${validated.warnings.join(" ")}`;
  }

  function buildRepairInstruction(
    errorMessage: string,
    lastPrompt: string,
  ): string {
    return lastPrompt
      ? `The previous generation failed this runtime or quality check: "${errorMessage}".\n\nRegenerate the complete composition for: "${lastPrompt}". Preserve the conversation and supplied images, repair the actual visual/runtime failure, and return strictly valid JSON.`
      : `The previous generation failed this runtime or quality check: "${errorMessage}". Repair it and return a complete valid composition.`;
  }

  /**
   * A backend chat/plan turn answers with words instead of a film and reaches
   * here as a thrown `BackendConversationResponse` rather than a return value
   * — unwrap that into the reply text instead of treating it as a failure.
   */
  async function generateOrBackendReply(prompt: string): Promise<string> {
    try {
      return await generateAndApplyAssistant(prompt);
    } catch (error: unknown) {
      const { BackendConversationResponse } = await loadGenerationPipeline();
      if (error instanceof BackendConversationResponse) {
        backendGenerationProjectId =
          error.projectId ?? backendGenerationProjectId;
        return error.response;
      }
      throw error;
    }
  }

  /**
   * The composer starts one line tall and grows with the draft, but only to the
   * point where it still leaves the conversation readable; past that it scrolls
   * instead of eating the panel.
   */
  const COMPOSER_MAX_HEIGHT = 132;

  function resizeComposer(): void {
    if (!composerInput) return;
    composerInput.style.height = "auto";
    composerInput.style.height = `${Math.min(
      composerInput.scrollHeight,
      COMPOSER_MAX_HEIGHT,
    )}px`;
  }

  /** Enter sends, Shift+Enter starts a new line, as in every chat composer. */
  function composerKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!assistantDraft.trim() || $generationStore.isActive || uploadingMedia)
      return;
    void submitAssistant(new SubmitEvent("submit"));
  }

  /**
   * Generation runs against the signed-in user's workspace, so a prompt from a
   * guest is held rather than dropped: the composer keeps its text, the sign-in
   * dialog opens, and the same prompt is sent the moment the session exists.
   */
  function requireAccount(prompt: string): boolean {
    if (mode !== "cloud" || currentUser) return true;
    promptHeldForAuth = prompt;
    // Signing in with Google leaves the page, so the held prompt is parked
    // where a landing prompt already waits and is picked up on the way back.
    sessionStorage.setItem("motionly_pending_prompt", prompt);
    authDialogMode = "signin";
    authDialogOpen = true;
    return false;
  }

  function openAuthDialog(next: "signin" | "signup" = "signin"): void {
    authDialogMode = next;
    authDialogOpen = true;
  }

  async function handleAuthenticated(user: MotionlyUser): Promise<void> {
    currentUser = user;
    authChecked = true;
    identifyAnalyticsUser(user);
    void refreshCredits();
    await cloudProjects?.refreshSession();
    void refreshActivePlan();
    void loadBrand();
    const held = promptHeldForAuth;
    promptHeldForAuth = "";
    if (held) {
      sessionStorage.removeItem("motionly_pending_prompt");
      pendingLandingPrompt = "";
      assistantDraft = held;
      await tick();
      await submitAssistant(new SubmitEvent("submit"));
    }
  }

  function cancelAuthDialog(): void {
    if (promptHeldForAuth) sessionStorage.removeItem("motionly_pending_prompt");
    promptHeldForAuth = "";
  }

  async function signOutOfMotify(): Promise<void> {
    try {
      await signOut();
    } catch {
      // A revoked or expired session is already signed out as far as the
      // editor is concerned.
    }
    currentUser = null;
    activePlan = null;
    brand = null;
    profileMenuOpen = false;
    if (!hasEditorProject) openPage("create");
    else page = null;
    resetCredits();
    await cloudProjects?.refreshSession();
    showNotice("Signed out of Motify.");
  }

  /**
   * The backend saves an edit inside the message request, before the editor
   * has fetched, judged and mounted it. Anything that fails after that save —
   * a gateway dropping the long request, a stricter client-side check — used
   * to leave the preview on the old film while the project already held the
   * new one, until the user reloaded. When the saved revision moved past the
   * one on screen, mount what was saved. The conversation is kept.
   */
  /** Polls for a save the backend finished after the connection dropped. */
  async function waitForBackgroundGeneration(): Promise<boolean> {
    const projectId = cloudProject?.id ?? backendGenerationProjectId;
    if (!projectId) return false;
    const shownRevision = cloudProject?.revision ?? 0;
    generationStore.update((state) => ({
      ...state,
      message:
        "Still finishing your video — this one is taking a little longer…",
    }));
    const recovered = await waitForSavedGeneration({
      check: () => recoverSavedGeneration(shownRevision),
      stillCurrent: () =>
        (cloudProject?.id ?? backendGenerationProjectId) === projectId,
    });
    if (recovered) void refreshCredits();
    return recovered;
  }

  async function recoverSavedGeneration(
    shownRevision = cloudProject?.revision ?? 0,
  ): Promise<boolean> {
    const projectId = cloudProject?.id ?? backendGenerationProjectId;
    if (!projectId) return false;
    try {
      const api = new ProjectsApi();
      const latestProject = await api.getProject(projectId);
      if (latestProject.revision <= shownRevision) return false;
      const source = await api.getSource(projectId);
      const files = splitCompositionSource(
        source["composition.html"],
        source["timeline.js"],
        cloudFiles["index.ts"],
      );
      const hydrated = await hydrateGenerationAssets(
        hydratePresetAssets(combineCompositionSource(files)),
      );
      cloudFiles = files;
      cloudProject = latestProject;
      backendGenerationProjectId = latestProject.id;
      cloudProjects?.setFiles(files);
      await cloudProjects?.registerActiveProject(latestProject);
      const previousObjectUrls = assetObjectUrls;
      // No editor state: overrides from before the edit would mask it.
      mountComposition(
        createDynamicComposition(hydrated.source, files["timeline.js"], {
          id: latestProject.id,
          title: latestProject.name,
          width: latestProject.width,
          height: latestProject.height,
          fps: latestProject.fps,
          duration: latestProject.duration,
          scenes: latestProject.scenes,
        }),
      );
      assetObjectUrls = hydrated.objectUrls;
      previousObjectUrls.forEach((url) => URL.revokeObjectURL(url));
      runtime?.seek(0);
      scheduleDraftSave();
      return true;
    } catch {
      // Nothing newer could be loaded; the original error stands.
      return false;
    }
  }

  /**
   * `scoped` sends an edit for one canvas element: the chat shows what the
   * user typed while Tiffy receives it with the element's identity attached.
   */
  async function submitAssistant(
    event: SubmitEvent,
    scoped?: { text: string; prompt: string },
  ): Promise<void> {
    event.preventDefault();
    const shownText = (scoped?.text ?? assistantDraft).trim();
    const prompt = (scoped?.prompt ?? assistantDraft).trim();
    if (!prompt || $generationStore.isActive) return;
    if (!requireAccount(prompt)) return;
    lastSentPrompt = { text: shownText, prompt };
    // The first prompt turns the create page into this video's chat.
    projectStarted = true;
    page = null;

    const sentAudio = $selectedAudio;
    const sentAttachments: MessageAttachment[] = [
      ...stagedAssets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        ...(stagedPreviews[asset.id]
          ? { previewUrl: stagedPreviews[asset.id] }
          : {}),
        ...(asset.intent ? { intent: asset.intent } : {}),
      })),
      ...sentAudio.map((track) => ({
        id: track.id,
        name: track.title,
        kind: "audio" as const,
      })),
    ];
    assistantMessages = [
      ...assistantMessages,
      {
        role: "user",
        text: shownText,
        ...(sentAttachments.length ? { attachments: sentAttachments } : {}),
      },
    ];
    scheduleDraftSave();
    if (!scoped) assistantDraft = "";
    assetsInFlight = stagedAssets.length ? [...stagedAssets] : null;
    stagedAssets = [];
    audioInFlight = sentAudio.length ? [...sentAudio] : null;
    selectedAudio.set([]);
    await tick();
    resizeComposer();

    const generationStartedAt = performance.now();
    captureEvent("ai generation started", { prompt_length: prompt.length });
    generationStore.set({
      isActive: true,
      status: "GENERATING",
      stage: "GENERATING",
      progress: 20,
      message: "Tiffy is reading your prompt...",
    });

    try {
      const reply = await generateOrBackendReply(prompt);
      generationStore.set({
        isActive: false,
        status: "COMPLETED",
        stage: "COMPLETED",
        progress: 100,
        message: reply,
      });
      captureEvent("ai generation completed", {
        duration_ms: Math.round(performance.now() - generationStartedAt),
        reference_asset_count: sentAttachments.length,
      });
      showNotice(withCreditCost("Tiffy updated the composition."));
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "AI generation failed.";
      const recovered = mayStillBeRunning(err)
        ? await waitForBackgroundGeneration()
        : await recoverSavedGeneration();
      if (recovered) {
        const recoveredMessage =
          "Your change was saved. I loaded the latest version into the preview.";
        generationStore.set({
          isActive: false,
          status: "COMPLETED",
          stage: "COMPLETED",
          progress: 100,
          message: recoveredMessage,
        });
        captureEvent("ai generation recovered", {
          duration_ms: Math.round(performance.now() - generationStartedAt),
          error_type: err instanceof Error ? err.name : "unknown",
        });
        showNotice("Tiffy updated the composition.");
        return;
      }
      captureEvent("ai generation failed", {
        duration_ms: Math.round(performance.now() - generationStartedAt),
        error_type: err instanceof Error ? err.name : "unknown",
      });
      generationStore.set({
        isActive: false,
        status: "FAILED",
        stage: "FAILED",
        progress: 0,
        message: "",
        error: errorMsg,
      });
      const formattedError = failureMessage(err, errorMsg);
      if (assistantMessages.at(-1)?.text !== formattedError) {
        assistantMessages = [
          ...assistantMessages,
          { role: "assistant", text: formattedError },
        ];
      }
      showNotice(isRetryMessage(formattedError) ? formattedError : errorMsg);
    } finally {
      assetsInFlight = null;
      audioInFlight = null;
      // The backend attaches songs when a message arrives, whether it answered
      // with a film or only a reply, so the project's list is reread either way.
      void refreshProjectAudio(
        musicApi,
        cloudProject?.id ?? (backendGenerationProjectId || null),
      );
    }
  }

  async function toggleElementPrompt(): Promise<void> {
    elementPromptOpen = !elementPromptOpen;
    if (!elementPromptOpen) return;
    await tick();
    elementPromptInput?.focus();
  }

  /**
   * Describes the selected layer so Tiffy can find it in composition.html.
   * The runtime's own id attribute is stripped because it is not in the source.
   */
  function selectedElementBrief(): string {
    const element = selectedId ? runtime?.elements.get(selectedId) : undefined;
    if (!element) return "";
    const clone = element.cloneNode(true) as HTMLElement;
    for (const node of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
      node.removeAttribute("data-motionly-id");
      node.removeAttribute("style");
    }
    const markup = clone.outerHTML.replace(/\s+/g, " ");
    const excerpt = markup.length > 600 ? `${markup.slice(0, 600)}…` : markup;
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    return [
      `Registered timeline id: "${selectedId}"`,
      selectedEditorGroup ? `Editor label: "${selectedEditorGroup.label}"` : "",
      text ? `Visible text: "${text.slice(0, 160)}"` : "",
      `Markup: ${excerpt}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function submitElementPrompt(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const request = elementPromptDraft.trim();
    if (!request || !selectedId || $generationStore.isActive) return;
    const label = selectedEditorGroup?.label ?? selectedId;
    const prompt = [
      `Edit only this one element of the current composition. Keep every other element, scene, timing, and transition exactly as it is.`,
      selectedElementBrief(),
      `Requested change: ${request}`,
    ].join("\n\n");
    elementPromptDraft = "";
    elementPromptOpen = false;
    await submitAssistant(new SubmitEvent("submit"), {
      text: `${label}: ${request}`,
      prompt,
    });
  }

  function elementPromptKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      elementPromptOpen = false;
      previewStage?.focus();
    }
  }

  // The server does not charge a request that fails (see direct-ai.ts), so a
  // dropped connection or server fault is safe to retry as-is.
  const RETRY_NOTICE =
    "Sorry, we ran into a problem and couldn't finish this video. Please retry — you're only charged for videos that finish, so this one cost nothing.";

  function isTransientFailure(error: unknown): boolean {
    if (error instanceof GenerationJobLostError) return true;
    if (error instanceof CloudApiError) {
      return error.status === 0 || error.status === 408 || error.status >= 500;
    }
    const text = error instanceof Error ? error.message : String(error);
    return /failed to fetch|networkerror|network error|network request failed|load failed|timed? ?out|aborted|502|503|504/i.test(
      text,
    );
  }

  /**
   * The connection was lost rather than answered: a network drop, or a
   * gateway error page with no backend error code. The backend may still be
   * running, so it is worth waiting for its save. A backend that answered
   * with its own error has already stopped (and released the credits).
   */
  function mayStillBeRunning(error: unknown): boolean {
    if (error instanceof GenerationJobLostError) return true;
    if (error instanceof CloudApiError) {
      return error.code === "REQUEST_FAILED" && error.status >= 502;
    }
    return isTransientFailure(error);
  }

  function failureMessage(error: unknown, fallback: string): string {
    if (isTransientFailure(error)) return RETRY_NOTICE;
    const text = error instanceof Error ? error.message : fallback;
    return text.startsWith("Error:") ? text : `Error: ${text}`;
  }

  function isRetryMessage(text: string): boolean {
    return text === RETRY_NOTICE;
  }

  async function retryLastPrompt(): Promise<void> {
    if (!lastSentPrompt || $generationStore.isActive) return;
    await submitAssistant(new SubmitEvent("submit"), lastSentPrompt);
  }

  function isErrorMessage(text: string): boolean {
    return (
      text.startsWith("Error:") ||
      text.includes("JSON at position") ||
      text.includes("Expected ',' or '}'") ||
      text.includes("SyntaxError") ||
      text.includes("AI generation error") ||
      text.includes("AI generation failed")
    );
  }

  async function handleFixError(errorMessage: string): Promise<void> {
    if ($generationStore.isActive) return;

    let lastPrompt = "";
    for (let i = assistantMessages.length - 1; i >= 0; i--) {
      const msg = assistantMessages[i];
      if (msg && msg.role === "user" && !msg.text.startsWith("Fix:")) {
        lastPrompt = msg.text;
        break;
      }
    }

    const fixInstruction = buildRepairInstruction(errorMessage, lastPrompt);

    assistantDraft = "";
    assistantMessages = [
      ...assistantMessages,
      { role: "user", text: "Fix: Repair composition JSON error" },
    ];

    generationStore.set({
      isActive: true,
      status: "GENERATING",
      stage: "GENERATING",
      progress: 20,
      message: "Tiffy is fixing the composition...",
    });

    try {
      const reply = await generateAndApplyAssistant(fixInstruction);
      generationStore.set({
        isActive: false,
        status: "COMPLETED",
        stage: "COMPLETED",
        progress: 100,
        message: reply,
      });
      showNotice(withCreditCost("Tiffy repaired the composition."));
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "AI fix failed.";
      if (mayStillBeRunning(err) && (await waitForBackgroundGeneration())) {
        generationStore.set({
          isActive: false,
          status: "COMPLETED",
          stage: "COMPLETED",
          progress: 100,
          message: "Your change was saved. I loaded the latest version.",
        });
        showNotice("Tiffy repaired the composition.");
        return;
      }
      generationStore.set({
        isActive: false,
        status: "FAILED",
        stage: "FAILED",
        progress: 0,
        message: "",
        error: errorMsg,
      });
      const formattedError = failureMessage(err, errorMsg);
      if (assistantMessages.at(-1)?.text !== formattedError) {
        assistantMessages = [
          ...assistantMessages,
          { role: "assistant", text: formattedError },
        ];
      }
      showNotice(isRetryMessage(formattedError) ? formattedError : errorMsg);
    }
  }

  /**
   * A prompt handed over from motionly.site runs through the same generation
   * as the chat composer. Waiting for a cloud workspace left guests with the
   * prompt parked and nothing happening.
   */
  async function runLandingPrompt(): Promise<void> {
    if (!pendingLandingPrompt || landingPromptStarted) return;
    // A prompt handed over by a guest waits behind the sign-in dialog instead
    // of being spent, and resumes from sessionStorage once the session exists.
    if (mode === "cloud" && !currentUser) {
      if (authChecked) openAuthDialog("signup");
      return;
    }
    if (!workspaceId) return;
    landingPromptStarted = true;
    assistantDraft = pendingLandingPrompt;
    pendingLandingPrompt = "";
    sessionStorage.removeItem("motionly_pending_prompt");
    await submitAssistant(new SubmitEvent("submit"));
    scheduleDraftSave();
  }

  function handleCloudReady(event: CustomEvent<{ workspaceId: string }>): void {
    workspaceId = event.detail.workspaceId;
    void refreshActivePlan();
    void restoreProjectFromRoute();
    void runLandingPrompt();
  }

  async function refreshActivePlan(): Promise<void> {
    if (!currentUser || !workspaceId) {
      activePlan = null;
      return;
    }
    try {
      const subscription = await musicApi.getSubscription(workspaceId);
      activePlan =
        subscription.status === "active" && subscription.plan
          ? subscription.plan
          : null;
    } catch {
      activePlan = null;
    }
  }

  async function saveSource(): Promise<void> {
    if (!hasEditorProject) return;
    if (mode === "local") {
      const saved = await saveLocalProject(cloudFiles);
      showNotice(saved ? "Saved local project." : "No local project is open.");
    } else {
      cloudProjects.setFiles(cloudFiles);
      await cloudProjects.saveActive();
      sourceDirty = false;
      captureEvent("project saved", { has_cloud_project: !!cloudProject });
    }
    scheduleDraftSave();
  }

  function persistSourceOverride(id: string, patch: ElementOverride): void {
    const documentSource = new DOMParser().parseFromString(
      cloudFiles["composition.html"],
      "text/html",
    );
    const template = documentSource.querySelector("template");
    const scope: ParentNode = template?.content ?? documentSource;
    const escapedId =
      typeof globalThis.CSS?.escape === "function"
        ? globalThis.CSS.escape(id)
        : id.replace(/["'\\]/g, "\\$&");
    const element = scope.querySelector<HTMLElement>(
      `[data-edit="${escapedId}"], [data-motionly-id="${escapedId}"], #${escapedId}`,
    );
    if (!element) return;

    const textTarget =
      editorGroupTextTarget(readEditorGroup(id, element)) ?? element;

    const merged: ElementOverride = {
      ...(runtime?.getOverride(id) ?? {}),
      ...patch,
    };

    if (merged.text !== undefined) element.textContent = merged.text;
    if (merged.x !== undefined || merged.y !== undefined) {
      element.style.translate = `${merged.x ?? 0}px ${merged.y ?? 0}px`;
    }
    if (merged.scale !== undefined) element.style.scale = String(merged.scale);
    if (merged.rotation !== undefined)
      element.style.rotate = `${merged.rotation}deg`;
    if (merged.opacity !== undefined)
      element.style.opacity = String(merged.opacity);
    if (merged.color !== undefined) {
      textTarget.style.color = merged.color;
      textTarget.style.webkitTextFillColor = merged.color;
    }
    if (merged.backgroundColor !== undefined) {
      element.style.backgroundColor = merged.backgroundColor;
      if (textTarget !== element && merged.backgroundColor === "transparent") {
        textTarget.style.backgroundColor = "transparent";
      }
    }
    if (merged.fill !== undefined) element.style.fill = merged.fill;
    if (merged.stroke !== undefined) element.style.stroke = merged.stroke;
    if (merged.fontSize !== undefined)
      textTarget.style.fontSize = `${merged.fontSize}px`;
    if (merged.fontFamily !== undefined)
      textTarget.style.fontFamily = merged.fontFamily;
    if (merged.fontWeight !== undefined)
      textTarget.style.fontWeight = merged.fontWeight;
    if (merged.fontStyle !== undefined)
      textTarget.style.fontStyle = merged.fontStyle;
    if (merged.textAlign !== undefined)
      textTarget.style.textAlign = merged.textAlign;
    if (merged.letterSpacing !== undefined)
      textTarget.style.letterSpacing = `${merged.letterSpacing}px`;
    if (merged.lineHeight !== undefined)
      textTarget.style.lineHeight = `${merged.lineHeight}px`;
    if (merged.borderRadius !== undefined)
      element.style.borderRadius = `${merged.borderRadius}px`;
    if (merged.hidden !== undefined)
      element.style.visibility = merged.hidden ? "hidden" : "";

    cloudFiles = {
      ...cloudFiles,
      "composition.html":
        template?.outerHTML ?? documentSource.body.innerHTML.trim(),
    };
    sourceDirty = true;
    cloudProjects?.setFiles(cloudFiles);
    scheduleDraftSave();
  }

  async function handleCloudProjectChange(
    event: CustomEvent<{
      project: ProjectSummary | null;
      files: ProjectSourceFiles;
    }>,
  ): Promise<void> {
    cloudProject = event.detail.project;
    backendGenerationProjectId = cloudProject?.id ?? "";
    cloudFiles = event.detail.files;
    if (cloudProject) {
      page = null;
      await mountSavedProject(cloudProject, cloudFiles);
      setProjectRoute(cloudProject.id);
    } else {
      clearProjectRoute();
    }
  }

  function handleOpenFile(event: Event): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file)
      showNotice(
        `${file.name} selected. Add it to src/compositions/presets to preview it.`,
      );
    fileInput.value = "";
  }

  let exportStatus = "";

  async function exportFullVideo(): Promise<void> {
    if (!hasEditorProject || !runtime || exporting) return;
    exporting = true;
    try {
      if (removeWatermark) {
        exportStatus = "Checking plan...";
        await refreshActivePlan();
      }
      const includeWatermark = !removeWatermark || !activePlan;
      exportStatus = "Initializing video export...";
      showNotice("Rendering full video export (1080p)...", 20000);
      // The encoder loads on the first export, not with the editor.
      const { downloadBlob, exportVideo } =
        await import("../composition/exporter");
      const blob = await exportVideo(
        runtime,
        (_progress, statusText) => {
          exportStatus = statusText;
        },
        activeComposition.fps,
        includeWatermark,
      );
      downloadBlob(blob, "motify-video.mp4");
      captureEvent("video exported", {
        fps: activeComposition.fps,
        duration_seconds: activeComposition.duration,
        watermark: includeWatermark,
      });
      showNotice("Video export successful! Download started.");
    } catch (error) {
      console.error("Video export failed:", error);
      showNotice(
        error instanceof Error ? error.message : "Video export failed.",
      );
    } finally {
      exporting = false;
      exportStatus = "";
    }
  }

  /** Adds what the request cost, when the server charged for it. */
  function withCreditCost(message: string): string {
    const charged = get(lastCreditCharge);
    return charged && charged > 0
      ? `${message} Used ${formatCredits(charged)} credits.`
      : message;
  }

  function showNotice(message: string, duration = 3200): void {
    notice = message;
    window.setTimeout(() => {
      if (notice === message) notice = "";
    }, duration);
  }
</script>

<svelte:window on:pointerdown={closeProfileMenu} />

<div
  class="app"
  class:mode-local={mode === "local"}
  class:mode-cloud={mode === "cloud"}
>
  <input
    bind:this={mediaInput}
    type="file"
    accept={`image/*,video/*,image/svg+xml,${AUDIO_ACCEPT}`}
    style="display: none"
    on:change={handleMediaUpload}
    disabled={uploadingMedia}
  />
  <input
    bind:this={fileInput}
    class="file-input"
    type="file"
    accept=".ts,.tsx,text/typescript"
    on:change={handleOpenFile}
  />
  <div class="code-editor-scope">
    <div class="me-motion-editor" style="--timeline-height: 218px;">
      <div class="me-workbench" class:me-no-inspector={!showInspector}>
        {#if mode === "cloud"}
          <aside class="me-left-panel">
            {#if hasEditorProject}
              {@render tiffy("panel")}
            {:else}
              <nav class="me-sidebar-home" aria-label="Motify navigation">
                <div class="me-sidebar-brand">
                  <img src="/logo.svg" alt="" width="22" height="22" />
                  <span>Motify</span>
                </div>
                <div class="me-sidebar-primary">
                  <button
                    class="me-sidebar-link"
                    class:me-active={centerPage === "create"}
                    aria-current={centerPage === "create" ? "page" : undefined}
                    on:click={() => openPage("create")}
                  >
                    <SquarePen size={16} /><span>Create</span>
                  </button>
                  <button
                    class="me-sidebar-link"
                    class:me-active={centerPage === "videos"}
                    aria-current={centerPage === "videos" ? "page" : undefined}
                    on:click={() => openPage("videos")}
                  >
                    <LayoutGrid size={16} /><span>My Videos</span>
                  </button>
                  <button
                    class="me-sidebar-link"
                    class:me-active={centerPage === "templates"}
                    aria-current={centerPage === "templates"
                      ? "page"
                      : undefined}
                    on:click={() => openPage("templates")}
                  >
                    <FolderOpen size={16} /><span>Templates</span>
                  </button>
                  <a class="me-sidebar-link" href={BRAND_ROUTE}>
                    <Dna size={16} /><span>Brand Kit</span>
                  </a>
                  <button
                    class="me-sidebar-link"
                    class:me-active={centerPage === "assets"}
                    aria-current={centerPage === "assets" ? "page" : undefined}
                    on:click={() => openPage("assets")}
                  >
                    <ImageIcon size={16} /><span>Assets</span>
                  </button>
                  <button
                    class="me-sidebar-link"
                    class:me-active={centerPage === "music"}
                    aria-current={centerPage === "music" ? "page" : undefined}
                    on:click={() => openPage("music")}
                  >
                    <Music2 size={16} /><span>Music</span>
                  </button>
                </div>

                <section
                  class="me-sidebar-recents"
                  aria-labelledby="sidebar-recents-title"
                >
                  <h2 id="sidebar-recents-title">Recents</h2>
                  <div class="me-sidebar-recent-list">
                    {#each sidebarProjects.slice(0, 5) as project (project.id)}
                      <button
                        class="me-sidebar-recent"
                        class:me-current={cloudProject?.id === project.id}
                        title={project.name}
                        on:click={() => openRecentProject(project.id)}
                      >
                        <CirclePlay size={14} /><span>{project.name}</span>
                      </button>
                    {:else}
                      {#if recentsLoaded}
                        <p>No saved videos yet.</p>
                      {:else}
                        {#each [72, 58, 66] as width (width)}
                          <span
                            class="me-skeleton me-recent-skeleton"
                            style:width={`${width}%`}
                            aria-hidden="true"
                          ></span>
                        {/each}
                      {/if}
                    {/each}
                  </div>
                </section>

                <div class="me-sidebar-account">
                  {#if currentUser}
                    <div class="me-sidebar-account-row">
                      <CreditCard size={15} />
                      <span>Credits</span>
                      <CreditsBadge />
                    </div>
                    <div class="me-sidebar-account-row">
                      <Gift size={15} /><span>Plan</span>
                      <small class="me-sidebar-plan"
                        >{activePlan ?? "Free"}</small
                      >
                    </div>
                    <div class="me-profile" bind:this={profileMenu}>
                      {#if profileMenuOpen}
                        <div class="me-profile-menu" role="menu">
                          <div class="me-profile-menu__who">
                            <strong
                              >{currentUser.displayName ||
                                currentUser.email}</strong
                            >
                            <small>{currentUser.email}</small>
                          </div>
                          <button
                            type="button"
                            role="menuitem"
                            on:click={() => openPage("settings")}
                          >
                            <Settings size={15} /> Settings
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            on:click={() => openPage("support")}
                          >
                            <LifeBuoy size={15} /> Support
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            on:click={signOutOfMotify}
                          >
                            <LogOut size={15} /> Sign out
                          </button>
                        </div>
                      {/if}
                      <button
                        class="me-sidebar-profile"
                        aria-haspopup="menu"
                        aria-expanded={profileMenuOpen}
                        on:click={() => (profileMenuOpen = !profileMenuOpen)}
                      >
                        <span class="account-avatar" aria-hidden="true">
                          {(currentUser.displayName || currentUser.email)
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                        <span class="me-sidebar-profile__name"
                          >{currentUser.displayName || currentUser.email}</span
                        >
                        <ChevronsUpDown size={14} />
                      </button>
                    </div>
                  {:else}
                    <button
                      class="me-sidebar-signin"
                      on:click={() => openAuthDialog("signin")}
                    >
                      Sign in
                    </button>
                  {/if}
                  <a
                    class="me-sidebar-upgrade"
                    href={PRICING_URL}
                    target="_blank"
                    rel="noopener"
                  >
                    <Crown size={15} /><span>Upgrade</span>
                  </a>
                </div>
              </nav>
            {/if}
          </aside>
        {:else if localPanelOpen}
          <aside class="me-left-panel">
            <div class="me-brand-row">
              <div class="brand">
                <img
                  class="logo-shell"
                  src="/logo.svg"
                  alt=""
                  width="22"
                  height="22"
                />
                <h1>Motify</h1>
              </div>
              <div class="me-brand-actions">
                <button
                  class="me-ghost-icon-btn me-tooltip"
                  aria-label="Close editor controls"
                  data-tooltip="Close editor controls"
                  on:click={() => (localPanelOpen = false)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div class="me-panel-header">
              {#if localPanelView === "assets"}
                <div class="me-panel-title">
                  <ImageIcon size={15} /> Assets
                </div>
              {:else if sourceOpen}
                <div class="me-panel-title">
                  <Braces size={15} /> Source
                </div>
                <button
                  class="me-header-icon-btn"
                  aria-label="Close composition source"
                  on:click={() => (sourceOpen = false)}
                >
                  <X size={15} />
                </button>
              {:else}
                <div class="me-panel-title">
                  <FolderOpen size={15} /> Presets
                </div>
                <button
                  class="me-header-icon-btn me-tooltip"
                  aria-label="Open composition HTML source"
                  data-tooltip="Composition source"
                  on:click={openTimelineSource}
                >
                  <Braces size={15} />
                </button>
              {/if}
            </div>

            {#if localPanelView === "assets"}
              <div class="me-panel-content">
                <h3 class="me-category-title">Project assets</h3>
                {#each localAssets as asset}
                  <a
                    class="me-local-asset"
                    href={`/assets/${asset.split("/").map(encodeURIComponent).join("/")}`}
                    target="_blank"
                    rel="noreferrer">{asset}</a
                  >
                {:else}
                  <p class="panel-copy">
                    Files in your project's assets folder appear here.
                  </p>
                {/each}
              </div>
            {:else if sourceOpen}
              <div class="me-panel-content">
                <h3 class="me-category-title">Composition source</h3>
                <div class="source-heading">
                  <Braces size={15} />
                  {localProjectName || "Unsaved project"} / composition.html
                </div>
                <pre class="source-code">{cloudFiles["composition.html"]}</pre>
                <h3 class="me-category-title">styles.css</h3>
                <pre class="source-code">{cloudFiles["styles.css"]}</pre>
                <h3 class="me-category-title">timeline.js</h3>
                <pre class="source-code">{cloudFiles["timeline.js"]}</pre>
                <h3 class="me-category-title">index.ts</h3>
                <pre class="source-code">{cloudFiles["index.ts"]}</pre>
              </div>
            {:else}
              <div class="me-panel-content">
                <h3 class="me-category-title">Presets</h3>
                <div class="me-preset-grid">
                  {#each templates as template (template.id)}
                    <button
                      class="me-preset-card"
                      disabled={openingTemplate !== null}
                      aria-busy={openingTemplate === template.id}
                      on:click={() => openTemplate(template)}
                    >
                      <span class={`me-preset-thumbnail ${template.thumbnail}`}>
                        {@render templateArt(template)}
                      </span>
                      <span class="me-preset-info"
                        ><strong class="me-preset-name">{template.name}</strong>
                        <small>{template.duration} · {template.summary}</small
                        ></span
                      >
                    </button>
                  {/each}
                </div>
                <p class="panel-copy">
                  Fast kinetic type, native product UI, overlapping handoffs,
                  and one directed GSAP timeline. No generated media.
                </p>
              </div>
            {/if}
          </aside>
        {/if}

        <div
          class="me-center-column"
          class:me-center-paged={centerPage !== null}
        >
          {#if centerPage}
            <div
              class="me-page"
              class:me-page--create={centerPage === "create"}
            >
              {#if hasEditorProject}
                <button
                  type="button"
                  class="me-page-back"
                  on:click={() => (page = null)}
                  ><ArrowLeft size={15} /> Back to video</button
                >
              {/if}
              {#if centerPage === "create"}
                <div class="me-create">
                  {@render tiffy("hero")}
                </div>
              {:else if centerPage === "templates"}
                <section class="me-page-body" aria-labelledby="templates-title">
                  <header class="me-page-header">
                    <h1 id="templates-title">Templates</h1>
                    <p>
                      Open a finished film, then ask Tiffy to make it yours.
                    </p>
                  </header>
                  <label class="me-page-search">
                    <Search size={15} />
                    <input
                      type="search"
                      placeholder="Search templates…"
                      aria-label="Search templates"
                      bind:value={templateQuery}
                    />
                  </label>
                  <div class="me-chip-row" aria-label="Template categories">
                    {#each ["All", ...templateCategories] as category (category)}
                      <button
                        type="button"
                        class="me-chip"
                        class:me-active={templateCategory === category}
                        aria-pressed={templateCategory === category}
                        on:click={() =>
                          (templateCategory = category as
                            TemplateCategory | "All")}>{category}</button
                      >
                    {/each}
                  </div>
                  <div class="me-template-grid">
                    {#each visibleTemplates as template (template.id)}
                      <button
                        type="button"
                        class="me-template-card"
                        aria-label={`Open the ${template.name} template`}
                        aria-busy={openingTemplate === template.id}
                        disabled={openingTemplate !== null}
                        on:click={() => openTemplate(template)}
                      >
                        <span
                          class={`me-preset-thumbnail me-template-thumb ${template.thumbnail}`}
                        >
                          {@render templateArt(template)}
                          <span class="me-template-duration"
                            >{template.duration}</span
                          >
                          {#if openingTemplate === template.id}
                            <span class="me-template-opening"
                              ><span class="me-spinner" aria-hidden="true"
                              ></span>Opening…</span
                            >
                          {/if}
                        </span>
                        <span class="me-template-meta">
                          <strong>{template.name}</strong>
                          <span class="me-template-tag"
                            >{template.category}</span
                          >
                        </span>
                        <small class="me-template-summary"
                          >{template.summary}</small
                        >
                      </button>
                    {:else}
                      <p class="me-page-empty">
                        No templates match your search.
                      </p>
                    {/each}
                  </div>
                </section>
              {:else if centerPage === "music"}
                <section
                  class="me-page-body me-page-body--narrow"
                  aria-labelledby="music-title"
                >
                  <header class="me-page-header">
                    <h1 id="music-title">Music</h1>
                    <p>
                      Pick a song and Tiffy will score your next video to it.
                    </p>
                  </header>
                  <div class="me-library">
                    <MusicPanel
                      api={musicApi}
                      {workspaceId}
                      busy={$generationStore.isActive}
                      onUse={useAudioTrack}
                      onRemoveFromProject={removeAudioFromProject}
                      onNotice={(message) => showNotice(message)}
                    />
                  </div>
                </section>
              {:else if centerPage === "assets"}
                <section
                  class="me-page-body me-page-body--narrow"
                  aria-labelledby="assets-title"
                >
                  <header class="me-page-header">
                    <h1 id="assets-title">Assets</h1>
                    <p>Your images and logos, ready to drop into a video.</p>
                  </header>
                  <div class="me-library">
                    <AssetsPanel
                      api={musicApi}
                      {workspaceId}
                      projectId={cloudProject?.id ?? backendGenerationProjectId}
                      busy={$generationStore.isActive}
                      onUse={useLibraryAsset}
                      onManageBrand={openBrandKit}
                      onNotice={(message) => showNotice(message)}
                    />
                  </div>
                </section>
              {:else if centerPage === "videos"}
                <section
                  class="me-page-body me-videos-page"
                  aria-label="My Videos"
                >
                  <div class="me-videos-host" bind:this={videosHost}></div>
                </section>
              {:else if centerPage === "support"}
                <section
                  class="me-page-body me-page-body--narrow"
                  aria-labelledby="support-title"
                >
                  <header class="me-page-header">
                    <h1 id="support-title">Support</h1>
                    <p>
                      Stuck on a video, a payment, or something that looks
                      broken? We read every message and usually reply within one
                      business day.
                    </p>
                  </header>
                  <div class="me-settings-card me-support-card">
                    <span class="me-support-icon" aria-hidden="true"
                      ><Mail size={18} /></span
                    >
                    <div class="me-support-copy">
                      <h2>Email us</h2>
                      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                    </div>
                    <button
                      type="button"
                      class="me-support-copy-btn"
                      aria-label="Copy support email address"
                      on:click={copySupportEmail}
                    >
                      {#if supportEmailCopied}<Check size={14} /> Copied{:else}<Copy
                          size={14}
                        /> Copy{/if}
                    </button>
                  </div>
                  <div class="me-settings-card">
                    <h2>To help us help you faster</h2>
                    <ul class="me-support-list">
                      <li>The email address you sign in with.</li>
                      <li>
                        Which video it's about — its name, or the link from your
                        address bar.
                      </li>
                      <li>
                        What you expected, what happened instead, and a
                        screenshot if you can.
                      </li>
                      <li>For billing, the date and amount of the payment.</li>
                    </ul>
                  </div>
                  <a
                    class="me-support-mail"
                    href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Motify support")}`}
                    ><Mail size={15} /> Write to support</a
                  >
                </section>
              {:else}
                <section
                  class="me-page-body me-page-body--narrow"
                  aria-labelledby="settings-title"
                >
                  <header class="me-page-header">
                    <h1 id="settings-title">Settings</h1>
                  </header>
                  {#if currentUser}
                    <div class="me-settings-card">
                      <h2>Account</h2>
                      <div class="me-settings-row">
                        <span>Name</span>
                        <strong>{currentUser.displayName || "—"}</strong>
                      </div>
                      <div class="me-settings-row">
                        <span>Email</span>
                        <strong>{currentUser.email}</strong>
                      </div>
                    </div>
                    <div class="me-settings-card">
                      <h2>Plan & credits</h2>
                      <div class="me-settings-row">
                        <span>Plan</span>
                        <span class="me-settings-value">
                          <strong class="me-sidebar-plan"
                            >{activePlan ?? "Free"}</strong
                          >
                          <a href={PRICING_URL} target="_blank" rel="noopener"
                            >{activePlan ? "Change plan" : "Upgrade"}</a
                          >
                        </span>
                      </div>
                      <div class="me-settings-row">
                        <span>Credits</span>
                        <CreditsBadge />
                      </div>
                    </div>
                    <div class="me-settings-card">
                      <h2>Brand</h2>
                      <div class="me-settings-row">
                        <span>Brand DNA</span>
                        <a href={BRAND_ROUTE}>{brandName ?? "Set it up"}</a>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="me-settings-signout"
                      on:click={signOutOfMotify}
                      ><LogOut size={15} /> Sign out</button
                    >
                  {/if}
                </section>
              {/if}
            </div>
          {/if}
          <header class="me-center-toolbar">
            {#if mode === "local"}
              <div
                class="me-local-controls"
                role="toolbar"
                aria-label="Editor controls"
              >
                <span class="me-local-brand">Motify</span>
                <button class="btn" on:click={() => openLocalPanel("presets")}
                  >Presets</button
                >
                <button class="btn" on:click={() => openLocalPanel("assets")}
                  >Assets</button
                >
                <button class="btn" on:click={() => openLocalPanel("source")}
                  >Source</button
                >
              </div>
            {/if}
            <div class="file-info">
              <FileText size={15} /><span class="file-info__name"
                >{hasEditorProject
                  ? (cloudProject?.name ?? localProjectName) ||
                    "Unsaved Motify project"
                  : "No video open"}</span
              >
            </div>
            <div
              class="me-view-controls"
              role="toolbar"
              aria-label="Canvas view"
            >
              <span class="me-view-readout"
                >{activeComposition.width} × {activeComposition.height}</span
              >
              <span class="me-view-divider" aria-hidden="true"></span>
              <button
                class="me-view-btn me-tooltip"
                aria-label="Zoom out"
                data-tooltip="Zoom out"
                on:click={() => (zoom = Math.max(0.3, zoom - 0.15))}
                ><Minus size={14} /></button
              >
              <span class="me-view-readout me-view-zoom"
                >{Math.round(fitScale * zoom * 100)}%</span
              >
              <button
                class="me-view-btn me-tooltip"
                aria-label="Zoom in"
                data-tooltip="Zoom in"
                on:click={() => (zoom = Math.min(1.7, zoom + 0.15))}
                ><Plus size={14} /></button
              >
              <span class="me-view-divider" aria-hidden="true"></span>
              <button
                class="me-view-btn me-view-text-btn me-tooltip"
                data-tooltip="Fit to screen"
                on:click={fitPreview}><Maximize2 size={13} /> Fit</button
              >
            </div>
            <div class="actions">
              {#if mode === "cloud" && currentUser}
                <CreditsBadge />
              {/if}
              <button
                class="btn"
                title="Save project"
                on:click={saveSource}
                disabled={!hasEditorProject}
                ><Save size={15} /><span>Save</span></button
              >
              <label
                class="me-watermark-option"
                title={activePlan
                  ? "Export without the Motify watermark"
                  : "Upgrade to remove the Motify watermark"}
              >
                <input
                  type="checkbox"
                  aria-label="Remove watermark"
                  bind:checked={removeWatermark}
                  disabled={!activePlan || exporting}
                />
                <span>Remove watermark</span>
              </label>
              <button
                class="btn btn-primary export-action me-tooltip"
                aria-label="Export video"
                data-tooltip="Render and download 1080p video"
                on:click={exportFullVideo}
                disabled={!hasEditorProject || exporting}
              >
                <Download size={15} /><span
                  >{exporting ? exportStatus || "Rendering…" : "Export"}</span
                >
              </button>
            </div>
          </header>
          <main class="me-preview-container">
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
            <div
              class="me-stage"
              data-ph-no-autocapture
              bind:this={previewStage}
              role="application"
              aria-label="Composition preview"
              tabindex="0"
              class:me-dragging={selectionDrag?.mode === "move"}
              on:pointerdown|capture={pressPreview}
              on:click|capture={selectFromPreview}
              on:keydown={handlePreviewKey}
            >
              <div
                class="me-canvas-shell"
                style:width={`${activeComposition.width}px`}
                style:height={`${activeComposition.height}px`}
                style:transform={`scale(${fitScale * zoom})`}
              >
                <div
                  class="composition-canvas"
                  style:width={`${activeComposition.width}px`}
                  style:height={`${activeComposition.height}px`}
                  bind:this={previewRoot}
                ></div>
                {#if selectionRect.visible && selectedId}
                  <div
                    class="me-selection-overlay"
                    style:left={`${selectionRect.left}px`}
                    style:top={`${selectionRect.top}px`}
                    style:width={`${selectionRect.width}px`}
                    style:height={`${selectionRect.height}px`}
                    style:--me-selection-ui-scale={String(
                      1 / Math.max(0.05, fitScale * zoom),
                    )}
                  >
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="me-selection-outline"
                      on:pointerdown={(event) =>
                        beginSelectionDrag(event, "move")}
                    ></div>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="me-selection-handle handle-tl"
                      on:pointerdown={(event) =>
                        beginSelectionDrag(event, "scale")}
                    ></div>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="me-selection-handle handle-tr"
                      on:pointerdown={(event) =>
                        beginSelectionDrag(event, "scale")}
                    ></div>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="me-selection-handle handle-bl"
                      on:pointerdown={(event) =>
                        beginSelectionDrag(event, "scale")}
                    ></div>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="me-selection-handle handle-br"
                      on:pointerdown={(event) =>
                        beginSelectionDrag(event, "scale")}
                    ></div>
                    {#if mode === "cloud" && !selectionDrag}
                      <div
                        class="me-selection-ai"
                        class:me-below={selectionRect.top <
                          56 / Math.max(0.05, fitScale * zoom)}
                        class:me-open={elementPromptOpen}
                      >
                        {#if elementPromptOpen}
                          <form
                            class="me-selection-ai__form"
                            on:submit={submitElementPrompt}
                          >
                            <Sparkles size={14} />
                            <input
                              bind:this={elementPromptInput}
                              bind:value={elementPromptDraft}
                              aria-label="Describe a change to this element"
                              placeholder={`Edit ${selectedEditorGroup?.label ?? "this element"}…`}
                              disabled={$generationStore.isActive}
                              on:keydown={elementPromptKeydown}
                            />
                            <button
                              type="submit"
                              aria-label="Send edit to Tiffy"
                              disabled={!elementPromptDraft.trim() ||
                                $generationStore.isActive}
                              ><ArrowUp size={14} /></button
                            >
                          </form>
                        {:else}
                          <button
                            type="button"
                            class="me-selection-ai__trigger"
                            aria-label="Edit this element with AI"
                            title="Edit with AI"
                            disabled={$generationStore.isActive}
                            on:click={toggleElementPrompt}
                            ><Sparkles size={14} /></button
                          >
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
            {#if mode === "cloud" && $generationStore.isActive}
              <div class="me-generating" role="status" aria-live="polite">
                <span class="me-spinner me-spinner--large" aria-hidden="true"
                ></span>
                <strong>Generating your video…</strong>
                <p>{$generationStore.message || "Tiffy is working on it."}</p>
              </div>
            {:else if openingProject}
              <div class="me-generating" role="status">
                <span class="me-spinner me-spinner--large" aria-hidden="true"
                ></span>
                <strong>Opening your video…</strong>
              </div>
            {/if}
          </main>
          <section class="me-scene-bar" aria-label="Scenes">
            <div class="me-scene-bar__transport">
              <button
                class="me-scene-bar__play"
                aria-label={snapshot.playing ? "Pause" : "Play"}
                on:click={togglePlayback}
                >{#if snapshot.playing}<Pause size={15} />{:else}<Play
                    size={15}
                  />{/if}</button
              >
              <span class="me-scene-bar__time"
                >{timecode(snapshot.time)}<small>
                  / {timecode(activeComposition.duration)}</small
                ></span
              >
            </div>
            <div class="me-scene-bar__track">
              <div class="me-scene-bar__scenes">
                {#each activeComposition.scenes as scene, index (scene.id)}
                  <button
                    class="me-scene-pill"
                    class:me-active={snapshot.sceneId === scene.id}
                    style:left={`${sceneBarLeft(scene)}%`}
                    style:width={`${sceneBarWidth(index)}%`}
                    style:--scene-accent={scene.accent}
                    title={`${scene.label} · ${formatTimelineSeconds(scene.duration)}`}
                    on:click={() => seekToScene(scene)}
                    ><span>{scene.label}</span></button
                  >
                {/each}
              </div>
              <div
                class="me-scene-bar__scrub"
                class:me-scrubbing={sceneBarScrubbing}
                role="slider"
                tabindex="0"
                aria-label="Scene scrubber"
                aria-valuemin={0}
                aria-valuemax={activeComposition.duration}
                aria-valuenow={snapshot.time}
                aria-valuetext={formatTimelineSeconds(snapshot.time)}
                style:--scene-bar-progress={`${sceneBarProgress}%`}
                on:pointerdown={startSceneBarScrub}
                on:pointermove={moveSceneBarScrub}
                on:pointerup={endSceneBarScrub}
                on:pointercancel={endSceneBarScrub}
                on:keydown={sceneBarKeydown}
              ></div>
              <span
                class="me-scene-bar__playhead"
                style:left={`${sceneBarProgress}%`}
                aria-hidden="true"
              ></span>
            </div>
            <button
              class="me-timeline-toggle"
              class:me-active={timelineOpen}
              aria-expanded={timelineOpen}
              on:click={() => (timelineOpen = !timelineOpen)}
              >{#if timelineOpen}<PanelBottomClose size={14} /> Hide timeline{:else}<PanelBottomOpen
                  size={14}
                /> View timeline{/if}</button
            >
          </section>
          {#if timelineOpen && hasEditorProject}
            <section bind:this={timelinePanel} class="me-timeline-panel">
              <button class="me-timeline-resizer" aria-label="Resize timeline"
                ><span></span></button
              >
              <div class="me-timeline-toolbar">
                <div class="me-timeline-context">
                  {#if timelineMode === "scene"}
                    <button
                      class="me-timeline-back me-tooltip"
                      on:click={showProjectTimeline}
                      aria-label="Back to all scenes"
                      data-tooltip="Back to all scenes"
                      ><ArrowLeft size={14} /></button
                    >
                    <Layers3 size={14} /><span>{selectedScene()?.label}</span>
                  {:else}
                    <Layers3 size={14} /><span>All scenes</span><small
                      >Master timeline</small
                    >
                  {/if}
                </div>
                <div class="me-timeline-actions"></div>
              </div>
              <div
                class="me-timeline-scroll"
                style="--timeline-content-width: 1100px;"
              >
                <div class="me-ruler-row">
                  <div class="me-track-label me-ruler-label">
                    {timelineMode === "project"
                      ? "MASTER"
                      : selectedScene()?.label}
                  </div>
                  <div class="me-ruler">
                    {#each timelineTickValues as tick}<span
                        class="me-ruler-tick"
                        style:left={`${((tick - currentTimelineStart) / currentTimelineDuration) * 100}%`}
                        >{formatTimelineSeconds(tick)}</span
                      >{/each}
                    <span bind:this={playheadMarker} class="me-playhead-marker"
                    ></span>
                    <div
                      class="me-timeline-scrubber"
                      class:me-scrubbing={scrubbing}
                      role="slider"
                      tabindex="0"
                      aria-label="Timeline scrubber"
                      aria-valuemin={currentTimelineStart}
                      aria-valuemax={currentTimelineStart +
                        currentTimelineDuration}
                      aria-valuenow={snapshot.time}
                      aria-valuetext={formatTimelineSeconds(snapshot.time)}
                      on:pointerdown={startScrub}
                      on:pointermove={moveScrub}
                      on:pointerup={endScrub}
                      on:pointercancel={endScrub}
                      on:keydown={scrubKeydown}
                    ></div>
                  </div>
                </div>
                {#if timelineMode === "project"}
                  <div class="me-timeline-row project-timeline-row">
                    <button
                      class="me-track-label"
                      on:click={showProjectTimeline}
                      ><span class="me-track-thumb"><Layers3 size={12} /></span
                      ><span class="me-track-copy"
                        ><strong>Scenes</strong><small>Entire composition</small
                        ></span
                      ></button
                    >
                    <div class="me-track-lane project-scene-lane">
                      {#each activeComposition.scenes as scene}
                        <button
                          class="me-clip me-project-scene-clip"
                          style:left={`${sceneLeft(scene)}%`}
                          style:width={`${sceneWidth(scene)}%`}
                          style:--scene-accent={scene.accent}
                          on:click={() => enterScene(scene)}
                        >
                          <span
                            class="clip-accent"
                            style:background={scene.accent}
                          ></span>
                          <span class="me-clip-text">{scene.label}</span>
                          <small>{formatTimelineSeconds(scene.duration)}</small>
                        </button>
                      {/each}
                    </div>
                  </div>
                  <div class="me-timeline-row project-timeline-row">
                    <div class="me-track-label">
                      <span class="me-track-thumb"><Sparkles size={12} /></span
                      ><span class="me-track-copy"
                        ><strong>Handoffs</strong><small>0.7s overlaps</small
                        ></span
                      >
                    </div>
                    <div class="me-track-lane project-scene-lane">
                      {#each activeComposition.scenes.slice(1) as scene}
                        <button
                          class="me-project-handoff"
                          aria-label={`Preview handoff into ${scene.label}`}
                          style:left={`${((scene.start - 0.7) / activeComposition.duration) * 100}%`}
                          style:width={`${(0.7 / activeComposition.duration) * 100}%`}
                          on:click={() => runtime?.seek(scene.start - 0.35)}
                          ><span></span></button
                        >
                      {/each}
                    </div>
                  </div>
                {:else}
                  {#each sceneTracks as track (track.id)}
                    <div
                      class="me-timeline-row"
                      class:me-selected={selectedId === track.id}
                      data-track-id={track.id}
                    >
                      <button
                        class="me-track-label"
                        on:click={() => selectTrack(track)}
                        ><span class="me-track-thumb"
                          ><Layers3 size={12} /></span
                        ><span class="me-track-copy"
                          ><strong>{track.label}</strong><small
                            >{track.kind} · {formatTimelineSeconds(
                              track.start,
                            )}–{formatTimelineSeconds(track.end)}</small
                          ></span
                        ></button
                      >
                      <div class="me-track-lane">
                        <button
                          class="me-clip me-element-clip scene-timeline-clip"
                          class:me-selected-clip={selectedId === track.id}
                          style:left={`${trackLeft(track, currentTimelineStart, currentTimelineDuration)}%`}
                          style:width={`${trackWidth(track, currentTimelineStart, currentTimelineDuration)}%`}
                          on:click={() => selectTrack(track)}
                          ><span
                            class="clip-accent"
                            style:background={selectedScene()?.accent}
                          ></span><span class="me-clip-text">{track.label}</span
                          ><small class="me-clip-duration"
                            >{formatTimelineSeconds(
                              track.end - track.start,
                            )}</small
                          ></button
                        >
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            </section>
          {/if}
        </div>

        {#if showInspector}
          <aside class="me-properties-panel">
            <div class="me-inspector-head">
              <strong class="me-inspector-title">Design</strong>
            </div>
            <div class="me-inspector-body">
              {#if selectedId}
                <div class="me-selection-summary">
                  <span class="me-layer-icon"><Sparkles size={14} /></span>
                  <span
                    ><strong
                      >{selectedEditorGroup?.label ??
                        selectedTrack()?.label ??
                        selectedId}</strong
                    ><small>{selectedId} · editable layer</small></span
                  >
                </div>
                <div class="me-primary-properties">
                  {#if selectedEditorGroup && selectedEditorGroup.fields.length > 0}
                    <section class="me-inspector-section">
                      <div class="me-section-title">
                        {selectedEditorGroup.label}
                      </div>
                      {#each selectedEditorGroup.fields as field}
                        <label
                          class="me-field-line"
                          class:me-field-line--stacked={field.type === "image"}
                        >
                          <span class="me-property-label">{field.label}</span>
                          {#if field.type === "image"}
                            <span class="me-image-field-preview">
                              <img
                                src={editorFieldValue(field)}
                                alt={field.label}
                              />
                              <span class="me-image-upload">
                                <Upload size={13} />
                                <span
                                  >{uploadingMedia
                                    ? "Uploading..."
                                    : "Replace image"}</span
                                >
                                <input
                                  type="file"
                                  accept="image/*"
                                  aria-label={`Replace ${field.label}`}
                                  disabled={uploadingMedia}
                                  on:change={(event) =>
                                    replaceEditorImage(field, event)}
                                />
                              </span>
                            </span>
                          {:else if field.type === "color"}
                            <span class="me-color-control">
                              <input
                                class="me-color-swatch"
                                type="color"
                                value={editorFieldInputValue(field)}
                                on:input={(event) =>
                                  changeEditorField(field, event)}
                              />
                              <output>{editorFieldInputValue(field)}</output>
                            </span>
                          {:else if field.type === "select"}
                            <select
                              class="me-text-input"
                              value={editorFieldInputValue(field)}
                              on:change={(event) =>
                                changeEditorField(field, event)}
                            >
                              {#each field.options ?? [] as option}
                                <option value={option}>{option}</option>
                              {/each}
                            </select>
                          {:else if field.type === "toggle"}
                            <input
                              class="me-toggle-input"
                              type="checkbox"
                              checked={editorFieldInputValue(field) === "true"}
                              on:change={(event) =>
                                changeEditorField(field, event)}
                            />
                          {:else}
                            <input
                              class={field.type === "range"
                                ? "me-custom-slider"
                                : "me-text-input"}
                              type={field.type === "number"
                                ? "number"
                                : field.type}
                              min={field.min}
                              max={field.max}
                              step={field.step}
                              value={editorFieldInputValue(field)}
                              on:input={(event) =>
                                changeEditorField(field, event)}
                            />
                          {/if}
                        </label>
                      {/each}
                    </section>
                  {/if}
                  {#if selectedEditorGroup?.allowTransform}
                    {#if isTextEditable()}
                      <section class="me-inspector-section">
                        <div class="me-section-title">Typography</div>
                        {#if (selectedEditorGroup?.fields.length ?? 0) === 0}
                          <div class="me-field-line">
                            <label class="me-property-label" for="property-text"
                              >Content</label
                            >
                            <input
                              id="property-text"
                              class="me-text-input"
                              type="text"
                              value={editableTextValue()}
                              on:input={setText}
                            />
                          </div>
                        {/if}
                        <div class="me-field-line">
                          <label
                            class="me-property-label"
                            for="property-font-family">Font</label
                          >
                          <input
                            id="property-font-family"
                            class="me-text-input"
                            aria-label="Font family"
                            type="text"
                            value={stringStyleValue("fontFamily", "Inter")}
                            on:change={(event) =>
                              setString("fontFamily", event)}
                          />
                        </div>
                        <div class="me-field-line">
                          <label
                            class="me-property-label"
                            for="property-font-size"
                            use:scrubber={"fontSize"}>Size</label
                          >
                          <span class="me-field">
                            <input
                              id="property-font-size"
                              class="me-number-input"
                              aria-label="Font size"
                              type="number"
                              min="1"
                              value={numericStyleValue("fontSize", 16)}
                              on:input={(event) => setNumber("fontSize", event)}
                            />
                            <span class="me-field-suffix">px</span>
                          </span>
                        </div>
                        <div class="me-field-line">
                          <label
                            class="me-property-label"
                            for="property-font-weight">Weight</label
                          >
                          <select
                            id="property-font-weight"
                            class="me-text-input"
                            aria-label="Font weight"
                            value={stringStyleValue("fontWeight", "400")}
                            on:change={(event) =>
                              setString("fontWeight", event)}
                          >
                            <option value="300">Light</option>
                            <option value="400">Regular</option>
                            <option value="500">Medium</option>
                            <option value="600">Semibold</option>
                            <option value="700">Bold</option>
                            <option value="800">Extra bold</option>
                            <option value="900">Black</option>
                          </select>
                        </div>
                        <div class="me-field-line">
                          <label
                            class="me-property-label"
                            for="property-font-style">Style</label
                          >
                          <select
                            id="property-font-style"
                            class="me-text-input"
                            aria-label="Font style"
                            value={stringStyleValue("fontStyle", "normal")}
                            on:change={(event) => setString("fontStyle", event)}
                          >
                            <option value="normal">Normal</option>
                            <option value="italic">Italic</option>
                            <option value="oblique">Oblique</option>
                          </select>
                        </div>
                        <div class="me-field-line">
                          <label
                            class="me-property-label"
                            for="property-text-align">Align</label
                          >
                          <select
                            id="property-text-align"
                            class="me-text-input"
                            aria-label="Text alignment"
                            value={stringStyleValue("textAlign", "center")}
                            on:change={(event) => setString("textAlign", event)}
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                        <div class="me-field-line">
                          <label
                            class="me-property-label"
                            for="property-letter-spacing"
                            use:scrubber={"letterSpacing"}>Tracking</label
                          >
                          <span class="me-field">
                            <input
                              id="property-letter-spacing"
                              class="me-number-input"
                              aria-label="Letter spacing"
                              type="number"
                              step="0.1"
                              value={numericStyleValue("letterSpacing", 0)}
                              on:input={(event) =>
                                setNumber("letterSpacing", event)}
                            />
                            <span class="me-field-suffix">px</span>
                          </span>
                        </div>
                        <div class="me-field-line">
                          <label
                            class="me-property-label"
                            for="property-line-height"
                            use:scrubber={"lineHeight"}>Line height</label
                          >
                          <span class="me-field">
                            <input
                              id="property-line-height"
                              class="me-number-input"
                              aria-label="Line height"
                              type="number"
                              min="1"
                              step="1"
                              value={numericStyleValue("lineHeight", 16)}
                              on:input={(event) =>
                                setNumber("lineHeight", event)}
                            />
                            <span class="me-field-suffix">px</span>
                          </span>
                        </div>
                      </section>
                    {/if}
                    <section class="me-inspector-section">
                      <div class="me-section-title">Transform</div>
                      <div class="me-field-line">
                        <span class="me-property-label">Position</span>
                        <div class="me-field-pair">
                          <label class="me-field"
                            ><span class="me-field-prefix" use:scrubber={"x"}
                              >X</span
                            >
                            <input
                              class="me-number-input"
                              aria-label="X position"
                              title="Horizontal position"
                              type="number"
                              value={currentOverride(editorRevision).x ?? 0}
                              on:input={(event) => setNumber("x", event)}
                            /></label
                          >
                          <label class="me-field"
                            ><span class="me-field-prefix" use:scrubber={"y"}
                              >Y</span
                            >
                            <input
                              class="me-number-input"
                              aria-label="Y position"
                              title="Vertical position"
                              type="number"
                              value={currentOverride(editorRevision).y ?? 0}
                              on:input={(event) => setNumber("y", event)}
                            /></label
                          >
                        </div>
                      </div>
                      <div class="me-field-line">
                        <span class="me-property-label">Scale</span>
                        <label class="me-field"
                          ><span class="me-field-prefix" use:scrubber={"scale"}
                            >×</span
                          >
                          <input
                            class="me-number-input"
                            aria-label="Scale"
                            title="Scale selected element"
                            type="number"
                            step="0.05"
                            value={currentOverride(editorRevision).scale ?? 1}
                            on:input={(event) => setNumber("scale", event)}
                          /></label
                        >
                      </div>
                      <div class="me-field-line">
                        <span class="me-property-label">Rotate</span>
                        <label class="me-field"
                          ><span
                            class="me-field-prefix"
                            use:scrubber={"rotation"}>∠</span
                          >
                          <input
                            class="me-number-input"
                            aria-label="Rotation"
                            title="Rotate selected element"
                            type="number"
                            value={currentOverride(editorRevision).rotation ??
                              0}
                            on:input={(event) => setNumber("rotation", event)}
                          /><span class="me-field-suffix">°</span></label
                        >
                      </div>
                      <div class="me-field-line">
                        <label class="me-property-label" for="property-opacity"
                          >Opacity</label
                        >
                        <span class="me-field me-field--slider">
                          <input
                            id="property-opacity"
                            class="me-custom-slider"
                            title="Adjust opacity"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={currentOverride(editorRevision).opacity ?? 1}
                            on:input={(event) => setNumber("opacity", event)}
                          />
                          <output
                            >{Math.round(
                              (currentOverride(editorRevision).opacity ?? 1) *
                                100,
                            )}%</output
                          >
                        </span>
                      </div>
                    </section>
                  {/if}
                  {#if selectedEditorGroup?.allowAppearance}
                    <section class="me-inspector-section">
                      <div class="me-section-title">Appearance</div>
                      {#if isSvgSelected()}
                        <label class="me-field-line">
                          <span class="me-property-label">Fill</span>
                          <span class="me-color-control">
                            <input
                              class="me-color-swatch"
                              aria-label="Fill color"
                              type="color"
                              value={colorValue("fill", "#ffffff")}
                              on:input={(event) => setColor("fill", event)}
                            />
                            <output>{colorValue("fill", "#ffffff")}</output>
                          </span>
                        </label>
                        <label class="me-field-line">
                          <span class="me-property-label">Stroke</span>
                          <span class="me-color-control">
                            <input
                              class="me-color-swatch"
                              aria-label="Stroke color"
                              type="color"
                              value={colorValue("stroke", "#5eead4")}
                              on:input={(event) => setColor("stroke", event)}
                            />
                            <output>{colorValue("stroke", "#5eead4")}</output>
                          </span>
                        </label>
                      {:else if isTextEditable()}
                        <label class="me-field-line">
                          <span class="me-property-label">Text</span>
                          <span class="me-color-control">
                            <input
                              class="me-color-swatch"
                              aria-label="Text fill color"
                              type="color"
                              value={colorValue(
                                "color",
                                "#111318",
                                editorRevision,
                              )}
                              on:input={(event) => setColor("color", event)}
                            />
                            <output
                              >{colorValue(
                                "color",
                                "#111318",
                                editorRevision,
                              )}</output
                            >
                          </span>
                        </label>
                        {#if isBackgroundTransparent(editorRevision)}
                          <div class="me-field-line">
                            <span class="me-property-label">Background</span>
                            <button
                              class="me-add-bg-btn"
                              type="button"
                              aria-label="Add background"
                              on:click={addBackground}
                            >
                              <Plus size={12} /> Add background
                            </button>
                          </div>
                        {:else}
                          <div class="me-field-line">
                            <span class="me-property-label">Background</span>
                            <div class="me-color-control">
                              <input
                                class="me-color-swatch"
                                aria-label="Background color"
                                type="color"
                                value={effectiveBackgroundColorHex(
                                  editorRevision,
                                )}
                                on:input={(event) =>
                                  setColor("backgroundColor", event)}
                              />
                              <output
                                >{effectiveBackgroundColorHex(
                                  editorRevision,
                                )}</output
                              >
                              <button
                                class="me-color-clear"
                                type="button"
                                aria-label="Remove background"
                                title="Remove background"
                                on:click={clearBackground}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                          <div class="me-field-line">
                            <label
                              class="me-property-label"
                              for="property-radius">Radius</label
                            >
                            <span class="me-field">
                              <input
                                id="property-radius"
                                class="me-number-input"
                                aria-label="Corner radius"
                                type="number"
                                min="0"
                                value={numericStyleValue(
                                  "borderRadius",
                                  0,
                                  editorRevision,
                                )}
                                on:input={(event) =>
                                  setNumber("borderRadius", event)}
                              />
                              <span class="me-field-suffix">px</span>
                            </span>
                          </div>
                        {/if}
                      {:else}
                        <div class="me-field-line">
                          <span class="me-property-label">Fill</span>
                          <div class="me-color-control">
                            <input
                              class="me-color-swatch"
                              aria-label="Fill color"
                              type="color"
                              value={effectiveBackgroundColorHex()}
                              on:input={(event) =>
                                setColor("backgroundColor", event)}
                            />
                            <output>{effectiveBackgroundColorHex()}</output>
                          </div>
                        </div>
                        <div class="me-field-line">
                          <label class="me-property-label" for="property-radius"
                            >Radius</label
                          >
                          <span class="me-field">
                            <input
                              id="property-radius"
                              class="me-number-input"
                              aria-label="Corner radius"
                              type="number"
                              min="0"
                              value={numericStyleValue("borderRadius", 0)}
                              on:input={(event) =>
                                setNumber("borderRadius", event)}
                            />
                            <span class="me-field-suffix">px</span>
                          </span>
                        </div>
                      {/if}
                    </section>
                  {/if}
                  <button
                    class="me-layer-visibility"
                    class:me-restore={currentOverride(editorRevision).hidden}
                    type="button"
                    on:click={toggleSelectedLayer}
                  >
                    {#if currentOverride(editorRevision).hidden}<Eye
                        size={14}
                      /> Restore layer{:else}<EyeOff size={14} /> Remove layer{/if}
                  </button>
                </div>
              {:else}
                <div class="me-properties-empty">
                  <Sparkles size={30} /><strong>Select an element</strong><span
                    >Click an editable object in the preview to change its
                    visual properties.</span
                  >
                </div>
              {/if}
            </div>
          </aside>
        {/if}
      </div>
    </div>
  </div>

  {#if notice}<div class="notice" role="status">{notice}</div>{/if}
  {#if mode === "cloud"}
    <EarlyNoticeCard />
    <AuthDialog
      bind:open={authDialogOpen}
      bind:mode={authDialogMode}
      title={promptHeldForAuth || pendingLandingPrompt
        ? "Your prompt is waiting"
        : ""}
      subtitle={promptHeldForAuth || pendingLandingPrompt
        ? "Log in or create an account and Tiffy starts on it right away."
        : ""}
      onauthenticated={handleAuthenticated}
      onclose={cancelAuthDialog}
    />
    <CloudProjectGallery
      bind:this={cloudProjects}
      host={galleryHost}
      initialFiles={blankProjectFiles}
      width={1920}
      height={1080}
      fps={60}
      duration={5}
      on:cloudready={handleCloudReady}
      on:navigationchange={handleSidebarNavigation}
      on:projectchange={handleCloudProjectChange}
      on:notice={(event) => showNotice(event.detail)}
    />
  {/if}
</div>

{#snippet templateArt(template: TemplateCard)}
  <span class="promo-thumbnail-art"
    ><small>{template.eyebrow}</small><strong
      >{template.headline}<br /><em>{template.accent}</em></strong
    ><i>{template.footnote}</i></span
  >
{/snippet}

{#snippet tiffy(variant: "panel" | "hero")}
  <TiffyPanel
    {variant}
    title={projectTitle}
    onBack={variant === "panel" ? () => void returnHome() : null}
    {brandName}
    onManageBrand={openBrandKit}
    onOpenMusic={() => openPage("music")}
    onOpenAssets={() => openPage("assets")}
    {assistantMessages}
    bind:assistantDraft
    bind:composerInput
    {activityVerb}
    {pendingAssets}
    {classifiedAssets}
    {stagedPreviews}
    {uploadingMedia}
    {uploadProgress}
    {uploadPreview}
    {uploadName}
    {isErrorMessage}
    {handleFixError}
    {isRetryMessage}
    {retryLastPrompt}
    {classifyStagedAsset}
    {removeStagedAsset}
    {submitAssistant}
    {resizeComposer}
    {composerKeydown}
    {handlePaste}
    onAttach={() => mediaInput.click()}
    selectedAudio={$selectedAudio}
    removeSelectedAudio={(track) => deselectAudioTrack(track.id)}
    onDropFiles={handleChatDrop}
  />
{/snippet}

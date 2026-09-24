<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { AppMode } from "../app/mode";
  import { currentMotionlyUser, signOut } from "../auth";
  import type { MotionlyUser } from "../auth";
  import AuthDialog from "./auth/AuthDialog.svelte";
  import {
    ArrowLeft,
    Braces,
    Download,
    Eye,
    EyeOff,
    FileText,
    FolderOpen,
    Image as ImageIcon,
    Layers3,
    Maximize2,
    Minus,
    PanelBottomClose,
    PanelBottomOpen,
    Pause,
    Play,
    Plus,
    Save,
    Sparkles,
    Upload,
    X,
  } from "lucide-svelte";
  import { createDynamicComposition } from "../composition/dynamic-compiler";
  import { createGeneratedAdapterSource } from "../composition/generated-adapter";
  import {
    applyEditorField,
    editorFieldValue,
    readEditorGroup,
  } from "../composition/editor-schema";
  import { hydratePresetAssets } from "../compositions/preset-assets";
  import {
    BackendConversationResponse,
    generateWithDirectAi,
    type DirectAiResult,
  } from "../ai/direct-ai";
  import { ProjectsApi, type AudioTrack } from "../cloud/projects-api";
  import {
    userEditedIds,
    type GenerationPlanMemory,
  } from "../ai/generation-guidance";
  import {
    resolveGenerationBasis,
    type GenerationBasis,
  } from "../ai/generation-basis";
  import {
    blankProjectFiles,
    blankScenes,
    createBlankComposition,
  } from "./blank-project";
  import CloudProjectGallery from "../cloud/CloudProjectGallery.svelte";
  import { carryEditorState } from "../composition/editor-state-carry";
  import EarlyNoticeCard from "./EarlyNoticeCard.svelte";
  import {
    combineCompositionSource,
    splitCompositionSource,
  } from "../cloud/project-source";
  import type {
    ProjectSourceFiles,
    ProjectSummary,
  } from "../cloud/projects-api";
  import {
    downloadBlob,
    exportPng,
    exportVideo,
  } from "../composition/exporter";
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
    appleNotesPreset,
    claudePreset,
    kiriTtsPreset,
    motifyPreset,
    motionlyPromoPreset,
    recoupPreset,
    relayPreset,
    tesseraPreset,
  } from "../compositions/presets";
  import appleNotesHtmlSource from "../compositions/presets/apple-notesapp/composition.html?raw";
  import appleNotesAdapterSource from "../compositions/presets/apple-notesapp/index.ts?raw";
  import appleNotesTimelineSource from "../compositions/presets/apple-notesapp/timeline.js?raw";
  import claudeHtmlSource from "../compositions/presets/claude/composition.html?raw";
  import claudeAdapterSource from "../compositions/presets/claude/index.ts?raw";
  import claudeTimelineSource from "../compositions/presets/claude/timeline.js?raw";
  import kiriTtsHtmlSource from "../compositions/presets/KiriTTS/composition.html?raw";
  import kiriTtsAdapterSource from "../compositions/presets/KiriTTS/index.ts?raw";
  import kiriTtsTimelineSource from "../compositions/presets/KiriTTS/timeline.js?raw";
  import motionlyPromoHtmlSource from "../compositions/presets/motionly-promo/composition.html?raw";
  import motionlyPromoAdapterSource from "../compositions/presets/motionly-promo/index.ts?raw";
  import motionlyPromoTimelineSource from "../compositions/presets/motionly-promo/timeline.js?raw";
  import motifyHtmlSource from "../compositions/presets/motify/composition.html?raw";
  import motifyAdapterSource from "../compositions/presets/motify/index.ts?raw";
  import motifyTimelineSource from "../compositions/presets/motify/timeline.js?raw";
  import tesseraHtmlSource from "../compositions/presets/tessera/composition.html?raw";
  import tesseraAdapterSource from "../compositions/presets/tessera/index.ts?raw";
  import tesseraTimelineSource from "../compositions/presets/tessera/timeline.js?raw";
  import relayHtmlSource from "../compositions/presets/relay/composition.html?raw";
  import relayAdapterSource from "../compositions/presets/relay/index.ts?raw";
  import relayTimelineSource from "../compositions/presets/relay/timeline.js?raw";
  import recoupHtmlSource from "../compositions/presets/recoup/composition.html?raw";
  import recoupAdapterSource from "../compositions/presets/recoup/index.ts?raw";
  import recoupTimelineSource from "../compositions/presets/recoup/timeline.js?raw";
  import {
    deriveSceneTracks,
    formatTimelineSeconds,
    type SceneTrack,
  } from "./timeline-data";
  import AnimationControls from "./AnimationControls.svelte";
  import TiffyPanel from "./cloud/TiffyPanel.svelte";
  import MusicPanel from "./cloud/MusicPanel.svelte";
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
  import {
    isFatalRenderFailure,
    validateGeneratedComposition,
    type ValidatedGeneration,
  } from "../ai/validate-generation";
  import {
    clearLocalAssets,
    generationAsset,
    hydrateAssetTokens,
    readLocalAsset,
    storeLocalAsset,
    type LocalAssetReference,
    type AssetIntent,
  } from "../stores/local-assets";
  import {
    clearProjectDrafts,
    loadProjectDraft,
    saveProjectDraft,
  } from "../stores/project-drafts";
  import { loadLocalProject, saveLocalProject } from "./local-project";
  import { observeCandidateFilm } from "./frame-capture";
  import { captureEvent, identifyAnalyticsUser } from "../posthog";
  import "./styles/editor-shell.css";
  import "./styles/content-panel.css";
  import "./styles/preview-stage.css";
  import "./styles/properties-inspector.css";
  import "./styles/timeline-panel.css";
  import "./styles/editor-theme.css";
  import "./styles/editor-sleek.css";
  import "./styles/music-panel.css";

  export let mode: AppMode = "cloud";

  type EditorTab = "chat" | "presets" | "music";

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

  const claudeProjectFiles = splitCompositionSource(
    claudeHtmlSource,
    claudeTimelineSource,
    claudeAdapterSource,
  );
  const kiriTtsProjectFiles = splitCompositionSource(
    kiriTtsHtmlSource,
    kiriTtsTimelineSource,
    kiriTtsAdapterSource,
  );
  const motionlyPromoProjectFiles = splitCompositionSource(
    motionlyPromoHtmlSource,
    motionlyPromoTimelineSource,
    motionlyPromoAdapterSource,
  );
  const motifyProjectFiles = splitCompositionSource(
    motifyHtmlSource,
    motifyTimelineSource,
    motifyAdapterSource,
  );
  const appleNotesProjectFiles = splitCompositionSource(
    appleNotesHtmlSource,
    appleNotesTimelineSource,
    appleNotesAdapterSource,
  );
  const tesseraProjectFiles = splitCompositionSource(
    tesseraHtmlSource,
    tesseraTimelineSource,
    tesseraAdapterSource,
  );
  const relayProjectFiles = splitCompositionSource(
    relayHtmlSource,
    relayTimelineSource,
    relayAdapterSource,
  );
  const recoupProjectFiles = splitCompositionSource(
    recoupHtmlSource,
    recoupTimelineSource,
    recoupAdapterSource,
  );
  const activeDraftKey = "active";

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
  let activeTab: EditorTab = mode === "local" ? "presets" : "chat";
  let localPanelOpen = false;
  let localPanelView: "presets" | "source" | "assets" = "presets";
  let localAssets: string[] = [];
  let inspectorTab: "design" | "animate" = "design";
  // The full layer timeline is opt-in; by default the canvas gets the room and
  // only the scenes bar sits under it.
  let timelineOpen = false;
  let sceneBarScrubbing = false;
  let exporting = false;
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
  let animationSpeed = 1;
  let animationEase = "power3.inOut";
  let currentUser: MotionlyUser | null = null;
  let authChecked = false;
  let authDialogOpen = false;
  let authDialogMode: "signin" | "signup" = "signin";
  let promptHeldForAuth = "";
  let workspaceId = "";
  let pendingLandingPrompt = "";
  let landingPromptStarted = false;
  let draftSaveTimer: ReturnType<typeof setTimeout> | undefined;
  let assetObjectUrls: string[] = [];
  let selectedEditorGroup: EditorGroupDefinition | null = null;
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
    } else if (
      $generationStore.status === "AWAITING_APPLY" &&
      lastGenState !== "AWAITING_APPLY"
    ) {
      lastGenState = "AWAITING_APPLY";
      assistantMessages = [
        ...assistantMessages,
        { role: "assistant", text: $generationStore.message },
      ];
    } else if ($generationStore.error && lastGenState !== "ERROR") {
      lastGenState = "ERROR";
      assistantMessages = [
        ...assistantMessages,
        { role: "assistant", text: "Error: " + $generationStore.error },
      ];
    }
  }
  let timelineMode: TimelineMode = "project";
  let sourceOpen = false;
  let cloudFiles: ProjectSourceFiles = { ...blankProjectFiles };
  let cloudProject: ProjectSummary | null = null;
  let localProjectName = "";
  let backendGenerationProjectId = "";

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
      activeTab = "chat";
    }
    if (mode === "cloud") {
      void currentMotionlyUser().then((user) => {
        currentUser = user;
        authChecked = true;
        if (user) identifyAnalyticsUser(user);
        // A prompt carried over from motionly.site is what the visitor came
        // for, so a guest is asked to make an account right away.
        else if (pendingLandingPrompt) openAuthDialog("signup");
      });
    }
    mountComposition(activeComposition);
    void restoreStartupProject().finally(() => {
      if (mode === "cloud") void runLandingPrompt();
    });
    const restoreRouteProject = () => void restoreProjectFromRoute();
    if (mode === "cloud")
      window.addEventListener("popstate", restoreRouteProject);
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
      window.removeEventListener("popstate", restoreRouteProject);
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
      syncAnimationControls();
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
  }

  function scheduleDraftSave(): void {
    if (typeof localStorage === "undefined") return;
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      if (!runtime) return;
      saveProjectDraft(activeDraftKey, {
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
    if (mode !== "local") {
      await restoreLocalDraft();
      return;
    }
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
    await restoreLocalDraft();
  }

  async function restoreLocalDraft(): Promise<void> {
    const draft = loadProjectDraft(activeDraftKey);
    if (!draft) return;
    // Preset artwork lives in the composition source as __ASSET_*__ placeholders,
    // so it must resolve on every remount, independent of chat attachments.
    const hydrated = await hydrateAssetTokens(
      hydratePresetAssets(combineCompositionSource(draft.files)),
      draft.assets,
    );
    cloudFiles = { ...draft.files };
    assistantMessages = [...draft.messages];
    stagedAssets = [...draft.assets];
    generationPlan = draft.plan ?? null;
    void ensureStagedPreviews(stagedAssets);
    assetObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    assetObjectUrls = hydrated.objectUrls;
    const composition = createDynamicComposition(
      hydrated.source,
      draft.files["timeline.js"],
      {
        title: draft.metadata.title,
        duration: draft.metadata.duration,
        scenes: draft.metadata.scenes,
      },
    );
    mountComposition(composition, draft.editorState);
    showNotice("Recovered your local Motify draft.");
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
    if (window.location.pathname === "/") return;
    window.history.pushState({}, "", "/");
  }

  async function restoreProjectFromRoute(): Promise<void> {
    const projectId = projectIdFromRoute();
    if (!projectId) {
      if (!cloudProject) return;
      cloudProject = null;
      backendGenerationProjectId = "";
      cloudFiles = { ...blankProjectFiles };
      cloudProjects?.startUnsaved(cloudFiles);
      mountComposition(createBlankComposition());
      return;
    }
    if (!cloudProjects || cloudProject?.id === projectId) return;
    await cloudProjects.openProjectById(projectId);
  }

  async function startNewProject(): Promise<void> {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    clearProjectDrafts();
    try {
      await clearLocalAssets();
    } catch {
      // A fresh editor can still start if browser asset cleanup is unavailable.
    }
    assetObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    assetObjectUrls = [];
    resetAssistantSession();
    cloudProject = null;
    localProjectName = "";
    backendGenerationProjectId = "";
    clearProjectRoute();
    cloudFiles = { ...blankProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    timelineMode = "project";
    sourceOpen = false;
    generationStore.set({
      isActive: false,
      status: "IDLE",
      stage: "IDLE",
      progress: 0,
      message: "",
    });
    mountComposition(createBlankComposition());
    runtime?.seek(0);
    captureEvent("project started", { source: "new_button" });
    showNotice("Started a new blank project and cleared local Motify data.");
  }

  function loadClaudePreset(): void {
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
    backendGenerationProjectId = "";
    clearProjectRoute();
    cloudFiles = { ...claudeProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(claudePreset);
    captureEvent("preset loaded", { preset_name: "claude" });
    showNotice("Claude Calorie & Climax preset loaded.");
  }

  function loadKiriTtsPreset(): void {
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
    backendGenerationProjectId = "";
    clearProjectRoute();
    cloudFiles = { ...kiriTtsProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(kiriTtsPreset);
    captureEvent("preset loaded", { preset_name: "kiri_tts" });
    showNotice("KiriTTS SaaS Ad preset loaded.");
  }

  function loadMotionlyPromoPreset(): void {
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
    backendGenerationProjectId = "";
    clearProjectRoute();
    cloudFiles = { ...motionlyPromoProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(motionlyPromoPreset);
    captureEvent("preset loaded", { preset_name: "motionly_promo" });
    showNotice("Motionly Promo preset loaded.");
  }

  function loadMotifyPreset(): void {
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
    clearProjectRoute();
    cloudFiles = { ...motifyProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(motifyPreset);
    captureEvent("preset loaded", { preset_name: "motify" });
    showNotice("Motify Launch Film preset loaded.");
  }

  function loadAppleNotesPreset(): void {
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
    backendGenerationProjectId = "";
    clearProjectRoute();
    cloudFiles = { ...appleNotesProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(appleNotesPreset);
    captureEvent("preset loaded", { preset_name: "apple_notes" });
    showNotice("Apple Notes 24s Product Film loaded.");
  }

  function loadTesseraPreset(): void {
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
    backendGenerationProjectId = "";
    clearProjectRoute();
    cloudFiles = { ...tesseraProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(tesseraPreset);
    captureEvent("preset loaded", { preset_name: "tessera" });
    showNotice("Tessera 20s data-contract film loaded.");
  }

  function loadRelayPreset(): void {
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
    backendGenerationProjectId = "";
    clearProjectRoute();
    cloudFiles = { ...relayProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(relayPreset);
    captureEvent("preset loaded", { preset_name: "relay" });
    showNotice("Relay 26s film loaded.");
  }

  function loadRecoupPreset(): void {
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
    backendGenerationProjectId = "";
    clearProjectRoute();
    cloudFiles = { ...recoupProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(recoupPreset);
    captureEvent("preset loaded", { preset_name: "recoup" });
    showNotice("Recoup 26s liquid-glass SaaS ad loaded.");
  }

  async function mountSavedProject(
    project: ProjectSummary,
    files: ProjectSourceFiles,
  ): Promise<void> {
    previewLoadSequence += 1;
    resetAssistantSession();
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
    const style = getComputedStyle(element);
    if (
      style.visibility === "hidden" ||
      style.display === "none" ||
      Number(style.opacity) <= 0.01
    ) {
      selectionRect = { visible: false, left: 0, top: 0, width: 0, height: 0 };
      return;
    }
    const rootRect = previewRoot.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();
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
  // wins; its nearest registered ancestor is the answer. Wrappers that fill the
  // frame (film roots, camera worlds, backgrounds) are skipped so a click lands
  // on the object under the cursor instead of the whole scene. Those layers stay
  // selectable from the timeline's layer list.
  function editableElementAtPoint(event: MouseEvent): string {
    if (!runtime || !previewRoot) return "";
    const activeRuntime = runtime;
    const rootRect = previewRoot.getBoundingClientRect();
    const rootArea = Math.max(1, rootRect.width * rootRect.height);

    const registeredAncestor = (
      element: Element | null,
    ): HTMLElement | null => {
      for (
        let node = element?.closest<HTMLElement>("[data-motionly-id]") ?? null;
        node && previewRoot.contains(node);
        node =
          node.parentElement?.closest<HTMLElement>("[data-motionly-id]") ?? null
      ) {
        const id = node.dataset["motionlyId"] ?? "";
        if (id && activeRuntime.elements.get(id) === node) return node;
      }
      return null;
    };
    const isVisible = (element: HTMLElement): boolean => {
      const style = getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0.01
      );
    };
    const areaRatio = (element: HTMLElement): number => {
      const rect = element.getBoundingClientRect();
      return (rect.width * rect.height) / rootArea;
    };
    const isBackdrop = (element: HTMLElement): boolean =>
      areaRatio(element) >= 0.85;

    // 1. What is painted under the pointer, topmost first.
    for (const element of document.elementsFromPoint(
      event.clientX,
      event.clientY,
    )) {
      if (!previewRoot.contains(element)) continue;
      const editable = registeredAncestor(element);
      if (editable && isVisible(editable) && !isBackdrop(editable)) {
        return editable.dataset["motionlyId"] ?? "";
      }
    }

    // 2. Layers that ignore pointer events: use their boxes, keep only the
    //    innermost ones, and take the smallest.
    const boxed: HTMLElement[] = [];
    for (const element of activeRuntime.elements.values()) {
      if (!previewRoot.contains(element) || !isVisible(element)) continue;
      if (isBackdrop(element)) continue;
      const rect = element.getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        boxed.push(element);
      }
    }
    const innermost = boxed.filter(
      (element) =>
        !boxed.some((other) => other !== element && element.contains(other)),
    );
    innermost.sort((a, b) => areaRatio(a) - areaRatio(b));
    return innermost[0]?.dataset["motionlyId"] ?? "";
  }

  function selectFromPreview(event: MouseEvent): void {
    if (
      event.target instanceof Element &&
      event.target.closest(".me-selection-overlay")
    ) {
      return;
    }
    const hitId = editableElementAtPoint(event);
    if (!hitId) {
      selectedId = "";
      selectedEditorGroup = null;
      updateSelectionRect();
      return;
    }
    timelineMode = "scene";
    selectedSceneId = snapshot.sceneId;
    selectedId = hitId;
    refreshSelectedEditorGroup();
    syncAnimationControls();
    updateSelectionRect();
  }

  function handlePreviewKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      selectedId = "";
      selectedEditorGroup = null;
      updateSelectionRect();
    }
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
    const current = currentOverride();
    selectionDrag = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
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
        ? { x: selectionDrag.x + dx, y: selectionDrag.y + dy }
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
    syncAnimationControls();
    updateSelectionRect();
  }

  function syncAnimationControls(): void {
    if (!runtime || !selectedId) {
      animationSpeed = 1;
      animationEase = "power3.inOut";
      return;
    }
    const settings = runtime.getAnimationOverride(selectedId);
    animationSpeed = settings.speed;
    animationEase = settings.ease;
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

  function isTextEditable(): boolean {
    if (!runtime || !selectedId) return false;
    const element = runtime.elements.get(selectedId);
    if (!element) return false;
    if (element.dataset["motionlySplitUnit"]) return true;
    if (element.children.length > 0) return false;
    return (
      selectedTrack()?.kind === "Text" || textElementTags.has(element.tagName)
    );
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

  function colorValue(property: ColorProperty, fallback: string): string {
    const override = currentOverride()[property];
    if (typeof override === "string")
      return normalizedColor(override, fallback);
    const element = selectedId ? runtime?.elements.get(selectedId) : undefined;
    if (!element) return fallback;
    const style = getComputedStyle(element);
    return normalizedColor(style[property], fallback);
  }

  function isBackgroundTransparent(): boolean {
    if (!runtime || !selectedId) return true;
    const override = currentOverride().backgroundColor;
    if (override === "transparent") return true;
    if (typeof override === "string" && override.trim()) {
      return (
        override.trim() === "transparent" ||
        override.trim() === "rgba(0, 0, 0, 0)"
      );
    }
    const element = runtime.elements.get(selectedId);
    if (!element) return true;
    const bg = getComputedStyle(element).backgroundColor;
    if (!bg || bg === "transparent") return true;
    const rgb = /^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?\s*\)$/i.exec(
      bg,
    );
    return rgb !== null && rgb[4] !== undefined && Number(rgb[4]) === 0;
  }

  function effectiveBackgroundColorHex(): string {
    const override = currentOverride().backgroundColor;
    if (override && override !== "transparent") {
      return normalizedColor(override, "#17191c");
    }
    const element = selectedId ? runtime?.elements.get(selectedId) : undefined;
    if (!element) return "#17191c";
    const bg = getComputedStyle(element).backgroundColor;
    return normalizedColor(bg, "#17191c");
  }

  function numericStyleValue(
    property: "fontSize" | "borderRadius",
    fallback: number,
  ): number {
    const override = currentOverride()[property];
    if (typeof override === "number") return override;
    const element = selectedId ? runtime?.elements.get(selectedId) : undefined;
    if (!element) return fallback;
    const parsed = Number.parseFloat(getComputedStyle(element)[property]);
    return Number.isFinite(parsed) ? parsed : fallback;
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

  function clearBackground(): void {
    if (!runtime || !selectedId) return;
    const patch = { backgroundColor: "transparent" };
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

  function animationSettings() {
    return selectedId && runtime
      ? runtime.getAnimationOverride(selectedId)
      : { speed: 1, ease: "power3.inOut", tweenCount: 0 };
  }

  function setAnimationSpeed(speed: number): void {
    if (!runtime || !selectedId) return;
    animationSpeed = speed;
    runtime.setAnimationOverride(selectedId, {
      speed: animationSpeed,
    });
    editorRevision += 1;
    scheduleDraftSave();
  }

  function setAnimationEase(ease: string): void {
    if (!runtime || !selectedId) return;
    animationEase = ease;
    runtime.setAnimationOverride(selectedId, { ease });
    editorRevision += 1;
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

  function selectTab(tab: EditorTab): void {
    sourceOpen = false;
    activeTab = tab;
  }

  function openLocalPanel(tab: "presets" | "source" | "assets"): void {
    if (tab === "source") {
      sourceOpen = true;
    } else {
      selectTab("presets");
    }
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
    selectTab("chat");
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

  function assistantGenerationBasis(): GenerationBasis & {
    editorState?: Partial<RuntimeEditorState>;
  } {
    const basis = resolveGenerationBasis(cloudFiles, activeComposition);
    if (basis.generationProfile === "claude-foundation-v1") return basis;
    return { ...basis, editorState: runtime?.exportEditorState() };
  }

  async function generateAndApplyAssistant(prompt: string): Promise<string> {
    const basis = assistantGenerationBasis();
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
        return validateGeneratedComposition(candidate, {
          prompt,
          previousHtml: currentHtml,
          previousDuration: basis.duration,
          previousScenes: basis.scenes,
          requiredAssetTokens: generationAssets
            .filter((asset) => asset.intent === "asset")
            .map((asset) => asset.token),
          renderedHtml: rendered.source,
          generationProfile: basis.generationProfile,
          userEditedIds: userEditedIds(basis.editorState),
          lenient,
        });
      } finally {
        rendered.objectUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    };

    const result = await generateWithDirectAi(
      prompt,
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
            fatal: isFatalRenderFailure(message),
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
          return await observeCandidateFilm({
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

  /**
   * Transport failures — no key, no quota, no network — do not get better by
   * asking the model again. Everything else is a composition the model can
   * repair from the failure text.
   */
  function isSelfRepairable(error: unknown, message: string): boolean {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      typeof error.status === "number" &&
      error.status >= 500
    ) {
      return false;
    }
    return !/api key|quota|rate limit|permission|unauthorized|forbidden|temporarily unavailable|took too long|cannot reach the model|\b(?:401|403|429|503)\b|network|failed to fetch/i.test(
      message,
    );
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
   * One silent repair attempt before the user ever sees an error. A failed
   * check is something the model can act on, so acting on it here is what the
   * user would do anyway by pressing Fix — done for them, once.
   */
  async function generateWithSelfRepair(prompt: string): Promise<string> {
    try {
      return await generateAndApplyAssistant(prompt);
    } catch (error: unknown) {
      if (error instanceof BackendConversationResponse) {
        backendGenerationProjectId =
          error.projectId ?? backendGenerationProjectId;
        return error.response;
      }
      const message =
        error instanceof Error ? error.message : "AI generation failed.";
      if (!isSelfRepairable(error, message)) throw error;
      generationStore.update((state) => ({
        ...state,
        message: "Repairing the composition and trying once more...",
      }));
      return await generateAndApplyAssistant(
        buildRepairInstruction(message, prompt),
      );
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
    await cloudProjects?.refreshSession();
    const held = promptHeldForAuth;
    promptHeldForAuth = "";
    if (held) {
      sessionStorage.removeItem("motionly_pending_prompt");
      pendingLandingPrompt = "";
      assistantDraft = held;
      activeTab = "chat";
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
  async function recoverSavedGeneration(): Promise<boolean> {
    const projectId = cloudProject?.id ?? backendGenerationProjectId;
    if (!projectId) return false;
    const shownRevision = cloudProject?.revision ?? 0;
    try {
      const api = new ProjectsApi();
      const [latestProject, source] = await Promise.all([
        api.getProject(projectId),
        api.getSource(projectId),
      ]);
      if (latestProject.revision <= shownRevision) return false;
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

  async function submitAssistant(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const prompt = assistantDraft.trim();
    if (!prompt || $generationStore.isActive) return;
    if (!requireAccount(prompt)) return;

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
        text: prompt,
        ...(sentAttachments.length ? { attachments: sentAttachments } : {}),
      },
    ];
    assistantDraft = "";
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
      const reply = await generateWithSelfRepair(prompt);
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
      showNotice("Tiffy updated the composition.");
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "AI generation failed.";
      if (await recoverSavedGeneration()) {
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
      const formattedError = errorMsg.startsWith("Error:")
        ? errorMsg
        : `Error: ${errorMsg}`;
      if (assistantMessages.at(-1)?.text !== formattedError) {
        assistantMessages = [
          ...assistantMessages,
          { role: "assistant", text: formattedError },
        ];
      }
      showNotice(errorMsg);
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
      showNotice("Tiffy repaired the composition.");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "AI fix failed.";
      generationStore.set({
        isActive: false,
        status: "FAILED",
        stage: "FAILED",
        progress: 0,
        message: "",
        error: errorMsg,
      });
      const formattedError = errorMsg.startsWith("Error:")
        ? errorMsg
        : `Error: ${errorMsg}`;
      if (assistantMessages.at(-1)?.text !== formattedError) {
        assistantMessages = [
          ...assistantMessages,
          { role: "assistant", text: formattedError },
        ];
      }
      showNotice(errorMsg);
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
    void restoreProjectFromRoute();
    void runLandingPrompt();
  }

  async function saveSource(): Promise<void> {
    if (mode === "local") {
      const saved = await saveLocalProject(cloudFiles);
      showNotice(saved ? "Saved local project." : "No local project is open.");
    } else {
      cloudProjects.setFiles(cloudFiles);
      await cloudProjects.saveActive();
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
    const escapedId = CSS.escape(id);
    const element = scope.querySelector<HTMLElement>(
      `[data-edit="${escapedId}"], [data-motionly-id="${escapedId}"], #${escapedId}`,
    );
    if (!element) return;

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
    if (merged.color !== undefined) element.style.color = merged.color;
    if (merged.backgroundColor !== undefined)
      element.style.backgroundColor = merged.backgroundColor;
    if (merged.fill !== undefined) element.style.fill = merged.fill;
    if (merged.stroke !== undefined) element.style.stroke = merged.stroke;
    if (merged.fontSize !== undefined)
      element.style.fontSize = `${merged.fontSize}px`;
    if (merged.borderRadius !== undefined)
      element.style.borderRadius = `${merged.borderRadius}px`;
    if (merged.hidden !== undefined)
      element.style.visibility = merged.hidden ? "hidden" : "";

    cloudFiles = {
      ...cloudFiles,
      "composition.html":
        template?.outerHTML ?? documentSource.body.innerHTML.trim(),
    };
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
    if (!runtime || exporting) return;
    exporting = true;
    exportStatus = "Initializing video export...";
    showNotice("Rendering full video export (1080p)...", 20000);
    try {
      const blob = await exportVideo(
        runtime,
        (_progress, statusText) => {
          exportStatus = statusText;
        },
        activeComposition.fps,
      );
      downloadBlob(blob, `motify-${activeComposition.fps}fps.mp4`);
      captureEvent("video exported", {
        fps: activeComposition.fps,
        duration_seconds: activeComposition.duration,
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

  async function exportFrame(): Promise<void> {
    if (!runtime || exporting) return;
    exporting = true;
    showNotice("Rendering current frame snapshot…", 6000);
    try {
      const blob = await exportPng(runtime, 1);
      downloadBlob(
        blob,
        `motify-${Math.round(snapshot.time * activeComposition.fps)}.png`,
      );
      captureEvent("frame exported", {
        frame: Math.round(snapshot.time * activeComposition.fps),
      });
      showNotice("Frame PNG saved.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Export failed.");
    } finally {
      exporting = false;
    }
  }

  function showNotice(message: string, duration = 3200): void {
    notice = message;
    window.setTimeout(() => {
      if (notice === message) notice = "";
    }, duration);
  }
</script>

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
      <div class="me-workbench">
        {#if mode === "cloud" || localPanelOpen}
          <aside class="me-left-panel">
            <div class="me-brand-row">
              <div class="brand">
                <span class="logo-shell"
                  ><img src="/logo.svg" alt="Motify" class="logo" /></span
                >
                <h1>Motify</h1>
              </div>
              <div class="me-brand-actions">
                {#if mode === "local"}
                  <button
                    class="me-ghost-icon-btn me-tooltip"
                    aria-label="Close editor controls"
                    data-tooltip="Close editor controls"
                    on:click={() => (localPanelOpen = false)}
                    ><X size={16} /></button
                  >
                {:else}
                  <button
                    class="me-ghost-icon-btn me-tooltip"
                    aria-label="Start a new blank project"
                    data-tooltip="New project"
                    on:click={startNewProject}
                    disabled={$generationStore.isActive || exporting}
                    ><Plus size={16} /></button
                  >
                {/if}
              </div>
            </div>
            <div class="me-panel-header">
              {#if mode === "local" && localPanelView === "assets"}
                <div class="me-panel-title"><ImageIcon size={15} /> Assets</div>
              {:else if sourceOpen}
                <div class="me-panel-title"><Braces size={15} /> Source</div>
                <button
                  class="me-header-icon-btn"
                  aria-label="Close composition source"
                  on:click={() => (sourceOpen = false)}><X size={15} /></button
                >
              {:else}
                <div class="me-panel-tabs">
                  {#if mode === "cloud"}
                    <button
                      class="me-panel-tab"
                      class:me-active={activeTab === "chat"}
                      on:click={() => selectTab("chat")}>Chat</button
                    >
                  {/if}
                  <button
                    class="me-panel-tab"
                    class:me-active={activeTab === "presets"}
                    on:click={() => selectTab("presets")}>Presets</button
                  >
                  {#if mode === "cloud"}
                    <button
                      class="me-panel-tab"
                      class:me-active={activeTab === "music"}
                      on:click={() => selectTab("music")}>Music</button
                    >
                  {/if}
                </div>
                {#if activeTab === "presets" && mode === "cloud"}
                  <button
                    class="me-import-header-btn me-tooltip"
                    data-tooltip="Import media"
                    on:click={() => mediaInput.click()}
                    ><Upload size={14} /> Import</button
                  >
                {:else}
                  <button
                    class="me-header-icon-btn me-tooltip"
                    aria-label="Open composition HTML source"
                    data-tooltip="Composition source"
                    on:click={openTimelineSource}><Braces size={15} /></button
                  >
                {/if}
              {/if}
            </div>

            {#if mode === "local" && localPanelView === "assets"}
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
                  {(cloudProject?.name ?? localProjectName) ||
                    "Unsaved project"} / composition.html
                </div>
                <pre class="source-code">{cloudFiles["composition.html"]}</pre>
                {#if mode === "local"}
                  <h3 class="me-category-title">styles.css</h3>
                  <pre class="source-code">{cloudFiles["styles.css"]}</pre>
                  <h3 class="me-category-title">timeline.js</h3>
                  <pre class="source-code">{cloudFiles["timeline.js"]}</pre>
                  <h3 class="me-category-title">index.ts</h3>
                  <pre class="source-code">{cloudFiles["index.ts"]}</pre>
                {/if}
              </div>
            {:else if activeTab === "presets"}
              <div class="me-panel-content">
                <h3 class="me-category-title">Presets</h3>
                <div class="me-preset-grid">
                  <button class="me-preset-card" on:click={loadClaudePreset}>
                    <span class="me-preset-thumbnail claude-thumbnail">
                      <span class="promo-thumbnail-art"
                        ><small>RESEARCH / REASON / CREATE</small><strong
                          >CLAUDE<br /><em>THINKS.</em></strong
                        ><i>PROMPT · ARTIFACT · ACTION</i></span
                      >
                    </span>
                    <span class="me-preset-info"
                      ><strong class="me-preset-name"
                        >Claude Calorie & Climax</strong
                      >
                      <small>24.5s · Build, Macro Zoom & Climax</small></span
                    >
                  </button>
                  <button class="me-preset-card" on:click={loadMotifyPreset}>
                    <span class="me-preset-thumbnail promo-thumbnail">
                      <span class="promo-thumbnail-art"
                        ><small>CODE-FIRST MOTION</small><strong
                          >MOTIFY<br /><em>LAUNCH.</em></strong
                        ><i>PROMPT · EDIT · EXPORT</i></span
                      >
                    </span>
                    <span class="me-preset-info"
                      ><strong class="me-preset-name">Motify Launch Film</strong
                      >
                      <small>52s · Product story and showcase</small></span
                    >
                  </button>
                  <button class="me-preset-card" on:click={loadKiriTtsPreset}>
                    <span class="me-preset-thumbnail kiritts-thumbnail">
                      <span class="promo-thumbnail-art"
                        ><small>UNIFIED AI VOICE</small><strong
                          >KIRI<br /><em>TTS.</em></strong
                        ><i>TTS · STT · CLONING · API</i></span
                      >
                    </span>
                    <span class="me-preset-info"
                      ><strong class="me-preset-name">KiriTTS SaaS Ad</strong>
                      <small>28.5s · 5 Acts · Claude-Grade Camera</small></span
                    >
                  </button>
                  <button
                    class="me-preset-card"
                    on:click={loadAppleNotesPreset}
                  >
                    <span class="me-preset-thumbnail apple-notes-thumbnail">
                      <span class="promo-thumbnail-art"
                        ><small>EXPANSIVE CAMERA</small><strong
                          >APPLE<br /><em>NOTES.</em></strong
                        ><i>GLASS · ECOSYSTEM · PENCIL</i></span
                      >
                    </span>
                    <span class="me-preset-info"
                      ><strong class="me-preset-name">Apple Notes</strong>
                      <small>24s · 2.5D Expansive Camera</small></span
                    >
                  </button>
                  <button class="me-preset-card" on:click={loadTesseraPreset}>
                    <span class="me-preset-thumbnail tessera-thumbnail">
                      <span class="promo-thumbnail-art"
                        ><small>DATA CONTRACT</small><strong
                          >ONE<br /><em>SHAPE.</em></strong
                        ><i>CORRIDOR · GATE · CONTRACT</i></span
                      >
                    </span>
                    <span class="me-preset-info"
                      ><strong class="me-preset-name">Tessera</strong>
                      <small>20s · Transformation, no UI shell</small></span
                    >
                  </button>
                  <button class="me-preset-card" on:click={loadRelayPreset}>
                    <span class="me-preset-thumbnail relay-thumbnail"
                      ><span class="promo-thumbnail-art"
                        ><small>REVIEW AND HANDOFF</small><strong
                          >PASS<br /><em>IT ON.</em></strong
                        ><i>26 SECOND PRODUCT FILM</i></span
                      ></span
                    >
                    <span class="me-preset-info"
                      ><strong class="me-preset-name">Relay</strong><small
                        >26s &middot; Review and handoff</small
                      ></span
                    >
                  </button>
                  <button class="me-preset-card" on:click={loadRecoupPreset}>
                    <span class="me-preset-thumbnail recoup-thumbnail"
                      ><span class="promo-thumbnail-art"
                        ><small>FAILED PAYMENT RECOVERY</small><strong
                          >WIN IT<br /><em>BACK.</em></strong
                        ><i>LIQUID GLASS &middot; 3D CAMERA</i></span
                      ></span
                    >
                    <span class="me-preset-info"
                      ><strong class="me-preset-name">Recoup</strong><small
                        >26s &middot; Liquid glass, 3D camera</small
                      ></span
                    >
                  </button>
                  <button
                    class="me-preset-card"
                    on:click={loadMotionlyPromoPreset}
                  >
                    <span class="me-preset-thumbnail promo-thumbnail">
                      <span class="promo-thumbnail-art"
                        ><small>KINETIC PRODUCT FILM</small><strong
                          >MAKE IT<br /><em>MOVE.</em></strong
                        ><i>EDITORIAL · SAAS · GSAP</i></span
                      >
                    </span>
                    <span class="me-preset-info"
                      ><strong class="me-preset-name">Motionly Promo</strong>
                      <small>20s · HTML/CSS + GSAP</small></span
                    >
                  </button>
                </div>
                <p class="panel-copy">
                  Fast kinetic type, native product UI, overlapping handoffs,
                  and one directed GSAP timeline. No generated media.
                </p>
              </div>
            {:else if activeTab === "music" && mode === "cloud"}
              <MusicPanel
                api={musicApi}
                {workspaceId}
                busy={$generationStore.isActive}
                onUse={useAudioTrack}
                onRemoveFromProject={removeAudioFromProject}
                onNotice={(message) => showNotice(message)}
              />
            {:else if mode === "cloud"}
              <TiffyPanel
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
            {/if}
          </aside>
        {/if}

        <div class="me-center-column">
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
                >{(cloudProject?.name ?? localProjectName) ||
                  "Unsaved Motify project"}</span
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
              {#if mode === "cloud"}
                <button
                  class="btn"
                  title="Open a saved project"
                  on:click={() => cloudProjects.openManager()}
                  ><FolderOpen size={15} /><span>Open</span></button
                >
              {/if}
              <button class="btn" title="Save project" on:click={saveSource}
                ><Save size={15} /><span>Save</span></button
              >
              <button
                class="btn me-tooltip"
                data-tooltip="Export current frame as PNG"
                on:click={exportFrame}
                disabled={exporting}
              >
                <ImageIcon size={15} /><span>PNG</span>
              </button>
              <button
                class="btn btn-primary me-export-compact"
                aria-label="Export video"
                on:click={exportFullVideo}
                disabled={exporting}><Download size={15} /></button
              >
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
                    <div class="me-selection-badge">
                      <span class="badge-label"
                        >{selectedEditorGroup?.label ??
                          selectedTrack()?.label ??
                          selectedId}</span
                      >
                      <span class="badge-dims"
                        >{Math.round(selectionRect.width)} × {Math.round(
                          selectionRect.height,
                        )}</span
                      >
                    </div>
                  </div>
                {/if}
              </div>
            </div>
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
          {#if timelineOpen}
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

        <aside class="me-properties-panel">
          <div class="me-inspector-head">
            {#if mode === "cloud" && authChecked}
              {#if currentUser}
                <button
                  class="account-status account-status--button"
                  title={`${currentUser.email} — sign out`}
                  on:click={signOutOfMotify}
                >
                  <span class="account-avatar" aria-hidden="true"
                    >{(currentUser.displayName || currentUser.email)
                      .trim()
                      .charAt(0)
                      .toUpperCase()}</span
                  >
                  <span>{currentUser.displayName || currentUser.email}</span>
                </button>
              {:else}
                <button
                  class="account-status account-status--button account-status--signed-out"
                  on:click={() => openAuthDialog("signin")}
                >
                  <span class="account-status__dot" aria-hidden="true"></span>
                  <span>Sign in</span>
                </button>
              {/if}
            {:else}
              <span></span>
            {/if}
            <button
              class="btn btn-primary export-action me-tooltip"
              data-tooltip="Render and download 1080p video"
              on:click={exportFullVideo}
              disabled={exporting}
            >
              <Download size={15} /><span
                >{exporting ? exportStatus || "Rendering…" : "Export"}</span
              >
            </button>
          </div>
          <div class="me-inspector-tabs" role="tablist">
            <button
              class="me-inspector-tab"
              role="tab"
              aria-selected={inspectorTab === "design"}
              class:me-active={inspectorTab === "design"}
              on:click={() => (inspectorTab = "design")}>Design</button
            >
            <button
              class="me-inspector-tab"
              role="tab"
              aria-selected={inspectorTab === "animate"}
              class:me-active={inspectorTab === "animate"}
              on:click={() => (inspectorTab = "animate")}>Animate</button
            >
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
              {#if inspectorTab === "animate"}
                <div class="me-primary-properties me-animate-properties">
                  <AnimationControls
                    speed={animationSpeed}
                    ease={animationEase}
                    tweenCount={animationSettings().tweenCount}
                    onSpeed={setAnimationSpeed}
                    onEase={setAnimationEase}
                  />
                </div>
              {:else}
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
                    {#if isTextEditable() && (selectedEditorGroup?.fields.length ?? 0) === 0}
                      <section class="me-inspector-section">
                        <div class="me-section-title">Text</div>
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
                        <div class="me-field-line">
                          <label
                            class="me-property-label"
                            for="property-font-size">Size</label
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
                      </section>
                    {/if}
                    <section class="me-inspector-section">
                      <div class="me-section-title">Transform</div>
                      <div class="me-field-line">
                        <span class="me-property-label">Position</span>
                        <div class="me-field-pair">
                          <label class="me-field"
                            ><span class="me-field-prefix">X</span>
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
                            ><span class="me-field-prefix">Y</span>
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
                          ><span class="me-field-prefix">×</span>
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
                          ><span class="me-field-prefix">∠</span>
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
                      {:else}
                        <label class="me-field-line">
                          <span class="me-property-label"
                            >{isTextEditable() ? "Text" : "Fill"}</span
                          >
                          <span class="me-color-control">
                            <input
                              class="me-color-swatch"
                              aria-label={isTextEditable()
                                ? "Text color"
                                : "Foreground color"}
                              type="color"
                              value={colorValue("color", "#111318")}
                              on:input={(event) => setColor("color", event)}
                            />
                            <output>{colorValue("color", "#111318")}</output>
                          </span>
                        </label>
                        <div class="me-field-line">
                          <span class="me-property-label">Background</span>
                          <div
                            class="me-color-control"
                            class:me-transparent-bg={isBackgroundTransparent()}
                          >
                            <input
                              class="me-color-swatch"
                              aria-label="Background color"
                              type="color"
                              value={effectiveBackgroundColorHex()}
                              on:input={(event) =>
                                setColor("backgroundColor", event)}
                            />
                            <output
                              >{isBackgroundTransparent()
                                ? "None"
                                : colorValue(
                                    "backgroundColor",
                                    "#17191c",
                                  )}</output
                            >
                            {#if !isBackgroundTransparent()}
                              <button
                                class="me-color-clear"
                                type="button"
                                aria-label="Clear background"
                                on:click={clearBackground}
                                ><X size={12} /></button
                              >
                            {/if}
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
              {/if}
            {:else}
              <div class="me-properties-empty">
                <Sparkles size={30} /><strong>Select an element</strong><span
                  >Click an editable object in the preview to change its visual
                  properties.</span
                >
              </div>
            {/if}
          </div>
        </aside>
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
        ? "Create your account to run this prompt"
        : "Sign in to Motify"}
      subtitle={promptHeldForAuth || pendingLandingPrompt
        ? "Tiffy builds your film inside your own workspace, so your prompt is waiting right here until you are signed in."
        : "Sign in or create an account to save projects and generate with Tiffy."}
      onauthenticated={handleAuthenticated}
      onclose={cancelAuthDialog}
    />
    <CloudProjectGallery
      bind:this={cloudProjects}
      initialFiles={blankProjectFiles}
      width={1920}
      height={1080}
      fps={60}
      duration={5}
      on:cloudready={handleCloudReady}
      on:projectchange={handleCloudProjectChange}
      on:notice={(event) => showNotice(event.detail)}
    />
  {/if}
</div>

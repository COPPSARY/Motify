<script lang="ts">
  import { onMount, tick } from "svelte";
  import { currentMotionlyUser, motionlyLoginUrl } from "../auth";
  import type { MotionlyUser } from "../auth";
  import {
    ArrowLeft,
    ArrowUp,
    Braces,
    Download,
    Eye,
    EyeOff,
    FileText,
    Image as ImageIcon,
    Layers3,
    Maximize2,
    Pause,
    Play,
    Plus,
    RefreshCcw,
    Save,
    SlidersHorizontal,
    Sparkles,
    Upload,
    Wand2,
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
  import { generateWithDirectAi, type DirectAiResult } from "../ai/direct-ai";
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
  import EarlyNoticeCard from "./EarlyNoticeCard.svelte";
  import {
    combineCompositionSource,
    hydrateBuiltinPreviewAssets,
    splitCompositionSource,
  } from "../cloud/project-source";
  import { ProjectsApi } from "../cloud/projects-api";
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
    motionlyPromoPreset,
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
  import promoLogoUrl from "../compositions/presets/motionly-promo/logo.svg?url";
  import promoUiScreenshotUrl from "../compositions/presets/motionly-promo/ui-screenshot.png?url";
  import {
    deriveSceneTracks,
    formatTimelineSeconds,
    type SceneTrack,
  } from "./timeline-data";
  import AnimationControls from "./AnimationControls.svelte";
  import { generationStore } from "../stores/generation";
  import { uploadAsset } from "../api/assets";
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
  } from "../stores/local-assets";
  import {
    clearProjectDrafts,
    loadProjectDraft,
    saveProjectDraft,
  } from "../stores/project-drafts";
  import { captureEvent, identifyAnalyticsUser } from "../posthog";
  import "./styles/editor-shell.css";
  import "./styles/content-panel.css";
  import "./styles/preview-stage.css";
  import "./styles/properties-inspector.css";
  import "./styles/storyboard-strip.css";
  import "./styles/timeline-panel.css";
  import "./styles/editor-theme.css";

  type EditorTab = "chat" | "presets";

  type TimelineMode = "project" | "scene";

  interface AssistantMessage {
    role: "user" | "assistant";
    text: string;
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
  const appleNotesProjectFiles = splitCompositionSource(
    appleNotesHtmlSource,
    appleNotesTimelineSource,
    appleNotesAdapterSource,
  );
  const previewApi = new ProjectsApi();
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
  // Thumbnails for the attachment chips. Kept apart from assetObjectUrls, which
  // is revoked wholesale on every regeneration.
  let stagedPreviews: Record<string, string> = {};
  let uploadingMedia = false;
  let runtime: CompositionRuntime | null = null;
  let runtimeUnsubscribe: (() => void) | null = null;
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
  let activeTab: EditorTab = "chat";
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
  let workspaceId = "";
  let pendingLandingPrompt = "";
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
    const promptFromUrl = url.searchParams.get("prompt")?.trim() ?? "";
    pendingLandingPrompt =
      promptFromUrl || sessionStorage.getItem("motionly_pending_prompt") || "";
    if (pendingLandingPrompt) {
      sessionStorage.setItem("motionly_pending_prompt", pendingLandingPrompt);
      url.searchParams.delete("prompt");
      window.history.replaceState({}, "", url);
      activeTab = "chat";
    }
    void currentMotionlyUser().then((user) => {
      currentUser = user;
      authChecked = true;
      if (user) {
        identifyAnalyticsUser(user);
      }
    });
    mountComposition(activeComposition);
    void restoreLocalDraft().then(() => {
      void startPendingLandingPrompt();
    });
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
    activityTimer = setInterval(() => {
      if (!$generationStore.isActive) return;
      const currentIndex = activityVerbs.indexOf(activityVerb);
      const nextIndex = (currentIndex + 1) % activityVerbs.length;
      activityVerb =
        activityVerbs[nextIndex] ?? activityVerbs[0] ?? "Composing";
    }, 1200);
    return () => {
      runtimeUnsubscribe?.();
      cancelAnimationFrame(playbackFrame);
      if (activityTimer) clearInterval(activityTimer);
      if (draftSaveTimer) clearTimeout(draftSaveTimer);
      window.removeEventListener("pointermove", updateSelectionDrag);
      window.removeEventListener("pointerup", endSelectionDrag);
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
    runtime?.destroy();
    activeComposition = composition;
    selectedId = "";
    selectedEditorGroup = null;
    selectedSceneId = composition.scenes[0]?.id ?? "";
    runtime = new CompositionRuntime(composition, previewRoot);
    runtime.importEditorState(editorState);
    if (previousSelectedId && runtime.elements.has(previousSelectedId)) {
      selectedId = previousSelectedId;
      refreshSelectedEditorGroup();
      syncAnimationControls();
    }
    runtimeUnsubscribe = runtime.subscribe((value) => {
      snapshot = value;
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
    }, 180);
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
    showNotice("Recovered your local Motionly draft.");
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
    showNotice("Started a new blank project and cleared local Motionly data.");
  }

  function loadClaudePreset(): void {
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
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
    cloudFiles = { ...motionlyPromoProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(motionlyPromoPreset);
    captureEvent("preset loaded", { preset_name: "motionly_promo" });
    showNotice("Motionly Promo preset loaded.");
  }

  function loadAppleNotesPreset(): void {
    previewLoadSequence += 1;
    resetAssistantSession();
    cloudProject = null;
    cloudFiles = { ...appleNotesProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(appleNotesPreset);
    captureEvent("preset loaded", { preset_name: "apple_notes" });
    showNotice("Apple Notes 24s Product Film loaded.");
  }

  async function mountSavedProject(project: ProjectSummary): Promise<void> {
    const sequence = ++previewLoadSequence;
    resetAssistantSession();
    try {
      const preview = await previewApi.getPreview(project.id);
      const hydratedBundle = hydrateBuiltinPreviewAssets(preview.bundle, {
        logo: promoLogoUrl,
        uiScreenshot: promoUiScreenshotUrl,
      });
      const url = URL.createObjectURL(
        new Blob([hydratedBundle], { type: "text/javascript" }),
      );
      try {
        const module = (await import(/* @vite-ignore */ url)) as {
          default?: CompositionDefinition;
        };
        if (sequence !== previewLoadSequence) return;
        const composition = module.default;
        if (
          !composition ||
          typeof composition.build !== "function" ||
          !Array.isArray(composition.scenes)
        ) {
          throw new Error(
            "The saved project did not export a valid Motionly composition.",
          );
        }
        projectStyles?.remove();
        projectStyles = document.createElement("style");
        projectStyles.dataset["motionlyProjectStyles"] = project.id;
        projectStyles.textContent = preview.styles;
        document.head.append(projectStyles);
        mountComposition(composition);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (sequence !== previewLoadSequence) return;
      showNotice(
        error instanceof Error
          ? `Could not open saved preview: ${error.message}`
          : "Could not open saved preview.",
        10000,
      );
    }
  }

  function fitPreview(): void {
    if (!previewStage) return;
    const width = Math.max(1, previewStage.clientWidth - 72);
    const height = Math.max(1, previewStage.clientHeight - 72);
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

  function editableElementAtPoint(event: MouseEvent): string {
    if (!runtime || !previewRoot) return "";
    const candidates = new Map<string, HTMLElement>();
    const addCandidate = (element: Element | null): void => {
      const editable = element?.closest<HTMLElement>("[data-motionly-id]");
      const id = editable?.dataset["motionlyId"] ?? "";
      if (
        id &&
        editable &&
        previewRoot.contains(editable) &&
        runtime?.elements.get(id) === editable
      ) {
        candidates.set(id, editable);
      }
    };

    addCandidate(event.target instanceof Element ? event.target : null);
    for (const element of document.elementsFromPoint(
      event.clientX,
      event.clientY,
    )) {
      addCandidate(element);
    }

    for (const [id, element] of runtime.elements) {
      if (!previewRoot.contains(element)) continue;
      const style = getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) <= 0.01
      ) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        candidates.set(id, element);
      }
    }

    const rootRect = previewRoot.getBoundingClientRect();
    const rootArea = Math.max(1, rootRect.width * rootRect.height);
    return (
      [...candidates.entries()]
        .map(([id, element]) => {
          const group = readEditorGroup(id, element);
          const rect = element.getBoundingClientRect();
          let depth = 0;
          for (
            let parent = element.parentElement;
            parent && parent !== previewRoot;
            parent = parent.parentElement
          ) {
            depth += 1;
          }
          const zIndex = Number.parseInt(getComputedStyle(element).zIndex, 10);
          const score =
            (group.explicit ? 10_000 : 0) +
            (group.fields.length > 0 ? 5_000 : 0) +
            depth * 20 +
            (Number.isFinite(zIndex) ? zIndex : 0) -
            ((rect.width * rect.height) / rootArea) * 100;
          return { id, score };
        })
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0]?.id ??
      ""
    );
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
    try {
      const reference = await storeLocalAsset(file, file.name);
      if (workspaceId) {
        try {
          reference.uploadId = await uploadAsset(workspaceId, file);
        } catch {
          // The browser-local image remains editable and recoverable.
        }
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
    if (file) await stageAsset(file, file.name);
    input.value = "";
  }

  async function ensureStagedPreviews(
    assets: readonly LocalAssetReference[],
  ): Promise<void> {
    for (const asset of assets) {
      if (stagedPreviews[asset.id]) continue;
      try {
        const blob = await readLocalAsset(asset.id);
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

  function removeStagedAsset(asset: LocalAssetReference): void {
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
    assistantMessages = [];
    assistantDraft = "";
    generationPlan = null;
  }

  async function stageAsset(file: File, name: string): Promise<void> {
    uploadingMedia = true;
    showNotice(`Adding ${name}...`);
    try {
      const reference = await storeLocalAsset(file, name);
      if (workspaceId) {
        try {
          reference.uploadId = await uploadAsset(workspaceId, file);
        } catch {
          // Direct AI can still use the IndexedDB copy.
        }
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
    const currentHtml = combineCompositionSource(basis.files);
    const currentJs = basis.files["timeline.js"] || "";
    const generationAssets = await Promise.all(
      stagedAssets.map(generationAsset),
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
      const rendered = await hydrateAssetTokens(
        hydratePresetAssets(candidate.compositionHtml),
        stagedAssets,
      );
      try {
        return validateGeneratedComposition(candidate, {
          prompt,
          previousHtml: currentHtml,
          previousDuration: basis.duration,
          previousScenes: basis.scenes,
          requiredAssetTokens: generationAssets.map((asset) => asset.token),
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
        compositionHtml: currentHtml,
        timelineJs: currentJs,
        stylesCss: basis.files["styles.css"],
        indexTs: basis.files["index.ts"],
        conversation: assistantMessages,
        editorState: basis.editorState,
        assets: generationAssets,
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
    );

    const hydrated = await hydrateAssetTokens(
      hydratePresetAssets(result.compositionHtml),
      stagedAssets,
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
    mountComposition(dynamicComp, basis.editorState);
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
  function isSelfRepairable(message: string): boolean {
    return !/api key|quota|rate limit|permission|unauthorized|forbidden|\b(?:401|403|429|503)\b|network|failed to fetch/i.test(
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
      const message =
        error instanceof Error ? error.message : "AI generation failed.";
      if (!isSelfRepairable(message)) throw error;
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

  async function submitAssistant(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const prompt = assistantDraft.trim();
    if (!prompt || $generationStore.isActive) return;

    await runAssistantPrompt(prompt);
  }

  async function runAssistantPrompt(prompt: string): Promise<void> {
    assistantMessages = [...assistantMessages, { role: "user", text: prompt }];
    assistantDraft = "";
    await tick();
    resizeComposer();

    const generationStartedAt = performance.now();
    captureEvent("ai generation started", { prompt_length: prompt.length });
    generationStore.set({
      isActive: true,
      status: "GENERATING",
      stage: "GENERATING",
      progress: 20,
      message: "Motionly AI is analyzing your prompt...",
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
        reference_asset_count: stagedAssets.length,
      });
      showNotice("Composition updated by Motionly AI!");
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "AI generation failed.";
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
      message: "Motionly AI is fixing the composition...",
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
      showNotice("Composition repaired and updated by Motionly AI!");
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

  async function handleCloudReady(
    event: CustomEvent<{ workspaceId: string }>,
  ): Promise<void> {
    workspaceId = event.detail.workspaceId;
  }

  async function startPendingLandingPrompt(): Promise<void> {
    if (!pendingLandingPrompt) return;
    const prompt = pendingLandingPrompt;
    pendingLandingPrompt = "";
    sessionStorage.removeItem("motionly_pending_prompt");
    await runAssistantPrompt(prompt);
  }

  async function saveSource(): Promise<void> {
    cloudProjects.setFiles(cloudFiles);
    await cloudProjects.saveActive();
    captureEvent("project saved", { has_cloud_project: !!cloudProject });
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

  function handleCloudProjectChange(
    event: CustomEvent<{
      project: ProjectSummary | null;
      files: ProjectSourceFiles;
    }>,
  ): void {
    cloudProject = event.detail.project;
    cloudFiles = event.detail.files;
    if (cloudProject) void mountSavedProject(cloudProject);
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
      downloadBlob(blob, `motionly-${activeComposition.fps}fps.mp4`);
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
        `motionly-${Math.round(snapshot.time * activeComposition.fps)}.png`,
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

<div class="app">
  <header class="top-bar">
    <div class="brand">
      <span class="logo-shell"
        ><img src="/logo.svg" alt="Motionly" class="logo" /></span
      >
      <h1>Motionly</h1>
    </div>
    <div class="file-info">
      <FileText size={16} /><span
        >{cloudProject?.name ?? "Unsaved Motionly project"}</span
      >
    </div>
    <div class="actions">
      {#if authChecked}
        {#if currentUser}
          <span class="account-status" title={currentUser.email}>
            <span class="account-status__dot" aria-hidden="true"></span>
            <span>{currentUser.displayName || currentUser.email}</span>
          </span>
        {:else}
          <a
            class="account-status account-status--signed-out"
            href={motionlyLoginUrl()}
          >
            <span class="account-status__dot" aria-hidden="true"></span>
            <span>Not signed in</span>
          </a>
        {/if}
      {/if}
      <input
        bind:this={mediaInput}
        type="file"
        accept="image/*,video/*,image/svg+xml"
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
      <!-- Temporarily hidden during maintenance -->
      <!-- <button class="btn" on:click={() => cloudProjects.openManager()}
        ><FolderOpen size={17} /><span>Open</span></button
      > -->
      <button
        class="btn"
        title="Start a new blank project"
        on:click={startNewProject}
        disabled={$generationStore.isActive || exporting}
        ><Plus size={17} /><span>New</span></button
      >
      <button class="btn btn-primary" on:click={saveSource}
        ><Save size={17} /><span>Save</span></button
      >
      <button
        class="btn me-tooltip"
        data-tooltip="Export Current Frame as PNG"
        on:click={exportFrame}
        disabled={exporting}
      >
        <ImageIcon size={16} /><span>PNG</span>
      </button>
      <button
        class="btn export-action me-tooltip"
        data-tooltip="Render and Download 1080p Full Video"
        on:click={exportFullVideo}
        disabled={exporting}
      >
        <Download size={17} /><span
          >{exporting ? exportStatus || "Rendering…" : "Export Video"}</span
        >
      </button>
    </div>
  </header>

  <div class="code-editor-scope">
    <div class="me-motion-editor" style="--timeline-height: 218px;">
      <div class="me-workbench">
        <aside class="me-left-panel">
          <div class="me-panel-header">
            {#if sourceOpen}
              <div class="me-panel-title"><Braces size={15} /> Source</div>
              <button
                class="me-header-icon-btn"
                aria-label="Close composition source"
                on:click={() => (sourceOpen = false)}><X size={15} /></button
              >
            {:else}
              <div class="me-panel-tabs">
                <button
                  class="me-panel-tab"
                  class:me-active={activeTab === "chat"}
                  on:click={() => selectTab("chat")}>Chat</button
                >
                <button
                  class="me-panel-tab"
                  class:me-active={activeTab === "presets"}
                  on:click={() => selectTab("presets")}>Presets</button
                >
              </div>
              {#if activeTab === "presets"}
                <button
                  class="me-import-header-btn me-tooltip"
                  data-tooltip="Import media"
                  on:click={() => mediaInput.click()}
                  ><Upload size={14} /> Import</button
                >
              {:else}
                <button
                  class="me-header-icon-btn"
                  aria-label="Open composition HTML source"
                  title="Open composition HTML source"
                  on:click={openTimelineSource}><Braces size={15} /></button
                >
              {/if}
            {/if}
          </div>

          {#if sourceOpen}
            <div class="me-panel-content">
              <h3 class="me-category-title">Composition source</h3>
              <div class="source-heading">
                <Braces size={15} />
                {cloudProject?.name ?? "Unsaved project"} / composition.html
              </div>
              <pre class="source-code">{cloudFiles["composition.html"]}</pre>
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
                <button class="me-preset-card" on:click={loadAppleNotesPreset}>
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
                Fast kinetic type, native product UI, overlapping handoffs, and
                one directed GSAP timeline. No generated media.
              </p>
            </div>
          {:else}
            <section
              class="ai-chat-panel"
              aria-label="Motionly Assistant"
              data-ph-no-autocapture
            >
              <header class="ai-chat-header">
                <span
                  ><Sparkles size={15} /><strong>Motionly Assistant</strong
                  ></span
                >
              </header>
              <div class="ai-chat-messages" aria-live="polite">
                <div class="ai-chat-message assistant">
                  Describe a scene, transition, camera move, or timing change.
                  I’ll keep the composition code-first and GSAP-driven.
                </div>
                {#each assistantMessages as message}
                  <div
                    class:assistant={message.role === "assistant"}
                    class:user={message.role === "user"}
                    class:is-error={message.role === "assistant" &&
                      isErrorMessage(message.text)}
                    class="ai-chat-message"
                  >
                    <div>{message.text}</div>
                    {#if message.role === "assistant" && isErrorMessage(message.text)}
                      <button
                        class="ai-fix-btn"
                        disabled={$generationStore.isActive}
                        on:click={() => handleFixError(message.text)}
                      >
                        <Wand2 size={12} />
                        Fix
                      </button>
                    {/if}
                  </div>
                {/each}
                {#if $generationStore.isActive}
                  <div class="ai-chat-activity" aria-live="polite">
                    <span class="ai-chat-activity-dot"></span>{activityVerb}…
                  </div>
                {/if}
              </div>
              {#if stagedAssets.length > 0}
                <div class="ai-chat-attachments" aria-label="Attached images">
                  {#each stagedAssets as asset (asset.id)}
                    <span class="ai-attachment" title={asset.name}>
                      {#if stagedPreviews[asset.id]}
                        <img
                          class="ai-attachment-thumb"
                          src={stagedPreviews[asset.id]}
                          alt={asset.name}
                        />
                      {:else}
                        <span class="ai-attachment-thumb ai-attachment-fallback"
                          ><ImageIcon size={11} /></span
                        >
                      {/if}
                      <span class="ai-attachment-name">{asset.name}</span>
                      <button
                        class="ai-attachment-remove"
                        type="button"
                        aria-label={`Remove ${asset.name}`}
                        disabled={$generationStore.isActive}
                        on:click={() => removeStagedAsset(asset)}
                        ><X size={11} /></button
                      >
                    </span>
                  {/each}
                </div>
              {/if}
              <form class="ai-chat-composer" on:submit={submitAssistant}>
                <button
                  class="ai-composer-add"
                  type="button"
                  aria-label="Attach an image"
                  title="Attach an image"
                  disabled={uploadingMedia || $generationStore.isActive}
                  on:click={() => mediaInput.click()}><Plus size={17} /></button
                >
                <textarea
                  class="ai-composer-input"
                  aria-label="Assistant prompt"
                  rows="1"
                  placeholder="Ask anything"
                  bind:this={composerInput}
                  bind:value={assistantDraft}
                  on:input={resizeComposer}
                  on:keydown={composerKeydown}
                  on:paste={handlePaste}
                  disabled={$generationStore.isActive}
                ></textarea>
                <button
                  class="ai-composer-send"
                  aria-label="Send assistant message"
                  disabled={!assistantDraft.trim() ||
                    $generationStore.isActive ||
                    uploadingMedia}
                  type="submit"><ArrowUp size={17} /></button
                >
              </form>
            </section>
          {/if}
        </aside>

        <main class="me-preview-container">
          <div class="me-stage-meta">
            <span>{activeComposition.width} x {activeComposition.height}</span>
            <div class="me-stage-actions">
              <button class="me-meta-btn" on:click={fitPreview}>Fit</button>
              <span>{Math.round(fitScale * zoom * 100)}%</span>
              <button
                class="me-icon-btn"
                on:click={() => (zoom = Math.min(1.7, zoom + 0.15))}
                aria-label="Zoom in"><Maximize2 size={15} /></button
              >
            </div>
          </div>
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

        <aside class="me-properties-panel">
          <h2 class="me-panel-title">
            <SlidersHorizontal size={15} /> Properties
          </h2>
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
                <div class="me-section-title">
                  {selectedEditorGroup.label}
                </div>
                {#each selectedEditorGroup.fields as field}
                  <label class="me-property-group">
                    <span class="me-property-label">{field.label}</span>
                    {#if field.type === "image"}
                      <span class="me-image-field-preview">
                        <img src={editorFieldValue(field)} alt={field.label} />
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
                          on:input={(event) => changeEditorField(field, event)}
                        />
                        <output>{editorFieldInputValue(field)}</output>
                      </span>
                    {:else if field.type === "select"}
                      <select
                        class="me-text-input"
                        value={editorFieldInputValue(field)}
                        on:change={(event) => changeEditorField(field, event)}
                      >
                        {#each field.options ?? [] as option}
                          <option value={option}>{option}</option>
                        {/each}
                      </select>
                    {:else if field.type === "toggle"}
                      <input
                        type="checkbox"
                        checked={editorFieldInputValue(field) === "true"}
                        on:change={(event) => changeEditorField(field, event)}
                      />
                    {:else}
                      <input
                        class={field.type === "range"
                          ? "me-custom-slider"
                          : "me-text-input"}
                        type={field.type === "number" ? "number" : field.type}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={editorFieldInputValue(field)}
                        on:input={(event) => changeEditorField(field, event)}
                      />
                    {/if}
                  </label>
                {/each}
              {/if}
              {#if selectedEditorGroup?.allowTransform}
                {#if isTextEditable() && (selectedEditorGroup?.fields.length ?? 0) === 0}
                  <div class="me-property-group">
                    <label class="me-property-label" for="property-text"
                      >Text</label
                    >
                    <input
                      id="property-text"
                      class="me-text-input"
                      type="text"
                      value={editableTextValue()}
                      on:input={setText}
                    />
                  </div>
                  <div class="me-property-group">
                    <label class="me-property-label" for="property-font-size"
                      >Font size</label
                    >
                    <div class="me-number-input-wrapper">
                      <input
                        id="property-font-size"
                        class="me-number-input"
                        aria-label="Font size"
                        type="number"
                        min="1"
                        value={numericStyleValue("fontSize", 16)}
                        on:input={(event) => setNumber("fontSize", event)}
                      />
                      <span class="me-input-suffix">px</span>
                    </div>
                  </div>
                {/if}
                <div class="me-property-row">
                  <label class="me-property-group"
                    ><span class="me-property-label">X</span>
                    <input
                      class="me-number-input"
                      aria-label="X position"
                      title="Horizontal position"
                      type="number"
                      value={currentOverride(editorRevision).x ?? 0}
                      on:input={(event) => setNumber("x", event)}
                    /></label
                  >
                  <label class="me-property-group"
                    ><span class="me-property-label">Y</span>
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
                <div class="me-property-row">
                  <label class="me-property-group"
                    ><span class="me-property-label">Scale</span>
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
                  <label class="me-property-group"
                    ><span class="me-property-label">Rotation</span>
                    <input
                      class="me-number-input"
                      aria-label="Rotation"
                      title="Rotate selected element"
                      type="number"
                      value={currentOverride(editorRevision).rotation ?? 0}
                      on:input={(event) => setNumber("rotation", event)}
                    /></label
                  >
                </div>
                <div class="me-property-group">
                  <label class="me-property-label" for="property-opacity"
                    >Opacity</label
                  >
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
                </div>
              {/if}
              <AnimationControls
                speed={animationSpeed}
                ease={animationEase}
                tweenCount={animationSettings().tweenCount}
                onSpeed={setAnimationSpeed}
                onEase={setAnimationEase}
              />
              {#if selectedEditorGroup?.allowAppearance}
                <div class="me-section-title me-appearance-title">
                  Appearance
                </div>
                {#if isSvgSelected()}
                  <label class="me-property-group">
                    <span class="me-property-label">Stroke color</span>
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
                  <label class="me-property-group">
                    <span class="me-property-label"
                      >{isTextEditable()
                        ? "Text color"
                        : "Foreground color"}</span
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
                  <div class="me-property-group">
                    <div class="me-property-label-row">
                      <span class="me-property-label">Background</span>
                      {#if isBackgroundTransparent()}
                        <span class="me-property-pill-transparent"
                          >Transparent</span
                        >
                      {:else}
                        <button
                          class="me-property-action"
                          type="button"
                          on:click={clearBackground}>Clear</button
                        >
                      {/if}
                    </div>
                    <div
                      class="me-color-control"
                      class:me-transparent-bg={isBackgroundTransparent()}
                    >
                      <input
                        class="me-color-swatch"
                        aria-label="Background color"
                        type="color"
                        value={effectiveBackgroundColorHex()}
                        on:input={(event) => setColor("backgroundColor", event)}
                      />
                      <output
                        >{isBackgroundTransparent()
                          ? "transparent"
                          : colorValue("backgroundColor", "#17191c")}</output
                      >
                    </div>
                  </div>
                  <div class="me-property-group">
                    <label class="me-property-label" for="property-radius"
                      >Corner radius</label
                    >
                    <div class="me-number-input-wrapper">
                      <input
                        id="property-radius"
                        class="me-number-input"
                        aria-label="Corner radius"
                        type="number"
                        min="0"
                        value={numericStyleValue("borderRadius", 0)}
                        on:input={(event) => setNumber("borderRadius", event)}
                      />
                      <span class="me-input-suffix">px</span>
                    </div>
                  </div>
                {/if}
              {/if}
              <button
                class="me-layer-visibility"
                class:me-restore={currentOverride(editorRevision).hidden}
                type="button"
                on:click={toggleSelectedLayer}
              >
                {#if currentOverride(editorRevision).hidden}<Eye size={14} /> Restore
                  layer{:else}<EyeOff size={14} /> Remove layer{/if}
              </button>
            </div>
          {:else}
            <div class="me-properties-empty">
              <Sparkles size={30} /><strong>Select an element</strong><span
                >Click an editable object in the preview to change its visual
                properties.</span
              >
            </div>
          {/if}
        </aside>
      </div>

      <section class="storyboard-strip" aria-label="Storyboard">
        <div class="storyboard-strip__head">
          {#if timelineMode === "scene"}
            <button
              class="storyboard-strip__back"
              on:click={showProjectTimeline}
              ><ArrowLeft size={13} /> All scenes</button
            >
          {:else}
            <span class="storyboard-strip__title">Storyboard</span>
          {/if}
          <span class="storyboard-strip__meta"
            >{activeComposition.scenes.length} scenes · {formatTimelineSeconds(
              activeComposition.duration,
            )}</span
          >
        </div>
        <ol class="storyboard-strip__scenes">
          {#each activeComposition.scenes as scene}
            <li>
              <button
                class="storyboard-scene"
                aria-current={selectedSceneId === scene.id}
                data-scene-id={scene.id}
                style={`--storyboard-scene-color:${scene.accent}`}
                on:click={() => enterScene(scene)}
              >
                <span class="storyboard-scene__swatch"></span><span
                  class="storyboard-scene__label">{scene.label}</span
                ><span class="storyboard-scene__facts"
                  ><span>{formatTimelineSeconds(scene.duration)}</span><span
                    class="storyboard-scene__members"
                    ><Layers3 size={11} /> Film</span
                  ></span
                >
              </button>
            </li>
          {/each}
        </ol>
        <span class="source-chip">TS</span>
      </section>

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
          <div class="me-playback-controls">
            <button
              class="me-control-btn me-tooltip"
              aria-label="Restart"
              data-tooltip="Restart"
              on:click={() => runtime?.restart()}
              ><RefreshCcw size={15} /></button
            >
            <button
              class="me-control-btn me-play-btn me-tooltip"
              aria-label={snapshot.playing ? "Pause" : "Play"}
              data-tooltip={snapshot.playing ? "Pause" : "Play"}
              on:click={togglePlayback}
              >{#if snapshot.playing}<Pause size={16} />{:else}<Play
                  size={16}
                />{/if}</button
            >
            <span class="me-timecode">{timecode(snapshot.time)}</span><span
              class="me-framecode"
              >F{Math.round(snapshot.time * activeComposition.fps)}</span
            >
          </div>
          <div class="me-timeline-actions"></div>
        </div>
        <div
          class="me-timeline-scroll"
          style="--timeline-content-width: 1100px;"
        >
          <div class="me-ruler-row">
            <div class="me-track-label me-ruler-label">
              {timelineMode === "project" ? "MASTER" : selectedScene()?.label}
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
                aria-valuemax={currentTimelineStart + currentTimelineDuration}
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
              <button class="me-track-label" on:click={showProjectTimeline}
                ><span class="me-track-thumb"><Layers3 size={12} /></span><span
                  class="me-track-copy"
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
                    <span class="clip-accent" style:background={scene.accent}
                    ></span>
                    <span class="me-clip-text">{scene.label}</span>
                    <small>{formatTimelineSeconds(scene.duration)}</small>
                  </button>
                {/each}
              </div>
            </div>
            <div class="me-timeline-row project-timeline-row">
              <div class="me-track-label">
                <span class="me-track-thumb"><Sparkles size={12} /></span><span
                  class="me-track-copy"
                  ><strong>Handoffs</strong><small>0.7s overlaps</small></span
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
                  ><span class="me-track-thumb"><Layers3 size={12} /></span
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
                      >{formatTimelineSeconds(track.end - track.start)}</small
                    ></button
                  >
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </section>
    </div>
  </div>

  {#if notice}<div class="notice" role="status">{notice}</div>{/if}
  <EarlyNoticeCard />
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
</div>

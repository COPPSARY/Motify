<script lang="ts">
  import { onMount } from "svelte";
  import { currentMotionlyUser, motionlyLoginUrl } from "../auth";
  import type { MotionlyUser } from "../auth";
  import {
    ArrowLeft,
    Bot,
    Braces,
    Download,
    Eye,
    EyeOff,
    FileText,
    FolderOpen,
    Headphones,
    Image as ImageIcon,
    Layers3,
    Maximize2,
    Pause,
    Play,
    RefreshCcw,
    Save,
    Send,
    Settings,
    SlidersHorizontal,
    Sparkles,
    Type,
    Upload,
    Wand2,
    X,
  } from "lucide-svelte";
  import { createDynamicComposition } from "../composition/dynamic-compiler";
  import { generateWithDirectAi } from "../ai/direct-ai";
  import CloudProjectGallery from "../cloud/CloudProjectGallery.svelte";
  import EarlyNoticeCard from "./EarlyNoticeCard.svelte";
  import {
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
    ElementOverride,
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
  import { generationStore, startNewGeneration } from "../stores/generation";
  import { uploadAsset } from "../api/assets";
  import "./styles/editor-shell.css";
  import "./styles/navigation-rail.css";
  import "./styles/content-panel.css";
  import "./styles/preview-stage.css";
  import "./styles/properties-inspector.css";
  import "./styles/storyboard-strip.css";
  import "./styles/timeline-panel.css";
  import "./styles/editor-theme.css";

  type EditorTab =
    "media" | "audio" | "text" | "effects" | "scenes" | "ai" | "settings";

  type TimelineMode = "project" | "scene";

  interface AssistantMessage {
    role: "user" | "assistant";
    text: string;
  }

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem("motionly-assistant-history-v1");
    } catch {
      // ignore
    }
  }

  const initialProjectFiles: ProjectSourceFiles = {
    "composition.html": `<template id="motionly-template">
  <style>.motionly-stage { position: relative; width: 100%; height: 100%; overflow: hidden; background: #080b14; }</style>
  <main class="motionly-stage" data-edit="stage"></main>
</template>`,
    "styles.css": "",
    "timeline.js": `export function buildTimeline({ root, timeline, register }) {
  const stage = root.querySelector("[data-edit='stage']");
  if (!stage) throw new Error("Motionly stage was not found.");
  register("stage", stage);
}`,
    "index.ts": `import { defineComposition, type CompositionContext } from '@motionly/runtime';
import compositionHtml from './composition.html?raw';
import { buildTimeline } from './timeline.js';

function mount(context: CompositionContext) {
  const documentNode = new DOMParser().parseFromString(compositionHtml, 'text/html');
  const template = documentNode.querySelector<HTMLTemplateElement>('#motionly-template');
  if (!template) throw new Error('Motionly template was not found.');
  context.root.replaceChildren(template.content.cloneNode(true));
}

export default defineComposition({
  id: 'blank-composition', title: 'Untitled Motionly Project', description: 'Blank Motionly composition',
  width: 1920, height: 1080, fps: 60, duration: 5,
  scenes: [{ id: 'main', label: 'Main', start: 0, duration: 5, accent: '#7657ff', tracks: [{ id: 'stage', label: 'Stage', kind: 'Background', start: 0, end: 5 }] }],
  sourcePreview: compositionHtml,
  build(context) { mount(context); buildTimeline(context); },
});`,
  };
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

  const textElementTags = new Set([
    "B",
    "BUTTON",
    "DIV",
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
  let fileInput: HTMLInputElement;
  let cloudProjects: CloudProjectGallery;
  let mediaInput: HTMLInputElement;
  let stagedAssets: { id: string; name: string }[] = [];
  let uploadingMedia = false;
  let runtime: CompositionRuntime | null = null;
  let runtimeUnsubscribe: (() => void) | null = null;
  let activeComposition: CompositionDefinition = claudePreset;
  let previewLoadSequence = 0;
  let projectStyles: HTMLStyleElement | null = null;
  let snapshot: RuntimeSnapshot = {
    time: 0,
    playing: false,
    sceneId: claudePreset.scenes[0]?.id ?? "",
  };
  let selectedSceneId = claudePreset.scenes[0]?.id ?? "";
  let selectedId = "";
  let zoom = 1;
  let fitScale = 0.5;
  let activeTab: EditorTab = "media";
  let mediaTab: "assets" | "presets" = "presets";
  let exporting = false;
  let notice = "";
  let assistantDraft = "";
  let assistantMessages: AssistantMessage[] = [];
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
  let landingPromptStarted = false;

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
  let cloudFiles = claudeProjectFiles;
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
      activeTab = "ai";
    }
    void currentMotionlyUser().then((user) => {
      currentUser = user;
      authChecked = true;
    });
    mountComposition(activeComposition);
    let playbackFrame = 0;
    const syncPlaybackUi = () => {
      if (runtime) {
        snapshot = runtime.snapshot;
        selectedSceneId = snapshot.sceneId;
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
      observer.disconnect();
      runtime?.destroy();
      projectStyles?.remove();
    };
  });

  function mountComposition(composition: CompositionDefinition): void {
    runtimeUnsubscribe?.();
    runtime?.destroy();
    activeComposition = composition;
    selectedId = "";
    selectedSceneId = composition.scenes[0]?.id ?? "";
    runtime = new CompositionRuntime(composition, previewRoot);
    runtimeUnsubscribe = runtime.subscribe((value) => {
      snapshot = value;
      selectedSceneId = value.sceneId;
      updateSelectionRect();
    });
    fitPreview();
    editorRevision += 1;
  }

  function loadClaudePreset(): void {
    previewLoadSequence += 1;
    cloudProject = null;
    cloudFiles = { ...claudeProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(claudePreset);
    showNotice("Claude Calorie & Climax preset loaded.");
  }

  function loadKiriTtsPreset(): void {
    previewLoadSequence += 1;
    cloudProject = null;
    cloudFiles = { ...kiriTtsProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(kiriTtsPreset);
    showNotice("KiriTTS SaaS Ad preset loaded.");
  }

  function loadMotionlyPromoPreset(): void {
    previewLoadSequence += 1;
    cloudProject = null;
    cloudFiles = { ...motionlyPromoProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(motionlyPromoPreset);
    showNotice("Motionly Promo preset loaded.");
  }

  function loadAppleNotesPreset(): void {
    previewLoadSequence += 1;
    cloudProject = null;
    cloudFiles = { ...appleNotesProjectFiles };
    cloudProjects?.startUnsaved(cloudFiles);
    mountComposition(appleNotesPreset);
    showNotice("Apple Notes 24s Product Film loaded.");
  }

  async function mountSavedProject(project: ProjectSummary): Promise<void> {
    const sequence = ++previewLoadSequence;
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

  function selectFromPreview(event: MouseEvent): void {
    const directTarget = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-motionly-id]",
    );
    const pointTargets = runtime
      ? [...runtime.elements.entries()]
          .filter(([, element]) => {
            const bounds = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return (
              bounds.width > 0 &&
              bounds.height > 0 &&
              event.clientX >= bounds.left &&
              event.clientX <= bounds.right &&
              event.clientY >= bounds.top &&
              event.clientY <= bounds.bottom &&
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              Number(style.opacity) > 0.02
            );
          })
          .sort(([, first], [, second]) => {
            const firstBounds = first.getBoundingClientRect();
            const secondBounds = second.getBoundingClientRect();
            return (
              firstBounds.width * firstBounds.height -
              secondBounds.width * secondBounds.height
            );
          })
      : [];
    const hitId =
      pointTargets[0]?.[0] ?? directTarget?.dataset["motionlyId"] ?? "";
    if (!hitId) {
      selectedId = "";
      updateSelectionRect();
      return;
    }
    timelineMode = "scene";
    selectedSceneId = snapshot.sceneId;
    selectedId = hitId;
    syncAnimationControls();
    updateSelectionRect();
  }

  function handlePreviewKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      selectedId = "";
      updateSelectionRect();
    }
  }

  function seek(event: Event): void {
    runtime?.seek(Number((event.currentTarget as HTMLInputElement).value));
    updateSelectionRect();
  }

  function selectedScene() {
    return (
      activeComposition.scenes.find((scene) => scene.id === selectedSceneId) ??
      activeComposition.scenes[0]
    );
  }

  function visibleSceneTracks(): readonly SceneTrack[] {
    void editorRevision;
    const scene = selectedScene();
    if (!scene) return [];
    return deriveSceneTracks(scene, runtime?.elements, runtime?.timeline);
  }

  $: currentTimelineStart =
    timelineMode === "project" ? 0 : (selectedScene()?.start ?? 0);
  $: currentTimelineDuration =
    timelineMode === "project"
      ? activeComposition.duration
      : (selectedScene()?.duration ?? activeComposition.duration);

  function timelineStart(): number {
    return currentTimelineStart;
  }

  function timelineDuration(): number {
    return currentTimelineDuration;
  }

  function timelinePlayheadPosition(): number {
    const start = currentTimelineStart;
    const duration = currentTimelineDuration;
    return Math.max(
      0,
      Math.min(100, ((snapshot.time - start) / duration) * 100),
    );
  }

  function timelineTicks(): number[] {
    const duration = timelineDuration();
    const step = timelineMode === "project" ? 5 : duration > 6 ? 2 : 1;
    const values = Array.from(
      { length: Math.floor(duration / step) + 1 },
      (_, index) => index * step,
    );
    if (values.at(-1) !== duration) values.push(duration);
    return values;
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
    runtime?.seek(visibleFrame);
  }

  function showProjectTimeline(): void {
    timelineMode = "project";
    selectedId = "";
  }

  function trackLeft(track: SceneTrack): number {
    const start = timelineStart();
    const trackStart = track.start >= start ? track.start - start : track.start;
    return Math.max(0, Math.min(100, (trackStart / timelineDuration()) * 100));
  }

  function trackWidth(track: SceneTrack): number {
    return Math.max(
      0.8,
      ((track.end - track.start) / timelineDuration()) * 100,
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
    const localTime = snapshot.time - scene.start;
    if (localTime < track.start || localTime >= track.end) {
      const previewOffset = Math.min(
        0.15,
        Math.max(0, (track.end - track.start) / 3),
      );
      runtime.seek(
        scene.start +
          Math.min(
            track.end - 1 / activeComposition.fps,
            track.start + previewOffset,
          ),
      );
    }
    selectedId = track.id;
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

  function currentOverride(): ElementOverride {
    void editorRevision;
    return selectedId && runtime ? runtime.getOverride(selectedId) : {};
  }

  function isTextEditable(): boolean {
    if (!runtime || !selectedId) return false;
    const element = runtime.elements.get(selectedId);
    if (!element) return false;
    if (element.dataset["motionlySplitUnit"]) return true;
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
  }

  function setText(event: Event): void {
    if (!runtime || !selectedId) return;
    const patch = { text: (event.currentTarget as HTMLInputElement).value };
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
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
  }

  function clearBackground(): void {
    if (!runtime || !selectedId) return;
    const patch = { backgroundColor: "transparent" };
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
  }

  function toggleSelectedLayer(): void {
    if (!runtime || !selectedId) return;
    const patch = { hidden: !currentOverride().hidden };
    runtime.setOverride(selectedId, patch);
    persistSourceOverride(selectedId, patch);
    editorRevision += 1;
    updateSelectionRect();
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
  }

  function setAnimationEase(ease: string): void {
    if (!runtime || !selectedId) return;
    animationEase = ease;
    runtime.setAnimationOverride(selectedId, { ease });
  }

  function timecode(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = time - minutes * 60;
    return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
  }

  function selectTab(tab: EditorTab): void {
    sourceOpen = false;
    activeTab = tab;
    if (tab === "media") mediaTab = "assets";
    if (tab === "effects") mediaTab = "presets";
  }

  function openTimelineSource(): void {
    sourceOpen = true;
    activeTab = "text";
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

  async function stageAsset(file: File, name: string): Promise<void> {
    if (!workspaceId) {
      showNotice("Wait for your cloud workspace to finish loading.");
      return;
    }
    uploadingMedia = true;
    showNotice(`Uploading ${name}...`);
    try {
      const assetId = await uploadAsset(workspaceId, file);
      stagedAssets = [...stagedAssets, { id: assetId, name }];
      showNotice(`${name} is ready for the next prompt.`);
    } catch (error: unknown) {
      showNotice(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      uploadingMedia = false;
    }
  }

  async function submitAssistant(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const prompt = assistantDraft.trim();
    if (!prompt || $generationStore.isActive) return;

    assistantMessages = [...assistantMessages, { role: "user", text: prompt }];
    assistantDraft = "";

    generationStore.set({
      isActive: true,
      status: "GENERATING",
      stage: "GENERATING",
      progress: 20,
      message: "Motionly AI is analyzing your prompt...",
    });

    try {
      const currentHtml = cloudFiles["composition.html"] || "";
      const currentJs = cloudFiles["timeline.js"] || "";

      const result = await generateWithDirectAi(
        prompt,
        {
          compositionHtml: currentHtml,
          timelineJs: currentJs,
        },
        (statusMsg) => {
          generationStore.update((s) => ({ ...s, message: statusMsg }));
        },
      );

      generationStore.set({
        isActive: false,
        status: "COMPLETED",
        stage: "COMPLETED",
        progress: 100,
        message: result.reply,
      });

      // Update active project files purely in memory
      cloudFiles = {
        ...cloudFiles,
        "composition.html": result.compositionHtml,
        "timeline.js": result.timelineJs,
      };

      // Dynamically compile and mount the new composition in the browser in-memory
      const dynamicComp = createDynamicComposition(
        result.compositionHtml,
        result.timelineJs,
        {
          duration: result.duration || 18.0,
          title: result.title || "AI Generated Video",
          scenes: result.scenes,
        },
      );
      mountComposition(dynamicComp);
      runtime?.seek(0);
      runtime?.play();
      showNotice("Composition updated by Motionly AI!");
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "AI generation failed.";
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

    const fixInstruction = lastPrompt
      ? `The previous response failed with JSON error: "${errorMessage}".\n\nPlease fix the error and regenerate the complete composition for: "${lastPrompt}". Ensure the output is strictly valid JSON with no unescaped quotes or raw control characters.`
      : `The previous response had JSON error: "${errorMessage}". Please fix the JSON syntax and return valid JSON.`;

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
      const currentHtml = cloudFiles["composition.html"] || "";
      const currentJs = cloudFiles["timeline.js"] || "";

      const result = await generateWithDirectAi(
        fixInstruction,
        {
          compositionHtml: currentHtml,
          timelineJs: currentJs,
        },
        (statusMsg) => {
          generationStore.update((s) => ({ ...s, message: statusMsg }));
        },
      );

      generationStore.set({
        isActive: false,
        status: "COMPLETED",
        stage: "COMPLETED",
        progress: 100,
        message: result.reply,
      });

      cloudFiles = {
        ...cloudFiles,
        "composition.html": result.compositionHtml,
        "timeline.js": result.timelineJs,
      };

      const dynamicComp = createDynamicComposition(
        result.compositionHtml,
        result.timelineJs,
        {
          duration: result.duration || 18.0,
          title: result.title || "Repaired Video",
          scenes: result.scenes,
        },
      );
      mountComposition(dynamicComp);
      runtime?.seek(0);
      runtime?.play();
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

  async function handleGenerationComplete(generation: {
    projectId: string;
  }): Promise<void> {
    try {
      await cloudProjects.openProjectById(generation.projectId);
    } catch (error: unknown) {
      showNotice(
        error instanceof Error
          ? error.message
          : "The generation completed, but its project could not be reloaded.",
      );
    }
  }

  async function handleCloudReady(
    event: CustomEvent<{ workspaceId: string }>,
  ): Promise<void> {
    workspaceId = event.detail.workspaceId;
    if (!workspaceId || !pendingLandingPrompt || landingPromptStarted) return;
    landingPromptStarted = true;
    const prompt = pendingLandingPrompt;
    pendingLandingPrompt = "";
    sessionStorage.removeItem("motionly_pending_prompt");
    assistantMessages = [...assistantMessages, { role: "user", text: prompt }];
    await startNewGeneration(
      workspaceId,
      prompt,
      stagedAssets.map((asset) => asset.id),
      handleGenerationComplete,
    );
    stagedAssets = [];
  }

  async function saveSource(): Promise<void> {
    cloudProjects.setFiles(cloudFiles);
    await cloudProjects.saveActive();
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

    if (patch.text !== undefined) element.textContent = patch.text;
    if (patch.x !== undefined || patch.y !== undefined) {
      element.style.translate = `${patch.x ?? 0}px ${patch.y ?? 0}px`;
    }
    if (patch.scale !== undefined) element.style.scale = String(patch.scale);
    if (patch.rotation !== undefined)
      element.style.rotate = `${patch.rotation}deg`;
    if (patch.opacity !== undefined)
      element.style.opacity = String(patch.opacity);
    if (patch.color !== undefined) element.style.color = patch.color;
    if (patch.backgroundColor !== undefined)
      element.style.backgroundColor = patch.backgroundColor;
    if (patch.fill !== undefined) element.style.fill = patch.fill;
    if (patch.stroke !== undefined) element.style.stroke = patch.stroke;
    if (patch.fontSize !== undefined)
      element.style.fontSize = `${patch.fontSize}px`;
    if (patch.borderRadius !== undefined)
      element.style.borderRadius = `${patch.borderRadius}px`;
    if (patch.hidden !== undefined)
      element.style.visibility = patch.hidden ? "hidden" : "";

    cloudFiles = {
      ...cloudFiles,
      "composition.html":
        template?.outerHTML ?? documentSource.body.innerHTML.trim(),
    };
    cloudProjects.setFiles(cloudFiles);
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
      <div class="me-workbench me-chat-open">
        <nav class="me-nav-rail" aria-label="Editor tools">
          <button
            class="me-nav-item"
            class:me-active={activeTab === "media"}
            data-tooltip="Media"
            on:click={() => selectTab("media")}><FolderOpen size={20} /></button
          >
          <button
            class="me-nav-item"
            class:me-active={activeTab === "audio"}
            data-tooltip="Audio"
            on:click={() => selectTab("audio")}><Headphones size={20} /></button
          >
          <button
            class="me-nav-item"
            class:me-active={activeTab === "text"}
            data-tooltip="Text"
            on:click={() => selectTab("text")}><Type size={20} /></button
          >
          <button
            class="me-nav-item"
            class:me-active={activeTab === "effects"}
            data-tooltip="Effects"
            on:click={() => selectTab("effects")}><Wand2 size={20} /></button
          >
          <button
            class="me-nav-item"
            class:me-active={activeTab === "scenes"}
            data-tooltip="Scenes"
            on:click={() => selectTab("scenes")}><Layers3 size={20} /></button
          >
          <button
            class="me-nav-item"
            class:me-active={activeTab === "ai"}
            data-tooltip="AI"
            on:click={() => selectTab("ai")}><Bot size={20} /></button
          >
          <button
            class="me-nav-item me-nav-settings"
            class:me-active={activeTab === "settings"}
            data-tooltip="Settings"
            on:click={() => selectTab("settings")}
            ><Settings size={20} /></button
          >
        </nav>

        <aside class="me-content-panel">
          <div class="me-panel-header">
            {#if sourceOpen}
              <div class="me-panel-title"><Braces size={15} /> Source</div>
              <button
                class="me-header-icon-btn"
                aria-label="Close composition source"
                on:click={() => (sourceOpen = false)}><X size={15} /></button
              >
            {:else if activeTab === "media"}
              <div class="me-panel-tabs">
                <button
                  class="me-panel-tab"
                  class:me-active={mediaTab === "assets"}
                  on:click={() => (mediaTab = "assets")}>Assets</button
                >
                <button
                  class="me-panel-tab"
                  class:me-active={mediaTab === "presets"}
                  on:click={() => (mediaTab = "presets")}>Presets</button
                >
              </div>
              <button
                class="me-import-header-btn me-tooltip"
                data-tooltip="Import media"
                on:click={() => mediaInput.click()}
                ><Upload size={14} /> Import</button
              >
            {:else}
              <div class="me-panel-title">
                {#if activeTab === "text"}<Type size={15} /> Text{:else if activeTab === "effects"}<Wand2
                    size={15}
                  /> Motion{:else if activeTab === "scenes"}<Layers3
                    size={15}
                  /> Scenes{:else if activeTab === "audio"}<Headphones
                    size={15}
                  /> Audio{:else if activeTab === "settings"}<Settings
                    size={15}
                  /> Settings{:else}<Bot size={15} /> Assistant{/if}
              </div>
              {#if activeTab === "text"}
                <button
                  class="me-header-icon-btn"
                  aria-label="Open composition HTML source"
                  title="Open composition HTML source"
                  on:click={openTimelineSource}><Braces size={15} /></button
                >
              {/if}
            {/if}
          </div>
          <div class="me-panel-content">
            {#if sourceOpen}
              <h3 class="me-category-title">Composition source</h3>
              <div class="source-heading">
                <Braces size={15} />
                {cloudProject?.name ?? "Unsaved project"} / composition.html
              </div>
              <pre class="source-code">{cloudFiles["composition.html"]}</pre>
            {:else if activeTab === "text"}
              <h3 class="me-category-title">Text in this scene</h3>
              <p class="me-category-hint">
                Select a text layer to edit it. Its timeline bar shows only when
                it is actually visible.
              </p>
              <div class="me-layer-list">
                {#each visibleSceneTracks().filter((track) => track.kind === "Text") as track}
                  <button
                    class="me-layer-row"
                    class:me-selected={selectedId === track.id}
                    on:click={() => selectTrack(track)}
                  >
                    <span class="me-layer-icon"><Type size={14} /></span>
                    <span class="me-layer-copy"
                      ><strong>{track.label}</strong><small
                        >{formatTimelineSeconds(track.end - track.start)} visible</small
                      ></span
                    >
                  </button>
                {/each}
              </div>
            {:else if activeTab === "scenes"}
              <h3 class="me-category-title">Scenes</h3>
              <div class="me-layer-list">
                {#each activeComposition.scenes as scene}
                  <button
                    class="me-layer-row"
                    class:me-selected={selectedSceneId === scene.id}
                    on:click={() => enterScene(scene)}
                  >
                    <span class="me-layer-icon"><Layers3 size={14} /></span>
                    <span class="me-layer-copy"
                      ><strong>{scene.label}</strong><small
                        >{formatTimelineSeconds(scene.duration)}</small
                      ></span
                    >
                  </button>
                {/each}
              </div>
            {:else if activeTab === "effects"}
              <h3 class="me-category-title">Text animation</h3>
              <p class="me-category-hint">
                Motion presets write directly into the caller-owned GSAP
                timeline.
              </p>
              <div class="me-effects-list">
                <button
                  class="me-effect-item"
                  on:click={() =>
                    showNotice("Word reveal is used in the active promo.")}
                  ><Sparkles size={14} /> Word reveal · power4.out</button
                >
                <button
                  class="me-effect-item"
                  on:click={() =>
                    showNotice("Character cascade is used in the CTA.")}
                  ><Type size={14} /> Character cascade</button
                >
                <button
                  class="me-effect-item"
                  on:click={() =>
                    showNotice("Directional handoffs overlap adjacent scenes.")}
                  ><Layers3 size={14} /> Scene handoff</button
                >
              </div>
            {:else if activeTab === "media" && mediaTab === "presets"}
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
            {:else if activeTab === "media"}
              <h3 class="me-category-title">Project assets</h3>
              <div class="me-asset-grid project-asset-grid">
                <div class="me-asset-card-wrap">
                  <button
                    class="me-asset-card me-tooltip"
                    data-tooltip="Select logo.svg"
                    on:click={() => (selectedId = "brand-token")}
                  >
                    <span class="me-asset-thumbnail project-asset-thumbnail"
                      ><img src="/logo.svg" alt="Motionly logo" /></span
                    >
                    <span class="me-asset-info"
                      ><strong class="me-asset-name">logo.svg</strong><small
                        >SVG · selectable</small
                      ></span
                    >
                  </button>
                </div>
                <div class="me-asset-card-wrap">
                  <button
                    class="me-asset-card me-tooltip"
                    data-tooltip="Select github.svg"
                    on:click={() =>
                      showNotice("github.svg is ready in public/.")}
                  >
                    <span class="me-asset-thumbnail project-asset-thumbnail"
                      ><img src="/github.svg" alt="GitHub logo" /></span
                    >
                    <span class="me-asset-info"
                      ><strong class="me-asset-name">github.svg</strong><small
                        >SVG · public</small
                      ></span
                    >
                  </button>
                </div>
              </div>
              <div class="project-import-card">
                <ImageIcon size={22} />
                <div><strong>Add media</strong><span>Images and SVG</span></div>
                <button
                  class="me-import-media-button"
                  on:click={() => mediaInput.click()}
                  disabled={uploadingMedia}
                  >{uploadingMedia ? "Uploading…" : "Import"}</button
                >
              </div>
            {:else}
              <div class="me-properties-empty compact-panel-empty">
                <Sparkles size={26} /><strong
                  >{activeTab === "audio"
                    ? "No audio yet"
                    : "Editor settings"}</strong
                ><span
                  >{activeTab === "audio"
                    ? "Import an audio file to add a waveform track."
                    : "The demo uses project defaults for preview and export."}</span
                >
              </div>
            {/if}
          </div>
        </aside>

        <aside class="me-chat-drawer">
          <section class="ai-chat-panel" aria-label="Motionly Assistant">
            <header class="ai-chat-header">
              <span
                ><Sparkles size={15} /><strong>Motionly Assistant</strong></span
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
              <div
                style="padding: 10px; background: #222; border-top: 1px solid #333; font-size: 12px; display: flex; gap: 8px;"
              >
                {#each stagedAssets as asset}
                  <span
                    style="background: #444; padding: 2px 6px; border-radius: 4px;"
                    >{asset.name}</span
                  >
                {/each}
              </div>
            {/if}
            <form class="ai-chat-composer" on:submit={submitAssistant}>
              <textarea
                aria-label="Assistant prompt"
                on:paste={handlePaste}
                placeholder="Make the CTA transition feel more cinematic…"
                bind:value={assistantDraft}
                disabled={$generationStore.isActive}
              ></textarea>
              <button
                aria-label="Send assistant message"
                disabled={!assistantDraft.trim() ||
                  $generationStore.isActive ||
                  uploadingMedia}
                type="submit"><Send size={15} /></button
              >
            </form>
          </section>
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
            bind:this={previewStage}
            role="application"
            aria-label="Composition preview"
            tabindex="0"
            on:click={selectFromPreview}
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
                >
                  <div class="me-selection-outline"></div>
                  <div class="me-selection-handle handle-tl"></div>
                  <div class="me-selection-handle handle-tr"></div>
                  <div class="me-selection-handle handle-bl"></div>
                  <div class="me-selection-handle handle-br"></div>
                  <div class="me-selection-badge">
                    <span class="badge-label"
                      >{selectedTrack()?.label ?? selectedId}</span
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
                ><strong>{selectedTrack()?.label ?? selectedId}</strong><small
                  >{selectedId} · editable layer</small
                ></span
              >
            </div>
            <div class="me-primary-properties">
              {#if isTextEditable()}
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
                    value={currentOverride().x ?? 0}
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
                    value={currentOverride().y ?? 0}
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
                    value={currentOverride().scale ?? 1}
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
                    value={currentOverride().rotation ?? 0}
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
                  value={currentOverride().opacity ?? 1}
                  on:input={(event) => setNumber("opacity", event)}
                />
              </div>
              {#if animationSettings().tweenCount > 0}
                <AnimationControls
                  speed={animationSpeed}
                  ease={animationEase}
                  tweenCount={animationSettings().tweenCount}
                  onSpeed={setAnimationSpeed}
                  onEase={setAnimationEase}
                />
              {/if}
              <div class="me-section-title me-appearance-title">Appearance</div>
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
              <button
                class="me-layer-visibility"
                class:me-restore={currentOverride().hidden}
                type="button"
                on:click={toggleSelectedLayer}
              >
                {#if currentOverride().hidden}<Eye size={14} /> Restore layer{:else}<EyeOff
                    size={14}
                  /> Remove layer{/if}
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
              {#each timelineTicks() as tick}<span
                  class="me-ruler-tick"
                  style:left={`${(tick / timelineDuration()) * 100}%`}
                  >{formatTimelineSeconds(tick)}</span
                >{/each}
              <span bind:this={playheadMarker} class="me-playhead-marker"
              ></span>
              <input
                class="me-timeline-scrubber"
                aria-label="Timeline scrubber"
                type="range"
                min={timelineStart()}
                max={timelineStart() + timelineDuration()}
                step={1 / activeComposition.fps}
                value={snapshot.time}
                on:input={seek}
              />
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
            {#each visibleSceneTracks() as track}
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
                    style:left={`${trackLeft(track)}%`}
                    style:width={`${trackWidth(track)}%`}
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
    initialFiles={initialProjectFiles}
    width={1920}
    height={1080}
    fps={60}
    duration={5}
    on:cloudready={handleCloudReady}
    on:projectchange={handleCloudProjectChange}
    on:notice={(event) => showNotice(event.detail)}
  />
</div>

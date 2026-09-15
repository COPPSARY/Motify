import type { GenerationPlanMemory } from "../ai/generation-guidance";
import type { ProjectSourceFiles } from "../cloud/projects-api";
import type { RuntimeEditorState, SceneDefinition } from "../composition/types";
import type { LocalAssetReference } from "./local-assets";

export interface DraftMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ProjectDraft {
  version: 1;
  updatedAt: number;
  files: ProjectSourceFiles;
  messages: DraftMessage[];
  assets: LocalAssetReference[];
  /** Directorial memory so a restored draft keeps its follow-up context. */
  plan?: GenerationPlanMemory;
  editorState: RuntimeEditorState;
  metadata: {
    title: string;
    duration: number;
    scenes: readonly SceneDefinition[];
  };
  baseRevision?: number;
}

const PREFIX = "motionly-project-draft-v1:";

export function draftKey(projectId: string): string {
  return `${PREFIX}${projectId}`;
}

export function loadProjectDraft(projectId: string): ProjectDraft | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = JSON.parse(
      localStorage.getItem(draftKey(projectId)) ?? "null",
    ) as ProjectDraft | null;
    return value?.version === 1 ? value : null;
  } catch {
    return null;
  }
}

export function saveProjectDraft(projectId: string, draft: ProjectDraft): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(draftKey(projectId), JSON.stringify(draft));
  } catch (error) {
    console.warn("Motify could not persist the local project draft.", error);
  }
}

export function clearProjectDrafts(): void {
  if (typeof localStorage === "undefined") return;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
  }
  localStorage.removeItem("motionly-assistant-history-v1");
}

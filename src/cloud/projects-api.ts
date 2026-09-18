import { combineCompositionSource } from "./project-source";
import { MOTIFY_API_URL } from "../api/config";
import type { SceneDefinition } from "../composition/types";

export const PROJECT_SOURCE_PATHS = [
  "composition.html",
  "styles.css",
  "timeline.js",
  "index.ts",
] as const;

export type ProjectSourcePath = (typeof PROJECT_SOURCE_PATHS)[number];
export type ProjectSourceFiles = Record<ProjectSourcePath, string>;

export interface CloudUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  kind: "personal" | "team";
  role: "owner" | "editor" | "viewer";
}

export interface ProjectSummary {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  scenes: readonly SceneDefinition[];
  sourceHash: string;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  savedAt: string;
}

export interface ProjectSource {
  "composition.html": string;
  "timeline.js": string;
}

export interface ProjectMutationResult {
  project: ProjectSummary;
  unchanged: boolean;
}

export interface ProjectPreview {
  sourceHash: string;
  bundle: string;
  styles: string;
}

export interface MotionMessageResult {
  type: "chat" | "plan" | "generation";
  response: string;
  projectId?: string;
  revision?: number;
}

export interface ProjectAssetSummary {
  id: string;
  fileName: string;
  contentType: string;
  role: "reference" | "asset";
  token: string | null;
}

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

export class CloudApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CloudApiError";
  }
}

export class ProjectsApi {
  private csrfToken = "";

  constructor(readonly baseUrl = MOTIFY_API_URL) {}

  async getSession(): Promise<{ user: CloudUser; csrfToken: string }> {
    const session = await this.request<{ user: CloudUser; csrfToken: string }>(
      "/v1/auth/me",
    );
    this.csrfToken = session.csrfToken;
    return session;
  }

  listWorkspaces() {
    return this.request<WorkspaceSummary[]>("/v1/workspaces");
  }

  listProjects(workspaceId: string) {
    return this.request<ProjectSummary[]>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/projects`,
    );
  }

  async createProject(
    workspaceId: string,
    input: {
      name: string;
      width: number;
      height: number;
      fps: number;
      duration: number;
      files: ProjectSourceFiles;
    },
  ) {
    await this.ensureCsrfToken();
    return this.request<ProjectSummary>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/projects`,
      {
        method: "POST",
        body: {
          name: input.name,
          width: input.width,
          height: input.height,
          fps: input.fps,
          duration: input.duration,
          compositionHtml: combineCompositionSource(input.files),
          timelineJs: input.files["timeline.js"],
        },
      },
    );
  }

  getProject(projectId: string) {
    return this.request<ProjectSummary>(
      `/v1/projects/${encodeURIComponent(projectId)}`,
    );
  }

  getSource(projectId: string) {
    return this.request<ProjectSource>(
      `/v1/projects/${encodeURIComponent(projectId)}/source`,
    );
  }

  getPreview(projectId: string) {
    return this.request<ProjectPreview>(
      `/v1/projects/${encodeURIComponent(projectId)}/preview`,
    );
  }

  async sendMotionMessage(
    projectId: string,
    input: {
      message: string;
      revision?: number;
      runtimeError?: string;
      assets?: Array<{ assetId: string; role: "reference" | "asset" }>;
    },
  ) {
    await this.ensureCsrfToken();
    return this.request<MotionMessageResult>(
      `/v1/projects/${encodeURIComponent(projectId)}/messages`,
      { method: "POST", body: input },
    );
  }

  listProjectAssets(projectId: string) {
    return this.request<ProjectAssetSummary[]>(
      `/v1/projects/${encodeURIComponent(projectId)}/assets`,
    );
  }

  async attachProjectAsset(
    projectId: string,
    assetId: string,
    role: "reference" | "asset",
  ) {
    await this.ensureCsrfToken();
    return this.request<void>(
      `/v1/projects/${encodeURIComponent(projectId)}/assets`,
      { method: "POST", body: { assetId, role } },
    );
  }

  async detachProjectAsset(projectId: string, assetId: string) {
    await this.ensureCsrfToken();
    return this.request<void>(
      `/v1/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
      { method: "DELETE" },
    );
  }

  saveSource(
    projectId: string,
    input: { revision: number; files: ProjectSourceFiles },
  ) {
    return this.request<ProjectMutationResult>(
      `/v1/projects/${encodeURIComponent(projectId)}/source`,
      { method: "PUT", body: input },
    );
  }

  updateProject(
    projectId: string,
    input: {
      revision: number;
      name?: string;
      width?: number;
      height?: number;
      fps?: number;
      duration?: number;
    },
  ) {
    return this.request<ProjectSummary>(
      `/v1/projects/${encodeURIComponent(projectId)}`,
      { method: "PATCH", body: input },
    );
  }

  removeProject(projectId: string, revision: number) {
    return this.request<void>(`/v1/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
      body: { revision },
    });
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const method = options.method ?? "GET";
    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(method === "GET" || method === "HEAD" || !this.csrfToken
          ? {}
          : { "X-CSRF-Token": this.csrfToken }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => ({}))) as ApiErrorEnvelope;
      throw new CloudApiError(
        response.status,
        payload.error?.code ?? "REQUEST_FAILED",
        payload.error?.message ??
          `Request failed with status ${response.status}.`,
        payload.error?.details,
      );
    }
    if (response.status === 204) return undefined as T;
    return ((await response.json()) as ApiEnvelope<T>).data;
  }

  private async ensureCsrfToken(): Promise<void> {
    if (!this.csrfToken) await this.getSession();
  }
}

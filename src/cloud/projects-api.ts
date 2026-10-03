import { combineCompositionSource } from "./project-source";
import { MOTIFY_API_URL } from "../api/config";
import type { SceneDefinition } from "../composition/types";
import type { BrandAssetRole, BrandDna, BrandResource } from "./brand-dna";

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

export type BillingPlanId = "starter" | "pro" | "studio";

export interface WorkspaceSubscription {
  status: "none" | "active" | "expired";
  plan: BillingPlanId | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
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
  /** What the request cost and what is left. Absent when credits are not being charged. */
  credits?: { charged: number; remaining: number };
}

export interface ProjectAssetSummary {
  id: string;
  fileName: string;
  contentType: string;
  role: "reference" | "asset";
  token: string | null;
}

export interface WorkspaceAsset {
  id: string;
  workspaceId: string;
  state: "PENDING" | "READY" | "FAILED" | "DELETED";
  fileName: string;
  contentType: string;
  byteSize: number;
  checksum: string;
  label: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  durationMs: number | null;
  createdAt: string;
  downloadUrl: string | null;
}

/** A song in the music library: the user's own upload or a built-in track. */
export interface AudioTrack {
  id: string;
  scope: "workspace" | "system";
  workspaceId: string | null;
  title: string;
  artist: string | null;
  genre: string | null;
  moodTags: string[];
  bpm: number | null;
  license: string | null;
  durationMs: number;
  contentType: string;
  byteSize: number;
  /** `motify-audio://<id>`, the source a composition's <audio> element carries. */
  token: string;
  createdAt: string;
}

export interface AudioTrackMetadata {
  title?: string;
  artist?: string | null;
  genre?: string | null;
  moodTags?: string[];
  bpm?: number | null;
}

export type AudioLibraryScope = "all" | "workspace" | "system";

interface ApiEnvelope<T> {
  data: T;
  pagination?: { totalItems: number };
}

interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

export interface MotionMessageInput {
  message: string;
  revision?: number;
  runtimeError?: string;
  assets?: Array<{ assetId: string; role: "reference" | "asset" }>;
  audio?: Array<{ trackId: string }>;
  /**
   * Frames this editor rendered from the candidate the message is
   * repairing. They travel inline, for this request only: the backend
   * validates source without ever executing it, so what a composition
   * puts on screen can reach the model no other way.
   */
  frames?: Array<{
    capturedAtSeconds: number;
    mediaType: "image/jpeg" | "image/png" | "image/webp";
    dataBase64: string;
  }>;
}

/** A project message the backend runs in the background. */
export interface MotionMessageJob {
  id: string;
  projectId: string;
  status: "running" | "succeeded" | "failed";
  createdAt: string;
  finishedAt?: string;
  result?: MotionMessageResult;
  error?: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * The backend no longer knows a job it was running, usually because it
 * restarted. The run may still have saved its film, so the caller should look
 * for that instead of reporting a failure.
 */
export class GenerationJobLostError extends Error {
  constructor() {
    super("The generation was interrupted before its result could be read.");
    this.name = "GenerationJobLostError";
  }
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

  getSubscription(workspaceId: string) {
    return this.request<WorkspaceSubscription>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/billing/subscription`,
    );
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

  async sendMotionMessage(projectId: string, input: MotionMessageInput) {
    await this.ensureCsrfToken();
    return this.request<MotionMessageResult>(
      `/v1/projects/${encodeURIComponent(projectId)}/messages`,
      { method: "POST", body: input },
    );
  }

  async startMotionMessageJob(projectId: string, input: MotionMessageInput) {
    await this.ensureCsrfToken();
    return this.request<MotionMessageJob>(
      `/v1/projects/${encodeURIComponent(projectId)}/message-jobs`,
      { method: "POST", body: input },
    );
  }

  getMotionMessageJob(projectId: string, jobId: string) {
    return this.request<MotionMessageJob>(
      `/v1/projects/${encodeURIComponent(projectId)}/message-jobs/${encodeURIComponent(jobId)}`,
    );
  }

  /**
   * Sends a project message and waits for its outcome, however long the run
   * takes. The backend runs it as a job and this polls it, so no request has
   * to stay open longer than the hosting gateway allows (a new film can).
   *
   * A backend without job routes gets the old blocking request. A job the
   * backend no longer knows (it restarted) throws `GenerationJobLostError`,
   * and losing the connection for longer than `maxPollFailures` polls throws
   * the network error; either way the editor then looks for a saved result.
   */
  async runMotionMessage(
    projectId: string,
    input: MotionMessageInput,
    {
      pollMs = 3000,
      maxPollFailures = 20,
      sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms)),
    }: {
      pollMs?: number;
      maxPollFailures?: number;
      sleep?: (ms: number) => Promise<void>;
    } = {},
  ): Promise<MotionMessageResult> {
    let job: MotionMessageJob;
    try {
      job = await this.startMotionMessageJob(projectId, input);
    } catch (error) {
      if (error instanceof CloudApiError && error.code === "NOT_FOUND") {
        return this.sendMotionMessage(projectId, input);
      }
      throw error;
    }
    let failures = 0;
    for (;;) {
      if (job.status === "succeeded" && job.result) return job.result;
      if (job.status === "failed") {
        const failure = job.error;
        throw new CloudApiError(
          failure?.status ?? 500,
          failure?.code ?? "INTERNAL_ERROR",
          failure?.message ?? "The generation failed.",
          failure?.details,
        );
      }
      await sleep(pollMs);
      try {
        job = await this.getMotionMessageJob(projectId, job.id);
        failures = 0;
      } catch (error) {
        if (error instanceof CloudApiError && error.code === "JOB_NOT_FOUND") {
          throw new GenerationJobLostError();
        }
        failures += 1;
        if (failures >= maxPollFailures) throw error;
      }
    }
  }

  listProjectAssets(projectId: string) {
    return this.request<ProjectAssetSummary[]>(
      `/v1/projects/${encodeURIComponent(projectId)}/assets`,
    );
  }

  listWorkspaceAssets(workspaceId: string, query = "") {
    const params = new URLSearchParams({ pageSize: "100" });
    if (query.trim()) params.set("q", query.trim());
    return this.request<WorkspaceAsset[]>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/assets?${params}`,
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

  /** Deletes an asset and its file. Refused while a project, song or brand uses it. */
  async deleteAsset(assetId: string) {
    await this.ensureCsrfToken();
    return this.request<void>(`/v1/assets/${encodeURIComponent(assetId)}`, {
      method: "DELETE",
    });
  }

  async detachProjectAsset(projectId: string, assetId: string) {
    await this.ensureCsrfToken();
    return this.request<void>(
      `/v1/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
      { method: "DELETE" },
    );
  }

  async listAudioTracks(
    workspaceId: string,
    options: { scope?: AudioLibraryScope; query?: string } = {},
  ): Promise<{ tracks: AudioTrack[]; totalItems: number }> {
    const params = new URLSearchParams({
      scope: options.scope ?? "all",
      pageSize: "100",
    });
    if (options.query?.trim()) params.set("q", options.query.trim());
    const body = await this.requestJson<ApiEnvelope<AudioTrack[]>>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/audio?${params}`,
    );
    const tracks = body?.data ?? [];
    return {
      tracks,
      totalItems: body?.pagination?.totalItems ?? tracks.length,
    };
  }

  async registerAudioTrack(
    workspaceId: string,
    input: AudioTrackMetadata & { assetId: string },
  ) {
    await this.ensureCsrfToken();
    return this.request<AudioTrack>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/audio`,
      { method: "POST", body: input },
    );
  }

  async updateAudioTrack(trackId: string, patch: AudioTrackMetadata) {
    await this.ensureCsrfToken();
    return this.request<AudioTrack>(
      `/v1/audio/${encodeURIComponent(trackId)}`,
      { method: "PATCH", body: patch },
    );
  }

  async removeAudioTrack(trackId: string) {
    await this.ensureCsrfToken();
    return this.request<void>(`/v1/audio/${encodeURIComponent(trackId)}`, {
      method: "DELETE",
    });
  }

  getAudioAccess(trackId: string) {
    return this.request<{ url: string; expiresIn: number }>(
      `/v1/audio/${encodeURIComponent(trackId)}/access`,
    );
  }

  listProjectAudio(projectId: string) {
    return this.request<AudioTrack[]>(
      `/v1/projects/${encodeURIComponent(projectId)}/audio`,
    );
  }

  async detachProjectAudio(projectId: string, trackId: string) {
    await this.ensureCsrfToken();
    return this.request<void>(
      `/v1/projects/${encodeURIComponent(projectId)}/audio/${encodeURIComponent(trackId)}`,
      { method: "DELETE" },
    );
  }

  /**
   * The signed-in person's Brand DNA. A brand belongs to the person, not to a
   * workspace, and every film they generate is made with it.
   */
  getBrand() {
    return this.request<BrandResource>("/v1/brand");
  }

  /** Replaces the brand document against the revision it was read at. */
  async saveBrand(revision: number, dna: BrandDna) {
    await this.ensureCsrfToken();
    return this.request<BrandResource>("/v1/brand", {
      method: "PUT",
      body: { revision, dna },
    });
  }

  async addBrandAsset(input: {
    assetId: string;
    role: BrandAssetRole;
    label?: string | null;
  }) {
    await this.ensureCsrfToken();
    return this.request<BrandResource>("/v1/brand/assets", {
      method: "POST",
      body: input,
    });
  }

  async updateBrandAsset(
    assetId: string,
    input: { role?: BrandAssetRole; label?: string | null },
  ) {
    await this.ensureCsrfToken();
    return this.request<BrandResource>(
      `/v1/brand/assets/${encodeURIComponent(assetId)}`,
      { method: "PATCH", body: input },
    );
  }

  async removeBrandAsset(assetId: string) {
    await this.ensureCsrfToken();
    return this.request<void>(
      `/v1/brand/assets/${encodeURIComponent(assetId)}`,
      { method: "DELETE" },
    );
  }

  /**
   * Source is saved through the project itself: the API has no separate
   * source write, so this PATCHes `compositionHtml` and `timelineJs` against
   * the revision it was loaded at, the same way the project was created.
   */
  async saveSource(
    projectId: string,
    input: { revision: number; files: ProjectSourceFiles },
  ): Promise<ProjectMutationResult> {
    await this.ensureCsrfToken();
    const project = await this.request<ProjectSummary>(
      `/v1/projects/${encodeURIComponent(projectId)}`,
      {
        method: "PATCH",
        body: {
          revision: input.revision,
          compositionHtml: combineCompositionSource(input.files),
          timelineJs: input.files["timeline.js"],
        },
      },
    );
    return { project, unchanged: project.revision === input.revision };
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
    const body = await this.requestJson<ApiEnvelope<T>>(path, options);
    return body === undefined ? (undefined as T) : body.data;
  }

  /** The whole response body, for callers that need more than `data`. */
  private async requestJson<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T | undefined> {
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
    if (response.status === 204) return undefined;
    return (await response.json()) as T;
  }

  private async ensureCsrfToken(): Promise<void> {
    if (!this.csrfToken) await this.getSession();
  }
}

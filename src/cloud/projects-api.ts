import { combineCompositionSource } from "./project-source";
import { MOTIFY_API_URL } from "../api/config";
import type { SceneDefinition } from "../composition/types";
import type { CanvasAspect } from "../composition/canvas-frame";
import type {
  BrandAssetRole,
  BrandDna,
  BrandProfileList,
  BrandResource,
} from "./brand-dna";

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

/** Plan ids come from the backend billing catalog and are not a fixed enum. */
export type BillingPlanId = string;

export interface WorkspaceEntitlements {
  exportWithoutWatermark: boolean;
  maxExportHeight: number;
}

export interface WorkspaceSubscription {
  status: "none" | "active" | "expired";
  plan: BillingPlanId | null;
  interval?: "MONTH" | "YEAR" | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  /** Optional only for rolling deploy compatibility with older API nodes. */
  entitlements?: WorkspaceEntitlements;
}

export interface PromotionBanner {
  id: string;
  title: string;
  message: string;
  plan: { id: BillingPlanId; name: string } | null;
  audience: "all" | "free" | "paid";
  ctaLabel: string | null;
  ctaUrl: string | null;
  startsAt: string;
  endsAt: string;
}

export interface ProjectSummary {
  id: string;
  brandSelection?: string;
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
  /** The revision the gallery still was drawn from; null or absent when there is none. */
  thumbnailRevision?: number | null;
}

export interface ProjectSource {
  "composition.html": string;
  "timeline.js": string;
}

/**
 * A saved point in a project's history. Versions are identified, not
 * previewed: by number, how they were made, the prompt behind them and when.
 */
export interface ProjectVersion {
  revision: number;
  source: "initial" | "generation" | "manual_edit" | "restore";
  restoredFromRevision: number | null;
  label: string | null;
  pinned: boolean;
  createdBy: string | null;
  createdAt: string;
  /** The start of the request behind a generation. */
  prompt: string | null;
  /** What the project shows now: the newest version, or one rolled back to. */
  current: boolean;
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
  credits?: {
    charged: number;
    remaining: number;
  };
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

export interface ApiCapabilities {
  /** Whether this deployment can read a website into Brand DNA. */
  brandExtraction?: boolean;
}

export interface MotionMessageInput {
  message: string;
  /** Reasoning effort selected in the prompt composer. */
  effort?: GenerationEffort;
  /** Model selected in the prompt composer; Pro needs a paid plan. */
  model?: GenerationModel;
  /** False when narration (text-to-speech) is switched off in the prompt composer. */
  tts?: boolean;
  brandId?: string | null;
  /** The canvas chosen in the new-video composer before generation starts. */
  aspectRatio?: CanvasAspect;
  revision?: number;
  runtimeError?: string;
  /**
   * The price the composer showed for this message, in credits. The server
   * charges exactly this, or refuses with `CREDIT_PRICE_CHANGED` and charges
   * nothing when it is no longer the price.
   */
  quotedCredits?: number;
  assets?: Array<{ assetId: string; role: "reference" | "asset" }>;
  audio?: Array<{ trackId: string }>;
  tool?: GuidedToolRequest;
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

/**
 * A guided tool from the create page. The server writes the brief the model
 * works from and prices the request by `seconds`; the message stays the short
 * line the person sees in the chat.
 */
export interface GuidedToolRequest {
  id: "product-walkthrough" | "product-launch" | "social-ad" | "story";
  seconds: number;
  language: "en" | "km";
  /** The Prompt Template whose look the film takes. */
  look?: string;
  /** The upload id of the attached picture that is the logo. */
  logo?: string;
  /** The storyboard the person previewed and approved, with their edits. */
  storyboard?: Storyboard;
}

/**
 * A guided tool's storyboard: the beats planned before the film is built. It
 * settles order, timing and what happens; a beat names the pictures it shows
 * by upload id and never describes them, so the pictures still decide how
 * everything looks.
 */
export interface Storyboard {
  beats: StoryboardBeat[];
  /** The last image. */
  ending: string;
}

export interface StoryboardBeat {
  title: string;
  start: number;
  duration: number;
  /** Upload ids of the attached pictures this beat shows. */
  shows: string[];
  action: string;
  camera: string;
  /** The words on screen, exactly; empty when none. */
  text: string;
}

export interface StoryboardRequest {
  workspaceId: string;
  message: string;
  tool: Omit<GuidedToolRequest, "storyboard">;
  assets: Array<{ assetId: string; role: "reference" | "asset" }>;
  brandId?: string | null;
  aspectRatio?: "16:9" | "1:1" | "4:5" | "9:16";
  /** The price the create page showed, in credits. */
  quotedCredits?: number;
}

export interface StoryboardResult {
  storyboard: Storyboard;
  credits?: { charged: number; remaining: number };
}

export type GenerationEffort = "medium" | "high";

/**
 * Flash runs for everyone; Pro is the paid plans' model. The backend decides
 * which model each one is, so the editor never names one.
 */
export type GenerationModel = "flash" | "pro";

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

  getCapabilities() {
    return this.request<ApiCapabilities>("/v1/capabilities");
  }

  getSubscription(workspaceId: string) {
    return this.request<WorkspaceSubscription>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/billing/subscription`,
    );
  }

  getPromotionBanner() {
    return this.request<PromotionBanner | null>("/v1/promotions/banner");
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
      brandSelection?: string;
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
          ...(input.brandSelection
            ? { brandSelection: input.brandSelection }
            : {}),
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

  /** Saves the gallery still drawn from `revision`. It is not an edit: the revision stays. */
  async uploadProjectThumbnail(
    projectId: string,
    revision: number,
    image: Blob,
  ) {
    await this.ensureCsrfToken();
    return this.request<{ revision: number; updatedAt: string }>(
      `/v1/projects/${encodeURIComponent(projectId)}/thumbnail?revision=${revision}`,
      { method: "PUT", body: image },
    );
  }

  /**
   * The gallery still for `revision`. Its URL names the revision and the API
   * lets the browser keep it, so each still crosses the network once.
   */
  async getProjectThumbnail(
    projectId: string,
    revision: number,
  ): Promise<Blob> {
    const response = await fetch(
      new URL(
        `/v1/projects/${encodeURIComponent(projectId)}/thumbnail?v=${revision}`,
        this.baseUrl,
      ),
      { credentials: "include" },
    );
    if (!response.ok) {
      throw new CloudApiError(
        response.status,
        "THUMBNAIL_UNAVAILABLE",
        `Thumbnail request failed with status ${response.status}.`,
      );
    }
    return response.blob();
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

  /** Plans a guided tool's storyboard; charged a fixed few credits. */
  async planStoryboard(input: StoryboardRequest) {
    await this.ensureCsrfToken();
    return this.request<StoryboardResult>("/v1/storyboards", {
      method: "POST",
      body: input,
    });
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
  listBrands() {
    return this.request<BrandProfileList>("/v1/brand/profiles");
  }

  async createBrand(name: string) {
    await this.ensureCsrfToken();
    return this.request<BrandResource>("/v1/brand/profiles", {
      method: "POST",
      body: { name },
    });
  }

  async deleteBrand(brandId: string) {
    await this.ensureCsrfToken();
    return this.request<void>(
      `/v1/brand/profiles/${encodeURIComponent(brandId)}`,
      { method: "DELETE" },
    );
  }

  getBrand(brandId?: string) {
    return this.request<BrandResource>(
      `/v1/brand${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ""}`,
    );
  }

  /**
   * Reads a website into the brand. The server only fills fields a person has
   * not typed, and answers with the brand as it now stands and the fields it filled.
   */
  async extractBrand(url: string) {
    await this.ensureCsrfToken();
    return this.request<{ brand: BrandResource; applied: string[] }>(
      "/v1/brand/extract",
      { method: "POST", body: { url } },
    );
  }

  /** Replaces the brand document against the revision it was read at. */
  async saveBrand(revision: number, dna: BrandDna, brandId?: string) {
    await this.ensureCsrfToken();
    return this.request<BrandResource>(
      `/v1/brand${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ""}`,
      {
        method: "PUT",
        body: { revision, dna },
      },
    );
  }

  async addBrandAsset(
    input: {
      assetId: string;
      role: BrandAssetRole;
      label?: string | null;
    },
    brandId?: string,
  ) {
    await this.ensureCsrfToken();
    return this.request<BrandResource>(
      `/v1/brand/assets${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ""}`,
      {
        method: "POST",
        body: input,
      },
    );
  }

  async updateBrandAsset(
    assetId: string,
    input: { role?: BrandAssetRole; label?: string | null },
    brandId?: string,
  ) {
    await this.ensureCsrfToken();
    return this.request<BrandResource>(
      `/v1/brand/assets/${encodeURIComponent(assetId)}${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ""}`,
      { method: "PATCH", body: input },
    );
  }

  async removeBrandAsset(assetId: string, brandId?: string) {
    await this.ensureCsrfToken();
    return this.request<void>(
      `/v1/brand/assets/${encodeURIComponent(assetId)}${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ""}`,
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

  listVersions(projectId: string) {
    return this.request<ProjectVersion[]>(
      `/v1/projects/${encodeURIComponent(projectId)}/versions`,
    );
  }

  async updateVersion(
    projectId: string,
    revision: number,
    patch: { label?: string | null; pinned?: boolean },
  ) {
    await this.ensureCsrfToken();
    return this.request<void>(
      `/v1/projects/${encodeURIComponent(projectId)}/versions/${revision}`,
      { method: "PATCH", body: patch },
    );
  }

  /**
   * Rolls the project back to an old version. No version is added: that one
   * becomes current. `currentRevision` is the project revision the editor has
   * loaded, so a stale editor gets a conflict.
   */
  async restoreVersion(
    projectId: string,
    revision: number,
    currentRevision: number,
  ) {
    await this.ensureCsrfToken();
    return this.request<ProjectSummary>(
      `/v1/projects/${encodeURIComponent(projectId)}/versions/${revision}/restore`,
      { method: "POST", body: { revision: currentRevision } },
    );
  }

  updateProject(
    projectId: string,
    input: {
      revision: number;
      name?: string;
      brandSelection?: string;
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
    // A Blob (an image) goes up as itself, typed by its own MIME type.
    const raw = options.body instanceof Blob ? options.body : null;
    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "Content-Type": raw ? raw.type : "application/json" }),
        ...(method === "GET" || method === "HEAD" || !this.csrfToken
          ? {}
          : { "X-CSRF-Token": this.csrfToken }),
      },
      ...(options.body === undefined
        ? {}
        : { body: raw ?? JSON.stringify(options.body) }),
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

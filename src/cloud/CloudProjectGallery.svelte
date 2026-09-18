<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import {
    Check,
    Clock3,
    Cloud,
    Film,
    FolderOpen,
    MoreHorizontal,
    Plus,
    RefreshCcw,
    Search,
    Trash2,
    X,
  } from "lucide-svelte";
  import {
    CloudApiError,
    ProjectsApi,
    type CloudUser,
    type ProjectSourceFiles,
    type ProjectSummary,
    type WorkspaceSummary,
  } from "./projects-api";
  import { splitCompositionSource } from "./project-source";
  import AuthPanel from "../ui/auth/AuthPanel.svelte";
  import "./cloud-project-gallery.css";

  export let initialFiles: ProjectSourceFiles;
  export let width: number;
  export let height: number;
  export let fps: number;
  export let duration: number;

  const dispatch = createEventDispatcher<{
    projectchange: {
      project: ProjectSummary | null;
      files: ProjectSourceFiles;
    };
    notice: string;
    cloudready: { workspaceId: string };
  }>();
  const api = new ProjectsApi();
  const coverPalettes = [
    { background: "#151c2f", accent: "#6ea8fe", ink: "#e8f1ff" },
    { background: "#24192d", accent: "#d99df7", ink: "#f9ecff" },
    { background: "#132623", accent: "#70ddb8", ink: "#e8fff7" },
    { background: "#2b2016", accent: "#f2ad67", ink: "#fff0df" },
    { background: "#25191c", accent: "#ff7f8a", ink: "#ffecef" },
  ];

  let visible = false;
  let dialogElement: HTMLDivElement;
  let state: "loading" | "guest" | "ready" | "error" = "loading";
  let user: CloudUser | null = null;
  let workspaces: WorkspaceSummary[] = [];
  let workspaceId = "";
  let projects: ProjectSummary[] = [];
  let currentProject: ProjectSummary | null = null;
  let files = copyFiles(initialFiles);
  let busy = false;
  let errorMessage = "";
  let conflictRevision: number | null = null;
  let searchQuery = "";
  let createMode = false;
  let newProjectName = "Untitled Motify Project";
  let detailsProject: ProjectSummary | null = null;
  let detailsName = "";
  let detailsLoading = false;
  let confirmDelete = false;

  $: filteredProjects = [...projects]
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    )
    .filter((project) =>
      project.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    );

  onMount(() => void bootstrap());

  /** Re-reads the session after a sign-in or sign-out elsewhere in the editor. */
  export async function refreshSession(): Promise<void> {
    await bootstrap();
  }

  export async function openManager(): Promise<void> {
    visible = true;
    await tick();
    dialogElement?.focus();
    if (state === "error") await bootstrap();
  }

  export async function saveActive(): Promise<void> {
    if (state !== "ready" || !workspaceId) {
      await openManager();
      return;
    }
    if (!currentProject) {
      beginCreate();
      await openManager();
      return;
    }
    await saveProject();
  }

  export function setFiles(nextFiles: ProjectSourceFiles): void {
    files = copyFiles(nextFiles);
  }

  export function startUnsaved(nextFiles: ProjectSourceFiles): void {
    currentProject = null;
    files = copyFiles(nextFiles);
  }

  /** Keeps a project created outside the gallery visible in its Open list. */
  export async function registerActiveProject(
    project: ProjectSummary,
  ): Promise<void> {
    currentProject = project;
    if (state === "ready" && workspaceId) await refreshProjects();
  }

  export async function createProjectForPrompt(): Promise<ProjectSummary> {
    if (currentProject) return currentProject;
    if (state !== "ready" || !workspaceId || !canWrite()) {
      throw new Error("Sign in to create a project.");
    }
    return createProjectWithName("Untitled Motionly Project");
  }

  export async function openProjectById(projectId: string): Promise<void> {
    const project = projects.find((candidate) => candidate.id === projectId);
    await openProject(project ?? (await api.getProject(projectId)));
  }

  function copyFiles(source: ProjectSourceFiles): ProjectSourceFiles {
    return {
      "composition.html": source["composition.html"],
      "styles.css": source["styles.css"],
      "timeline.js": source["timeline.js"],
      "index.ts": source["index.ts"],
    };
  }

  async function bootstrap(): Promise<void> {
    state = "loading";
    errorMessage = "";
    try {
      const session = await api.getSession();
      user = session.user;
      workspaces = await api.listWorkspaces();
      workspaceId = workspaces[0]?.id ?? "";
      state = "ready";
      await refreshProjects();
      dispatch("cloudready", { workspaceId });
    } catch (error) {
      if (error instanceof CloudApiError && error.status === 401) {
        state = "guest";
        return;
      }
      state = "error";
      errorMessage = errorText(error);
    }
  }

  async function changeWorkspace(event: Event): Promise<void> {
    workspaceId = (event.currentTarget as HTMLSelectElement).value;
    currentProject = null;
    files = copyFiles(initialFiles);
    searchQuery = "";
    createMode = false;
    closeDetails();
    dispatch("projectchange", { project: null, files: copyFiles(files) });
    await refreshProjects();
    dispatch("cloudready", { workspaceId });
  }

  async function refreshProjects(): Promise<void> {
    if (!workspaceId) {
      projects = [];
      return;
    }
    busy = true;
    errorMessage = "";
    try {
      projects = await api.listProjects(workspaceId);
    } catch (error) {
      errorMessage = errorText(error);
    } finally {
      busy = false;
    }
  }

  function beginCreate(): void {
    files = copyFiles(initialFiles);
    createMode = true;
    closeDetails();
    newProjectName = "Untitled Motify Project";
    errorMessage = "";
    void tick().then(() =>
      document
        .querySelector<HTMLInputElement>("#cloud-new-project-name")
        ?.select(),
    );
  }

  async function createProject(): Promise<void> {
    if (busy || !workspaceId || !canWrite()) return;
    if (!newProjectName.trim()) {
      errorMessage = "Give the project a name before creating it.";
      return;
    }
    try {
      await createProjectWithName(newProjectName.trim());
      createMode = false;
      dispatch(
        "notice",
        `${currentProject?.name ?? "Project"} saved to the cloud.`,
      );
      close();
    } catch (error) {
      errorMessage = errorText(error);
    }
  }

  async function createProjectWithName(name: string): Promise<ProjectSummary> {
    busy = true;
    errorMessage = "";
    try {
      const created = await api.createProject(workspaceId, {
        name,
        width,
        height,
        fps,
        duration,
        files,
      });
      currentProject = created;
      await refreshProjects();
      dispatch("projectchange", {
        project: currentProject,
        files: copyFiles(files),
      });
      return created;
    } finally {
      busy = false;
    }
  }

  async function openProject(project: ProjectSummary): Promise<void> {
    if (busy) return;
    busy = true;
    errorMessage = "";
    conflictRevision = null;
    try {
      const [latestProject, source] = await Promise.all([
        api.getProject(project.id),
        api.getSource(project.id),
      ]);
      currentProject = latestProject;
      files = splitCompositionSource(
        source["composition.html"],
        source["timeline.js"],
        initialFiles["index.ts"],
      );
      dispatch("projectchange", {
        project: latestProject,
        files: copyFiles(files),
      });
      dispatch("notice", `${latestProject.name} opened.`);
      close();
    } catch (error) {
      errorMessage = errorText(error);
    } finally {
      busy = false;
    }
  }

  async function saveProject(): Promise<void> {
    if (!currentProject || busy || !workspaceId || !canWrite()) return;
    busy = true;
    errorMessage = "";
    conflictRevision = null;
    try {
      const saved = await api.saveSource(currentProject.id, {
        revision: currentProject.revision,
        files,
      });
      currentProject = saved.project;
      await refreshProjects();
      dispatch("projectchange", {
        project: currentProject,
        files: copyFiles(files),
      });
      dispatch("notice", `${currentProject.name} saved to the cloud.`);
    } catch (error) {
      if (
        error instanceof CloudApiError &&
        error.code === "REVISION_CONFLICT"
      ) {
        const latest = error.details?.["currentRevision"];
        conflictRevision = typeof latest === "number" ? latest : null;
        errorMessage =
          "This project changed elsewhere. Open the latest save before saving again.";
        await openManager();
      } else {
        errorMessage = errorText(error);
        await openManager();
      }
    } finally {
      busy = false;
    }
  }

  async function showDetails(project: ProjectSummary): Promise<void> {
    if (busy) return;
    createMode = false;
    detailsProject = project;
    detailsName = project.name;
    confirmDelete = false;
    detailsLoading = true;
    errorMessage = "";
    try {
      const latestProject = await api.getProject(project.id);
      detailsProject = latestProject;
      detailsName = latestProject.name;
      if (currentProject?.id === latestProject.id)
        currentProject = latestProject;
    } catch (error) {
      errorMessage = errorText(error);
    } finally {
      detailsLoading = false;
    }
  }

  async function renameProject(): Promise<void> {
    if (!detailsProject || busy || !canWrite()) return;
    if (!detailsName.trim()) {
      errorMessage = "Project name cannot be empty.";
      return;
    }
    if (detailsName.trim() === detailsProject.name) return;
    busy = true;
    errorMessage = "";
    try {
      const updated = await api.updateProject(detailsProject.id, {
        revision: detailsProject.revision,
        name: detailsName.trim(),
      });
      detailsProject = updated;
      if (currentProject?.id === updated.id) currentProject = updated;
      await refreshProjects();
      dispatch("notice", `Renamed to ${updated.name}.`);
    } catch (error) {
      errorMessage = errorText(error);
    } finally {
      busy = false;
    }
  }

  async function removeProject(): Promise<void> {
    if (!detailsProject || busy || !canWrite()) return;
    if (!confirmDelete) {
      confirmDelete = true;
      return;
    }
    busy = true;
    errorMessage = "";
    try {
      await api.removeProject(detailsProject.id, detailsProject.revision);
      const removedId = detailsProject.id;
      const removedName = detailsProject.name;
      closeDetails();
      if (currentProject?.id === removedId) {
        currentProject = null;
        files = copyFiles(initialFiles);
        dispatch("projectchange", { project: null, files: copyFiles(files) });
      }
      await refreshProjects();
      dispatch("notice", `${removedName} archived.`);
    } catch (error) {
      errorMessage = errorText(error);
    } finally {
      busy = false;
      confirmDelete = false;
    }
  }

  async function reloadCurrent(): Promise<void> {
    if (currentProject) await openProject(currentProject);
  }

  function canWrite(): boolean {
    const role = workspaces.find(
      (workspace) => workspace.id === workspaceId,
    )?.role;
    return role === "owner" || role === "editor";
  }

  function coverStyle(project: ProjectSummary): string {
    const seed = [...project.id].reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    );
    const palette =
      coverPalettes[seed % coverPalettes.length] ?? coverPalettes[0]!;
    return `--project-cover: ${palette.background}; --project-accent: ${palette.accent}; --project-ink: ${palette.ink};`;
  }

  function projectInitials(name: string): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "M"
    );
  }

  function formatUpdatedAt(value: string): string {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return "Saved recently";
    const elapsedMinutes = Math.max(
      0,
      Math.floor((Date.now() - timestamp) / 60000),
    );
    if (elapsedMinutes < 1) return "Saved just now";
    if (elapsedMinutes < 60) return `Saved ${elapsedMinutes}m ago`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `Saved ${elapsedHours}h ago`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays < 7) return `Saved ${elapsedDays}d ago`;
    return `Saved ${new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year:
        new Date(value).getFullYear() === new Date().getFullYear()
          ? undefined
          : "numeric",
    }).format(new Date(value))}`;
  }

  function durationLabel(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    if (total < 60) return `${total}s`;
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function errorText(error: unknown): string {
    return error instanceof Error
      ? error.message
      : "Motify could not complete the cloud request.";
  }

  function closeDetails(): void {
    detailsProject = null;
    detailsName = "";
    confirmDelete = false;
  }

  function openDetailsProject(): void {
    if (detailsProject) void openProject(detailsProject);
  }

  function close(): void {
    visible = false;
    createMode = false;
    closeDetails();
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (!visible || event.key !== "Escape") return;
    if (detailsProject) closeDetails();
    else if (createMode) createMode = false;
    else close();
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

{#if visible}
  <div class="cloud-projects-backdrop">
    <div
      bind:this={dialogElement}
      class="cloud-projects-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-projects-title"
      tabindex="-1"
    >
      <header class="cloud-projects-header">
        <div class="cloud-projects-heading">
          <h2 id="cloud-projects-title">My projects</h2>
          <p>
            {#if user}Pick up where you left off, {user.displayName ||
                user.email}.{:else}Your saved Motify projects.{/if}
          </p>
        </div>
        <div class="cloud-header-actions">
          {#if state === "ready" && workspaces.length > 0}
            <label class="cloud-workspace-select">
              <span>Workspace</span>
              <select
                value={workspaceId}
                on:change={changeWorkspace}
                disabled={busy}
              >
                {#each workspaces as workspace}
                  <option value={workspace.id}>{workspace.name}</option>
                {/each}
              </select>
            </label>
            <button
              class="cloud-icon-button"
              on:click={refreshProjects}
              disabled={busy}
              aria-label="Refresh projects"
              title="Refresh projects"
            >
              <RefreshCcw class={busy ? "cloud-spin" : ""} size={16} />
            </button>
          {/if}
          <button
            class="cloud-icon-button"
            on:click={close}
            aria-label="Close projects"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {#if state === "loading"}
        <div class="cloud-projects-state" aria-live="polite">
          <RefreshCcw class="cloud-spin" size={22} />
          <strong>Loading your projects…</strong>
        </div>
      {:else if state === "guest"}
        <div class="cloud-login-layout">
          <div class="cloud-login-copy">
            <Cloud size={30} />
            <h3>Your projects, right where you left them.</h3>
            <p>
              Sign in to open recent work and keep your latest save protected
              across devices.
            </p>
          </div>
          <div class="cloud-login-form">
            <AuthPanel onauthenticated={bootstrap} />
          </div>
        </div>
      {:else if state === "error"}
        <div class="cloud-projects-state">
          <strong>Cloud connection unavailable</strong>
          <p>{errorMessage}</p>
          <button class="cloud-primary" on:click={bootstrap}>
            <RefreshCcw size={15} /> Try again
          </button>
        </div>
      {:else if workspaces.length === 0}
        <div class="cloud-projects-state">
          <Film size={24} />
          <strong>No workspace is available</strong>
          <p>A workspace is required before you can save a Motify project.</p>
        </div>
      {:else}
        <div class="cloud-gallery-toolbar">
          <label class="cloud-search">
            <Search size={16} />
            <input
              bind:value={searchQuery}
              type="search"
              placeholder="Search projects"
              aria-label="Search projects"
            />
          </label>
          <span
            >{projects.length}
            {projects.length === 1 ? "project" : "projects"}</span
          >
        </div>

        {#if errorMessage}
          <div class="cloud-gallery-error" role="alert">
            <span>
              {errorMessage}{conflictRevision
                ? ` Latest save: ${conflictRevision}.`
                : ""}
            </span>
            {#if conflictRevision}<button on:click={reloadCurrent}
                >Open latest</button
              >{/if}
          </div>
        {/if}

        {#if createMode}
          <form
            class="cloud-create-panel"
            on:submit|preventDefault={createProject}
          >
            <div>
              <strong>Name your new project</strong>
              <span>The project starts as a blank Motify composition.</span>
            </div>
            <input
              id="cloud-new-project-name"
              bind:value={newProjectName}
              maxlength="120"
              aria-label="New project name"
              required
            />
            <div class="cloud-create-actions">
              <button type="button" on:click={() => (createMode = false)}
                >Cancel</button
              >
              <button class="cloud-primary" disabled={busy || !canWrite()}>
                {busy ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        {/if}

        <main class="cloud-project-gallery" aria-label="Recent projects">
          {#if !searchQuery}
            <button
              class="cloud-new-project-card"
              on:click={beginCreate}
              disabled={busy || !canWrite()}
            >
              <span class="cloud-new-project-cover"><Plus size={28} /></span>
              <span class="cloud-card-copy">
                <strong>Create new project</strong>
                <small>Start from a blank composition</small>
              </span>
            </button>
          {/if}

          {#each filteredProjects as project}
            <article
              class:active={currentProject?.id === project.id}
              class="cloud-project-card"
            >
              <button
                class="cloud-project-cover"
                style={coverStyle(project)}
                on:click={() => openProject(project)}
                disabled={busy}
                aria-label={`Open ${project.name}`}
              >
                <span class="cloud-cover-shape cloud-cover-shape-one"></span>
                <span class="cloud-cover-shape cloud-cover-shape-two"></span>
                <span class="cloud-cover-initials"
                  >{projectInitials(project.name)}</span
                >
                <span class="cloud-cover-open"
                  ><FolderOpen size={14} /> Open</span
                >
                <span class="cloud-cover-duration">
                  <Clock3 size={11} />
                  {durationLabel(project.duration)}
                </span>
              </button>
              <div class="cloud-project-card-meta">
                <button
                  class="cloud-project-title"
                  on:click={() => openProject(project)}
                  disabled={busy}
                >
                  <strong>{project.name}</strong>
                  <small>{formatUpdatedAt(project.updatedAt)}</small>
                </button>
                <button
                  class="cloud-card-menu"
                  on:click={() => showDetails(project)}
                  disabled={busy}
                  aria-label={`Manage ${project.name}`}
                  title="Project details"
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
            </article>
          {:else}
            {#if searchQuery}
              <div class="cloud-gallery-empty">
                <Search size={22} />
                <strong>No projects match “{searchQuery}”</strong>
                <button on:click={() => (searchQuery = "")}>Clear search</button
                >
              </div>
            {:else}
              <div class="cloud-gallery-empty">
                <Film size={22} />
                <strong>No saved projects yet</strong>
                <span>Create your first project to find it here next time.</span
                >
              </div>
            {/if}
          {/each}
        </main>

        {#if detailsProject}
          <button
            class="cloud-details-scrim"
            on:click={closeDetails}
            aria-label="Close project details"
          ></button>
          <aside class="cloud-project-details" aria-label="Project details">
            <header>
              <div>
                <strong>Project details</strong>
                <span>{formatUpdatedAt(detailsProject.updatedAt)}</span>
              </div>
              <button
                class="cloud-icon-button"
                on:click={closeDetails}
                aria-label="Close details"
              >
                <X size={17} />
              </button>
            </header>

            {#if detailsLoading}
              <div class="cloud-details-loading">
                <RefreshCcw class="cloud-spin" size={18} /> Loading details…
              </div>
            {:else}
              <div class="cloud-details-body">
                <div class="cloud-rename-row">
                  <label>
                    Project name
                    <input
                      bind:value={detailsName}
                      maxlength="120"
                      disabled={!canWrite()}
                    />
                  </label>
                  <button
                    on:click={renameProject}
                    disabled={busy ||
                      !canWrite() ||
                      detailsName.trim() === detailsProject.name}
                    aria-label="Save project name"
                  >
                    <Check size={15} />
                  </button>
                </div>

                <dl class="cloud-project-facts">
                  <div>
                    <dt>Canvas</dt>
                    <dd>{detailsProject.width} × {detailsProject.height}</dd>
                  </div>
                  <div>
                    <dt>Frame rate</dt>
                    <dd>{detailsProject.fps} fps</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>{durationLabel(detailsProject.duration)}</dd>
                  </div>
                </dl>

                <section class="cloud-latest-save">
                  <Clock3 size={16} />
                  <div>
                    <strong>Latest save protected</strong>
                    <span>{formatUpdatedAt(detailsProject.updatedAt)}</span>
                  </div>
                </section>
              </div>

              <footer class="cloud-details-footer">
                <button
                  class:confirm={confirmDelete}
                  class="cloud-delete"
                  on:click={removeProject}
                  disabled={busy || !canWrite()}
                >
                  <Trash2 size={14} />
                  {confirmDelete ? "Confirm archive" : "Archive project"}
                </button>
                <button
                  class="cloud-primary"
                  on:click={openDetailsProject}
                  disabled={busy}
                >
                  <FolderOpen size={14} /> Open project
                </button>
              </footer>
            {/if}
          </aside>
        {/if}
      {/if}
    </div>
  </div>
{/if}

import type { ProjectsApi } from "./projects-api";

/**
 * Object URLs for the gallery's stills, one per project for the life of the
 * tab, so reopening My Videos draws every card without asking again. The
 * fetch itself is answered from the HTTP cache after the first time.
 */
const stills = new Map<string, { revision: number; url: Promise<string> }>();

function keep(projectId: string, revision: number, url: Promise<string>): void {
  const previous = stills.get(projectId);
  stills.set(projectId, { revision, url });
  previous?.url.then(URL.revokeObjectURL, () => undefined);
  url.catch(() => {
    if (stills.get(projectId)?.url === url) stills.delete(projectId);
  });
}

/** A still the editor just drew, shown at once without fetching it back. */
export function seedProjectThumbnail(
  projectId: string,
  revision: number,
  image: Blob,
): void {
  keep(projectId, revision, Promise.resolve(URL.createObjectURL(image)));
}

export function projectThumbnailUrl(
  api: Pick<ProjectsApi, "getProjectThumbnail">,
  projectId: string,
  revision: number,
): Promise<string> {
  const cached = stills.get(projectId);
  if (cached && cached.revision >= revision) return cached.url;
  const url = api
    .getProjectThumbnail(projectId, revision)
    .then((image) => URL.createObjectURL(image));
  keep(projectId, revision, url);
  return url;
}

import type { ProjectSourceFiles } from "../cloud/projects-api";
import type { DynamicCompositionOptions } from "../composition/dynamic-compiler";

export interface LocalProject {
  name: string;
  files: ProjectSourceFiles;
  metadata: DynamicCompositionOptions;
  assets: string[];
}

const endpoint = "/api/local-project";

export async function loadLocalProject(): Promise<LocalProject | null> {
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Local project request failed (${response.status}).`);
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      return null;
    }
    return (await response.json()) as LocalProject;
  } catch (error) {
    // A normal cloud/development build has no local-project endpoint.
    if (error instanceof TypeError) return null;
    throw error;
  }
}

export async function saveLocalProject(
  files: ProjectSourceFiles,
): Promise<boolean> {
  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files }),
    });
    if (response.status === 404) return false;
    if (!response.ok) {
      throw new Error(`Local project save failed (${response.status}).`);
    }
    return true;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

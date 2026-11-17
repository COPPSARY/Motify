import { readonly, writable } from "svelte/store";

import { ProjectsApi } from "../cloud/projects-api";

export interface PromptAssistContext {
  /** True when the API serves the prompt enhancer and someone is signed in. */
  enabled: boolean;
  /** The workspace being worked in, whose Brand DNA tells the enhancer what the product is. */
  workspaceId: string | null;
  /** The brand picked in the composer: an id, null for none, undefined for the default one. */
  brandId: string | null | undefined;
}

const context = writable<PromptAssistContext>({
  enabled: false,
  workspaceId: null,
  brandId: undefined,
});

/**
 * Whether the Enhance button may show. Set once by the app, read by every
 * prompt box that offers it, so none of them needs it passed down.
 */
export const promptAssistContext = readonly(context);

let available = false;
let signedIn = false;
let workspace: string | null = null;
let brand: string | null | undefined = undefined;

function publish(): void {
  context.set({
    enabled: available && signedIn,
    workspaceId: workspace,
    brandId: brand,
  });
}

/** Asks the API whether it serves the prompt enhancer; an older API hides it. */
export async function refreshPromptAssist(
  api: Pick<ProjectsApi, "getCapabilities"> = new ProjectsApi(),
): Promise<void> {
  try {
    available = (await api.getCapabilities()).promptAssist === true;
  } catch {
    available = false;
  }
  publish();
}

/** The enhancer needs a session (the server rate limits it per person), so it shows only when signed in. */
export function setPromptAssistUser(isSignedIn: boolean): void {
  signedIn = isSignedIn;
  publish();
}

/** Which product the enhancer writes about: the workspace and the brand picked in the composer. */
export function setPromptAssistBrand(
  workspaceId: string | null,
  brandId: string | null | undefined,
): void {
  workspace = workspaceId;
  brand = brandId;
  publish();
}

let notify: (message: string) => void = () => undefined;

/** The app's toast, so a prompt box deep in a page can report a charge or an error. */
export function setPromptAssistNotifier(show: (message: string) => void): void {
  notify = show;
}

export function notifyPromptAssist(message: string): void {
  notify(message);
}

/** Test hook: back to signed out and unavailable. */
export function resetPromptAssist(): void {
  available = false;
  signedIn = false;
  workspace = null;
  brand = undefined;
  publish();
}

import { readonly, writable } from "svelte/store";

import {
  ProjectsApi,
  type FilmRequest,
  type FulfillmentMode,
} from "../cloud/projects-api";

const TELEGRAM_KEY = "motify_telegram_contact";

const mode = writable<FulfillmentMode>("ai");
const active = writable<FilmRequest | null>(null);

/**
 * Who makes films right now, as `/v1/capabilities` last said: the AI, or our
 * team by hand. In `manual`, a message becomes a film request and the film is
 * sent to the person's Telegram.
 */
export const fulfillmentMode = readonly(mode);

/**
 * The open project's latest film request, while it is waiting, being made, or
 * just arrived; null otherwise.
 */
export const activeFilmRequest = readonly(active);

/** The phone number or @username the person's films are sent to, remembered on this device. */
export const telegramContact = writable<string>(readStoredContact());
telegramContact.subscribe((value) => {
  try {
    if (value.trim()) localStorage.setItem(TELEGRAM_KEY, value.trim());
    else localStorage.removeItem(TELEGRAM_KEY);
  } catch {
    // Storage can be off; the field is just empty next time.
  }
});

function readStoredContact(): string {
  try {
    return localStorage.getItem(TELEGRAM_KEY) ?? "";
  } catch {
    return "";
  }
}

const PHONE = /^\+?[0-9][0-9 ()-]{5,22}[0-9]$/;
const USERNAME = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;

/** A phone number (6 to 15 digits) or a Telegram @username, as the server accepts them. */
export function isTelegramContact(value: string): boolean {
  const trimmed = value.trim();
  if (USERNAME.test(trimmed)) return true;
  if (!PHONE.test(trimmed)) return false;
  const digits = trimmed.replace(/[^0-9]/g, "").length;
  return digits >= 6 && digits <= 15;
}

export function setFulfillmentMode(next: FulfillmentMode): void {
  mode.set(next);
}

/** Asks the API who makes films; an API that cannot say leaves it to the AI. */
export async function refreshFulfillmentMode(
  api: Pick<ProjectsApi, "getCapabilities"> = new ProjectsApi(),
): Promise<FulfillmentMode> {
  try {
    const capabilities = await api.getCapabilities();
    const next = capabilities.fulfillment === "manual" ? "manual" : "ai";
    mode.set(next);
    return next;
  } catch {
    return "ai";
  }
}

/** Bumped on every change, so a slow project load never replaces a request shown after it began. */
let version = 0;

export function showFilmRequest(request: FilmRequest | null): void {
  version += 1;
  active.set(request);
}

/** How long a delivered or cancelled request stays on screen after it closed. */
const RECENT_MS = 24 * 60 * 60 * 1000;

/** Shows the project's latest request if it is still open, or closed in the last day. */
export async function loadProjectFilmRequest(
  projectId: string | null,
  api: Pick<ProjectsApi, "listFilmRequests"> = new ProjectsApi(),
  now = Date.now(),
): Promise<void> {
  const started = (version += 1);
  if (!projectId) {
    active.set(null);
    return;
  }
  try {
    const [latest] = await api.listFilmRequests(projectId);
    if (started !== version) return;
    const closedAt = latest?.deliveredAt ?? latest?.cancelledAt;
    active.set(
      latest && (!closedAt || now - Date.parse(closedAt) < RECENT_MS)
        ? latest
        : null,
    );
  } catch {
    // An API without film requests, or a project that is not ours: nothing to show.
    if (started === version) active.set(null);
  }
}

export function isOpenFilmRequest(request: FilmRequest | null): boolean {
  return request?.status === "queued" || request?.status === "in_progress";
}

/**
 * Waits for a generation the browser lost track of to land on the server.
 *
 * A long generation (a new film especially) can outlast the hosting gateway's
 * request limit. The gateway drops the connection while the backend keeps
 * working, saves the film, and bills it, so the caller polls for that save
 * instead of reporting a failure the user would "retry" into a duplicate run.
 */
export interface BackgroundWaitOptions {
  /** True once the saved result has been found and applied. */
  check: () => Promise<boolean>;
  /** False when the user has moved to another project; waiting stops. */
  stillCurrent: () => boolean;
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export const BACKGROUND_WAIT_MS = 10 * 60 * 1000;
export const BACKGROUND_POLL_MS = 5000;

export async function waitForSavedGeneration({
  check,
  stillCurrent,
  timeoutMs = BACKGROUND_WAIT_MS,
  intervalMs = BACKGROUND_POLL_MS,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  now = Date.now,
}: BackgroundWaitOptions): Promise<boolean> {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    await sleep(intervalMs);
    if (!stillCurrent()) return false;
    try {
      if (await check()) return true;
    } catch {
      // A failed poll is one missed look, not the end of the wait.
    }
  }
  return false;
}

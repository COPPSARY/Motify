import { updateOnboarding } from "../api/onboarding";
import { captureEvent } from "../posthog";
import { FIRST_RUN_STEPS } from "./first-video";

/**
 * Records that a brand-new account has started the first-run flow: reset, then
 * the welcome questions. It does not move the page, so the app can show the
 * questions in place.
 */
export async function startWelcome(): Promise<void> {
  captureEvent("onboarding started");
  try {
    await updateOnboarding({ reset: true });
    await updateOnboarding({ step: FIRST_RUN_STEPS.welcome });
  } catch {
    // The flow still starts; it just won't remember how far they got.
  }
}

/**
 * Starts the first-run flow for a brand-new account that signed up away from
 * the app (the sign-up dialog on another page): the welcome questions wait for
 * them at the editor's home. A held landing-page prompt stays in
 * sessionStorage and becomes their first video.
 */
export async function beginOnboarding(): Promise<void> {
  await startWelcome();
  window.location.replace("/");
}

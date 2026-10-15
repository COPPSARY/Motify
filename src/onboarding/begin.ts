import { updateOnboarding } from "../api/onboarding";
import { BRAND_ROUTE } from "../app/routes";

/**
 * Starts the first-run flow for a brand-new account: Brand DNA first, then
 * Prompt Templates and the tour. A held landing-page prompt stays in
 * sessionStorage and waits in the composer until the tour is done.
 */
export async function beginOnboarding(): Promise<void> {
  try {
    await updateOnboarding({ reset: true });
    await updateOnboarding({ step: "brand" });
  } catch {
    // The flow still starts; it just won't remember how far they got.
  }
  window.location.replace(BRAND_ROUTE);
}

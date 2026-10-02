import type { PostHog } from "posthog-js";

export type MotionlyAnalyticsEvent =
  | "ai generation completed"
  | "ai generation failed"
  | "ai generation recovered"
  | "ai generation started"
  | "asset intent chosen"
  | "frame exported"
  | "media uploaded"
  | "preset loaded"
  | "project saved"
  | "project started"
  | "video exported";

export interface AnalyticsUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

let analyticsEnabled = false;
/**
 * The client loads after the page instead of with it. Calls made before it
 * arrives wait on this promise, so no event is lost.
 */
let client: Promise<PostHog> | null = null;

function withClient(use: (posthog: PostHog) => void): void {
  void client?.then(use);
}

function shouldCaptureInThisEnvironment(): boolean {
  return (
    !import.meta.env.DEV ||
    import.meta.env["VITE_PUBLIC_POSTHOG_CAPTURE_DEV"] === "true"
  );
}

export function initPostHog(): boolean {
  if (analyticsEnabled) return true;

  const key = import.meta.env["VITE_PUBLIC_POSTHOG_KEY"] as string | undefined;
  const host = import.meta.env["VITE_PUBLIC_POSTHOG_HOST"] as
    string | undefined;
  if (!key || !host || !shouldCaptureInThisEnvironment()) return false;

  client = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: host,
      ui_host: "https://us.posthog.com",
      defaults: "2026-05-30",
      person_profiles: "identified_only",
    });
    return posthog;
  });
  analyticsEnabled = true;
  return true;
}

export function captureEvent(
  event: MotionlyAnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
): void {
  if (!analyticsEnabled) return;
  withClient((posthog) => posthog.capture(event, properties));
}

export function identifyAnalyticsUser(user: AnalyticsUser): void {
  if (!analyticsEnabled) return;
  withClient((posthog) =>
    posthog.identify(user.id, {
      email: user.email,
      display_name: user.displayName,
    }),
  );
}

export function resetAnalyticsIdentity(): void {
  if (!analyticsEnabled) return;
  withClient((posthog) => posthog.reset());
}

export function isAnalyticsEnabled(): boolean {
  return analyticsEnabled;
}

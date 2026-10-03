import { beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  identify: vi.fn(),
  init: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

describe("PostHog analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("stays disabled when the project token is missing", async () => {
    vi.stubEnv("VITE_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_CAPTURE_DEV", "true");
    const analytics = await import("../src/posthog");

    expect(analytics.initPostHog()).toBe(false);
    expect(analytics.isAnalyticsEnabled()).toBe(false);
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("stays disabled when the API host is not configured", async () => {
    vi.stubEnv("VITE_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_HOST", "");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_CAPTURE_DEV", "true");
    const analytics = await import("../src/posthog");

    expect(analytics.initPostHog()).toBe(false);
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("does not pollute PostHog with local development traffic by default", async () => {
    vi.stubEnv("VITE_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_CAPTURE_DEV", "false");
    const analytics = await import("../src/posthog");

    expect(analytics.initPostHog()).toBe(false);
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("initializes US Cloud and forwards typed events and identities", async () => {
    vi.stubEnv("VITE_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_CAPTURE_DEV", "true");
    const analytics = await import("../src/posthog");

    expect(analytics.initPostHog()).toBe(true);
    // The client loads after the page; events sent meanwhile are kept.
    await vi.waitFor(() => expect(posthogMock.init).toHaveBeenCalled());
    expect(posthogMock.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "https://us.i.posthog.com",
        defaults: "2026-05-30",
        person_profiles: "identified_only",
      }),
    );

    analytics.captureEvent("project started", { source: "new_button" });
    analytics.identifyAnalyticsUser({
      id: "user-1",
      email: "designer@example.com",
      displayName: "Designer",
    });
    analytics.resetAnalyticsIdentity();
    await vi.waitFor(() => expect(posthogMock.reset).toHaveBeenCalled());

    expect(posthogMock.capture).toHaveBeenCalledWith("project started", {
      source: "new_button",
    });
    expect(posthogMock.identify).toHaveBeenCalledWith("user-1", {
      email: "designer@example.com",
      display_name: "Designer",
    });
    expect(posthogMock.reset).toHaveBeenCalledOnce();
  });
});

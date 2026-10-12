import { beforeEach, describe, expect, it, vi } from "vitest";

const datadogRumMock = vi.hoisted(() => ({
  clearUser: vi.fn(),
  init: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@datadog/browser-rum", () => ({ datadogRum: datadogRumMock }));

describe("Datadog Browser RUM", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("never initializes in the test environment", async () => {
    vi.stubEnv("VITE_PUBLIC_DATADOG_APPLICATION_ID", "app-test");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CLIENT_TOKEN", "pub-test");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CAPTURE_DEV", "true");
    const rum = await import("../src/datadog-rum");

    expect(rum.initDatadogRum()).toBe(false);
    expect(datadogRumMock.init).not.toHaveBeenCalled();
  });

  it("never initializes during server-side rendering", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_PUBLIC_DATADOG_APPLICATION_ID", "app-test");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CLIENT_TOKEN", "pub-test");
    vi.stubGlobal("window", undefined);
    const rum = await import("../src/datadog-rum");

    expect(rum.initDatadogRum()).toBe(false);
    expect(datadogRumMock.init).not.toHaveBeenCalled();
  });

  it("stays disabled when browser credentials are missing", async () => {
    vi.stubEnv("VITE_PUBLIC_DATADOG_APPLICATION_ID", "");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CLIENT_TOKEN", "");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CAPTURE_DEV", "true");
    const rum = await import("../src/datadog-rum");

    expect(rum.initDatadogRum()).toBe(false);
    expect(rum.isDatadogRumEnabled()).toBe(false);
    expect(datadogRumMock.init).not.toHaveBeenCalled();
  });

  it("does not capture local development sessions by default", async () => {
    vi.stubEnv("VITE_PUBLIC_DATADOG_APPLICATION_ID", "app-test");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CLIENT_TOKEN", "pub-test");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CAPTURE_DEV", "false");
    const rum = await import("../src/datadog-rum");

    expect(rum.initDatadogRum()).toBe(false);
    expect(datadogRumMock.init).not.toHaveBeenCalled();
  });

  it("initializes AP1 RUM with monitoring and replay enabled", async () => {
    vi.stubEnv("VITE_PUBLIC_DATADOG_APPLICATION_ID", "app-test");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CLIENT_TOKEN", "pub-test");
    vi.stubEnv("VITE_PUBLIC_DATADOG_SITE", "ap1.datadoghq.com");
    vi.stubEnv("VITE_PUBLIC_DATADOG_SERVICE", "motify-test");
    vi.stubEnv("VITE_DD_ENV", "staging");
    vi.stubEnv("VITE_DD_VERSION", "abc123");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CAPTURE_DEV", "true");
    vi.stubEnv("MODE", "production");
    const rum = await import("../src/datadog-rum");

    expect(rum.initDatadogRum()).toBe(true);
    expect(rum.isDatadogRumEnabled()).toBe(true);
    await vi.waitFor(() => expect(datadogRumMock.init).toHaveBeenCalled());
    expect(datadogRumMock.init).toHaveBeenCalledWith({
      applicationId: "app-test",
      clientToken: "pub-test",
      site: "ap1.datadoghq.com",
      service: "motify-test",
      env: "staging",
      version: "abc123",
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackResources: true,
      trackUserInteractions: true,
      trackLongTasks: true,
      defaultPrivacyLevel: "mask-user-input",
    });

    rum.identifyDatadogUser({
      id: "user-1",
      displayName: "Designer",
      email: "designer@example.com",
    });
    rum.clearDatadogUser();

    await vi.waitFor(() => expect(datadogRumMock.setUser).toHaveBeenCalled());
    expect(datadogRumMock.setUser).toHaveBeenCalledWith({
      id: "user-1",
      name: "Designer",
      email: "designer@example.com",
    });
    await vi.waitFor(() =>
      expect(datadogRumMock.clearUser).toHaveBeenCalledOnce(),
    );
  });

  it("falls back to the package version when VITE_DD_VERSION is empty", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_PUBLIC_DATADOG_APPLICATION_ID", "app-test");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CLIENT_TOKEN", "pub-test");
    vi.stubEnv("VITE_PUBLIC_DATADOG_CAPTURE_DEV", "true");
    vi.stubEnv("VITE_DD_VERSION", "");
    const rum = await import("../src/datadog-rum");

    expect(rum.initDatadogRum()).toBe(true);
    await vi.waitFor(() => expect(datadogRumMock.init).toHaveBeenCalled());
    expect(datadogRumMock.init).toHaveBeenCalledWith(
      expect.objectContaining({ version: "2.1.0" }),
    );
  });
});

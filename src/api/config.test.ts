import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("backend API URL", () => {
  it("uses the configured URL and removes a trailing slash", async () => {
    vi.stubEnv("VITE_MOTIFY_API_URL", " https://backend.example.test/ ");
    vi.resetModules();

    const { MOTIFY_API_URL } = await import("./config");
    expect(MOTIFY_API_URL).toBe("https://backend.example.test");
  });

  it("uses the current origin when no separate backend is configured", async () => {
    vi.stubEnv("VITE_MOTIFY_API_URL", "");
    vi.resetModules();

    const { MOTIFY_API_URL } = await import("./config");
    expect(MOTIFY_API_URL).toBe(window.location.origin);
  });
});

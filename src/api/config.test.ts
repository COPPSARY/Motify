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

describe("Motify site URLs", () => {
  it("resolves promotion paths against the marketing site", async () => {
    vi.stubEnv("VITE_MOTIFY_SITE_URL", "https://motify.video/");
    vi.resetModules();

    const { motifySiteHref } = await import("./config");
    expect(motifySiteHref("/pricing?plan=starter")).toBe(
      "https://motify.video/pricing?plan=starter",
    );
  });

  it("preserves an explicit HTTPS destination", async () => {
    const { motifySiteHref } = await import("./config");
    expect(motifySiteHref("https://partner.example/offer")).toBe(
      "https://partner.example/offer",
    );
  });
});

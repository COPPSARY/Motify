import { afterEach, expect, it, vi } from "vitest";

import { findSupportedAvcConfig } from "./exporter";

afterEach(() => vi.unstubAllGlobals());

it("falls back to a supported 30 FPS H.264 configuration", async () => {
  const isConfigSupported = vi.fn(async (config: VideoEncoderConfig) => ({
    config,
    supported:
      config.framerate === 30 &&
      config.codec === "avc1.420028" &&
      config.hardwareAcceleration === "no-preference",
  }));
  vi.stubGlobal("VideoEncoder", { isConfigSupported });

  const result = await findSupportedAvcConfig(1920, 1080, 60);

  expect(result.fps).toBe(30);
  expect(result.config).toMatchObject({
    codec: "avc1.420028",
    framerate: 30,
    hardwareAcceleration: "no-preference",
  });
  expect(isConfigSupported).toHaveBeenCalledWith(
    expect.objectContaining({ framerate: 60 }),
  );
});

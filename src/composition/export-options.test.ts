import { expect, it } from "vitest";

import {
  defaultExportSettings,
  estimateExport,
  exportFileBase,
  exportBitrate,
  outputSize,
  resolveRange,
} from "./export-options";

it("keeps output dimensions even and proportional", () => {
  expect(outputSize(1920, 1080, 2160)).toEqual({
    width: 3840,
    height: 2160,
    scale: 2,
  });
  expect(outputSize(1080, 1920, 720)).toMatchObject({
    width: 720,
    height: 1280,
  });
  expect(outputSize(1080, 1080, 1080)).toMatchObject({
    width: 1080,
    height: 1080,
  });
});

it("scales bitrate with quality and keeps standard 1080p30 near 12 Mbps", () => {
  const standard = exportBitrate(1920, 1080, 30, "standard");
  expect(standard).toBeGreaterThan(11_000_000);
  expect(standard).toBeLessThan(13_000_000);
  expect(exportBitrate(1920, 1080, 30, "draft")).toBeLessThan(standard);
  expect(exportBitrate(3840, 2160, 60, "high")).toBe(60_000_000);
});

it("resolves ranges and falls back to the full video when invalid", () => {
  const base = defaultExportSettings(30, 10);
  expect(resolveRange(base, 10)).toEqual({ start: 0, end: 10 });
  expect(
    resolveRange({ ...base, range: "scene" }, 10, { start: 2, duration: 3 }),
  ).toEqual({ start: 2, end: 5 });
  expect(
    resolveRange(
      { ...base, range: "selection", selectionStart: 4, selectionEnd: 20 },
      10,
    ),
  ).toEqual({ start: 4, end: 10 });
  expect(
    resolveRange(
      { ...base, range: "selection", selectionStart: 6, selectionEnd: 6 },
      10,
    ),
  ).toEqual({ start: 0, end: 10 });
});

it("estimates size and warns about heavy exports", () => {
  const settings = { ...defaultExportSettings(30, 10), height: 2160 as number };
  const estimate = estimateExport(settings, 1920, 1080, { start: 0, end: 10 });
  expect(estimate.frames).toBe(300);
  expect(estimate.bytes).toBeGreaterThan(0);
  expect(estimate.warnings.length).toBeGreaterThan(0);
  expect(
    estimateExport({ ...settings, format: "png" }, 1920, 1080, {
      start: 0,
      end: 10,
    }),
  ).toEqual({ bytes: 0, frames: 1, warnings: [] });
});

it("turns a typed name into a safe file name", () => {
  expect(exportFileBase("My Film.mp4", "x")).toBe("My Film");
  expect(exportFileBase('a/b:c*"d', "x")).toBe("a b c d");
  expect(exportFileBase("   ", "Project One")).toBe("Project One");
  expect(exportFileBase("", "")).toBe("motify-video");
});

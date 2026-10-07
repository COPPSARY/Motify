import { expect, it } from "vitest";

import { canvasSize, frameLayout, frameTransform } from "./canvas-frame";

it("keeps the authored short side for every aspect", () => {
  expect(canvasSize(1920, 1080, "16:9")).toEqual({ width: 1920, height: 1080 });
  expect(canvasSize(1920, 1080, "1:1")).toEqual({ width: 1080, height: 1080 });
  expect(canvasSize(1920, 1080, "9:16")).toEqual({ width: 1080, height: 1920 });
});

it("fits the whole frame or fills the canvas", () => {
  const fit = frameLayout(1920, 1080, 1080, 1920, "fit");
  expect(fit.scale).toBeCloseTo(0.5625);
  expect(fit.x).toBeCloseTo(0);
  expect(fit.y).toBeCloseTo((1920 - 1080 * 0.5625) / 2);
  const fill = frameLayout(1920, 1080, 1080, 1920, "fill");
  expect(fill.scale).toBeCloseTo(1920 / 1080);
  expect(fill.x).toBeLessThan(0);
  expect(fill.y).toBeCloseTo(0);
});

it("leaves the authored canvas untouched", () => {
  const layout = frameLayout(1920, 1080, 1920, 1080, "fill");
  expect(layout.identity).toBe(true);
  expect(frameTransform(layout)).toBe("");
});

import { expect, it } from "vitest";

import {
  authoredCanvas,
  canvasAspectForSize,
  canvasSize,
  frameLayout,
  frameTransform,
} from "./canvas-frame";

it("keeps the authored short side for every aspect", () => {
  expect(canvasSize(1920, 1080, "16:9")).toEqual({ width: 1920, height: 1080 });
  expect(canvasSize(1920, 1080, "1:1")).toEqual({ width: 1080, height: 1080 });
  expect(canvasSize(1920, 1080, "4:5")).toEqual({ width: 1080, height: 1350 });
  expect(canvasSize(1920, 1080, "9:16")).toEqual({ width: 1080, height: 1920 });
});

it("recognizes the authored aspect when a saved film is reopened", () => {
  expect(canvasAspectForSize(1080, 1350)).toBe("4:5");
  expect(canvasAspectForSize(1080, 1920)).toBe("9:16");
  expect(canvasAspectForSize(1440, 900)).toBeUndefined();
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

it("opens a film on its own aspect, or at its own size when it has none", () => {
  expect(authoredCanvas(1080, 1350).aspect).toBe("4:5");
  // A 3:2 Photoshop design is not letterboxed into 16:9.
  expect(authoredCanvas(1500, 1000).aspect).toBe("original");
  expect(canvasSize(1500, 1000, "original")).toEqual({
    width: 1500,
    height: 1000,
  });
  expect(frameLayout(1500, 1000, 1500, 1000, "smart").identity).toBe(true);
});

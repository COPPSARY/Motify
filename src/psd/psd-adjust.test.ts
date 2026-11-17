import type { AdjustmentLayer } from "ag-psd";
import { describe, expect, it } from "vitest";
import {
  adjustCssColor,
  adjustRaster,
  adjustmentFunction,
  curveLut,
  levelsLut,
  type ColorAdjust,
} from "./psd-adjust";

function adjusted(
  adjustment: AdjustmentLayer,
  rgb: number[],
  blendMode?: Parameters<typeof adjustmentFunction>[1],
): number[] {
  const adjust = adjustmentFunction(adjustment, blendMode) as ColorAdjust;
  expect(typeof adjust).toBe("function");
  const out = [...rgb];
  adjust(out);
  return out.map((value) => Math.round(value));
}

describe("adjustmentFunction", () => {
  it("inverts", () => {
    expect(adjusted({ type: "invert" }, [10, 200, 255])).toEqual([245, 55, 0]);
  });

  it("applies Levels per channel, then on the composite", () => {
    const lut = levelsLut({
      shadowInput: 50,
      highlightInput: 200,
      shadowOutput: 0,
      highlightOutput: 255,
      midtoneInput: 1,
    });
    expect(Math.round(lut[50]!)).toBe(0);
    expect(Math.round(lut[125]!)).toBe(128);
    expect(Math.round(lut[200]!)).toBe(255);
    expect(
      adjusted(
        {
          type: "levels",
          channels: [
            {
              shadowInput: 0,
              highlightInput: 255,
              shadowOutput: 0,
              highlightOutput: 255,
              midtoneInput: 1,
            },
            {
              shadowInput: 0,
              highlightInput: 128,
              shadowOutput: 0,
              highlightOutput: 255,
              midtoneInput: 1,
            },
          ],
        },
        [64, 64, 64],
      ),
    ).toEqual([128, 64, 64]);
  });

  it("draws a curve through its points", () => {
    const identity = curveLut([
      { input: 0, output: 0 },
      { input: 255, output: 255 },
    ]);
    expect(Math.round(identity[100]!)).toBe(100);
    const lifted = curveLut([
      { input: 0, output: 0 },
      { input: 128, output: 180 },
      { input: 255, output: 255 },
    ]);
    expect(Math.round(lifted[128]!)).toBe(180);
    expect(lifted[64]!).toBeGreaterThan(64);
    expect(lifted[200]!).toBeLessThanOrEqual(255);
  });

  it("shifts hue and drains saturation", () => {
    expect(
      adjusted(
        {
          type: "hue/saturation",
          master: { hue: 120, saturation: 0, lightness: 0 },
        },
        [255, 0, 0],
      ),
    ).toEqual([0, 255, 0]);
    const [r, g, b] = adjusted(
      {
        type: "hue/saturation",
        master: { hue: 0, saturation: -100, lightness: 0 },
      },
      [200, 40, 40],
    );
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("turns colour to grey by Black & White's weights", () => {
    // Pure red is as light as its Reds weight: 40%.
    expect(adjusted({ type: "black & white" }, [255, 0, 0])).toEqual([
      102, 102, 102,
    ]);
  });

  it("keeps the original colour in Luminosity mode", () => {
    const [r, g, b] = adjusted(
      {
        type: "hue/saturation",
        master: { hue: 180, saturation: 0, lightness: 0 },
      },
      [200, 60, 60],
      "luminosity",
    );
    expect(r).toBeGreaterThan(g!);
    expect(g).toBe(b);
  });

  it("says why it cannot apply an adjustment", () => {
    expect(adjustmentFunction({ type: "selective color" }, "normal")).toMatch(
      /Selective Color/,
    );
  });
});

describe("applying", () => {
  it("adjusts pixels as strongly as the mask says", () => {
    const raster = {
      width: 2,
      height: 1,
      left: 0,
      top: 0,
      data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]),
    };
    const invert = adjustmentFunction(
      { type: "invert" },
      "normal",
    ) as ColorAdjust;
    adjustRaster(raster, invert, (x) => (x < 1 ? 1 : 0.5));
    expect(Array.from(raster.data)).toEqual([
      255, 255, 255, 255, 128, 128, 128, 255,
    ]);
  });

  it("adjusts a CSS colour, keeping its alpha", () => {
    const invert = adjustmentFunction(
      { type: "invert" },
      "normal",
    ) as ColorAdjust;
    expect(adjustCssColor("#ff0000", invert, 1)).toBe("#00ffff");
    expect(adjustCssColor("rgba(255, 0, 0, 0.5)", invert, 1)).toBe(
      "rgba(0, 255, 255, 0.5)",
    );
    expect(adjustCssColor("currentColor", invert, 1)).toBe("currentColor");
  });
});

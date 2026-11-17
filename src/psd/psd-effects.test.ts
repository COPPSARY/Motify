import type { LayerEffectsInfo } from "ag-psd";
import { describe, expect, it } from "vitest";
import {
  blur,
  renderLayerStyle,
  signedDistance,
  type PlacedRaster,
  type StyleOptions,
} from "./psd-effects";

/** A solid square of one colour, at (100, 100) on the canvas. */
function square(size: number, rgb = [255, 0, 0]): PlacedRaster {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i += 1)
    data.set([rgb[0]!, rgb[1]!, rgb[2]!, 255], i * 4);
  return { width: size, height: size, data, left: 100, top: 100 };
}

const options: StyleOptions = {
  fillOpacity: 1,
  globalAngle: 120,
  globalAltitude: 30,
  documentWidth: 1000,
  documentHeight: 1000,
  patterns: new Map(),
};

/** The pixel at a canvas position, as [r, g, b, a]. */
function at(raster: PlacedRaster, x: number, y: number): number[] {
  const i = ((y - raster.top) * raster.width + (x - raster.left)) * 4;
  return Array.from(raster.data.slice(i, i + 4));
}

const px = (value: number) => ({ units: "Pixels" as const, value });

describe("renderLayerStyle", () => {
  it("draws an outside stroke around the layer, with no seam", () => {
    const effects: LayerEffectsInfo = {
      stroke: [
        {
          enabled: true,
          size: px(3),
          position: "outside",
          fillType: "color",
          color: { r: 0, g: 0, b: 0 },
          opacity: 1,
        },
      ],
    };
    const { raster } = renderLayerStyle(square(20), effects, options)!;
    // It grew by the stroke on every side.
    expect(raster.left).toBe(97);
    expect(raster.width).toBe(26);
    expect(at(raster, 98, 110)).toEqual([0, 0, 0, 255]);
    expect(at(raster, 99, 110)).toEqual([0, 0, 0, 255]);
    expect(at(raster, 100, 110)).toEqual([255, 0, 0, 255]);
    expect(at(raster, 110, 110)).toEqual([255, 0, 0, 255]);
  });

  it("draws sizes as they are, whatever the style's recorded scale", () => {
    // A 300 ppi file records 300/72 as the style's scale; Photoshop still
    // draws a 3 px stroke 3 px wide.
    const effects: LayerEffectsInfo = {
      scale: 300 / 72,
      stroke: [
        {
          enabled: true,
          size: px(3),
          position: "outside",
          fillType: "color",
          color: { r: 0, g: 0, b: 0 },
          opacity: 1,
        },
      ],
    };
    const { raster } = renderLayerStyle(square(20), effects, options)!;
    expect(raster.left).toBe(97);
    expect(raster.width).toBe(26);
  });

  it("casts a drop shadow away from the light, under the layer", () => {
    const effects: LayerEffectsInfo = {
      dropShadow: [
        {
          enabled: true,
          size: px(0),
          distance: px(10),
          angle: 90,
          color: { r: 0, g: 0, b: 0 },
          opacity: 0.5,
        },
      ],
    };
    const { raster } = renderLayerStyle(square(20), effects, options)!;
    // Light from straight above: the shadow falls 10px below.
    const below = at(raster, 110, 125);
    expect(below[3]).toBeGreaterThan(120);
    expect(below[3]).toBeLessThan(135);
    expect(below.slice(0, 3)).toEqual([0, 0, 0]);
    expect(at(raster, 110, 110)).toEqual([255, 0, 0, 255]);
  });

  it("keeps a colour overlay at full strength when the layer's Fill is 0", () => {
    const effects: LayerEffectsInfo = {
      solidFill: [{ enabled: true, color: { r: 0, g: 0, b: 255 }, opacity: 1 }],
    };
    const { raster } = renderLayerStyle(square(10), effects, {
      ...options,
      fillOpacity: 0,
    })!;
    expect(at(raster, 105, 105)).toEqual([0, 0, 255, 255]);
  });

  it("lays a gradient overlay from the bottom up at 90°", () => {
    const effects: LayerEffectsInfo = {
      gradientOverlay: [
        {
          enabled: true,
          angle: 90,
          gradient: {
            name: "",
            type: "solid",
            colorStops: [
              { color: { r: 0, g: 0, b: 0 }, location: 0, midpoint: 0.5 },
              { color: { r: 255, g: 255, b: 255 }, location: 1, midpoint: 0.5 },
            ],
            opacityStops: [],
          },
        },
      ],
    };
    const { raster } = renderLayerStyle(square(100), effects, options)!;
    expect(at(raster, 150, 199)[0]).toBeLessThan(10);
    expect(at(raster, 150, 100)[0]).toBeGreaterThan(245);
    expect(at(raster, 150, 150)[0]).toBeGreaterThan(115);
    expect(at(raster, 150, 150)[0]).toBeLessThan(140);
  });

  it("darkens the inside edge facing the light with an inner shadow", () => {
    const effects: LayerEffectsInfo = {
      innerShadow: [
        {
          enabled: true,
          size: px(2),
          distance: px(4),
          angle: 120,
          color: { r: 0, g: 0, b: 0 },
          opacity: 1,
          blendMode: "multiply",
        },
      ],
    };
    const { raster } = renderLayerStyle(
      square(40, [255, 255, 255]),
      effects,
      options,
    )!;
    // Light from the upper left: the shadow sits inside the top-left edges.
    expect(at(raster, 101, 101)[0]).toBeLessThan(100);
    expect(at(raster, 138, 138)[0]).toBeGreaterThan(250);
  });

  it("does not grow a layer with only inside styles", () => {
    const { raster } = renderLayerStyle(
      square(10),
      { solidFill: [{ enabled: true, color: { r: 0, g: 255, b: 0 } }] },
      options,
    )!;
    expect([raster.left, raster.top, raster.width, raster.height]).toEqual([
      100, 100, 10, 10,
    ]);
  });

  it("turns away a layer too large to style", () => {
    const huge = { ...square(1), width: 4000, height: 4000 };
    expect(
      renderLayerStyle(huge, { solidFill: [{ enabled: true }] }, options),
    ).toBeNull();
  });
});

describe("geometry", () => {
  it("measures distance to the edge, negative inside", () => {
    const shape = new Float32Array(25);
    shape[12] = 1; // the centre of a 5×5 grid
    const d = signedDistance(shape, 5, 5);
    expect(d[12]).toBeLessThan(0);
    expect(d[13]).toBeCloseTo(0.5);
    expect(d[14]).toBeCloseTo(1.5);
  });

  it("blurs without losing what it spreads", () => {
    const grid = new Float32Array(41 * 41);
    const centre = 20 * 41 + 20;
    grid[centre] = 1;
    const blurred = blur(grid, 41, 41, 3, 0);
    const total = blurred.reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 3);
    expect(blurred[centre]).toBeGreaterThan(blurred[centre + 3]!);
    expect(blurred[centre - 3]).toBeCloseTo(blurred[centre + 3]!, 5);
    expect(blurred[centre - 3 * 41]).toBeCloseTo(blurred[centre + 3]!, 5);
  });
});

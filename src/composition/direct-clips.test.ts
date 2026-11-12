import { expect, it } from "vitest";

import { fitted, gradientMask } from "./direct-clips";

const picture = (displayWidth: number, displayHeight: number) => ({
  displayWidth,
  displayHeight,
  draw() {},
});

it("places a clip as object-fit does, on whole pixels", () => {
  // A wide clip covering the top half of a tall video: cropped at the sides.
  expect(
    fitted(
      { width: 1080, height: 960 },
      picture(1920, 1080),
      "cover",
      "50% 50%",
    ),
  ).toEqual({ x: -313, y: 0, width: 1706.6666666666665, height: 960 });
  expect(
    fitted(
      { width: 1080, height: 1920 },
      picture(1920, 1080),
      "contain",
      "50% 50%",
    ),
  ).toMatchObject({ x: 0, y: 656, width: 1080 });
  expect(
    fitted({ width: 100, height: 100 }, picture(200, 100), "fill", "0% 0%"),
  ).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  // Anything it cannot reproduce exactly is left to the page image.
  expect(
    fitted(
      { width: 100, height: 100 },
      picture(200, 100),
      "scale-down",
      "50% 50%",
    ),
  ).toBeNull();
  expect(
    fitted(
      { width: 100, height: 100 },
      picture(200, 100),
      "cover",
      "left 10px",
    ),
  ).toBeNull();
});

const style = (maskImage: string, maskSize = "auto") =>
  ({
    maskImage,
    maskSize,
    getPropertyValue: () => "",
  }) as unknown as CSSStyleDeclaration;

it("reads the talking-head split's fade-out mask", () => {
  expect(
    gradientMask(
      style("linear-gradient(rgb(0, 0, 0) 86%, rgba(0, 0, 0, 0))"),
      1080,
      960,
    ),
  ).toEqual({
    from: [0, 0],
    to: [0, 960],
    width: 1080,
    height: 960,
    stops: [
      { offset: 0.86, alpha: 1 },
      { offset: 1, alpha: 0 },
    ],
  });
  expect(
    gradientMask(
      style("linear-gradient(to right, rgb(0, 0, 0) 86%, transparent)"),
      960,
      1080,
    ),
  ).toMatchObject({ from: [0, 0], to: [960, 0] });
  // Stops without positions are spread out between their neighbours.
  expect(
    gradientMask(
      style(
        "linear-gradient(transparent, rgb(0, 0, 0), rgb(0, 0, 0), transparent)",
      ),
      10,
      30,
    )?.stops.map((stop) => +stop.offset.toFixed(3)),
  ).toEqual([0, 0.333, 0.667, 1]);
});

it("refuses masks it cannot draw exactly", () => {
  expect(gradientMask(style("url(mask.png)"), 10, 10)).toBeNull();
  expect(
    gradientMask(style("radial-gradient(rgb(0, 0, 0), transparent)"), 10, 10),
  ).toBeNull();
  expect(
    gradientMask(
      style("linear-gradient(45deg, rgb(0, 0, 0), transparent)"),
      10,
      10,
    ),
  ).toBeNull();
  expect(
    gradientMask(
      style("linear-gradient(rgb(0, 0, 0), transparent)", "50% 50%"),
      10,
      10,
    ),
  ).toBeNull();
});

import { describe, expect, it } from "vitest";

import { boundedPictureSize, pictureEdgeFor } from "./frame-render";

describe("boundedPictureSize", () => {
  it("fits a large picture inside the edge, keeping its shape", () => {
    expect(boundedPictureSize(2880, 1800, 1536)).toEqual({
      width: 1536,
      height: 960,
    });
    expect(boundedPictureSize(1170, 2532, 1536)).toEqual({
      width: 710,
      height: 1536,
    });
  });

  it("never enlarges a small one", () => {
    expect(boundedPictureSize(640, 480, 1536)).toEqual({
      width: 640,
      height: 480,
    });
  });
});

describe("pictureEdgeFor", () => {
  it("gives a picture no more than the frame needs, with room for a zoom", () => {
    expect(pictureEdgeFor(1920, 1080, 1)).toBe(2560);
    expect(pictureEdgeFor(1080, 1920, 0.5)).toBe(1280);
  });

  it("keeps a thumbnail's pictures readable", () => {
    expect(pictureEdgeFor(1920, 1080, 0.1)).toBe(512);
  });
});

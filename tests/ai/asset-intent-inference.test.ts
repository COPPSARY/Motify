import { describe, expect, it } from "vitest";
import {
  appliesToAllImages,
  inferAssetIntent,
  resolveAssetIntent,
} from "../../src/ai/asset-intent";

describe("natural-language image intent", () => {
  it.each([
    "Show this product image in the video",
    "Use the attached logo on the closing frame",
    "This is my product, animate it",
    "Use this image",
    "It is their product",
    "Put that reference image inside the film now",
  ])("places an image for: %s", (message) => {
    expect(inferAssetIntent(message)).toBe("asset");
  });

  it.each([
    "Use this as a visual reference",
    "This screenshot is for style inspiration",
    "Match the attached image's layout and typography",
    "Do not show the image, only follow its aesthetic",
  ])("keeps an image as reference for: %s", (message) => {
    expect(inferAssetIntent(message)).toBe("reference");
  });

  it("leaves an existing role alone when the message says nothing about images", () => {
    expect(inferAssetIntent("Make the ending two seconds longer")).toBeNull();
  });

  it("defaults a new ambiguous paste to a placeable asset", () => {
    expect(resolveAssetIntent("Make a launch film")).toBe("asset");
  });

  it("keeps a saved role for an unrelated instruction", () => {
    expect(resolveAssetIntent("Make the ending longer", "reference")).toBe(
      "reference",
    );
  });

  it("lets explicit wording change a saved role", () => {
    expect(resolveAssetIntent("Now use this image", "reference")).toBe("asset");
  });

  it("distinguishes collective image instructions from singular ones", () => {
    expect(appliesToAllImages("Use all attached images in the film")).toBe(
      true,
    );
    expect(appliesToAllImages("Use these images as references")).toBe(true);
    expect(appliesToAllImages("Use this image")).toBe(false);
  });
});

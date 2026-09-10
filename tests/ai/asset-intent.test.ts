import { describe, expect, it } from "vitest";
import { buildMotionlyUserMessage } from "../../src/ai/generation-guidance";

type SuppliedAsset = {
  id: string;
  name: string;
  mimeType: string;
  token: string;
  dataBase64: string;
  intent?: "reference" | "asset";
};

async function messageFor(assets: readonly SuppliedAsset[]): Promise<string> {
  return await buildMotionlyUserMessage("make a product film", {
    files: { "composition.html": "<main></main>", "timeline.js": "" },
    assets,
  } as never);
}

describe("supplied image intent", () => {
  it("gives an asset a token to place and a reference none", async () => {
    const message = await messageFor([
      {
        id: "a",
        name: "logo.svg",
        mimeType: "image/svg+xml",
        token: "motionly-asset://a",
        dataBase64: "",
        intent: "asset",
      },
      {
        id: "b",
        name: "dashboard.png",
        mimeType: "image/png",
        token: "motionly-asset://b",
        dataBase64: "",
        intent: "reference",
      },
    ]);

    const placeStart = message.indexOf("IMAGES TO PLACE");
    const referenceStart = message.indexOf("REFERENCE IMAGES");
    expect(placeStart).toBeGreaterThan(-1);
    expect(referenceStart).toBeGreaterThan(placeStart);

    const placeBlock = message.slice(placeStart, referenceStart);
    const referenceBlock = message.slice(referenceStart);

    // The logo is placeable and carries its token.
    expect(placeBlock).toContain("logo.svg");
    expect(placeBlock).toContain("motionly-asset://a");
    expect(placeBlock).not.toContain("dashboard.png");

    // The screenshot is named for reading, but never given a token to embed.
    expect(referenceBlock).toContain("dashboard.png");
    expect(referenceBlock).not.toContain("motionly-asset://b");
    expect(referenceBlock).toMatch(/never put them on screen/i);
  });

  it("treats an unclassified image as placeable so nothing is silently dropped", async () => {
    const message = await messageFor([
      {
        id: "c",
        name: "shot.png",
        mimeType: "image/png",
        token: "motionly-asset://c",
        dataBase64: "",
      },
    ]);
    expect(message).toContain("motionly-asset://c");
    expect(message).toContain("No reference images supplied.");
  });

  it("says there is nothing to place when only references are supplied", async () => {
    const message = await messageFor([
      {
        id: "d",
        name: "storyboard.png",
        mimeType: "image/png",
        token: "motionly-asset://d",
        dataBase64: "",
        intent: "reference",
      },
    ]);
    expect(message).toContain("No images to place.");
    expect(message).not.toContain("motionly-asset://d");
    expect(message).toContain("storyboard.png");
  });
});

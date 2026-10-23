import { describe, expect, it } from "vitest";

import type { StoryboardBeat } from "../cloud/projects-api";
import {
  beatTime,
  clampSeconds,
  estimateToolCredits,
  GUIDED_TOOLS,
  guideMessage,
  missingInput,
  moveBeat,
  removeBeat,
  retimeBeats,
  toolVideo,
  type GuidedTool,
} from "./guided-tools";

function tool(id: string): GuidedTool {
  const found = GUIDED_TOOLS.find((item) => item.id === id);
  if (!found) throw new Error(`No tool ${id}`);
  return found;
}

describe("guided tools", () => {
  it("offers a few tools, each with its demo template", () => {
    expect(GUIDED_TOOLS.map((item) => [item.id, item.look])).toEqual([
      ["product-walkthrough", "google-docs-product-demo"],
      ["product-launch", "bookmebus-journey"],
      ["social-ad", "motiks-spicy-curls"],
      ["story", "paper-moon"],
    ]);
  });

  it("puts screenshots first for a walkthrough and photos first for an ad", () => {
    expect(tool("product-walkthrough").lead).toBe("reference");
    expect(tool("social-ad").lead).toBe("asset");
    // A story can feature real things, a book's pages say, but has no brand to sign off with.
    expect(tool("story").placed?.label).toBe("Pictures to show");
    expect(tool("story").logo).toBe(false);
    expect(tool("product-launch").logo).toBe(true);
  });

  it("prices a film the way the server does: by length against 15 seconds", () => {
    const estimate = { typical: 10, min: 0.5, max: 30 };
    expect(estimateToolCredits(15, estimate)).toBe(10);
    expect(estimateToolCredits(10, estimate)).toBe(6.7);
    expect(estimateToolCredits(25, estimate)).toBe(16.7);
    expect(estimateToolCredits(60, estimate)).toBe(25);
    expect(estimateToolCredits(60, { ...estimate, max: 20 })).toBe(20);
    expect(estimateToolCredits(15, null)).toBeNull();
  });

  it("shows the person's choices and words in the chat, not our brief", () => {
    const options = {
      aspect: "9:16" as const,
      seconds: 20,
      language: "km" as const,
    };
    expect(
      guideMessage(tool("social-ad"), { ...options, instructions: "  " }),
    ).toBe("Social media ad · 9:16 · 20 sec · Khmer");
    expect(
      guideMessage(tool("social-ad"), {
        ...options,
        instructions: "20% off this week",
      }),
    ).toBe("Social media ad · 9:16 · 20 sec · Khmer\n\n20% off this week");
    expect(
      guideMessage(tool("social-ad"), {
        ...options,
        instructions: "",
        format: "poster",
      }),
    ).toBe("Social media ad · 1 scene · 9:16 · 20 sec · Khmer");
  });

  it("needs something to say what the film is about", () => {
    const empty = { instructions: "", images: 0, hasBrand: false };
    expect(missingInput(tool("product-walkthrough"), empty)).toContain(
      "screenshot",
    );
    expect(
      missingInput(tool("product-walkthrough"), { ...empty, images: 1 }),
    ).toBeNull();
    expect(
      missingInput(tool("product-launch"), { ...empty, hasBrand: true }),
    ).toBeNull();
    // A story is its words: pictures and a brand are not enough.
    expect(
      missingInput(tool("story"), { ...empty, images: 2, hasBrand: true }),
    ).toBe("Tell us the story.");
    expect(
      missingInput(tool("story"), { ...empty, instructions: "A boat" }),
    ).toBeNull();
  });

  it("keeps a custom length within bounds", () => {
    expect(clampSeconds(3)).toBe(5);
    expect(clampSeconds(90)).toBe(60);
    expect(clampSeconds(12.4)).toBe(12);
    expect(clampSeconds(Number.NaN)).toBeNull();
  });

  it("finds the demo video among the templates", () => {
    expect(
      toolVideo(tool("story"), [{ slug: "paper-moon", video: "moon.webm" }]),
    ).toBe("moon.webm");
    expect(toolVideo(tool("story"), [])).toBeNull();
  });
});

function beat(title: string, start: number, duration: number): StoryboardBeat {
  return {
    title,
    start,
    duration,
    shows: [],
    action: "",
    camera: "",
    text: "",
  };
}

describe("storyboard beats", () => {
  const beats = [beat("Open", 0, 3), beat("Middle", 3, 3), beat("Close", 6, 9)];

  it("retimes beats to fill the film, keeping their proportions", () => {
    expect(
      retimeBeats(beats, 30).map((item) => [item.start, item.duration]),
    ).toEqual([
      [0, 6],
      [6, 6],
      [12, 18],
    ]);
  });

  it("gives a removed beat's time to the others", () => {
    const left = removeBeat(beats, 2, 15);
    expect(left.map((item) => item.title)).toEqual(["Open", "Middle"]);
    expect(left.at(-1)!.start + left.at(-1)!.duration).toBe(15);
  });

  it("never removes the last beat", () => {
    expect(removeBeat([beat("Only", 0, 15)], 0, 15)).toHaveLength(1);
  });

  it("moves a beat and keeps the film's length", () => {
    const moved = moveBeat(beats, 2, -1, 15);
    expect(moved.map((item) => item.title)).toEqual([
      "Open",
      "Close",
      "Middle",
    ]);
    expect(moved[0]!.start).toBe(0);
    expect(moved.at(-1)!.start + moved.at(-1)!.duration).toBe(15);
    expect(moveBeat(beats, 0, -1, 15).map((item) => item.title)).toEqual([
      "Open",
      "Middle",
      "Close",
    ]);
  });

  it("writes a beat's place in the film", () => {
    expect(beatTime({ start: 0, duration: 3.5 })).toBe("0–3.5s");
  });
});

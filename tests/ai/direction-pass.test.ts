import { describe, expect, it } from "vitest";
import {
  buildDirectionUserMessage,
  DIRECTION_SYSTEM_PROMPT,
  formatDirectionBrief,
  parseDirectionResponse,
} from "../../src/ai/direction-pass";
import { buildMotionlyUserMessage } from "../../src/ai/generation-guidance";

const plan = {
  shape: "editorial",
  subject: "Claude answers wherever the work already is",
  ground: "near-black, one warm light source, most of the frame empty",
  typeTreatment:
    "a sentence that completes itself: 'Claude is' at extreme crop, camera pulls back, 'everywhere.' arrives in the space that was always there",
  chain: ["a question with nowhere to go", "the answer arrives", "it is here"],
  beats: [
    {
      id: "scene-01",
      label: "01 - the line",
      start: 0,
      duration: 4,
      shot: "two words filling the frame edge to edge",
      camera: "extreme close on the second word, pulling back",
      primary: "the line settles word by word",
    },
    {
      id: "scene-02",
      label: "02 - it completes",
      start: 4,
      duration: 4,
      shot: "the full sentence at reading size, centred",
      camera: "settles from the pullback and drifts",
      primary: "the missing word arrives and the sentence resolves",
    },
  ],
  seams: [
    {
      from: "scene-01",
      to: "scene-02",
      at: 3.4,
      duration: 1.1,
      carrier: "headline",
      mechanism: "morph",
      becomes: "the cropped phrase becomes the complete sentence",
    },
  ],
  close: "the wordmark alone on the dark ground",
  avoid: "a dashboard with cards of features",
};

describe("direction pass", () => {
  /**
   * Asserts the contract, not the creative writing. The rules in this prompt
   * are meant to be rewritten as the house style develops; what must not drift
   * is that the turn writes no code and that it still asks for the exact shape
   * `parseDirectionResponse` reads back. A prompt that stops naming `beats`
   * fails silently — every plan parses to null and the pass quietly does
   * nothing — so it is checked here instead.
   */
  it("keeps the planning turn free of code and true to the parser", () => {
    expect(DIRECTION_SYSTEM_PROMPT).toMatch(
      /You do not write code on this turn/,
    );
    expect(DIRECTION_SYSTEM_PROMPT).not.toMatch(/compositionHtml|timelineJs/);
    for (const field of [
      "shape",
      "subject",
      "ground",
      "typeTreatment",
      "chain",
      "beats",
      "seams",
      "close",
      "avoid",
    ]) {
      expect(DIRECTION_SYSTEM_PROMPT).toContain(`"${field}"`);
    }
    expect(DIRECTION_SYSTEM_PROMPT).toMatch(/"duration"/);
    expect(DIRECTION_SYSTEM_PROMPT).toMatch(/"carrier"/);
    expect(DIRECTION_SYSTEM_PROMPT).toMatch(/"mechanism"/);
  });

  it("asks for the film without handing over any composition source", () => {
    const message = buildDirectionUserMessage({
      userPrompt: "a brand film for Claude",
      conversation: [{ role: "user", text: "keep it dark and quiet" }],
    });
    expect(message).toMatch(/a brand film for Claude/);
    expect(message).toMatch(/keep it dark and quiet/);
    expect(message).toMatch(/TARGET DURATION/);
    expect(message).not.toMatch(/<template|buildTimeline/);
  });

  it("reads a plan back out of the model's JSON", () => {
    const parsed = parseDirectionResponse(
      "```json\n" + JSON.stringify(plan) + "\n```",
    );
    expect(parsed?.shape).toBe("editorial");
    expect(parsed?.beats).toHaveLength(2);
    expect(parsed?.seams[0]?.carrier).toBe("headline");
    expect(parsed?.chain).toHaveLength(3);
  });

  it("drops malformed beats and seams rather than passing them on as direction", () => {
    const parsed = parseDirectionResponse(
      JSON.stringify({
        ...plan,
        beats: [plan.beats[0], { id: "scene-02", start: "later" }],
        seams: [{ ...plan.seams[0], mechanism: "cross-dissolve" }],
      }),
    );
    expect(parsed?.beats).toHaveLength(1);
    expect(parsed?.seams).toHaveLength(0);
  });

  it("treats an unusable response as no direction rather than an error", () => {
    expect(parseDirectionResponse("I think we should talk about this")).toBe(
      null,
    );
    expect(parseDirectionResponse(JSON.stringify({ shape: "editorial" }))).toBe(
      null,
    );
  });

  /**
   * The point of the split: the build turn is told the film is already decided,
   * so its budget goes to craft rather than to re-planning.
   */
  it("hands the build turn a settled film", async () => {
    const parsed = parseDirectionResponse(JSON.stringify(plan));
    expect(parsed).not.toBe(null);
    const brief = formatDirectionBrief(parsed!);
    expect(brief).toMatch(/ACCEPTED CREATIVE DIRECTION/);
    expect(brief).toMatch(/build this film, not a different one/);
    // The shot list is guidance, not a cage on the turn that knows the mechanics.
    expect(brief).toMatch(/retime, merge or re-cut them/);
    expect(brief).toMatch(/near-black, one warm light source/);
    expect(brief).toMatch(/sentence that completes itself/);
    expect(brief).toMatch(/scene-01 to scene-02 at 3\.4s for 1\.1s: morph/);

    const message = await buildMotionlyUserMessage("a brand film for Claude", {
      generationProfile: "claude-foundation-v1",
      directionBrief: brief,
    });
    expect(message).toContain(brief);
  });

  it("falls back to the film shape brief when no direction was produced", async () => {
    const message = await buildMotionlyUserMessage("a brand film for Claude", {
      generationProfile: "claude-foundation-v1",
    });
    expect(message).not.toMatch(/ACCEPTED CREATIVE DIRECTION/);
    expect(message).toMatch(/FILM SHAPE/i);
  });
});

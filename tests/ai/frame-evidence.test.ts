import { describe, expect, it } from "vitest";
import {
  describeFilmObservation,
  evidenceMoments,
  momentsFromComplaints,
  MAX_EVIDENCE_FRAMES,
  NO_OBSERVATION,
  type FrameEvidence,
} from "../../src/ai/frame-evidence";

const scenes = [
  { start: 0, duration: 5 },
  { start: 5, duration: 5 },
  { start: 10, duration: 5 },
  { start: 15, duration: 5 },
];

describe("moments named by a complaint", () => {
  it("reads the times the frame checks point at", () => {
    expect(
      momentsFromComplaints(
        [
          'Scene scene-02 lets settled type run 340px outside the frame around 2.40s: "Ship faster"',
          "The cut from scene-02 to scene-03 at 9.4s passes through an empty frame",
          "The film holds a completely still frame for 3.0s from 12.5s.",
        ],
        20,
      ),
    ).toEqual([2.4, 9.4, 12.5]);
  });

  it("ignores the lengths a complaint also carries", () => {
    // Each of these names a duration, not a moment: a frame taken at the
    // film's own length photographs the end rather than the fault.
    expect(
      momentsFromComplaints(
        [
          "The timeline runs 12.0s, so the composition was extended to match.",
          "AI timeline runs 400.00s, past the 300s ceiling.",
          "AI timeline stops at 3.00s and leaves the rest of the 20.00s composition frozen.",
        ],
        20,
      ),
    ).toEqual([3]);
  });

  it("keeps a named moment inside the film", () => {
    const [moment] = momentsFromComplaints(["a fault at 90.00s"], 20);
    expect(moment).toBeLessThan(20);
    expect(moment).toBeGreaterThan(19.9);
  });

  it("does not photograph the same instant twice", () => {
    expect(
      momentsFromComplaints(
        ["a fault around 6.10s", "another fault around 6.15s"],
        20,
      ),
    ).toEqual([6.1]);
  });

  it("reads nothing out of a film with no duration", () => {
    expect(momentsFromComplaints(["a fault at 2.00s"], 0)).toEqual([]);
  });
});

describe("choosing the frames a repair carries", () => {
  it("spends the budget on the complaints first, then reads as a filmstrip", () => {
    const moments = evidenceMoments(
      [
        "a blocking fault around 12.00s",
        "a second blocking fault around 3.00s",
      ],
      scenes,
      20,
    );

    expect(moments).toHaveLength(MAX_EVIDENCE_FRAMES);
    // Both complaint moments survived, and the whole set runs forward in time.
    expect(moments).toContain(12);
    expect(moments).toContain(3);
    expect([...moments].sort((a, b) => a - b)).toEqual(moments);
  });

  it("never drops a complaint moment to make room for a beat", () => {
    const named = [
      "fault around 1.00s",
      "fault around 6.00s",
      "fault around 11.00s",
      "fault around 16.00s",
      "fault around 18.00s",
    ];

    const moments = evidenceMoments(named, scenes, 20);

    expect(moments).toEqual([1, 6, 11, 16]);
  });

  it("shows the beats around a complaint that names no time", () => {
    const moments = evidenceMoments(
      ["The ad uses repeated headline and subtitle layouts."],
      scenes,
      20,
    );

    expect(moments).toEqual([2.5, 7.5, 12.5, 17.5]);
  });

  it("spreads across a film that declared no beats", () => {
    const moments = evidenceMoments([], [], 20);

    expect(moments).toHaveLength(MAX_EVIDENCE_FRAMES);
    expect(moments[0]).toBeGreaterThan(0);
    expect(moments.at(-1)).toBeLessThan(20);
  });

  it("photographs nothing when there is no film to photograph", () => {
    expect(evidenceMoments(["a fault at 2.00s"], scenes, 0)).toEqual([]);
    expect(evidenceMoments(["a fault at 2.00s"], scenes, 20, 0)).toEqual([]);
  });
});

describe("putting what the film shows to the model", () => {
  const frames: FrameEvidence[] = [
    { time: 2.4, mimeType: "image/jpeg", dataBase64: "aaa" },
    { time: 9.4, mimeType: "image/jpeg", dataBase64: "bbb" },
  ];
  const account = [
    '2.40s: headline "Ship faster" 92x9% centred 50,46%, 340px past the right.',
    "9.40s: nothing on screen.",
  ];

  it("says where the images are and what not to do with them", () => {
    const described = describeFilmObservation({ account, frames });

    expect(described).toContain("last 2 images");
    expect(described).toContain("2.40s, 9.40s");
    // A model that reads its own film as supplied material embeds a
    // screenshot of the film inside the film.
    expect(described).toMatch(/never embed/i);
  });

  it("carries the measurements on their own for a transport with no images", () => {
    const described = describeFilmObservation({ account, frames: [] });

    // This is the cloud repair: the picture arrives as numbers or not at all.
    expect(described).toContain("340px past the right");
    expect(described).toContain("nothing on screen");
    expect(described).not.toContain("attached to this message");
    expect(described).toContain("WHAT YOUR FILM ACTUALLY SHOWS");
  });

  it("says nothing when the film could not be looked at", () => {
    expect(describeFilmObservation(NO_OBSERVATION)).toBe("");
  });
});

import { describe, expect, it } from "vitest";

import { describeProgress } from "./generation-progress";

const start = 1_000_000;
const estimate = { seconds: 160, upToSeconds: 320 };

describe("describeProgress", () => {
  it("counts down to the typical time, then says the run is past it", () => {
    expect(
      describeProgress(
        { startedAt: start, phase: "writing", estimate },
        start + 10_000,
      ),
    ).toEqual({
      label: "Writing the film",
      eta: "About 3 min left",
      elapsed: "0:10",
      fraction: 10 / 320,
    });
    expect(
      describeProgress({ startedAt: start, estimate }, start + 120_000).eta,
    ).toBe("Less than a minute left");
    expect(
      describeProgress({ startedAt: start, estimate }, start + 200_000).eta,
    ).toBe("Almost done, a little longer than usual");
    const late = describeProgress(
      { startedAt: start, estimate },
      start + 400_000,
    );
    expect(late.eta).toMatch(/longer than usual/);
    expect(late.fraction).toBe(0.95);
  });

  it("shows no estimate when the backend sends none", () => {
    expect(describeProgress({ startedAt: start }, start + 5_000)).toEqual({
      label: null,
      eta: null,
      elapsed: "0:05",
      fraction: null,
    });
  });
});

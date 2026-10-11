import { describe, expect, it } from "vitest";

import {
  chooseSubjectBox,
  planCameraPath,
  trackFromKeys,
  type Box,
  type SubjectSample,
} from "./auto-reframe";

const FILM = { width: 1920, height: 1080 };
const PORTRAIT = { width: 1080, height: 1920 };
const SQUARE = { width: 1080, height: 1080 };

const box = (
  left: number,
  top: number,
  width: number,
  height: number,
): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});
function samples(boxes: (Box | null)[], step = 1 / 6): SubjectSample[] {
  return boxes.map((value, index) => ({ time: index * step, box: value }));
}

/** The authored rectangle a camera key shows on the canvas. */
function view(
  key: { scale: number; centerX: number; centerY: number },
  canvas: { width: number; height: number },
): Box {
  const width = canvas.width / key.scale;
  const height = canvas.height / key.scale;
  return box(key.centerX - width / 2, key.centerY - height / 2, width, height);
}

describe("choosing what to keep in view", () => {
  it("drops a peripheral sidebar instead of falling back to the whole frame", () => {
    const hero = { box: box(560, 380, 800, 320), text: true };
    const sidebar = { box: box(0, 0, 240, 1080), text: true };
    const chosen = chooseSubjectBox([sidebar, hero], FILM, PORTRAIT);
    expect(chosen).toEqual(hero.box);
  });

  it("keeps neighbours that still frame tightly together", () => {
    const title = { box: box(660, 400, 600, 120), text: true };
    const button = { box: box(860, 560, 200, 60), text: true };
    const chosen = chooseSubjectBox([title, button], FILM, PORTRAIT);
    expect(chosen).toEqual(box(660, 400, 600, 220));
  });

  it("lets a small icon join the subject but never lead the shot", () => {
    const title = { box: box(800, 450, 400, 120), text: true };
    const mark = { box: box(740, 470, 50, 50), text: false, minor: true };
    const farIcon = { box: box(1700, 900, 60, 60), text: false, minor: true };
    expect(chooseSubjectBox([title, mark, farIcon], FILM, PORTRAIT)).toEqual(
      box(740, 450, 460, 120),
    );
    expect(chooseSubjectBox([farIcon], FILM, PORTRAIT)).toBeNull();
  });

  it("returns nothing for an empty frame", () => {
    expect(chooseSubjectBox([], FILM, SQUARE)).toBeNull();
  });
});

describe("the camera path", () => {
  it("frames a centred subject larger than fit and keeps it fully visible", () => {
    const subject = box(660, 400, 600, 280);
    const keys = planCameraPath(
      samples(Array(12).fill(subject)),
      FILM,
      PORTRAIT,
    );
    const fit = PORTRAIT.width / FILM.width;
    for (const key of keys) {
      expect(key.scale).toBeGreaterThan(fit);
      const shown = view(key, PORTRAIT);
      expect(shown.left).toBeLessThanOrEqual(subject.left + 0.5);
      expect(shown.right).toBeGreaterThanOrEqual(subject.right - 0.5);
    }
  });

  it("never zooms a tiny subject past the cap", () => {
    const keys = planCameraPath(
      samples(Array(6).fill(box(940, 520, 40, 40))),
      FILM,
      SQUARE,
    );
    const cover = Math.max(
      SQUARE.width / FILM.width,
      SQUARE.height / FILM.height,
    );
    for (const key of keys) expect(key.scale).toBeLessThanOrEqual(cover + 1e-9);
  });

  it("stays on the film instead of showing past its edge", () => {
    const keys = planCameraPath(
      samples(Array(6).fill(box(1700, 450, 200, 180))),
      FILM,
      PORTRAIT,
    );
    for (const key of keys) {
      const shown = view(key, PORTRAIT);
      expect(shown.right).toBeLessThanOrEqual(FILM.width + 0.5);
      expect(shown.left).toBeGreaterThanOrEqual(-0.5);
    }
  });

  it("glides between shots instead of jumping, and holds still within each", () => {
    const left = box(200, 400, 400, 200);
    const right = box(1320, 400, 400, 200);
    const keys = planCameraPath(
      samples([...Array(12).fill(left), ...Array(12).fill(right)]),
      FILM,
      PORTRAIT,
    );
    expect(
      keys.filter((key) => key.cut).map((key) => keys.indexOf(key)),
    ).toEqual([12]);
    for (const shot of [keys.slice(0, 12), keys.slice(12)]) {
      for (const key of shot) {
        expect(key.centerX).toBeCloseTo(shot[0]!.centerX, 5);
        expect(key.scale).toBeCloseTo(shot[0]!.scale, 5);
      }
    }
    // Read the track at 24 fps across the change: it moves every frame of the
    // glide, always the same way, and no single frame carries the move.
    const track = trackFromKeys(keys, PORTRAIT);
    const centre = (time: number) =>
      (PORTRAIT.width / 2 - track.at(time).x) / track.at(time).scale;
    const change = keys[12]!.time;
    const frames = Array.from({ length: 48 }, (_, i) => change - 1 + i / 24);
    const xs = frames.map(centre);
    const total = Math.abs(xs.at(-1)! - xs[0]!);
    const steps = xs.slice(1).map((x, i) => x - xs[i]!);
    expect(total).toBeGreaterThan(800);
    expect(steps.every((step) => step >= -1e-6)).toBe(true);
    expect(Math.max(...steps)).toBeLessThan(total / 8);
    // The glide eases: slow at its ends, fastest in the middle.
    const firstMoving = steps.findIndex((step) => step > 1e-6);
    expect(steps[firstMoving]!).toBeLessThan(Math.max(...steps) / 4);
  });

  it("folds a brief subject change into the shot instead of twitching", () => {
    const main = box(660, 400, 600, 250);
    const blip = box(1500, 100, 300, 150);
    const keys = planCameraPath(
      samples([
        ...Array(12).fill(main),
        ...Array(3).fill(blip),
        ...Array(12).fill(main),
      ]),
      FILM,
      PORTRAIT,
    );
    expect(keys.some((key) => key.cut)).toBe(false);
  });

  it("eases out to the whole film over a long empty stretch", () => {
    const subject = box(760, 450, 400, 180);
    const keys = planCameraPath(
      samples([
        ...Array(16).fill(subject),
        ...Array(24).fill(null),
        ...Array(16).fill(subject),
      ]),
      FILM,
      PORTRAIT,
    );
    const fit = PORTRAIT.width / FILM.width;
    // Four seconds of nothing: by the middle the camera shows the whole film.
    expect(keys[28]!.scale).toBeCloseTo(fit, 3);
    expect(keys[0]!.scale).toBeGreaterThan(fit * 1.5);
  });

  it("pans smoothly when the subject drifts", () => {
    const drifting = Array.from({ length: 30 }, (_, index) =>
      box(500 + index * 20, 400, 500, 250),
    );
    const keys = planCameraPath(samples(drifting), FILM, PORTRAIT);
    expect(keys.some((key) => key.cut)).toBe(false);
    const steps = keys
      .slice(1)
      .map((key, index) => Math.abs(key.centerX - keys[index]!.centerX));
    expect(Math.max(...steps)).toBeLessThan(40);
  });

  it("holds the last shot through a blank moment", () => {
    const subject = box(700, 400, 500, 250);
    const keys = planCameraPath(
      samples([
        ...Array(8).fill(subject),
        null,
        null,
        ...Array(8).fill(subject),
      ]),
      FILM,
      PORTRAIT,
    );
    expect(keys[8]!.scale).toBeCloseTo(keys[0]!.scale, 5);
  });
});

describe("reading the path", () => {
  it("interpolates between measurements", () => {
    const track = trackFromKeys(
      [
        { time: 0, scale: 1, centerX: 500, centerY: 540 },
        { time: 1, scale: 1, centerX: 700, centerY: 540 },
      ],
      PORTRAIT,
    );
    const middle = track.at(0.5);
    expect(PORTRAIT.width / 2 - middle.x).toBeCloseTo(600);
    expect(middle.identity).toBe(false);
    expect(track.at(5)).toEqual(track.at(1));
  });
});

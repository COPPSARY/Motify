import { expect, it } from "vitest";

import { ClipReader } from "./export-clip-frames";

/** A clip of `count` frames at `fps`, decoded on demand, recording what it does. */
function fakeSink(count: number, fps: number) {
  const log = { opened: [] as number[], decoded: 0, open: 0 };
  const frame = (index: number) => ({
    timestamp: index / fps,
    closed: false,
    close() {
      this.closed = true;
      log.open -= 1;
    },
  });
  const sink = {
    async *samples(start: number) {
      log.opened.push(start);
      // Starts on the frame shown at `start`, as mediabunny does.
      for (let index = Math.floor(start * fps + 1e-6); index < count; index++) {
        log.decoded += 1;
        log.open += 1;
        yield frame(index);
      }
    },
  };
  return { sink, log };
}

it("decodes a clip forward without reopening it, one frame per step", async () => {
  const { sink, log } = fakeSink(300, 30);
  const reader = new ClipReader(sink as never);
  const shown: number[] = [];
  for (let step = 0; step < 60; step++) {
    const frame = await reader.frameAt(2 + step / 30);
    shown.push(Math.round(frame!.timestamp * 30));
  }
  expect(shown).toEqual(Array.from({ length: 60 }, (_, step) => 60 + step));
  expect(log.opened).toEqual([2]);
  // The frame shown and the one after it; nothing decoded twice.
  expect(log.decoded).toBe(61);
  expect(log.open).toBe(2);
  await reader.close();
  expect(log.open).toBe(0);
});

it("holds a frame between two of them, and reopens on a jump back or far ahead", async () => {
  const { sink, log } = fakeSink(300, 30);
  const reader = new ClipReader(sink as never);
  expect((await reader.frameAt(1.01))!.timestamp).toBe(1);
  expect((await reader.frameAt(1.02))!.timestamp).toBe(1);
  await reader.frameAt(0.5);
  await reader.frameAt(8);
  expect(log.opened).toEqual([1.01, 0.5, 8]);
  // A 60 FPS export of a 30 FPS clip shows each frame twice.
  const shown = [];
  for (let step = 0; step < 4; step++)
    shown.push((await reader.frameAt(8 + step / 60))!.timestamp * 30);
  expect(shown.map(Math.round)).toEqual([240, 240, 241, 241]);
  await reader.close();
});

it("keeps showing the last frame past the end of the clip", async () => {
  const { sink } = fakeSink(30, 30);
  const reader = new ClipReader(sink as never);
  await reader.frameAt(0.9);
  expect(Math.round((await reader.frameAt(0.99))!.timestamp * 30)).toBe(29);
  expect(Math.round((await reader.frameAt(1.5))!.timestamp * 30)).toBe(29);
  await reader.close();
});

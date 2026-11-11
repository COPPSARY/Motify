import { describe, expect, it } from "vitest";
import { envelopeGain, parseEnvelope, trackPlacement } from "./audio-envelope";
import { exportAudioTracks } from "./export-audio";

describe("audio envelope", () => {
  it("interpolates between points and holds the ends", () => {
    const envelope = parseEnvelope("0:0 1:1 3:1 4:0.5");
    expect(envelopeGain(envelope, -1)).toBe(0);
    expect(envelopeGain(envelope, 0.5)).toBe(0.5);
    expect(envelopeGain(envelope, 2)).toBe(1);
    expect(envelopeGain(envelope, 3.5)).toBe(0.75);
    expect(envelopeGain(envelope, 9)).toBe(0.5);
    expect(envelopeGain([], 2)).toBe(1);
  });

  it("reads a trimmed, shortened track and exports it the same way", () => {
    document.body.innerHTML = `<audio data-motify-audio src="blob:x" data-start="4" data-trim="1.5" data-duration="3" data-volume="0.8" data-envelope="0:0 0.04:1"></audio><audio data-motify-audio src="blob:y"></audio>`;
    const element = document.querySelector<HTMLAudioElement>("audio")!;
    expect(trackPlacement(element)).toMatchObject({
      start: 4,
      trim: 1.5,
      duration: 3,
      volume: 0.8,
    });
    const [trimmed, plain] = exportAudioTracks(document.body);
    expect(trimmed).toMatchObject({
      start: 4,
      trim: 1.5,
      duration: 3,
      volume: 0.8,
      envelope: [
        { time: 0, gain: 0 },
        { time: 0.04, gain: 1 },
      ],
    });
    expect(plain).toEqual({
      src: expect.stringContaining("blob:y"),
      start: 0,
      volume: 1,
    });
  });
});

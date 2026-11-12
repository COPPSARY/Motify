import { afterEach, expect, it, vi } from "vitest";

import type { CompositionRuntime } from "./runtime";

const muxed = vi.hoisted(() => ({
  chunks: [] as { timestamp: number; type: string }[],
}));

vi.mock("mp4-muxer", () => ({
  ArrayBufferTarget: class {
    buffer = new ArrayBuffer(0);
  },
  Muxer: class {
    addVideoChunk(chunk: { timestamp: number; type: string }) {
      muxed.chunks.push(chunk);
    }
    addAudioChunk() {}
    finalize() {}
  },
}));
vi.mock("./export-audio", () => ({
  exportAudioTracks: () => [],
  mixExportAudio: async () => null,
  encodeExportAudio: async () => null,
}));
vi.mock("./frame-render", () => ({
  // Drawing a frame takes a moment, as it does in the browser.
  renderCompositionFrame: () =>
    new Promise((resolve) =>
      setTimeout(() => resolve(document.createElement("canvas")), 1),
    ),
  releaseExportFrameCache: () => {},
}));

import { exportVideo, findSupportedAvcConfig } from "./exporter";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  muxed.chunks.length = 0;
});

it("falls back to a supported 30 FPS H.264 configuration", async () => {
  const isConfigSupported = vi.fn(async (config: VideoEncoderConfig) => ({
    config,
    supported:
      config.framerate === 30 &&
      config.codec === "avc1.420028" &&
      config.hardwareAcceleration === "no-preference",
  }));
  vi.stubGlobal("VideoEncoder", { isConfigSupported });

  const result = await findSupportedAvcConfig(1920, 1080, 60);

  expect(result.fps).toBe(30);
  expect(result.config).toMatchObject({
    codec: "avc1.420028",
    framerate: 30,
    hardwareAcceleration: "no-preference",
  });
  expect(isConfigSupported).toHaveBeenCalledWith(
    expect.objectContaining({ framerate: 60 }),
  );
});

it("reopens an encoder that closes mid-export and keeps every frame once", async () => {
  const encoders: FakeEncoder[] = [];
  let openFrames = 0;
  class FakeEncoder {
    static isConfigSupported = async (config: VideoEncoderConfig) => ({
      supported: true,
      config,
    });
    state: CodecState = "unconfigured";
    encodeQueueSize = 0;
    encoded = 0;
    constructor(private init: VideoEncoderInit) {
      encoders.push(this);
    }
    configure() {
      this.state = "configured";
    }
    encode(frame: { timestamp: number }, options?: VideoEncoderEncodeOptions) {
      if (this.state === "closed")
        throw new DOMException("closed codec", "InvalidStateError");
      this.encoded++;
      // The first encoder is reclaimed after its fourth frame, which it never
      // hands over, while the export is drawing the next one.
      if (encoders.length === 1 && this.encoded === 4) {
        setTimeout(() => {
          this.state = "closed";
          this.init.error(
            new DOMException(
              "Codec reclaimed due to inactivity.",
              "QuotaExceededError",
            ),
          );
        }, 0);
        return;
      }
      this.init.output(
        {
          timestamp: frame.timestamp,
          type: options?.keyFrame ? "key" : "delta",
        } as EncodedVideoChunk,
        undefined,
      );
    }
    addEventListener() {}
    removeEventListener() {}
    flush() {
      return this.state === "closed"
        ? Promise.reject(new DOMException("closed", "InvalidStateError"))
        : Promise.resolve();
    }
    close() {
      this.state = "closed";
    }
  }
  vi.stubGlobal("VideoEncoder", FakeEncoder);
  vi.stubGlobal(
    "VideoFrame",
    class {
      timestamp: number;
      constructor(_source: unknown, init: { timestamp: number }) {
        this.timestamp = init.timestamp;
        openFrames++;
      }
      close() {
        openFrames--;
      }
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage() {},
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(console, "warn").mockImplementation(() => {});

  const runtime = {
    definition: { duration: 1, fps: 10 },
    canvasDimensions: { width: 160, height: 90 },
    time: 0,
    snapshot: { playing: false },
    root: document.createElement("div"),
    pause() {},
    play() {},
    seek() {},
  } as unknown as CompositionRuntime;

  const result = await exportVideo(runtime, { format: "mp4" });

  expect(result.fps).toBe(10);
  expect(encoders).toHaveLength(2);
  const frames = muxed.chunks.map((chunk) => chunk.timestamp / 100_000);
  expect(frames).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  // The reopened encoder starts on a key frame.
  expect(muxed.chunks[3]!.type).toBe("key");
  expect(openFrames).toBe(0);
});

it("hands frames over unpainted, and paints them first once the encoder stops taking them", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  let encoded = 0;
  /** Frames painted before they were encoded, by frame number. */
  const painted: number[] = [];
  class FakeEncoder {
    static isConfigSupported = async (config: VideoEncoderConfig) => ({
      supported: true,
      config,
    });
    state: CodecState = "unconfigured";
    stuckSince: number | undefined;
    constructor(private init: VideoEncoderInit) {}
    /** Full from the third frame on, for five seconds, then free again. */
    get encodeQueueSize() {
      if (encoded !== 3) return 0;
      this.stuckSince ??= performance.now();
      return performance.now() - this.stuckSince < 5_000 ? 9 : 0;
    }
    configure() {
      this.state = "configured";
    }
    encode(frame: { timestamp: number }, options?: VideoEncoderEncodeOptions) {
      encoded++;
      this.init.output(
        {
          timestamp: frame.timestamp,
          type: options?.keyFrame ? "key" : "delta",
        } as EncodedVideoChunk,
        undefined,
      );
    }
    addEventListener() {}
    removeEventListener() {}
    flush() {
      return Promise.resolve();
    }
    close() {
      this.state = "closed";
    }
  }
  vi.stubGlobal("VideoEncoder", FakeEncoder);
  vi.stubGlobal(
    "VideoFrame",
    class {
      close() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage() {},
    getImageData() {
      painted.push(encoded);
    },
  } as unknown as CanvasRenderingContext2D);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});

  const runtime = {
    definition: { duration: 0.6, fps: 10 },
    canvasDimensions: { width: 160, height: 90 },
    time: 0,
    snapshot: { playing: false },
    root: document.createElement("div"),
    pause() {},
    play() {},
    seek() {},
  } as unknown as CompositionRuntime;

  const exporting = exportVideo(runtime, { format: "mp4" });
  await vi.advanceTimersByTimeAsync(10_000);
  const result = await exporting;

  expect(muxed.chunks).toHaveLength(6);
  // The first three went in as drawn; after the stall, each is painted first.
  expect(painted).toEqual([3, 4, 5]);
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining("stopped taking frames"),
  );
  expect(result.profile["encoder wait"]?.count).toBe(6);
});

import {
  ALL_FORMATS,
  BlobSource,
  Input,
  VideoSampleSink,
  type VideoSample,
  type VideoSinkDecoderOptions,
} from "mediabunny";

import type { ClipPictures, ExportClipPictures } from "./frame-render";
import { clipSecondsAt, seekVideosExactly, videosOnScreen } from "./video-sync";

/**
 * An export's clip pictures, decoded in order.
 *
 * Placing a <video> on an exact frame makes the browser decode again from the
 * keyframe before it, for every frame of the export: a second or more per
 * frame with a clip on screen, most of an export's time. An export only ever
 * moves forward a frame at a time, so each clip is instead read from its file
 * and decoded straight through with WebCodecs, one new frame per export frame.
 * A clip this cannot read (a codec WebCodecs lacks, a failed decode) is placed
 * on its <video> as before, so it still exports, only slower.
 */

/** A clip whose next frame is this far ahead is decoded on to; further, it is reopened there. */
const FORWARD_SECONDS = 2;
/** Frame times are floats; this much early still counts as the frame. */
const EPSILON = 0.002;

/** One clip on screen, decoded forward from wherever it was last asked for. */
export class ClipReader {
  private samples: AsyncGenerator<VideoSample, void, unknown> | undefined;
  private current: VideoSample | null = null;
  private next: VideoSample | null = null;

  constructor(private readonly sink: VideoSampleSink) {}

  /** The frame the clip shows at `seconds`: the last one starting at or before it. */
  async frameAt(seconds: number): Promise<VideoSample | null> {
    const current = this.current;
    const onward =
      current !== null &&
      seconds >= current.timestamp - EPSILON &&
      seconds <= current.timestamp + FORWARD_SECONDS;
    if (!onward) await this.open(seconds);
    while (this.next && this.next.timestamp <= seconds + EPSILON) {
      this.current?.close();
      this.current = this.next;
      this.next = await this.pull();
    }
    return this.current;
  }

  async close(): Promise<void> {
    const samples = this.samples;
    this.samples = undefined;
    this.current?.close();
    this.next?.close();
    this.current = this.next = null;
    await samples?.return(undefined);
  }

  private async open(seconds: number): Promise<void> {
    await this.close();
    this.samples = this.sink.samples(Math.max(0, seconds));
    this.current = await this.pull();
    this.next = await this.pull();
  }

  private async pull(): Promise<VideoSample | null> {
    const result = await this.samples!.next();
    return result.done ? null : result.value;
  }
}

export class ExportClipFrames implements ExportClipPictures {
  constructor(private readonly decoding: VideoSinkDecoderOptions = {}) {}

  private readonly sinks = new Map<string, Promise<VideoSampleSink | null>>();
  private readonly readers = new Map<HTMLVideoElement, ClipReader>();
  private readonly failed = new Set<HTMLVideoElement>();

  /**
   * Every clip on screen at `time`, decoded; any that cannot be is placed on
   * its <video> instead and left out of the pictures.
   */
  async place(root: ParentNode, time: number): Promise<ClipPictures> {
    const videos = videosOnScreen(root, time);
    const pictures: ClipPictures = new Map();
    const unread: HTMLVideoElement[] = [];
    await Promise.all(
      videos.map(async (video) => {
        const picture = await this.frameFor(video, clipSecondsAt(video, time));
        if (picture) pictures.set(video, picture);
        else unread.push(video);
      }),
    );
    if (unread.length > 0) await seekVideosExactly(root, time, unread);
    // A clip off screen gives its decoder back; it reopens if it returns.
    for (const [video, reader] of this.readers)
      if (!videos.includes(video)) {
        this.readers.delete(video);
        void reader.close().catch(() => undefined);
      }
    return pictures;
  }

  /**
   * Closes every clip's decoder and gives back the frames it holds. The
   * reader can still be asked for frames: each clip reopens where it is next
   * needed.
   */
  async dispose(): Promise<void> {
    const readers = [...this.readers.values()];
    this.readers.clear();
    await Promise.all(
      readers.map((reader) => reader.close().catch(() => undefined)),
    );
  }

  private async frameFor(
    video: HTMLVideoElement,
    seconds: number,
  ): Promise<VideoSample | null> {
    if (this.failed.has(video)) return null;
    try {
      let reader = this.readers.get(video);
      if (!reader) {
        const sink = await this.sinkFor(video.currentSrc || video.src);
        if (!sink) {
          this.failed.add(video);
          return null;
        }
        reader = new ClipReader(sink);
        this.readers.set(video, reader);
      }
      return await reader.frameAt(seconds);
    } catch (error) {
      console.warn("[Export] a clip is placed on its video instead", error);
      this.failed.add(video);
      const reader = this.readers.get(video);
      this.readers.delete(video);
      void reader?.close().catch(() => undefined);
      return null;
    }
  }

  private sinkFor(src: string): Promise<VideoSampleSink | null> {
    let sink = this.sinks.get(src);
    if (!sink) {
      sink = (async () => {
        if (!src || typeof VideoDecoder === "undefined") return null;
        const response = await fetch(src);
        if (!response.ok) return null;
        const input = new Input({
          source: new BlobSource(await response.blob()),
          formats: ALL_FORMATS,
        });
        const track = await input.getPrimaryVideoTrack();
        if (!track || !(await track.canDecode())) return null;
        return new VideoSampleSink(track, this.decoding);
      })().catch((error: unknown) => {
        console.warn("[Export] a clip could not be read for export", error);
        return null;
      });
      this.sinks.set(src, sink);
    }
    return sink;
  }
}

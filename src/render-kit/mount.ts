import {
  DEFAULT_CANVAS,
  canvasAspectForSize,
} from "../composition/canvas-frame";
import { createDynamicComposition } from "../composition/dynamic-compiler";
import { exportVideo } from "../composition/exporter";
import { renderCompositionFrame } from "../composition/frame-render";
import { CompositionRuntime } from "../composition/runtime";
import type { SceneDefinition } from "../composition/types";

/**
 * The editor's own compiler, scene kit, presets, runtime and export rasterizer,
 * bundled for a headless browser (`npm run render-kit:build`). The backend
 * loads this bundle to look at a film before it is saved, so the film it checks
 * is mounted and rasterized by exactly the code the editor and the export use.
 */

export interface FilmInput {
  /** Composition markup with assets already resolved to loadable URLs. */
  compositionHtml: string;
  timelineJs: string;
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  scenes?: readonly SceneDefinition[];
}

export interface MountedFilm {
  runtime: CompositionRuntime;
  root: HTMLElement;
  /** Length of the timeline that actually plays, padded to the declared duration. */
  playedDuration: number;
  /** Length of the timeline the film's own code built, before any padding. */
  authoredDuration: number;
  /** Ids passed to `register` with no element. */
  nullRegistrations: string[];
  seek(time: number): void;
  /** One frame through the export rasterizer, on the export's black backing. */
  exportFrame(scale: number): Promise<HTMLCanvasElement>;
  /** The whole film through the editor's video export, sound included, as base64. */
  exportVideo(options?: {
    format?: "mp4" | "webm";
    fps?: number;
  }): Promise<{ base64: string; mimeType: string }>;
  destroy(): void;
}

/**
 * Mounts a film at the top-left of the page, at its authored size, so a page
 * screenshot of that box is the preview and `exportFrame` is the export.
 * Throws whatever `buildTimeline` throws.
 */
export function mountFilm(input: FilmInput): MountedFilm {
  const composition = createDynamicComposition(
    input.compositionHtml,
    input.timelineJs,
    {
      duration: input.duration,
      width: input.width ?? 1920,
      height: input.height ?? 1080,
      fps: input.fps ?? 30,
      ...(input.scenes?.length ? { scenes: input.scenes } : {}),
    },
  );
  const nullRegistrations: string[] = [];
  let authoredDuration = 0;
  const build = composition.build.bind(composition);
  composition.build = (context) => {
    build({
      ...context,
      register: (id: string, element: HTMLElement | null) => {
        if (!element) nullRegistrations.push(id);
        return context.register(id, element as HTMLElement);
      },
    });
    authoredDuration = context.timeline.duration();
  };
  const root = document.createElement("div");
  root.style.cssText = `position:absolute;left:0;top:0;width:${composition.width}px;height:${composition.height}px;overflow:hidden`;
  document.body.append(root);
  // Start on the film's own canvas, as the editor does; without it the runtime
  // defaults to 16:9 and reframes a portrait or square film into a landscape one.
  const authoredAspect = canvasAspectForSize(
    composition.width,
    composition.height,
  );
  let runtime: CompositionRuntime;
  try {
    runtime = new CompositionRuntime(
      composition,
      root,
      authoredAspect
        ? {
            canvas: { aspect: authoredAspect, framing: DEFAULT_CANVAS.framing },
          }
        : {},
    );
  } catch (error) {
    root.remove();
    throw error;
  }
  const played = runtime.timeline.duration();
  return {
    runtime,
    root,
    playedDuration: Number.isFinite(played) ? played : 0,
    authoredDuration,
    nullRegistrations,
    seek: (time) => runtime.seek(time),
    async exportFrame(scale) {
      const frame = await renderCompositionFrame(runtime, scale);
      const canvas = document.createElement("canvas");
      canvas.width = frame.width;
      canvas.height = frame.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("2D canvas capture is unavailable.");
      context.drawImage(frame, 0, 0);
      return canvas;
    },
    async exportVideo(options = {}) {
      const result = await exportVideo(runtime, {
        format: options.format ?? "mp4",
        ...(options.fps ? { fps: options.fps } : {}),
      });
      const bytes = new Uint8Array(await result.blob.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return { base64: btoa(binary), mimeType: result.mimeType };
    },
    destroy() {
      runtime.destroy();
      root.remove();
    },
  };
}

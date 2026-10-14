import { createDynamicComposition } from "../composition/dynamic-compiler";
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
  /** Length of the timeline that actually plays. */
  playedDuration: number;
  /** Ids passed to `register` with no element. */
  nullRegistrations: string[];
  seek(time: number): void;
  /** One frame through the export rasterizer, on the export's black backing. */
  exportFrame(scale: number): Promise<HTMLCanvasElement>;
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
  const build = composition.build.bind(composition);
  composition.build = (context) =>
    build({
      ...context,
      register: (id: string, element: HTMLElement | null) => {
        if (!element) nullRegistrations.push(id);
        return context.register(id, element as HTMLElement);
      },
    });
  const root = document.createElement("div");
  root.style.cssText = `position:absolute;left:0;top:0;width:${composition.width}px;height:${composition.height}px;overflow:hidden`;
  document.body.append(root);
  let runtime: CompositionRuntime;
  try {
    runtime = new CompositionRuntime(composition, root);
  } catch (error) {
    root.remove();
    throw error;
  }
  const played = runtime.timeline.duration();
  return {
    runtime,
    root,
    playedDuration: Number.isFinite(played) ? played : 0,
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
    destroy() {
      runtime.destroy();
      root.remove();
    },
  };
}

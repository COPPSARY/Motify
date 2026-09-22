import { createDynamicComposition } from "../composition/dynamic-compiler";
import { renderCompositionFrame } from "../composition/exporter";
import { CompositionRuntime } from "../composition/runtime";
import type { SceneDefinition } from "../composition/types";
import {
  evidenceMoments,
  type FilmObservation,
  type FrameEvidence,
} from "../ai/frame-evidence";
import { describeRenderedFrames } from "../ai/validate-generation";

/**
 * Looking at a candidate film so the repair pass does not have to guess.
 *
 * Mounting it yields two things. The measurements say where every object
 * actually landed and travel as prompt text; the frames say what it looks
 * like and travel as images. A repair carries both, on every transport.
 *
 * The rasterizer is the exporter's own: the frames the model is shown are made
 * the same way as the frames the user downloads, down to the black backing an
 * `alpha: false` canvas gives transparency, so a fault it sees here is a fault
 * that is really in the video.
 */

/**
 * Long edge of an attached frame.
 *
 * Small enough that four of them are a modest addition to a request that
 * already carries the whole composition, large enough that type is legible and
 * an object crossing the frame edge is unmistakable.
 */
const EVIDENCE_WIDTH = 512;

/** Enough fidelity to read a layout; not enough to matter to the payload. */
const EVIDENCE_QUALITY = 0.72;

const EVIDENCE_MIME = "image/jpeg";

function evidenceCanvas(frame: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  // Matches exportVideo: what is transparent in the composition is black in
  // the film, so it is black in the frame the model is asked to judge.
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("2D canvas capture is unavailable.");
  context.drawImage(frame, 0, 0);
  return canvas;
}

/**
 * Mounts a candidate and reports what it shows.
 *
 * Mounted offscreen exactly as the validator mounts a candidate, and torn down
 * in a finally: this runs on a film that has already failed its checks, and
 * leaving a runtime alive would leave its GSAP context ticking behind the
 * editor's own.
 *
 * A frame that cannot be rendered is skipped rather than thrown. Evidence is an
 * improvement to a repair prompt, never a precondition for one.
 */
export async function observeCandidateFilm(options: {
  /** Composition markup with assets already hydrated, as the editor mounts it. */
  renderedHtml: string;
  timelineJs: string;
  title?: string;
  duration: number;
  scenes?: readonly SceneDefinition[];
  complaints: readonly string[];
}): Promise<FilmObservation> {
  const composition = createDynamicComposition(
    options.renderedHtml,
    options.timelineJs,
    {
      title: options.title,
      duration: options.duration,
      ...(options.scenes?.length ? { scenes: options.scenes } : {}),
    },
  );
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;left:-100000px;top:-100000px;width:1920px;height:1080px";
  document.body.append(root);
  let runtime: CompositionRuntime | null = null;
  const frames: FrameEvidence[] = [];
  try {
    runtime = new CompositionRuntime(composition, root);
    // The mounted timeline is the authority on how long the film runs. A
    // candidate that declares 12s and animates 18 is extended to fit rather
    // than truncated, and the frames should cover the film that actually
    // plays. This only ever widens the window: the runtime pads a timeline
    // shorter than the declared duration out to fill it.
    const played = runtime.timeline.duration();
    const duration =
      Number.isFinite(played) && played > 0 ? played : options.duration;
    const moments = evidenceMoments(
      options.complaints,
      options.scenes ?? [],
      duration,
    );
    const account = describeRenderedFrames(runtime, root, moments);
    const scale = EVIDENCE_WIDTH / composition.width;
    for (const time of moments) {
      runtime.seek(time);
      try {
        const rendered = await renderCompositionFrame(runtime, scale);
        const dataUrl = evidenceCanvas(rendered).toDataURL(
          EVIDENCE_MIME,
          EVIDENCE_QUALITY,
        );
        const dataBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        if (dataBase64) {
          frames.push({ time, mimeType: EVIDENCE_MIME, dataBase64 });
        }
      } catch {
        // One unrenderable moment does not cost the others.
      }
    }
    return { account, frames };
  } finally {
    runtime?.destroy();
    root.remove();
  }
}

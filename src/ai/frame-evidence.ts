/**
 * Frames of the film the model just wrote, handed back to it.
 *
 * Every other signal in the repair loop is a sentence about the film. The
 * checks in `validate-generation` measure real mounted geometry, which is the
 * strongest read this pipeline has, but what reaches the model is prose: "lets
 * settled type run 340px outside the frame around 2.40s". That names the fault
 * without showing it, so the model repairs a description rather than a picture,
 * and a fault the checks do not have a sentence for — a subject drifting off
 * the edge, a stack that reads as mush, a beat that is simply ugly — has no way
 * to reach it at all.
 *
 * The rasterizer the exporter already uses can turn any seeked moment into a
 * real image, and both providers already carry images. So a repair pass ships
 * the frames the complaints are about: the words say a check failed, the
 * pictures say what the viewer would actually see.
 *
 * This module owns which moments are worth a frame and how they are described.
 * Mounting and rasterizing belong to the editor, which is where a DOM lives.
 */

/** One rendered moment of the candidate film. */
export interface FrameEvidence {
  /** Where in the film the frame was taken, in seconds. */
  time: number;
  mimeType: string;
  dataBase64: string;
}

/**
 * How many frames a repair pass carries.
 *
 * Each one costs tokens and latency on a request that is already large, and
 * the complaints worth showing cluster: four covers the blocking issues of
 * nearly every failing candidate, and a fifth mostly re-photographs a beat that
 * is already on screen.
 */
export const MAX_EVIDENCE_FRAMES = 4;

/**
 * A time named by a complaint.
 *
 * Only moments the reader is being pointed at: "around 2.40s", "at 6.1s",
 * "from 3.2s". Deliberately not every number followed by an "s" — a complaint
 * also carries lengths ("runs 12.0s", "for 3.0s") and the film's own duration
 * ("the 20.00s composition"), and a frame taken at the film's total length is a
 * picture of the end credits rather than of the fault.
 */
const NAMED_MOMENT = /\b(?:around|at|from)\s+(\d+(?:\.\d+)?)\s*s\b/gi;

/** Two frames closer together than this are the same picture twice. */
const DISTINCT_SECONDS = 0.2;

function isFresh(moment: number, chosen: readonly number[]): boolean {
  return chosen.every(
    (existing) => Math.abs(existing - moment) >= DISTINCT_SECONDS,
  );
}

/** The moments a set of complaints points at, in the order they are raised. */
export function momentsFromComplaints(
  complaints: readonly string[],
  duration: number,
): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const chosen: number[] = [];
  for (const complaint of complaints) {
    for (const match of complaint.matchAll(NAMED_MOMENT)) {
      const parsed = Number(match[1]);
      if (!Number.isFinite(parsed)) continue;
      // A complaint about the very end still has to land inside the film.
      const moment = Math.max(0, Math.min(parsed, duration - 1 / 30));
      if (isFresh(moment, chosen)) chosen.push(moment);
    }
  }
  return chosen;
}

/**
 * Which moments of a failing candidate to photograph.
 *
 * Complaint moments first and in complaint order, because the loop sorts
 * blocking failures to the front and the budget should be spent on the frames
 * that are actually being argued about. Whatever budget is left goes to the
 * middle of beats not already covered, so the model still sees the film it
 * wrote rather than only its worst instants — a repair that fixes the named
 * fault and breaks the beat next to it is the failure mode this guards.
 */
export function evidenceMoments(
  complaints: readonly string[],
  scenes: readonly { start: number; duration: number }[],
  duration: number,
  budget: number = MAX_EVIDENCE_FRAMES,
): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || budget <= 0) return [];
  const limit = Math.max(0, duration - 1 / 30);
  const chosen = momentsFromComplaints(complaints, duration).slice(0, budget);

  const topUps = scenes.length
    ? scenes.map((scene) => scene.start + scene.duration * 0.5)
    : Array.from(
        { length: budget },
        (_unused, index) => (limit * (index + 0.5)) / budget,
      );
  for (const candidate of topUps) {
    if (chosen.length >= budget) break;
    if (!Number.isFinite(candidate)) continue;
    const moment = Math.max(0, Math.min(candidate, limit));
    if (isFresh(moment, chosen)) chosen.push(moment);
  }

  // Ascending, so the attachments read as a filmstrip rather than as the
  // arbitrary order the complaints happened to be raised in.
  return chosen.sort((first, second) => first - second);
}

/**
 * What mounting the candidate showed: the measurements, and the pictures.
 *
 * The account is always present, because every transport can carry text. The
 * frames are present only where the transport can carry images, which today
 * means a local generation: a cloud film is built inside the backend, and the
 * only channel this editor has into that request is the message itself.
 */
export interface FilmObservation {
  /** One measured line per moment, in time order. */
  account: readonly string[];
  /** The same moments rendered, or none. */
  frames: readonly FrameEvidence[];
}

export const NO_OBSERVATION: FilmObservation = { account: [], frames: [] };

/**
 * How what the film showed is put to the model.
 *
 * The frames arrive after the user's own images, which the message has already
 * described, so this says plainly where they start and that they are evidence
 * rather than material: a model that treats a frame of its own film as a
 * supplied asset embeds a screenshot of the film inside the film.
 */
export function describeFilmObservation(observation: FilmObservation): string {
  const { account, frames } = observation;
  if (account.length === 0 && frames.length === 0) return "";
  const measured = account.length
    ? [
        "",
        "Mounted and seeked, this is what the composition you just returned puts on screen. Sizes and positions are shares of the canvas.",
        ...account.map((line) => `- ${line}`),
        "",
      ].join("\n")
    : "";
  const attached = frames.length
    ? [
        "",
        `The last ${frames.length} image${frames.length === 1 ? "" : "s"} attached to this message ${
          frames.length === 1 ? "is that moment" : "are those moments"
        } rendered: ${frames.map((frame) => `${frame.time.toFixed(2)}s`).join(", ")}. Look at ${
          frames.length === 1 ? "it" : "them"
        } before you rewrite anything. They are evidence, not material: never embed them, reference them, or treat them as supplied assets.`,
        "",
      ].join("\n")
    : "";
  return [
    "",
    "",
    "WHAT YOUR FILM ACTUALLY SHOWS",
    `${measured}${attached}`,
    "Fix what the listed failures name AND what this shows - an object pushed off the edge, a stack that reads as mush, a beat with nothing to look at - and leave the rest of the film alone.",
  ].join("\n");
}

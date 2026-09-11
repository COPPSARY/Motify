import type { SceneDefinition } from "../composition/types";

/**
 * A seam is the boundary between two beats, authored as an object in its own
 * right.
 *
 * Scenes were the only unit the model authored: disjoint `{start, duration}`
 * tiles, with the handoff between them existing solely as a prose sentence in
 * `direction[].transition`. A transition therefore had nowhere to live. It had
 * no duration to spend, so two beats tiled edge to edge and the handoff was
 * given zero seconds; it had no carrier field, so "the object that crosses the
 * boundary" was never bound to a real element; and every check on it counted
 * `morph(` occurrences in the source, which a model satisfies by calling the
 * helper on something nobody sees.
 *
 * A seam gives the handoff a start, a length, a named carrier, and the two
 * beats it joins — so the boundary can be planned, budgeted, checked against
 * the markup, and watched at render time.
 */
export type SeamMechanism = "morph" | "match-cut" | "particle-reassemble";

export interface SeamDirection {
  /** Scene id the carrier leaves. */
  from: string;
  /** Scene id the carrier arrives in. */
  to: string;
  /** Playback second the handoff begins. */
  at: number;
  /** Seconds the handoff itself occupies. Zero is a hard cut. */
  duration: number;
  /** `data-edit` id of the single element that crosses this boundary. */
  carrier: string;
  mechanism: SeamMechanism;
  /** What the carrier is entering the seam and what it becomes leaving it. */
  becomes: string;
}

/**
 * A handoff shorter than this is a cut wearing a helper call's name; longer
 * than this and the film is watching a transition instead of a story.
 */
export const SEAM_MIN_SECONDS = 0.35;
export const SEAM_MAX_SECONDS = 1.8;

/** One frame at 30fps: the tolerance the rest of the AI path already uses. */
const FRAME = 1 / 30;

const MECHANISMS: readonly SeamMechanism[] = [
  "morph",
  "match-cut",
  "particle-reassemble",
];

function isMechanism(value: unknown): value is SeamMechanism {
  return MECHANISMS.includes(value as SeamMechanism);
}

/**
 * The seams a generation actually declared, with malformed entries dropped.
 *
 * A half-written seam is worse than none: it would be reported as a boundary
 * failure the model cannot act on, and it would send the render check hunting
 * for a carrier at `NaN` seconds.
 */
export function seamsFromResult(
  raw: readonly unknown[] | undefined,
): readonly SeamDirection[] {
  if (!Array.isArray(raw)) return [];
  const seams: SeamDirection[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const seam = entry as Partial<SeamDirection>;
    const at = Number(seam.at);
    const duration = Number(seam.duration);
    if (!Number.isFinite(at) || at < 0) continue;
    if (!Number.isFinite(duration) || duration <= 0) continue;
    if (typeof seam.carrier !== "string" || !seam.carrier.trim()) continue;
    if (!isMechanism(seam.mechanism)) continue;
    seams.push({
      from: String(seam.from ?? "").trim(),
      to: String(seam.to ?? "").trim(),
      at,
      duration,
      carrier: seam.carrier.trim(),
      mechanism: seam.mechanism,
      becomes: String(seam.becomes ?? "").trim(),
    });
  }
  return seams.sort((first, second) => first.at - second.at);
}

export interface SeamPlanInput {
  readonly seams: readonly SeamDirection[];
  readonly scenes: readonly SceneDefinition[];
  readonly html: string;
  readonly timelineJs: string;
  readonly duration: number;
}

export interface SeamPlanReport {
  /** Every finding, blocking and advisory, in report order. */
  readonly issues: readonly string[];
  /** Findings that make the declared transition fictional rather than weak. */
  readonly blocking: readonly string[];
  readonly strengths: readonly string[];
  /**
   * Whether the seam checks ran. When false the caller keeps its older
   * boundary heuristics, which are weaker but cover output that predates the
   * seam contract.
   */
  readonly planned: boolean;
}

/** `data-edit` ids present in the markup, without needing a DOM. */
function declaredEditIds(html: string): Set<string> {
  return new Set(
    Array.from(html.matchAll(/data-edit=["']([^"']+)["']/g))
      .map((match) => (match[1] ?? "").trim())
      .filter(Boolean),
  );
}

function label(seam: SeamDirection): string {
  const boundary = seam.from && seam.to ? `${seam.from} to ${seam.to} ` : "";
  return `${boundary}at ${seam.at.toFixed(1)}s`;
}

/**
 * What the plan says about its own boundaries, checked against the markup, the
 * timeline source, and the beat intervals.
 *
 * None of this proves the handoff renders — only seeking the composition does
 * that, and `validate-generation` handles it. What this catches is the plan
 * that could not possibly render: a carrier no element declares, a carrier the
 * timeline never addresses, a handoff with no time to happen in, and beats that
 * tile edge to edge so the outgoing side is gone before the carrier moves.
 */
export function analyzeSeamPlan(input: SeamPlanInput): SeamPlanReport {
  const issues: string[] = [];
  const blocking: string[] = [];
  const strengths: string[] = [];
  const fail = (message: string): void => {
    issues.push(message);
    blocking.push(message);
  };
  const warn = (message: string): void => {
    issues.push(message);
  };

  const boundaries = Math.max(0, input.scenes.length - 1);
  if (boundaries === 0) {
    return { issues, blocking, strengths, planned: false };
  }
  if (input.seams.length === 0) {
    warn(
      `the film cuts ${boundaries} time${
        boundaries === 1 ? "" : "s"
      } but declares no seams; give every boundary a seam naming its carrier, its mechanism, and how long the handoff runs`,
    );
    return { issues, blocking, strengths, planned: false };
  }
  if (input.seams.length < boundaries) {
    warn(
      `seam coverage is incomplete: ${input.seams.length} of ${boundaries} scene boundaries have an authored seam, and the rest are hard cuts`,
    );
  }

  const editIds = declaredEditIds(input.html);
  const sceneById = new Map(input.scenes.map((scene) => [scene.id, scene]));
  let sound = 0;

  for (const seam of input.seams) {
    let intact = true;
    if (!editIds.has(seam.carrier)) {
      fail(
        `seam ${label(seam)} names carrier "${seam.carrier}", which no element declares; bind the handoff to a real data-edit id`,
      );
      intact = false;
    } else if (!input.timelineJs.includes(seam.carrier)) {
      // Advisory, not blocking: a composition may legally reach its carrier
      // through a class or a variable rather than by id, and only seeking the
      // rendered film can settle whether the thing actually moves. What this
      // catches is the carrier named in the plan and forgotten in the code.
      warn(
        `seam ${label(seam)} declares carrier "${seam.carrier}" but timeline.js never names it; address the carrier by its data-edit id so the handoff is traceable to the element it moves`,
      );
      intact = false;
    }
    if (seam.duration < SEAM_MIN_SECONDS) {
      warn(
        `seam ${label(seam)} is budgeted ${seam.duration.toFixed(
          2,
        )}s; a handoff needs ${SEAM_MIN_SECONDS}-${SEAM_MAX_SECONDS}s to read as continuity rather than as a cut`,
      );
      intact = false;
    } else if (seam.duration > SEAM_MAX_SECONDS) {
      warn(
        `seam ${label(seam)} runs ${seam.duration.toFixed(
          2,
        )}s; past ${SEAM_MAX_SECONDS}s the film is watching the transition instead of the story`,
      );
      intact = false;
    }
    if (seam.at + seam.duration > input.duration + FRAME) {
      warn(
        `seam ${label(seam)} finishes past the end of the ${input.duration.toFixed(1)}s film`,
      );
      intact = false;
    }

    const outgoing = sceneById.get(seam.from);
    const incoming = sceneById.get(seam.to);
    if (seam.from && !outgoing) {
      warn(
        `seam ${label(seam)} leaves scene "${seam.from}", which is not in the scene list`,
      );
      intact = false;
    }
    if (seam.to && !incoming) {
      warn(
        `seam ${label(seam)} arrives in scene "${seam.to}", which is not in the scene list`,
      );
      intact = false;
    }
    /**
     * A seam has to straddle the cut it covers.
     *
     * Beats tile — beat A's interval ends exactly where beat B's begins — so a
     * handoff scheduled beside that instant rather than across it has no frames
     * in which both sides exist, and the film swaps however the helper was
     * called. The seam is the one thing here that owns time on both sides of
     * the boundary, and it is what the render check and the stale-layer grace
     * are both measured against.
     */
    const cut = outgoing
      ? outgoing.start + outgoing.duration
      : (incoming?.start ?? null);
    if (cut !== null) {
      const opens = seam.at;
      const closes = seam.at + seam.duration;
      if (closes <= cut + FRAME || opens >= cut - FRAME) {
        warn(
          `seam ${label(seam)} does not straddle the cut at ${cut.toFixed(
            1,
          )}s between "${seam.from}" and "${seam.to}"; start the handoff before the cut and finish it after, so both beats are on screen while the carrier crosses`,
        );
        intact = false;
      }
    }
    if (incoming && outgoing) {
      const gap = incoming.start - (outgoing.start + outgoing.duration);
      if (Math.abs(gap) > seam.duration + FRAME) {
        warn(
          `beat "${seam.from}" ends at ${(
            outgoing.start + outgoing.duration
          ).toFixed(1)}s but "${seam.to}" starts at ${incoming.start.toFixed(
            1,
          )}s; beats either abut or overlap by no more than their seam, never leave a gap`,
        );
        intact = false;
      }
    }
    if (intact) sound += 1;
  }

  if (sound === input.seams.length && input.seams.length >= boundaries) {
    // Deliberately a claim about the plan. Nothing here mounts the film or
    // reads the timeline's moves, and a plan that declares a morph at every
    // boundary while the timeline switches scene layers on and off used to
    // collect this as though the transition itself were sound. Whether the
    // declared mechanism is executed is checked in analyzeMotionQuality.
    strengths.push(
      "the seam plan budgets every scene boundary against a real carrier",
    );
  }
  const carriers = new Set(input.seams.map((seam) => seam.carrier));
  /**
   * Beats handing themselves off are expected to name a different carrier at
   * every boundary — each seam's carrier is its own outgoing beat. Asking those
   * films to "carry one object across several boundaries" is what produced a
   * single invented shape dragged over every cut, landing on top of the words.
   */
  const beatHandoffs = input.seams.every((seam) => seam.carrier === seam.from);
  if (
    !beatHandoffs &&
    input.seams.length >= 3 &&
    carriers.size === input.seams.length
  ) {
    warn(
      "every seam uses a different carrier, so no material persists through the film; carry one object across several boundaries before handing off to the next",
    );
  }
  return { issues, blocking, strengths, planned: true };
}

import {
  describeFilmObservation,
  NO_OBSERVATION,
  type FilmObservation,
} from "./frame-evidence";
import type {
  GeneratedComposition,
  MotionQualityReport,
} from "./generation-guidance";

/**
 * Concrete corrections keyed by the leading words of the issue that triggers
 * them. A repair pass that is handed the whole style guide rewrites everything
 * and usually regresses; a repair pass handed the two lines that name its own
 * mistake fixes them and leaves the rest of the film alone.
 */
const ISSUE_REMEDIES: ReadonlyArray<readonly [string, string]> = [
  [
    "the ad uses repeated headline and subtitle layouts",
    "Replace the repeated heading/subtitle/panel layout with distinct shots: one centered full-size sentence, then a large object or active detail, then an inspectable transformed result. Merge supporting copy into the main thought or remove it. Enlarge the proof so it reads without a tiny caption. Re-stage these scenes and their camera framing; do not preserve the rejected layout. Prefer a bright ground unless the user or supplied brand evidence requires dark.",
  ],
  [
    "the ad repeats application chrome",
    "Re-stage the repeated application beats as a SaaS ad: a centered editorial statement, large product material in motion, an observable transformation, and the finished result. Keep at most a focused UI proof shot where it helps. Remove repeated navigation and replace the pill ending with the brand on open ground. Preserve the subject and supplied assets; the listed scene layouts may change.",
  ],
  [
    "the timeline goes",
    "Fill the empty stretch with that beat's own continuing action — typing, streaming, counting, drawing, scanning, the camera still travelling toward its target — or shorten the beat so the next one starts. Do not pad it with idle drift or breathing.",
  ],
  [
    "timeline.js does not parse",
    "Return the complete timeline as valid JavaScript. Close every brace, bracket, string, and template literal, and do not stop mid-statement.",
  ],
  [
    "timeline.js must export",
    "Define `export function buildTimeline(context) { const { root, timeline } = context; ... }` as the single entry point.",
  ],
  [
    "nothing moves",
    "Give every reveal and exit a transform: x/y/scale/rotation. Opacity alone is not animation.",
  ],
  [
    "motion is mostly opacity fades",
    "Replace fades with transforms; reserve opacity for cleaning up a face after a handoff has already moved it.",
  ],
  [
    "independent CSS animation",
    "Delete every @keyframes rule and `animation:` declaration and move that motion onto the GSAP timeline so seeking stays deterministic.",
  ],
  [
    "infinite ambient looping",
    "Remove `repeat: -1`; author the background progression as finite tweens on the master timeline.",
  ],
  [
    "callback-driven layer cleanup",
    "Remove `onComplete` handlers that write element.style; schedule `timeline.set(el, { display, autoAlpha }, time)` instead so reverse seeking is correct.",
  ],
  [
    "the edit deletes layers the user edited by hand",
    "Those elements carry the user's own edits. Return the composition with every one of them still present, changing only what the request asked for.",
  ],
  [
    "the edit re-cuts",
    "Carry the previous composition's `data-edit` elements forward instead of authoring new ones, so the edit lands on the film already on screen.",
  ],
  [
    "supplied media is missing",
    "Render every supplied asset token as a real `src` or `url()` on a visible element.",
  ],
  [
    "the Claude foundation's branding",
    "Strip every Claude/Anthropic name, palette, and chrome; rebuild the surface from the product the user actually asked for.",
  ],
  [
    "composition has no persistent transition carrier",
    "Mark the actual continuity owners with `data-transition-carrier`; preserve visible source-to-destination geometry at each boundary.",
  ],
  [
    "fewer than two real Motionly presets",
    "Call at least two Motionly helpers directly, e.g. `textReveal(timeline, headline, { at: 0.2 })` and `morph(timeline, carrier, { width: 900, borderRadius: 28 }, { at: 2.4 })`.",
  ],
  [
    "multi-scene output has no morph",
    "Join scene boundaries with `morph(...)`, `matchCut(timeline, outgoing, incoming, ...)`, or a particle reassembly instead of a cross-fade.",
  ],
  [
    "scenes are joined by opacity toggles",
    "Replace each boundary cross-fade with `morph(...)` or `matchCut(...)` on the carrier.",
  ],
  [
    "too few executable physical carrier handoffs",
    "Add a `morph(...)` or `matchCut(...)` call at every scene boundary, not just the first.",
  ],
  [
    "reveal eases opacity linearly",
    "Replace constant-rate fades with interface easing: power2.out or power3.out for arrivals, back.out(1.3-1.5) for tactile landings, power2.inOut for lateral travel. Every reveal also carries a transform, so the element lands on the page rather than developing on it.",
  ],
  [
    "reveals ease opacity linearly",
    "Replace constant-rate fades with interface easing: power2.out or power3.out for arrivals, back.out(1.3-1.5) for tactile landings, power2.inOut for lateral travel. Every reveal also carries a transform, so the element lands on the page rather than developing on it.",
  ],
  [
    "several beats end by fading a whole group",
    "Remove the cross-dissolve. Send the outgoing group off along one motivated vector — up and out, or past the camera — in reverse hierarchy, and bring the incoming material in spatially: cards slide up from below, lists expand outward from their anchor, panels grow from the edge that owns them.",
  ],
  [
    "the timeline animates the ground to white",
    "Leave the ground alone. The background is constant for the entire film; it never brightens to white, never goes transparent, and never becomes an empty screen between beats.",
  ],
  [
    "material is blurred and never brought back",
    "Resolve every blur to blur(0px). Rigid text and interface lines stay perfectly sharp while they move; the only blur allowed is a macro-settle focus pull that lands sharp before the movement stops.",
  ],
  [
    "shows an empty plate",
    "That element is a painted rectangle with nothing inside it. Remove its own background, border, radius and shadow so the faces it holds paint themselves and an empty carrier is invisible. If the plate genuinely is the subject, overlap the outgoing face's exit with the incoming face's entrance so content is on screen in every frame it is lit, and fade the plate out with the last face that leaves it.",
  ],
  [
    "the film cuts",
    "Author a `seams` entry for every boundary: the two beats it joins, the second it starts, how long the handoff runs, the `data-edit` id of the object that crosses it, and what that object becomes. Then build that handoff in timeline.js at exactly that time.",
  ],
  [
    "seam coverage is incomplete",
    "Give every remaining boundary its own seam entry and its own handoff in timeline.js. A boundary with no seam is a hard cut.",
  ],
  [
    "seam ",
    "Bind each seam to an element that actually exists and actually moves: the `carrier` must be a real `data-edit` id, timeline.js must tween that element across the seam's own seconds, and the handoff needs 0.35-1.8s of its own. Do not rename the carrier to something you never animate.",
  ],
  [
    'beat "',
    "Overlap the beats across their seam instead of tiling them edge to edge. The outgoing beat must stay on screen until its seam finishes and the incoming beat must exist before the seam starts, so both sides are present while the carrier crosses. Extend the beat's `duration` (and the next beat's `start`) rather than shortening the handoff.",
  ],
  [
    "every seam uses a different carrier",
    "Carry one object through several boundaries — the sentence becomes the glyph becomes the button becomes the product — instead of introducing a fresh carrier at every cut.",
  ],
  [
    "the camera never travels",
    "Give the space beats — a corridor of material, a wide world, a detail worth inspecting — one motivated move each. Leave the statement beats still; the type is already moving on those.",
  ],
  [
    "the camera moves",
    "Cut the camera back to the beats that need it. Hold it still on every statement beat and let the type carry the motion there. Pick one dominant direction for the film — inward, or consistently left — and make each remaining move advance it, instead of alternating push with pull to manufacture contrast.",
  ],
  [
    "multi-scene product film has no expansive",
    "Use a `data-camera-world` with enough authored space for the planned travel; correct framing rather than padding an empty world.",
  ],
  [
    "timeline is under-choreographed",
    "Complete the beat's action, settle, readable hold, and physical departure; shorten unearned empty time.",
  ],
  [
    "editorial text is not choreographed",
    "Animate headlines word-by-word with `textReveal(...)`, `wordSlideRotate(...)`, or an explicit `stagger`.",
  ],
  [
    "the layout arrives as one simultaneous",
    "Stagger the regions into distinct timeline positions in reading order instead of fading many elements in at once.",
  ],
  [
    "the product surface never deconstructs",
    "Clear outgoing internals along motivated vectors in reverse hierarchy while the carrier keeps moving.",
  ],
  [
    "no real product interaction",
    "Film one concrete interaction — a typed input, a press, a drag, or a toggle — and show the result it causes.",
  ],
  [
    "generic placeholder",
    "Replace placeholder strings with the real product's own copy, labels, and numbers.",
  ],
  [
    "data-edit ids are positional",
    "Rename positional ids (el-1, item-2) to role names such as headline, product-shell, cta.",
  ],
  [
    "too few stable data-edit ids",
    "Give every meaningful element a descriptive `data-edit` id so it stays editable.",
  ],
];

function remediesFor(issues: readonly string[]): string[] {
  const remedies: string[] = [];
  for (const issue of issues) {
    const match = ISSUE_REMEDIES.find(([prefix]) => issue.startsWith(prefix));
    if (match && !remedies.includes(match[1])) remedies.push(match[1]);
  }
  return remedies;
}

/**
 * The failures a repair pass is asked to fix.
 *
 * Blocking failures first, then the strongest advisory notes. Anything past
 * the first handful is noise the model trades against the failures that
 * actually matter.
 *
 * Exported because the frames attached to a repair are chosen from this same
 * list: the pictures and the sentences have to be about the same complaints,
 * or the model is handed a frame of a beat nobody objected to.
 */
export function targetedIssues(report: MotionQualityReport): string[] {
  return [
    ...report.blockingIssues,
    ...report.issues.filter((issue) => !report.blockingIssues.includes(issue)),
  ].slice(0, 8);
}

export function buildQualityRepairPrompt(
  originalPrompt: string,
  result: GeneratedComposition,
  report: MotionQualityReport,
  observation: FilmObservation = NO_OBSERVATION,
): string {
  const targeted = targetedIssues(report);
  const remedies = remediesFor(targeted);
  const kept = report.strengths.length
    ? `\n\nSOURCE CHECKS ALREADY PASSING — PRESERVE\n${report.strengths
        .slice(0, 6)
        .map((strength) => `- ${strength}`)
        .join("\n")}`
    : "";
  const howToFix = remedies.length
    ? `\n\nHOW TO FIX EACH ONE\n${remedies
        .map((remedy) => `- ${remedy}`)
        .join("\n")}`
    : "";
  return `REPAIR REQUEST\nRepair the Motionly composition you just produced for this request: ${originalPrompt}

Keep the subject, supplied assets, and unrelated work. Preserve palette, copy, scene spine and data-edit ids except where a listed failure requires re-staging them. A repeated-application-chrome failure explicitly requires changing those scene layouts. Do not add an interface to a film whose brief does not require one.

FIX THESE
${targeted.map((issue, index) => `${index + 1}. ${issue}`).join("\n")}${howToFix}${kept}

Return the complete replacement JSON with compositionHtml and timelineJs, not a patch.

Previous reply summary: ${result.reply}${describeFilmObservation(observation)}`;
}

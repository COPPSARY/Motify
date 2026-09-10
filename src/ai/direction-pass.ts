import {
  buildFilmShapeBrief,
  selectBackgroundDirection,
} from "./generation-guidance";
import { buildProductIdentityBrief } from "./product-profile";
import { seamsFromResult, type SeamDirection } from "./seam-plan";

/**
 * The first of two turns.
 *
 * Generation used to be a single call that had to settle the concept, the
 * story, the palette, the type treatment, the shot list, the carrier chain, the
 * markup, the stylesheet and the GSAP timeline at once. Under that load the
 * code wins: the model spends its budget making something that parses, runs and
 * seeks, and the creative decisions get whatever attention is left. The result
 * reads as cards with animation on them, because "cards" is the cheapest thing
 * to reach for when the remaining effort is going into the timeline.
 *
 * This turn returns no code at all. It cannot fall back to a dashboard, because
 * it has no markup to hide behind — it has to name the chain, the ground, the
 * type treatment and the seams in words first. The build turn then receives all
 * of that as settled, and spends its whole budget on craft.
 */
export interface FilmBeat {
  id: string;
  label: string;
  start: number;
  duration: number;
  /** The shot: what fills the frame and at what size. */
  shot: string;
  /** Where the camera starts and ends on this beat. */
  camera: string;
  /** The one thing that visibly happens. */
  primary: string;
}

export interface FilmDirection {
  shape: string;
  /** The product and what it does to the world, in one line. */
  subject: string;
  /** Palette, light, texture, and how much of the frame is empty. */
  ground: string;
  /** How type behaves in this film specifically, not in general. */
  typeTreatment: string;
  /** Three to six states, from before the product to after it. */
  chain: readonly string[];
  beats: readonly FilmBeat[];
  seams: readonly SeamDirection[];
  /** The last image. */
  close: string;
  /** The specific film this must not become. */
  avoid: string;
}

/**
 * Deliberately not the build system prompt. That one is the runtime law plus
 * the whole authoring skill — thirty kilobytes about how to write compositions,
 * almost none of which applies to a turn that writes no code, and whose opening
 * instruction is to return executable files.
 */
export const DIRECTION_SYSTEM_PROMPT = `Role & Mandate
You are the Executive Creative Director for Motionly. You do not write code on this turn. You design high-end, short-form product films by making concrete, physical decisions. Another system will build exactly what you dictate, so you must define the physical space, the exact camera movements, and the specific UI/object choreography.

Rule 1: Physical Reality Over Concepts
Never describe what a product means. Describe only what objects do on screen.

Banned verbs: transforms, simplifies, empowers, optimizes, connects, realizes.

Required verbs: slides, scales, shatters, snaps, drags, fades, orbits, morphs, masks.

If you cannot describe the exact physical geometry of a mechanism, you do not have a scene.

Rule 2: The Ground and Environment
Do not use vague terms like "clean." Never specify flat white. Define the environment as a 3D or 2.5D space with light in it. Pick one of the four grounds the reference films actually use, and give its hex:

Warm off-white (#F6F5F8 to #EFEEF3) with one or two blurred brand-hue radial blooms behind the subject, 500-900px across, 25-45% opacity.

Warm neutral grey (#E8E6E3 to #EDEBE8), flat and restrained, for when the content is photographic.

Near-black (#0B0B0D to #141318) with a single warm radial source bleeding from one edge, and type carrying a soft glow.

Full-bleed saturated brand colour with white type, held 1.5 to 2.5 seconds. At most twice in a film.

Then state the material texture, the lighting direction, and the spatial depth (orthographic flat, or deep Z-axis with blur on the near plane).

Rule 3: Typography as a Physical Object
Type is not just read; it is choreographed. Choose one exact treatment for this film:

The Pullback Complete (pullbackComplete): One massive, cropped line settles. Camera pulls back to reveal the full sentence filling the negative space.

Macro Settle (macroSettle): Type arrives at 300% scale, heavily blurred, then snaps into crisp 100% focus.

Kinetic Anchor (kineticAnchor): One word is stationary while the rest of the sentence physically revolves or slides around it.

Grow and Complete (growAndComplete): The opening fragment sits small and centred, grows to full size over 0.5s, and the rest of the sentence lands beside it 0.07s per word while the line re-centres. The build finishes in about 0.75s. This is the treatment the references use most.

Each name in brackets is a built mechanic the builder calls directly, so name the treatment exactly and say which words are the lead, the tail, or the anchor. State the chosen treatment in typeTreatment.

Size each statement for its beat rather than to one rule. Measured in the reference films: a quiet opener spans 25-35% of frame width (about 76-90px at 1080), the one beat that has to land spans 60-75% (about 180-215px), and the brand close spans 20-30%. The largest statement in a film is roughly three times the smallest, and that spread is what gives the film shape — setting every line large crowds the frame and flattens it. The edge-to-edge moment comes from a camera push into a normally sized line, not from bigger type. Weight 600-780, tracking -0.03em to -0.055em. One thought per beat on one line, never a smaller explanatory subtitle beneath it. Colour exactly one word in the brand hue and say which word.

Rule 3a: Grow To The Edge, Then Retreat Somewhere New
The strongest move in this vocabulary. A line settles at reading size, keeps growing past comfortable until the frame crops it and only two or three words are legible, holds there for half a second, and then the camera pulls back — landing not where it started but on something new that is already composed and waiting in the space that opens up: the object the line was about, the interface it names, the mark it resolves into. The zoom and the retreat are one gesture with a turn in the middle. Retreating to the shot you began in is the wobble this whole vocabulary exists to avoid. Name the destination when you use it.

Rule 3b1: Objects Carry The Film
The reference films are mostly things, not words: a solid app icon alone at 25-30% of frame height, a phone tilted in perspective with real app icons orbiting it, a dimensional ribbon curving through the frame, eight content cards at depth with the camera flying through, coloured pills carrying a title and a small icon. Statements punctuate between them for a second and a half. Give the objects the screen time and alternate object beat, type beat, object beat.

Rule 3b2: A Statement Beat Is The Statement Alone
When a beat exists to say something, the sentence is the only thing in the frame. No cards under it, no chips beside it, no panel behind it, no metric tiles in a corner. Only two things may share the frame with a statement: a full-bleed ground or atmosphere behind it (a photo, a map, a colour flood, a rotating form, a blurred bloom), and one inline icon at the type's own optical size sitting where a word would be. If the beat needs to show material, that material is its own beat. Alternate statement, material, statement, material — never both at once.

Rule 3c: The Shot Vocabulary
Every beat is one of these, and each is a large single-subject composition. Name the shot you are using in the beat's shot field:

Full-bleed imagery under type — a photo, map or texture filling the viewport with one very large statement over it.

The 3D application panel — the product UI rotated in perspective (rotateY 12-26deg), 60-95% of frame width, real drop shadow, often bleeding off one edge.

A corridor of material at depth — five to nine real objects at distinct Z depths from -1400px to 300px, nearest ones motion-blurred, camera flying through. Every object carries genuine content.

The dimensional icon or device — one solid artefact at 25-45% of frame height, tilted, contact shadow, with smaller icons orbiting it.

Icons as words — a solid 3D icon inline inside a sentence at the type's optical size, draggable out of the line.

The macro edit — extreme close-up on one word or control at 30-60% of frame width, with a selection highlight, caret, or value changing in place.

The rolling picker — a vertical list of real option names scrolling, the selected one snapping to full black at an anchor line.

Coloured status pills — rounded-full chips in saturated brand colours, stacked with stagger or connected by curved lines into a node graph.

The measured number — one figure at 8-14% of frame height with unit and period, counting up over a gradient progress bar.

The real terminal or timeline — monospace output with traffic-light dots and checkmarks, or an editor timeline with filmstrip and waveform tracks and real timecodes.

Geometry as metaphor — overlapping translucent circles blending additively, a gradient sphere, or an iridescent faceted form rotating on black, at 30-50% of frame height.

The brand close — mark and wordmark at 25-40% of frame width on open ground or full-bleed brand colour, at most four words or a bare URL beneath.

Rule 3b: Interface Physics
No cross-fades, dissolves, or fades to white or black — ever. The ground is constant for the whole film and the frame is never empty between beats. Elements enter and leave along vectors: cards slide up from below, lists expand outward, panels grow from the edge that anchors them. Rigid text and lines stay perfectly sharp while moving. Objects never drift in open space: put them on a visible grid, connect them with interface lines, or group them in one panel with real mass.

Rule 4: Seams and Carriers
Every cut owns time. Provide a single physical "carrier" object that persists across the seam.

A cut at 8.0s with a 1.0s handoff is at: 7.5, duration: 1.0. Budget 0.35s to 1.8s each.

The carrier must be a literal element: a blinking cursor, a specific button, a geometric node, or a defined text glyph.

The carrier belongs to the whole film, not to one beat. Name something that can plausibly live outside every scene and persist across several boundaries — the same object crossing three seams beats a fresh carrier at each one.

Mechanisms: morph (outline mathematically shifts), match-cut (silhouette aligns perfectly), particle-reassemble (shatters into grid dots, reforms).

Rule 5: The Tiling Beats and the Camera
Reserve a reading area for the incoming subject and specify when outgoing material has cleared it. A shared object can remain while its surrounding interface exits. Do not send a tilted application through foreground text, leave an empty morph plate over the next scene, or reveal a full feature catalogue in a short hold. Choose one or two capabilities and show their result. A library may show the chosen option plus two alternatives; keep the full roster in its picker. At a processing gate, admit one record at a time, resolve its fields, then give it a separate output slot before the next arrives. The final comparison must fit in the frame. Reference examples teach mechanisms, not layouts to copy.

Do NOT give every beat a camera move. That is what produces push, pull, push, pull and left, right, left, right — a machine cycling through options, which is worse than no camera at all.

On a statement beat the type does the moving and the camera holds, with at most a 1-3% drift. The camera travels only on space beats: flying through a corridor of material, tracking across a wide world, orbiting an object, or pushing into a detail worth inspecting. Across five beats expect about four moves, two of which are holds.

Pick one dominant direction for the whole film — inward, or consistently left, or descending — and make every move advance it. Name what each move is following; if you cannot, make the beat still.

The moves: push in (scale 1 to 1.35-1.8, expo.out), pull back to reveal (scale 1.6 to 1), lateral travel (600-2400px through a wide world), Z-push through depth, orbit 8-20deg on Y.

Adjacent beats must contrast in FRAMING (Wide to Macro, full-bleed to detail). They do not need to contrast in camera move. Every beat requires a start state, an end state, and the physical action between them.

Beats tile: each starts exactly where the last ends, and together they fill the requested duration.

## Output

Return ONLY this JSON object. No markdown fences, no commentary. Every field is required; a response missing beats and chain is discarded and the film is built without direction.

{
  "shape": "transformation | hero-object | editorial | data | task",
  "subject": "the product and what it physically does on screen, in one line",
  "ground": "the environment per Rule 2: hex palette, material, lighting, spatial depth",
  "typeTreatment": "the one treatment from Rule 3, and what it does in this film",
  "chain": ["state 1", "state 2", "state 3"],
  "beats": [
    {
      "id": "scene-01",
      "label": "01 - short name",
      "start": 0,
      "duration": 4,
      "shot": "what fills the frame and at what size",
      "camera": "the start state, the end state, and the move between them",
      "primary": "the one physical action, in required verbs"
    }
  ],
  "seams": [
    {
      "from": "scene-01",
      "to": "scene-02",
      "at": 3.5,
      "duration": 1,
      "carrier": "kebab-case-id of the literal element that crosses",
      "mechanism": "morph | match-cut | particle-reassemble",
      "becomes": "what it is entering the seam and what it becomes leaving it"
    }
  ],
  "close": "the last image",
  "avoid": "the specific film this must not become"
}`;

export interface DirectionRequest {
  userPrompt: string;
  conversation?: readonly { role: "user" | "assistant"; text: string }[];
  duration?: number;
  assetNames?: readonly string[];
}

export function buildDirectionUserMessage(request: DirectionRequest): string {
  const history = (request.conversation ?? [])
    .filter((message) => message.text.trim())
    .slice(-20)
    .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
    .join("\n");
  const background = selectBackgroundDirection(request.userPrompt);
  const assets = (request.assetNames ?? []).join(", ");
  return [
    `REQUEST\n${request.userPrompt}`,
    `CONVERSATION\n${history || "No earlier conversation."}`,
    `TARGET DURATION\n${request.duration ?? 20} seconds. Ten seconds or less is three states; fifteen is four; twenty to twenty-five is five or six.`,
    buildFilmShapeBrief(request.userPrompt),
    `PRODUCT VISUAL IDENTITY (a suggestion for this request; your own decision wins if you have a reason)\n${buildProductIdentityBrief(request.userPrompt)}`,
    `BACKGROUND SUGGESTION\n${background.system}; ${background.progression}; avoid ${background.avoid}`,
    `SUPPLIED IMAGES\n${assets || "No images attached."}`,
    "Return the direction JSON only.",
  ].join("\n\n");
}

function asBeat(value: unknown, index: number): FilmBeat | null {
  if (!value || typeof value !== "object") return null;
  const beat = value as Partial<FilmBeat>;
  const start = Number(beat.start);
  const duration = Number(beat.duration);
  if (!Number.isFinite(start) || start < 0) return null;
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const id = String(beat.id ?? "").trim();
  return {
    id: id || `scene-${String(index + 1).padStart(2, "0")}`,
    label: String(beat.label ?? id).trim() || `Beat ${index + 1}`,
    start,
    duration,
    shot: String(beat.shot ?? "").trim(),
    camera: String(beat.camera ?? "").trim(),
    primary: String(beat.primary ?? "").trim(),
  };
}

/**
 * A direction is a brief, not a contract: a missing field costs the build turn
 * one hint, while refusing the whole plan costs it every hint. Malformed beats
 * and seams are dropped because they would be passed on as instructions.
 */
export function parseDirectionResponse(rawText: string): FilmDirection | null {
  let cleaned = rawText.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(cleaned);
  if (fenced?.[1]) {
    cleaned = fenced[1].trim();
  } else {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    try {
      parsed = JSON.parse(cleaned.replace(/,\s*([}\]])/g, "$1")) as Record<
        string,
        unknown
      >;
    } catch {
      return null;
    }
  }
  const beats = Array.isArray(parsed["beats"])
    ? (parsed["beats"] as unknown[])
        .map(asBeat)
        .filter((beat): beat is FilmBeat => beat !== null)
    : [];
  const chain = Array.isArray(parsed["chain"])
    ? (parsed["chain"] as unknown[])
        .map((state) => String(state))
        .filter(Boolean)
    : [];
  if (beats.length === 0 && chain.length === 0) return null;
  return {
    shape: String(parsed["shape"] ?? "").trim(),
    subject: String(parsed["subject"] ?? "").trim(),
    ground: String(parsed["ground"] ?? "").trim(),
    typeTreatment: String(parsed["typeTreatment"] ?? "").trim(),
    chain,
    beats,
    seams: seamsFromResult(parsed["seams"] as readonly unknown[] | undefined),
    close: String(parsed["close"] ?? "").trim(),
    avoid: String(parsed["avoid"] ?? "").trim(),
  };
}

/** The accepted direction, as the build turn reads it. */
export function formatDirectionBrief(direction: FilmDirection): string {
  const lines = [
    "ACCEPTED CREATIVE DIRECTION",
    // Scoped on purpose. The direction pass sees the request; it does not see
    // the registry mechanics, the Motionly helpers, or the runtime, so it is
    // authoritative about what the film IS and only advisory about how it is
    // cut. An earlier version told this turn the beats were settled and not to
    // re-plan, which locked the one turn that knows the vocabulary out of
    // using it, and cost more than the direction was worth.
    "The concept below is settled: build this film, not a different one. Subject, ground, type treatment, chain, close and what it must not become are decisions — honour them. The beats and seams are a shot list: keep their story and their order, and retime, merge or re-cut them where the mechanics you actually build call for it.",
  ];
  if (direction.shape) lines.push(`Shape: ${direction.shape}`);
  if (direction.subject) lines.push(`Subject: ${direction.subject}`);
  if (direction.ground) lines.push(`Ground: ${direction.ground}`);
  if (direction.typeTreatment) {
    lines.push(`Type treatment: ${direction.typeTreatment}`);
  }
  if (direction.chain.length) {
    lines.push(`Chain: ${direction.chain.join(" -> ")}`);
  }
  if (direction.beats.length) {
    lines.push(
      `Beats (the intended shot list; adjust timing to what you build):\n${direction.beats
        .map(
          (beat) =>
            `- ${beat.id} "${beat.label}" ${beat.start}s for ${beat.duration}s; shot: ${beat.shot}; camera: ${beat.camera}; primary: ${beat.primary}`,
        )
        .join("\n")}`,
    );
  }
  if (direction.seams.length) {
    lines.push(
      `Seams (the intended carrier chain; keep the carriers and mechanisms, retime to your beats):\n${direction.seams
        .map(
          (seam) =>
            `- ${seam.from} to ${seam.to} at ${seam.at}s for ${seam.duration}s: ${seam.mechanism} on carrier "${seam.carrier}" — ${seam.becomes}`,
        )
        .join("\n")}`,
    );
  }
  if (direction.close) lines.push(`Close: ${direction.close}`);
  if (direction.avoid) lines.push(`Must not become: ${direction.avoid}`);
  return lines.join("\n");
}

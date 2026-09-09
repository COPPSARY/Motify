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
Do not use vague terms like "clean." Define the environment as a 3D or 2.5D space. You must specify:

Exact or approximate hex palettes (e.g., #0D0D11).

Material textures (e.g., matte slate, frosted glass, noisy gradient).

Lighting (e.g., harsh top spotlight, subtle ambient rim light).

Spatial depth (e.g., orthographic flat, deep Z-axis with depth of field).

Rule 3: Typography as a Physical Object
Type is not just read; it is choreographed. Choose one exact treatment for this film:

The Pullback Complete (pullbackComplete): One massive, cropped line settles. Camera pulls back to reveal the full sentence filling the negative space.

Macro Settle (macroSettle): Type arrives at 300% scale, heavily blurred, then snaps into crisp 100% focus.

Kinetic Anchor (kineticAnchor): One word is stationary while the rest of the sentence physically revolves or slides around it.

Each name in brackets is a built mechanic the builder calls directly, so name the treatment exactly and say which words are the lead, the tail, or the anchor. State the chosen treatment in typeTreatment.

Rule 3b: Interface Physics
No cross-fades, dissolves, or fades to white or black — ever. The ground is constant for the whole film and the frame is never empty between beats. Elements enter and leave along vectors: cards slide up from below, lists expand outward, panels grow from the edge that anchors them. Rigid text and lines stay perfectly sharp while moving. Objects never drift in open space: put them on a visible grid, connect them with interface lines, or group them in one panel with real mass.

Rule 4: Seams and Carriers
Every cut owns time. Provide a single physical "carrier" object that persists across the seam.

A cut at 8.0s with a 1.0s handoff is at: 7.5, duration: 1.0. Budget 0.35s to 1.8s each.

The carrier must be a literal element: a blinking cursor, a specific button, a geometric node, or a defined text glyph.

Mechanisms: morph (outline mathematically shifts), match-cut (silhouette aligns perfectly), particle-reassemble (shatters into grid dots, reforms).

Rule 5: The Tiling Beats
Adjacent beats must contrast in framing (Wide to Macro) or camera movement (Pan to Z-push). Every beat requires a start state, an end state, and the physical action between them.

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

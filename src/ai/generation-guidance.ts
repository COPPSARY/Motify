import type { FrameEvidence } from "./frame-evidence";
import { registryManifest } from "../registry/catalog";
import { getComponentSource } from "../registry/component-source";
import {
  FILM_SHAPES,
  filmShapeDefinition,
  selectFilmShape,
  type FilmShapeDefinition,
  type ReferenceRole,
} from "./film-shape";
import { buildProductIdentityBrief } from "./product-profile";
import { applicationChromeScenes, editorialSubtitleCount } from "./ad-quality";
import {
  analyzeSeamPlan,
  seamsFromResult,
  type SeamDirection,
} from "./seam-plan";
import type { RuntimeEditorState, SceneDefinition } from "../composition/types";
import type { RegistryItemSummary } from "../registry/types";

export interface GenerationFiles {
  /**
   * When present, generation is sent to the backend project rather than a
   * browser-held provider key. The backend persists the authoritative source.
   */
  backendProjectId?: string;
  compositionHtml?: string;
  timelineJs?: string;
  stylesCss?: string;
  indexTs?: string;
  conversation?: readonly { role: "user" | "assistant"; text: string }[];
  assets?: readonly GenerationAsset[];
  /**
   * Music-library tracks to score the film to. Only the backend receives them:
   * it attaches them to the project and briefs the model on their length,
   * tempo, and mood, so a browser-held provider key never sees the audio.
   */
  audioTrackIds?: readonly string[];
  editorState?: Partial<RuntimeEditorState>;
  generationProfile?: "claude-foundation-v1" | "existing";
  /** Directorial plan produced by the previous turn, replayed on follow-ups. */
  previousPlan?: GenerationPlanMemory;
  /**
   * The creative direction settled by the first turn, already formatted. A
   * string rather than the direction object so this module stays free of a
   * dependency on the pass that produces it. Present on a new film; a follow-up
   * carries the accepted film forward through `previousPlan` instead.
   */
  directionBrief?: string;
  /** Original creative brief during repairs; diagnostic wording is not intent. */
  directionPrompt?: string;
  /**
   * Frames rendered from the candidate this repair is fixing, attached to the
   * request after the user's own images. Present only on a repair pass, and
   * only on a transport that can carry them.
   */
  evidenceFrames?: readonly FrameEvidence[];
}

/**
 * The part of a generation the next turn must not forget. Without it, a
 * follow-up such as "make the ending longer" loses the subject, the carrier
 * chain, and the camera intent, and the model restarts from a blank stage.
 */
export interface GenerationPlanMemory {
  title?: string;
  subject?: string;
  duration?: number;
  direction?: readonly SceneDirection[];
  /** The carrier chain. A follow-up that loses this re-cuts every boundary. */
  seams?: readonly SeamDirection[];
  techniques?: readonly GenerationTechnique[];
}

export interface GenerationAsset {
  id: string;
  /** Backend asset ID after a successful authenticated cloud upload. */
  uploadId?: string;
  name: string;
  mimeType: string;
  dataBase64: string;
  token: string;
  /** "reference" is read and matched; "asset" is placed on screen. */
  intent?: "reference" | "asset";
}

export interface GenerationTechnique {
  beat: string;
  registryReference: string;
  motionlyPresets: readonly string[];
  sustainedMotion: string;
  handoff: "morph" | "match-cut" | "particle-reassemble" | "final-hold";
}

export interface SceneDirection {
  scene: string;
  composition: string;
  spatialRegion: string;
  cameraStart: string;
  cameraEnd: string;
  cameraTarget: string;
  primary: string;
  secondary: string;
  hold: string;
  transition: string;
}

export interface GeneratedComposition {
  title?: string;
  duration?: number;
  skills?: readonly string[];
  scenes?: readonly {
    id: string;
    label: string;
    start: number;
    duration: number;
    accent: string;
  }[];
  direction?: readonly SceneDirection[];
  /**
   * The boundaries, authored as objects rather than described in prose. Each
   * one owns the time its handoff occupies, so a transition has somewhere to
   * happen instead of falling into the zero-width gap between two beats.
   */
  seams?: readonly SeamDirection[];
  techniques?: readonly GenerationTechnique[];
  compositionHtml: string;
  timelineJs: string;
  reply: string;
  /** What the quality gate concluded about the pass that actually shipped. */
  quality?: MotionQualityReport;
}

export interface MotionQualityReport {
  score: number;
  requiresRepair: boolean;
  /** Every failure, blocking and advisory, in report order. */
  issues: readonly string[];
  /**
   * Failures that make the output genuinely broken: it cannot run, cannot be
   * seeked or exported deterministically, ignores supplied media, or ships the
   * wrong brand. Everything else is direction we ask the model to improve but
   * never a reason to hand the user nothing.
   */
  blockingIssues: readonly string[];
  strengths: readonly string[];
}

export interface BackgroundDirection {
  system: string;
  progression: string;
  avoid: string;
}

const INTENT_EXPANSIONS: ReadonlyArray<readonly string[]> = [
  ["ai", "assistant", "agent", "chat", "prompt", "streaming", "typing"],
  [
    "app",
    "product",
    "saas",
    "software",
    "dashboard",
    "browser",
    "device",
    "ui",
  ],
  ["data", "chart", "metric", "analytics", "growth", "number", "stat", "proof"],
  ["code", "developer", "terminal", "editor", "diff", "compile", "syntax"],
  ["social", "testimonial", "trust", "review", "rating", "community"],
  ["before", "after", "compare", "comparison", "transformation"],
  ["brand", "logo", "wordmark", "identity", "outro", "cta", "close"],
  ["cursor", "click", "tap", "press", "interaction", "gesture"],
  ["caption", "subtitle", "karaoke", "transcript", "word"],
  [
    "notes",
    "note",
    "notebook",
    "memo",
    "writing",
    "capture",
    "checklist",
    "transcript",
    "voice",
  ],
  ["map", "location", "global", "country", "route", "travel"],
  ["notification", "alert", "message", "inbox", "slack"],
  ["premium", "cinematic", "depth", "camera", "parallax", "focus"],
];

/**
 * Which mechanics a request retrieves now depends on the kind of film it is
 * asking for. The single fixed table that used to live here handed every
 * request a product surface, an interface builder, a UI interaction, and a
 * metric card, which is why every generation came back as a dashboard.
 */
export type { FilmShape, ReferenceRole } from "./film-shape";
export { selectFilmShape } from "./film-shape";

/** The product-demo role set, kept as the name older callers import. */
export const REFERENCE_ROLES: readonly ReferenceRole[] = FILM_SHAPES.task.roles;

function tokens(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 3),
    ),
  );
}

function retrievalText(item: RegistryItemSummary): string {
  return [
    item.name,
    item.title,
    item.description,
    item.family,
    item.profile,
    ...(item.tags ?? []),
    ...(item.jobs ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreItem(
  item: RegistryItemSummary,
  prompt: string,
  queryTokens: readonly string[],
): number {
  const name = item.name.toLowerCase();
  const nameWords = name.split("-").filter(Boolean);
  const title = item.title?.toLowerCase() ?? "";
  const description = item.description?.toLowerCase() ?? "";
  const tags = (item.tags ?? []).join(" ").toLowerCase();
  const family = `${item.family ?? ""} ${item.profile ?? ""}`.toLowerCase();
  let score = prompt.includes(name) ? 80 : 0;

  for (const token of queryTokens) {
    if (name.includes(token)) score += 9;
    // Substring matching only works in one direction, so a prompt saying
    // "overwhelming" scored nothing against a component named
    // "overwhelm-surround". Matching a shared stem in either direction reaches
    // the mechanic the request is actually describing.
    else if (
      nameWords.some(
        (word) =>
          word.length >= 5 &&
          (token.startsWith(word) || word.startsWith(token)),
      )
    )
      score += 7;
    if (title.includes(token)) score += 6;
    if (tags.includes(token)) score += 5;
    if (family.includes(token)) score += 4;
    if (description.includes(token)) score += 2;
  }

  // Prefer focused mechanics over complete examples, whose scene structure
  // tends to pull generated work back toward a slideshow.
  if (item.type === "hyperframes:component") score += 24;
  if (item.type === "hyperframes:block") score += 4;
  if (item.type === "hyperframes:example") score -= 8;
  if (item.description) score += 1;
  return score;
}

function expandedQueryTokens(prompt: string): string[] {
  const base = tokens(prompt);
  const expanded = new Set(base);
  for (const group of INTENT_EXPANSIONS) {
    if (group.some((term) => base.includes(term))) {
      group.forEach((term) => expanded.add(term));
    }
  }
  return Array.from(expanded);
}

export interface RoleAssignedReference {
  role: string;
  job: string;
  item: RegistryItemSummary;
}

function componentByName(name: string): RegistryItemSummary | undefined {
  return registryManifest.items.find(
    (item) => item.name === name && item.type === "hyperframes:component",
  );
}

/**
 * Picks the best prompt-relevant component for every production role so the
 * retrieved set covers typography, surface, construction, interaction, camera,
 * continuity, proof, and close instead of eight variations of one entrance.
 */
export function selectReferenceRoles(
  userPrompt: string,
): readonly RoleAssignedReference[] {
  const normalizedPrompt = userPrompt.toLowerCase();
  const queryTokens = expandedQueryTokens(userPrompt);
  const assigned: RoleAssignedReference[] = [];
  // The role set follows the kind of film asked for, not a fixed product-demo
  // table, so a brand teaser retrieves brand mechanics rather than app chrome.
  for (const role of filmShapeDefinition(userPrompt).roles) {
    let best: { item: RegistryItemSummary; score: number } | null = null;
    for (const [index, name] of role.candidates.entries()) {
      const item = componentByName(name);
      if (!item) continue;
      if (assigned.some((entry) => entry.item.name === item.name)) continue;
      // Later candidates need to actually beat earlier ones; the ordering in
      // each role encodes the default choice for a generic request.
      const score =
        scoreItem(item, normalizedPrompt, queryTokens) - index * 0.5;
      if (!best || score > best.score) best = { item, score };
    }
    if (best)
      assigned.push({ role: role.role, job: role.job, item: best.item });
  }
  return assigned;
}

export function selectRegistryReferences(
  userPrompt: string,
  limit = 9,
): readonly RegistryItemSummary[] {
  const normalizedPrompt = userPrompt.toLowerCase();
  const queryTokens = expandedQueryTokens(userPrompt);
  const selected: RegistryItemSummary[] = selectReferenceRoles(userPrompt)
    .map((entry) => entry.item)
    .slice(0, limit);

  const ranked = registryManifest.items
    .map((item) => ({
      item,
      score: scoreItem(item, normalizedPrompt, queryTokens),
      text: retrievalText(item),
    }))
    .filter((entry) => entry.score > 3)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.text.length - a.text.length ||
        a.item.name.localeCompare(b.item.name),
    );

  for (const entry of ranked) {
    if (selected.length >= limit) break;
    if (selected.some((item) => item.name === entry.item.name)) continue;
    // Supporting retrieval must not undo the chosen shape by adding browser,
    // chat or dashboard examples via broad SaaS/AI keyword expansion.
    const allowed = filmShapeDefinition(userPrompt).roles.some((role) =>
      role.candidates.includes(entry.item.name),
    );
    if (!allowed) continue;
    const family = entry.item.family ?? entry.item.tags?.[0] ?? entry.item.type;
    const repeats = selected.filter(
      (item) => (item.family ?? item.tags?.[0] ?? item.type) === family,
    ).length;
    if (repeats >= 2 && !normalizedPrompt.includes(entry.item.name)) continue;
    selected.push(entry.item);
  }

  return selected.slice(0, limit);
}

function summarizeVariable(item: RegistryItemSummary): string {
  const variables = (item.variables ?? []).slice(0, 6);
  if (variables.length === 0) return "";
  return ` Controls: ${variables
    .map((variable) => {
      const choices = variable.options?.map((option) => option.value).join("|");
      return `${variable.id}${choices ? ` (${choices})` : ""}`;
    })
    .join(", ")}.`;
}

/**
 * Roles whose authored source actually changes what lands on screen. Camera and
 * continuity roles are choreography the system prompt already specifies, so
 * their source buys less than the surface and typography roles do.
 */
/**
 * Roles whose source is spent on the request. Camera and continuity are
 * choreography the system prompt already specifies in detail, so their source
 * buys less per kilobyte than the roles that decide what is actually on screen.
 * Everything else in the chosen shape gets its real source.
 */
const SOURCE_DEFERRED_ROLES: readonly string[] = ["camera", "continuity"];

/**
 * The retrieved components' real source, which is the difference between the
 * model implementing a proven mechanic and inventing one that shares its name.
 */
/**
 * The kind of film this request is asking for, stated plainly so the retrieved
 * mechanics read as a coherent brief rather than a bag of parts.
 */
export function buildFilmShapeBrief(userPrompt: string): string {
  const shape: FilmShapeDefinition = filmShapeDefinition(userPrompt);
  const alternatives = Object.values(FILM_SHAPES)
    .filter((entry) => entry.shape !== shape.shape)
    .map((entry) => entry.shape)
    .join(", ");
  return [
    `FILM SHAPE: ${shape.shape.toUpperCase()}`,
    shape.premise,
    shape.guard,
    `The mechanics retrieved below were chosen for this shape. Build this film, not a ${alternatives} one. If the request genuinely calls for a different shape, build the one it asks for and say so in the reply — but never drift into a product-interface walkthrough out of habit.`,
  ].join("\n");
}

export async function buildComponentSourceBrief(
  userPrompt: string,
): Promise<string> {
  const roles = selectReferenceRoles(userPrompt);
  const wanted = roles
    .filter((entry) => !SOURCE_DEFERRED_ROLES.includes(entry.role))
    .slice(0, 5);
  const sources = await getComponentSource(
    wanted.map((entry) => entry.item.name),
  );
  if (sources.length === 0) {
    return "No component source available for this request; build from the descriptions above and the Motionly presets.";
  }
  const roleFor = new Map(wanted.map((entry) => [entry.item.name, entry]));
  return sources
    .map((entry) => {
      const assigned = roleFor.get(entry.name);
      return `--- ${entry.name} (role: ${assigned?.role ?? "supporting"} — ${
        assigned?.job ?? "supporting mechanic"
      }) ---
${entry.source}`;
    })
    .join("\n\n");
}

export function buildRegistryBrief(userPrompt: string): string {
  const roles = new Map(
    selectReferenceRoles(userPrompt).map((entry) => [entry.item.name, entry]),
  );
  const references = selectRegistryReferences(userPrompt);
  return references
    .map((item, index) => {
      const assigned = roles.get(item.name);
      const roleTag = assigned
        ? ` (role: ${assigned.role} — ${assigned.job})`
        : " (role: supporting)";
      return `${index + 1}. ${item.name} [${item.type.replace(
        "hyperframes:",
        "",
      )}]${roleTag}: ${
        item.description ?? item.title ?? "Reusable HyperFrames reference"
      }${summarizeVariable(item)}`;
    })
    .join("\n");
}

export function selectBackgroundDirection(
  userPrompt: string,
): BackgroundDirection {
  const prompt = userPrompt.toLowerCase();

  if (/note|notebook|memo|writing|journal|transcript/.test(prompt)) {
    return {
      system: "paper structure + one traveling ink/signal path",
      progression:
        "the path begins as editorial emphasis, becomes capture or typing feedback, organizes note evidence, then resolves into the app mark",
      avoid:
        "generic aurora, rainbow mesh, floating blobs, and unrelated orbit decoration",
    };
  }
  if (/audio|voice|podcast|music|record|speech/.test(prompt)) {
    return {
      system: "localized signal field + waveform energy",
      progression:
        "energy originates at the active source, propagates through the waveform, and condenses into the generated result",
      avoid: "full-screen glow with no relationship to the audio event",
    };
  }
  if (/data|metric|analytics|finance|growth|chart/.test(prompt)) {
    return {
      system: "measured grid + one trajectory or threshold line",
      progression:
        "the grid establishes scale, the trajectory responds to each proof beat, and its endpoint becomes the final claim",
      avoid: "decorative particles or gradients that do not encode a value",
    };
  }
  if (/code|developer|terminal|repository|software/.test(prompt)) {
    return {
      system: "depth corridor built from code planes and structural rails",
      progression:
        "the camera follows one rail from problem evidence into the working interface and preserves that vector through the close",
      avoid: "purple neon fog used as a substitute for developer context",
    };
  }

  return {
    system: "geometry derived from the focal carrier",
    progression:
      "a structural echo of the carrier enters with it, reacts to the primary action, and converges into the final silhouette",
    avoid:
      "default mesh gradients, ambient blob loops, and arbitrary particles",
  };
}

/** Request-specific context; permanent creative rules live in the bundled skill. */
export function buildSkillRoutingBrief(userPrompt: string): string {
  const background = selectBackgroundDirection(userPrompt);
  return [
    "Bundled skill: write-motionly (already present in the system prompt).",
    `Suggested background: ${background.system}; ${background.progression}; avoid ${background.avoid}`,
  ].join("\n");
}

export async function buildMotionlyUserMessage(
  userPrompt: string,
  currentFiles: GenerationFiles,
): Promise<string> {
  const directionPrompt =
    currentFiles.directionPrompt ??
    [currentFiles.previousPlan?.subject, userPrompt].filter(Boolean).join("\n");
  // Whole-film examples anchor the model to their UI and story even when
  // labelled "reference only". New films get selected component mechanics;
  // actual follow-ups retain the complete user-authored source.
  const isFoundationStart =
    currentFiles.generationProfile === "claude-foundation-v1";
  const hasExistingCode =
    !isFoundationStart &&
    Boolean(
      currentFiles.compositionHtml && currentFiles.compositionHtml.length > 50,
    );
  const task = hasExistingCode
    ? "EDIT the existing composition"
    : "CREATE a new composition from scratch";
  const source = hasExistingCode
    ? `\n\nCurrent composition.html:\n\`\`\`html\n${currentFiles.compositionHtml ?? ""}\n\`\`\`\n\nCurrent styles.css:\n\`\`\`css\n${currentFiles.stylesCss ?? ""}\n\`\`\`\n\nCurrent timeline.js:\n\`\`\`javascript\n${currentFiles.timelineJs ?? ""}\n\`\`\`\n\nCurrent index.ts metadata adapter:\n\`\`\`typescript\n${currentFiles.indexTs ?? ""}\n\`\`\``
    : "";
  const preservation = hasExistingCode
    ? "Preserve every existing data-edit id, scene boundary, supplied asset reference, and unrelated behavior unless the request explicitly replaces it."
    : "There is nothing to preserve: author this request's own story, layout, scenes and ids. Use the selected component mechanics below, without copying a whole example film.";
  const history = (currentFiles.conversation ?? [])
    .filter((message) => message.text.trim())
    .slice(-40)
    .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
    .join("\n");
  const suppliedAssets = currentFiles.assets ?? [];
  // A reference is read; an asset is placed. Handing the model one
  // undifferentiated list is what makes it paste a UI screenshot into the film
  // as an image, or ignore a logo it was supposed to put on screen.
  const placeableAssets = suppliedAssets
    .filter((asset) => asset.intent !== "reference")
    .map(
      (asset) =>
        `- ${asset.name} (${asset.mimeType}); required HTML source: ${asset.token}`,
    )
    .join("\n");
  const referenceImages = suppliedAssets
    .filter((asset) => asset.intent === "reference")
    .map((asset) => `- ${asset.name} (${asset.mimeType})`)
    .join("\n");
  const plan = currentFiles.previousPlan;
  const planDirection = (plan?.direction ?? [])
    .map(
      (entry) =>
        `- ${entry.scene}: ${entry.composition}; camera ${entry.cameraStart} → ${entry.cameraEnd} on ${entry.cameraTarget}; primary ${entry.primary}; hold ${entry.hold}; handoff ${entry.transition}`,
    )
    .join("\n");
  const planSeams = (plan?.seams ?? [])
    .map(
      (seam) =>
        `- ${seam.from} to ${seam.to} at ${seam.at}s for ${seam.duration}s: ${seam.mechanism} on carrier "${seam.carrier}" (${seam.becomes})`,
    )
    .join("\n");
  const planTechniques = (plan?.techniques ?? [])
    .map(
      (entry) =>
        `- ${entry.beat}: ${entry.registryReference} via ${entry.motionlyPresets.join(", ")} (${entry.handoff})`,
    )
    .join("\n");
  const followUp = plan
    ? `PREVIOUS GENERATION PLAN (this request continues it)\nTitle: ${
        plan.title ?? "untitled"
      }${plan.subject ? `\nSubject: ${plan.subject}` : ""}${
        plan.duration ? `\nDuration: ${plan.duration}s` : ""
      }\n${planDirection || "No recorded scene direction."}\nSeams (the carrier chain):\n${
        planSeams || "No recorded seams."
      }\n${
        planTechniques || "No recorded techniques."
      }\nThis is a follow-up. Keep the established subject, palette, product identity, scene spine, carrier chain, and data-edit ids. Return the seams again, retimed if the beats moved; a boundary whose carrier changes identity between turns re-cuts a transition the user already accepted. Change only what the new request asks for plus what must change for coherence. Never restart from a blank stage and never drop an accepted scene, asset, or interaction.`
    : "PREVIOUS GENERATION PLAN\nNo previous plan. Treat the project conversation above as the accumulated brief and honour every constraint the user already stated.";
  const componentSource = await buildComponentSourceBrief(directionPrompt);
  return [
    `USER REQUEST\n${userPrompt}`,
    `PROJECT CONVERSATION\n${history || "No earlier project conversation."}`,
    followUp,
    `TASK\n${task}. ${preservation}${source}`,
    `PRODUCT VISUAL IDENTITY (request-specific suggestion; supplied product evidence takes precedence)\n${buildProductIdentityBrief(directionPrompt)}`,
    `IMAGES TO PLACE\n${
      placeableAssets ||
      "No images to place. Author every visual as HTML/SVG; never invent an asset URL."
    }${
      placeableAssets
        ? "\nEach one is required unless the user explicitly asks to remove or replace it, and must be referenced by the exact token above."
        : ""
    }`,
    `REFERENCE IMAGES (read these; never put them on screen)\n${
      referenceImages || "No reference images supplied."
    }${
      referenceImages
        ? "\nThe user supplied these as reference or storyboard, not as content. Read the layout, type, spacing, palette and product chrome they show and rebuild that faithfully in authored HTML/SVG. Never embed them and never reference them from the markup: they carry no token, and inventing one is a failed generation."
        : ""
    }`,
    `LOCAL EDITOR OVERRIDES\n${currentFiles.editorState ? JSON.stringify(currentFiles.editorState) : "No local editor overrides."}`,
    `GENERATION CONTEXT\nProfile: ${currentFiles.generationProfile ?? "unspecified"}\n${buildSkillRoutingBrief(directionPrompt)}`,
    // The shape brief stays whether or not a direction pass ran. It carries the
    // guard that keeps a film from drifting into a product walkthrough, and the
    // line that binds the retrieved mechanics below to this shape; a direction
    // brief is additional creative context, never a replacement for either.
    buildFilmShapeBrief(directionPrompt),
    ...(currentFiles.directionBrief ? [currentFiles.directionBrief] : []),
    `RETRIEVED HYPERFRAMES REFERENCES\n${buildRegistryBrief(directionPrompt)}`,
    `AUTHORED SOURCE FOR THE SELECTED COMPONENTS\nReference code only; adapt under the bundled runtime law.\n${componentSource}`,
    "Prefer these existing mechanics where they serve this request. They are reference implementations, not callable Motionly functions. Apply the bundled skill and return its complete JSON artifact.",
  ].join("\n\n");
}

function countMatches(value: string, expression: RegExp): number {
  return Array.from(value.matchAll(expression)).length;
}

function executableTimelineSource(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Whether the timeline would even parse. Truncated or malformed output reaches
 * the runtime as a bare SyntaxError with no useful context; compiling it here
 * turns that into a named failure the repair pass can act on, before the user
 * ever sees a broken film.
 */
function syntaxError(timelineJs: string): string {
  const runnable = timelineJs
    .trim()
    .replace(/^```(?:javascript|js|ts)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/export\s+function\s+/g, "function ")
    .replace(/export\s+(const|let|var)\s+/g, "$1 ");
  try {
    new Function(runnable);
    return "";
  } catch (error: unknown) {
    return error instanceof Error ? error.message : "unparseable timeline";
  }
}

/**
 * Below this score the film is weak enough to be worth another model pass.
 *
 * Raised from 70 once the score stopped being inflated by strengths: a draw
 * carrying seven directorial defects landed on exactly 70 and stopped
 * repairing at the boundary, which is the case a repair pass exists for.
 */
export const QUALITY_REPAIR_THRESHOLD = 80;

export interface MotionQualityContext {
  /** The original request, used to detect foundation branding leaking through. */
  prompt?: string;
  /** Asset tokens that must appear in the composition HTML. */
  requiredAssetTokens?: readonly string[];
  /**
   * Layers the user has personally moved, resized, restyled, or retimed. These
   * carry work only they can reproduce, so losing one is a blocking failure.
   */
  protectedEditIds?: readonly string[];
  /**
   * Every other layer of the previous composition. These were authored by the
   * model itself, so re-cutting them on a follow-up is a directorial choice
   * worth flagging, not a reason to withhold the edit.
   */
  previousEditIds?: readonly string[];
}

/** Every `data-edit` id in a composition, in document order. */
export function editIdsIn(html: string): string[] {
  return Array.from(
    new Set(
      Array.from(html.matchAll(/data-edit=["']([^"']+)["']/g))
        .map((match) => (match[1] ?? "").trim())
        .filter(Boolean),
    ),
  );
}

/**
 * The layers the user has touched by hand. Editor overrides are keyed by
 * `data-edit` id, so their key set is exactly the work a regeneration must not
 * throw away.
 */
export function userEditedIds(
  editorState?: Partial<RuntimeEditorState>,
): string[] {
  if (!editorState) return [];
  const ids = new Set<string>();
  for (const id of Object.keys(editorState.elements ?? {})) ids.add(id);
  for (const id of Object.keys(editorState.animations ?? {})) ids.add(id);
  // Tween override keys are "<edit-id>:tween<n>".
  for (const key of Object.keys(editorState.tweens ?? {})) {
    const id = key.split(":tween")[0];
    if (id) ids.add(id);
  }
  return [...ids];
}

function timelinePositions(source: string): number[] {
  return Array.from(source.matchAll(/,\s*(\d+(?:\.\d+)?)\s*\)/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value <= 600)
    .sort((a, b) => a - b);
}

/** Longest silent gap between authored timeline positions: the readable holds. */
function longestHold(positions: readonly number[]): number {
  let longest = 0;
  for (let index = 1; index < positions.length; index += 1) {
    const previous = positions[index - 1] ?? 0;
    const current = positions[index] ?? 0;
    longest = Math.max(longest, current - previous);
  }
  return longest;
}

function simultaneousFadeIns(source: string): number {
  const calls = source.matchAll(
    /\.(?:to|from|fromTo)\s*\(\s*\[([^\]]*)\]([\s\S]{0,320}?)\)\s*(?:,|;|$)/g,
  );
  let count = 0;
  for (const call of calls) {
    const targets = (call[1] ?? "").split(",").filter((part) => part.trim());
    const vars = call[2] ?? "";
    if (targets.length < 3) continue;
    if (/stagger\s*:/.test(vars)) continue;
    if (!/(?:autoAlpha|opacity)\s*:\s*1\b/.test(vars)) continue;
    count += 1;
  }
  return count;
}

/**
 * Groups of elements sent out on opacity alone — the cross-dissolve.
 *
 * A group that fades *and* travels is a correct exit: the material leaves along
 * a motivated vector and opacity only cleans up behind it. Only a group whose
 * whole departure is a fade counts, which is why this reads the tween's vars
 * rather than matching the call.
 */
function groupFadeOuts(source: string): number {
  let count = 0;
  for (const call of source.matchAll(
    /\.to\s*\(\s*\[[^\]]{0,200}\]\s*,\s*(\{[^}]{0,320}\})/g,
  )) {
    const vars = call[1] ?? "";
    if (!/(?:autoAlpha|opacity)\s*:\s*0(?!\.[1-9])/.test(vars)) continue;
    if (
      /\b(?:x|y|xPercent|yPercent|scale|scaleX|scaleY|rotation|rotate|z)\s*:/.test(
        vars,
      )
    ) {
      continue;
    }
    count += 1;
  }
  return count;
}

/**
 * Boundaries where the next scene is switched on while the last one is still
 * on screen, so both are painted at once.
 *
 * The shape this catches, taken verbatim from a live draw:
 *
 *   t.to(scene01, { autoAlpha: 0, duration: 0.4 }, 4.6);
 *   t.set(scene02, { autoAlpha: 1 }, 4.6);
 *
 * For those 0.4s the outgoing scene is dissolving underneath a new one that did
 * not animate in at all — it popped to full opacity on the same frame. The
 * viewer sees two stacked layouts sitting on top of each other, motionless,
 * which is the "static transition" complaint. It is not a cross-fade either:
 * only one side is moving.
 *
 * The instant `set` is what makes this unambiguous. A boundary where both sides
 * genuinely animate is a different technique and is left alone here.
 */
/**
 * Whether a timeline variable refers to a declared transition carrier.
 *
 * Models bind the carrier to a variable named after its id — `app-carrier`
 * becomes `carrier` or `appCarrier` — so the ids are compared with separators
 * stripped, and a bare `carrier` always counts.
 */
function isCarrierVariable(name: string, carriers: readonly string[]): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.includes("carrier")) return true;
  // Both sides need real length. Matching a one-letter variable against an id
  // it happens to be a substring of made `a` a carrier of "app-carrier", which
  // silently exempted ordinary scene layers from the overlap check.
  if (normalized.length < 4) return false;
  return carriers.some((carrier) => {
    const id = carrier.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      id.length >= 4 && (normalized.includes(id) || id.includes(normalized))
    );
  });
}

/**
 * Carrier moves the model authored by hand rather than through a helper.
 *
 * `physicalHandoffCount` counts `morph(`, `matchCut(` and friends, which is not
 * how the house films are built: recoup makes two preset calls in 435 lines and
 * writes the rest of its continuity as direct tweens. Counting only the helpers
 * told a film that had carried its carrier across every boundary by hand that it
 * had executed no handoffs at all, and no repair pass could clear the complaint
 * because nothing was wrong. A tween that moves or reshapes the declared carrier
 * is a handoff whatever it was written with.
 */
function authoredCarrierMoves(
  source: string,
  carriers: readonly string[],
): number {
  let count = 0;
  for (const match of source.matchAll(
    /\.(?:to|from|fromTo)\s*\(\s*([A-Za-z_$][\w$]*)\s*,([\s\S]{0,300}?)\)\s*(?=[;,\n]|$)/g,
  )) {
    if (!isCarrierVariable(match[1] ?? "", carriers)) continue;
    if (
      /\b(?:width|height|borderRadius|x|y|xPercent|yPercent|scale|scaleX|scaleY|rotation|top|left|clipPath)\s*:/.test(
        match[2] ?? "",
      )
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * Spans where a handoff is covering the cut.
 *
 * A beat swapping underneath a carrier that is mid-morph is the match-cut
 * working: the carrier fills that part of the frame, so the exchange behind it
 * is invisible and intentional. The bundled foundation does exactly this — it
 * morphs its carrier at 4s for 1.25s and swaps its faces at 4.12s — and reading
 * that as a cross-dissolve flagged the reference film this pipeline ships.
 */
function handoffWindows(
  source: string,
  carriers: readonly string[],
): { from: number; until: number }[] {
  const windows: { from: number; until: number }[] = [];
  for (const match of source.matchAll(
    /\b(?:morph|matchCut|cutTheCurve|zoomThrough|inverseZoomThrough|pullbackComplete|growAndComplete)\s*\(([\s\S]{0,400}?)\)\s*;/g,
  )) {
    const body = match[1] ?? "";
    const at = /\bat\s*:\s*([\d.]+)/.exec(body);
    const duration = /\bduration\s*:\s*([\d.]+)/.exec(body);
    if (!at) continue;
    const from = Number(at[1]);
    windows.push({ from, until: from + Number(duration?.[1] ?? 0.8) });
  }
  for (const match of source.matchAll(
    /\.(?:to|fromTo)\s*\(\s*([A-Za-z_$][\w$]*)\s*,([\s\S]{0,320}?)\)\s*(?=[;,\n]|$)/g,
  )) {
    if (!isCarrierVariable(match[1] ?? "", carriers)) continue;
    const body = match[2] ?? "";
    const at = /,\s*([\d.]+)\s*$/.exec(body);
    const duration = /\bduration\s*:\s*([\d.]+)/.exec(body);
    if (!at) continue;
    const from = Number(at[1]);
    windows.push({ from, until: from + Number(duration?.[1] ?? 0.8) });
  }
  return windows;
}

function stackedSceneSwaps(
  source: string,
  carriers: readonly string[],
): string[] {
  const reveals: { target: string; at: number }[] = [];
  for (const match of source.matchAll(
    /\.set\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{([^}]{0,200})\}\s*,\s*([\d.]+)\s*\)/g,
  )) {
    const target = match[1] ?? "";
    /**
     * A carrier switching on while the outgoing beat leaves is the handoff
     * working, not two scenes stacked: it is there precisely to cover the cut.
     * Flagging it told the model its correct transitions were defects, which is
     * the opposite of what this check was written for.
     */
    if (isCarrierVariable(target, carriers)) continue;
    if (/(?:autoAlpha|opacity)\s*:\s*1\b/.test(match[2] ?? "")) {
      reveals.push({ target, at: Number(match[3]) });
    }
  }
  /**
   * The other half of the same defect: the incoming beat fades up on opacity
   * alone while the outgoing one fades down, so for the length of the crossover
   * both layouts are painted and the old one shows through the new as a ghost.
   * An exported film ghosted its whole card stack under the closing headline
   * this way. It is the cross-dissolve AGENTS.md bans outright.
   *
   * Only opacity-only arrivals count. If the incoming element also travels,
   * scales or rotates, it is entering on a real move and the opacity is just
   * cleaning up its edge, which is legitimate and must not be flagged.
   */
  for (const match of source.matchAll(
    /\.(?:to|fromTo)\s*\(\s*([A-Za-z_$][\w$]*)\s*,([\s\S]{0,320}?)\)\s*(?=[;,\n]|$)/g,
  )) {
    const target = match[1] ?? "";
    const vars = match[2] ?? "";
    if (isCarrierVariable(target, carriers)) continue;
    if (!/(?:autoAlpha|opacity)\s*:\s*1\b/.test(vars)) continue;
    if (
      /\b(?:x|y|xPercent|yPercent|scale|scaleX|scaleY|rotation|rotate|z|width|height|clipPath|top|left)\s*:/.test(
        vars,
      )
    ) {
      continue;
    }
    const at = /,\s*([\d.]+)\s*$/.exec(vars);
    if (at) reveals.push({ target, at: Number(at[1]) });
  }
  const covered = handoffWindows(source, carriers);
  const isCovered = (time: number): boolean =>
    covered.some((window) => time >= window.from - 0.2 && time <= window.until);
  const hits: string[] = [];
  for (const match of source.matchAll(
    /\.to\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{([^}]{0,200})\}\s*,\s*([\d.]+)\s*\)/g,
  )) {
    const vars = match[2] ?? "";
    if (!/(?:autoAlpha|opacity)\s*:\s*0(?!\.[1-9])/.test(vars)) continue;
    const seconds = /duration\s*:\s*([\d.]+)/.exec(vars);
    if (!seconds) continue;
    const from = match[1] ?? "";
    const at = Number(match[3]);
    const ends = at + Number(seconds[1]);
    for (const reveal of reveals) {
      if (reveal.target === from) continue;
      if (isCovered(reveal.at)) continue;
      if (reveal.at >= at && reveal.at < ends) {
        hits.push(
          `${reveal.target} is brought up at ${reveal.at}s while ${from} is still fading until ${ends.toFixed(2)}s, so the old beat ghosts through the new one`,
        );
      }
    }
  }
  return hits;
}

/**
 * Long directed moves left on a stock GSAP curve.
 *
 * `presets.ts` registers the `EASE` curves precisely because the stock set has
 * no dynamic range to spare: `power2.inOut` peaks at 3x its mean velocity and
 * `sine.inOut` at 1.57, so stretched across the multi-second travels a film is
 * built from, the middle of the move reads as constant velocity. The authored
 * house films bear that out — recoup, relay, tessera and KiriTTS carry 88
 * `EASE` references between them and reach for a preset call barely a dozen
 * times — yet this scorer credited only preset calls, so the repair pass had no
 * way to see the one thing those films actually do.
 *
 * Reads whole tween-vars objects rather than matching a call, because `ease`
 * and `duration` appear in either order. Short moves are left alone: a 0.2s
 * tactile response has no room for a ramp and stock curves are right there.
 */
function stockCurveTravels(source: string): number {
  let count = 0;
  for (const block of source.matchAll(/\{[^{}]{0,400}\}/g)) {
    const vars = block[0];
    const duration = /duration\s*:\s*(\d*\.?\d+)/.exec(vars);
    if (!duration) continue;
    if (Number(duration[1]) < 0.9) continue;
    const ease = /ease\s*:\s*["'`]([a-z]+)[^"'`]*["'`]/i.exec(vars);
    if (!ease) continue;
    /**
     * Only the flat family is a defect here.
     *
     * `sine` is the doctrine's curve for ambient drift and breathing — the 1-3%
     * settle under a hold that keeps a frame from freezing — `none` is a
     * constant-rate readout such as a playhead, and `steps` drives the
     * deterministic typewriter. None is a directed move, so none wants a ramp;
     * counting them told a correctly directed film to fix its drift, the same
     * way `cameraMoveCount` once counted drifts as camera moves. `back` and
     * `elastic` are deliberate overshoot, and the typography law in AGENTS.md
     * requires `back.out(1.35)` for word-by-word spring bounce — flagging them
     * would be telling the film to break a rule it was told to follow.
     */
    if (
      !/^(?:power\d?|expo|circ|quad|cubic|quart|quint|linear)$/i.test(
        ease[1] ?? "",
      )
    ) {
      continue;
    }
    count += 1;
  }
  return count;
}

function unstableEditIds(html: string): string[] {
  return Array.from(html.matchAll(/data-edit=["']([^"']+)["']/g))
    .map((match) => (match[1] ?? "").trim())
    .filter((id) =>
      /^(?:el|item|layer|box|div|obj|node|thing)[-_]?\d+$/i.test(id),
    );
}

export function analyzeMotionQuality(
  result: GeneratedComposition,
  context: MotionQualityContext = {},
): MotionQualityReport {
  const html = result.compositionHtml;
  const timeline = result.timelineJs;
  const executableTimeline = executableTimelineSource(timeline);
  const filmShape = context.prompt
    ? selectFilmShape(context.prompt)
    : undefined;
  const isTaskFilm = filmShape === "task";
  const sceneCount = Math.max(
    1,
    result.scenes?.length ?? countMatches(html, /data-scene(?:-id)?=/gi),
  );
  const seams = seamsFromResult(result.seams);
  const seamScenes: readonly SceneDefinition[] = result.scenes ?? [];
  const tweenCount = countMatches(
    executableTimeline,
    /(?:\btimeline|\btl|\bsceneTl|\bmaster)\.(?:to|from|fromTo|add)\s*\(/g,
  );
  const presetCount = countMatches(
    executableTimeline,
    /\b(?:giantKineticCrop|waterfallTextReveal|wordSlideRotate|charSpringBounce|textReveal|morph|matchCut|cutTheCurve|zoomThrough|inverseZoomThrough|cameraPush|cameraPull|cameraZoomPan|stepSurgeCounter|perspectiveCardReveal|ambientWaves|motionArc|squashAndStretch)\s*\(/g,
  );
  /**
   * Camera *moves*, not the drift underneath a hold.
   *
   * The doctrine asks for a 1-3% settling drift on still beats so no frame is
   * frozen, and those are authored on the world too. Counting them as moves
   * made a correctly directed film look over-driven: the bundled foundation
   * reads as six moves across four beats when four are real and two are
   * drifts. The skill's own vocabulary separates them — camera and geometry
   * moves ease on expo/power, a settling drift eases on sine.
   */
  const cameraMoveCount =
    countMatches(
      executableTimeline,
      /(?:\btimeline|\btl|\bsceneTl|\bmaster)\.(?:to|fromTo)\s*\(\s*(?:cameraWorld|cameraStage|world)\b(?:(?!ease\s*:\s*["']sine)[^)])*\)/g,
    ) +
    // The camera helpers, which the runtime law tells the model to prefer.
    // Counting only raw `timeline.to(world, ...)` meant a film that used
    // cameraPush/cameraPull/cameraZoomPan scored zero and was told "the camera
    // never travels" — a complaint no amount of correct authoring could clear,
    // so every repair pass got the same note back.
    countMatches(
      executableTimeline,
      /\b(?:cameraPush|cameraPull|cameraZoomPan|punchIn|zoomThrough|inverseZoomThrough|parallax\w*)\s*\(/g,
    );
  // Standalone carriers only. A beat that is its own seam's carrier is handed
  // off by a helper call, which the handoff count already reads; treating its
  // variable as a carrier would exempt ordinary scene layers from the overlap
  // check below.
  const carrierIds = seams
    .filter((seam) => seam.carrier !== seam.from && seam.carrier !== seam.to)
    .map((seam) => seam.carrier)
    .filter(Boolean);
  const physicalHandoffCount =
    countMatches(
      executableTimeline,
      /\b(?:morph|matchCut|cutTheCurve|zoomThrough|inverseZoomThrough)\s*\(/g,
    ) + authoredCarrierMoves(executableTimeline, carrierIds);
  const easeVocabularyCount = countMatches(executableTimeline, /\bEASE\.\w+/g);
  const stockTravelCount = stockCurveTravels(executableTimeline);
  const componentCount = countMatches(html, /data-hyperframe-component\s*=/gi);
  const constructionCount = countMatches(
    executableTimeline,
    /(?:\btimeline|\btl|\bsceneTl|\bmaster)\.fromTo\s*\(/g,
  );
  const opacityBoundaryCount = countMatches(
    executableTimeline,
    /\.(?:to|fromTo)\s*\([^,]{0,80}(?:scene|slide|panel|face|layer)[^,]{0,40},\s*\{[^}]{0,160}(?:autoAlpha|opacity)\s*:/gi,
  );
  const deconstructionCount = countMatches(
    executableTimeline,
    /\.(?:to|fromTo)\s*\([\s\S]{0,220}?\{[^}]{0,220}?\b[xy]\s*:\s*-?\d[^}]{0,220}?autoAlpha\s*:\s*0/g,
  );
  const macroFocusCount = countMatches(
    executableTimeline,
    /(?:^|[^a-zA-Z])scale\s*:\s*(?:1\.[3-9]\d*|[2-9](?:\.\d+)?)/g,
  );
  const editIdCount = countMatches(html, /data-edit=["'][^"']+["']/g);
  const positions = timelinePositions(executableTimeline);
  const issues: string[] = [];
  const blocking: string[] = [];
  const strengths: string[] = [];
  /**
   * Output that is broken as the user sees it — it does not parse, it does not
   * run, it sits frozen, or it contradicts the requested film shape. Never a
   * reason to withhold the film: blocking only forces a repair pass and names
   * the defect in the reply, because a rejected generation is worth less to the
   * user than an imperfect one they can edit. A film that runs, renders, and
   * respects the brief but misses a directorial ideal stays advisory.
   */
  const fail = (message: string): void => {
    issues.push(message);
    blocking.push(message);
  };
  /** Direction for the repair pass. Never a reason to withhold the film. */
  const warn = (message: string): void => {
    issues.push(message);
  };

  const parseFailure = syntaxError(timeline);
  if (parseFailure) {
    fail(`timeline.js does not parse as JavaScript: ${parseFailure}`);
  }
  if (!/function\s+buildTimeline\s*\(/.test(timeline)) {
    fail("timeline.js must export or define buildTimeline(context)");
  }
  if (html.length < 1800) {
    warn(
      "composition HTML/CSS is too sparse for a production-quality directed frame",
    );
  }
  if (
    !/data-motionly-generation-profile=["']claude-foundation-v1["']/i.test(html)
  ) {
    warn("composition dropped the mandatory generation foundation marker");
  }
  if (!/data-transition-carrier(?:\s|=|>)/i.test(html)) {
    warn(
      "composition has no persistent transition carrier and can collapse into disconnected slides",
    );
  }
  if (componentCount > 0) {
    strengths.push("HyperFrames component mechanics shape the authored DOM");
  }
  const chromeScenes = applicationChromeScenes(html);
  if (filmShape && !isTaskFilm && chromeScenes.length >= 2) {
    fail(
      `the ad repeats application chrome across multiple beats (${chromeScenes.join(", ")}); replace repeated navigation scenes with editorial, object, mechanism and result shots`,
    );
  }
  if (filmShape && !isTaskFilm && editorialSubtitleCount(html) >= 2) {
    fail(
      "the ad uses repeated headline and subtitle layouts; turn editorial thoughts into full-size centered statements and give the product action its own shot",
    );
  }
  if (isTaskFilm && sceneCount >= 3 && constructionCount < 3) {
    warn(
      "product hierarchy is not constructed in stages before the interaction",
    );
  }
  if (sceneCount >= 3 && positions.length >= 6) {
    const distinctPositions = new Set(positions).size;
    if (distinctPositions < sceneCount * 2) {
      warn(
        "construction is not staggered across distinct timeline positions; regions arrive on too few timestamps",
      );
    } else {
      strengths.push("subjects arrive on staggered timestamps");
    }
  }
  if (simultaneousFadeIns(executableTimeline) > 0) {
    warn(
      "the layout arrives as one simultaneous fade-in of many elements; construct regions in reading order with staggered starts",
    );
  }
  if (isTaskFilm && sceneCount >= 3 && deconstructionCount === 0) {
    warn(
      "the product surface never deconstructs; outgoing internals must physically clear in reverse hierarchy while the carrier continues",
    );
  } else if (isTaskFilm && sceneCount >= 3 && deconstructionCount < 2) {
    warn(
      "only one beat deconstructs its surface; clear outgoing internals along motivated vectors at each major exit",
    );
  } else if (deconstructionCount >= 2) {
    strengths.push("surfaces construct and deconstruct in hierarchy");
  }
  if (
    isTaskFilm &&
    !/\b(?:cursor|caret|typed|typing|press|click|tap|drag|toggle|record|scrub)\b/i.test(
      `${html}\n${executableTimeline}`,
    )
  ) {
    warn(
      "no real product interaction is filmed; show one typed input, press, drag, or toggle that causes the result",
    );
  } else if (isTaskFilm) {
    strengths.push("a real product interaction drives the proof");
  }
  if (isTaskFilm && macroFocusCount === 0) {
    warn(
      "no macro interaction shot; frame the active control and its result at scale 1.35-2.2 on a local focus rig",
    );
  } else if (isTaskFilm) {
    strengths.push("a macro focus rig inspects the active interaction");
  }
  const transformPropertyCount = countMatches(
    executableTimeline,
    /\b(?:x|y|xPercent|yPercent|scale|scaleX|scaleY|rotation|rotate|rotateX|rotateY|skewX|skewY|z)\s*:/g,
  );
  const fadePropertyCount = countMatches(
    executableTimeline,
    /\b(?:autoAlpha|opacity)\s*:/g,
  );
  if (transformPropertyCount === 0) {
    fail(
      "nothing moves, scales, or rotates; opacity alone is not animation, so give every reveal and exit a physical property",
    );
  } else if (transformPropertyCount * 2 < fadePropertyCount) {
    warn(
      "motion is mostly opacity fades; anticipate, move, scale, or rotate the subject and reserve opacity for cleaning up a face after a handoff",
    );
  } else {
    strengths.push("motion is carried by transforms rather than fades");
  }
  if (
    !/\b(?:yoyo\s*:\s*true|squashAndStretch\s*\(|anticipate\s*\(|impactShake\s*\(|scaleX\s*:|scaleY\s*:)/.test(
      executableTimeline,
    )
  ) {
    warn(
      "no anticipation, squash, or impact accent; a hero action should wind up and deform before it resolves",
    );
  }
  if (/\b(?:bounce|elastic)\.(?:out|in|inOut)\b/.test(executableTimeline)) {
    warn(
      "bounce and elastic eases are banned; use back.out(1.4-1.7) for overshoot and power3/power4/expo for macro motion",
    );
  }
  const handoffVocabulary = new Set(
    Array.from(
      executableTimeline.matchAll(
        /\b(morph|matchCut|cutTheCurve|zoomThrough|inverseZoomThrough)\s*\(/g,
      ),
    ).map((match) => match[1]),
  );
  if (handoffVocabulary.size > 3) {
    warn(
      "too many transition vocabularies; a film repeats two or three seam types instead of inventing a new one at every boundary",
    );
  }
  if (positions.length >= 8 && longestHold(positions) < 0.6) {
    warn(
      "the timeline never pauses; give each important transformation a readable hold of roughly 0.8-1.6s",
    );
  }
  /**
   * The opposite failure, and the one that actually shipped: a beat enters,
   * then nothing is scheduled for seconds and the frames are identical.
   *
   * This reads start positions only, so a long tween still running through the
   * gap is invisible to it and the threshold has to stay well above a normal
   * 0.8-1.6s hold to avoid punishing correct pacing. The accurate measurement
   * happens against rendered frames in validate-generation; this one is here to
   * catch the egregious case early enough for a repair pass to fix it.
   */
  const widestGap = longestHold(positions);
  if (positions.length >= 4 && widestGap > 3.5) {
    /**
     * Advisory, because this measure cannot tell a frozen frame from a long
     * one. `timelinePositions` reads the position argument of each call and
     * nothing else, so a 2s camera drift starting at 6.2s counts as "nothing
     * scheduled" until the next tween *starts* — and the extractor also picks
     * up numbers that are not positions at all, which is why it reports 136s of
     * dead air in relay and 110s in KiriTTS, two films that never freeze.
     *
     * As a blocking issue it was the most frequent complaint in every live run
     * and the model could only answer it by adding more tween *starts*, which
     * means chopping long continuous moves into short ones. That buys a denser
     * timeline and a choppier, more static-looking film — the opposite of the
     * thing being asked for.
     *
     * `deadAirWarnings` in validate-generation.ts is the honest measure: it
     * seeks the mounted composition and compares what each frame actually
     * renders, so durations, child timelines and presets are all accounted for.
     * This stays as a hint for the repair prompt; it no longer withholds a film
     * or spends a pass on its own arithmetic.
     */
    warn(
      `the timeline may go about ${widestGap.toFixed(1)}s between scheduled moves; if that stretch is genuinely still, fill it with the beat's own story action or cut it, because a hold past ~1.6s reads as a frozen slide`,
    );
  } else if (positions.length >= 4) {
    strengths.push("no beat is left frozen waiting for the next one");
  }
  /**
   * The boundary checks. When the generation authored seams they are the
   * subject: a declared carrier can be resolved against the markup and the
   * timeline, so a fictional handoff is caught by name. Counting `morph(`
   * calls, which is all the fallback can do, is satisfied by calling the helper
   * on an element nobody sees — so the counts only run when there is no plan to
   * check, and both sets are never reported at once, because the repair prompt
   * keeps the first eight issues and duplicates would crowd out real ones.
   */
  const seamReport = analyzeSeamPlan({
    seams: seams,
    scenes: seamScenes,
    html,
    timelineJs: timeline,
    duration: Number(result.duration) || 0,
  });
  for (const issue of seamReport.issues) {
    if (seamReport.blocking.includes(issue)) fail(issue);
    else warn(issue);
  }
  strengths.push(...seamReport.strengths);
  if (!seamReport.planned) {
    if (sceneCount > 1 && physicalHandoffCount < Math.min(3, sceneCount - 1)) {
      warn(
        "too few executable physical carrier handoffs cover the scene boundaries",
      );
    } else if (sceneCount > 1) {
      strengths.push("each major boundary has executable carrier continuity");
    }
  } else if (sceneCount > 1 && physicalHandoffCount === 0) {
    /**
     * A declared plan is a promise about the timeline, not a substitute for it.
     *
     * These checks used to run only when no seams were declared, so a film that
     * wrote `"mechanism": "morph"` for every boundary and then cross-dissolved
     * them collected the seam plan's own strength and was asked to fix nothing. `analyzeSeamPlan` verifies the
     * carrier is named and the budget is sane; nothing verified the handoff was
     * ever executed.
     */
    fail(
      `the seam plan declares ${seams.length} carrier handoff${
        seams.length === 1 ? "" : "s"
      } but the timeline executes none; implement each declared mechanism as a real move on its carrier instead of switching scene layers on and off`,
    );
  } else if (
    seamReport.planned &&
    seams.length > 0 &&
    physicalHandoffCount < seams.length
  ) {
    // Executing one of four declared handoffs cleared the blocking check above,
    // which asks only that the count is not zero. The boundaries left over are
    // still cut rather than carried.
    warn(
      `the seam plan declares ${seams.length} carrier handoffs but the timeline executes only ${physicalHandoffCount}; the remaining boundaries are cuts, not handoffs`,
    );
  }
  if (
    sceneCount > 1 &&
    physicalHandoffCount < sceneCount - 1 &&
    opacityBoundaryCount >= sceneCount - 1
  ) {
    warn(
      "scenes are joined by opacity toggles rather than carriers; this is slideshow output, not a directed film",
    );
  }
  /**
   * Two scenes painted on top of each other reads as a broken render, not as a
   * directorial miss, so it blocks and buys a repair pass.
   */
  const stacked = stackedSceneSwaps(executableTimeline, carrierIds);
  if (stacked.length > 0) {
    fail(
      `scene layers overlap at ${stacked.length} boundar${
        stacked.length === 1 ? "y" : "ies"
      }: ${stacked
        .slice(0, 2)
        .join(
          "; ",
        )}. Move the outgoing scene off its own vector and bring the incoming one in on a real transition instead of switching it to full opacity mid-fade`,
    );
  }
  if (sceneCount >= 3 && !/data-camera-world(?:\s|=|>)/i.test(html)) {
    warn(
      "multi-scene product film has no expansive data-camera-world and is likely toggling components inside one viewport",
    );
  }
  /**
   * A floor and a ceiling.
   *
   * Asking for three moves "covering push, pan/track and pull/reframe" read as
   * an instruction to use one of each, and combined with a rule that gave every
   * beat its own tween it produced the ping-pong the references never do: push,
   * pull, push, pull; left, right, left. The references hold the camera on
   * statement beats and let the type carry the motion, so a film with more
   * camera moves than beats is over-driven, not well directed.
   */
  if (sceneCount >= 3 && cameraMoveCount < 2) {
    warn(
      "the camera never travels; give the space beats a motivated move — through a corridor, across the world, or into a detail worth inspecting",
    );
  } else if (sceneCount >= 3 && cameraMoveCount > sceneCount + 1) {
    warn(
      `the camera moves ${cameraMoveCount} times across ${sceneCount} beats; hold it on the statement beats and let the type carry the motion, so the film travels one direction instead of cycling push, pull, push, pull`,
    );
  } else if (sceneCount >= 3) {
    strengths.push("camera path drives scene-level composition changes");
  }
  if (tweenCount + presetCount < Math.max(7, sceneCount * 3)) {
    warn(
      "timeline is under-choreographed and likely becomes static after its entrance",
    );
  } else {
    strengths.push("timeline has multi-phase motion density");
  }
  if (!/\.set\s*\([\s\S]{0,500}?,\s*0\s*\)/.test(timeline)) {
    warn(
      "initial visual states are not deterministically established at time 0",
    );
  }
  if (
    !/wordSlideRotate|charSpringBounce|textReveal|splitText\s*\(|stagger\s*:/.test(
      timeline,
    )
  ) {
    warn(
      "editorial text is not choreographed word-by-word or character-by-character",
    );
  } else {
    strengths.push("text uses reading-order choreography");
  }
  if (
    !seamReport.planned &&
    sceneCount > 1 &&
    !/\b(?:morph|matchCut|particle|reassembl|cutTheCurve|zoomThrough|inverseZoomThrough)\b/i.test(
      timeline,
    )
  ) {
    warn(
      "multi-scene output has no morph, match-cut, or particle-reassembly handoff",
    );
  } else if (!seamReport.planned && sceneCount > 1) {
    strengths.push("scene boundaries use an explicit continuity mechanism");
  }
  /**
   * Interface physics, not cinematic physics.
   *
   * A generation that does not know how to get from one layout to the next
   * reaches for the camera's vocabulary: cross-dissolve the old state out,
   * dissolve the new one in, and ease the whole thing linearly. On UI material
   * that reads as a slide deck with a video filter over it — text arriving as a
   * low-opacity overlay rather than as elements landing on a page.
   */
  const linearFades = countMatches(
    executableTimeline,
    /\.(?:to|from|fromTo)\s*\([^)]{0,400}?(?:autoAlpha|opacity)\s*:[^)]{0,200}?ease\s*:\s*["'](?:none|linear|power0[.\w]*)["']/g,
  );
  if (linearFades > 0) {
    warn(
      `${linearFades} reveal${linearFades === 1 ? " eases" : "s ease"} opacity linearly; UI elements land with snappy power2/power3/back easing, never a constant-rate fade`,
    );
  } else {
    strengths.push("reveals use interface easing rather than constant fades");
  }
  const crossDissolves = groupFadeOuts(executableTimeline);
  if (crossDissolves >= 2) {
    warn(
      "several beats end by fading a whole group of elements out at once, which is a cross-dissolve; move the outgoing material off along a vector and let the incoming material arrive spatially",
    );
  }
  // Scoped to the ground itself. A control whose own background goes
  // transparent is an interface state change, not the frame emptying out.
  if (
    /\.(?:to|fromTo|set)\s*\(\s*\w*(?:stage|world|ground|background|backdrop|field|canvas)\w*\s*,[^)]{0,240}?(?:background|backgroundColor)\s*:\s*["']?(?:#fff|#ffffff|white|transparent)/i.test(
      executableTimeline,
    )
  ) {
    warn(
      "the timeline animates the ground to white or transparent; the background stays constant for the whole film and never becomes a blank screen between beats",
    );
  }
  if (/filter\s*:\s*["']?blur\((?!0)/.test(executableTimeline)) {
    const sharpened = /filter\s*:\s*["']?blur\(0/.test(executableTimeline);
    if (!sharpened) {
      warn(
        "material is blurred and never brought back to blur(0px); rigid text and lines stay perfectly sharp except during a deliberate macro-settle focus pull that resolves",
      );
    }
  }
  if (/(@keyframes|animation\s*:)/i.test(html)) {
    fail(
      "independent CSS animation breaks deterministic seeking; place motion on the GSAP timeline",
    );
  }
  if (/repeat\s*:\s*-1/.test(timeline)) {
    fail(
      "infinite ambient looping replaces authored background progression and breaks finite film direction",
    );
  }
  if (
    /onComplete\s*:\s*\([^)]*\)\s*=>[\s\S]{0,180}?\.style\.(?:display|visibility|opacity)\s*=/.test(
      timeline,
    )
  ) {
    fail(
      "callback-driven layer cleanup is not reverse-seek safe; schedule display and visibility changes explicitly on the master timeline",
    );
  }
  if (
    /\.(?:to|fromTo)\s*\([^)]{0,260}?\b(?:left|top|width|height)\s*:/.test(
      timeline,
    )
  ) {
    warn(
      "repeated motion animates layout properties; use x/y/scale/scaleX/scaleY or reserve geometry changes for one short morph handoff",
    );
  }
  if (
    /(?:appWorld|appShell|productWindow|productShell|dashboard|browser|device)\s*,\s*\{[\s\S]{0,220}?scale\s*:\s*(?:1\.(?:1\d|[2-9]\d?)|[2-9])/i.test(
      timeline,
    )
  ) {
    warn(
      "a complete product shell is over-scaled and will be clipped by its carrier; keep the shell fit-safe and focus a local UI region instead",
    );
  }
  if (
    /(?:waterfallTextReveal|giantKineticCrop)[\s\S]{0,260}?(?:xPercent|yPercent)\s*:\s*-?50/i.test(
      timeline,
    )
  ) {
    warn(
      "editorial helper options are repositioning the centered wrapper; CSS must own centering, one inner layer must own whole-sentence scale, and words must not scale into each other",
    );
  }
  if (
    /class=["'][^"']*(?:phone|device)[^"']*["'][\s\S]{0,900}?class=["'][^"']*(?:card|frame)[^"']*["']/i.test(
      html,
    )
  ) {
    warn(
      "proof nests a framed card inside a device/frame; replace it with one coherent product surface",
    );
  }
  /**
   * Reference product films (ClickUp, Notion, GitHub, ChatGPT, Hera) run on
   * light grounds and reserve one full-bleed accent beat. A film that never
   * leaves near-black is almost always the model reaching for "premium" rather
   * than matching the product, so the ground values are read off the authored
   * CSS rather than trusted to the prose rule.
   */
  const groundValues = Array.from(
    html.matchAll(
      /(?:background(?:-color)?)\s*:\s*(?:#([0-9a-f]{3,8})|rgba?\(([^)]*)\))/gi,
    ),
  ).map((match) => {
    if (match[1]) {
      const hex = match[1];
      const full =
        hex.length <= 4
          ? hex
              .slice(0, 3)
              .split("")
              .map((char) => char + char)
              .join("")
          : hex.slice(0, 6);
      const value = Number.parseInt(full, 16);
      return (
        // Rec. 601 luma is close enough to rank a palette light or dark.
        (((value >> 16) & 255) * 299 +
          ((value >> 8) & 255) * 587 +
          (value & 255) * 114) /
        1000
      );
    }
    const parts = (match[2] ?? "").split(",").map((part) => Number(part));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return -1;
    return (
      ((parts[0] ?? 0) * 299 + (parts[1] ?? 0) * 587 + (parts[2] ?? 0) * 114) /
      1000
    );
  });
  const rankedGrounds = groundValues.filter((value) => value >= 0);
  if (
    rankedGrounds.length >= 4 &&
    rankedGrounds.every((value) => value < 90) &&
    context.prompt !== undefined &&
    !/\b(?:dark|terminal|console|editor|midnight|night|neon|cyber|gaming|noir)\b/i.test(
      context.prompt,
    )
  ) {
    warn(
      "every authored surface is near-black; choose the ground this product actually ships and reserve the dark value for one friction beat",
    );
  } else if (rankedGrounds.length >= 4) {
    strengths.push("ground values are chosen rather than defaulted to dark");
  }

  if (
    // "AI insights" is deliberately absent: it is real copy for real AI
    // products, and flagging it rejected legitimate films about them.
    /\b(?:lorem ipsum|your product here|product name here|placeholder text|sample text|dummy data)\b/i.test(
      html,
    )
  ) {
    warn(
      "generic placeholder or generic AI-dashboard copy is standing in for real product content",
    );
  }
  if (editIdCount < 5) {
    warn(
      "too few stable data-edit ids; every meaningful element must stay selectable, movable, resizable, and editable",
    );
  } else {
    strengths.push("generated elements keep stable editable ids");
  }
  const unstableIds = unstableEditIds(html);
  if (unstableIds.length > 0) {
    warn(
      `data-edit ids are positional rather than descriptive (${unstableIds
        .slice(0, 4)
        .join(", ")}); use role names so editor overrides survive regeneration`,
    );
  }
  if (
    /class=["'][^"']*(?:aurora|mesh-gradient|ambient-blob|blurry-blob)/i.test(
      html,
    ) &&
    !/data-background-role=["'][^"']+["']/i.test(html)
  ) {
    warn(
      "generic background effects have no declared semantic role or causal relationship to the story",
    );
  }
  const survivingIds = new Set(editIdsIn(html));
  const droppedUserWork = (context.protectedEditIds ?? []).filter(
    (id) => !survivingIds.has(id),
  );
  if (droppedUserWork.length > 0) {
    fail(
      `the edit deletes layers the user edited by hand: ${droppedUserWork
        .slice(0, 6)
        .join(", ")}`,
    );
  }
  const recomposed = (context.previousEditIds ?? []).filter(
    (id) => !survivingIds.has(id) && !droppedUserWork.includes(id),
  );
  if (recomposed.length > 0) {
    warn(
      `the edit re-cuts ${recomposed.length} layer${
        recomposed.length === 1 ? "" : "s"
      } instead of editing them in place: ${recomposed.slice(0, 5).join(", ")}`,
    );
  }
  const missingAssets = (context.requiredAssetTokens ?? []).filter(
    (token) => !html.includes(token),
  );
  if (missingAssets.length > 0) {
    fail(
      `supplied media is missing from the composition: ${missingAssets
        .slice(0, 3)
        .join(", ")}`,
    );
  }
  if (
    context.prompt !== undefined &&
    !/claude|anthropic/i.test(context.prompt) &&
    /\b(?:Claude|Anthropic)\b/.test(html)
  ) {
    fail(
      "the Claude foundation's branding leaked into the output; rebuild palette, chrome, and copy from the requested product",
    );
  }
  if ((result.techniques?.length ?? 0) < Math.min(sceneCount, 3)) {
    warn("technique plan does not cover enough beats or registry references");
  } else {
    strengths.push("technique plan names retrieved registry mechanics");
  }
  if (sceneCount >= 3 && (result.direction?.length ?? 0) < sceneCount) {
    warn(
      "scene direction plan is missing composition, spatial region, camera start/end/target, hierarchy, hold, or transition decisions",
    );
  } else if (sceneCount >= 3) {
    strengths.push(
      "scene and camera decisions are explicit before implementation",
    );
  }
  if (presetCount < 2) {
    warn(
      "fewer than two real Motionly presets are used in executable timeline code",
    );
  } else {
    strengths.push("composition uses reusable Motionly motion primitives");
  }
  if (easeVocabularyCount === 0) {
    warn(
      "no EASE curve is used: every directed move rides a stock GSAP curve, which reads as constant velocity across a multi-second travel",
    );
  } else if (easeVocabularyCount >= 3) {
    strengths.push("directed motion is carried by the tuned EASE vocabulary");
  }
  if (stockTravelCount > easeVocabularyCount && stockTravelCount >= 3) {
    warn(
      `${stockTravelCount} moves of 0.9s or longer stay on stock GSAP curves; use EASE.cameraRamp, EASE.travel, EASE.arrive, EASE.depart, EASE.settle or EASE.material so the ramp is legible`,
    );
  }

  const advisoryCount = issues.length - blocking.length;
  const penalty = blocking.length * 22 + advisoryCount * 5;
  /**
   * Strengths break ties between films that fail in the same places; they do
   * not buy off failures. At `+3` each, uncapped, the bonus routinely matched
   * or beat the penalty — the reproduced Motionly launch film scored 88 with
   * nine named defects, and a live run clamped to a flat 100 with seven — so
   * `requiresRepair` stayed false and the repair pass this pipeline is built
   * around never ran on exactly the output that needed it.
   */
  const bonus = Math.min(strengths.length, 5);
  const score = Math.min(100, Math.max(0, 100 - penalty + bonus));
  return {
    score,
    // A repair pass costs the user a second model round trip, so spend it on
    // output that is broken or genuinely weak rather than on every generation
    // that misses one directorial ideal.
    requiresRepair: blocking.length > 0 || score < QUALITY_REPAIR_THRESHOLD,
    issues,
    blockingIssues: blocking,
    strengths,
  };
}

// Compatibility export; repair instructions are separate from user context.
export { buildQualityRepairPrompt } from "./repair-prompt";

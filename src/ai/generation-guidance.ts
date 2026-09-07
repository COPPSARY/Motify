import { registryManifest } from "../registry/catalog";
import {
  buildProductIdentityBrief,
  selectProductProfile,
} from "./product-profile";
import type { RuntimeEditorState } from "../composition/types";
import type { RegistryItemSummary } from "../registry/types";

export interface GenerationFiles {
  compositionHtml?: string;
  timelineJs?: string;
  stylesCss?: string;
  indexTs?: string;
  conversation?: readonly { role: "user" | "assistant"; text: string }[];
  assets?: readonly GenerationAsset[];
  editorState?: Partial<RuntimeEditorState>;
  generationProfile?: "claude-foundation-v1" | "existing";
  /** Directorial plan produced by the previous turn, replayed on follow-ups. */
  previousPlan?: GenerationPlanMemory;
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
  techniques?: readonly GenerationTechnique[];
}

export interface GenerationAsset {
  id: string;
  name: string;
  mimeType: string;
  dataBase64: string;
  token: string;
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
  scenes?: readonly {
    id: string;
    label: string;
    start: number;
    duration: number;
    accent: string;
  }[];
  direction?: readonly SceneDirection[];
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
 * Reference roles. A premium product ad needs one proven mechanic per job, not
 * five competing typographic effects. Selecting by role is what stops the model
 * from stacking similar entrances and calling it a film.
 */
export interface ReferenceRole {
  readonly role: string;
  readonly job: string;
  readonly candidates: readonly string[];
}

export const REFERENCE_ROLES: readonly ReferenceRole[] = [
  {
    role: "focal-typography",
    job: "the editorial thought that opens or turns a beat",
    candidates: [
      "per-word-rise",
      "kinetic-center-build",
      "headline-slam",
      "line-by-line-slide",
      "text-stagger",
    ],
  },
  {
    role: "product-surface",
    job: "the full-bleed application surface that carries the proof",
    candidates: [
      "browser-device-stage",
      "code-terminal-run",
      "notes-typing",
      "chat-thread",
      "device-frame-stage",
      "scroll-feed",
    ],
  },
  {
    role: "progressive-construction",
    job: "building the interface in reading order instead of one fade-in",
    candidates: [
      "skeleton-reveal",
      "panel-reveal",
      "grid-card-assemble",
      "stagger-cascade",
      "tabs-slide-indicator",
    ],
  },
  {
    role: "interaction",
    job: "the one real interaction the camera films in macro",
    candidates: [
      "typed-prompt",
      "streaming-text",
      "oversized-cursor",
      "press-ripple",
      "gesture-tap",
      "simulated-cursor",
      "input-feedback",
      "settings-toggle-flow",
    ],
  },
  {
    role: "camera",
    job: "the motivated push, track, or pull that changes the composition",
    candidates: [
      "ui-focus-zoom",
      "camera-rig-depth-stack",
      "push-in",
      "pan-stations",
      "pull-back-reveal",
      "parallax-device-dive",
      "focus-rack",
    ],
  },
  {
    role: "continuity",
    job: "the carrier handoff at each scene boundary",
    candidates: [
      "morph-swap",
      "match-cut",
      "particle-image-reveal",
      "zoom-through-transition",
      "modal-morph",
      "type-match-cut",
      "shared-axis-z",
    ],
  },
  {
    role: "proof",
    job: "the credible result the interaction produced",
    candidates: [
      "count-up",
      "chart-story",
      "animated-bar-chart",
      "success-check",
      "state-chip-rail",
      "telemetry-hud",
      "number-wheel",
      "social-proof-card",
    ],
  },
  {
    role: "deconstruction-close",
    job: "clearing the surface in reverse hierarchy into the final mark",
    candidates: [
      "physical-exit",
      "logo-brand-close",
      "cta-close",
      "cta-lockup",
      "wordmark-tiles",
      "logo-sting",
    ],
  },
];

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
  const title = item.title?.toLowerCase() ?? "";
  const description = item.description?.toLowerCase() ?? "";
  const tags = (item.tags ?? []).join(" ").toLowerCase();
  const family = `${item.family ?? ""} ${item.profile ?? ""}`.toLowerCase();
  let score = prompt.includes(name) ? 80 : 0;

  for (const token of queryTokens) {
    if (name.includes(token)) score += 9;
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
  for (const role of REFERENCE_ROLES) {
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

export function buildSkillRoutingBrief(userPrompt: string): string {
  const prompt = userPrompt.toLowerCase();
  const background = selectBackgroundDirection(userPrompt);
  const product = selectProductProfile(userPrompt);
  const routes = [
    "write-motionly: authored HTML, scoped CSS, caller-owned GSAP timeline, truthful scenes",
    `product identity (${product.id}): build ${product.surface}; ${product.palette}; never ${product.avoid}`,
    `saas-motion-design: progressive construction in reading order, one filmed interaction (${product.interaction}), causal proof (${product.proof}), reverse-hierarchy deconstruction (${product.deconstruction})`,
    "camera grammar: intentional push to a named target, typing-follow pan on the advancing caret, macro interaction shot on a local focus rig at 1.35-2.2, readable hold, motivated pull back",
    "motion-doctrine: the vector law (same axis, same direction, matched speed, cut mid-motion), one dominant direction for the film, reserved vectors only for meaning, no idle wobble, and 0.3-0.75s stillness before each climax",
    "saas-motion-design transitions: choose the seam from the job — camera push or UI feature zoom to inspect, card takeover or morph expansion for the same object in a new layout, whip pan or slide reveal to change section — and repeat only two or three vocabularies across the film",
    "cut-the-curve + oversized-cursor: mirrored-ease seams that enter mid-flight, and a cursor whose click ignites the next beat on the same frame",
    "composition + typography: one focal thought, safe bounds, word-level choreography",
    "animation + easing + timeline: arrival/action/settle/hold/departure with explicit timing",
    "transitions + camera: continuous carrier, matched velocity, motivated reframing",
    "hyperframes-registry: retrieve a proven mechanic before inventing one",
    "reference-grade-product-film: carrier-first choreography, word-level scale contrast, fit-safe causal UI proof, and semantic background progression",
    `background director: ${background.system}; ${background.progression}; avoid ${background.avoid}`,
  ];
  if (/app|product|saas|software|dashboard|browser|ui/.test(prompt)) {
    routes.push(
      "components + assets: faithful product surface, readable proof, real supplied media when present",
    );
  }
  if (/apple|ios|macos|premium|minimal|fluid|spring|morph/.test(prompt)) {
    routes.push(
      "apple-design: restrained physical materials, spatial consistency, critically damped macro motion, and bounce only for tactile momentum",
    );
  }
  if (/note|notebook|memo|writing|journal|transcript/.test(prompt)) {
    routes.push(
      "notes product proof: typing or recording must visibly become structured, searchable, actionable content inside a faithful notes surface",
    );
  }
  if (/logo|brand|wordmark|identity|cta/.test(prompt)) {
    routes.push(
      "svg + composition: editable mark construction and a resolved brand close",
    );
  }
  if (/caption|subtitle|karaoke|transcript/.test(prompt)) {
    routes.push(
      "caption animation: word-timed readable overlay with safe-area discipline",
    );
  }
  return routes.map((route, index) => `${index + 1}. ${route}`).join("\n");
}

export function buildMotionlyUserMessage(
  userPrompt: string,
  currentFiles: GenerationFiles,
): string {
  const hasExistingCode = Boolean(
    currentFiles.compositionHtml && currentFiles.compositionHtml.length > 50,
  );
  const task = hasExistingCode
    ? "EDIT the existing composition"
    : "CREATE a new composition";
  const source = hasExistingCode
    ? `\n\nCurrent composition.html:\n\`\`\`html\n${currentFiles.compositionHtml ?? ""}\n\`\`\`\n\nCurrent styles.css:\n\`\`\`css\n${currentFiles.stylesCss ?? ""}\n\`\`\`\n\nCurrent timeline.js:\n\`\`\`javascript\n${currentFiles.timelineJs ?? ""}\n\`\`\`\n\nCurrent index.ts metadata adapter:\n\`\`\`typescript\n${currentFiles.indexTs ?? ""}\n\`\`\``
    : "";
  const history = (currentFiles.conversation ?? [])
    .filter((message) => message.text.trim())
    .slice(-40)
    .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
    .join("\n");
  const assets = (currentFiles.assets ?? [])
    .map(
      (asset) =>
        `- ${asset.name} (${asset.mimeType}); required HTML source: ${asset.token}`,
    )
    .join("\n");
  const plan = currentFiles.previousPlan;
  const planDirection = (plan?.direction ?? [])
    .map(
      (entry) =>
        `- ${entry.scene}: ${entry.composition}; camera ${entry.cameraStart} → ${entry.cameraEnd} on ${entry.cameraTarget}; primary ${entry.primary}; hold ${entry.hold}; handoff ${entry.transition}`,
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
      }\n${planDirection || "No recorded scene direction."}\n${
        planTechniques || "No recorded techniques."
      }\nThis is a follow-up. Keep the established subject, palette, product identity, scene spine, carrier chain, and data-edit ids. Change only what the new request asks for plus what must change for coherence. Never restart from a blank stage and never drop an accepted scene, asset, or interaction.`
    : "PREVIOUS GENERATION PLAN\nNo previous plan. Treat the project conversation above as the accumulated brief and honour every constraint the user already stated.";
  const foundationInstruction =
    currentFiles.generationProfile === "claude-foundation-v1"
      ? "The supplied source is the mandatory neutral generation foundation. Rewrite its brand, copy, palette, product information architecture, and proof for the request, but preserve and expand its carrier-led construction, camera route, interaction, deconstruction, and final resolve. It must not resemble the reference preset unless the user asked for that product."
      : "Preserve this project's identity and requested content while upgrading weak beats to the same carrier-led construction, camera, interaction, and resolve standard.";
  const editorState = `GENERATION FOUNDATION\n${foundationInstruction}\nKeep data-motionly-generation-profile="claude-foundation-v1", one persistent data-transition-carrier, one data-camera-world, and at least three adapted elements marked data-hyperframe-component. A scene may not be a full-screen panel that merely fades in or out.\n\nLOCAL EDITOR OVERRIDES\n${
    currentFiles.editorState
      ? JSON.stringify(currentFiles.editorState)
      : "No local editor overrides."
  }`;

  return `USER REQUEST\n${userPrompt}\n\nPROJECT CONVERSATION\n${history || "No earlier project conversation."}\n\n${followUp}\n\nPRODUCT VISUAL IDENTITY (adapt the foundation's choreography to THIS product)\n${buildProductIdentityBrief(
    userPrompt,
  )}\n\nSUPPLIED IMAGES\n${assets || "No images attached to this request."}\n${assets ? "Every supplied image is required in this generation and in every follow-up. Use its exact motionly-asset token in an img src inside a region where it belongs to the story: the product surface itself, an authored evidence plane, or the brand close. Do not substitute, ignore, crop out, or paste it as a floating sticker over working UI." : ""}\n\nLOCAL EDITOR OVERRIDES\n${editorState}\nPreserve these visual and tween overrides; do not bake over or invalidate their target ids.\n\nTASK\n${task}. Preserve every existing data-edit id, scene boundary, supplied asset reference, and unrelated behavior unless the request explicitly replaces it. Every element the viewer can see needs a stable descriptive data-edit id so it stays selectable, movable, resizable, and editable. Add data-edit-label to selectable components and declare component fields with data-field, data-field-label, data-field-type, data-field-binding, and data-field-property.${source}\n\nRELEVANT SKILL CONTRACTS (apply these, do not merely mention them)\n${buildSkillRoutingBrief(
    userPrompt,
  )}\n\nRETRIEVED HYPERFRAMES REFERENCES\n${buildRegistryBrief(userPrompt)}\n\nPrefer these existing mechanics over inventing new ones. Implement 3-5 of them, one per role, as concrete choreography/design mechanics and record them in techniques. They are reference implementations, not callable Motionly functions and not nested data-composition-src clips. Rebuild/adapt the selected mechanics as semantic HTML/SVG plus the real Motionly preset functions available in scope.\n\nBefore writing code, silently plan in this exact order: STORY/SCENES → SPATIAL MAP → CAMERA PATH → MOTION HIERARCHY → GSAP. Record those decisions for every scene in the returned direction array. Build a data-camera-world larger than the viewport and place distinct composition states in different regions. A strong default route is full product → camera push to feature → camera pan as a neighboring composition enters → camera pull back showing multiple states. Camera travel must begin the compositional change and UI action must develop inside that travel.\n\nConstruct the product surface progressively in reading order (chrome → navigation → working surface → active record → active control → result) with staggered starts, and deconstruct it in reverse hierarchy when it leaves. Film exactly one real interaction with a macro focus rig and pan with the caret while text types. Then return the complete JSON artifact. Every scene must have motion after its entrance, every boundary must conserve visual mass, and the final code must run without imports. Treat fit as non-negotiable: zoom one inner text motion layer, stagger words without scaling them into each other, keep complete product shells readable at settled holds, never overlap two settled text blocks, and never build frame-on-frame screenshot collages or tiny cards floating in a void.`;
}

function countMatches(value: string, expression: RegExp): number {
  return Array.from(value.matchAll(expression)).length;
}

function executableTimelineSource(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Below this score the film is weak enough to be worth another model pass. */
export const QUALITY_REPAIR_THRESHOLD = 70;

export interface MotionQualityContext {
  /** The original request, used to detect foundation branding leaking through. */
  prompt?: string;
  /** Asset tokens that must appear in the composition HTML. */
  requiredAssetTokens?: readonly string[];
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
  const sceneCount = Math.max(
    1,
    result.scenes?.length ?? countMatches(html, /data-scene(?:-id)?=/gi),
  );
  const tweenCount = countMatches(
    executableTimeline,
    /(?:\btimeline|\btl|\bsceneTl|\bmaster)\.(?:to|from|fromTo|add)\s*\(/g,
  );
  const presetCount = countMatches(
    executableTimeline,
    /\b(?:giantKineticCrop|waterfallTextReveal|wordSlideRotate|charSpringBounce|textReveal|morph|matchCut|cutTheCurve|zoomThrough|inverseZoomThrough|cameraPush|cameraPull|cameraZoomPan|stepSurgeCounter|perspectiveCardReveal|ambientWaves|motionArc|squashAndStretch)\s*\(/g,
  );
  const cameraMoveCount = countMatches(
    executableTimeline,
    /(?:\btimeline|\btl|\bsceneTl|\bmaster)\.(?:to|fromTo)\s*\(\s*(?:cameraWorld|cameraStage|world)\b/g,
  );
  const physicalHandoffCount = countMatches(
    executableTimeline,
    /\b(?:morph|matchCut|cutTheCurve|zoomThrough|inverseZoomThrough)\s*\(/g,
  );
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
  const cardCount = countMatches(html, /class=["'][^"']*\bcard\b[^"']*["']/gi);
  const positions = timelinePositions(executableTimeline);
  const issues: string[] = [];
  const blocking: string[] = [];
  const strengths: string[] = [];
  /**
   * Reserved for output that is actually broken. A film that runs, renders, and
   * respects the brief but misses a directorial ideal is repaired by another
   * pass and still shipped, because a rejected generation is worth less to the
   * user than an imperfect one they can edit.
   */
  const fail = (message: string): void => {
    issues.push(message);
    blocking.push(message);
  };
  /** Direction for the repair pass. Never a reason to withhold the film. */
  const warn = (message: string): void => {
    issues.push(message);
  };

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
  if (componentCount < 3) {
    warn(
      "composition adapts fewer than three concrete HyperFrames component mechanics",
    );
  } else {
    strengths.push("HyperFrames component mechanics shape the authored DOM");
  }
  if (sceneCount >= 3 && constructionCount < 3) {
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
      strengths.push("interface regions arrive on staggered timestamps");
    }
  }
  if (simultaneousFadeIns(executableTimeline) > 0) {
    warn(
      "the layout arrives as one simultaneous fade-in of many elements; construct regions in reading order with staggered starts",
    );
  }
  if (sceneCount >= 3 && deconstructionCount === 0) {
    warn(
      "the product surface never deconstructs; outgoing internals must physically clear in reverse hierarchy while the carrier continues",
    );
  } else if (sceneCount >= 3 && deconstructionCount < 2) {
    warn(
      "only one beat deconstructs its surface; clear outgoing internals along motivated vectors at each major exit",
    );
  } else if (sceneCount >= 3) {
    strengths.push("surfaces construct and deconstruct in hierarchy");
  }
  if (
    !/\b(?:cursor|caret|typed|typing|press|click|tap|drag|toggle|record|scrub)\b/i.test(
      `${html}\n${executableTimeline}`,
    )
  ) {
    warn(
      "no real product interaction is filmed; show one typed input, press, drag, or toggle that causes the result",
    );
  } else {
    strengths.push("a real product interaction drives the proof");
  }
  if (macroFocusCount === 0) {
    warn(
      "no macro interaction shot; frame the active control and its result at scale 1.35-2.2 on a local focus rig",
    );
  } else {
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
  if (sceneCount > 1 && physicalHandoffCount < Math.min(3, sceneCount - 1)) {
    warn(
      "too few executable physical carrier handoffs cover the scene boundaries",
    );
  } else if (sceneCount > 1) {
    strengths.push("each major boundary has executable carrier continuity");
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
  if (sceneCount >= 3 && !/data-camera-world(?:\s|=|>)/i.test(html)) {
    warn(
      "multi-scene product film has no expansive data-camera-world and is likely toggling components inside one viewport",
    );
  }
  if (sceneCount >= 3 && cameraMoveCount < 3) {
    warn(
      "camera is not first-class; author at least three world moves covering push, pan/track, and pull/reframe",
    );
  } else if (sceneCount >= 3) {
    strengths.push("camera path drives scene-level composition changes");
  }
  if (
    sceneCount >= 3 &&
    !/(?:width|min-width)\s*:\s*(?:[3-9]\d{3}px|(?:1[5-9]\d|[2-9]\d{2})%)/i.test(
      html,
    )
  ) {
    warn(
      "camera world is not materially larger than the viewport; place scene regions across a 3200-5600px spatial canvas",
    );
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
    sceneCount > 1 &&
    !/\b(?:morph|matchCut|particle|reassembl|cutTheCurve|zoomThrough|inverseZoomThrough)\b/i.test(
      timeline,
    )
  ) {
    warn(
      "multi-scene output has no morph, match-cut, or particle-reassembly handoff",
    );
  } else if (sceneCount > 1) {
    strengths.push("scene boundaries use an explicit continuity mechanism");
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
  if (
    cardCount >= 3 &&
    !/data-edit=["'][^"']*(?:shell|surface|workspace|app|product|canvas|editor|dashboard|window|board|composer)[^"']*["']/i.test(
      html,
    )
  ) {
    warn(
      "small cards float in empty space with no full-bleed product surface; build the application surface this product actually has",
    );
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

  const advisoryCount = issues.length - blocking.length;
  const score = Math.min(
    100,
    Math.max(
      0,
      100 - blocking.length * 22 - advisoryCount * 5 + strengths.length * 3,
    ),
  );
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

/**
 * Concrete corrections keyed by the leading words of the issue that triggers
 * them. A repair pass that is handed the whole style guide rewrites everything
 * and usually regresses; a repair pass handed the two lines that name its own
 * mistake fixes them and leaves the rest of the film alone.
 */
const ISSUE_REMEDIES: ReadonlyArray<readonly [string, string]> = [
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
    "supplied media is missing",
    "Render every supplied asset token as a real `src` or `url()` on a visible element.",
  ],
  [
    "the Claude foundation's branding",
    "Strip every Claude/Anthropic name, palette, and chrome; rebuild the surface from the product the user actually asked for.",
  ],
  [
    "composition has no persistent transition carrier",
    "Mark one element that survives every scene with `data-transition-carrier` and animate it across each boundary.",
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
    "camera is not first-class",
    "Author at least three world moves on `[data-camera-world]`: a push in, a pan/track across, and a pull back to reframe.",
  ],
  [
    "multi-scene product film has no expansive",
    "Wrap the scene regions in a `data-camera-world` element several times wider than the 1920px viewport and move the camera across it.",
  ],
  [
    "timeline is under-choreographed",
    "Add multi-phase motion so each scene has at least three authored tweens, not one entrance.",
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
    "small cards float in empty space",
    "Build the full-bleed application surface this product actually has and place the cards inside it.",
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

export function buildQualityRepairPrompt(
  originalPrompt: string,
  result: GeneratedComposition,
  report: MotionQualityReport,
): string {
  // Blocking failures first, then the strongest advisory notes. Anything past
  // the first handful is noise the model trades against the failures that
  // actually matter.
  const targeted = [
    ...report.blockingIssues,
    ...report.issues.filter((issue) => !report.blockingIssues.includes(issue)),
  ].slice(0, 8);
  const remedies = remediesFor(targeted);
  const kept = report.strengths.length
    ? `\n\nALREADY GOOD — DO NOT REGRESS\n${report.strengths
        .slice(0, 6)
        .map((strength) => `- ${strength}`)
        .join("\n")}`
    : "";
  const howToFix = remedies.length
    ? `\n\nHOW TO FIX EACH ONE\n${remedies
        .map((remedy) => `- ${remedy}`)
        .join("\n")}`
    : "";
  return `Repair the Motionly composition you just produced for this request: ${originalPrompt}

Keep the subject, palette, copy, scene spine, and every data-edit id. Change only what the list below names; do not restart from a blank stage.

FIX THESE
${targeted.map((issue, index) => `${index + 1}. ${issue}`).join("\n")}${howToFix}${kept}

Return the complete replacement JSON with compositionHtml and timelineJs, not a patch.

Previous reply summary: ${result.reply}`;
}

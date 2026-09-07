import { registryManifest } from "../registry/catalog";
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
}

export interface MotionQualityReport {
  score: number;
  requiresRepair: boolean;
  issues: readonly string[];
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

const REQUIRED_REFERENCE_NAMES = [
  "per-word-rise",
  "morph-swap",
  "match-cut",
  "particle-image-reveal",
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

  // Prefer composable primitives over complete examples when relevance ties.
  if (item.type === "hyperframes:component") score += 3;
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

export function selectRegistryReferences(
  userPrompt: string,
  limit = 8,
): readonly RegistryItemSummary[] {
  const normalizedPrompt = userPrompt.toLowerCase();
  const queryTokens = expandedQueryTokens(userPrompt);
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

  const selected: RegistryItemSummary[] = [];
  for (const entry of ranked) {
    const family = entry.item.family ?? entry.item.tags?.[0] ?? entry.item.type;
    const repeats = selected.filter(
      (item) => (item.family ?? item.tags?.[0] ?? item.type) === family,
    ).length;
    if (repeats >= 2 && !normalizedPrompt.includes(entry.item.name)) continue;
    selected.push(entry.item);
    if (selected.length >= Math.max(1, limit - 2)) break;
  }

  // Every film gets an editorial entrance and a legal continuity mechanism.
  for (const name of REQUIRED_REFERENCE_NAMES) {
    if (selected.length >= limit) break;
    if (selected.some((item) => item.name === name)) continue;
    const fallback = registryManifest.items.find((item) => item.name === name);
    if (fallback) selected.push(fallback);
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
  const references = selectRegistryReferences(userPrompt);
  return references
    .map(
      (item, index) =>
        `${index + 1}. ${item.name} [${item.type.replace("hyperframes:", "")}]: ${
          item.description ?? item.title ?? "Reusable HyperFrames reference"
        }${summarizeVariable(item)}`,
    )
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
  const routes = [
    "write-motionly: authored HTML, scoped CSS, caller-owned GSAP timeline, truthful scenes",
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
  const editorState = currentFiles.editorState
    ? JSON.stringify(currentFiles.editorState)
    : "No local editor overrides.";

  return `USER REQUEST\n${userPrompt}\n\nPROJECT CONVERSATION\n${history || "No earlier project conversation."}\n\nSUPPLIED IMAGES\n${assets || "No images attached to this request."}\n${assets ? "Every supplied image is required. Use its exact motionly-asset token in an img src; do not substitute or ignore it." : ""}\n\nLOCAL EDITOR OVERRIDES\n${editorState}\nPreserve these visual and tween overrides; do not bake over or invalidate their target ids.\n\nTASK\n${task}. Preserve every existing data-edit id, scene boundary, supplied asset reference, and unrelated behavior unless the request explicitly replaces it. Add data-edit-label to selectable components and declare component fields with data-field, data-field-label, data-field-type, data-field-binding, and data-field-property.${source}\n\nRELEVANT SKILL CONTRACTS (apply these, do not merely mention them)\n${buildSkillRoutingBrief(
    userPrompt,
  )}\n\nRETRIEVED HYPERFRAMES REFERENCES\n${buildRegistryBrief(userPrompt)}\n\nUse 2-4 of the retrieved references as concrete choreography/design mechanics and record them in techniques. They are reference implementations, not callable Motionly functions and not nested data-composition-src clips. Rebuild/adapt the selected mechanics as semantic HTML/SVG plus the real Motionly preset functions available in scope.\n\nBefore writing code, silently plan in this exact order: STORY/SCENES → SPATIAL MAP → CAMERA PATH → MOTION HIERARCHY → GSAP. Record those decisions for every scene in the returned direction array. Build a data-camera-world larger than the viewport and place distinct composition states in different regions. A strong default route is full product → camera push to feature → camera pan as a neighboring composition enters → camera pull back showing multiple states. Camera travel must begin the compositional change and UI action must develop inside that travel. Then return the complete JSON artifact. Every scene must have motion after its entrance, every boundary must conserve visual mass, and the final code must run without imports. Treat fit as non-negotiable: zoom one inner text motion layer, stagger words without scaling them into each other, keep complete product shells readable at settled holds, and never build frame-on-frame screenshot collages.`;
}

function countMatches(value: string, expression: RegExp): number {
  return Array.from(value.matchAll(expression)).length;
}

export function analyzeMotionQuality(
  result: GeneratedComposition,
): MotionQualityReport {
  const html = result.compositionHtml;
  const timeline = result.timelineJs;
  const sceneCount = Math.max(
    1,
    result.scenes?.length ?? countMatches(html, /data-scene(?:-id)?=/gi),
  );
  const tweenCount = countMatches(
    timeline,
    /(?:\btimeline|\btl|\bsceneTl|\bmaster)\.(?:to|from|fromTo|add)\s*\(/g,
  );
  const presetCount = countMatches(
    timeline,
    /\b(?:giantKineticCrop|waterfallTextReveal|wordSlideRotate|charSpringBounce|textReveal|morph|matchCut|cutTheCurve|zoomThrough|inverseZoomThrough|cameraPush|cameraPull|cameraZoomPan|stepSurgeCounter|perspectiveCardReveal|ambientWaves|motionArc|squashAndStretch)\s*\(/g,
  );
  const cameraMoveCount = countMatches(
    timeline,
    /(?:\btimeline|\btl|\bsceneTl|\bmaster)\.(?:to|fromTo)\s*\(\s*(?:cameraWorld|cameraStage|world)\b/g,
  );
  const issues: string[] = [];
  const strengths: string[] = [];

  if (!/function\s+buildTimeline\s*\(/.test(timeline)) {
    issues.push("timeline.js must export or define buildTimeline(context)");
  }
  if (html.length < 1800) {
    issues.push(
      "composition HTML/CSS is too sparse for a production-quality directed frame",
    );
  }
  if (sceneCount >= 3 && !/data-camera-world(?:\s|=|>)/i.test(html)) {
    issues.push(
      "multi-scene product film has no expansive data-camera-world and is likely toggling components inside one viewport",
    );
  }
  if (sceneCount >= 3 && cameraMoveCount < 3) {
    issues.push(
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
    issues.push(
      "camera world is not materially larger than the viewport; place scene regions across a 3200–5600px spatial canvas",
    );
  }
  if (tweenCount + presetCount < Math.max(7, sceneCount * 3)) {
    issues.push(
      "timeline is under-choreographed and likely becomes static after its entrance",
    );
  } else {
    strengths.push("timeline has multi-phase motion density");
  }
  if (!/\.set\s*\([\s\S]{0,500}?,\s*0\s*\)/.test(timeline)) {
    issues.push(
      "initial visual states are not deterministically established at time 0",
    );
  }
  if (
    !/wordSlideRotate|charSpringBounce|textReveal|splitText\s*\(|stagger\s*:/.test(
      timeline,
    )
  ) {
    issues.push(
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
    issues.push(
      "multi-scene output has no morph, match-cut, or particle-reassembly handoff",
    );
  } else if (sceneCount > 1) {
    strengths.push("scene boundaries use an explicit continuity mechanism");
  }
  if (/(@keyframes|animation\s*:)/i.test(html)) {
    issues.push(
      "independent CSS animation breaks deterministic seeking; place motion on the GSAP timeline",
    );
  }
  if (/repeat\s*:\s*-1/.test(timeline)) {
    issues.push(
      "infinite ambient looping replaces authored background progression and breaks finite film direction",
    );
  }
  if (
    /onComplete\s*:\s*\([^)]*\)\s*=>[\s\S]{0,180}?\.style\.(?:display|visibility|opacity)\s*=/.test(
      timeline,
    )
  ) {
    issues.push(
      "callback-driven layer cleanup is not reverse-seek safe; schedule display and visibility changes explicitly on the master timeline",
    );
  }
  if (
    /\.(?:to|fromTo)\s*\([^)]{0,260}?\b(?:left|top|width|height)\s*:/.test(
      timeline,
    )
  ) {
    issues.push(
      "repeated motion animates layout properties; use x/y/scale/scaleX/scaleY or reserve geometry changes for one short morph handoff",
    );
  }
  if (
    /(?:appWorld|appShell|productWindow|productShell|dashboard|browser|device)\s*,\s*\{[\s\S]{0,220}?scale\s*:\s*(?:1\.(?:1\d|[2-9]\d?)|[2-9])/i.test(
      timeline,
    )
  ) {
    issues.push(
      "a complete product shell is over-scaled and will be clipped by its carrier; keep the shell fit-safe and focus a local UI region instead",
    );
  }
  if (
    /(?:waterfallTextReveal|giantKineticCrop)[\s\S]{0,260}?(?:xPercent|yPercent)\s*:\s*-?50/i.test(
      timeline,
    )
  ) {
    issues.push(
      "editorial helper options are repositioning the centered wrapper; CSS must own centering, one inner layer must own whole-sentence scale, and words must not scale into each other",
    );
  }
  if (
    /class=["'][^"']*(?:phone|device)[^"']*["'][\s\S]{0,900}?class=["'][^"']*(?:card|frame)[^"']*["']/i.test(
      html,
    )
  ) {
    issues.push(
      "proof nests a framed card inside a device/frame; replace it with one coherent product surface",
    );
  }
  if (
    /class=["'][^"']*(?:aurora|mesh-gradient|ambient-blob|blurry-blob)/i.test(
      html,
    ) &&
    !/data-background-role=["'][^"']+["']/i.test(html)
  ) {
    issues.push(
      "generic background effects have no declared semantic role or causal relationship to the story",
    );
  }
  if ((result.techniques?.length ?? 0) < Math.min(sceneCount, 3)) {
    issues.push(
      "technique plan does not cover enough beats or registry references",
    );
  } else {
    strengths.push("technique plan names retrieved registry mechanics");
  }
  if (sceneCount >= 3 && (result.direction?.length ?? 0) < sceneCount) {
    issues.push(
      "scene direction plan is missing composition, spatial region, camera start/end/target, hierarchy, hold, or transition decisions",
    );
  } else if (sceneCount >= 3) {
    strengths.push(
      "scene and camera decisions are explicit before implementation",
    );
  }
  if (presetCount < 2) {
    issues.push(
      "fewer than two real Motionly presets are used in executable timeline code",
    );
  } else {
    strengths.push("composition uses reusable Motionly motion primitives");
  }

  const score = Math.max(0, 100 - issues.length * 16 + strengths.length * 3);
  return {
    score,
    requiresRepair: issues.length > 0 || score < 90,
    issues,
    strengths,
  };
}

export function buildQualityRepairPrompt(
  originalPrompt: string,
  result: GeneratedComposition,
  report: MotionQualityReport,
): string {
  return `Repair and substantially upgrade the generated Motionly composition for the original request: ${originalPrompt}\n\nQUALITY GATE FAILURES\n${report.issues
    .map((issue, index) => `${index + 1}. ${issue}`)
    .join(
      "\n",
    )}\n\nKeep any strong visual work, but rewrite weak choreography from the scene level. First build an expansive data-camera-world with distinct spatial states, then author a clear push → pan/track → pull/reframe camera path on the master timeline. UI action must unfold during those scene moves. Repair layout before adding micro motion: keep centered text wrappers fixed, zoom one inner text layer, stagger words without scaling them into each other, keep product shells readable at settled holds, and remove nested frames or screenshot collages. Use real Motionly preset calls and make boundaries MORPH, MATCH-CUT, or PARTICLE-REASSEMBLE. Return the complete replacement JSON, not a patch.\n\nPrevious reply summary: ${result.reply}`;
}

/**
 * Product-adaptive visual identity.
 *
 * The Claude preset is the *quality* baseline for Motionly generations: its
 * carrier-led construction, camera language, and timing discipline. It is not a
 * skin. Every generation must rebuild the surface, palette, information
 * architecture, and the single filmed interaction from the requested product's
 * own domain, otherwise every film looks like a dark AI chat clone.
 */
import { selectFilmShape } from "./film-shape";

export interface ProductProfile {
  /** Stable id used in tests, telemetry, and repair prompts. */
  id: string;
  /** Human label used in the model brief. */
  label: string;
  /** The information architecture the product surface must be built from. */
  surface: string;
  /** Palette and material direction, including light/dark commitment. */
  palette: string;
  /** Type and chrome language for this category. */
  typography: string;
  /** The one real interaction the camera films in macro. */
  interaction: string;
  /** What credible proof looks like after the interaction resolves. */
  proof: string;
  /** How the surface deconstructs into the next carrier role. */
  deconstruction: string;
  /** Category-specific failure modes. */
  avoid: string;
}

interface ProfileRule {
  readonly test: RegExp;
  readonly profile: ProductProfile;
}

const GENERIC_PROFILE: ProductProfile = {
  id: "generic-saas",
  label: "General SaaS product",
  surface:
    "one full-bleed application surface with the navigation, working canvas, and single active control the request actually implies",
  palette:
    "derive the palette from the product's own brand words; commit to one background value, one surface value, one accent with a job, and one ink value",
  typography:
    "Inter or a close system stack, tabular numerals for data, real product copy, no lorem and no placeholder boxes",
  interaction:
    "one credible task the user performs: typing a real query, pressing the primary control, dragging an object, or toggling a state",
  proof:
    "the interface visibly changes because of that interaction and the result stays on screen long enough to read",
  deconstruction:
    "the working surface sheds its internals in reverse hierarchy while the shared carrier keeps its silhouette into the closing statement",
  avoid:
    "cloning the Claude dark sidebar chat, generic AI dashboard tiles, and fake charts with no unit or label",
};

const PROFILE_RULES: readonly ProfileRule[] = [
  {
    test: /\b(ai|assistant|agent|copilot|chatbot|llm|prompt|gpt|claude|gemini)\b/,
    profile: {
      id: "ai-assistant",
      label: "AI assistant / agent product",
      surface:
        "a composer-led conversation surface: quiet rail, thread column, and one dominant composer that owns the frame during the ask",
      palette:
        "one committed theme (warm dark or warm light), a single accent reserved for the send/act control, and generous negative space around the composer",
      typography:
        "large readable prompt text (24-32px in-app), a distinctly smaller response body, and no decorative monospace unless the product is developer-facing",
      interaction:
        "type a real, specific request character by character with an attached caret, then press send and let the response construct in reading order",
      proof:
        "the response resolves into structured output the viewer can read: a plan, a table, a summary, or an artifact, never a scrolling wall of generic text",
      deconstruction:
        "the response condenses back into the composer capsule, which morphs into the closing brand token",
      avoid:
        "three floating chat bubbles in a void, streaming lorem text, and a sidebar full of fake conversation titles",
    },
  },
  {
    test: /\b(note|notes|notebook|memo|journal|writing|doc|docs|document|transcript|capture)\b/,
    profile: {
      id: "notes-writing",
      label: "Notes / writing product",
      surface:
        "a paper-first editor: note list or folder rail, a wide writing plane with real ruled rhythm, and a lightweight formatting bar",
      palette:
        "bright paper values with ink-dark type, one accent for highlight and capture state, and soft real shadows rather than glow",
      typography:
        "editorial serif or humanist sans at real writing scale, visible line rhythm, and true hierarchy between title, body, and metadata",
      interaction:
        "capture becomes structure: typing or a voice capture visibly turns into a titled, organized, searchable note",
      proof:
        "the finished note shows real content such as checklist items, headings, or highlighted lines that did not exist before the capture",
      deconstruction:
        "the note page folds its structure away line by line while the page edge stays as the carrier for the close",
      avoid:
        "dark AI chrome, neon accents, and floating cards that never become an actual page",
    },
  },
  {
    test: /\b(audio|voice|podcast|music|record|speech|tts|sound|transcribe|transcription)\b/,
    profile: {
      id: "audio-voice",
      label: "Audio / voice product",
      surface:
        "a studio surface: transport controls, a real waveform or track lane with timecode, and one active clip under work",
      palette:
        "deep neutral studio ground with a single energetic accent that only lights where audio is actually active",
      typography:
        "compact UI type with tabular timecode; the waveform, not the text, carries the visual weight",
      interaction:
        "press record or play and let the waveform, playhead, and generated transcript advance together on the same clock",
      proof:
        "audio becomes something usable such as a transcript, a caption track, or a cleaned clip, visible beside its source waveform",
      deconstruction:
        "the waveform collapses into a single traveling pulse that becomes the closing mark",
      avoid:
        "a decorative sine wave that is not driven by the audio event and equalizer bars that loop forever",
    },
  },
  {
    test: /\b(data|metric|metrics|analytics|dashboard|chart|report|finance|fintech|revenue|growth|kpi|billing|invoice)\b/,
    profile: {
      id: "analytics-data",
      label: "Analytics / data product",
      surface:
        "a measured workspace: filter bar, one dominant chart with real axes and units, and a small set of supporting figures that belong to it",
      palette:
        "restrained neutral ground, one accent for the series under discussion, and a muted second value for comparison only",
      typography:
        "tabular numerals everywhere, honest axis labels, and units on every figure",
      interaction:
        "change one filter, range, or segment and let the chart re-resolve, with the headline figure counting to its new value",
      proof:
        "the number that changed is legible and framed with what it measures and over what period",
      deconstruction:
        "the chart reduces to its single trajectory line, which travels into the closing statement",
      avoid:
        "a grid of six identical KPI tiles, sparkline confetti, and charts with no axis, unit, or period",
    },
  },
  {
    test: /\b(code|coding|developer|dev|terminal|repo|repository|git|deploy|ci|api|sdk|ide|debug|compile)\b/,
    profile: {
      id: "developer-tool",
      label: "Developer tool",
      surface:
        "an editor or terminal surface with a real file tree, a code plane with syntax structure, and one status or run affordance",
      palette:
        "a committed editor theme with a legible syntax scale; the accent belongs to the run, diff, or pass state",
      typography:
        "true monospace at a readable size, real code that compiles conceptually, and no fake syntax noise",
      interaction:
        "run, diff, or fix: a command executes, output streams line by line, and a state resolves to pass",
      proof:
        "the diff, the passing check, or the deployed URL is readable and clearly caused by the command",
      deconstruction:
        "code lines retract into the rail they came from, leaving the run indicator as the carrier",
      avoid:
        "purple neon fog standing in for developer context and terminal text that is too small to read",
    },
  },
  {
    test: /\b(design|figma|canvas|creative|photo|video|edit|editor|render|3d|brand)\b/,
    profile: {
      id: "design-creative",
      label: "Design / creative tool",
      surface:
        "a canvas-first tool: tool rail, infinite canvas holding one real artboard, and a properties inspector bound to the selection",
      palette:
        "neutral tool chrome so the artwork carries the color; the accent is the selection and handle color only",
      typography:
        "small precise tool type with numeric fields that actually update during the manipulation",
      interaction:
        "select, drag, or apply on the canvas while the inspector values change on the same frame",
      proof:
        "the artboard visibly becomes the finished piece and the inspector explains why",
      deconstruction:
        "the canvas frame shrinks into the artboard silhouette and carries the close",
      avoid:
        "an empty gray artboard, decorative floating shapes, and inspector fields whose numbers never move",
    },
  },
  {
    test: /\b(shop|store|ecommerce|commerce|cart|checkout|order|retail|subscription)\b/,
    profile: {
      id: "commerce",
      label: "Commerce product",
      surface:
        "a storefront-to-checkout path: real product media, honest price and options, and one primary purchase control",
      palette:
        "bright merchandising ground so product media dominates, with the accent reserved for the buy action and success state",
      typography:
        "confident product type, tabular prices, and legible fine print rather than gray filler bars",
      interaction:
        "choose an option and complete the purchase: the control compresses, the state advances, and confirmation lands",
      proof:
        "an order confirmation with real line items, total, and delivery expectation",
      deconstruction:
        "the receipt collapses into the bag or brand token for the close",
      avoid:
        "placeholder product images, lorem prices, and a checkout that never reaches a confirmed state",
    },
  },
  {
    test: /\b(team|collab|collaboration|slack|inbox|email|message|crm|customer|support|ticket|task|kanban|workflow)\b/,
    profile: {
      id: "collaboration",
      label: "Collaboration / workflow product",
      surface:
        "a workflow surface: channel or pipeline rail, one active board or thread, and the record currently being acted on",
      palette:
        "calm product ground with one accent for the assigned, resolved, or live state and a quiet second value for presence",
      typography:
        "compact interface type with real names, timestamps, and statuses instead of gray bars",
      interaction:
        "move, assign, or resolve one real record while presence and status update as a consequence",
      proof:
        "the board or thread shows the state genuinely changed: resolved, assigned, shipped, or replied",
      deconstruction:
        "the board columns slide out in order, leaving the resolved record as the carrier",
      avoid:
        "avatar soup, notification confetti, and kanban columns of blank gray cards",
    },
  },
  {
    test: /\b(health|fitness|workout|medical|patient|wellness|sleep|nutrition|calorie)\b/,
    profile: {
      id: "health-fitness",
      label: "Health / fitness product",
      surface:
        "a personal tracking surface: today view, one dominant progress figure with its ring or trend, and the entry the user just logged",
      palette:
        "clean bright ground with one vital accent and a soft supporting value; no clinical gray voids",
      typography:
        "large tabular vitals with unit labels and quiet supporting copy",
      interaction:
        "log something real and watch the day's figure, ring, or streak resolve to its new value",
      proof:
        "the updated figure is framed by its goal and period so the change means something",
      deconstruction:
        "the progress ring unwinds into a single arc that becomes the closing mark",
      avoid:
        "generic rings with no unit, unreadable micro-labels, and fake heart-rate squiggles",
    },
  },
  {
    test: /\b(security|auth|infra|cloud|devops|monitoring|observability|network|compliance|privacy)\b/,
    profile: {
      id: "security-infra",
      label: "Security / infrastructure product",
      surface:
        "an operations surface: resource or service list, one live signal panel, and the incident or policy currently in focus",
      palette:
        "dark operations ground where the accent is strictly the alert, secure, or healthy state",
      typography:
        "dense tabular monitoring type with real identifiers, severities, and timestamps",
      interaction:
        "detect and resolve: a signal crosses a threshold, the operator acts, and the state returns to healthy",
      proof:
        "the timeline, severity, and resolved status make the outcome unambiguous",
      deconstruction:
        "the alert panel contracts into a single steady indicator that carries the close",
      avoid:
        "matrix rain, shield icons floating in space, and threat counters with no context",
    },
  },
  {
    test: /\b(learn|learning|course|education|student|school|training|lesson|quiz)\b/,
    profile: {
      id: "education",
      label: "Learning product",
      surface:
        "a lesson surface: course or module rail, the active lesson content, and one progress affordance that actually advances",
      palette:
        "friendly bright ground, one accent for progress and correctness, and clear separation between content and chrome",
      typography:
        "generous reading type for lesson content with a smaller confident UI scale",
      interaction:
        "answer, complete, or practice one step and let progress and feedback resolve immediately",
      proof:
        "the completed step, streak, or mastery state is visible and earned on screen",
      deconstruction:
        "the lesson card stack collapses into the progress bar, which becomes the closing mark",
      avoid:
        "confetti as the only proof and progress bars that jump with no cause",
    },
  },
];

export function selectProductProfile(userPrompt: string): ProductProfile {
  const prompt = userPrompt.toLowerCase();
  for (const rule of PROFILE_RULES) {
    if (rule.test.test(prompt)) return rule.profile;
  }
  return GENERIC_PROFILE;
}

export function buildProductIdentityBrief(userPrompt: string): string {
  const profile = selectProductProfile(userPrompt);
  if (selectFilmShape(userPrompt) !== "task") {
    const materials: Record<string, string> = {
      "generic-saas":
        "the real inputs and finished outputs named in the request",
      "ai-assistant":
        "a question, its supplied material, and a concrete answer or finished artifact",
      "notes-writing":
        "loose ideas, paper, ink strokes, notes and an organized finished document",
      "audio-voice":
        "a voice waveform, timed segments and the finished audio or transcript",
      "analytics-data":
        "labelled observations resolving into a legible pattern, with units and periods",
      "developer-tool":
        "code fragments, dependencies, a changed implementation and its working result",
      "design-creative":
        "words, images, shapes and the finished creative work they form",
      commerce:
        "the actual product, its materials, a choice and the delivered object",
      collaboration:
        "scattered messages, tasks and contributions converging into shared work",
      "health-fitness":
        "an activity, its progression and an observable personal result",
      "security-infra":
        "traffic or code passing through a scan, isolated threats and a clean result",
      education:
        "a question, worked steps and the learner's completed solution",
    };
    return [
      `Category: ${profile.label} (${profile.id}).`,
      `Visual material: ${materials[profile.id] ?? materials["generic-saas"]}.`,
      `Palette and material: ${profile.palette}.`,
      "Advertising direction: default to a bright neutral ground, ink-dark text and one brand accent unless supplied identity or the user specifies another theme.",
      "Typography: centered Inter 68px/700 editorial sentences; oversized entry settles into readable words. Product content stays readable at the delivered shot size.",
      "Product proof: transform the same input material into an output the viewer can judge. A close-up of a useful product detail is optional; navigation, sidebars, and an entire application shell are not required.",
      "Resolve: carry the finished object into a prominent mark and a short promise on open ground. Use supplied facts; do not invent success percentages, latency or ROI.",
    ].join("\n");
  }
  return [
    `Category: ${profile.label} (${profile.id}).`,
    `Surface to build: ${profile.surface}.`,
    `Palette and material: ${profile.palette}.`,
    `Type and chrome: ${profile.typography}.`,
    `Filmed interaction: ${profile.interaction}.`,
    `Causal proof: ${profile.proof}.`,
    `Deconstruction: ${profile.deconstruction}.`,
    `Never: ${profile.avoid}.`,
    "The Claude preset supplies the choreography floor only. Match its direction quality, never its brand, palette, or chrome.",
  ].join("\n");
}

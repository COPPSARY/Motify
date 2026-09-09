/**
 * Which kind of film a request is asking for, and which proven mechanics that
 * kind of film is built from.
 *
 * Retrieval used to run one fixed role table for every request: every
 * generation, including "logo sting for an energy drink" and "a pure kinetic
 * typography film, no interface at all", was handed a product-surface role
 * (always browser-device-stage), a progressive-construction role that builds an
 * interface, a UI interaction role, and a metric-card proof role. The prompt
 * then asked for one mechanic per role. So the retrieval itself specified a
 * product-UI film, and every generation came back as one no matter what the
 * user asked for — the roles outrank any prose about story or shape, because
 * they arrive as concrete named components with real source attached.
 *
 * The registry has a deep non-UI vocabulary (kinetic type, particle and facet
 * systems, atmosphere fields, wipes and match-cuts, brand stings, chart
 * mechanics). None of it was reachable. These shapes make it reachable.
 */

export type FilmShape =
  "hero-object" | "task" | "transformation" | "data" | "editorial";

export interface ReferenceRole {
  readonly role: string;
  readonly job: string;
  readonly candidates: readonly string[];
}

export interface FilmShapeDefinition {
  readonly shape: FilmShape;
  /** One line telling the model what this kind of film is, in the brief. */
  readonly premise: string;
  /** What the film must not become, named so the model can avoid it. */
  readonly guard: string;
  readonly roles: readonly ReferenceRole[];
}

const HERO_OBJECT: FilmShapeDefinition = {
  shape: "hero-object",
  premise:
    "A single subject — a mark, an icon, a device, a symbol, an artifact — is the star. The camera studies it while type states the argument around it.",
  guard:
    "Do not build an application interface. This film has a subject, not a screen.",
  roles: [
    {
      role: "focal-typography",
      job: "the editorial thought that opens or turns a beat",
      candidates: [
        "headline-slam",
        "kinetic-center-build",
        "per-word-rise",
        "titlecard-calm",
      ],
    },
    {
      role: "hero-subject",
      job: "the one object the whole film is about",
      candidates: [
        "facet-morph",
        "particle-image-reveal",
        "locked-nucleus-orbit",
        "device-frame-stage",
        "multi-device-splay",
        "svg-stroke-trace",
      ],
    },
    {
      role: "atmosphere",
      job: "the ground the subject sits in, with a job and a progression",
      candidates: [
        "light-sweep-pass",
        "grain-field",
        "aurora-drift",
        "beat-pulse-background",
      ],
    },
    {
      role: "camera",
      job: "the motivated push, rack, or pull that reframes the subject",
      candidates: [
        "push-in",
        "pull-back-reveal",
        "focus-rack",
        "parallax-device-dive",
      ],
    },
    {
      role: "continuity",
      job: "the carrier handoff at each scene boundary",
      candidates: ["match-cut", "cut-the-curve", "morph-swap", "whip-pan-cut"],
    },
    {
      role: "brand-close",
      job: "the mark plus at most four words that ends the film",
      candidates: [
        "logo-sting",
        "logo-brand-close",
        "wordmark-tiles",
        "cta-lockup",
      ],
    },
  ],
};

const TRANSFORMATION: FilmShapeDefinition = {
  shape: "transformation",
  premise:
    "A SaaS ad makes a before state physically become an after state. Alternate bold editorial statements, large product objects, a visible mechanism, and the finished result. Focused UI details may prove an action; the application shell is never the spine.",
  guard:
    "Do not show the same application shell in every beat with different copy. Use bright readable grounds unless the brand or request calls for dark. Change shot size and composition as the material changes. Finish on a prominent brand mark on open ground, not a small pill.",
  roles: [
    {
      role: "focal-typography",
      job: "the editorial thought that opens or turns a beat",
      candidates: [
        "kinetic-center-build",
        "per-word-rise",
        "headline-slam",
        "line-swap",
      ],
    },
    {
      role: "chaos-state",
      job: "the problem made physical and overwhelming on screen",
      candidates: [
        "overwhelm-surround",
        "notification-pileup",
        "scroll-feed",
        "particle-text-dissolve",
        "stagger-cascade",
      ],
    },
    {
      role: "resolution-state",
      job: "the same material resolving into order",
      candidates: [
        "radial-surround",
        "grid-card-assemble",
        "facet-morph",
        "morph-swap",
      ],
    },
    {
      role: "camera",
      job: "the motivated push, rack, or pull that reframes the change",
      candidates: ["pull-back-reveal", "push-in", "focus-rack", "pan-stations"],
    },
    {
      role: "continuity",
      job: "the carrier handoff at each scene boundary",
      candidates: ["morph-swap", "match-cut", "type-match-cut"],
    },
    {
      role: "brand-close",
      job: "the mark plus at most four words that ends the film",
      candidates: ["logo-brand-close", "logo-sting", "wordmark-tiles"],
    },
  ],
};

const EDITORIAL: FilmShapeDefinition = {
  shape: "editorial",
  premise:
    "Type and colour carry the entire argument. Words are the subject; the product appears only at the resolve, if at all.",
  guard:
    "Do not invent an interface to fill the frame. Empty ground and one line of type is the correct composition here.",
  roles: [
    {
      role: "focal-typography",
      job: "the editorial thought that opens or turns a beat",
      candidates: [
        "kinetic-center-build",
        "headline-slam",
        "char-slam-explode",
        "variable-font-flex",
        "per-word-rise",
      ],
    },
    {
      role: "type-emphasis",
      job: "the one word per statement that carries the accent",
      candidates: [
        "vox-annotate",
        "marker-highlight",
        "text-shimmer",
        "ticker-takeover",
        "scramble-reveal",
      ],
    },
    {
      role: "atmosphere",
      job: "the ground the words sit in, with a job and a progression",
      candidates: [
        "grain-field",
        "light-sweep-pass",
        "aurora-drift",
        "beat-pulse-background",
      ],
    },
    {
      role: "camera",
      job: "the motivated push or pull that reframes the statement",
      candidates: ["push-in", "pull-back-reveal", "drift-hold"],
    },
    {
      role: "continuity",
      job: "the carrier handoff at each scene boundary",
      candidates: [
        "type-match-cut",
        "cut-the-curve",
        "whip-pan-cut",
        "line-swap",
      ],
    },
    {
      role: "brand-close",
      job: "the mark plus at most four words that ends the film",
      candidates: ["logo-brand-close", "titlecard-lockup", "cta-close"],
    },
  ],
};

const DATA: FilmShapeDefinition = {
  shape: "data",
  premise:
    "Real numbers are the subject. Charts, counters, and rankings are built and read on screen with axes, units, and periods.",
  guard:
    "Do not draw unlabelled sparklines or KPI tiles. Every number carries a unit and a period, or it does not appear.",
  roles: [
    {
      role: "focal-typography",
      job: "the editorial thought that frames the number",
      candidates: ["kinetic-center-build", "headline-slam", "titlecard-calm"],
    },
    {
      role: "data-mechanic",
      job: "the chart or counter that is the subject of the beat",
      candidates: [
        "chart-story",
        "animated-bar-chart",
        "decline-chart",
        "conic-progress-ring",
        "count-up",
        "number-wheel",
      ],
    },
    {
      role: "supporting-proof",
      job: "the secondary evidence that corroborates the number",
      candidates: [
        "star-rating-fill",
        "logo-wall",
        "telemetry-hud",
        "social-proof-card",
      ],
    },
    {
      role: "camera",
      job: "the motivated push or pull that reframes the figure",
      candidates: ["pull-back-reveal", "push-in", "focus-rack"],
    },
    {
      role: "continuity",
      job: "the carrier handoff at each scene boundary",
      candidates: ["match-cut", "morph-swap", "iris-reveal"],
    },
    {
      role: "brand-close",
      job: "the mark plus at most four words that ends the film",
      candidates: ["logo-brand-close", "cta-lockup"],
    },
  ],
};

/**
 * The product-demo shape. This is the only one that should build an application
 * surface, and it is reached only when the request actually asks to see the
 * interface.
 */
const TASK: FilmShapeDefinition = {
  shape: "task",
  premise:
    "Two genuinely different real tasks are performed in the product, each from an input the viewer understands to an output they can judge.",
  guard:
    "Show only the region doing the work at any moment. Repeating the whole shell in every beat with different copy is one scene, not five.",
  roles: [
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
      job: "the application surface that carries the proof",
      candidates: [
        "browser-device-stage",
        "code-terminal-run",
        "notes-typing",
        "chat-thread",
        "device-frame-stage",
        "vector-editor-rig",
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
        "toggle-flip",
        "input-feedback",
        "settings-toggle-flow",
      ],
    },
    {
      role: "camera",
      job: "the motivated push, track, or pull that changes the composition",
      candidates: [
        "ui-focus-zoom",
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
        "zoom-through-transition",
        "modal-morph",
        "type-match-cut",
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
        "telemetry-hud",
        "number-wheel",
      ],
    },
    {
      role: "brand-close",
      job: "the mark plus at most four words that ends the film",
      candidates: [
        "logo-brand-close",
        "cta-close",
        "cta-lockup",
        "wordmark-tiles",
      ],
    },
  ],
};

export const FILM_SHAPES: Readonly<Record<FilmShape, FilmShapeDefinition>> = {
  "hero-object": HERO_OBJECT,
  task: TASK,
  transformation: TRANSFORMATION,
  data: DATA,
  editorial: EDITORIAL,
};

/**
 * Signals per shape, strongest first. `task` sits last on purpose: it used to be
 * the unconditional default, and defaulting to it is what produced a dashboard
 * for every request. It now has to be asked for.
 */
const SHAPE_SIGNALS: ReadonlyArray<readonly [FilmShape, RegExp]> = [
  [
    "editorial",
    /\b(?:kinetic typography|typography film|manifesto|text only|type[- ]led|copy[- ]led|poem|quote|statement film|words only)\b/i,
  ],
  [
    "hero-object",
    /\b(?:brand identity|logo sting|logo animation|wordmark animation|brand teaser|brand film|unbox|product shot|hero shot|packaging)\b|^(?:a\s+)?(?:logo|wordmark|icon)\b/i,
  ],
  [
    "data",
    /\b(?:animate (?:a |the )?(?:chart|graph)|chart animation|data story|benchmark results|growth numbers|market share|survey results|data ?viz|data visualization)\b/i,
  ],
  [
    "task",
    /\b(?:walkthrough|walk through|product tour|feature tour|demo the|show the (?:app|chat interface|interface|ui|screen|dashboard)|onboarding flow|screen recording|click through|user flow|browser ui|app ui|product ui|typed prompt|chatting|conversation with|talking to|talks to|messaging app demo)\b/i,
  ],
  [
    "transformation",
    /\b(?:overwhelm|overwhelming|chaos|chaotic|messy|scattered|cluttered|buried|drowning|before and after|turns? .{0,40}into|from .{0,30} to |organi[sz]e|declutter|simplif|consolidat|make sense of|sort|untangle)\b/i,
  ],
];

/**
 * The shape a request is asking for.
 *
 * A named product with a problem and a promise is a transformation film, which
 * is what most SaaS advertising actually is; showing the interface is a
 * deliberate choice a request has to make, not the fallback.
 */
export function selectFilmShape(userPrompt: string): FilmShape {
  // A restriction on UI does not turn an object-led ad into typography only.
  const excludesUi =
    /\b(?:no (?:interface|ui)|without (?:an? |the )?(?:interface|ui)|do not show (?:the )?(?:interface|ui))\b/i.test(
      userPrompt,
    );
  for (const [shape, signal] of SHAPE_SIGNALS) {
    if (shape === "task" && excludesUi) continue;
    if (signal.test(userPrompt)) return shape;
  }
  return "transformation";
}

export function filmShapeDefinition(userPrompt: string): FilmShapeDefinition {
  return FILM_SHAPES[selectFilmShape(userPrompt)];
}

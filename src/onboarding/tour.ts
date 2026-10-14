/**
 * The first-run tour new accounts get after the site's /welcome. The site
 * hands over `tour=1` (plus level, goal and brand name) in the URL; nothing is
 * stored server-side. The tour lives in sessionStorage only so a reload
 * resumes it instead of losing it.
 */
export type TourLevel = "beginner" | "experienced" | "expert";

/** Where a step points: a `data-tour` attribute value in the app. */
export type TourTarget =
  "tiffy" | "prompt" | "attach" | "format" | "export" | "home";

export interface TourStep {
  readonly target: TourTarget;
  readonly title: string;
  readonly body: string;
}

export interface TourHandoff {
  readonly level: TourLevel;
  readonly goal: string;
  readonly brandName: string;
}

export interface TourState extends TourHandoff {
  readonly index: number;
}

const STORAGE_KEY = "motify_tour";

const LEVELS: readonly TourLevel[] = ["beginner", "experienced", "expert"];

/**
 * The tour runs in the video view while Tiffy builds the first video: the
 * wait is when there is time to look around.
 */
const STEPS: Readonly<Record<TourTarget, TourStep>> = {
  tiffy: {
    target: "tiffy",
    title: "Tiffy is on it",
    body: "Your first video is being built. Watch it come together here.",
  },
  prompt: {
    target: "prompt",
    title: "Ask for changes",
    body: "Type what to change, like \u201cmake the hook punchier\u201d. No editing needed.",
  },
  attach: {
    target: "attach",
    title: "Add your media",
    body: "Attach a logo, a screenshot, or a song from your music library.",
  },
  format: {
    target: "format",
    title: "Any format",
    body: "Switch between widescreen, square, and vertical.",
  },
  export: {
    target: "export",
    title: "Export",
    body: "Download your video when it\u2019s ready.",
  },
  home: {
    target: "home",
    title: "Home",
    body: "Templates, Music, and your Brand Kit are on the home screen.",
  },
};

/** Beginners get the whole map; experienced prompters just the essentials; experts get no tour. */
export function stepsFor(level: TourLevel): readonly TourStep[] {
  switch (level) {
    case "beginner":
      return [
        STEPS.tiffy,
        STEPS.prompt,
        STEPS.attach,
        STEPS.format,
        STEPS.export,
        STEPS.home,
      ];
    case "experienced":
      return [STEPS.prompt, STEPS.attach, STEPS.export];
    case "expert":
      return [];
  }
}

/** Reads the site's hand-off. Null unless `tour=1`; an unknown level falls back to beginner. */
export function readHandoff(params: URLSearchParams): TourHandoff | null {
  if (params.get("tour") !== "1") return null;
  const level = params.get("level");
  return {
    level: LEVELS.includes(level as TourLevel)
      ? (level as TourLevel)
      : "beginner",
    goal: params.get("goal")?.trim() ?? "",
    brandName: params.get("brandName")?.trim() ?? "",
  };
}

/** The query keys the hand-off uses, so the app can strip them from the address bar. */
export const HANDOFF_PARAMS = [
  "tour",
  "level",
  "goal",
  "brandName",
  "brandUrl",
] as const;

export function saveTour(storage: Storage, state: TourState): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: the tour still runs, it just won't survive a reload.
  }
}

export function loadTour(storage: Storage): TourState | null {
  try {
    const parsed = JSON.parse(
      storage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<TourState> | null;
    if (
      !parsed ||
      !LEVELS.includes(parsed.level as TourLevel) ||
      typeof parsed.index !== "number"
    )
      return null;
    return {
      level: parsed.level as TourLevel,
      goal: typeof parsed.goal === "string" ? parsed.goal : "",
      brandName: typeof parsed.brandName === "string" ? parsed.brandName : "",
      index: Math.max(0, Math.floor(parsed.index)),
    };
  } catch {
    return null;
  }
}

export function clearTour(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Where the tour stands when the app opens: a fresh hand-off starts at step
 * one and replaces any older tour; otherwise a tour already in progress
 * resumes. Experts, and a finished tour, give null.
 */
export function startingTour(
  params: URLSearchParams,
  storage: Storage,
): TourState | null {
  const handoff = readHandoff(params);
  const state = handoff ? { ...handoff, index: 0 } : loadTour(storage);
  if (!state || state.index >= stepsFor(state.level).length) {
    clearTour(storage);
    return null;
  }
  saveTour(storage, state);
  return state;
}

/**
 * Onboarding lives on the site's /welcome. A sign-up that started in the app
 * (flagged by the API with `newAccount`) is sent there first, keeping any
 * prompt they had typed; /welcome then hands them back with the tour.
 */
export function isNewAccountLanding(params: URLSearchParams): boolean {
  return params.get("newAccount") === "1";
}

export function welcomeUrl(pendingPrompt: string, siteUrl: string): string {
  const prompt = pendingPrompt.trim();
  const returnUrl = prompt
    ? `/editor?prompt=${encodeURIComponent(prompt)}`
    : "/editor";
  return `${siteUrl.replace(/\/+$/, "")}/welcome?returnUrl=${encodeURIComponent(returnUrl)}`;
}

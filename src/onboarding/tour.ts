/**
 * The first-run tour for new accounts. A new account lands on Brand DNA, moves
 * on to Prompt Templates, and is then walked through the editor one control at
 * a time. How far they got is kept on the account (`/v1/onboarding`), so a
 * reload or another device resumes where they left off and a finished or
 * skipped tour never comes back.
 */

/** Where a step points: a `data-tour` attribute value in the app. */
export type TourTarget =
  | "nav-prompts"
  | "prompts-grid"
  | "prompts-copy"
  | "prompt"
  | "attach"
  | "aspect"
  | "effort"
  | "brand"
  | "nav-music"
  | "nav-assets"
  | "nav-storyboard";

/** The page a step needs on screen before its target can be found. */
export type TourPage = "templates" | "create";

export interface TourStep {
  /** Stored as the account's onboarding step. */
  readonly id: string;
  readonly target: TourTarget;
  readonly page: TourPage;
  readonly title: string;
  readonly body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "templates",
    target: "prompts-grid",
    page: "templates",
    title: "Pick a template",
    body: "Filter by category, then click one to see its prompt.",
  },
  {
    id: "copy",
    target: "prompts-copy",
    page: "templates",
    title: "Copy the prompt",
    body: "Edit it to fit your idea and add references for better results.",
  },
  {
    id: "prompt",
    target: "prompt",
    page: "create",
    title: "Prompt here",
    body: "Paste a prompt or describe your video. Tiffy builds it.",
  },
  {
    id: "attach",
    target: "attach",
    page: "create",
    title: "Add references",
    body: "Attach a logo, screenshot, or song.",
  },
  {
    id: "aspect",
    target: "aspect",
    page: "create",
    title: "Pick a format",
    body: "Widescreen, square, or vertical.",
  },
  {
    id: "effort",
    target: "effort",
    page: "create",
    title: "Reasoning effort",
    body: "Higher effort is slower and better for complex videos.",
  },
  {
    id: "brand-chip",
    target: "brand",
    page: "create",
    title: "Brand DNA",
    body: "Tiffy uses your brand in every video. Switch or turn it off here.",
  },
  {
    id: "music",
    target: "nav-music",
    page: "create",
    title: "Music",
    body: "Pick a song and Tiffy scores your video to it.",
  },
  {
    id: "assets",
    target: "nav-assets",
    page: "create",
    title: "Assets",
    body: "Your images and logos, ready for any video.",
  },
  {
    id: "storyboard",
    target: "nav-storyboard",
    page: "create",
    title: "Storyboard",
    body: "Plan a video scene by scene before generating. That’s the tour. Enjoy.",
  },
];

/** Where the tour resumes for an account's saved progress; null when there is nothing to show. */
export function resumeIndex(progress: {
  step: string | null;
  completedAt: string | null;
}): number | null {
  if (progress.completedAt !== null || progress.step === null) return null;
  const index = TOUR_STEPS.findIndex((step) => step.id === progress.step);
  // "prompts" (arrived, tour not started) and "brand" are both before the first step.
  return index === -1 ? 0 : index;
}

/** The API flags a sign-up with `newAccount=1` on the way back to the app. */
export function isNewAccountLanding(params: URLSearchParams): boolean {
  return params.get("newAccount") === "1";
}

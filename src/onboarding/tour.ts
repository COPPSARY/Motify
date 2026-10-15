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
export type TourPage = "prompts" | "create";

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
    page: "prompts",
    title: "Start from a template",
    body: "There’s a variety to choose from, and the filters narrow it down. Click a template to see the prompt behind it.",
  },
  {
    id: "copy",
    target: "prompts-copy",
    page: "prompts",
    title: "Copy it, make it yours",
    body: "Copy the prompt, change it to fit your own idea, and add references like a logo or screenshot for a better result.",
  },
  {
    id: "prompt",
    target: "prompt",
    page: "create",
    title: "This is where you prompt",
    body: "Paste your prompt here, or just describe the video you want. Tiffy builds it and you keep asking for changes.",
  },
  {
    id: "attach",
    target: "attach",
    page: "create",
    title: "Add references",
    body: "Attach a logo, a screenshot, or a song from your music library. References make the result closer to what you picture.",
  },
  {
    id: "aspect",
    target: "aspect",
    page: "create",
    title: "Pick a format",
    body: "Widescreen, square, or vertical. Choose the canvas before Tiffy starts.",
  },
  {
    id: "effort",
    target: "effort",
    page: "create",
    title: "How hard Tiffy thinks",
    body: "Higher reasoning effort takes longer and suits complex videos. Medium is a good default.",
  },
  {
    id: "brand-chip",
    target: "brand",
    page: "create",
    title: "Your Brand DNA",
    body: "Tiffy uses your brand’s colours, fonts and voice in every video. Switch brands or turn it off here.",
  },
  {
    id: "music",
    target: "nav-music",
    page: "create",
    title: "Music",
    body: "Browse the library or upload a song, and Tiffy scores your next video to it.",
  },
  {
    id: "assets",
    target: "nav-assets",
    page: "create",
    title: "Assets",
    body: "Your images and logos live here, ready to drop into any video.",
  },
  {
    id: "storyboard",
    target: "nav-storyboard",
    page: "create",
    title: "Storyboard",
    body: "Plan a video scene by scene before you generate it. That’s the tour. The editor is yours.",
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

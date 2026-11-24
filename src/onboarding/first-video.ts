import type { OnboardingFormat, OnboardingProfile } from "../api/onboarding";

/** Where an account stands in the first-run flow, stored as its onboarding step. */
export const FIRST_RUN_STEPS = {
  /** Answering the welcome questions. */
  welcome: "welcome",
  /** Answers saved; the first video has not finished yet. */
  firstVideo: "first-video",
  /** The first video is ready; the celebration and plan offer come next. */
  firstVideoDone: "first-video-done",
} as const;

export interface FormatChoice {
  readonly id: OnboardingFormat;
  readonly label: string;
  readonly hint: string;
}

export const FORMAT_CHOICES: readonly FormatChoice[] = [
  { id: "9:16", label: "Vertical", hint: "TikTok, Reels, Stories" },
  { id: "1:1", label: "Square", hint: "Feed posts" },
  { id: "16:9", label: "Landscape", hint: "YouTube, your website" },
  { id: "4:5", label: "Portrait", hint: "Instagram feed" },
];

export const DEFAULT_FORMAT: OnboardingFormat = "9:16";

/** The most interests a person can pick, matching the server. */
export const MAX_INTERESTS = 3;

export interface WelcomeAnswers {
  interests: string[];
  format: OnboardingFormat;
  businessName: string;
}

/** The first video's starting prompt: the landing-page one when they brought it, else built from their answers. */
export function firstVideoPrompt(
  answers: WelcomeAnswers,
  heldPrompt = "",
): string {
  const held = heldPrompt.trim();
  if (held) return held;
  const interests = answers.interests
    .map((name) => name.trim())
    .filter(Boolean);
  const what =
    interests.length === 0
      ? "a short promo video"
      : interests.length === 1
        ? `a short ${interests[0]!.toLowerCase()} video`
        : `a short video that mixes ${interests
            .slice(0, -1)
            .map((name) => name.toLowerCase())
            .join(", ")} and ${interests.at(-1)!.toLowerCase()}`;
  const business = answers.businessName.trim();
  return business
    ? `Make ${what} for ${business}. Keep it simple, bold and about 10 seconds long.`
    : `Make ${what}. Keep it simple, bold and about 10 seconds long.`;
}

/** What goes on the account: the answers, trimmed, with an empty business name left out. */
export function profileToSave(
  answers: WelcomeAnswers,
): Omit<OnboardingProfile, "planOfferShownAt"> {
  const business = answers.businessName.trim().slice(0, 80);
  return {
    interests: answers.interests.slice(0, MAX_INTERESTS),
    format: answers.format,
    ...(business ? { businessName: business } : {}),
  };
}

/** Whether the first video is the one being made: the account has answered the welcome questions and not yet seen it finish. */
export function awaitingFirstVideo(step: string | null): boolean {
  return step === FIRST_RUN_STEPS.firstVideo;
}

/**
 * Whether to show the plan offer after the first video: only once, and never to
 * someone already on a plan.
 */
export function planOfferDue(
  profile: OnboardingProfile,
  activePlan: string | null,
): boolean {
  return !profile.planOfferShownAt && !activePlan;
}

/** How many videos like the first one a monthly plan covers, rounded down to a figure that reads well. */
export function videosPerMonth(
  planCredits: number,
  creditsPerVideo: number,
): number {
  if (creditsPerVideo <= 0 || planCredits <= 0) return 0;
  const exact = Math.floor(planCredits / creditsPerVideo);
  return exact >= 20 ? Math.floor(exact / 5) * 5 : exact;
}

/** A typical video's cost in credits, used until the account's own first video is known. */
export const TYPICAL_VIDEO_CREDITS = 7;

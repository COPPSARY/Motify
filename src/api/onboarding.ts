import { fetchApi } from "./client";

export type OnboardingFormat = "16:9" | "9:16" | "1:1" | "4:5";

/** What they do, so the plan offer can speak to them. */
export type OnboardingRole =
  "marketer" | "editor" | "owner" | "creator" | "casual" | "other";

/** What the first video is. */
export type OnboardingGoal = "launch" | "showcase" | "feature" | "animation";

/** How many videos a month they expect to make, so a plan can be suggested after the first one. */
export type OnboardingMonthlyVideos = "1-5" | "6-15" | "16-40" | "40+";

export type OnboardingRating = "liked" | "not-quite";

/** What a new account told us, kept on the account so it follows them across devices. */
export interface OnboardingProfile {
  /** The kinds of video they usually make (up to three). */
  interests?: string[];
  role?: OnboardingRole;
  goal?: OnboardingGoal;
  monthlyVideos?: OnboardingMonthlyVideos;
  /** Whether they liked the first video. */
  firstVideoRating?: OnboardingRating;
  format?: OnboardingFormat;
  businessName?: string;
  /** Set by the server the first time the plan offer is shown; it is only ever shown once. */
  planOfferShownAt?: string;
}

/** How far a person got through the first-run flow, and what they told it. */
export interface OnboardingState {
  step: string | null;
  completedAt: string | null;
  profile: OnboardingProfile;
}

interface OnboardingPatch {
  step?: string;
  completed?: boolean;
  /** Clears progress so the tour runs again. The answers are kept. */
  reset?: boolean;
  /** Answers to merge into the saved profile. */
  profile?: Omit<OnboardingProfile, "planOfferShownAt">;
  /** Records that the plan offer was shown; the server stamps the time once. */
  planOfferShown?: true;
}

async function read(response: Response): Promise<OnboardingState> {
  const { data } = (await response.json()) as { data?: OnboardingState };
  if (!data || typeof data !== "object") {
    throw new Error("The onboarding response was not understood.");
  }
  return {
    step: data.step ?? null,
    completedAt: data.completedAt ?? null,
    profile:
      data.profile && typeof data.profile === "object" ? data.profile : {},
  };
}

export async function fetchOnboarding(): Promise<OnboardingState> {
  return read(await fetchApi("/v1/onboarding"));
}

export async function updateOnboarding(
  patch: OnboardingPatch,
): Promise<OnboardingState> {
  return read(
    await fetchApi("/v1/onboarding", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  );
}

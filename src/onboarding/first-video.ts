import type {
  OnboardingGoal,
  OnboardingMonthlyVideos,
  OnboardingProfile,
  OnboardingRole,
} from "../api/onboarding";
import type { BillingPlanOffer } from "../api/billing-plans";
import type { GuidedToolId } from "./guided-tools";

/** Where an account stands in the first-run flow, stored as its onboarding step. */
export const FIRST_RUN_STEPS = {
  /** Answering the welcome questions. */
  welcome: "welcome",
  /** Answers saved; the first video has not finished yet. */
  firstVideo: "first-video",
  /** The first video is ready; the review, a nudge to revise it, and the plan offer come next. */
  firstVideoDone: "first-video-done",
} as const;

export interface RoleChoice {
  readonly id: OnboardingRole;
  readonly label: string;
  readonly detail: string;
}

export const ROLE_CHOICES: readonly RoleChoice[] = [
  { id: "marketer", label: "Marketing", detail: "Campaigns and ads" },
  { id: "owner", label: "Business owner", detail: "I run my own business" },
  {
    id: "creator",
    label: "Content creator",
    detail: "Social media and channels",
  },
  { id: "editor", label: "Video editor", detail: "I make videos for others" },
  { id: "casual", label: "Just for fun", detail: "Personal projects" },
  { id: "other", label: "Something else", detail: "" },
];

export interface VolumeChoice {
  readonly id: OnboardingMonthlyVideos;
  readonly label: string;
  readonly detail: string;
  /** The most videos a month this answer means, used to size a plan. */
  readonly upTo: number;
}

export const VOLUME_CHOICES: readonly VolumeChoice[] = [
  { id: "1-5", label: "Casual", detail: "1 to 5 videos", upTo: 5 },
  { id: "6-15", label: "Regular", detail: "6 to 15 videos", upTo: 15 },
  { id: "16-40", label: "Serious", detail: "16 to 40 videos", upTo: 40 },
  { id: "40+", label: "Intense", detail: "40 or more", upTo: 50 },
];

export interface KindChoice {
  readonly id: string;
  readonly label: string;
}

/** The kinds of video people usually make; they pick up to three. */
export const KIND_CHOICES: readonly KindChoice[] = [
  { id: "ads", label: "Ads and promos" },
  { id: "social", label: "Social media posts" },
  { id: "demos", label: "App and feature demos" },
  { id: "explainers", label: "Explainers" },
  { id: "intros", label: "Logos and intros" },
  { id: "announce", label: "Announcements" },
  { id: "stories", label: "Stories and animation" },
];

export const MAX_KINDS = 3;

export interface GoalChoice {
  readonly id: OnboardingGoal;
  /** In plain words, for someone who has never made a video. */
  readonly label: string;
  /** What goes in and what comes out. */
  readonly detail: string;
  /** The guided tool that makes it: it asks for the pictures, then generates. */
  readonly tool: GuidedToolId;
  /** Template categories whose previews show what this looks like. */
  readonly categories: readonly string[];
}

export const GOAL_CHOICES: readonly GoalChoice[] = [
  {
    id: "launch",
    label: "Product launch",
    detail: "Photos to a launch film",
    tool: "product-launch",
    categories: ["Product"],
  },
  {
    id: "showcase",
    label: "Product showcase",
    detail: "Product shots to a quick promo",
    tool: "social-ad",
    categories: ["Marketing"],
  },
  {
    id: "feature",
    label: "Feature showcase",
    detail: "App screenshots to a walkthrough",
    tool: "product-walkthrough",
    categories: ["UI"],
  },
  {
    id: "animation",
    label: "Just animation",
    detail: "An idea to an animated short",
    tool: "story",
    categories: ["Storytelling", "Character"],
  },
];

export interface WelcomeAnswers {
  role: OnboardingRole | null;
  monthlyVideos: OnboardingMonthlyVideos | null;
  /** The kinds of video they usually make. */
  interests: string[];
  /** What the first video is. */
  goal: OnboardingGoal;
}

export function goalById(id: string | undefined): GoalChoice | undefined {
  return GOAL_CHOICES.find((goal) => goal.id === id);
}

/** What goes on the account: the answers, with anything left blank left out. */
export function profileToSave(
  answers: WelcomeAnswers,
): Omit<OnboardingProfile, "planOfferShownAt"> {
  return {
    interests: answers.interests.slice(0, MAX_KINDS),
    goal: answers.goal,
    ...(answers.role ? { role: answers.role } : {}),
    ...(answers.monthlyVideos ? { monthlyVideos: answers.monthlyVideos } : {}),
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

/**
 * The cheapest plan that covers the videos a month they said they would make,
 * or the biggest one when none does. Null when they did not say or no plan is on sale.
 */
export function recommendPlan(
  plans: readonly BillingPlanOffer[],
  monthlyVideos: OnboardingMonthlyVideos | undefined,
  creditsPerVideo: number,
): BillingPlanOffer | null {
  const volume = VOLUME_CHOICES.find((choice) => choice.id === monthlyVideos);
  if (!volume || plans.length === 0 || creditsPerVideo <= 0) return null;
  const needed = volume.upTo * creditsPerVideo;
  const sorted = [...plans].sort((a, b) => a.price - b.price);
  return sorted.find((plan) => plan.credits >= needed) ?? sorted.at(-1) ?? null;
}

/** Things to ask Tiffy to change, offered after the first video so they see revising is just a chat. */
export const REVISION_IDEAS: readonly string[] = [
  "Make the title bigger",
  "Change the colors",
  "Make it shorter",
  "Add more energy",
];

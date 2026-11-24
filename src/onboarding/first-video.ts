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
  /** Template categories to take an example from when it is hovered. */
  readonly categories: readonly string[];
  /** The first-video categories that suit someone who usually makes this, best fit first. */
  readonly goals: readonly OnboardingGoal[];
}

/** The kinds of video people usually make; they pick up to three. */
export const KIND_CHOICES: readonly KindChoice[] = [
  {
    id: "ads",
    label: "Ads and promos",
    categories: ["Marketing", "Product"],
    goals: ["showcase", "launch"],
  },
  {
    id: "social",
    label: "Social media posts",
    categories: ["Kinetic type", "Marketing"],
    goals: ["showcase", "launch"],
  },
  {
    id: "demos",
    label: "App and feature demos",
    categories: ["UI", "Product"],
    goals: ["feature", "launch"],
  },
  {
    id: "explainers",
    label: "Explainers",
    categories: ["Explainer"],
    goals: ["feature", "animation"],
  },
  {
    id: "intros",
    label: "Logos and intros",
    categories: ["Design", "Typography", "Showreel"],
    goals: ["animation", "launch"],
  },
  {
    id: "announce",
    label: "Announcements",
    categories: ["Kinetic type", "Typography"],
    goals: ["launch", "showcase"],
  },
  {
    id: "stories",
    label: "Stories and animation",
    categories: ["Storytelling", "Character", "2D"],
    goals: ["animation"],
  },
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

/**
 * The first-video categories worth offering someone, from the kinds of video
 * they said they usually make: the ones those kinds point to, most common
 * first, never fewer than two. Everything when they picked none.
 */
export function goalsForKinds(kindIds: readonly string[]): GoalChoice[] {
  const picked = KIND_CHOICES.filter((kind) => kindIds.includes(kind.id));
  if (picked.length === 0) return [...GOAL_CHOICES];
  const score = new Map<OnboardingGoal, number>();
  for (const kind of picked) {
    kind.goals.forEach((goal, index) => {
      // The first goal of a kind counts for more than its second.
      score.set(goal, (score.get(goal) ?? 0) + (index === 0 ? 2 : 1));
    });
  }
  const chosen = GOAL_CHOICES.filter((goal) => score.has(goal.id)).sort(
    (a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0),
  );
  for (const goal of GOAL_CHOICES) {
    if (chosen.length >= 2) break;
    if (!chosen.includes(goal)) chosen.push(goal);
  }
  return chosen;
}

/** Every template category the picked kinds draw on, to prefer matching examples. */
export function categoriesForKinds(kindIds: readonly string[]): string[] {
  const names = new Set<string>();
  for (const kind of KIND_CHOICES) {
    if (kindIds.includes(kind.id))
      kind.categories.forEach((name) => names.add(name));
  }
  return [...names];
}

/** The parts of a prompt template the examples need. */
export interface ExampleTemplate {
  readonly slug: string;
  readonly title: string;
  readonly video: string | null;
  readonly categories: readonly string[];
}

/**
 * A preview for each category shown, taken from a template of that category and,
 * among those, the one closest to what they usually make; no two share one.
 */
export function pickGoalPreviews(
  templates: readonly ExampleTemplate[],
  goals: readonly GoalChoice[],
  preferred: readonly string[],
): Partial<Record<OnboardingGoal, string>> {
  const used = new Set<string>();
  const found: Partial<Record<OnboardingGoal, string>> = {};
  for (const goal of goals) {
    const closeness = (template: ExampleTemplate) =>
      template.categories.filter((name) => preferred.includes(name)).length;
    const match = templates
      .filter(
        (template) =>
          template.video &&
          !used.has(template.slug) &&
          template.categories.some((name) => goal.categories.includes(name)),
      )
      .sort((a, b) => closeness(b) - closeness(a))[0];
    if (match?.video) {
      used.add(match.slug);
      found[goal.id] = match.video;
    }
  }
  return found;
}

/** An example for each kind of video, with a different template for each. */
export function pickKindExamples(
  templates: readonly ExampleTemplate[],
): Record<string, { video: string; title: string }> {
  const taken = new Set<string>();
  const examples: Record<string, { video: string; title: string }> = {};
  for (const kind of KIND_CHOICES) {
    const match = templates.find(
      (template) =>
        template.video &&
        !taken.has(template.slug) &&
        template.categories.some((name) => kind.categories.includes(name)),
    );
    if (match?.video) {
      taken.add(match.slug);
      examples[kind.id] = { video: match.video, title: match.title };
    }
  }
  return examples;
}

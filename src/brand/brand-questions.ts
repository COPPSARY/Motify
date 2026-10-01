import type { BrandAsset, BrandDna } from "../cloud/brand-dna";

/**
 * The Brand DNA onboarding as Tiffy asks it: one question per field, in the
 * order a person would naturally tell someone about their brand. Each question
 * knows how to phrase itself for the brand so far, whether it has been
 * answered, and how Tiffy reacts once it has.
 */

export type AnswerKind =
  | "text"
  | "url"
  | "textarea"
  | "logo"
  | "colors"
  | "fonts"
  | "features"
  | "tone"
  | "files";

export type QuestionId =
  | "name"
  | "website"
  | "tagline"
  | "logo"
  | "colors"
  | "fonts"
  | "description"
  | "audience"
  | "features"
  | "problem"
  | "solution"
  | "differentiators"
  | "proof"
  | "tone"
  | "writingStyle"
  | "files";

export type SectionId =
  "basics" | "look" | "product" | "story" | "voice" | "files";

export interface BrandQuestion {
  id: QuestionId;
  section: SectionId;
  /** Short name for the review page. */
  label: string;
  kind: AnswerKind;
  /** Only the name is required; everything else can wait. */
  optional: boolean;
  ask: (brand: string) => string;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  answered: (dna: BrandDna, assets: readonly BrandAsset[]) => boolean;
  react: (dna: BrandDna) => string;
}

export const SECTIONS: Record<SectionId, string> = {
  basics: "Basics",
  look: "Look",
  product: "Product",
  story: "Story",
  voice: "Voice",
  files: "Files",
};

const has = (value: string) => value.trim().length > 0;
const you = (brand: string) => brand || "your brand";

export const QUESTIONS: readonly BrandQuestion[] = [
  {
    id: "name",
    section: "basics",
    label: "Brand name",
    kind: "text",
    optional: false,
    ask: () => "First things first: what's your brand called?",
    placeholder: "Acme",
    maxLength: 80,
    answered: (dna) => has(dna.identity.name),
    react: (dna) => `Nice to meet you, ${dna.identity.name}.`,
  },
  {
    id: "website",
    section: "basics",
    label: "Website",
    kind: "url",
    optional: true,
    ask: (brand) => `Where does ${you(brand)} live online?`,
    hint: "Soon I'll read your site and fill in the rest myself.",
    placeholder: "acme.com",
    maxLength: 500,
    answered: (dna) => has(dna.identity.websiteUrl),
    react: () => "Got it.",
  },
  {
    id: "tagline",
    section: "basics",
    label: "Tagline",
    kind: "text",
    optional: true,
    ask: () => "Got a one-liner you'd put under your logo?",
    placeholder: "Invoices that chase themselves.",
    maxLength: 140,
    answered: (dna) => has(dna.identity.tagline),
    react: () => "That's a good line.",
  },
  {
    id: "logo",
    section: "basics",
    label: "Logo",
    kind: "logo",
    optional: true,
    ask: (brand) => `Can you drop in ${brand ? `${brand}'s` : "your"} logo?`,
    hint: "An SVG or a transparent PNG works best. A favicon is a nice extra.",
    answered: (_dna, assets) => assets.some((asset) => asset.role === "logo"),
    react: () => "Looks sharp.",
  },
  {
    id: "colors",
    section: "look",
    label: "Colours",
    kind: "colors",
    optional: true,
    ask: (brand) => `What colours are ${you(brand)}?`,
    hint: "Add a swatch and click it to pick. Tell me which one is your primary.",
    answered: (dna) => dna.visual.colors.length > 0,
    react: () => "Great palette.",
  },
  {
    id: "fonts",
    section: "look",
    label: "Typefaces",
    kind: "fonts",
    optional: true,
    ask: () => "Which typefaces do you use?",
    hint: "Pick one I already have, or drop your own font files.",
    answered: (dna) => dna.visual.fonts.length > 0,
    react: () => "Nice type.",
  },
  {
    id: "description",
    section: "product",
    label: "What it is",
    kind: "textarea",
    optional: true,
    ask: (brand) => `In a sentence or two, what does ${you(brand)} do?`,
    placeholder:
      "Acme sends invoices, chases late payments and reconciles them with your bank.",
    maxLength: 2000,
    answered: (dna) => has(dna.product.description),
    react: () => "Makes sense.",
  },
  {
    id: "audience",
    section: "product",
    label: "Who it's for",
    kind: "textarea",
    optional: true,
    ask: () => "Who's it for?",
    placeholder:
      "Independent designers and small studios who bill by the project.",
    maxLength: 600,
    answered: (dna) => has(dna.product.targetAudience),
    react: () => "Good to know who we're talking to.",
  },
  {
    id: "features",
    section: "product",
    label: "Main features",
    kind: "features",
    optional: true,
    ask: () => "Which features should the films show off?",
    hint: "The ones worth putting on screen. Three or four is plenty.",
    answered: (dna) =>
      dna.product.features.some((feature) => has(feature.title)),
    react: () => "Those will look great on screen.",
  },
  {
    id: "problem",
    section: "story",
    label: "The problem",
    kind: "textarea",
    optional: true,
    ask: (brand) => `What problem does ${you(brand)} solve?`,
    placeholder: "Freelancers lose hours every month chasing late invoices.",
    maxLength: 1000,
    answered: (dna) => has(dna.story.problem),
    react: () => "Ouch. We can fix that.",
  },
  {
    id: "solution",
    section: "story",
    label: "Your solution",
    kind: "textarea",
    optional: true,
    ask: () => "And how do you fix it?",
    maxLength: 1000,
    answered: (dna) => has(dna.story.solution),
    react: () => "Clear.",
  },
  {
    id: "differentiators",
    section: "story",
    label: "Why you",
    kind: "textarea",
    optional: true,
    ask: () => "Why you, and not the others?",
    maxLength: 1000,
    answered: (dna) => has(dna.story.differentiators),
    react: () => "That's the bit people remember.",
  },
  {
    id: "proof",
    section: "story",
    label: "Proof",
    kind: "textarea",
    optional: true,
    ask: () => "Any numbers or quotes you're proud of?",
    hint: "I'll only ever quote what you write here, never invented stats.",
    placeholder: "Trusted by 4,000 studios. “Paid 11 days faster.”",
    maxLength: 1000,
    answered: (dna) => has(dna.story.proof),
    react: () => "Love that.",
  },
  {
    id: "tone",
    section: "voice",
    label: "Tone",
    kind: "tone",
    optional: true,
    ask: (brand) => `How should ${you(brand)} sound?`,
    hint: "Pick a few, or add your own words.",
    answered: (dna) => dna.voice.tone.length > 0,
    react: (dna) => `${dna.voice.tone.slice(0, 2).join(" and ")}. Got it.`,
  },
  {
    id: "writingStyle",
    section: "voice",
    label: "Writing style",
    kind: "textarea",
    optional: true,
    ask: () => "Any rules for how you write?",
    placeholder: "Short sentences. Sentence case. No exclamation marks.",
    maxLength: 1000,
    answered: (dna) => has(dna.voice.writingStyle),
    react: () => "I'll stick to that.",
  },
  {
    id: "files",
    section: "files",
    label: "Screenshots & images",
    kind: "files",
    optional: true,
    ask: () => "Last one: drop in screenshots or product images I can use.",
    hint: "Real screens make the best films.",
    answered: (_dna, assets) =>
      assets.some((asset) =>
        ["screenshot", "image", "logo_variant", "icon"].includes(asset.role),
      ),
    react: () => "Perfect.",
  },
];

export const SKIPPED_REACTIONS = [
  "No problem, we can come back to that.",
  "Let's skip it for now.",
  "Fine, it can wait.",
];

export function firstUnanswered(
  dna: BrandDna,
  assets: readonly BrandAsset[],
): number {
  const index = QUESTIONS.findIndex(
    (question) => !question.answered(dna, assets),
  );
  return index;
}

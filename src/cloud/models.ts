import claudeLogo from "../ui/cloud/model-logos/claude.svg?url";
import geminiLogo from "../ui/cloud/model-logos/gemini.svg?url";
import openAiLogo from "../ui/cloud/model-logos/openai.svg?url";

/**
 * The models people can pick, named for what they are. The backend keeps the
 * same list (packages/ai/agent/model-choices.ts) and decides who may run each.
 */
export type GenerationModel =
  "sonnet-5.5" | "opus-5.5" | "gpt-6.1-sol" | "gemini-4-argon";

export interface ModelOption {
  value: GenerationModel;
  /** The model's full name, as its maker writes it. */
  name: string;
  /** Short enough for the composer's button. */
  short: string;
  provider: "Anthropic" | "OpenAI" | "Google";
  logo: string;
  /** A premium model: needs a paid plan. */
  paid: boolean;
}

/** The free plan's model; every plan has it. */
export const FREE_MODEL: GenerationModel = "sonnet-5.5";

export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    value: "sonnet-5.5",
    name: "Claude Sonnet 5.5",
    short: "Sonnet 5.5",
    provider: "Anthropic",
    logo: claudeLogo,
    paid: false,
  },
  {
    value: "opus-5.5",
    name: "Claude Opus 5.5",
    short: "Opus 5.5",
    provider: "Anthropic",
    logo: claudeLogo,
    paid: true,
  },
  {
    value: "gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    short: "GPT-6.1 Sol",
    provider: "OpenAI",
    logo: openAiLogo,
    paid: true,
  },
  {
    value: "gemini-4-argon",
    name: "Gemini 4 Argon",
    short: "Gemini 4 Argon",
    provider: "Google",
    logo: geminiLogo,
    paid: true,
  },
];

export function modelOption(value: GenerationModel): ModelOption {
  const found = MODEL_OPTIONS.find((option) => option.value === value);
  if (found) return found;
  return MODEL_OPTIONS.find(
    (option) => option.value === FREE_MODEL,
  ) as ModelOption;
}

/** Where the editor keeps a subscriber's pick between visits. */
export const PICKED_MODEL_KEY = "motify:model";

/** The model picked on an earlier visit; the free one when none was, or it is no longer offered. */
export function readPickedModel(): GenerationModel {
  try {
    const stored = localStorage.getItem(PICKED_MODEL_KEY);
    return (
      MODEL_OPTIONS.find((option) => option.value === stored)?.value ??
      FREE_MODEL
    );
  } catch {
    return FREE_MODEL;
  }
}

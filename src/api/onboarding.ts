import { fetchApi } from "./client";

/** How far a person got through the first-run tour. */
export interface OnboardingState {
  step: string | null;
  completedAt: string | null;
}

interface OnboardingPatch {
  step?: string;
  completed?: boolean;
  /** Clears progress so the tour runs again. */
  reset?: boolean;
}

async function read(response: Response): Promise<OnboardingState> {
  const { data } = (await response.json()) as { data?: OnboardingState };
  if (!data || typeof data !== "object") {
    throw new Error("The onboarding response was not understood.");
  }
  return { step: data.step ?? null, completedAt: data.completedAt ?? null };
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

import { fetchApi } from "./client";

/** A plan a person can buy, as the pricing page lists it. */
export interface BillingPlanOffer {
  id: string;
  name: string;
  /** Monthly price in dollars. */
  price: number;
  /** Credits granted each month. */
  credits: number;
}

/** The plans on sale now, cheapest first. Studio and other withdrawn plans are left out. */
export async function fetchAvailablePlans(): Promise<BillingPlanOffer[]> {
  const response = await fetchApi("/v1/billing/plans");
  const { data } = (await response.json()) as { data?: unknown };
  if (!Array.isArray(data)) return [];
  return data
    .filter(
      (plan): plan is BillingPlanOffer & { available: boolean } =>
        typeof plan === "object" &&
        plan !== null &&
        (plan as { available?: unknown }).available === true &&
        typeof (plan as { id?: unknown }).id === "string" &&
        typeof (plan as { name?: unknown }).name === "string" &&
        typeof (plan as { price?: unknown }).price === "number" &&
        typeof (plan as { credits?: unknown }).credits === "number",
    )
    .map(({ id, name, price, credits }) => ({ id, name, price, credits }))
    .sort((a, b) => a.price - b.price);
}

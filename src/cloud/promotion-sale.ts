import { readable, type Readable } from "svelte/store";
import type { PromotionBanner } from "./projects-api";

/** A promotion that sells a promo code: the code from `?promo=` in its CTA URL, the percent from its copy. */
export interface PromotionSale {
  readonly code: string;
  readonly percent: number;
  readonly endsAt: number;
}

export function promotionSale(
  banner: PromotionBanner | null | undefined,
): PromotionSale | null {
  if (!banner?.ctaUrl) return null;
  const code = new URL(banner.ctaUrl, "https://motify.invalid").searchParams
    .get("promo")
    ?.trim()
    .toUpperCase();
  if (!code) return null;
  const percent = Number(
    /(\d{1,3})\s*%/.exec(`${banner.title} ${banner.message}`)?.[1] ?? 0,
  );
  return {
    code,
    percent: Math.min(percent, 100),
    endsAt: new Date(banner.endsAt).getTime(),
  };
}

export interface Countdown {
  readonly days: string;
  readonly hours: string;
  readonly minutes: string;
  readonly seconds: string;
  readonly done: boolean;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Days, hours, minutes and seconds until `endsAt`, ticking every second. */
export function countdown(endsAt: number): Readable<Countdown> {
  const read = (): Countdown => {
    const total = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
    return {
      days: pad(Math.floor(total / 86400)),
      hours: pad(Math.floor((total % 86400) / 3600)),
      minutes: pad(Math.floor((total % 3600) / 60)),
      seconds: pad(total % 60),
      done: total === 0,
    };
  };
  return readable(read(), (set) => {
    const timer = setInterval(() => set(read()), 1000);
    return () => clearInterval(timer);
  });
}

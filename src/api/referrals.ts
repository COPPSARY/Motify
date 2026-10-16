import { MOTIFY_API_URL } from "./config";
import type { MotionlyUser } from "../auth";

interface CelloApi {
  boot(options: Record<string, unknown>): Promise<void>;
}

declare global {
  interface Window {
    cello?: { cmd: Array<(cello: CelloApi) => void | Promise<void>> };
    Cello?: (command: string, value?: unknown) => Promise<unknown>;
  }
}

export interface ReferralSession {
  readonly rewardCredits: number;
  readonly link: string;
}

export async function bootReferrals(
  user: MotionlyUser,
): Promise<ReferralSession> {
  const response = await fetch(`${MOTIFY_API_URL}/v1/referrals/session`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Referrals are unavailable");
  const { productId, token, rewardCredits } = (
    (await response.json()) as {
      data: { productId: string; token: string; rewardCredits: number };
    }
  ).data;
  const [firstName = user.displayName || user.email, ...rest] = user.displayName
    .trim()
    .split(/\s+/);
  window.cello ||= { cmd: [] };
  const link = await new Promise<string>((resolve, reject) => {
    window.cello!.cmd.push(async (cello) => {
      try {
        await cello.boot({
          productId,
          token,
          hideDefaultLauncher: true,
          themeMode: "dark",
          productUserDetails: {
            email: user.email,
            firstName,
            fullName: user.displayName || user.email,
            ...(rest.length ? { lastName: rest.join(" ") } : {}),
          },
        });
        if (!window.Cello) throw new Error("Cello SDK is unavailable");
        let referral: { link?: string | null } | undefined;
        let lastError: unknown;
        for (let attempt = 0; attempt < 10 && !referral?.link; attempt += 1) {
          try {
            const result = await window.Cello("getActiveUcc");
            referral =
              typeof result === "object" && result !== null && "link" in result
                ? {
                    link: typeof result.link === "string" ? result.link : null,
                  }
                : undefined;
          } catch (error) {
            lastError = error;
          }
          if (!referral?.link && attempt < 9) {
            await new Promise((ready) => setTimeout(ready, 500));
          }
        }
        if (!referral?.link && lastError) throw lastError;
        if (!referral?.link)
          throw new Error("Cello did not return a referral link");
        const url = new URL(referral.link);
        if (url.protocol !== "https:")
          throw new Error("Cello returned an unsafe referral link");
        resolve(url.toString());
      } catch (error) {
        reject(error);
      }
    });
  });
  return { rewardCredits, link };
}

export function shutdownReferrals(): void {
  void window.Cello?.("shutdown");
}

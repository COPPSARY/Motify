import { mount, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import PromotionBanner from "./PromotionBanner.svelte";

afterEach(() => document.body.replaceChildren());

describe("PromotionBanner", () => {
  it("renders a compact offer and can be dismissed", async () => {
    const onDismiss = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(PromotionBanner, {
      target,
      props: {
        banner: {
          id: "banner-1",
          title: "Starter week",
          message: "Starter is only $2/month for one week.",
          plan: { id: "starter", name: "Starter" },
          audience: "free",
          ctaLabel: "View offer",
          ctaUrl: null,
          startsAt: "2026-10-10T00:00:00.000Z",
          endsAt: "2026-10-17T00:00:00.000Z",
        },
        href: "https://motify.video/pricing?plan=starter",
        onDismiss,
      },
    });
    try {
      expect(
        document.querySelector("[data-promotion-banner='banner-1']"),
      ).not.toBeNull();
      expect(document.body.textContent).toContain("$2/month");
      expect(
        document.querySelector<HTMLAnchorElement>(".promotion-cta")?.href,
      ).toContain("plan=starter");
      document
        .querySelector<HTMLButtonElement>("[aria-label='Dismiss promotion']")
        ?.click();
      expect(onDismiss).toHaveBeenCalledOnce();
    } finally {
      await unmount(component);
    }
  });
});

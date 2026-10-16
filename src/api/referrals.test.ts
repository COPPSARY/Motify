import { afterEach, describe, expect, it, vi } from "vitest";

import { bootReferrals } from "./referrals";

describe("Cello referrals", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.cello;
    delete window.Cello;
  });

  it("boots the widget with a server-signed user session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              productId: "product-1",
              token: "signed-jwt",
              rewardCredits: 45,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    window.cello = { cmd: [] };
    const boot = vi.fn(async () => undefined);
    const getActiveUcc = vi.fn(async () => ({
      ucc: "ucc-123",
      link: "https://motify.cello.so/ucc-123",
    }));
    window.Cello = getActiveUcc;

    const ready = bootReferrals({
      id: "user-1",
      email: "ada@example.com",
      emailVerified: true,
      displayName: "Ada Lovelace",
      avatarUrl: null,
    });
    await vi.waitFor(() => expect(window.cello?.cmd).toHaveLength(1));
    await window.cello!.cmd[0]!({ boot });
    await expect(ready).resolves.toEqual({
      rewardCredits: 45,
      link: "https://motify.cello.so/ucc-123",
    });

    expect(boot).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "product-1",
        token: "signed-jwt",
        hideDefaultLauncher: true,
        productUserDetails: expect.objectContaining({
          email: "ada@example.com",
          firstName: "Ada",
        }),
      }),
    );
    expect(getActiveUcc).toHaveBeenCalledOnce();
  });

  it("rejects an unsafe referral link returned by Cello", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              productId: "product-1",
              token: "signed-jwt",
              rewardCredits: 30,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    window.cello = { cmd: [] };
    window.Cello = vi.fn(async () => ({ link: "javascript:alert(1)" }));

    const ready = bootReferrals({
      id: "user-1",
      email: "ada@example.com",
      emailVerified: true,
      displayName: "Ada Lovelace",
      avatarUrl: null,
    });
    await vi.waitFor(() => expect(window.cello?.cmd).toHaveLength(1));
    await window.cello!.cmd[0]!({
      boot: vi.fn(async () => undefined),
    });

    await expect(ready).rejects.toThrow("unsafe referral link");
  });

  it("retries while Cello finishes preparing the referral link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              productId: "product-1",
              token: "signed-jwt",
              rewardCredits: 30,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    window.cello = { cmd: [] };
    const getActiveUcc = vi
      .fn()
      .mockRejectedValueOnce(new Error("Referral program not yet initiated"))
      .mockResolvedValueOnce({ link: "https://motify.cello.so/ready" });
    window.Cello = getActiveUcc;

    const ready = bootReferrals({
      id: "user-1",
      email: "ada@example.com",
      emailVerified: true,
      displayName: "Ada Lovelace",
      avatarUrl: null,
    });
    await vi.waitFor(() => expect(window.cello?.cmd).toHaveLength(1));
    await window.cello!.cmd[0]!({
      boot: vi.fn(async () => undefined),
    });

    await expect(ready).resolves.toEqual({
      rewardCredits: 30,
      link: "https://motify.cello.so/ready",
    });
    expect(getActiveUcc).toHaveBeenCalledTimes(2);
  });
});

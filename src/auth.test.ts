import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./api/config", () => ({ MOTIFY_API_URL: "http://localhost:3000" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("manual sign-up", () => {
  it("returns the user when sign-up creates a session", async () => {
    const user = {
      id: "user-1",
      email: "designer@example.com",
      emailVerified: true,
      displayName: "Designer",
      avatarUrl: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            verificationRequired: false,
            user,
            csrfToken: "csrf-token",
            newAccount: true,
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { signUpWithPassword, currentCsrfToken } = await import("./auth");

    await expect(signUpWithPassword(user.email, "secret123")).resolves.toEqual({
      user,
      newAccount: true,
    });
    expect(currentCsrfToken()).toBe("csrf-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/v1/auth/sign-up",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("passes Cello attribution only as signup metadata", async () => {
    document.cookie = "cello-referral=ucc-123; path=/";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { verificationRequired: true } }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { signUpWithPassword, motionlyLoginUrl } = await import("./auth");

    await signUpWithPassword("new@example.com", "secret123");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      referralCode: "ucc-123",
    });
    expect(new URL(motionlyLoginUrl()).searchParams.get("referralCode")).toBe(
      "ucc-123",
    );
    document.cookie = "cello-referral=; Max-Age=0; path=/";
  });

  it("waits for verification when sign-up creates no session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { verificationRequired: true },
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const { signUpWithPassword } = await import("./auth");

    await expect(
      signUpWithPassword("designer@example.com", "secret123"),
    ).resolves.toBeNull();
  });

  it("verifies a Supabase email OTP and stores the application session", async () => {
    const user = {
      id: "user-1",
      email: "designer@example.com",
      emailVerified: true,
      displayName: "Designer",
      avatarUrl: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { sent: true } }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { user, csrfToken: "otp-csrf", newAccount: true },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { resendSignupOtp, verifyEmailOtp, currentCsrfToken } =
      await import("./auth");

    await resendSignupOtp(" DESIGNER@example.com ");
    await expect(
      verifyEmailOtp(" DESIGNER@example.com ", "12345678"),
    ).resolves.toEqual({ user, newAccount: true });

    expect(currentCsrfToken()).toBe("otp-csrf");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:3000/v1/auth/otp/send",
      "http://localhost:3000/v1/auth/otp/verify",
    ]);
  });
});

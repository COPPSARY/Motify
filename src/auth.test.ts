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
});

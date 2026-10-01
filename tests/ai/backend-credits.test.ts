import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateWithDirectAi } from "../../src/ai/direct-ai";
import {
  foundationHtml,
  foundationTimeline,
} from "../../src/ai/generation-foundation";
import {
  creditBalance,
  creditStatus,
  lastCreditCharge,
  resetCredits,
} from "../../src/stores/credits";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const session = () =>
  json({ data: { user: { id: "user" }, csrfToken: "csrf-token" } });

/** The follow-up reads that turn a saved generation into a film. */
const savedFilm = () => [
  json({
    data: {
      "composition.html": foundationHtml,
      "timeline.js": foundationTimeline,
    },
  }),
  json({ data: { duration: 12 } }),
];

describe("credits around a backend generation", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("MOTIFY_API_URL", "");
    vi.stubEnv("VITE_MOTIFY_API_URL", "");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    resetCredits();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetCredits();
  });

  it("shows the balance the server reported with the result, and what the request cost", async () => {
    fetchMock.mockResolvedValueOnce(session()).mockResolvedValueOnce(
      json({
        data: {
          type: "generation",
          response: "Built the launch film.",
          projectId: "project-1",
          revision: 2,
          credits: { charged: 3.4, remaining: 46.6 },
        },
      }),
    );
    for (const response of savedFilm())
      fetchMock.mockResolvedValueOnce(response);

    await generateWithDirectAi("make a product tour", {
      backendProjectId: "project-1",
    });

    expect(get(creditBalance)).toBe(46.6);
    expect(get(creditStatus)).toBe("ready");
    expect(get(lastCreditCharge)).toBe(3.4);
  });

  it("leaves the balance alone when the server is not charging", async () => {
    fetchMock.mockResolvedValueOnce(session()).mockResolvedValueOnce(
      json({
        data: {
          type: "generation",
          response: "Built the launch film.",
          projectId: "project-1",
          revision: 2,
        },
      }),
    );
    for (const response of savedFilm())
      fetchMock.mockResolvedValueOnce(response);

    await generateWithDirectAi("make a product tour", {
      backendProjectId: "project-1",
    });

    expect(get(creditBalance)).toBeNull();
    expect(get(lastCreditCharge)).toBeNull();
  });

  it("does not trust a nonsense balance in a response", async () => {
    fetchMock.mockResolvedValueOnce(session()).mockResolvedValueOnce(
      json({
        data: {
          type: "generation",
          response: "Built the launch film.",
          projectId: "project-1",
          revision: 2,
          credits: { charged: -5, remaining: 1e9 * -1 },
        },
      }),
    );
    for (const response of savedFilm())
      fetchMock.mockResolvedValueOnce(response);

    await generateWithDirectAi("make a product tour", {
      backendProjectId: "project-1",
    });
    expect(get(creditBalance)).toBeNull();
  });

  it("tells the user plainly when they cannot afford a request, and rereads the balance", async () => {
    fetchMock
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(
        json(
          {
            error: {
              code: "INSUFFICIENT_CREDITS",
              message: "You do not have enough credits for this request.",
              details: { balance: 0.2, required: 0.5 },
            },
          },
          402,
        ),
      )
      .mockResolvedValueOnce(json({ data: { balance: 0.2 } }));

    await expect(
      generateWithDirectAi("make a product tour", {
        backendProjectId: "project-1",
      }),
    ).rejects.toThrow(
      "You don't have enough credits for this request. You have 0.2 left.",
    );

    await vi.waitFor(() => expect(get(creditBalance)).toBe(0.2));
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toMatch(/\/v1\/credits$/);
  });
});

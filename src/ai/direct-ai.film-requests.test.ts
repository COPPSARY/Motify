import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  runMotionMessage: vi.fn(),
  getSource: vi.fn(),
  getProject: vi.fn(),
}));

vi.mock("../cloud/projects-api", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../cloud/projects-api")>();
  return {
    ...original,
    ProjectsApi: class {
      constructor() {
        return api;
      }
    },
  };
});
vi.mock("../stores/credits", () => ({
  applyServerCharge: vi.fn(),
  promptOutOfCredits: vi.fn(),
  refreshCredits: vi.fn(async () => undefined),
}));

import { get } from "svelte/store";
import { CloudApiError } from "../cloud/projects-api";
import { fulfillmentMode, setFulfillmentMode } from "../stores/film-requests";
import { generateWithDirectAi, SendToTeamInstead } from "./direct-ai";

const send = () =>
  generateWithDirectAi("A launch film for our cold brew", {
    backendProjectId: "project-1",
    brandId: null,
    model: "flash",
    assets: [],
  } as never);

describe("generateWithDirectAi when our team takes over", () => {
  beforeEach(() => {
    api.runMotionMessage.mockReset();
    setFulfillmentMode("ai");
  });

  it("hands the message back for the team when the API says the team makes films now", async () => {
    api.runMotionMessage.mockRejectedValue(
      new CloudApiError(409, "FULFILLMENT_MANUAL", "Made by our team"),
    );

    await expect(send()).rejects.toBeInstanceOf(SendToTeamInstead);
    expect(get(fulfillmentMode)).toBe("manual");
  });

  it("leaves other failures as they are", async () => {
    api.runMotionMessage.mockRejectedValue(
      new CloudApiError(500, "INTERNAL", "Something broke"),
    );

    await expect(send()).rejects.not.toBeInstanceOf(SendToTeamInstead);
    expect(get(fulfillmentMode)).toBe("ai");
  });
});

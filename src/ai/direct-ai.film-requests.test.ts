import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  runMotionMessage: vi.fn(),
  submitFilmRequest: vi.fn(),
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
import {
  fulfillmentMode,
  setFulfillmentMode,
  telegramContact,
} from "../stores/film-requests";
import {
  BackendConversationResponse,
  FilmRequestQueued,
  generateWithDirectAi,
  TelegramContactRequired,
} from "./direct-ai";

const queued = {
  id: "request-1",
  projectId: "project-1",
  status: "queued",
  queue: { position: 4, total: 15 },
};

const send = () =>
  generateWithDirectAi("A launch film for our cold brew", {
    backendProjectId: "project-1",
    brandId: null,
    model: "flash",
    tool: { id: "product-launch", seconds: 20, language: "en" },
    assets: [],
  } as never);

describe("generateWithDirectAi while our team makes films", () => {
  beforeEach(() => {
    api.runMotionMessage.mockReset();
    api.submitFilmRequest.mockReset();
    telegramContact.set("+855 12 345 678");
  });

  it("sends the message to the team with the Telegram contact instead of the AI", async () => {
    setFulfillmentMode("manual");
    api.submitFilmRequest.mockResolvedValue(queued);

    const error = await send().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FilmRequestQueued);
    expect((error as FilmRequestQueued).request).toEqual(queued);
    expect(api.runMotionMessage).not.toHaveBeenCalled();
    expect(api.submitFilmRequest).toHaveBeenCalledWith("project-1", {
      brandId: null,
      message: "A launch film for our cold brew",
      model: "flash",
      tool: { id: "product-launch", seconds: 20, language: "en" },
      assets: [],
      telegram: "+855 12 345 678",
    });
  });

  it("asks for a Telegram contact rather than sending without one", async () => {
    setFulfillmentMode("manual");
    telegramContact.set("");
    await expect(send()).rejects.toBeInstanceOf(TelegramContactRequired);
    expect(api.submitFilmRequest).not.toHaveBeenCalled();
  });

  it("goes to the team when the API says it took over since the page loaded", async () => {
    setFulfillmentMode("ai");
    api.runMotionMessage.mockRejectedValue(
      new CloudApiError(409, "FULFILLMENT_MANUAL", "Made by our team"),
    );
    api.submitFilmRequest.mockResolvedValue(queued);

    await expect(send()).rejects.toBeInstanceOf(FilmRequestQueued);
    expect(get(fulfillmentMode)).toBe("manual");
  });

  it("goes back to the AI when the API says the AI makes films again", async () => {
    setFulfillmentMode("manual");
    api.submitFilmRequest.mockRejectedValue(
      new CloudApiError(409, "FULFILLMENT_AI", "Made by the AI"),
    );
    api.runMotionMessage.mockResolvedValue({
      type: "chat",
      response: "Hello!",
    });

    await expect(send()).rejects.toBeInstanceOf(BackendConversationResponse);
    expect(api.runMotionMessage).toHaveBeenCalled();
    expect(get(fulfillmentMode)).toBe("ai");
  });
});

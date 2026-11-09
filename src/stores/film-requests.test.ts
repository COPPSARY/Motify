import { get } from "svelte/store";
import { describe, expect, it, vi } from "vitest";

import type { FilmRequest } from "../cloud/projects-api";
import { filmRequest } from "./film-requests.fixture";
import {
  activeFilmRequest,
  filmRequestReply,
  fulfillmentMode,
  isTelegramContact,
  loadProjectFilmRequest,
  refreshFulfillmentMode,
  showFilmRequest,
} from "./film-requests";

describe("isTelegramContact", () => {
  it("takes a phone number or a Telegram username, as the server does", () => {
    expect(isTelegramContact("+855 12 345 678")).toBe(true);
    expect(isTelegramContact("012-345-678")).toBe(true);
    expect(isTelegramContact("@dara_k")).toBe(true);
    expect(isTelegramContact("dara_k")).toBe(true);
    expect(isTelegramContact("")).toBe(false);
    expect(isTelegramContact("12")).toBe(false);
    expect(isTelegramContact("call me")).toBe(false);
  });
});

describe("fulfillment mode", () => {
  it("follows /v1/capabilities, and stays with the AI when the API cannot say", async () => {
    await refreshFulfillmentMode({
      getCapabilities: vi.fn().mockResolvedValue({ fulfillment: "manual" }),
    });
    expect(get(fulfillmentMode)).toBe("manual");
    await refreshFulfillmentMode({
      getCapabilities: vi.fn().mockResolvedValue({}),
    });
    expect(get(fulfillmentMode)).toBe("ai");
    await expect(
      refreshFulfillmentMode({
        getCapabilities: vi.fn().mockRejectedValue(new Error("offline")),
      }),
    ).resolves.toBe("ai");
  });
});

describe("loadProjectFilmRequest", () => {
  const now = Date.parse("2026-11-09T12:00:00.000Z");

  it("shows an open request, or one that closed in the last day", async () => {
    await loadProjectFilmRequest(
      "project-1",
      { listFilmRequests: vi.fn().mockResolvedValue([filmRequest()]) },
      now,
    );
    expect(get(activeFilmRequest)?.id).toBe("request-1");

    const delivered = filmRequest({
      status: "delivered",
      queue: null,
      deliveredAt: "2026-11-09T11:00:00.000Z",
    });
    await loadProjectFilmRequest(
      "project-1",
      { listFilmRequests: vi.fn().mockResolvedValue([delivered]) },
      now,
    );
    expect(get(activeFilmRequest)?.status).toBe("delivered");

    await loadProjectFilmRequest(
      "project-1",
      {
        listFilmRequests: vi
          .fn()
          .mockResolvedValue([
            { ...delivered, deliveredAt: "2026-11-07T11:00:00.000Z" },
          ]),
      },
      now,
    );
    expect(get(activeFilmRequest)).toBeNull();
  });

  it("never replaces a request shown while it was loading", async () => {
    let answer: (requests: FilmRequest[]) => void = () => undefined;
    const loading = loadProjectFilmRequest("project-1", {
      listFilmRequests: () =>
        new Promise<FilmRequest[]>((resolve) => (answer = resolve)),
    });
    showFilmRequest(filmRequest({ id: "just-sent" }));
    answer([]);
    await loading;
    expect(get(activeFilmRequest)?.id).toBe("just-sent");
  });
});

describe("filmRequestReply", () => {
  it("says where the film goes and the place in the queue", () => {
    expect(filmRequestReply(filmRequest())).toBe(
      "Our team is making this one by hand and will send the finished video to Telegram (+85512345678). You're #4 of 15 in the queue.",
    );
    expect(
      filmRequestReply(
        filmRequest({
          telegram: { contact: "@dara", connected: true, connectUrl: null },
          queue: null,
        }),
      ),
    ).toBe(
      "Our team is making this one by hand and will send the finished video to your Telegram.",
    );
  });
});

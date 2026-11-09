import { flushSync, mount, unmount } from "svelte";
import { get } from "svelte/store";
import { afterEach, describe, expect, it, vi } from "vitest";

import { activeFilmRequest } from "../../stores/film-requests";
import { filmRequest } from "../../stores/film-requests.fixture";
import FilmQueueCard from "./FilmQueueCard.svelte";

describe("FilmQueueCard", () => {
  let component: ReturnType<typeof mount> | null = null;

  afterEach(async () => {
    if (component) await unmount(component);
    component = null;
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  function show(
    request = filmRequest(),
    api = {
      getFilmRequest: vi.fn().mockResolvedValue(request),
      cancelFilmRequest: vi.fn(),
    },
  ) {
    const target = document.createElement("div");
    document.body.append(target);
    component = mount(FilmQueueCard, { target, props: { request, api } });
    flushSync();
    return { api, card: target.querySelector<HTMLElement>(".film-queue")! };
  }

  it("shows the place in the queue and the link that connects Telegram", () => {
    const { card } = show();
    expect(card.textContent).toContain("You're #4");
    expect(card.textContent).toContain("of 15 in the queue");
    const link = card.querySelector<HTMLAnchorElement>(".film-queue__connect")!;
    expect(link.href).toBe("https://t.me/MotifyBot?start=abc");
    expect(link.target).toBe("_blank");
    expect(card.textContent).toContain("+85512345678");
  });

  it("says Telegram is connected once it is, and when the film was sent", () => {
    const connected = { contact: "@dara", connected: true, connectUrl: "x" };
    let { card } = show(
      filmRequest({ status: "in_progress", queue: null, telegram: connected }),
    );
    expect(card.textContent).toContain("Your film is generating");
    expect(card.textContent).toContain("Telegram connected");
    expect(card.querySelector(".film-queue__connect")).toBeNull();
    expect(card.querySelector(".film-queue__cancel")).toBeNull();

    document.body.innerHTML = "";
    ({ card } = show(
      filmRequest({ status: "delivered", queue: null, telegram: connected }),
    ));
    expect(card.textContent).toContain("Your film is ready");
    expect(card.querySelector(".film-queue__telegram")).toBeNull();
  });

  it("cancels a queued request", async () => {
    const cancelled = filmRequest({ status: "cancelled", queue: null });
    const { api, card } = show(filmRequest(), {
      getFilmRequest: vi.fn(),
      cancelFilmRequest: vi.fn().mockResolvedValue(cancelled),
    });
    card.querySelector<HTMLButtonElement>(".film-queue__cancel")!.click();
    await vi.waitFor(() =>
      expect(get(activeFilmRequest)?.status).toBe("cancelled"),
    );
    expect(api.cancelFilmRequest).toHaveBeenCalledWith("request-1");
  });

  it("checks an open request for changes", async () => {
    vi.useFakeTimers();
    const moved = filmRequest({ queue: { position: 3, total: 15 } });
    const { api } = show(filmRequest(), {
      getFilmRequest: vi.fn().mockResolvedValue(moved),
      cancelFilmRequest: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(api.getFilmRequest).toHaveBeenCalledWith("request-1");
    expect(get(activeFilmRequest)?.queue).toEqual({ position: 3, total: 15 });
  });
});

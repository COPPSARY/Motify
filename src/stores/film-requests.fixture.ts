import type { FilmRequest } from "../cloud/projects-api";

/** A queued film request, for tests. */
export function filmRequest(overrides: Partial<FilmRequest> = {}): FilmRequest {
  return {
    id: "request-1",
    projectId: "project-1",
    source: "prompt",
    status: "queued",
    queue: { position: 4, total: 15 },
    telegram: {
      contact: "+85512345678",
      connected: false,
      connectUrl: "https://t.me/MotifyBot?start=abc",
    },
    charged: null,
    createdAt: "2026-11-09T10:00:00.000Z",
    startedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

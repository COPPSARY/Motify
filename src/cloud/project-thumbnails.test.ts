import { afterEach, describe, expect, it, vi } from "vitest";
import {
  projectThumbnailUrl,
  seedProjectThumbnail,
} from "./project-thumbnails";

let nextUrl = 0;

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubObjectUrls() {
  const revoke = vi.fn();
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => `blob:still-${(nextUrl += 1)}`,
    revokeObjectURL: revoke,
  });
  return revoke;
}

describe("project thumbnails", () => {
  it("fetches each revision once and reuses it", async () => {
    stubObjectUrls();
    const api = { getProjectThumbnail: vi.fn().mockResolvedValue(new Blob()) };

    const first = await projectThumbnailUrl(api, "once", 2);
    await expect(projectThumbnailUrl(api, "once", 2)).resolves.toBe(first);
    expect(api.getProjectThumbnail).toHaveBeenCalledTimes(1);
  });

  it("fetches a newer revision and lets go of the older still", async () => {
    const revoke = stubObjectUrls();
    const api = { getProjectThumbnail: vi.fn().mockResolvedValue(new Blob()) };

    const older = await projectThumbnailUrl(api, "newer", 1);
    const newer = await projectThumbnailUrl(api, "newer", 2);
    expect(newer).not.toBe(older);
    expect(api.getProjectThumbnail).toHaveBeenLastCalledWith("newer", 2);
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith(older));
  });

  it("shows a still the editor just drew without fetching it", async () => {
    stubObjectUrls();
    const api = { getProjectThumbnail: vi.fn() };

    seedProjectThumbnail("seeded", 5, new Blob());
    // A list loaded before the save still names the older revision.
    await expect(projectThumbnailUrl(api, "seeded", 4)).resolves.toMatch(
      /^blob:still-/,
    );
    expect(api.getProjectThumbnail).not.toHaveBeenCalled();
  });

  it("tries again after a failed fetch", async () => {
    stubObjectUrls();
    const api = {
      getProjectThumbnail: vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(new Blob()),
    };

    await expect(projectThumbnailUrl(api, "retry", 1)).rejects.toThrow(
      "offline",
    );
    await expect(projectThumbnailUrl(api, "retry", 1)).resolves.toMatch(
      /^blob:still-/,
    );
    expect(api.getProjectThumbnail).toHaveBeenCalledTimes(2);
  });
});

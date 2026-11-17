import { describe, expect, it } from "vitest";

import { countAttachments } from "./prompt-assist";

describe("countAttachments", () => {
  it("counts staged files by type, plus songs picked from the library", () => {
    expect(
      countAttachments(
        [
          { mimeType: "image/webp" },
          { mimeType: "image/png" },
          { mimeType: "video/mp4" },
          { type: "audio/mpeg" },
          { mimeType: "application/pdf" },
        ],
        2,
      ),
    ).toEqual({ images: 2, videos: 1, audio: 3 });
    expect(countAttachments([])).toEqual({ images: 0, videos: 0, audio: 0 });
  });
});

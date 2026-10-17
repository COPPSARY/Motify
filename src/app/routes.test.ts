import { describe, expect, it } from "vitest";

import { PROMPTS_ROUTE, homePageFromPath, homePagePath } from "./routes";

describe("home page routes", () => {
  it("maps each page to its own path and back", () => {
    expect(homePagePath(null)).toBe("/");
    expect(homePagePath("videos")).toBe("/videos");
    expect(homePageFromPath("/")).toBeNull();
    expect(homePageFromPath("/templates")).toBe("templates");
    expect(homePagePath("templates")).toBe(PROMPTS_ROUTE);
    // Prompt Templates moved from /prompts; old links still open it.
    expect(homePageFromPath("/prompts")).toBe("templates");
    expect(homePageFromPath("/films")).toBe("films");
    expect(homePageFromPath("/support/")).toBe("support");
    expect(homePageFromPath("/billing")).toBe("billing");
  });

  it("leaves videos, the brand page and unknown paths alone", () => {
    expect(homePageFromPath("/p/project-1")).toBeUndefined();
    expect(homePageFromPath("/brand")).toBeUndefined();
    expect(homePageFromPath("/nope")).toBeUndefined();
    expect(homePageFromPath("/generate-assets")).toBeUndefined();
    expect(homePageFromPath("/storyboard")).toBeUndefined();
  });
});

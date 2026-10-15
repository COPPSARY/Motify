import { describe, expect, it } from "vitest";

import { PROMPTS_ROUTE, homePageFromPath, homePagePath } from "./routes";

describe("home page routes", () => {
  it("maps each page to its own path and back", () => {
    expect(homePagePath(null)).toBe("/");
    expect(homePagePath("videos")).toBe("/videos");
    expect(homePagePath("storyboard")).toBe("/storyboard");
    expect(homePageFromPath("/")).toBeNull();
    expect(homePageFromPath("/templates")).toBe("templates");
    expect(homePageFromPath("/storyboard")).toBe("storyboard");
    expect(homePageFromPath("/prompts")).toBe("prompts");
    expect(homePagePath("prompts")).toBe(PROMPTS_ROUTE);
    expect(homePageFromPath("/support/")).toBe("support");
  });

  it("leaves videos, the brand page and unknown paths alone", () => {
    expect(homePageFromPath("/p/project-1")).toBeUndefined();
    expect(homePageFromPath("/brand")).toBeUndefined();
    expect(homePageFromPath("/nope")).toBeUndefined();
    expect(homePageFromPath("/generate-assets")).toBeUndefined();
  });
});

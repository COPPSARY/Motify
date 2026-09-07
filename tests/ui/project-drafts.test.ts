import { beforeEach, describe, expect, it } from "vitest";
import {
  clearProjectDrafts,
  draftKey,
  loadProjectDraft,
  saveProjectDraft,
} from "../../src/stores/project-drafts";

describe("browser-local project drafts", () => {
  beforeEach(() => localStorage.clear());

  it("stores source, conversation, assets, and editor state per project", () => {
    saveProjectDraft("project:one", {
      version: 1,
      updatedAt: 10,
      files: {
        "composition.html": "<template></template>",
        "styles.css": "",
        "timeline.js": "export function buildTimeline() {}",
        "index.ts": "export default {}",
      },
      messages: [{ role: "user", text: "Keep the first scene" }],
      assets: [
        {
          id: "photo",
          name: "photo.png",
          mimeType: "image/png",
          token: "motionly-asset://photo",
        },
      ],
      editorState: {
        elements: { title: { x: 20 } },
        animations: { title: { speed: 1.2, ease: "sine.inOut" } },
        tweens: { "title:tween-1": { duration: 0.8 } },
      },
      metadata: {
        title: "Draft",
        duration: 2,
        scenes: [
          { id: "main", label: "Main", start: 0, duration: 2, accent: "#fff" },
        ],
      },
      baseRevision: 3,
    });

    expect(localStorage.getItem(draftKey("project:one"))).not.toBeNull();
    expect(loadProjectDraft("project:one")).toMatchObject({
      baseRevision: 3,
      messages: [{ text: "Keep the first scene" }],
      editorState: { elements: { title: { x: 20 } } },
    });
    expect(loadProjectDraft("project:two")).toBeNull();
  });

  it("clears only Motionly project drafts", () => {
    localStorage.setItem("unrelated-app-setting", "keep");
    localStorage.setItem("motionly-assistant-history-v1", "[]");
    saveProjectDraft("project:one", {
      version: 1,
      updatedAt: 10,
      files: {
        "composition.html": "<template></template>",
        "styles.css": "",
        "timeline.js": "export function buildTimeline() {}",
        "index.ts": "export default {}",
      },
      messages: [],
      assets: [],
      editorState: { elements: {}, animations: {}, tweens: {} },
      metadata: { title: "Draft", duration: 1, scenes: [] },
    });

    clearProjectDrafts();

    expect(loadProjectDraft("project:one")).toBeNull();
    expect(localStorage.getItem("motionly-assistant-history-v1")).toBeNull();
    expect(localStorage.getItem("unrelated-app-setting")).toBe("keep");
  });
});

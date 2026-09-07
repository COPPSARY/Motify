import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  getAllRegistryItems,
  getRegistryBlocks,
  getRegistryComponents,
  getRegistryExamples,
  findRegistryItem,
  searchRegistry,
  adaptHyperFramesToMotionly,
  parseHyperFramesHtml,
} from "../../src/registry";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("HyperFrames Registry Catalog & Bridge", () => {
  it("loads and classifies the complete 383 registry assets", () => {
    const all = getAllRegistryItems();
    expect(all.length).toBe(383);

    const blocks = getRegistryBlocks();
    expect(blocks.length).toBe(155);

    const components = getRegistryComponents();
    expect(components.length).toBe(219);

    const examples = getRegistryExamples();
    expect(examples.length).toBe(9);
  });

  it("finds specific blocks and components by name and search keywords", () => {
    const chatBlock = findRegistryItem("ai-chat-reveal");
    expect(chatBlock).toBeDefined();
    expect(chatBlock?.name).toBe("ai-chat-reveal");
    expect(chatBlock?.type).toBe("hyperframes:block");

    const auroraComp = findRegistryItem("aurora-drift");
    expect(auroraComp).toBeDefined();
    expect(auroraComp?.name).toBe("aurora-drift");
    expect(auroraComp?.type).toBe("hyperframes:component");
    expect(auroraComp?.description).toContain("aurora fields drift");
    expect(auroraComp?.variables?.length).toBeGreaterThanOrEqual(2);

    const searchResults = searchRegistry("aurora");
    expect(searchResults.length).toBeGreaterThanOrEqual(1);
    expect(searchResults.some((s) => s.name === "aurora-drift")).toBe(true);
  });

  it("adapts a HyperFrames component HTML snippet into a runnable Motionly composition", () => {
    const htmlPath = resolve(
      process.cwd(),
      "registry/components/aurora-drift/aurora-drift.html",
    );
    const rawHtml = readFileSync(htmlPath, "utf-8");

    const parsed = parseHyperFramesHtml(rawHtml);
    expect(parsed.id).toBe("aurora-drift");
    expect(parsed.duration).toBe(4);
    expect(parsed.variables.length).toBeGreaterThanOrEqual(2);

    const composition = adaptHyperFramesToMotionly(rawHtml);
    expect(composition.id).toBe("aurora-drift");
    expect(composition.duration).toBe(4);

    const root = document.createElement("div");
    document.body.append(root);

    const runtime = new CompositionRuntime(composition, root);
    expect(runtime.timeline).toBeDefined();
    runtime.seek(2.0);

    runtime.destroy();
    root.remove();
  });

  it("adapts a HyperFrames block HTML into a runnable Motionly composition", () => {
    const htmlPath = resolve(
      process.cwd(),
      "registry/blocks/ai-chat-reveal/ai-chat-reveal.html",
    );
    const rawHtml = readFileSync(htmlPath, "utf-8");

    const parsed = parseHyperFramesHtml(rawHtml);
    expect(parsed.variables.length).toBeGreaterThanOrEqual(5);

    const composition = adaptHyperFramesToMotionly(rawHtml);
    expect(composition.width).toBe(1080);
    expect(composition.height).toBe(1920);

    const root = document.createElement("div");
    document.body.append(root);

    const runtime = new CompositionRuntime(composition, root);
    expect(runtime.timeline).toBeDefined();
    runtime.seek(1.0);

    runtime.destroy();
    root.remove();
  });
});

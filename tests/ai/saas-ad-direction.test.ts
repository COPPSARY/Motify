import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applicationChromeScenes } from "../../src/ai/ad-quality";
import {
  analyzeMotionQuality,
  buildMotionlyUserMessage,
  selectFilmShape,
  selectRegistryReferences,
} from "../../src/ai/generation-guidance";
import { buildQualityRepairPrompt } from "../../src/ai/repair-prompt";
import {
  foundationHtml,
  foundationTimeline,
} from "../../src/ai/generation-foundation";

const adPrompt =
  "Make a 20 second SaaS ad for an AI assistant. End on the logo.";
const dashboard = {
  compositionHtml: readFileSync(
    "tests/fixtures/strong-generation.html",
    "utf8",
  ),
  timelineJs: readFileSync(
    "tests/fixtures/strong-generation.timeline.js",
    "utf8",
  ),
  reply: "Done",
};

describe("SaaS advertising follows the reference shot design", () => {
  it.each([
    adPrompt,
    "Create a launch ad for our analytics app showing how it works",
    "Make a SaaS ad for a copilot. End with the wordmark.",
    "An ad for a chatbot with object transformations and no UI",
    "Make an ad for our notes app with a phone and icons",
  ])(
    "keeps product-domain words from selecting a walkthrough: %s",
    (prompt) => {
      expect(selectFilmShape(prompt)).toBe("transformation");
      const names = selectRegistryReferences(prompt).map((entry) => entry.name);
      expect(names).not.toContain("browser-device-stage");
      expect(names).not.toContain("chat-thread");
      expect(names).not.toContain("telemetry-hud");
    },
  );

  it("supports explicit UI demonstrations and explicit typography", () => {
    expect(selectFilmShape("Show the chat interface and type a question")).toBe(
      "task",
    );
    expect(
      selectFilmShape("Walk through the settings screen. End on our logo."),
    ).toBe("task");
    expect(selectFilmShape("Kinetic typography ad for an AI assistant")).toBe(
      "editorial",
    );
    expect(selectFilmShape("Logo sting for an AI assistant")).toBe(
      "hero-object",
    );
  });

  it("sends a new ad without a complete UI foundation or surface-building instructions", async () => {
    const message = await buildMotionlyUserMessage(adPrompt, {
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
      generationProfile: "claude-foundation-v1",
    });
    expect(message).toContain("CREATE a new composition from scratch");
    expect(message).toContain("FILM SHAPE: TRANSFORMATION");
    expect(message).toContain("Visual material:");
    expect(message).not.toContain("Surface to build:");
    expect(message).not.toContain("Filmed interaction:");
    expect(message).not.toContain(foundationHtml);
    expect(message).not.toContain(foundationTimeline);
    expect(message).not.toContain("browser-device-stage (role:");
  });

  it("does not repair a typography or object film into an application", () => {
    const result = {
      compositionHtml:
        '<template><main data-edit="stage" data-camera-world><h1 data-edit="words">Ideas become motion.</h1><div class="card">Idea</div><div class="card">Draft</div><div class="card">Film</div></main></template>',
      timelineJs:
        "export function buildTimeline({ timeline }) { timeline.to(words, { x: 0, scale: 1, duration: 3 }, 0); }",
      reply: "Done",
    };
    const report = analyzeMotionQuality(result, { prompt: adPrompt });
    expect(report.issues.join(" ")).not.toMatch(
      /no real product interaction|no macro interaction|build the application surface|materially larger|fewer than three concrete/,
    );
    const task = analyzeMotionQuality(result, {
      prompt: "Show the app in a walkthrough",
    });
    expect(task.issues.join(" ")).toContain("no real product interaction");
  });

  it("requests a repair for a repeated dashboard even when its motion code is dense", () => {
    const report = analyzeMotionQuality(dashboard, { prompt: adPrompt });
    expect(report.requiresRepair).toBe(true);
    expect(report.blockingIssues.join(" ")).toContain(
      "the ad repeats application chrome",
    );
    const task = analyzeMotionQuality(dashboard, {
      prompt: "Show the app in a walkthrough",
    });
    expect(task.blockingIssues.join(" ")).not.toContain("application chrome");
  });

  it("keeps repairs on the original ad even when diagnostics mention navigation and controls", async () => {
    const report = analyzeMotionQuality(dashboard, { prompt: adPrompt });
    const repair = buildQualityRepairPrompt(adPrompt, dashboard, report);
    const message = await buildMotionlyUserMessage(repair, {
      ...dashboard,
      generationProfile: "existing",
      directionPrompt: adPrompt,
    });
    expect(message).toContain("EDIT the existing composition");
    expect(message).toContain("FILM SHAPE: TRANSFORMATION");
    expect(message).not.toContain("Surface to build:");
    expect(repair).toContain(
      "explicitly requires changing those scene layouts",
    );
  });

  it("retains the walkthrough direction on a timing follow-up", async () => {
    const message = await buildMotionlyUserMessage("make the ending slower", {
      ...dashboard,
      generationProfile: "existing",
      previousPlan: { subject: "Show the app in a product tour" },
    });
    expect(message).toContain("FILM SHAPE: TASK");
    expect(message).toContain("Current composition.html:");
  });

  it("counts distinct navigation scenes, allowing content cards and one focused UI beat", () => {
    const html = `<template><style>.sidebar { color: red; }</style>
      <section data-scene="intro"><div class="card">Idea</div></section>
      <section data-scene="action"><aside class="sidebar"><nav>Choose</nav></aside><div class="card">Result</div></section>
      <section data-scene="close"><div>Brand</div></section></template>`;
    expect(applicationChromeScenes(html)).toEqual(["action"]);
    const report = analyzeMotionQuality(
      { ...dashboard, compositionHtml: html },
      { prompt: adPrompt },
    );
    expect(report.blockingIssues.join(" ")).not.toContain("application chrome");
  });

  it("repairs repeated editorial subtitles without confusing normal product labels for them", () => {
    const repeated = {
      ...dashboard,
      compositionHtml:
        '<template><section><h1>One</h1><p class="editorial-subtitle">Small support</p></section><section><h1>Two</h1><p class="editorial-subtitle">More support</p></section></template>',
    };
    const report = analyzeMotionQuality(repeated, { prompt: adPrompt });
    expect(report.blockingIssues.join(" ")).toContain(
      "repeated headline and subtitle layouts",
    );
    const labels = analyzeMotionQuality(
      {
        ...repeated,
        compositionHtml: repeated.compositionHtml.replaceAll(
          "editorial-subtitle",
          "product-label",
        ),
      },
      { prompt: adPrompt },
    );
    expect(labels.blockingIssues.join(" ")).not.toContain(
      "headline and subtitle",
    );
  });
});

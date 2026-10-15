import { flushSync, mount, unmount } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import TourCoach from "./TourCoach.svelte";
import { TOUR_STEPS, isNewAccountLanding, resumeIndex } from "./tour";

describe("first-run tour progress", () => {
  it("has unique steps that start on the prompt templates", () => {
    expect(new Set(TOUR_STEPS.map((step) => step.id)).size).toBe(
      TOUR_STEPS.length,
    );
    expect(TOUR_STEPS[0]?.page).toBe("prompts");
    expect(TOUR_STEPS.at(-1)?.id).toBe("storyboard");
  });

  it("resumes at the saved step", () => {
    expect(resumeIndex({ step: "attach", completedAt: null })).toBe(
      TOUR_STEPS.findIndex((step) => step.id === "attach"),
    );
  });

  it("starts at the first step for the stages before the tour", () => {
    expect(resumeIndex({ step: "prompts", completedAt: null })).toBe(0);
    expect(resumeIndex({ step: "brand", completedAt: null })).toBe(0);
  });

  it("never shows to accounts that never started or already finished", () => {
    expect(resumeIndex({ step: null, completedAt: null })).toBeNull();
    expect(
      resumeIndex({ step: "attach", completedAt: "2026-10-16T00:00:00Z" }),
    ).toBeNull();
  });

  it("recognises a new account only by the API's newAccount flag", () => {
    expect(isNewAccountLanding(new URLSearchParams("newAccount=1"))).toBe(true);
    expect(isNewAccountLanding(new URLSearchParams("newAccount=0"))).toBe(
      false,
    );
    expect(isNewAccountLanding(new URLSearchParams())).toBe(false);
  });
});

describe("TourCoach", () => {
  function target(name: string) {
    const element = document.createElement("button");
    element.dataset["tour"] = name;
    element.getBoundingClientRect = () => ({
      top: 10,
      left: 10,
      right: 110,
      bottom: 40,
      width: 100,
      height: 30,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    });
    element.scrollIntoView = () => {};
    document.body.append(element);
    return element;
  }

  function coach(calls: string[]) {
    const host = document.createElement("div");
    document.body.append(host);
    return mount(TourCoach, {
      target: host,
      props: {
        steps: TOUR_STEPS.filter((step) => step.page === "create").slice(0, 2),
        index: 0,
        onNext: () => calls.push("next"),
        onBack: () => calls.push("back"),
        onDone: (skipped: boolean) => calls.push(skipped ? "skipped" : "done"),
      },
    });
  }

  const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeEach(() => document.body.replaceChildren());

  it("skips a step whose target is not on screen", async () => {
    target("attach");
    const calls: string[] = [];
    const component = coach(calls);
    // The coach waits a moment for a target that may still be rendering.
    await settle(1000);
    expect(calls).toEqual(["next"]);
    unmount(component);
  });

  it("shows the step and ends the tour on Skip and Escape", async () => {
    target("prompt");
    const calls: string[] = [];
    const component = coach(calls);
    await settle();
    flushSync();
    expect(document.body.textContent).toContain("This is where you prompt");
    expect(document.querySelector(".tour--visible")).not.toBeNull();

    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === "Skip tour")
      ?.click();
    document
      .querySelector<HTMLElement>("[role='dialog']")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    expect(calls).toEqual(["skipped", "skipped"]);
    unmount(component);
  });
});

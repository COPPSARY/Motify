import { flushSync, mount, unmount } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import TourCoach from "./TourCoach.svelte";
import {
  clearTour,
  loadTour,
  readHandoff,
  saveTour,
  startingTour,
  stepsFor,
} from "./tour";

describe("first-run tour state", () => {
  beforeEach(() => sessionStorage.clear());

  it("reads the site's hand-off only when tour=1", () => {
    expect(readHandoff(new URLSearchParams("level=beginner"))).toBeNull();
    expect(
      readHandoff(
        new URLSearchParams(
          "tour=1&level=experienced&goal=launch&brandName=Acme",
        ),
      ),
    ).toEqual({
      level: "experienced",
      goal: "launch",
      brandName: "Acme",
    });
    expect(readHandoff(new URLSearchParams("tour=1&level=wizard"))?.level).toBe(
      "beginner",
    );
  });

  it("tailors the tour to the level, and gives experts none", () => {
    expect(stepsFor("beginner").map((step) => step.target)).toEqual([
      "tiffy",
      "prompt",
      "attach",
      "format",
      "export",
      "home",
    ]);
    expect(stepsFor("experienced").map((step) => step.target)).toEqual([
      "prompt",
      "attach",
      "export",
    ]);
    expect(stepsFor("expert")).toEqual([]);
  });

  it("starts fresh from a hand-off and resumes after a reload", () => {
    const started = startingTour(
      new URLSearchParams("tour=1&level=beginner"),
      sessionStorage,
    );
    expect(started?.index).toBe(0);

    saveTour(sessionStorage, { ...started!, index: 2 });
    expect(startingTour(new URLSearchParams(""), sessionStorage)?.index).toBe(
      2,
    );
  });

  it("does not come back once skipped or finished", () => {
    startingTour(
      new URLSearchParams("tour=1&level=experienced"),
      sessionStorage,
    );
    clearTour(sessionStorage);
    expect(startingTour(new URLSearchParams(""), sessionStorage)).toBeNull();

    saveTour(sessionStorage, {
      level: "experienced",
      goal: "",
      brandName: "",
      index: 3,
    });
    expect(startingTour(new URLSearchParams(""), sessionStorage)).toBeNull();
    expect(loadTour(sessionStorage)).toBeNull();
  });

  it("gives experts nothing and ignores corrupt storage", () => {
    expect(
      startingTour(new URLSearchParams("tour=1&level=expert"), sessionStorage),
    ).toBeNull();
    sessionStorage.setItem("motify_tour", "{not json");
    expect(loadTour(sessionStorage)).toBeNull();
  });
});

describe("TourCoach", () => {
  function target(name: string) {
    const element = document.createElement("button");
    element.dataset.tour = name;
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
        steps: stepsFor("experienced"),
        index: 0,
        onNext: () => calls.push("next"),
        onBack: () => calls.push("back"),
        onDone: (skipped: boolean) => calls.push(skipped ? "skipped" : "done"),
      },
    });
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => document.body.replaceChildren());

  it("skips a step whose target is not on screen", async () => {
    target("attach");
    const calls: string[] = [];
    const component = coach(calls);
    await settle();
    expect(calls).toEqual(["next"]);
    unmount(component);
  });

  it("shows the step and ends the tour on Skip and Escape", async () => {
    target("prompt");
    const calls: string[] = [];
    const component = coach(calls);
    await settle();
    flushSync();
    expect(document.body.textContent).toContain("Ask for changes");
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

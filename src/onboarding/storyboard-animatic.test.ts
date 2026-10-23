import gsap from "gsap";
import { afterEach, describe, expect, it } from "vitest";

import type { StoryboardBeat } from "../cloud/projects-api";
import {
  animaticScenes,
  cameraMove,
  storyboardAnimatic,
} from "./storyboard-animatic";

function beat(
  title: string,
  start: number,
  duration: number,
  extra: Partial<StoryboardBeat> = {},
): StoryboardBeat {
  return {
    title,
    start,
    duration,
    shows: [],
    action: "",
    camera: "",
    text: "",
    ...extra,
  };
}

const beats = [
  beat("Hook", 0, 4, { text: "Meet Ledger", camera: "Push in" }),
  beat("Tour", 4, 6, {
    shows: ["screen-1", "missing"],
    action: "Taps Share.",
    camera: "Pan across",
  }),
  beat("Close", 10, 5, { action: "The logo lands." }),
];

function draw(aspect: "16:9" | "9:16" = "16:9") {
  const definition = storyboardAnimatic({
    beats,
    seconds: 15,
    aspect,
    pictures: new Map([["screen-1", "blob:screen-1"]]),
  });
  const root = document.createElement("div");
  document.body.append(root);
  const timeline = gsap.timeline({ paused: true });
  definition.build({
    root,
    element: root,
    container: root,
    timeline,
    width: definition.width,
    height: definition.height,
    orientation: aspect === "16:9" ? "landscape" : "portrait",
    register: (_id, element) => element,
  });
  const sections = [...root.querySelectorAll<HTMLElement>("[data-beat]")];
  const visible = (time: number) => {
    timeline.totalTime(time, false);
    return sections
      .filter((section) => section.style.visibility !== "hidden")
      .map((section) => Number(section.dataset["beat"]));
  };
  return { definition, root, timeline, sections, visible };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("storyboard animatic", () => {
  it("is as long as the film, on the canvas the person picked", () => {
    const landscape = draw("16:9");
    expect(landscape.definition.duration).toBe(15);
    expect(landscape.timeline.duration()).toBe(15);
    expect([landscape.definition.width, landscape.definition.height]).toEqual([
      1920, 1080,
    ]);
    const portrait = storyboardAnimatic({
      beats,
      seconds: 15,
      aspect: "9:16",
      pictures: new Map(),
    });
    expect([portrait.width, portrait.height]).toEqual([1080, 1920]);
  });

  it("shows each beat only during its own time, from any seek", () => {
    const { visible } = draw();
    expect(visible(1)).toEqual([1]);
    expect(visible(12)).toEqual([3]);
    // Back again: the earlier beat returns and the later one is gone.
    expect(visible(5)).toEqual([2]);
    expect(visible(0.5)).toEqual([1]);
  });

  it("shows the person's own pictures and nothing it was not given", () => {
    const { sections } = draw();
    const pictures = [...sections[1]!.querySelectorAll("img")].map((image) =>
      image.getAttribute("src"),
    );
    expect(pictures).toEqual(["blob:screen-1"]);
  });

  it("writes the on-screen words a word at a time, and grey-boxes the rest", () => {
    const { sections } = draw();
    expect(
      [...sections[0]!.querySelectorAll("span")].map(
        (span) => span.textContent,
      ),
    ).toEqual(["Meet", "Ledger"]);
    expect(sections[2]!.textContent).toContain("The logo lands.");
  });

  it("names one scene per beat, so the player knows which is on screen", () => {
    expect(animaticScenes(beats).map((scene) => scene.id)).toEqual([
      "beat-1",
      "beat-2",
      "beat-3",
    ]);
  });

  it("reads the camera move loosely from the beat's words", () => {
    expect(cameraMove("Slow push in on the button")).toBe("push");
    expect(cameraMove("Pull back to reveal the desk")).toBe("pull");
    expect(cameraMove("Pan across the cards")).toBe("pan");
    expect(cameraMove("Hold")).toBe("drift");
  });
});

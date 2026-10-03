import { describe, expect, it } from "vitest";
import {
  editableElementAtPoint,
  isElementActuallyVisible,
} from "../../src/ui/selection-hit-test";

function rect(
  element: Element,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: left,
      y: top,
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      toJSON: () => ({}),
    }),
  });
}

function register(
  entries: Array<[string, HTMLElement]>,
): Map<string, HTMLElement> {
  for (const [id, element] of entries) element.dataset.motionlyId = id;
  return new Map(entries);
}

describe("canvas selection hit testing", () => {
  it("selects giant text instead of classifying it as a background", () => {
    const root = document.createElement("div");
    const stage = document.createElement("main");
    const world = document.createElement("div");
    const title = document.createElement("h1");
    world.dataset.cameraWorld = "";
    title.textContent = "One enormous thought";
    root.append(stage);
    stage.append(world);
    world.append(title);
    rect(root, 0, 0, 1000, 600);
    rect(stage, 0, 0, 1000, 600);
    rect(world, 0, 0, 1000, 600);
    rect(title, 20, 20, 960, 560);
    document.body.append(root);

    const elements = register([
      ["stage", stage],
      ["world", world],
      ["title", title],
    ]);
    expect(
      editableElementAtPoint({
        root,
        elements,
        clientX: 500,
        clientY: 300,
        pointStack: [title, world, stage],
      }),
    ).toBe(title);
  });

  it("does not let an opacity-zero descendant select its visible scene wrapper", () => {
    const root = document.createElement("div");
    const stage = document.createElement("main");
    const hiddenScene = document.createElement("section");
    const hiddenFace = document.createElement("div");
    const visibleTitle = document.createElement("h1");
    hiddenScene.dataset.scene = "hidden";
    hiddenFace.style.opacity = "0";
    visibleTitle.textContent = "Visible title";
    root.append(stage);
    stage.append(visibleTitle, hiddenScene);
    hiddenScene.append(hiddenFace);
    for (const element of [
      root,
      stage,
      hiddenScene,
      hiddenFace,
      visibleTitle,
    ]) {
      rect(element, 0, 0, 1000, 600);
    }
    document.body.append(root);

    const elements = register([
      ["stage", stage],
      ["visible-title", visibleTitle],
      ["hidden-scene", hiddenScene],
    ]);
    expect(isElementActuallyVisible(hiddenFace, root)).toBe(false);
    expect(
      editableElementAtPoint({
        root,
        elements,
        clientX: 500,
        clientY: 300,
        pointStack: [hiddenFace, visibleTitle, hiddenScene, stage],
      }),
    ).toBe(visibleTitle);
  });

  it("uses a deterministic text-first fallback for pointer-events-none layers", () => {
    const root = document.createElement("div");
    const stage = document.createElement("main");
    const shape = document.createElement("div");
    const title = document.createElement("h1");
    title.textContent = "Pick me";
    root.append(stage);
    stage.append(shape, title);
    rect(root, 0, 0, 1000, 600);
    rect(stage, 0, 0, 1000, 600);
    rect(shape, 300, 200, 400, 200);
    rect(title, 300, 200, 400, 200);
    document.body.append(root);

    const elements = register([
      ["stage", stage],
      ["shape", shape],
      ["title", title],
    ]);
    expect(
      editableElementAtPoint({
        root,
        elements,
        clientX: 500,
        clientY: 300,
        pointStack: [stage],
      }),
    ).toBe(title);
  });
});

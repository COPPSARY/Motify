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

  it("clicks through a frame-covering layer on top to the layer beneath", () => {
    const root = document.createElement("div");
    const stage = document.createElement("main");
    const background = document.createElement("img");
    const logo = document.createElement("img");
    const texture = document.createElement("img");
    root.append(stage);
    stage.append(background, logo, texture);
    rect(root, 0, 0, 1000, 600);
    rect(stage, 0, 0, 1000, 600);
    rect(background, 0, 0, 1000, 600);
    rect(logo, 100, 100, 200, 100);
    rect(texture, 0, 0, 1000, 600);
    document.body.append(root);

    const elements = register([
      ["stage", stage],
      ["background", background],
      ["logo", logo],
      ["texture", texture],
    ]);
    const at = (x: number, y: number, pointStack: Element[]) =>
      editableElementAtPoint({
        root,
        elements,
        clientX: x,
        clientY: y,
        pointStack,
      });
    // The logo is under the texture: it is what gets picked.
    expect(at(150, 150, [texture, logo, background, stage])).toBe(logo);
    // Where only frame-covering layers are, the topmost is picked.
    expect(at(800, 500, [texture, background, stage])).toBe(texture);
  });

  it("picks the backdrop that is seen, not a faint overlay over it", () => {
    const root = document.createElement("div");
    const stage = document.createElement("main");
    const background = document.createElement("img");
    const overlay = document.createElement("img");
    overlay.style.opacity = "0.3";
    root.append(stage);
    stage.append(background, overlay);
    rect(root, 0, 0, 1000, 600);
    rect(stage, 0, 0, 1000, 600);
    rect(background, 0, 0, 1000, 600);
    // Far larger than the frame, as imported Photoshop shapes often are.
    rect(overlay, -200, -300, 2500, 2000);
    document.body.append(root);

    const elements = register([
      ["stage", stage],
      ["background", background],
      ["overlay", overlay],
    ]);
    expect(
      editableElementAtPoint({
        root,
        elements,
        clientX: 500,
        clientY: 300,
        pointStack: [overlay, background, stage],
      }),
    ).toBe(background);
  });

  it("lets a layer win the click when only part of it is on the frame", () => {
    const root = document.createElement("div");
    const stage = document.createElement("main");
    const background = document.createElement("img");
    const logo = document.createElement("img");
    root.append(stage);
    stage.append(background, logo);
    rect(root, 0, 0, 1000, 600);
    rect(stage, 0, 0, 1000, 600);
    rect(background, 0, 0, 1000, 600);
    // A big box mostly off the canvas: half of the frame, not a backdrop.
    rect(logo, 500, -400, 900, 1000);
    document.body.append(root);

    const elements = register([
      ["stage", stage],
      ["background", background],
      ["logo", logo],
    ]);
    expect(
      editableElementAtPoint({
        root,
        elements,
        clientX: 700,
        clientY: 300,
        pointStack: [logo, background, stage],
      }),
    ).toBe(logo);
  });

  it("never lets giant text yield to what is under it", () => {
    const root = document.createElement("div");
    const stage = document.createElement("main");
    const logo = document.createElement("div");
    const title = document.createElement("h1");
    title.textContent = "Enormous";
    root.append(stage);
    stage.append(logo, title);
    rect(root, 0, 0, 1000, 600);
    rect(stage, 0, 0, 1000, 600);
    rect(logo, 100, 100, 200, 100);
    rect(title, 0, 0, 1000, 600);
    document.body.append(root);

    const elements = register([
      ["stage", stage],
      ["logo", logo],
      ["title", title],
    ]);
    expect(
      editableElementAtPoint({
        root,
        elements,
        clientX: 150,
        clientY: 150,
        pointStack: [title, logo, stage],
      }),
    ).toBe(title);
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

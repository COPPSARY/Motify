import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createDynamicComposition } from "../../src/composition/dynamic-compiler";
import { CompositionRuntime } from "../../src/composition/runtime";
import {
  SCENE_KIT_CSS,
  SCENE_KIT_ICONS,
  mountSceneKit,
} from "../../src/composition/scene-kit";

const cookbook = readFileSync(
  ".agents/skills/scene-design/components.md",
  "utf8",
);

describe("scene kit", () => {
  it("mounts inside the composition root, where export can see it", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(
      createDynamicComposition(
        `<template><main class="mk-stage mk-theme-midnight" data-edit="stage"><h1 class="mk-display" data-edit="headline">Ship it</h1></main></template>`,
        "export function buildTimeline() {}",
      ),
      root,
    );
    try {
      const style = root.querySelector<HTMLStyleElement>(
        "style[data-motionly-kit]",
      );
      expect(style?.textContent).toContain(".mk-stage");
      expect(root.querySelector("#mk-i-sparkle")).not.toBeNull();
      expect(root.querySelector("#mk-cursor")).not.toBeNull();
    } finally {
      runtime.destroy();
      root.remove();
    }
  });

  /**
   * The validator measures what is visible. Both kit nodes are hidden, so a
   * film is judged exactly as it was before the kit existed.
   */
  it("adds nothing visible and nothing editable", () => {
    const root = document.createElement("div");
    mountSceneKit(root);
    const nodes = Array.from(root.children) as HTMLElement[];
    expect(nodes).toHaveLength(2);
    for (const node of nodes) {
      expect(getComputedStyle(node).display).toBe("none");
      expect(node.querySelector("[data-edit]")).toBeNull();
      expect(node.hasAttribute("data-edit")).toBe(false);
    }
  });

  /**
   * The cookbook is what the model copies. A class or icon it names that the
   * kit does not define renders as nothing at all, silently.
   */
  it("defines every class the cookbook uses", () => {
    const defined = new Set(
      [...SCENE_KIT_CSS.matchAll(/\.(mk-[a-z0-9-]+)/g)].map(
        (match) => match[1],
      ),
    );
    const used = new Set(
      [...cookbook.matchAll(/class="([^"]+)"/g)]
        .flatMap((match) => (match[1] ?? "").split(/\s+/))
        .filter((name) => name.startsWith("mk-")),
    );
    const missing = [...used].filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
    expect(used.size).toBeGreaterThan(30);
  });

  it("draws every icon the cookbook references or lists", () => {
    const referenced = [...cookbook.matchAll(/#mk-i-([a-z-]+)/g)].map(
      (match) => match[1] ?? "",
    );
    const listed = /Names:\s*([\s\S]*?)\./.exec(cookbook)?.[1] ?? "";
    const names = new Set([
      ...referenced.filter((name) => name !== "NAME"),
      ...listed
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    ]);
    const missing = [...names].filter((name) => !(name in SCENE_KIT_ICONS));
    expect(missing).toEqual([]);
    expect(
      Object.keys(SCENE_KIT_ICONS).every((name) => listed.includes(name)),
    ).toBe(true);
  });

  /**
   * An exported film held a perfectly still ground for twenty-two seconds. The
   * kit's light is a function of film progress, which the runtime writes on
   * every seek — not a tween, so it cannot extend the film's measured end.
   */
  it("drives the living ground from film progress on every seek", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const runtime = new CompositionRuntime(
      createDynamicComposition(
        `<template><main class="mk-stage mk-theme-midnight" data-edit="stage"><h1 data-edit="headline">Ship it</h1></main></template>`,
        "export function buildTimeline({ root, timeline }) { timeline.to(root.querySelector('h1'), { x: 10, duration: 10 }, 0); }",
        { duration: 10 },
      ),
      root,
    );
    try {
      runtime.seek(5);
      expect(root.style.getPropertyValue("--mk-t")).toBe("0.5000");
      runtime.seek(10);
      expect(root.style.getPropertyValue("--mk-t")).toBe("1.0000");
      // No tween was added: the film's measured length is the model's own.
      expect(runtime.timeline.duration()).toBeCloseTo(10, 5);
    } finally {
      runtime.destroy();
      root.remove();
    }
    expect(SCENE_KIT_CSS).toMatch(/\.mk-stage::before \{[^}]*var\(--mk-t/);
  });

  /**
   * A live film kept `class="beat"` but dropped the `.beat` style the cookbook
   * relied on, leaving every beat a zero-height block. Once a transition put a
   * transform on it, `mk-center` centred inside that block and each subject sat
   * with its middle on the top edge of the frame.
   */
  it("makes every beat on the stage a full-frame layer by itself", () => {
    const rule = /:where\(\.mk-stage > \[data-scene\]\)\s*\{[^}]*\}/.exec(
      SCENE_KIT_CSS,
    )?.[0];
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("inset: 0");
    expect(cookbook).not.toMatch(/\.beat\s*\{/);
  });

  /**
   * Resized to the frame, the horizon pulled the whole planet into view as a
   * giant dark oval with a rim down both sides.
   */
  it("locks the horizon's geometry", () => {
    const horizon = /\.mk-horizon \{[^}]*\}/.exec(SCENE_KIT_CSS)?.[0] ?? "";
    for (const property of ["top", "left", "right", "height"]) {
      expect(horizon).toMatch(new RegExp(`\\b${property}: [^;]*!important`));
    }
  });

  /**
   * A live film put `mk-horizon` on the light sky theme, and the planet's fixed
   * dark fill laid a black dome over the bottom half of every frame.
   */
  it("fills the horizon from the theme rather than a fixed dark", () => {
    const horizon = /\.mk-horizon \{[^}]*\}/.exec(SCENE_KIT_CSS)?.[0] ?? "";
    expect(horizon).toContain("var(--mk-horizon-fill, transparent)");
    expect(horizon).not.toMatch(/closest-side, #[0-9a-f]{3,6}/i);
  });

  /**
   * Text presets split a phrase into transformed word spans. A clip-to-text
   * gradient on the parent cannot paint into them, so a revealed headline's
   * highlighted words rendered transparent and the line went missing.
   */
  it("paints gradient text into split words", () => {
    expect(SCENE_KIT_CSS).toMatch(
      /\.mk-gradient-text,\s*\.mk-gradient-text \*/,
    );
  });

  /**
   * `class="mk-glass mk-abs"` is the natural way to float a panel. A surface
   * rule declaring `position: relative` after `.mk-abs` silently won and put
   * the panel back into flow, stretched across the frame.
   */
  it("never lets a surface override absolute positioning", () => {
    const plain = SCENE_KIT_CSS.replace(/\/\*[\s\S]*?\*\//g, "").replace(
      /:where\([^)]*\)\s*\{[^}]*\}/g,
      "",
    );
    for (const block of plain.matchAll(/(\.[^{]+)\{([^}]*)\}/g)) {
      const selector = (block[1] ?? "").trim();
      if (selector === ".mk-stage") continue;
      expect(`${selector}: ${block[2]}`).not.toMatch(/position:\s*relative/);
    }
  });
});

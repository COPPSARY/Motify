import gsap from "gsap";
import { describe, expect, it } from "vitest";

import { createDynamicComposition } from "./dynamic-compiler";
import { scopeFilmCss, scopeFilmStyles } from "./scope-css";

const S = ':where([data-film-scope="k"])';
const squash = (css: string) => css.replace(/\s+/g, " ").trim();

describe("scopeFilmCss", () => {
  it("confines bare type rules, classes and lists to the film root", () => {
    expect(
      squash(scopeFilmCss("section { position: absolute; inset: 0; }", "k")),
    ).toBe(`${S} section { position: absolute; inset: 0; }`);
    expect(
      squash(scopeFilmCss(".card, h1 > span:hover, *{color:red}", "k")),
    ).toBe(`${S} .card, ${S} h1 > span:hover, ${S} * {color:red}`);
  });

  it("makes html, body and :root mean the film root", () => {
    expect(squash(scopeFilmCss(":root { --accent: red; }", "k"))).toBe(
      `${S} { --accent: red; }`,
    );
    expect(squash(scopeFilmCss("html body .title { color: red; }", "k"))).toBe(
      `${S} .title { color: red; }`,
    );
    expect(squash(scopeFilmCss("body > main { margin: 0; }", "k"))).toBe(
      `${S} main { margin: 0; }`,
    );
    expect(squash(scopeFilmCss("body.dark .x { color: red; }", "k"))).toBe(
      `${S}.dark .x { color: red; }`,
    );
    // Only the whole word: a class that merely starts with "body" is a normal selector.
    expect(squash(scopeFilmCss(".body-copy { color: red; }", "k"))).toBe(
      `${S} .body-copy { color: red; }`,
    );
    expect(squash(scopeFilmCss("bodyguard { color: red; }", "k"))).toBe(
      `${S} bodyguard { color: red; }`,
    );
  });

  it("does not split commas inside :is(), attribute values or strings", () => {
    expect(
      squash(scopeFilmCss(':is(h1, h2) [data-x="a,b"] { color: red; }', "k")),
    ).toBe(`${S} :is(h1, h2) [data-x="a,b"] { color: red; }`);
  });

  it("scopes inside @media and @supports, and leaves @keyframes and @font-face alone", () => {
    const css = `
      @media (max-width: 600px) { section { padding: 0; } .a, .b { gap: 0; } }
      @supports (display: grid) { .grid { display: grid; } }
      @keyframes rise { from { opacity: 0; } to { opacity: 1; } }
      @font-face { font-family: "X"; src: url("x.woff2"); }
      @import url("fonts.css");
    `;
    const scoped = squash(scopeFilmCss(css, "k"));
    expect(scoped).toContain(
      `@media (max-width: 600px) { ${S} section { padding: 0; } ${S} .a, ${S} .b { gap: 0; } }`,
    );
    expect(scoped).toContain(
      `@supports (display: grid) { ${S} .grid { display: grid; } }`,
    );
    expect(scoped).toContain(
      "@keyframes rise { from { opacity: 0; } to { opacity: 1; } }",
    );
    expect(scoped).toContain(
      '@font-face { font-family: "X"; src: url("x.woff2"); }',
    );
    expect(scoped).toContain('@import url("fonts.css");');
  });

  it("is not confused by braces in comments or strings", () => {
    const css =
      '/* } section { */ .quote::before { content: "{"; } section { top: 0; }';
    const scoped = squash(scopeFilmCss(css, "k"));
    expect(scoped).toContain(`${S} .quote::before { content: "{"; }`);
    expect(scoped).toContain(`${S} section { top: 0; }`);
  });

  it("keeps native nesting relative to the scoped parent", () => {
    expect(
      squash(
        scopeFilmCss(
          ".card { color: red; & .title { font-weight: 700; } }",
          "k",
        ),
      ),
    ).toBe(`${S} .card { color: red; & .title { font-weight: 700; } }`);
  });
});

describe("scopeFilmStyles", () => {
  function editorWithFilm(css: string) {
    document.body.innerHTML =
      '<section class="me-scene-bar">timeline</section><div class="me-canvas"></div>';
    const root = document.querySelector<HTMLElement>(".me-canvas")!;
    root.innerHTML = `<style>${css}</style><section class="scene">Hello</section>`;
    return {
      root,
      editorBar: document.querySelector<HTMLElement>(".me-scene-bar")!,
      scene: root.querySelector<HTMLElement>(".scene")!,
    };
  }

  it("stops a film's bare section rule from reaching the editor's own section", () => {
    const { root, editorBar, scene } = editorWithFilm(
      "section { position: absolute; inset: 0; z-index: 2; }",
    );
    scopeFilmStyles(root);

    const scopeId = root.dataset["filmScope"]!;
    expect(scopeId).toBeTruthy();
    const style = root.querySelector("style")!;
    const selector = /^(.*?)\{/.exec(style.textContent!.trim())![1]!.trim();
    expect(scene.matches(selector)).toBe(true);
    expect(editorBar.matches(selector)).toBe(false);
    expect(getComputedStyle(editorBar).position).not.toBe("absolute");
  });

  it("rewrites each style once, however often it runs", () => {
    const { root } = editorWithFilm("section { top: 0; }");
    scopeFilmStyles(root);
    const once = root.querySelector("style")!.textContent;
    scopeFilmStyles(root);
    expect(root.querySelector("style")!.textContent).toBe(once);
  });

  it("is applied when a generated film is built", () => {
    document.body.innerHTML =
      '<section class="me-scene-bar"></section><div class="stage"></div>';
    const root = document.querySelector<HTMLElement>(".stage")!;
    const composition = createDynamicComposition(
      '<template><style>section { position: absolute; }</style><section data-edit="intro">Hi</section></template>',
      "function buildTimeline() {}",
      { duration: 1 },
    );
    composition.build({
      root,
      element: root,
      container: root,
      timeline: gsap.timeline({ paused: true }),
      register: () => undefined,
    } as never);
    const css = root.querySelector("style")!.textContent!;
    expect(css).toContain(
      `:where([data-film-scope="${root.dataset["filmScope"]}"]) section`,
    );
    expect(
      document
        .querySelector(".me-scene-bar")!
        .matches(/^(.*?)\{/.exec(css.trim())![1]!.trim()),
    ).toBe(false);
  });
});

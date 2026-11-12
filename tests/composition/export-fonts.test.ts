import { afterEach, describe, expect, it, vi } from "vitest";

import {
  exportFontCss,
  inlineFontFaces,
} from "../../src/composition/frame-render";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch() {
  // A string body, not a jsdom Blob: Node 20's fetch Response does not accept
  // a Blob from another realm and rejects, which the code under test swallows.
  const fetch = vi.fn(
    async (url: string) =>
      new Response(`font:${url}`, {
        headers: { "content-type": "font/woff2" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("export fonts", () => {
  it("embeds the bundled faces a film names, plus Inter, as data URLs", async () => {
    stubFetch();
    const css = await exportFontCss(
      `<main style="font-family:&quot;Fraunces&quot;, serif">x</main>`,
    );
    expect(css).toContain('font-family:"Fraunces"');
    expect(css).toContain('font-family:"Inter"');
    expect(css).not.toContain('font-family:"Oswald"');
    expect(css).toMatch(/src:url\(data:/);
  });

  it("leaves out a face the film declares but sets nothing in", async () => {
    stubFetch();
    // The scene kit declares every bundled face in each film.
    const css = await exportFontCss(
      `<style>@font-face{font-family:"Oswald";src:url(/oswald.woff2)}@font-face{font-family:"Oswald Variable";src:url(/oswald.woff2)}h1{font-family:"Fraunces"}</style><h1>x</h1>`,
    );
    expect(css).toContain('font-family:"Fraunces"');
    expect(css).not.toContain("Oswald");
  });

  it("declares a family's fontsource name only for a film that uses it", async () => {
    stubFetch();
    const plain = await exportFontCss(
      `<p style="font-family:Fraunces, serif">x</p>`,
    );
    expect(plain).toContain('font-family:"Fraunces"');
    expect(plain).not.toContain('font-family:"Fraunces Variable"');
    const variable = await exportFontCss(
      `<p style="font-family:'Fraunces Variable', serif">x</p>`,
    );
    expect(variable).toContain('font-family:"Fraunces"');
    expect(variable).toContain('font-family:"Fraunces Variable"');
  });

  it("inlines a brand's own @font-face files, which an SVG image cannot fetch", async () => {
    const fetch = stubFetch();
    const clone = document.createElement("div");
    clone.innerHTML = `<style>@font-face { font-family: "Brand Sans"; src: url("https://cdn.example/brand.woff2") format("woff2"); } h1 { font-family: "Brand Sans" }</style>`;
    await inlineFontFaces(clone);
    const css = clone.querySelector("style")?.textContent ?? "";
    expect(fetch).toHaveBeenCalledWith("https://cdn.example/brand.woff2");
    expect(css).not.toContain("https://cdn.example/brand.woff2");
    expect(css).toMatch(/url\("data:/);
  });
});

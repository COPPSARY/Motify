import { afterEach, describe, expect, it, vi } from "vitest";

import {
  exportFontCss,
  inlineFontFaces,
} from "../../src/composition/frame-render";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch() {
  const fetch = vi.fn(
    async (url: string) =>
      new Response(new Blob([`font:${url}`], { type: "font/woff2" })),
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

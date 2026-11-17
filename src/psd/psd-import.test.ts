import gsap from "gsap";
import type { Layer, Psd } from "ag-psd";
import { describe, expect, it } from "vitest";
import { resolveGenerationBasis } from "../ai/generation-basis";
import { combineCompositionSource } from "../cloud/project-source";
import { createDynamicComposition } from "../composition/dynamic-compiler";
import type { CompositionContext } from "../composition/types";
import {
  PSD_MAX_LAYERS,
  PsdImportError,
  buildPsdProject,
  drawsPixels,
  flattenLayers,
  isPsdImport,
  mapPsd,
  parseFontName,
  type PsdDocument,
} from "./psd-import";

/** Stands in for a layer's pixels; jsdom has no canvas to draw them. */
function pixels(width: number, height: number): HTMLCanvasElement {
  return { width, height } as HTMLCanvasElement;
}

function image(
  name: string,
  left: number,
  top: number,
  w: number,
  h: number,
  extra: Partial<Layer> = {},
): Layer {
  return {
    name,
    left,
    top,
    right: left + w,
    bottom: top + h,
    opacity: 1,
    canvas: pixels(w, h),
    ...extra,
  };
}

function headline(extra: Partial<Layer> = {}): Layer {
  return {
    name: "Headline",
    left: 120,
    top: 300,
    right: 820,
    bottom: 380,
    opacity: 1,
    canvas: pixels(700, 80),
    text: {
      text: "Fresh coffee\r",
      // Point text: the anchor is the first baseline at (120, 370); 40pt drawn at 2x.
      transform: [2, 0, 0, 2, 120, 370],
      style: {
        font: { name: "Montserrat-Bold" },
        fontSize: 40,
        fillColor: { r: 20, g: 30, b: 40 },
      },
      paragraphStyle: { justification: "left" },
    },
    ...extra,
  };
}

function poster(children: Layer[], extra: Partial<Psd> = {}): Psd {
  return { width: 1080, height: 1350, children, ...extra };
}

describe("mapPsd", () => {
  it("keeps names, hierarchy, positions, opacity and visibility", () => {
    const document = mapPsd(
      poster([
        image("Background", 0, 0, 1080, 1350),
        {
          name: "Header",
          opacity: 0.5,
          children: [
            image("Logo", 40, 60, 200, 100),
            image("Stage", 900, 40, 100, 100, { hidden: true }),
          ],
        },
        headline(),
      ]),
      "Coffee",
    );
    expect(document).toMatchObject({
      name: "Coffee",
      width: 1080,
      height: 1350,
    });
    const [background, header, title] = document.layers;
    expect(background).toMatchObject({
      id: "background",
      kind: "image",
      left: 0,
      top: 0,
      width: 1080,
      height: 1350,
    });
    expect(header).toMatchObject({
      id: "header",
      kind: "group",
      opacity: 0.5,
      left: 40,
      top: 40,
      width: 960,
      height: 120,
    });
    // "stage" is the film's own root, so a layer named Stage gets another id.
    expect(header!.children.map((child) => [child.id, child.hidden])).toEqual([
      ["logo", false],
      ["stage-2", true],
    ]);
    expect(title).toMatchObject({ id: "headline", kind: "text" });
    expect(title!.text).toMatchObject({
      align: "left",
      wraps: false,
      left: 120,
    });
    expect(title!.text!.runs).toEqual([
      {
        text: "Fresh coffee",
        style: expect.objectContaining({
          fontFamily: "Montserrat",
          fontWeight: 700,
          fontSize: 80,
          color: "#141e28",
        }),
      },
    ]);
    // The first baseline lands on Photoshop's anchor.
    expect(title!.text!.top).toBeGreaterThan(280);
    expect(title!.text!.top).toBeLessThan(300);
    expect(document.missingFonts).toEqual(["Montserrat"]);
  });

  it("keeps text it cannot rebuild as Photoshop's pixels, and says why", () => {
    const [rotated] = mapPsd(
      poster([
        headline({
          text: { text: "Sale", transform: [0.7, 0.7, -0.7, 0.7, 100, 100] },
        }),
      ]),
      "x",
    ).layers;
    expect(rotated).toMatchObject({ kind: "text", textAsImage: true });
    expect(drawsPixels(rotated!)).toBe(true);
    expect(rotated!.notes).toContain(
      "Kept as an image because the text is rotated.",
    );
  });

  it("blends layers the way Photoshop does, wherever CSS can", () => {
    const document = mapPsd(
      poster([
        image("Texture", 0, 0, 1080, 1350, { blendMode: "overlay" }),
        image("Glow", 0, 0, 100, 100, { blendMode: "linear dodge" }),
      ]),
      "x",
    );
    const [texture, glow] = document.layers;
    expect(texture).toMatchObject({ blend: "overlay", notes: [] });
    expect(glow).toMatchObject({ blend: "plus-lighter", notes: [] });
    const html = buildPsdProject(
      document,
      new Map([
        ["texture", "t.png"],
        ["glow", "g.png"],
      ]),
      { duration: 5 },
    ).files["composition.html"];
    expect(html).toMatch(/data-edit="texture"[^>]*mix-blend-mode:overlay/);
  });

  it("draws blend modes CSS lacks with the closest one, and says so", () => {
    const [vivid, divide] = mapPsd(
      poster([
        image("Light", 0, 0, 100, 100, { blendMode: "vivid light" }),
        image("Split", 0, 0, 100, 100, { blendMode: "divide" }),
      ]),
      "x",
    ).layers;
    expect(vivid).toMatchObject({ blend: "hard-light" });
    expect(vivid!.notes).toEqual([
      "Blend mode “vivid light” is shown as Hard Light, the closest a video can draw.",
    ]);
    expect(divide!.blend).toBeUndefined();
    expect(divide!.notes).toEqual(["Blend mode “divide” is shown as Normal."]);
  });

  it("draws a group's layer style into the layers inside it", () => {
    const overlay = {
      solidFill: [
        { enabled: true, color: { r: 244, g: 132, b: 0 }, opacity: 1 },
      ],
    };
    const icons = mapPsd(
      poster([
        {
          name: "Icons",
          effects: overlay,
          children: [
            image("Bone", 100, 100, 60, 60),
            image("Heart", 400, 100, 60, 60),
          ],
        },
      ]),
      "x",
    );
    expect(icons.layers[0]!.notes.join(" ")).not.toContain(
      "Group layer style not imported",
    );
    expect(icons.layers[0]!.children.map((child) => child.name)).toEqual([
      "Bone",
      "Heart",
    ]);
    // Layers that overlap get it one by one too, and the review says so.
    const stacked = mapPsd(
      poster([
        {
          name: "Stack",
          effects: overlay,
          children: [
            image("Back", 100, 100, 60, 60),
            image("Front", 130, 130, 60, 60),
          ],
        },
      ]),
      "x",
    );
    expect(stacked.layers[0]!.notes.join(" ")).toContain(
      "can differ where they overlap",
    );
  });

  it("names what does not carry over, and leaves out what draws nothing", () => {
    const document = mapPsd(
      poster(
        [
          image("Photo", 0, 0, 500, 500),
          {
            name: "Selective",
            adjustment: { type: "selective color" },
          } as Layer,
          { name: "Empty", left: 0, top: 0, right: 0, bottom: 0 },
          { name: "Empty group", children: [] },
        ],
        { colorMode: 4 as Psd["colorMode"] },
      ),
      "x",
    );
    expect(document.layers.map((layer) => layer.name)).toEqual(["Photo"]);
    expect(document.notes).toContain(
      "Adjustment layer “Selective” is not applied: Selective Color cannot be applied.",
    );
    expect(document.notes.join(" ")).toContain("not in RGB colour");
  });

  it("applies an adjustment layer to what is under it, and only that", () => {
    const invert = { name: "Invert", adjustment: { type: "invert" } } as Layer;
    const [title, top] = mapPsd(
      poster([headline(), invert, headline({ name: "Above" })]),
      "x",
    ).layers;
    expect(title!.text!.runs[0]!.style.color).toBe("#ebe1d7");
    expect(top!.text!.runs[0]!.style.color).toBe("#141e28");
  });

  it("lets a pass-through group's adjustment reach below the group, not an isolated one's", () => {
    const group = (blendMode: Layer["blendMode"]): Layer => ({
      name: "Tone",
      blendMode,
      children: [
        image("Inside", 0, 0, 10, 10),
        { name: "Invert", adjustment: { type: "invert" } } as Layer,
      ],
    });
    const colorOf = (layers: Layer[]) =>
      mapPsd(poster(layers), "x").layers[0]!.text!.runs[0]!.style.color;
    expect(colorOf([headline(), group("pass through")])).toBe("#ebe1d7");
    expect(colorOf([headline(), group("normal")])).toBe("#141e28");
  });

  it("recolours only the layer a clipped adjustment is clipped to", () => {
    const [below, base] = mapPsd(
      poster([
        headline({ name: "Below" }),
        headline({ name: "Base" }),
        {
          name: "Invert",
          clipping: true,
          adjustment: { type: "invert" },
        } as Layer,
      ]),
      "x",
    ).layers;
    expect(below!.text!.runs[0]!.style.color).toBe("#141e28");
    expect(base!.text!.runs[0]!.style.color).toBe("#ebe1d7");
  });

  it("keeps styled text as Photoshop drew it, and live text's shadow as CSS", () => {
    const [stroked, shadowed] = mapPsd(
      poster([
        headline({
          name: "Stroked",
          effects: {
            stroke: [{ enabled: true, size: { units: "Pixels", value: 4 } }],
          },
        }),
        headline({
          name: "Shadowed",
          effects: {
            dropShadow: [
              {
                enabled: true,
                size: { units: "Pixels", value: 10 },
                distance: { units: "Pixels", value: 0 },
                color: { r: 0, g: 0, b: 0 },
                opacity: 0.5,
              },
            ],
          },
        }),
      ]),
      "x",
    ).layers;
    expect(stroked).toMatchObject({ kind: "text", textAsImage: true });
    expect(stroked!.text).toBeDefined();
    expect(stroked!.notes[0]).toMatch(/^Kept as an image to keep its stroke\./);
    expect(shadowed!.textAsImage).toBeUndefined();
    expect(shadowed!.filter).toBe(
      "drop-shadow(0px 0px 10px rgba(0, 0, 0, 0.5))",
    );
  });

  it("turns away files it cannot import, with what to do about it", () => {
    expect(() => mapPsd(poster([]), "x")).toThrow(PsdImportError);
    expect(() =>
      mapPsd(
        { width: 9000, height: 100, children: [image("A", 0, 0, 10, 10)] },
        "x",
      ),
    ).toThrow(/up to 8192 px/);
    const many = Array.from({ length: PSD_MAX_LAYERS + 1 }, (_, index) =>
      image(`L${index}`, 0, 0, 10, 10),
    );
    expect(() => mapPsd(poster(many), "x")).toThrow(
      /Merge small decorative layers/,
    );
  });
});

describe("parseFontName", () => {
  it.each([
    [
      "Montserrat-SemiBoldItalic",
      { family: "Montserrat", weight: 600, italic: true },
    ],
    ["ArialMT", { family: "Arial", weight: 400, italic: false }],
    [
      "TimesNewRomanPSMT",
      { family: "Times New Roman", weight: 400, italic: false },
    ],
    [
      "KantumruyPro-ExtraLight",
      { family: "Kantumruy Pro", weight: 200, italic: false },
    ],
    ["Inter-Black", { family: "Inter", weight: 900, italic: false }],
  ])("reads %s", (name, expected) => {
    expect(parseFontName(name)).toEqual(expected);
  });
});

describe("buildPsdProject", () => {
  function design(): PsdDocument {
    return mapPsd(
      poster([
        image("Background", 0, 0, 1080, 1350),
        {
          name: "Header",
          children: [image("Logo", 40, 60, 200, 100, { opacity: 0.4 })],
        },
        headline(),
        image("Draft note", 10, 10, 50, 50, { hidden: true }),
      ]),
      "Coffee",
    );
  }
  const sources = new Map([
    ["background", "motify-asset://00000000-0000-4000-8000-000000000001"],
    ["logo", "motify-asset://00000000-0000-4000-8000-000000000002"],
    ["draft-note", "motify-asset://00000000-0000-4000-8000-000000000003"],
  ]);

  it("writes each layer as a native data-edit element at its Photoshop position", () => {
    const project = buildPsdProject(design(), sources, { duration: 8 });
    const html = project.files["composition.html"];
    expect(isPsdImport(html)).toBe(true);
    expect(project).toMatchObject({ width: 1080, height: 1350, duration: 8 });
    expect(html).toContain(
      'style="width:1080px;height:1350px;background:#ffffff"',
    );
    expect(html).toContain('<section data-scene="psd" data-edit="psd"');
    expect(html).toContain(
      '<img class="psd-layer" data-edit="background" data-edit-label="Background" src="motify-asset://00000000-0000-4000-8000-000000000001"',
    );
    // A group's layers are placed inside it, relative to its box.
    expect(html).toMatch(
      /data-edit="header"[^>]*style="left:40px;top:60px;width:200px;height:100px"/,
    );
    expect(html).toMatch(
      /data-edit="logo"[^>]*style="left:0px;top:0px;width:200px;height:100px;opacity:0.4"/,
    );
    expect(html).toMatch(
      /<p class="psd-layer psd-text" data-edit="headline"[^>]*>Fresh coffee<\/p>/,
    );
    expect(html).toMatch(/data-edit="draft-note"[^>]*hidden>/);
    expect(project.files["timeline.js"]).toContain(
      "export function buildTimeline",
    );
    expect(project.files["styles.css"]).toContain(
      ".psd-layer[hidden] { display: none; }",
    );
    // Timeline rows read top to bottom, like Photoshop's Layers panel.
    expect(
      project.scenes[0]!.tracks!.map((track) => [track.id, track.kind]),
    ).toEqual([
      ["draft-note", "Element"],
      ["headline", "Text"],
      ["header", "Element"],
      ["background", "Background"],
    ]);
  });

  it("leaves out a pixel layer whose image did not upload", () => {
    const html = buildPsdProject(design(), new Map([["background", "x.png"]]), {
      duration: 8,
    }).files["composition.html"];
    expect(html).not.toContain('data-edit="logo"');
    expect(html).not.toContain('data-edit="header"');
  });

  it("mounts on the editor's runtime with every layer registered", () => {
    const project = buildPsdProject(design(), sources, { duration: 8 });
    const composition = createDynamicComposition(
      combineCompositionSource(project.files),
      project.files["timeline.js"],
      {
        width: project.width,
        height: project.height,
        duration: project.duration,
        scenes: project.scenes,
      },
    );
    const registered: string[] = [];
    const root = document.createElement("div");
    composition.build({
      root,
      element: root,
      container: root,
      timeline: gsap.timeline({ paused: true }),
      width: project.width,
      height: project.height,
      orientation: "portrait",
      register: (id, element) => {
        registered.push(id);
        return element;
      },
    } satisfies CompositionContext);
    expect(registered).toEqual([
      "stage",
      "psd",
      "background",
      "header",
      "logo",
      "headline",
      "draft-note",
    ]);
  });

  it("is edited as the person's own film, however small", () => {
    const project = buildPsdProject(
      mapPsd(poster([image("Dot", 0, 0, 10, 10)]), "x"),
      new Map([["dot", "d.png"]]),
      { duration: 5 },
    );
    expect(project.files["composition.html"].length).toBeLessThan(1200);
    const basis = resolveGenerationBasis(project.files, {
      id: "dynamic-comp-1",
      duration: 5,
      scenes: project.scenes,
    });
    expect(basis.generationProfile).toBe("existing");
  });

  it("escapes what the file names", () => {
    const html = buildPsdProject(
      mapPsd(poster([image('<b>"Hi"</b>', 0, 0, 10, 10)]), "x"),
      new Map([["b-hi-b", "a.png"]]),
      { duration: 5 },
    ).files["composition.html"];
    expect(html).toContain(
      'data-edit-label="&lt;b&gt;&quot;Hi&quot;&lt;/b&gt;"',
    );
    expect(
      flattenLayers(mapPsd(poster([image("A", 0, 0, 1, 1)]), "x").layers),
    ).toHaveLength(1);
  });
});

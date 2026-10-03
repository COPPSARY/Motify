import { describe, expect, it } from "vitest";
import {
  collectFontFiles,
  fontContentType,
  guessFamily,
  guessStyle,
  guessWeight,
  readZip,
} from "./font-files";

/** Builds a zip in memory: one stored entry and one deflated entry. */
async function makeZip(
  entries: Array<{
    name: string;
    bytes: Uint8Array<ArrayBuffer>;
    deflate?: boolean;
  }>,
): Promise<Blob> {
  const encoder = new TextEncoder();
  const locals: Uint8Array<ArrayBuffer>[] = [];
  const centrals: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = entry.deflate
      ? new Uint8Array(
          await new Response(
            new Response(entry.bytes).body!.pipeThrough(
              new CompressionStream("deflate-raw"),
            ),
          ).arrayBuffer(),
        )
      : entry.bytes;
    const method = entry.deflate ? 8 : 0;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, entry.bytes.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, entry.bytes.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...locals, ...centrals, end]);
}

const ttf = new Uint8Array([0, 1, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]);

describe("font files", () => {
  it("reads family, weight and style from foundry file names", () => {
    expect(guessFamily("AcmeSans-SemiBoldItalic.woff2")).toBe("Acme Sans");
    expect(guessFamily("Inter_18pt-Bold.ttf")).toBe("Inter");
    expect(guessFamily("Montserrat-VariableFont_wght.ttf")).toBe("Montserrat");
    expect(guessFamily("fonts/OpenSans.ttf")).toBe("Open Sans");
    expect(guessWeight("AcmeSans-ExtraBold.otf")).toBe(800);
    expect(guessWeight("AcmeSans-SemiBold.otf")).toBe(600);
    expect(guessWeight("AcmeSans-Bold.otf")).toBe(700);
    expect(guessWeight("AcmeSans-Light.otf")).toBe(300);
    expect(guessWeight("AcmeSans.otf")).toBe(400);
    expect(guessStyle("AcmeSans-BoldItalic.otf")).toBe("italic");
    expect(guessStyle("AcmeSans-Bold.otf")).toBe("normal");
  });

  it("maps extensions to the font types the backend accepts", () => {
    expect(fontContentType("a.TTF")).toBe("font/ttf");
    expect(fontContentType("a.woff2")).toBe("font/woff2");
    expect(fontContentType("a.png")).toBeNull();
  });

  it("unpacks stored and deflated fonts from a zip and skips everything else", async () => {
    const zip = await makeZip([
      { name: "Acme/AcmeSans-Regular.ttf", bytes: ttf },
      { name: "Acme/AcmeSans-Bold.ttf", bytes: ttf, deflate: true },
      { name: "Acme/OFL.txt", bytes: new TextEncoder().encode("licence") },
      { name: "__MACOSX/Acme/._AcmeSans-Bold.ttf", bytes: ttf },
    ]);
    const entries = await readZip(zip);
    expect(entries.map((entry) => entry.name)).toEqual([
      "Acme/AcmeSans-Regular.ttf",
      "Acme/AcmeSans-Bold.ttf",
    ]);
    expect([...entries[1]!.bytes]).toEqual([...ttf]);
  });

  it("types dropped fonts, expands zips, and reports what it skipped", async () => {
    const zip = await makeZip([{ name: "Brand-Bold.woff2", bytes: ttf }]);
    const { fonts, skipped } = await collectFontFiles([
      new File([ttf], "Brand-Regular.otf"),
      new File([zip], "brand.zip"),
      new File(["x"], "notes.pdf"),
    ]);
    expect(fonts.map((font) => [font.name, font.type])).toEqual([
      ["Brand-Regular.otf", "font/otf"],
      ["Brand-Bold.woff2", "font/woff2"],
    ]);
    expect(skipped).toEqual(["notes.pdf"]);
  });
});

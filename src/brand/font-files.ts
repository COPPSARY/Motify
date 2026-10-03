/**
 * Turning dropped font files into brand fonts: which files are fonts, what
 * family, weight and style each one probably is, and unpacking a .zip in the
 * browser so the server only ever receives plain font files.
 */

export const FONT_ACCEPT = ".ttf,.otf,.woff,.woff2,.zip";

const FONT_TYPES: Record<string, string> = {
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

/** Largest single font file the backend accepts. */
const MAX_FONT_BYTES = 10_000_000;
/** A family zip rarely holds more; anything bigger is not a font package. */
const MAX_ZIP_ENTRIES = 200;

export function fontContentType(fileName: string): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return FONT_TYPES[extension] ?? null;
}

/** Longest names first, so "ExtraBold" is not read as "Bold". */
const WEIGHT_NAMES: Array<[RegExp, number]> = [
  [/extra[\s_-]?light|ultra[\s_-]?light/i, 200],
  [/extra[\s_-]?bold|ultra[\s_-]?bold/i, 800],
  [/semi[\s_-]?bold|demi[\s_-]?bold/i, 600],
  [/hairline|thin/i, 100],
  [/light/i, 300],
  [/medium/i, 500],
  [/bold/i, 700],
  [/black|heavy/i, 900],
];

export function guessWeight(fileName: string): number {
  const name = stripExtension(fileName);
  for (const [pattern, weight] of WEIGHT_NAMES) {
    if (pattern.test(name)) return weight;
  }
  return 400;
}

export function guessStyle(fileName: string): "normal" | "italic" {
  return /italic|oblique/i.test(stripExtension(fileName)) ? "italic" : "normal";
}

const STYLE_WORDS =
  /(extra|ultra|semi|demi)?[\s_-]?(hairline|thin|light|regular|book|normal|medium|bold|black|heavy)|italic|oblique|variablefont.*|\[.*\]|wght|\d+pt/gi;

/** "AcmeSans-SemiBoldItalic.woff2" → "Acme Sans". */
export function guessFamily(fileName: string): string {
  const base = stripExtension(fileName).split(/[\\/]/).pop() ?? "";
  const head = base.split(/[-_]/)[0] ?? base;
  const cleaned = (head.length > 1 ? head : base)
    .replace(STYLE_WORDS, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Custom font";
}

/**
 * Expands the dropped files into font files, each typed with its font MIME
 * type (browsers usually report fonts as an empty or generic type). Files that
 * are not fonts are returned separately so the page can say what it skipped.
 */
export async function collectFontFiles(
  dropped: readonly File[],
): Promise<{ fonts: File[]; skipped: string[] }> {
  const fonts: File[] = [];
  const skipped: string[] = [];
  for (const file of dropped) {
    if (/\.zip$/i.test(file.name)) {
      try {
        const entries = await readZip(file);
        const inside = entries.filter((entry) => fontContentType(entry.name));
        if (inside.length === 0) skipped.push(`${file.name} (no fonts inside)`);
        fonts.push(...inside.map((entry) => typed(entry.name, entry.bytes)));
      } catch {
        skipped.push(`${file.name} (could not be opened)`);
      }
      continue;
    }
    if (!fontContentType(file.name)) {
      skipped.push(file.name);
      continue;
    }
    fonts.push(typed(file.name, file));
  }
  const tooLarge = fonts.filter((font) => font.size > MAX_FONT_BYTES);
  skipped.push(...tooLarge.map((font) => `${font.name} (over 10 MB)`));
  return {
    fonts: fonts.filter((font) => font.size <= MAX_FONT_BYTES),
    skipped,
  };
}

function typed(path: string, content: BlobPart): File {
  const name = path.split("/").pop() ?? path;
  return new File([content], name, {
    type: fontContentType(name) ?? "application/octet-stream",
  });
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

// ---- zip ------------------------------------------------------------------

interface ZipEntry {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}

/**
 * A minimal zip reader: the central directory, then each stored or deflated
 * entry. That covers every font package a type foundry or Google Fonts hands
 * out; anything more exotic is reported as unreadable.
 */
export async function readZip(file: Blob): Promise<ZipEntry[]> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  let end = -1;
  for (
    let offset = buffer.length - 22;
    offset >= Math.max(0, buffer.length - 65_557);
    offset -= 1
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error("Not a zip file.");
  const count = view.getUint16(end + 10, true);
  if (count > MAX_ZIP_ENTRIES) throw new Error("Too many files in the zip.");
  let cursor = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error("Corrupt zip.");
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(
      buffer.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    cursor += 46 + nameLength + extraLength + commentLength;

    // Folders, macOS resource forks and anything that is not a font are skipped
    // before a byte of them is inflated.
    if (
      name.endsWith("/") ||
      name.includes("__MACOSX/") ||
      !fontContentType(name)
    )
      continue;
    if (size > MAX_FONT_BYTES || compressedSize > MAX_FONT_BYTES) continue;

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(start, start + compressedSize);
    if (method === 0) entries.push({ name, bytes: data });
    else if (method === 8) entries.push({ name, bytes: await inflate(data) });
  }
  return entries;
}

async function inflate(
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Response(data).body!.pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

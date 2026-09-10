/**
 * Bundles trimmed HyperFrames component source for the generation prompt.
 *
 * The manifest carries names and one-line descriptions, which is all the model
 * used to receive; it cannot rebuild a 25KB token-driven component from a
 * sentence, so it invented its own markup every time and stamped the
 * component's name on the result. This emits the real authored source —
 * contract comment, CSS, markup, and choreography — trimmed to a per-item
 * budget so a handful can ride along in every request.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const registryRoot = resolve(process.cwd(), "registry");
const outputPath = join(registryRoot, "component-source.json");

/** Per-item ceiling. Five of these fit a request without crowding the brief. */
const MAX_CHARS = 12000;

/** The contract prose is context, not craft; a couple of paragraphs is plenty. */
const MAX_CONTRACT = 1200;

function section(source, tag) {
  const matches = source.match(new RegExp(`<${tag}[\\s\\S]*?</${tag}>`, "gi"));
  return matches ? matches.join("\n") : "";
}

/**
 * The contract above <html>: what the component is and how it is used.
 *
 * The delimiters are dropped and the text is emitted as prose. Keeping them
 * meant a truncated contract lost its "-->" and left an unterminated comment
 * that swallowed the CSS following it.
 */
function contractComment(source) {
  const head = source.slice(0, source.indexOf("<html"));
  const comments = head.match(/<!--[\s\S]*?-->/g);
  if (!comments) return "";
  return comments
    .map((comment) => comment.replace(/^<!--/, "").replace(/-->$/, "").trim())
    .join("\n")
    .trim();
}

/**
 * The authored document with scripts and comments removed.
 *
 * Both matter: several components build markup as strings and mention "<style>"
 * inside their script, and their contract comments describe "<style> tags" in
 * prose. Scanning the raw file picks up those mentions as if they were real
 * tags, which produced style blocks full of documentation and openings with no
 * close once the entry was truncated.
 */
function authoredMarkup(source) {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * Several components declare their CSS inside <body>. Those blocks are already
 * gathered by collectStyle, so they are stripped here: keeping them would both
 * duplicate the rules and let markup truncation cut a <style> from its close.
 */
function bodyMarkup(source) {
  const match = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(source);
  if (!match) return "";
  return (match[1] ?? "").replace(/<style[\s\S]*?<\/style>/gi, "").trim();
}

/**
 * Truncating CSS or markup mid-token hands the model an unterminated tag and a
 * half-written rule, which is worse than handing it less. Cut back to the last
 * complete rule or element instead, and say that something was dropped.
 */
function truncateAt(text, limit, boundary, note) {
  if (text.length <= limit) return text;
  const window = text.slice(0, limit);
  const cut = window.lastIndexOf(boundary);
  const kept =
    cut > limit * 0.4 ? window.slice(0, cut + boundary.length) : window;
  return `${kept}\n${note}`;
}

/**
 * Components often carry several <style> blocks. Their rules are merged into a
 * single wrapper so truncation can never strand an opening tag without its
 * close, which would hand the model malformed CSS.
 */
function collectStyle(source, limit) {
  const blocks = Array.from(
    source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi),
  ).map((match) => (match[1] ?? "").trim());
  const inner = blocks.filter(Boolean).join("\n\n");
  if (!inner) return "";
  const kept = truncateAt(
    inner,
    Math.max(0, limit - 40),
    "}",
    "/* … further rules trimmed … */",
  );
  return `<style>\n${kept}\n</style>`;
}

/**
 * Priority order matters: the contract and the CSS are what make a generated
 * surface look designed, so markup and then choreography are what give way when
 * an item runs long.
 */
function trim(source) {
  const contract = truncateAt(
    contractComment(source).trim(),
    MAX_CONTRACT,
    "\n",
    "  … contract trimmed …",
  );
  let budget = MAX_CHARS - contract.length;
  const authored = authoredMarkup(source);

  const style = collectStyle(authored, Math.max(0, Math.floor(budget * 0.55)));
  budget -= style.length;

  const markup = truncateAt(
    bodyMarkup(authored),
    Math.max(0, Math.floor(budget * 0.65)),
    ">",
    "<!-- … further markup trimmed … -->",
  );
  budget -= markup.length;

  const script = truncateAt(
    section(source, "script")
      .replace(/<script[^>]*src=[^>]*>\s*<\/script>/gi, "")
      .trim(),
    Math.max(0, budget),
    "\n",
    "/* … choreography trimmed … */",
  );

  return {
    style,
    text: [contract, style, markup, script].filter(Boolean).join("\n\n"),
  };
}

const componentsDir = join(registryRoot, "components");
const entries = await readdir(componentsDir, { withFileTypes: true });
const bundle = {};
const unbalanced = [];
let skipped = 0;

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const file = join(componentsDir, entry.name, `${entry.name}.html`);
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    skipped += 1;
    continue;
  }
  const trimmed = trim(raw);
  if (trimmed.text.length < 200) {
    skipped += 1;
    continue;
  }
  // Validate the CSS the builder produced rather than re-parsing the joined
  // entry: contract prose and choreography comments both mention "<style>".
  const opens = (trimmed.style.match(/<style[^>]*>/gi) ?? []).length;
  const closes = (trimmed.style.match(/<\/style>/gi) ?? []).length;
  if (opens !== closes) unbalanced.push(entry.name);
  bundle[entry.name] = trimmed.text;
}

await writeFile(outputPath, `${JSON.stringify(bundle)}\n`, "utf8");

const names = Object.keys(bundle);
const total = names.reduce((sum, name) => sum + bundle[name].length, 0);
if (unbalanced.length > 0) {
  throw new Error(
    `Unbalanced <style> in: ${unbalanced.slice(0, 5).join(", ")}`,
  );
}
console.log(
  `component-source.json: ${names.length} components, ` +
    `${(total / 1024).toFixed(0)}KB total, ` +
    `${Math.round(total / names.length)} chars each on average, ` +
    `${skipped} skipped`,
);

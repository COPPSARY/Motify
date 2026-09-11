/**
 * Compiles the Motionly runtime API reference that ships inside the deployed
 * system prompt.
 *
 * `dynamic-compiler.ts` destructures every export of `src/composition/presets.ts`
 * into the scope of a generated `buildTimeline`, so all of it is callable. The
 * prompt used to name only seventeen of the presets and none of the `EASE`
 * vocabulary, which left the model re-implementing tuned mechanics as raw GSAP
 * and reaching for stock curves the ease doc exists to replace. Worse, the
 * quality scorer in `generation-guidance.ts` credits presets the prompt never
 * taught, so a generation was graded on vocabulary it could not have known.
 *
 * Deriving the reference from the source keeps the two in step: add a preset and
 * the prompt gains it on the next `npm run prompt:build`.
 */

/** Strips a JSDoc block down to its prose. */
function stripDoc(block) {
  return block
    .replace(/^\s*\/\*\*/, "")
    .replace(/\*\/\s*$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""))
    .join("\n")
    .trim();
}

/** `export interface NameOptions extends Parent { ... }` -> field records. */
export function parseInterfaces(source) {
  const interfaces = new Map();
  const re = /export interface (\w+)(?:\s+extends\s+(\w+))?\s*\{([\s\S]*?)\n\}/g;
  let match;
  while ((match = re.exec(source))) {
    const [, name, parent, body] = match;
    const fields = [];
    for (const line of body.split("\n")) {
      const field = /^\s*(\w+)(\??):\s*(.+?);\s*(?:\/\/.*)?$/.exec(line);
      if (field) {
        fields.push({
          name: field[1],
          optional: field[2] === "?",
          type: field[3].trim(),
        });
      }
    }
    interfaces.set(name, { parent, fields });
  }
  return interfaces;
}

/** Own fields first, then anything inherited up the `extends` chain. */
export function resolveFields(interfaces, name, seen = new Set()) {
  const entry = interfaces.get(name);
  if (!entry || seen.has(name)) return [];
  seen.add(name);
  const inherited = entry.parent
    ? resolveFields(interfaces, entry.parent, seen)
    : [];
  const own = new Set(entry.fields.map((field) => field.name));
  return [...entry.fields, ...inherited.filter((field) => !own.has(field.name))];
}

/** The `EASE` doc block plus each curve's own annotation. */
export function parseEase(source) {
  const block =
    /(\/\*\*[\s\S]*?\*\/)\s*export const EASE = \{([\s\S]*?)\n\} as const;/.exec(
      source,
    );
  if (!block) return null;
  const curves = [];
  const re = /(?:\/\*\*([\s\S]*?)\*\/\s*)?(\w+):\s*CustomEase\.create\(/g;
  let match;
  while ((match = re.exec(block[2]))) {
    curves.push({
      name: match[2],
      note: match[1] ? stripDoc("/**" + match[1] + "*/").replace(/\s+/g, " ") : "",
    });
  }
  return { doc: stripDoc(block[1]), curves };
}

/** Index of the `)` closing the `(` at `open`, or -1. */
function matchingParen(source, open) {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** The JSDoc block immediately above `index`, if one is adjacent. */
function precedingDoc(source, index) {
  const before = source.slice(0, index).replace(/\s*$/, "");
  if (!before.endsWith("*/")) return "";
  const open = before.lastIndexOf("/**");
  if (open === -1) return "";
  return stripDoc(before.slice(open));
}

/**
 * Reads the default expression starting at `start`.
 *
 * Splitting on the next `,` or `)` is wrong for the values that actually appear
 * here: `"elastic.out(1, 0.55)"` carries a comma and `"back.out(1.35)"` a paren,
 * both inside a string, and the expression itself sits inside the argument list
 * of a `timeline.to(...)`. So track string and bracket state and stop only at a
 * separator that is genuinely at depth zero.
 */
function readExpression(source, start) {
  let depth = 0;
  let quote = "";
  let index = start;
  for (; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) {
      if (depth === 0) break;
      depth -= 1;
    } else if ((char === "," || char === ";" || char === "\n") && depth === 0) {
      break;
    }
  }
  return source.slice(start, index).trim();
}

/** Splits a parameter list on top-level commas only. */
function splitParams(raw) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of raw) {
    if ("<([{".includes(char)) depth += 1;
    if (">)]}".includes(char)) depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts.filter((part) => part.trim());
}

/**
 * `export function name(...)` declarations, with the body kept for default
 * extraction.
 *
 * Two passes on purpose. A single regex carrying an optional leading JSDoc
 * group lets that group span everything between the file's first `/**` and the
 * first documented preset, silently swallowing every declaration in between.
 * Anchoring on the declaration and only then looking backwards for an adjacent
 * doc block keeps all of them.
 */
export function parseFunctions(source) {
  const functions = [];
  const re = /^export function (\w+)\(/gm;
  let match;
  while ((match = re.exec(source))) {
    const name = match[1];
    const open = source.indexOf("(", match.index);
    const close = matchingParen(source, open);
    if (close === -1) continue;
    const bodyStart = source.indexOf("{", close);
    if (bodyStart === -1) continue;
    // Between `)` and the body. The prompt has to carry this: SKILL.md told the
    // model all three type treatments "return the split word elements", but
    // pullbackComplete returns a timeline, so a model that destructured its
    // result crashed the film with "undefined is not iterable".
    const returns = source
      .slice(close + 1, bodyStart)
      .replace(/^\s*:\s*/, "")
      .trim();
    const next = source.indexOf("\nexport ", bodyStart);
    const body = source.slice(bodyStart, next === -1 ? undefined : next);
    const params = splitParams(source.slice(open + 1, close))
      .map((param) => {
        const parsed = /^(\w+)\s*:\s*([\s\S]+?)(?:\s*=\s*([\s\S]+))?$/.exec(
          param.trim(),
        );
        if (!parsed) return null;
        return {
          name: parsed[1],
          type: parsed[2].trim(),
          optional: Boolean(parsed[3]),
        };
      })
      .filter(Boolean);
    const defaults = new Map();
    const dre = /options\.(\w+)\s*\?\?\s*/g;
    let dmatch;
    while ((dmatch = dre.exec(body))) {
      if (!defaults.has(dmatch[1])) {
        defaults.set(dmatch[1], readExpression(body, dre.lastIndex));
      }
    }
    functions.push({
      name,
      doc: precedingDoc(source, match.index),
      params,
      defaults,
      returns,
    });
  }
  return functions;
}

/**
 * Fields for a parameter type, which may be a named interface, an inline object
 * literal, or an intersection of both — `cameraPush` and `cameraPull` take
 * `MotionOptions & { scale?: number; x?: number; y?: number }`, and dropping the
 * inline half left the two most-used camera presets documented as taking no
 * options at all.
 */
function optionFields(interfaces, type) {
  const fields = [];
  const seen = new Set();
  const add = (field) => {
    if (seen.has(field.name)) return;
    seen.add(field.name);
    fields.push(field);
  };
  for (const part of type.split("&").map((entry) => entry.trim())) {
    if (part.startsWith("{")) {
      for (const entry of part.replace(/^\{|\}$/g, "").split(";")) {
        const field = /^\s*(\w+)(\??):\s*(.+?)\s*$/.exec(entry);
        if (field) {
          add({ name: field[1], optional: field[2] === "?", type: field[3] });
        }
      }
      continue;
    }
    for (const field of resolveFields(interfaces, part)) add(field);
  }
  return fields;
}

/** Renders one preset as a signature line plus its options. */
function renderFunction(fn, interfaces) {
  const signature = fn.params
    .map((param) => (param.optional ? param.name + "?" : param.name))
    .join(", ");
  const suffix = fn.returns && !/^gsap\.core\.Timeline$/.test(fn.returns)
    ? " -> " + fn.returns
    : "";
  const lines = ["- `" + fn.name + "(" + signature + ")" + suffix + "`"];
  const optionsParam = fn.params.find((param) => /Options|\{/.test(param.type));
  if (optionsParam) {
    const fields = optionFields(interfaces, optionsParam.type);
    const rendered = fields.map((field) => {
      const fallback = fn.defaults.get(field.name);
      const suffix = field.optional
        ? fallback
          ? " = " + fallback
          : ""
        : " (required)";
      return field.name + ": " + field.type + suffix;
    });
    if (rendered.length) lines.push("  - " + rendered.join("; "));
  }
  if (fn.doc) {
    const summary = fn.doc.split("\n\n")[0].replace(/\s+/g, " ").trim();
    if (summary) lines.push("  - " + summary);
  }
  return lines.join("\n");
}

/**
 * Builds the API reference appended to the deployed system prompt.
 * `source` is the normalized text of `src/composition/presets.ts`.
 */
export function buildPresetApi(source) {
  const interfaces = parseInterfaces(source);
  const ease = parseEase(source);
  const functions = parseFunctions(source);
  const sections = [
    "# The Motionly runtime API",
    "Every name below is already destructured into the scope of your `buildTimeline(context)` — alongside `gsap` — by the compiler. Call these directly. Do not import them, do not redeclare them, and do not re-implement one by hand as a chain of raw tweens: the tuned version is the house style, and the quality pass scores a film on whether it used them.",
  ];
  if (ease) {
    sections.push(
      "## Ease vocabulary: `EASE`",
      ease.doc,
      "Measured behaviour of each curve:",
      ease.curves
        .map(
          (curve) =>
            "- `EASE." + curve.name + "`" + (curve.note ? " — " + curve.note : ""),
        )
        .join("\n"),
      "Pass one as the `ease` value like any GSAP curve: `timeline.to(card, { x: 240, duration: 1.1, ease: EASE.travel })`, or as a preset's `ease` option. Reach for a stock GSAP curve only in the two cases named above: `sine.inOut` for ambient drift and breathing, `none` for a constant-rate readout.",
    );
  }
  sections.push(
    "## Presets",
    "A trailing `?` marks an optional argument; `= value` is the default that applies when you omit an option. A preset returns the caller's timeline unless an arrow gives another type, so only the ones marked `-> HTMLElement[]` may be destructured or indexed; doing that to any other one crashes the film.",
    functions.map((fn) => renderFunction(fn, interfaces)).join("\n"),
  );
  return sections.join("\n\n");
}

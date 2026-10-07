/**
 * Confines a film's stylesheet to the element the film is mounted in.
 *
 * A generated film ships its CSS inside the composition markup, and the editor
 * mounts that markup straight into the page. Unscoped, a bare type rule such as
 * `section { position: absolute; inset: 0 }` meant for the film's scenes also
 * matched the editor's own `<section>` scene bar and laid a full-screen panel
 * over the whole editor. Every style rule is therefore rewritten to apply only
 * inside the film's root:
 *
 *   section { … }          ->  :where([data-film-scope="k"]) section { … }
 *   body, html, :root { … } ->  :where([data-film-scope="k"]) { … }
 *
 * `:where()` adds no specificity, so the film's rules keep the same cascade
 * among themselves. `@media`, `@supports`, `@container` and `@layer` blocks are
 * scoped inside; `@keyframes`, `@font-face` and other descriptor blocks are kept
 * as written. This is plain text processing, so preview and export (and tests)
 * scope a film identically without a browser stylesheet parser.
 */

/** At-rules whose blocks hold style rules that need scoping. */
const GROUPING_AT_RULES = new Set([
  "media",
  "supports",
  "container",
  "layer",
  "scope",
  "document",
  "starting-style",
]);

/** `html`, `body` or `:root` at the start of a selector: they stand for the film's root. */
const DOCUMENT_ROOT = /^(?:html|body|:root)(?![\w-])/i;

export function filmScopeSelector(scopeId: string) {
  return `[data-film-scope="${scopeId}"]`;
}

/** Rewrites `css` so each rule only matches inside an element carrying `filmScopeSelector(scopeId)`. */
export function scopeFilmCss(css: string, scopeId: string): string {
  return scopeRules(css, `:where(${filmScopeSelector(scopeId)})`);
}

function scopeRules(css: string, scope: string): string {
  let output = "";
  let index = 0;
  while (index < css.length) {
    const start = index;
    // Read a prelude up to its block, or a statement up to `;`.
    let end = index;
    let terminator = "";
    while (end < css.length) {
      const char = css[end]!;
      if (char === "/" && css[end + 1] === "*") {
        const close = css.indexOf("*/", end + 2);
        end = close === -1 ? css.length : close + 2;
        continue;
      }
      if (char === '"' || char === "'") {
        end = skipString(css, end);
        continue;
      }
      if (char === "(" || char === "[") {
        end = skipBalanced(css, end);
        continue;
      }
      if (char === "{" || char === ";" || char === "}") {
        terminator = char;
        break;
      }
      end += 1;
    }
    const prelude = css.slice(start, end);
    if (terminator === "") {
      output += prelude;
      break;
    }
    if (terminator === ";" || terminator === "}") {
      // A statement at-rule (`@import …;`) or a stray `}`: kept as written.
      output += css.slice(start, end + 1);
      index = end + 1;
      continue;
    }
    const blockEnd = skipBlock(css, end);
    const body = css.slice(end + 1, blockEnd - 1);
    const trimmed = stripComments(prelude).trim();
    if (trimmed.startsWith("@")) {
      const name = /^@([\w-]+)/.exec(trimmed)?.[1]?.toLowerCase() ?? "";
      output += GROUPING_AT_RULES.has(name)
        ? `${prelude}{${scopeRules(body, scope)}}`
        : css.slice(start, blockEnd);
    } else if (trimmed === "") {
      output += css.slice(start, blockEnd);
    } else {
      const leading = /^\s*/.exec(prelude)?.[0] ?? "";
      output += `${leading}${scopeSelectorList(trimmed, scope)} {${body}}`;
    }
    index = blockEnd;
  }
  return output;
}

function scopeSelectorList(list: string, scope: string): string {
  return splitTopLevel(list, ",")
    .map((selector) => scopeSelector(selector.trim(), scope))
    .join(", ");
}

function scopeSelector(selector: string, scope: string): string {
  if (!selector) return selector;
  let rest = selector;
  let isRoot = false;
  let compound = false;
  // `html body .card` and `:root` all start at the film's root.
  for (
    let match = DOCUMENT_ROOT.exec(rest);
    match;
    match = DOCUMENT_ROOT.exec(rest)
  ) {
    isRoot = true;
    rest = rest.slice(match[0].length);
    // `body.dark` qualifies the root itself; `body .card` or `body > .card` are inside it.
    compound = rest.length > 0 && !/^[\s>]/.test(rest);
    if (!compound) rest = rest.replace(/^\s*>?\s*/, "");
  }
  if (!isRoot) return `${scope} ${selector}`;
  if (!rest) return scope;
  return compound ? `${scope}${rest}` : `${scope} ${rest}`;
}

/** Splits on `separator` outside parentheses, brackets and strings. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '"' || char === "'") {
      const end = skipString(text, index);
      current += text.slice(index, end);
      index = end - 1;
      continue;
    }
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function skipString(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === "\\") index += 2;
    else if (text[index] === quote) return index + 1;
    else index += 1;
  }
  return text.length;
}

function skipBalanced(text: string, start: number): number {
  const open = text[start];
  const close = open === "(" ? ")" : "]";
  let depth = 0;
  let index = start;
  while (index < text.length) {
    const char = text[index]!;
    if (char === '"' || char === "'") {
      index = skipString(text, index);
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return text.length;
}

/** From the index of a `{`, returns the index just past its matching `}`. */
function skipBlock(text: string, start: number): number {
  let depth = 0;
  let index = start;
  while (index < text.length) {
    const char = text[index]!;
    if (char === "/" && text[index + 1] === "*") {
      const close = text.indexOf("*/", index + 2);
      index = close === -1 ? text.length : close + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      index = skipString(text, index);
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return text.length;
}

function stripComments(text: string) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

let nextScopeId = 0;

/**
 * Scopes every `<style>` the film mounted into `root` to `root`, marking the
 * root with `data-film-scope`. Safe to call again: a style is rewritten once.
 */
export function scopeFilmStyles(root: HTMLElement): void {
  nextScopeId += 1;
  const scopeId = root.dataset["filmScope"] ?? `film-${nextScopeId}`;
  root.dataset["filmScope"] = scopeId;
  root.querySelectorAll("style").forEach((style) => {
    if (style.dataset["filmScoped"] === scopeId) return;
    style.textContent = scopeFilmCss(style.textContent ?? "", scopeId);
    style.dataset["filmScoped"] = scopeId;
  });
}

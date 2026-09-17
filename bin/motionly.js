#!/usr/bin/env node

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { handleLocalAiRequest } from "./local-ai.js";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = normalize(join(here, ".."));
const distRoot = join(packageRoot, "dist");
const templateRoot = join(packageRoot, "templates", "project");
const registryRoot = join(packageRoot, "registry");
const bundledSkillsRoot = join(packageRoot, ".agents", "skills");
const PROJECT_FILES = [
  "composition.html",
  "styles.css",
  "timeline.js",
  "index.ts",
];
const SKILLS = ["write-motionly", "scene-design"];
const MAX_PROJECT_BYTES = 15 * 1024 * 1024;

const PROVIDERS = {
  codex: ".agents/skills",
  claude: ".claude/skills",
  gemini: ".gemini/skills",
  opencode: ".opencode/skills",
  kiro: ".kiro/skills",
  rayu: ".rayu/skills",
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function optionValues(argv, name) {
  return argv.flatMap((arg, index) =>
    arg === name && argv[index + 1] ? [argv[index + 1]] : [],
  );
}

function optionValue(argv, name) {
  const values = optionValues(argv, name);
  if (values.length > 1) throw new Error(`Choose only one ${name}.`);
  return values[0];
}

function firstPositional(argv) {
  const optionsWithValues = new Set([
    "--port",
    "-p",
    "--provider",
    "--scope",
    "--type",
    "--tag",
    "--dir",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (optionsWithValues.has(arg)) {
      index += 1;
    } else if (!arg.startsWith("-")) {
      return arg;
    }
  }
  return undefined;
}

function parsePort(argv) {
  const raw =
    optionValue(argv, "--port") ??
    optionValue(argv, "-p") ??
    process.env.PORT ??
    "4173";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be between 1 and 65535.");
  }
  return port;
}

function safePath(rootPath, relative) {
  const target = normalize(join(rootPath, relative));
  return target === rootPath || target.startsWith(`${rootPath}${sep}`)
    ? target
    : null;
}

async function copyTree(source, target, overwrite = false) {
  const info = await stat(source);
  if (info.isDirectory()) {
    await mkdir(target, { recursive: true });
    let copied = 0;
    for (const entry of await readdir(source)) {
      copied += await copyTree(
        join(source, entry),
        join(target, entry),
        overwrite,
      );
    }
    return copied;
  }
  await mkdir(dirname(target), { recursive: true });
  if (!overwrite && (await exists(target))) return 0;
  await copyFile(source, target);
  return 1;
}

function parseSkillOptions(argv) {
  const scope = optionValue(argv, "--scope") ?? "project";
  if (scope !== "project" && scope !== "global") {
    throw new Error('Scope must be "project" or "global".');
  }
  const providers = argv.includes("--all")
    ? Object.keys(PROVIDERS)
    : optionValues(argv, "--provider");
  const unknown = providers.find((provider) => !PROVIDERS[provider]);
  if (unknown)
    throw new Error(
      `Unknown provider "${unknown}". Use: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  return { scope, providers: [...new Set(providers)] };
}

async function chooseProvider() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    return Object.keys(PROVIDERS);
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    console.log("\nWhich coding agent should receive the Motify skills?");
    const entries = [...Object.keys(PROVIDERS), "all"];
    entries.forEach((provider, index) =>
      console.log(`  ${index + 1}. ${provider}`),
    );
    const answer = (await terminal.question("Select [1]: ")).trim() || "1";
    const selected = entries[Number(answer) - 1];
    if (!selected) throw new Error("Invalid agent selection.");
    return selected === "all" ? Object.keys(PROVIDERS) : [selected];
  } finally {
    terminal.close();
  }
}

async function installSkills(base, providers, overwrite = false) {
  for (const provider of providers) {
    const providerRoot = join(base, PROVIDERS[provider]);
    let copied = 0;
    for (const skill of SKILLS) {
      const source = join(bundledSkillsRoot, skill);
      if (!(await exists(source)))
        throw new Error(`The package is missing its ${skill} skill.`);
      copied += await copyTree(source, join(providerRoot, skill), overwrite);
    }
    console.log(
      `${overwrite ? "Updated" : "Added"} ${provider}: ${copied} skill file${copied === 1 ? "" : "s"}`,
    );
  }
}

async function initProject(name, argv) {
  if (!name || name.startsWith("-"))
    throw new Error("Usage: motify init <project-folder>");
  const target = resolve(name);
  if (await exists(target)) {
    if ((await readdir(target)).length)
      throw new Error(`Folder is not empty: ${target}`);
  } else {
    await mkdir(target, { recursive: true });
  }
  for (const entry of await readdir(templateRoot)) {
    let source = await readFile(join(templateRoot, entry), "utf8");
    source = source.replaceAll("{{name}}", basename(target));
    await writeFile(join(target, entry), source, {
      encoding: "utf8",
      flag: "wx",
    });
  }
  await mkdir(join(target, "assets"), { recursive: true });
  console.log(`Created ${target}`);
  if (!argv.includes("--skip-skills") && !argv.includes("--no-skills")) {
    const options = parseSkillOptions(argv);
    const providers = options.providers.length
      ? options.providers
      : await chooseProvider();
    await installSkills(
      options.scope === "global" ? homedir() : target,
      providers,
    );
  }
  console.log(`\nNext: cd ${name} && npx @coppsary/motify dev`);
  if (
    process.stdin.isTTY &&
    process.stdout.isTTY &&
    !argv.includes("--no-open")
  ) {
    await serveEditor(argv, target);
  }
}

function readMetadata(indexSource, projectName) {
  const match =
    /export\s+const\s+motionlyMetadata\s*=\s*(\{[\s\S]*?\})\s+as\s+const/.exec(
      indexSource,
    );
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // Fall through to compatibility metadata for hand-authored adapters.
    }
  }
  const text = (key) =>
    new RegExp(`\\b${key}\\s*:\\s*["']([^"']+)["']`).exec(indexSource)?.[1];
  const number = (key, fallback) => {
    const value = Number(
      new RegExp(`\\b${key}\\s*:\\s*([0-9.]+)`).exec(indexSource)?.[1],
    );
    return Number.isFinite(value) ? value : fallback;
  };
  const duration = number("duration", 5);
  return {
    id: text("id") ?? projectName.toLowerCase().replace(/[^a-z0-9-_]/g, "-"),
    title: text("title") ?? projectName,
    description: text("description") ?? "Local Motify composition",
    width: number("width", 1920),
    height: number("height", 1080),
    fps: number("fps", 60),
    duration,
    scenes: [
      { id: "main", label: "Main", start: 0, duration, accent: "#7657ff" },
    ],
  };
}

async function readProject(projectRoot) {
  const files = {};
  for (const filename of PROJECT_FILES)
    files[filename] = await readFile(join(projectRoot, filename), "utf8");
  return {
    name: basename(projectRoot),
    files,
    metadata: readMetadata(files["index.ts"], basename(projectRoot)),
    assets: await listProjectAssets(join(projectRoot, "assets")),
  };
}

async function listProjectAssets(folder, prefix = "") {
  const assets = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      assets.push(...(await listProjectAssets(join(folder, entry.name), name)));
    } else if (entry.isFile()) {
      assets.push(name);
    }
  }
  return assets.sort();
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.byteLength;
    if (size > MAX_PROJECT_BYTES) throw new Error("TOO_LARGE");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function writeProject(projectRoot, payload) {
  const files = payload?.files;
  if (
    !files ||
    PROJECT_FILES.some((filename) => typeof files[filename] !== "string")
  ) {
    throw new Error("INVALID_PROJECT");
  }
  if (
    !/<template\b/i.test(files["composition.html"]) ||
    !/build[A-Za-z0-9_$]*Timeline\s*[=(]/.test(files["timeline.js"])
  ) {
    throw new Error("INVALID_PROJECT");
  }
  for (const filename of PROJECT_FILES) {
    const target = join(projectRoot, filename);
    const temporary = `${target}.motionly-tmp`;
    await writeFile(temporary, files[filename], "utf8");
    await rename(temporary, target);
  }
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

async function serveFile(response, path, method = "GET") {
  const info = await stat(path);
  if (!info.isFile()) throw new Error("NOT_FOUND");
  response.writeHead(200, {
    "Content-Type":
      MIME[extname(path).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": info.size,
  });
  response.end(method === "HEAD" ? undefined : await readFile(path));
}

async function serveLocalEditor(response, method = "GET") {
  const bundledHtml = await readFile(join(distRoot, "index.html"), "utf8");
  const markedHtml = bundledHtml.replace(
    '<meta name="motify-mode" content="cloud"',
    '<meta name="motify-mode" content="local"',
  );
  const html =
    markedHtml === bundledHtml
      ? bundledHtml.replace(
          "</head>",
          '  <meta name="motify-mode" content="local" />\n  </head>',
        )
      : markedHtml;
  response.writeHead(200, {
    "Content-Type": MIME[".html"],
    "Content-Length": Buffer.byteLength(html),
  });
  response.end(method === "HEAD" ? undefined : html);
}

function openBrowser(url) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(command, args, {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    }).unref();
  } catch {
    // Browser opening is best-effort.
  }
}

async function serveEditor(argv, folder) {
  if (!(await exists(join(distRoot, "index.html")))) {
    throw new Error(
      'Motify is not built. Run "npm run build", or use the published package.',
    );
  }
  const projectRoot = folder ? resolve(folder) : null;
  if (projectRoot) {
    const missing = [];
    for (const filename of PROJECT_FILES)
      if (!(await exists(join(projectRoot, filename)))) missing.push(filename);
    if (missing.length)
      throw new Error(
        `Not a Motify v2 project; missing: ${missing.join(", ")}`,
      );
    await mkdir(join(projectRoot, "assets"), { recursive: true });
  }
  const port = parsePort(argv);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://motionly.local");
      const pathname = decodeURIComponent(url.pathname);
      if (pathname === "/" || pathname === "/index.html") {
        return await serveLocalEditor(response, request.method);
      }
      if (
        await handleLocalAiRequest(
          request,
          response,
          projectRoot ?? process.cwd(),
        )
      )
        return;

      if (pathname === "/api/local-project") {
        if (!projectRoot)
          return sendJson(response, 404, {
            error: "No local project is open.",
          });
        if (request.method === "GET" || request.method === "HEAD") {
          const project = await readProject(projectRoot);
          if (request.method === "HEAD") return response.writeHead(204).end();
          return sendJson(response, 200, project);
        }
        if (request.method === "PUT") {
          await writeProject(projectRoot, await readJsonBody(request));
          return response.writeHead(204).end();
        }
        return response.writeHead(405, { Allow: "GET, HEAD, PUT" }).end();
      }

      if (
        pathname.startsWith("/assets/") &&
        (request.method === "GET" || request.method === "HEAD")
      ) {
        const bundled = safePath(distRoot, pathname.slice(1));
        if (bundled && (await exists(bundled)))
          return await serveFile(response, bundled, request.method);
        if (projectRoot) {
          const projectAsset = safePath(
            join(projectRoot, "assets"),
            pathname.slice("/assets/".length),
          );
          if (!projectAsset) return response.writeHead(403).end("Forbidden");
          return await serveFile(response, projectAsset, request.method);
        }
      }

      const relative = pathname.endsWith("/")
        ? `${pathname}index.html`
        : pathname;
      const file = safePath(distRoot, relative.replace(/^\/+/, ""));
      if (!file) return response.writeHead(403).end("Forbidden");
      try {
        await serveFile(response, file, request.method);
      } catch {
        await serveLocalEditor(response, request.method);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status =
        message === "TOO_LARGE"
          ? 413
          : message === "INVALID_PROJECT"
            ? 400
            : message === "NOT_FOUND"
              ? 404
              : 500;
      response
        .writeHead(status)
        .end(status === 500 ? message : message.replaceAll("_", " "));
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
  const url = `http://127.0.0.1:${port}`;
  console.log(
    `\nMotify is running at ${url}${projectRoot ? `\nProject: ${projectRoot}` : ""}\nPress Ctrl+C to stop.\n`,
  );
  if (!argv.includes("--no-open")) openBrowser(url);
}

async function findRegistryItem(name) {
  for (const group of ["examples", "blocks", "components"]) {
    const folder = join(registryRoot, group, name);
    const metadata = join(folder, "registry-item.json");
    if (await exists(metadata))
      return { folder, item: JSON.parse(await readFile(metadata, "utf8")) };
  }
  return null;
}

async function catalog(argv) {
  const manifest = JSON.parse(
    await readFile(join(registryRoot, "registry.json"), "utf8"),
  );
  const type = optionValue(argv, "--type")
    ?.replace(/^hyperframes:/, "")
    .replace(/s$/, "");
  const tag = optionValue(argv, "--tag");
  const show = optionValue(argv, "--show");
  if (show) {
    const found = await findRegistryItem(show);
    if (!found) throw new Error(`Unknown registry item "${show}".`);
    const sourceFile = found.item.files?.[0]?.path;
    if (!sourceFile) throw new Error(`${show} has no installable source.`);
    console.log(await readFile(join(found.folder, sourceFile), "utf8"));
    return;
  }
  const items = manifest.items.filter((item) => {
    const itemType = String(item.type)
      .replace(/^hyperframes:/, "")
      .replace(/s$/, "");
    return (!type || type === itemType) && (!tag || item.tags?.includes(tag));
  });
  if (argv.includes("--json"))
    return console.log(JSON.stringify(items, null, 2));
  for (const item of items)
    console.log(
      `${item.name.padEnd(34)} ${String(item.type).replace("hyperframes:", "").padEnd(12)} ${item.description}`,
    );
}

async function addRegistryItem(name, argv) {
  if (!name || name.startsWith("-"))
    throw new Error("Usage: motify add <registry-name>");
  const found = await findRegistryItem(name);
  if (!found) throw new Error(`Unknown registry item "${name}".`);
  const base = resolve(optionValue(argv, "--dir") ?? ".");
  let copied = 0;
  for (const file of found.item.files ?? []) {
    const source = safePath(found.folder, file.path);
    const target = safePath(base, file.target);
    if (!source || !target)
      throw new Error(`Unsafe registry path in "${name}".`);
    copied += await copyTree(source, target, false);
  }
  console.log(`Added ${name}: ${copied} file${copied === 1 ? "" : "s"}`);
}

function printHelp() {
  console.log(`Motify

  motify init <folder> [--provider codex | --all]   Create a v2 local project
  motify dev [folder] [--port 4173] [--no-open]     Open a local project
  motify skills add [--provider codex | --all]      Install bundled skills
  motify skills update [--provider codex | --all]   Refresh bundled skills
  motify catalog [--type component] [--tag <tag>]   Browse the registry
  motify catalog --show <name>                      Print registry source
  motify add <name> [--dir <folder>]                Install registry source

Providers: ${Object.keys(PROVIDERS).join(", ")}
Scopes: project (default), global`);
}

async function main() {
  const argv = process.argv.slice(2);
  const [command, subcommand] = argv;
  if (command === "--version" || command === "-v") {
    const pkg = JSON.parse(
      await readFile(join(packageRoot, "package.json"), "utf8"),
    );
    return console.log(pkg.version);
  }
  if (command === "help" || command === "--help" || command === "-h")
    return printHelp();
  if (command === "init") return await initProject(argv[1], argv.slice(2));
  if (command === "dev")
    return await serveEditor(
      argv.slice(1),
      firstPositional(argv.slice(1)) ?? ".",
    );
  if (command === "skills") {
    if (subcommand !== "add" && subcommand !== "update")
      throw new Error("Usage: motify skills <add|update>");
    const options = parseSkillOptions(argv.slice(2));
    const providers = options.providers.length
      ? options.providers
      : await chooseProvider();
    return await installSkills(
      options.scope === "global" ? homedir() : process.cwd(),
      providers,
      subcommand === "update",
    );
  }
  if (command === "catalog") return await catalog(argv.slice(1));
  if (command === "add") return await addRegistryItem(argv[1], argv.slice(2));
  if (!command) return await serveEditor(argv, null);
  throw new Error(`Unknown command "${command}". Run motify --help.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

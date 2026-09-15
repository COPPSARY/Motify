import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;
if (!npmCli)
  throw new Error("npm_execpath is unavailable; run this check through npm.");

const result = spawnSync(
  process.execPath,
  [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts"],
  { encoding: "utf8", windowsHide: true },
);
if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "npm pack failed");
}

const start = result.stdout.indexOf("[");
if (start < 0) throw new Error("npm pack did not return a JSON manifest.");
const [manifest] = JSON.parse(result.stdout.slice(start));
const paths = new Set(manifest.files.map((file) => file.path));
const required = [
  "bin/motionly.js",
  "bin/local-ai.js",
  "dist/index.html",
  "templates/project/composition.html",
  "templates/project/styles.css",
  "templates/project/timeline.js",
  "templates/project/index.ts",
  ".agents/skills/write-motionly/SKILL.md",
  ".agents/skills/scene-design/SKILL.md",
  "registry/registry.json",
];
const missing = required.filter((path) => !paths.has(path));
if (missing.length)
  throw new Error(`Release package is missing: ${missing.join(", ")}`);
// The Motify launch preset includes 927 deterministic WebP frames so its
// embedded showcase remains seekable in preview and export.
if (manifest.entryCount > 2500) {
  throw new Error(
    `Release package unexpectedly contains ${manifest.entryCount} files.`,
  );
}
console.log(
  `Package ready: ${manifest.entryCount} files, ${(manifest.size / 1024 / 1024).toFixed(1)} MB compressed.`,
);

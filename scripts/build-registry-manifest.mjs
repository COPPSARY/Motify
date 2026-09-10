import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const registryRoot = join(projectRoot, "registry");
const outputPath = join(registryRoot, "registry.json");
const groups = ["examples", "blocks", "components"];

function compactVariable(variable) {
  return Object.fromEntries(
    [
      "id",
      "type",
      "default",
      "options",
    ]
      .filter((key) => variable[key] !== undefined)
      .map((key) => [key, variable[key]]),
  );
}

function compactItem(item) {
  const compact = Object.fromEntries(
    [
      "name",
      "type",
      "title",
      "description",
      "tags",
      "jobs",
      "family",
      "profile",
    ]
      .filter((key) => item[key] !== undefined)
      .map((key) => [key, item[key]]),
  );

  if (Array.isArray(item.variables) && item.variables.length > 0) {
    compact.variables = item.variables.map(compactVariable);
  }

  return compact;
}

const items = [];
for (const group of groups) {
  const groupPath = join(registryRoot, group);
  for (const entry of readdirSync(groupPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metadataPath = join(groupPath, entry.name, "registry-item.json");
    if (!existsSync(metadataPath)) continue;

    const item = JSON.parse(readFileSync(metadataPath, "utf8"));
    items.push(compactItem(item));
  }
}

items.sort((a, b) => {
  const groupOrder = groups.map((group) => `hyperframes:${group.slice(0, -1)}`);
  const typeDelta = groupOrder.indexOf(a.type) - groupOrder.indexOf(b.type);
  return typeDelta || a.name.localeCompare(b.name);
});

const manifest = {
  $schema: "https://hyperframes.heygen.com/schema/registry.json",
  name: "hyperframes",
  homepage: "https://hyperframes.heygen.com",
  items,
};

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${items.length} enriched registry entries to ${outputPath}`);

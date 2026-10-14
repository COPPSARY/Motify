// Bundles src/render-kit into one browser script, `window.MotifyRenderKit`, for a
// headless Chromium: the backend's render check and the export-parity script load
// it to mount and rasterize a film with the editor's own code.
//
//   node scripts/build-render-kit.mjs [outFile]
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = resolve(process.argv[2] ?? resolve(root, "dist-render-kit/motify-render-kit.js"));

/** Vite's `?raw` (file text) and `?url` (here: an inlined data URL) imports. */
const viteQueries = {
  name: "vite-queries",
  setup(builder) {
    builder.onResolve({ filter: /\?(raw|url)$/ }, async (args) => {
      const [path, query] = args.path.split("?");
      const resolved = await builder.resolve(path, { resolveDir: args.resolveDir, kind: args.kind });
      return { path: resolved.path, namespace: `vite-${query}` };
    });
    builder.onLoad({ filter: /.*/, namespace: "vite-raw" }, async (args) => ({
      contents: await readFile(args.path, "utf8"),
      loader: "text",
    }));
    builder.onLoad({ filter: /.*/, namespace: "vite-url" }, async (args) => ({
      contents: await readFile(args.path),
      loader: "dataurl",
    }));
  },
};

await build({
  entryPoints: [resolve(root, "src/render-kit/index.ts")],
  outfile,
  bundle: true,
  format: "iife",
  globalName: "MotifyRenderKit",
  platform: "browser",
  target: "chrome120",
  minify: true,
  legalComments: "none",
  plugins: [viteQueries],
  logLevel: "warning",
});
process.stdout.write(`${outfile}\n`);

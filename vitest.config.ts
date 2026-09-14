import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ["browser"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    // The composition suites are CPU-heavy DOM/GSAP renders. Letting Vitest
    // start one worker per core makes individual films slower than the default
    // timeout on shared release runners even though they complete correctly.
    maxWorkers: 4,
    // CSS is stubbed out in tests by default, even through ?raw. The scene kit
    // is a stylesheet the runtime mounts as text, so its tests need the real one.
    css: { include: [/scene-kit\.css/] },
    testTimeout: 120000,
    hookTimeout: 120000,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "tests/", "**/*.test.ts"],
    },
  },
});

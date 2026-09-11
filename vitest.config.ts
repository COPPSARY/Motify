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
    // CSS is stubbed out in tests by default, even through ?raw. The scene kit
    // is a stylesheet the runtime mounts as text, so its tests need the real one.
    css: { include: [/scene-kit\.css/] },
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "tests/", "**/*.test.ts"],
    },
  },
});

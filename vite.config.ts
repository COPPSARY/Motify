import { defineConfig, loadEnv } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { createAiMiddleware } from "./src/ai/gemini-server";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      svelte(),
      {
        name: "motionly-ai-provider",
        configureServer(server) {
          server.middlewares.use(createAiMiddleware(env));
        },
      },
    ],
    base: process.env.BASE_PATH ?? "/",
    server: {
      port: 5173,
      open: false,
      watch: {
        ignored: [
          "**/.agents/**",
          "**/.gemini/**",
          "**/dist/**",
          "**/.github/**",
          "**/artifacts/**",
          "**/qa/**",
        ],
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      target: "es2022",
      rollupOptions: {
        input: {
          editor: "index.html",
          render: "render.html",
        },
      },
    },
    resolve: { alias: { "@": "/src" } },
    optimizeDeps: { include: ["gsap"] },
  };
});

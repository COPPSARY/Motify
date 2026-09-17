# Architecture

```text
composition.html + scoped CSS
              + timeline.js / GSAP
                         ↓
          thin CompositionDefinition adapter
                         ↓
                CompositionRuntime
                 ├─ preview controls
                 ├─ element selection and overrides
                 └─ frame export
```

The HTML template is the authored visual composition. `timeline.js` receives the root, paused master timeline, and element-registration function, then adds nested or overlapping tweens. `CompositionDefinition.build()` is only the adapter that clones the template and invokes that timeline builder.

Do not add a DSL, parser, JSON scene representation, generated DOM layer, or a second renderer. The browser DOM and caller-owned GSAP timeline are the source used by both preview and export.

The runtime quantizes explicit seeks to composition frames. Playback delegates to GSAP. Scene state is derived from the current time and scene metadata. Visual overrides are reapplied after timeline evaluation.

Export seeks and captures the same mounted composition used by preview. This keeps text, SVG, transforms, media, and GSAP state deterministic between the editor and rendered frames.

## Local and Cloud

`src/ui/App.svelte` owns the shared editor. The Cloud assistant UI lives in `src/ui/cloud/`; the existing `src/cloud/` modules handle cloud projects. The CLI and browser deployment mount the same editor with an explicit `local` or `cloud` mode. The CLI marks its served page as Local, while `index.html` marks the browser deployment as Cloud. `src/app/mode.ts` reads that marker at startup.

Local mode gives the preview the space normally occupied by Cloud chat. Presets, project assets, and authored source are available from the Local editor toolbar. Cloud mode keeps Tiffy, AI generation, authentication, and cloud project management. Both modes use the same composition runtime, timeline, inspector, and export code.

## Deployed AI prompt

`npm run dev` and `npm run build` first run `scripts/build-ai-prompt.mjs`. It bundles `src/ai/system-runtime.md` and `.agents/skills/write-motionly/SKILL.md` into the committed `src/ai/generated/prompt.ts`. The generated module exports the complete system prompt, source paths, and a SHA-256 content version. Line endings are normalized; builds contain no timestamps or machine-specific paths.

`src/ai/prompt.ts` is the stable re-export used by browser generation, the local Vite middleware, and `/api/ai/generate`. No browser filesystem reads or runtime skill downloads are needed. The external Render/cloud generation service has its own path and is outside this bundle.

Permanent runtime and creative instructions belong in those two Markdown sources. `buildMotionlyUserMessage` supplies project-specific requests, assets, conversation, accepted source, and retrieved examples. `src/ai/repair-prompt.ts` supplies only the selected failures and corrections; repairs retain the same system prompt and edit the generated result in place.

After changing a prompt source, run `npm run prompt:build` and commit the artifact with it. Restart an already-running dev server or run that command manually to refresh the bundle during development. `npm run prompt:check` fails without rewriting files if the artifact is missing or stale; CI runs it before the build can regenerate anything. The skill's JSON output contract includes `skills: ["write-motionly"]`. The schema is model guidance, not a second animation representation or a guarantee of rendered visual quality.

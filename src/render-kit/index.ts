/**
 * The editor's own compiler, scene kit, presets, runtime and export rasterizer,
 * bundled for a headless browser as `window.MotifyRenderKit`
 * (`npm run render-kit:build`). The backend's render check loads it, so the film
 * it inspects is mounted and rasterized by exactly the code the editor and the
 * export use.
 */
export { mountFilm, type FilmInput, type MountedFilm } from "./mount";
export {
  renderCheck,
  type RenderCheckInput,
  type RenderCheckResult,
  type RenderFault,
} from "./render-check";

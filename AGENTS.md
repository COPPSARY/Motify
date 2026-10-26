# Motionly Agent Notes

Motionly is a code-first motion graphics tool. Read `.agents/skills/write-motionly/SKILL.md` before substantial composition, timing, transition, camera, export, or product-film work.

## Product rule

HTML is the authored visual source. Scoped CSS styles the composition and `timeline.js` writes motion into a caller-owned GSAP timeline. A thin TypeScript adapter supplies metadata and mounts those files; it must not recreate the composition. Preview and export use that same mounted DOM and timeline.

Keep the visual editor: centered preview, correct aspect ratio, Play/Pause/Restart, deterministic scrubber, storyboard scenes, selection, position/scale/rotation/opacity/text controls, assets, presets, and export.

## Core Motion & Typography Rules

- **Transitions use MORPH, MATCH-CUT, PARTICLE-REASSEMBLE, BEAT-CUT, or BLUR-DISSOLVE**: Never cut between still frames, plain cross-dissolve, or fade to black.
  - **MORPH**: Shape's own outline (width, height, border-radius) stretches and bends continuously.
  - **MATCH-CUT**: Cut happens at the exact instant two shots share identical position and silhouette.
  - **PARTICLE-REASSEMBLE**: Object fractures into physical shards that travel and reform into the next object.
  - **BEAT-CUT** (`beatCut`): Hard cut on a music hit. The outgoing shot leaves on an accelerating move or blur ramp; the incoming one enters already moving.
  - **BLUR-DISSOLVE** (`blurDissolve`): Both shots keep moving while one blurs out and the next resolves.
- **Single Full-Sentence Editorial Thoughts**: NEVER split thoughts into oversized headlines plus tiny subtitles. Use single, bold, full-size statements in standard `Inter 68px/700`, strictly centered (`xPercent: -50, yPercent: -50`).
- **Giant-to-Settle Kinetic Zoom**: Statements enter massive/zoomed-in (`scale: 2.0+` with gradient fill) and dynamically pull back into centered focus.
- **Continuous Word-by-Word Animation**: Typography always animates word-by-word with spring overshoot bounce (`back.out(1.35)`).
- **Rule of Continuous Motion**: No frame is ever static; apply continuous drift, breathing scale, or live stroke drawing.
- **No Premature Cursors & No Muddy Dark Veils**: Cursors arrive only with an action (a hover, a click, typing); never use full-screen dark opacity overlays over luminous backgrounds.

## Runtime boundary

`CompositionDefinition.build()` is the editor adapter boundary. It receives `root`, `timeline`, and `register`, mounts `composition.html`, then calls `timeline.js`. Do not introduce a second project representation, interpreter, conversion step, or renderer.

Use the helpers in `src/composition/presets.ts`, extend that small library when a reusable motion idea is genuinely missing, and keep each helper composable on a caller-owned timeline.

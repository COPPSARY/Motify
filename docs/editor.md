# Editor

The editor preserves Motify's visual workflow around the mounted HTML and GSAP timeline:

- centered aspect-ratio preview
- Play, Pause, Restart, and deterministic scrubbing
- storyboard scene navigation
- a scene and camera timeline
- canvas element selection
- text, position, scale, rotation, and opacity overrides
- composition preset and HTML source panels
- PNG frame export from the mounted composition

Visual controls update runtime overrides. Structure and styling remain authored in HTML/CSS, while choreography remains authored in `timeline.js`.

Local mode opens from `motify dev`. It has no Tiffy or prompt panel; the toolbar opens presets, files from the project's `assets/` folder, and the source files. The editor fills the space used by Cloud chat. Use a coding agent to modify the project files, then preview and export in Motify.

Cloud mode keeps the Tiffy chat and prompt on the left and cloud project controls around the same editor.

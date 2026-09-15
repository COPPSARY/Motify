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

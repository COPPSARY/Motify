# Motify

Motify is a code-first motion graphics tool for creating, previewing, and exporting professional animations.

A composition is normal HTML/SVG with scoped CSS and a JavaScript GSAP timeline. A small TypeScript adapter owns dimensions, frame rate, and scene metadata, mounts the HTML, and passes the editor-owned timeline to the JavaScript choreography. The visual editor controls that exact DOM and timeline for Play, Pause, Restart, seek, and export.

There is no intermediate project language or conversion pipeline.

# Motify Engineering Issues & Backlog

This backlog tracks prioritized architectural tasks, bug fixes, UX enhancements, and feature requests for Motify.

---

## Priority Matrix

| ID | Title | Type | Priority | Area |
| :--- | :--- | :--- | :--- | :--- |
| **[#01](#issue-01-bug-ai-redo--re-prompt-corrupts-timeline-tracks-and-scrubber-sync)** | AI Redo / Re-prompt Corrupts Timeline Tracks & Scrubber Sync | Bug | **P0 (Blocker)** | Runtime / Timeline |
| **[#02](#issue-02-bug-dynamic-compiler-ghost-tween-targets-and-memory-leaks)** | Dynamic Compiler Ghost Tween Targets & Memory Leaks | Bug | **P0 (Blocker)** | Runtime / GSAP |
| **[#03](#issue-03-feature-local--cloud-media-uploads-images-and-videos)** | Local & Cloud Media Uploads (Images and Videos in Compositions) | Feature | **P1 (High)** | Media / Assets |
| **[#04](#issue-04-feature-sound-effects-sfx--music-bed-library-with-audio-export)** | Sound Effects (SFX) & Music Library with Video Audio Muxing | Feature | **P1 (High)** | Audio / Export |
| **[#05](#issue-05-enhancement-interactive-timeline-ux-draggable-handles-snapping--zoom)** | Interactive Timeline UX (Draggable Handles, Snapping & Zoom) | Enhancement | **P1 (High)** | UI / Timeline |
| **[#06](#issue-06-feature-multi-turn-targeted-ai-editing-skills)** | Multi-Turn Targeted AI Editing Skills (Preserve Composition State) | Feature | **P1 (High)** | AI / Prompt |
| **[#07](#issue-07-feature-undo--redo-history-stack-cmdz--cmdshiftz)** | Undo / Redo History Stack (`Cmd+Z` / `Cmd+Shift+Z`) | Feature | **P1 (High)** | Editor Shell |
| **[#08](#issue-08-enhancement-ai-schema-validation-pre-flight-linter--auto-repair)** | AI Schema Pre-flight Validation & Self-Healing Pipeline | Enhancement | **P2 (Medium)** | AI / Compiler |
| **[#09](#issue-09-feature-in-editor-reusable-component--block-library-drawer)** | In-Editor Reusable Component & Block Library Drawer | Feature | **P2 (Medium)** | UI / Registry |
| **[#10](#issue-10-feature-multi-aspect-ratio-support-169-916-vertical-shorts-11)** | Multi-Aspect Ratio Support (16:9, 9:16 Shorts/Reels, 1:1) | Feature | **P2 (Medium)** | Preview / Export |
| **[#11](#issue-11-enhancement-real-time-canvas-error-boundary--diagnostic-hud)** | Real-Time Canvas Error Boundary & Diagnostic HUD | Enhancement | **P2 (Medium)** | Preview Stage |

---

## Detailed Issue Specifications

### Issue #01: [BUG] AI Redo / Re-prompt Corrupts Timeline Tracks and Scrubber Sync
- **Type**: Bug
- **Priority**: P0 (High impact on core user workflow)
- **Problem**:
  When a user prompts the AI to "redo", "change color", "shorten scene 1", or "make text faster", the timeline panel often breaks:
  1. Timeline tracks display negative widths or overflow past 100%.
  2. The scrubber playhead freezes or jumps erratically.
  3. Ghost tracks from the previous generation remain rendered even after elements are removed.
- **Root Cause**:
  1. In `src/ui/timeline-data.ts` (`deriveSceneTracks`), `tw.startTime()` is computed in global timeline coordinates (e.g. `14.2s` for Scene 3), but the UI calculates track offset assuming local scene relative seconds.
  2. `registeredElements` iterates over all elements across the entire document rather than scoping to the active scene element container, leaking Scene 1 tracks into subsequent scenes.
  3. When AI modifies `result.duration`, it frequently mismatches the sum of `result.scenes[].duration`. The scrubber clamps to `activeComposition.duration`, causing a timeline lockup.
- **Implementation Plan**:
  1. Scope `deriveSceneTracks` to query elements inside `[data-scene-id="..."]` or check element hierarchy.
  2. Normalize `trackStart` and `trackEnd` relative to `scene.start`.
  3. Add pre-mount duration reconciler in `createDynamicComposition` to ensure `duration === Math.max(duration, sum(scenes.duration), timeline.totalDuration())`.
- **Acceptance Criteria**:
  - Re-prompting AI to edit or redo a scene results in zero track width overflows or NaN styles.
  - All track clips align accurately with their scene boundaries.
  - Playhead smoothly traverses from `0` to end without freezes.

---

### Issue #02: [BUG] Dynamic Compiler Ghost Tween Targets and Memory Leaks
- **Type**: Bug
- **Priority**: P0
- **Problem**:
  When generating multiple AI compositions rapidly, GSAP tweens from previous runs continue ticking or hold memory references to detached DOM nodes, leading to performance degradation and audio/visual desync.
- **Root Cause**:
  In `src/composition/dynamic-compiler.ts`, `gsap.timeline()` instances created inside the dynamic runner are not automatically bound to `context.timeline`. If the AI writes `gsap.to(...)` outside the caller-owned timeline, those tweens become orphaned on the GSAP global timeline.
- **Implementation Plan**:
  1. Wrap dynamic timeline execution inside a dedicated `gsap.context()` boundary.
  2. Explicitly revert `gsap.context()` in `CompositionRuntime.destroy()`.
  3. Disallow unparented `gsap.to()` / `gsap.from()` by intercepting global GSAP methods during the build phase.
- **Acceptance Criteria**:
  - Repeatedly generating 10 compositions in succession results in 0 orphaned tweens on `gsap.globalTimeline`.
  - DOM memory is completely reclaimed after each AI generation.

---

### Issue #03: [FEATURE] Local & Cloud Media Uploads (Images and Videos)
- **Type**: Feature
- **Priority**: P1
- **Problem**:
  Users currently cannot insert real product screenshots, logos, user avatars, or demo video clips into compositions without manually writing inline data URLs.
- **Specification**:
  1. **Assets Panel**:
     - Dedicated "Assets" tab in the left navigation rail.
     - Dropzone supporting PNG, JPG, WebP, SVG, MP4, WebM.
  2. **Canvas Drag-and-Drop**:
     - Dragging an image from the Assets tab onto an element replaces its image/background source.
     - Dragging onto the stage creates a new positioned `<img />` or `<video />` layer with an auto-generated `data-edit` handle.
  3. **Storage Strategy**:
     - In-memory object URLs (`URL.createObjectURL`) for instant local preview.
     - Synchronized to IndexedDB locally and uploaded to cloud storage when saving a cloud project.
- **Acceptance Criteria**:
  - User can drag an image from desktop onto the stage and see it render immediately.
  - Exported video correctly renders the uploaded image/video frames without CORS taint.

---

### Issue #04: [FEATURE] Sound Effects (SFX) & Music Bed Library with Video Audio Muxing
- **Type**: Feature
- **Priority**: P1
- **Problem**:
  Motify videos are silent. Premium motion graphics require transition whooshes, kinetic text pops, UI clicks, and background music beds.
- **Specification**:
  1. **Built-in SFX Catalog**:
     - Transition whooshes, soft swooshes, UI pops, typewriter clicks, bass impacts.
     - Curated royalty-free background music tracks with beat markers.
  2. **Timeline Audio Lane**:
     - Visual waveform display in the timeline panel.
     - Volume control, fade-in / fade-out duration handles, and voiceover ducking.
  3. **Event-Driven SFX in Compositions**:
     - Support dispatching `CustomEvent("motionly:sfx", { detail: { id: "whoosh-soft", time: 1.2 } })`.
  4. **Audio Muxing on Export**:
     - Integrate Web Audio API `AudioContext` and `OfflineAudioContext` into `src/composition/exporter.ts`.
     - Mux mixed AAC/Opus audio track with WebCodecs video frames into final MP4/WebM files.
- **Acceptance Criteria**:
  - Preview plays synced sound effects and background music.
  - Exported MP4 file contains audio tracks synchronized with video frames.

---

### Issue #05: [ENHANCEMENT] Interactive Timeline UX (Draggable Handles, Snapping & Zoom)
- **Type**: Enhancement
- **Priority**: P1
- **Problem**:
  The timeline is currently read-only for track timing. Users must edit code or prompt AI to change clip duration or scene transitions.
- **Specification**:
  1. **Draggable Handles**:
     - Left and right drag handles on timeline clips to adjust `start` and `duration`.
     - Shift-drag to ripple edit (automatically shift subsequent clips).
  2. **Timeline Snapping**:
     - Snap to current playhead position, neighboring clip edges, and 0.5s grid increments.
  3. **Scrubber Zoom**:
     - `+` / `-` zoom buttons and `Cmd/Ctrl + Scroll` to zoom in from overview down to individual frame increments.
  4. **Multi-Track View**:
     - Toggle between collapsed scene view and expanded multi-layer track view.
- **Acceptance Criteria**:
  - Dragging a clip boundary updates the underlying composition definition and instantly reflects on canvas.

---

### Issue #06: [FEATURE] Multi-Turn Targeted AI Editing Skills
- **Type**: Feature
- **Priority**: P1
- **Problem**:
  Asking AI for small adjustments ("make the font larger", "change button to purple") currently regenerates the entire file from scratch, discarding previous edits and often altering scenes that the user did not want changed.
- **Specification**:
  1. **Targeted Edit Intents**:
     - `RETIME`: Only recalculates GSAP timing offsets and durations.
     - `STYLE`: Only updates specific CSS variables or rules without re-authoring markup.
     - `CONTENT`: Only replaces text strings or image URLs.
     - `RECHOREOGRAPH_SCENE`: Rewrites only the specified scene while holding all other scenes unchanged.
  2. **Context Injection**:
     - Send the selected element ID, current scene ID, and targeted diff request to the AI prompt.
- **Acceptance Criteria**:
  - Prompting "change title to 'Welcome to Motify'" only updates the target text node; all existing animations and other scenes remain identical.

---

### Issue #07: [FEATURE] Undo / Redo History Stack (`Cmd+Z` / `Cmd+Shift+Z`)
- **Type**: Feature
- **Priority**: P1
- **Problem**:
  Users have no way to revert an AI generation or manual transform edit if they dislike the outcome.
- **Specification**:
  1. Implement a state history stack:
     - Record snapshot: `{ html, js, scenes, duration, overrides }`.
     - Limit history stack to 30 snapshots with debounced recording.
  2. Support standard shortcuts:
     - Undo: `Cmd+Z` (Mac) / `Ctrl+Z` (Windows/Linux).
     - Redo: `Cmd+Shift+Z` / `Ctrl+Y`.
  3. Add undo/redo buttons in top navigation bar with disabled states when stack is empty.
- **Acceptance Criteria**:
  - Pressing `Cmd+Z` restores previous composition state, timeline tracks, and preview canvas.

---

### Issue #08: [ENHANCEMENT] AI Schema Validation, Pre-flight Linter & Auto-Repair
- **Type**: Enhancement
- **Priority**: P2
- **Problem**:
  If the AI returns invalid JSON, missing scene IDs, or malformed JavaScript, the editor throws an unhandled error and breaks the active session.
- **Specification**:
  1. **Pre-flight Linter**:
     - Validate JSON schema using lightweight schema validator.
     - Validate HTML (must contain `<template>` and at least one element).
     - Validate JS AST (ensure `buildTimeline` exists and syntax is valid).
  2. **Self-Healing Loop**:
     - If linting detects a parse error, execute an automated 1-turn repair prompt with the compiler error message before surfacing to the user.
- **Acceptance Criteria**:
  - Malformed AI output is automatically intercepted and fixed without showing a fatal crash to the user.

---

### Issue #09: [FEATURE] In-Editor Reusable Component & Block Library Drawer
- **Type**: Feature
- **Priority**: P2
- **Problem**:
  The project has 150+ blocks and 200+ components in `registry/`, but they are not visually discoverable in the UI.
- **Specification**:
  1. Add a "Blocks" and "Components" drawer in the UI.
  2. Categorize items: Typography, Backgrounds, Data Viz, Callouts, Cursors, Transitions.
  3. Include animated thumbnail previews on card hover.
  4. 1-click "Insert Block" button that automatically appends the block into the active composition and wires its GSAP entrance.
- **Acceptance Criteria**:
  - User can browse the catalog, click "Insert Before/After Wipe", and see it running immediately in the canvas.

---

### Issue #10: [FEATURE] Multi-Aspect Ratio Support (16:9, 9:16 Vertical, 1:1)
- **Type**: Feature
- **Priority**: P2
- **Problem**:
  Video output is locked to 1920x1080. Creators creating vertical content (Reels, TikTok, Shorts) cannot preview or export 9:16 compositions.
- **Specification**:
  1. Top-bar aspect ratio dropdown:
     - `16:9 Landscape (1920×1080)`
     - `9:16 Vertical (1080×1920)`
     - `1:1 Square (1080×1080)`
     - `4:5 Social (1080×1350)`
  2. Safe zone overlays for 9:16 (displaying TikTok/Reels UI obstruction zones).
  3. Pass active aspect ratio to AI prompt so typography and layout are automatically framed vertically.
- **Acceptance Criteria**:
  - Switching to 9:16 updates canvas framing, preview stage, and export resolution.

---

### Issue #11: [ENHANCEMENT] Real-Time Canvas Error Boundary & Diagnostic HUD
- **Type**: Enhancement
- **Priority**: P2
- **Problem**:
  When user code or AI output throws a runtime error, the preview canvas goes blank with no visible feedback.
- **Specification**:
  1. Wrap preview stage in an error boundary component.
  2. Display a sleek HUD overlay showing:
     - Error message & line number.
     - "Revert to Previous Version" button.
     - "Ask AI to Fix" 1-click action.
- **Acceptance Criteria**:
  - An error in custom JS displays a clear diagnostic HUD without freezing the editor or losing user work.

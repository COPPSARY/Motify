# Motify Product & Engineering Roadmap

This roadmap outlines the core milestones for Motify. For individual issue breakdowns, technical root causes, and acceptance criteria, see **[ISSUES_BACKLOG.md](docs/issues-backlog.md)**.

---

## Phase 1: Core Runtime Stability & AI Synchronization (Current)
*Focus: Rock-solid timeline performance, zero desync during AI regeneration, and memory safety.*

- [ ] **[#01] AI Redo & Timeline Synchronization**: Fix timeline track desynchronization and playhead freeze when prompting AI to edit or redo compositions ([Issue #01](docs/issues-backlog.md#issue-01-bug-ai-redo--re-prompt-corrupts-timeline-tracks-and-scrubber-sync)).
- [ ] **[#02] GSAP Context Isolation**: Prevent orphaned tweens and memory leaks by encapsulating dynamic compiler runs inside `gsap.context()` boundaries ([Issue #02](docs/issues-backlog.md#issue-02-bug-dynamic-compiler-ghost-tween-targets-and-memory-leaks)).
- [ ] **[#07] Undo / Redo History**: Add snapshot-based `Cmd+Z` / `Cmd+Shift+Z` history stack to safely undo and redo canvas and AI adjustments ([Issue #07](docs/issues-backlog.md#issue-07-feature-undo--redo-history-stack-cmdz--cmdshiftz)).
- [ ] **[#08] Pre-flight Validation & Auto-Healing**: Validate generated JSON and JavaScript syntax before mounting, automatically repairing errors with a 1-shot recovery loop ([Issue #08](docs/issues-backlog.md#issue-08-enhancement-ai-schema-validation-pre-flight-linter--auto-repair)).

---

## Phase 2: Media, Assets & Sound Engine
*Focus: Allowing users to insert real images/videos, sound effects, and background music.*

- [ ] **[#03] Image & Video Asset Uploads**: Support dragging and dropping screenshots, mockups, and video clips into composition slots via an in-editor Assets drawer ([Issue #03](docs/issues-backlog.md#issue-03-feature-local--cloud-media-uploads-images-and-videos)).
- [ ] **[#04] Sound Effects (SFX) & Music Library**: Built-in library of transition whooshes, UI pops, and ambient music tracks with timeline waveform preview and MP4 audio export muxing ([Issue #04](docs/issues-backlog.md#issue-04-feature-sound-effects-sfx--music-bed-library-with-audio-export)).
- [ ] **[#10] Multi-Aspect Ratio Support**: Seamless switching and safe-zone guides for 16:9 Landscape, 9:16 Vertical Shorts/Reels/TikTok, and 1:1 Square formats ([Issue #10](docs/issues-backlog.md#issue-10-feature-multi-aspect-ratio-support-169-916-vertical-shorts-11)).

---

## Phase 3: Timeline UX & Component Ecosystem
*Focus: Professional editing experience and 1-click access to the HyperFrames component library.*

- [ ] **[#05] Interactive Draggable Timeline**: Direct manipulation of clip start/end times with snapping, ripple editing, and zoomable sub-second scrubber ([Issue #05](docs/issues-backlog.md#issue-05-enhancement-interactive-timeline-ux-draggable-handles-snapping--zoom)).
- [ ] **[#06] Targeted Multi-Turn AI Skills**: Instruct AI to adjust styles, text, or retiming for specific layers without regenerating the entire project ([Issue #06](docs/issues-backlog.md#issue-06-feature-multi-turn-targeted-ai-editing-skills)).
- [ ] **[#09] Reusable Block & Component Drawer**: Browse and insert 150+ scene blocks and 200+ motion components from the HyperFrames registry directly in the editor ([Issue #09](docs/issues-backlog.md#issue-09-feature-in-editor-reusable-component--block-library-drawer)).
- [ ] **[#11] Canvas Diagnostic HUD**: In-canvas visual error boundary with 1-click "Revert" and "Ask AI to Fix" actions ([Issue #11](docs/issues-backlog.md#issue-11-enhancement-real-time-canvas-error-boundary--diagnostic-hud)).

# GitHub Issues Creator Script for Motionly
# Run this script after logging into GitHub CLI (`gh auth login`)

$issues = @(
    @{
        title = "fix(runtime): AI redo and re-prompt corrupts timeline tracks and scrubber sync"
        body = @"
### Description
When prompting the AI to redo, edit, or shorten scenes, the timeline tracks often glitch: tracks display negative or >100% widths, playhead jumps erratically, and ghost tracks from previous generations linger.

### Goals
- Scope track derivation strictly to the active scene element container
- Normalize track start/end seconds relative to scene.start offset
- Auto-reconcile total composition duration against actual GSAP tween duration
- Prevent scrubber freeze and NaN timeline clip widths
"@
    },
    @{
        title = "fix(runtime): dynamic compiler ghost tween targets and memory leaks"
        body = @"
### Description
Repeated AI generations cause GSAP tweens from previous runs to remain active or hold references to detached DOM nodes, degrading preview performance.

### Goals
- Encapsulate dynamic timeline compilation inside an isolated gsap.context()
- Cleanly revert and destroy all GSAP tweens and listeners on composition unmount
- Intercept unparented global GSAP tweens during the dynamic build phase
- Ensure zero DOM node memory leaks between AI edits
"@
    },
    @{
        title = "feat(media): local and cloud media uploads for images and video layers"
        body = @"
### Description
Users currently cannot insert real product screenshots, mockups, brand logos, or demo video clips into compositions without manually writing inline data URLs.

### Goals
- Dedicated Assets drawer in the navigation rail with upload dropzone (PNG, WebP, SVG, MP4)
- Drag-and-drop assets directly onto canvas elements and slot placeholders
- Fast in-browser preview via object URLs and IndexedDB persistence
- Automated asset bundling when saving projects or exporting video
"@
    },
    @{
        title = "feat(audio): sound effects (SFX) and music bed library with video export muxing"
        body = @"
### Description
Motionly compositions are currently silent. Professional motion graphics require synchronized hit sounds (whooshes, pops, typewriter clicks) and background music beds.

### Goals
- Built-in library of royalty-free UI hits, whooshes, and ambient background music
- Dedicated audio track lane on the timeline with waveform preview
- Volume, fade-in, fade-out, and voiceover audio ducking controls
- Full Web Audio API muxing into final MP4/WebM exports
"@
    },
    @{
        title = "feat(timeline): interactive draggable handles, snapping, and scrubber zoom"
        body = @"
### Description
Improve timeline navigation and clip editing for larger projects.

### Goals
- Interactive drag handles on timeline clips to adjust start and duration
- Magnetic snapping to playhead, markers, and neighboring scene boundaries
- Zoom controls (+ / - and Cmd+Scroll) from full project down to sub-second frames
- Ripple editing mode to automatically shift downstream scenes
"@
    },
    @{
        title = "feat(ai): multi-turn targeted AI editing skills"
        body = @"
### Description
Prompting the AI for minor tweaks (e.g. 'change title to blue' or 'extend scene 1 by 2s') currently regenerates the entire file from scratch, wiping manual adjustments.

### Goals
- Targeted edit modes: style-only, retime-only, content-replacement, and scene-rechoreography
- Preserve existing scenes and untouched elements during AI re-prompts
- Inject selected layer and scene context into prompt orchestration
- Faster generation turnaround for incremental edits
"@
    },
    @{
        title = "feat(editor): undo and redo history stack (Cmd+Z / Cmd+Shift+Z)"
        body = @"
### Description
There is currently no way to revert an undesirable AI generation or manual transform edit.

### Goals
- Snapshot-based history stack tracking composition files and visual overrides
- Standard keyboard shortcuts: Cmd+Z (Undo) and Cmd+Shift+Z / Ctrl+Y (Redo)
- Visual Undo and Redo buttons in the top navigation bar with disabled states
- Debounced snapshot capture to avoid performance hits
"@
    },
    @{
        title = "feat(ai): schema pre-flight linter and auto-healing pipeline"
        body = @"
### Description
If the AI model returns invalid JSON, missing scene definitions, or malformed JavaScript, the editor throws unhandled exceptions.

### Goals
- Pre-mount schema validation for HTML structure and JavaScript AST
- Enforce duration consistency (totalDuration == sum of scene durations)
- Automated 1-turn repair prompt that feeds syntax errors back to the model before failing
- Clear, actionable error diagnostics when manual recovery is needed
"@
    },
    @{
        title = "feat(ui): in-editor reusable component and block library drawer"
        body = @"
### Description
Motionly now has 150+ scene blocks and 200+ components in the registry, but they are not visually discoverable in the UI.

### Goals
- In-editor Component & Block browser drawer with searchable tags
- Animated card previews on hover for kinetic typography, transitions, and backgrounds
- 1-click 'Insert Block' action that merges markup and GSAP choreography into active scene
- Custom component saving for user-authored favorites
"@
    },
    @{
        title = "feat(canvas): multi-aspect ratio support (16:9, 9:16 vertical shorts, 1:1 square)"
        body = @"
### Description
Canvas and video export are currently hardcoded to 1920x1080 (16:9), preventing creators from creating vertical content for TikTok, Reels, and YouTube Shorts.

### Goals
- Aspect ratio switcher in the top bar (16:9, 9:16, 1:1, 4:5)
- Safe-zone overlay guides for mobile UI obstruction areas
- Orientation-aware AI prompt scaling for vertical typography and layouts
- Export resolution matching selected aspect ratio
"@
    },
    @{
        title = "feat(preview): real-time canvas error boundary and diagnostic HUD"
        body = @"
### Description
When custom JavaScript or AI-generated choreography throws an error during playback, the canvas goes blank with no indication of what broke.

### Goals
- In-canvas error boundary overlay with line number and stack trace
- 1-click 'Revert to Last Working State' button
- 1-click 'Ask AI to Fix' error diagnostic action
- Prevent editor crashes and lost project state during development
"@
    }
)

Write-Host "Creating $($issues.Count) GitHub issues via gh CLI..." -ForegroundColor Cyan

foreach ($issue in $issues) {
    Write-Host "Creating issue: $($issue.title)" -ForegroundColor Yellow
    gh issue create --title $issue.title --body $issue.body
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create issue. Ensure you are logged in via 'gh auth login'." -ForegroundColor Red
        break
    }
}

Write-Host "Done!" -ForegroundColor Green

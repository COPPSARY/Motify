# Walkthrough: Macro Camera Zoom, Typing Follow Pan & 1-by-1 Staggered UI Construction

## Summary of Completed Work

### 1. Updated `write-motionly` Skill (`.agents/skills/write-motionly/SKILL.md`)
Codified the user's motion principles permanently into the official Motionly skills:
- **Continuous Camera Storytelling, Macro Focus & Typing Follow**:
  - **Macro Zoom Focus**: When focusing on an interactive element, textarea, or card, zoom in tight (`scale: 1.6 - 2.4`) directly on the active subject. Never linger at a far-away, detached perspective (`scale: 1.0 - 1.1`).
  - **Real-Time Typing Follow Pan**: During character-by-character typing, the camera must smoothly pan horizontally following the advance of the text (`ease: "sine.inOut"`, matching typing duration).
  - **Dramatic Re-Framing to Action Targets**: Glide rapidly from text input to action buttons with dramatic velocity contrast (`expo.inOut`, `power3.inOut`, duration 0.9s–1.2s).
  - **Hold Close Focus on Responses Before Pullback**: After triggering an action, hold the camera close to the newly constructed response (`scale: 1.4 - 1.6`) for inspection before executing a motivated pullback.
- **Architectural 1-by-1 UI Construction (Never Monolithic Simultaneous Fade-Ins)**:
  - UI elements must NEVER appear or fade in together as a flat, static block.
  - Every interface must assemble and construct progressively, 1-by-1, with physical vertical offsets (`y: 60 - 100px`), staggered delays (`+0.1s` to `+0.2s`), and distinct non-linear eases (`power3.out`, `back.out(1.2)`, `power4.out`, blooming `scale: 0 -> 1` with `back.out(1.5)`).
- **Duration-Aware Easing**:
  - `inOut` / `expo.inOut` requires generous duration (0.9s to 1.4s) for smooth acceleration and slow-motion deceleration.
  - Tactile snappy clicks and carets use short durations (0.08s to 0.25s) with `power2.out`, `power2.inOut`, or `back.out(2)`.
  - Physical card entrances use 0.9s–1.4s with `back.out(1.2 - 1.5)` or `power4.out` to convey weight and momentum.
- **Introduce & Explain First (Marketing SaaS Flow)**:
  - Introduce and explain the problem or concept first using kinetic typography and shape morphing.
  - Then construct the authentic product UI surface as the causal proof.

---

### 2. Upgraded KiriTTS Preset (`src/compositions/presets/KiriTTS/timeline.js`)
- **Act 1: Linguistic Barrier & Native Word Segmentation**:
  - Camera glides down into the Linguistic Solution with macro framing (`scale: 1.55, y: -45, duration: 1.9s, power3.inOut`).
  - 1-by-1 staggered construction of the Linguistic Challenge card (`monolithicBox` rises from `y: 80, power3.out`, error badges pop 1-by-1 with `back.out(1.5)`).
  - Scanning beam sweeps across script and segmented word chips bloom 1-by-1 (`scale: 0 -> 1, back.out(1.6)` staggered by 0.08s).
- **Act 2: Authentic Text to Speech Studio**:
  - **Deep Macro Camera Zoom**: Camera zooms into tight framing on the textarea (`scale: 1.95, x: 260, y: -90, duration: 1.3s, power3.inOut`), matching the user's screenshot.
  - **1-by-1 UI Construction**:
    - Voice selector pill rises: `y: 65, autoAlpha: 0 -> y: 0, autoAlpha: 1, duration: 0.85s, power3.out` at `6.3s`.
    - Main editor card shell rises: `y: 85, autoAlpha: 0 -> y: 0, autoAlpha: 1, duration: 1.0s, back.out(1.2)` at `6.4s`.
    - Settings panel slides in: `x: 80, autoAlpha: 0 -> x: 0, autoAlpha: 1, duration: 1.1s, power4.out` at `6.5s`.
    - Bora line 2 voice row rises beneath: `y: 55, autoAlpha: 0 -> y: 0, autoAlpha: 1, duration: 1.2s, power4.out` at `6.6s`.
  - **Typing & Real-Time Camera Follow Pan**:
    - Caret activates at `6.7s`.
    - Inline Khmer character typing begins at `6.85s` (duration 1.6s).
    - Camera pans smoothly rightward with the text: `timeline.to(camera, { x: 440, duration: 1.6s, ease: "sine.inOut" })`.
  - **Dramatic Re-Framing to Generate Button**:
    - Camera glides with high velocity contrast to the Generate button (`scale: 2.25, x: -640, y: -130, duration: 1.05s, ease: "expo.inOut"`).
    - Cursor sweeps directly over button (`duration: 0.55s, power2.out`).
    - Tactile click: `scale: 0.8, duration: 0.08s, yoyo`, button depression (`scale: 0.88`), glow pulse, and contact ripple.
  - **Close Response Framing & 1-by-1 Construction**:
    - Camera holds close to response (`scale: 1.5, x: 40, y: -50, duration: 0.9s, expo.inOut`).
    - Audio player card rises: `y: 90 -> 0, duration: 0.9s, power3.out`.
    - EQ waveform bars bloom: `scale: 0 -> 1, duration: 1.2s, back.out(1.5)`.
- **Act 3: Speech to Text Studio**:
  - Macro camera zoom (`scale: 1.7, x: 140, y: -40, duration: 1.6s, power3.inOut`).
  - 1-by-1 construction of Drop Card, Audio Chip, Export button, and Speaker Diarization streams.
  - Camera tracks down diarization timestamps in real-time.
  - Dramatic reframe to Export button (`scale: 2.15, x: -620, y: -160, duration: 1.1s, expo.inOut`).
  - Tactile click and subtitle export success badge spring pop.
- **Act 4: Voice Cloning & Developer REST API**:
  - Macro camera zoom onto Voice Cloning card (`scale: 1.85, x: 280, y: -60, duration: 1.3s, expo.inOut`).
  - 1-by-1 construction of Clone Card, 10s sample badge, circular progress ring, and verified check badge.
  - Lateral camera pan to REST API Card (`scale: 1.85, x: -300, y: -60, duration: 1.2s, expo.inOut`).
  - Live metric counter animates up to `3,250,000+`.
- **Act 5: Grand Optical Pullback & Resolve**:
  - Grand optical pullback (`scale: 1.0, x: 0, y: 0, duration: 2.3s, expo.out`).
  - 1-by-1 construction of emblem, headline, subtitle, and dual action pills with specular shimmer sweep.

---

### 3. Streamlined Apple Notes Preset (`src/compositions/presets/apple-notesapp/`)
- **Removed All Wireframe Device Mockups**:
  - Eliminated the wireframe iMac with stand, iPad, iPhone mockups, and squiggly orange sync lines.
- **Removed the Artificial Apple Pencil**:
  - Eliminated the awkward floating Apple Pencil assembly and isolated checklist card.
  - Replaced it with authentic macOS cursor interaction directly inside the real Apple Notes workspace.
- **Fixed Scene Overlaps & Text Collisions**:
  - The macOS Apple Notes workspace smoothly scales down and blurs out at 13.6s–14.2s.
  - Scene 4 ("Write once, available everywhere.") enters in pure, dead-center isolation with zero background bleed or window collisions.
- **Claude-Grade Kinetic Typography**:
  - Single full-sentence editorial lockups centered on the canvas.
  - Giant-to-Settle kinetic entry (`scale: 1.35 -> 1.0, power3.out`).
  - Slide-up highlight with spring overshoot bounce (`y: 65 -> 0, back.out(1.4)`) in rich Notes amber `#c25e00` for 7:1+ contrast on paper ground.
- **Scene 5 Grand Climax**:
  - Resolves cleanly into the official Apple Notes App Icon (180x180, 40px rounded corners, golden drop shadow).
  - Editorial statement: "Everything worth keeping, in one place."
  - Luminous "Open Notes" CTA pill button with generous 22px typography.

---

## Verification Results

1. **Full Vitest Test Suite (`npx vitest run`)**:
   - **18 / 18 test files passed (100%)**
   - **55 / 55 tests passed (100%)**
   - `tests/composition/kiritts.test.ts` passed (2/2 tests, deterministic seeking verified across all timestamps).
   - `tests/composition/apple-notesapp.test.ts` passed (2/2 tests, all 28 registered actors and scene seeks verified).
   - `tests/composition/claude.test.ts` passed (2/2 tests).

2. **TypeScript Compilation (`npx tsc --noEmit`)**:
   - **0 errors**. Passed cleanly.

3. **Production Vite Build (`npx vite build`)**:
   - Built successfully in 13.00s with **0 errors**.


---
name: write-motionly
description: Create, edit, retime, review, and repair Motionly code-first HTML/CSS compositions animated by GSAP. Use for startup ads, SaaS explainers, product films, story pacing, narration sync, kinetic typography, semantic backgrounds, shape morphs, match cuts, particle transitions, UI cinematography, assets, and preview/export parity.
---

# Write Motionly compositions

Build a directed product film, not decorated slides. Make every visual change explain, intensify, or resolve the current spoken thought.

## Preserve the runtime boundary

```text
composition-name/
|- composition.html   # semantic HTML/SVG and scoped CSS
|- timeline.js        # GSAP choreography
`- index.ts           # metadata and mounting adapter only
```

- Treat HTML/CSS as the visual source of truth.
- Write motion into the caller-owned GSAP timeline. A nested timeline is acceptable for proportional retiming, but add it to the caller timeline.
- Keep `index.ts` thin: metadata, asset substitution, HTML mounting, and one builder call.
- Never introduce `.motion`, a JSON animation DSL, generated DOM in TypeScript, a conversion layer, or a second renderer.
- Keep stable `data-edit` ids and register editable elements.
- Use `src/composition/presets.ts`; extend it only for reusable behavior.

## Direct the story first

Use a clear change in belief:

1. Hook: state the audience's desired outcome.
2. Friction: make the obstacle recognizable.
3. Consequence: visualize the cost, failure, or wasted effort.
4. Turn: introduce the product as the answer.
5. Proof: show the real interaction or product surface.
6. Resolution: reduce the product to one memorable promise and CTA.

Give every beat one spoken thought, one focal subject, one primary action, and one transition destination. Do not add visuals merely because the frame feels empty. Read [story-timing.md](references/story-timing.md) and [silicon-valley-motion.md](references/silicon-valley-motion.md) (Zelios & ElevenLabs 6 Laws) when scripting, retiming, or animating.

## Use continuous transition ownership

Every boundary must use one of these mechanisms:

- **Morph:** keep one carrier visible while its geometry, surface, and role change.
- **Match-cut:** align position, dimensions, silhouette, and motion before swapping internal content.
- **Particle-reassemble:** emit fragments from a visible source and direct them toward a meaningful destination.

Opacity may clean up internal faces after continuity is established; it must not be the transition itself. Prefer one persistent carrier across related beats, such as statement frame -> symbolic object -> prompt surface -> product window -> brand token. Read [transitions-camera.md](references/transitions-camera.md) before designing handoffs or camera paths.

## Compose editorial typography

- Express each beat as one bold, full-sentence thought.
- Never split one thought into a giant title plus a small gray subtitle.
- Center the thought as a unit; use `xPercent: -50` and `yPercent: -50` for absolute centering.
- Enter important thoughts giant and cropped, then settle into readable focus.
- Animate words or characters in reading order with restrained stagger and spring overshoot.
- Keep punctuation attached and preserve natural spaces.
- Apply sentence-wide gradients in shared coordinates. Do not restart the gradient on every word.
- Reserve gradients for emphasis and retain enough solid ink for immediate readability.
- Give the completed sentence a real reading hold before its exit.

Read [typography-backgrounds.md](references/typography-backgrounds.md) for split-text handling, hierarchy, background direction, and stability.

## Direct the background as a story actor

Choose one background system from the subject rather than layering generic atmosphere. Give it a beginning, a causal transformation, and a destination. Keep it subordinate to the focal subject, but make its state changes legible at video scale.

- Notes/writing: paper structure, page planes, ruled rhythm, or a product-derived mark. Do not add a decorative path, dot, orbit, or squiggle unless it originates from a real UI object and docks into the next product state.
- Audio: localized waveform energy emitted by the active source.
- Analysis: scan field or measurement grid that advances with the proof.
- Data: one trajectory, threshold, or scale system that actually encodes the claim.
- Developer work: code planes or rails with real spatial depth.
- Let the hook's background mark become the product's waveform, scan, connector, or final logo geometry instead of discarding it.
- Attach light to causality: a press, recording pulse, scan head, successful state, or morph seam. Let it dissipate or become the next object.
- Use full-canvas color only as an authored state change or brand resolve.
- Avoid default auroras, mesh gradients, blurry blobs, orbit decoration, muddy veils, and motion with no narrative relationship.

## Choreograph readable motion

- Separate arrival, settle, readable hold, and departure.
- Overlap transitions, but do not overlap competing messages.
- Alternate energy: fast setup, readable settle, emphasized consequence, spacious proof.
- Use `back.out(...)` for tactile text and controls; use `power3.inOut`, `power4.inOut`, or `expo.inOut` for camera and geometry.
- During holds, keep progressing through a bounded story action: finish an ink path, scan, waveform phrase, evidence assembly, or subtle camera settle drift. Do not add idle drift merely to keep pixels moving.
- Animate counters in fixed-width containers to prevent layout wobble.
- Do not reveal a cursor until typing begins.
- Preserve close prompt framing through its workspace morph unless the story motivates a pullback.
- After showing UI, hold it for inspection, then use one deliberate camera move instead of repeated zooming.

## Show real product behavior

- Use authentic screenshots, supplied assets, or faithful product HTML/CSS.
- Make the reveal causal: prompt -> action -> workspace.
- Keep prompt controls credible and proportioned like a real composer.
- Use a shared shell so the prompt physically becomes the product window.
- Make the active task legible; decorative dashboards are not proof.
- Collapse the product surface into the brand token or CTA with the same carrier.

## Reference-grade calibration (Claude, KiriTTS, and Apple Notes)

Every composition—whether a UI walkthrough, product ad, or conceptual motion graphic—must adhere to these reference-grade standards:

1. **Destination-led Camera Storytelling, Macro Focus & Typing Follow**:
   - Camera motion is a scene-level storyteller. Every move needs a named target and a reason; a settled reading hold does not need decorative drift.
   - **Macro Zoom Focus**: Keep a complete product surface at `scale: 1.0 - 1.12`. For `scale: 1.35 - 2.2`, animate a dedicated local focus rig or cropped semantic region so the active control and resulting state remain legible. Never push the full app outside its carrier.
   - **Real-Time Typing Follow Pan**: During character-by-character typing, the camera must smoothly pan horizontally following the advance of the text:
     ```javascript
     // Typing begins with inline typing
     typeText(typedInput, "How many calories are in this ramen meal?", 3.3, 1.25);
     // Camera smoothly pans rightward following the typed text
     timeline.to(camera, { x: 320, duration: 1.25, ease: "sine.inOut" }, 3.3);
     ```
   - **Dramatic Re-Framing to Action Targets**: Glide rapidly from text input to action buttons with dramatic velocity contrast (`expo.inOut`, `power3.inOut`, duration 0.9s–1.2s):
     ```javascript
     timeline.to(camera, { scale: 2.3, x: -960, duration: 1.0, ease: "expo.inOut" }, 4.3);
     ```
   - **Hold Close Focus on Responses Before Pullback**: After triggering an action, hold the local focus rig close to the newly constructed response (`scale: 1.35 - 1.6`) for inspection before a motivated pullback reveals context.

2. **Architectural UI Construction (Never Monolithic Simultaneous Fade-Ins)**:
   - Reveal the few elements that establish hierarchy in reading order. Do not animate every divider, label, and icon independently.
   - Group related interface regions, then construct those regions progressively with modest offsets (`y: 18 - 64px`), staggered delays (`+0.06s` to `+0.16s`), and role-appropriate non-linear eases:
     ```javascript
     // 1. Text header rises smoothly
     timeline.fromTo(header, { y: 90, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out" }, 6.0);
     // 2. Main card rises with physical settle
     timeline.fromTo(mainCard, { y: 100, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.0, ease: "back.out(1.2)" }, 6.1);
     // 3. Highlight / spark blooms from center
     timeline.fromTo(spark, { scale: 0.82, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.7, ease: "back.out(1.5)" }, 6.3);
     // 4. Detail lines slide up progressively
     timeline.fromTo(details, { autoAlpha: 1, y: 95 }, { autoAlpha: 1, y: 0, duration: 1.3, ease: "power4.out" }, 6.3);
     // 5. Secondary controls/chat bar appear beneath
     timeline.fromTo(bottomBar, { autoAlpha: 1, y: 45 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: "power4.out" }, 6.4);
     ```

3. **Duration-Aware Easing**:
   - Always calibrate duration to the physics of the chosen easing curve:
     - **`inOut` / `expo.inOut`**: Requires generous duration (0.9s to 1.4s) for smooth acceleration and slow-motion deceleration. Using `inOut` with short durations (< 0.5s) produces unnatural, jarring motion.
     - **Tactile Snappy Clicks & Carets**: Use short durations (0.08s to 0.25s) with `power2.out`, `power2.inOut`, or `back.out(2)`:
       ```javascript
       timeline.to(cursor, { scale: 0.82, duration: 0.08, yoyo: true, repeat: 1, ease: "power2.inOut" }, 5.45);
       timeline.to(btn, { scale: 0.85, duration: 0.09, yoyo: true, repeat: 1, ease: "power2.inOut" }, 5.5);
       ```
     - **Physical Card Entrances**: Use 0.9s–1.4s with `back.out(1.2 - 1.5)` or `power4.out` to convey weight and momentum.

4. **Introduce & Explain First (Marketing SaaS Flow)**:
   - When presenting a product feature or capability, introduce and explain the problem or concept first using kinetic typography and shape morphing.
   - Then construct the authentic product UI surface as the causal proof.
   - Camera pushes macro-close into the live interaction, tracks the action, and pulls back into a resolved brand climax.

5. **Source-Specific Full-Bleed Application Surface (Never Tiny Cards in a Void)**:
   - NEVER place a small title + subtitle + tiny cards floating in a massive empty black void.
   - Build a real, immersive application surface from the requested product's own information architecture and visual grammar. Use only the navbar, sidebar, tabs, workspace, and controls that product truthfully needs; do not clone Claude's chrome into every film.

6. **Continuous Shape Morph & Carrier Transformation (Zero Fades)**:
   - Scene transitions MUST use physical carrier transformations: a prompt shell expands into the studio window, an audio waveform's outline physically morphs into a transcription drop zone, or a track-matte wipe/laser beam slices across the frame.
   - The outgoing element's geometry and silhouette continuously transform into the incoming element's boundary.

7. **Strict Layer Segregation (Zero GPU Z-Fighting / Bleed-Through)**:
   - Every scene container and overlay must initialize with `display: "none"` and `autoAlpha: 0` at `t = 0` (except the opening scene).
   - The instant an outgoing scene finishes, set `display: "none"` and `autoAlpha: 0`. This completely eliminates Chromium GPU compositing artifacts, text jitter, and 3D z-fighting.

8. **Deterministic Stepped Typewriting (0px Caret Gap)**:
   - Use character slicing on an inline span with `steps(N)` on a tweened counter. Place an inline-block caret immediately adjacent with `vertical-align: -2px` to `-3px` matching font line-height.
   - The caret reflows naturally with zero empty pixel gap.
   - Never show a blinking cursor before typing begins.

Before implementation, write a one-line story spine and a boundary inventory naming the carrier and MORPH, MATCH-CUT, or PARTICLE-REASSEMBLE technique at every seam. Before delivery, score story spine, composition/readability, transition continuity, camera intent, and deterministic execution from 1-5. Repair every axis below 4 and inspect browser frames at the hook, each seam, each interaction, and the final hold.

Read [assets-export.md](references/assets-export.md) when importing media, using filters, or preparing export.

## Build deterministically

1. Set all hidden, transformed, and layered initial states at time `0`.
2. Use explicit timeline positions for story beats.
3. Keep scene and track metadata truthful to the timeline.
4. Base timing on seconds. Changing fps adds samples; it must not alter speed.
5. For global retiming, change a nested timeline's `timeScale` and scale metadata by the inverse factor.
6. Seek representative frames and inspect continuous playback in a real browser.
7. Verify preview/export parity, asset loading, text bounds, end-state cleanup, codec, and fps.

## Reject these failures

- title + subtitle + tiny card floating in a black void;
- fade, cross-dissolve, or fade-to-black as a scene handoff;
- static camera with no movement or zoom during feature explanations;
- overlapping, reflowing, or clipped split words;
- a separate repeated gradient on every word;
- background motion that competes or has no meaning;
- cursor blinking before typing;
- product screenshot appearing without a causal bridge;
- camera push, reset, then another unmotivated push;
- filter, hidden screenshot, or backdrop blur surviving into the logo;
- foreground beats too brief to read;
- storyboard timing that differs from GSAP;
- cross-origin or tainted export sources.

## Reusable helper guidance

- `morph`: persistent geometry and surface transformation.
- `cameraZoomPan`, `cameraPush`, `cameraPull`: motivated reframing.
- `wordSlideRotate`, `charSpringBounce`, `textReveal`: reading-order typography.
- `giantKineticCrop`: high-emphasis giant-to-settle entrance.
- `waterfallTextReveal`: HyperFrames-style binary word cascade plus one wrapper-level camera settle.
- `continuousTextGradient`: one gradient across split words.
- `gradientSweep`: temporary keyword emphasis.
- `ambientWaves`: low-frequency background life.

Use helpers as verbs, not a fixed style. Vary intensity, direction, duration, and visual language for the audience. Never copy a preset's exact colors, dimensions, copy, timestamps, or scene count.

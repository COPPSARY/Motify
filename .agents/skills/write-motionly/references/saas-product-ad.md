# Premium SaaS product ads

The reference presets (Claude, KiriTTS, Apple Notes) set the **quality** floor: carrier-led construction, a camera with destinations, one filmed interaction, readable holds. They are not skins. Every film rebuilds its identity from the product being advertised.

## 1. Adapt the identity to the product

Decide these five before writing markup, and derive all of them from the product's own domain:

| Decision | Question it answers |
| --- | --- |
| Surface | Which information architecture does this product actually have? |
| Palette | Light or dark, one ground, one surface, one accent with a job, one ink |
| Type | What reading scale does its content need? Tabular figures where numbers matter |
| Interaction | Which single real task does the camera film? |
| Proof | What visibly changed because of that task? |

Category defaults (mirrors `src/ai/product-profile.ts`):

- **AI assistant** — composer-led thread, one dominant composer, accent on send. Never three chat bubbles in a void.
- **Notes / writing** — paper ground, ink type, ruled rhythm; capture becomes structured content.
- **Audio / voice** — studio transport, real waveform with timecode; energy only where audio is active.
- **Analytics** — one dominant chart with axes, units, and period; one accent series.
- **Developer tool** — committed editor theme, real code, run/diff/pass as the accent state.
- **Design tool** — neutral chrome, one real artboard, inspector values that move with the drag.
- **Commerce** — product media dominates, honest price, purchase reaches a confirmed state.
- **Collaboration** — pipeline or thread with real names, statuses, timestamps.
- **Health** — one dominant vital with unit and goal.
- **Security / infra** — dark ops ground, accent strictly for alert and healthy states.
- **Learning** — lesson content at reading scale, progress that is earned on screen.

If the request names a brand, use that brand's language. If it does not, invent a coherent one and stay inside it.

## 2. Construct, then deconstruct

Construction order, one region at a time:

```text
frame/chrome -> navigation -> working surface -> the record under work -> the active control -> the result
```

- Offsets 18–64px, starts staggered +0.06s to +0.16s, durations 0.7–1.4s.
- `power3.out` / `power4.out` for structure, `back.out(1.2–1.5)` for tactile arrivals.
- Group related regions. Do not animate every divider, label, and icon on its own.
- A single `autoAlpha` tween that brings the whole layout in at once is a failure.

Deconstruction is the same discipline in reverse: internals leave in reverse hierarchy along motivated vectors (negative stagger works well) while the carrier keeps its silhouette into the next role. A surface never simply disappears.

## 3. Camera grammar

Four moves, each motivated:

1. **Intentional push** — `expo.inOut` / `power4.inOut`, 0.9–1.4s, toward a named target, then settle.
2. **Typing-follow pan** — while text types, pan with the advancing caret using `sine.inOut` across the exact typing duration.
   ```javascript
   typeText(typedInput, "Draft the launch plan", 6.2, 2.05);
   timeline.to(world, { x: -2050, y: -28, duration: 2.05, ease: "sine.inOut" }, 6.2);
   ```
3. **Macro interaction shot** — frame the control and its result at scale 1.35–2.2 via the camera world or a dedicated local focus rig. Keep the complete shell at 1.0–1.12 so it is never cropped inside its own carrier.
   ```javascript
   // Frame the composer: translate = viewportCenter - worldPoint * scale
   timeline.to(world, { x: -3367, y: -595, scale: 1.42, duration: 1.05, ease: "expo.inOut" }, 8.35);
   ```
4. **Readable hold** — 0.8–1.6s after every important transformation. Still is allowed after a physical settle; motion during a hold must complete a story action (typing, streaming, scanning, counting, drawing).

Close with a motivated pull back. Preserve axis, direction, and velocity through every seam.

## 4. Seams and timing

From `motion-doctrine`, which governs every boundary:

- **Vector law** — same axis, same direction, matched speed, cut mid-motion on both sides. On z, direction is the sign of the scale change; a receding exit answered by a grow-from-small entry is the most common violation.
- **The current** — one dominant direction for the film. Upward (elevation), z-forward (deeper into the same thought), and z-backward (arrival) are reserved and must mean something. No consecutive opposing seams without a visible cause.
- **Vocabulary budget** — repeat two or three seam types across the film. Choose each from the job using the `saas-motion-design` catalog.
- **Timing** — single entry ~0.8s, exit ~75% of entry, total stagger under 0.5s, similar elements sharing one ease/duration intent. `bounce.out` and `elastic.out` are banned; overshoot is `back.out(1.4–1.7)`.
- **Stillness before climax** — 0.3–0.75s between the major action and its result.
- **Sustained motion** — every phase between entry and exit belongs to a named route: staged reveals, camera with intent, sequenced UI life, an acted-out sequence, or cursor-led action. Idle wobble is not a route.

## 5. Keep the output editable

Generated films are edited afterwards in the Motionly inspector, so:

- Every meaningful element carries a stable, descriptive `data-edit` id (`prompt-shell`, `action-button`, `proof-value`), never `layer-3`.
- Add `data-edit-label`, and declare fields with `data-field`, `data-field-label`, `data-field-type`, `data-field-binding`.
- Position elements with their own CSS; animate with transform and opacity so an editor override composes with the timeline instead of fighting it.
- Reusing an existing id keeps the user's selection, transforms, and tween overrides. Renaming one throws them away.
- Tag each face or scene container with `data-scene="scene-0n"` so stale layers are detectable.

## 6. Automatic rejections

The generation validator (`src/ai/validate-generation.ts`) and the quality gate (`analyzeMotionQuality`) reject:

- **Slideshow** — scenes joined by opacity/display toggles with no morph, match-cut, or particle handoff; a scene whose DOM never changes.
- **Broken timelines** — no `buildTimeline`, no finite duration, a timeline longer than the composition, or one that stops before 70% of it and leaves the rest frozen.
- **Missing assets** — a supplied `motionly-asset://` token absent from the HTML, or present but never rendered as a visible source.
- **Overlapping text** — two settled text leaves overlapping more than 60% of the smaller one (72% for identical text).
- **Stale layers** — an element tagged for another scene still visible during this one.
- **Blank frames** — a sampled moment with no visible foreground or under 3% canvas coverage.
- **Fade-only motion** — nothing that moves, scales, or rotates, or transform properties outnumbered two-to-one by opacity tweens.
- **Slop** — tiny cards floating with no product surface, placeholder/AI-dashboard copy, simultaneous fade-ins, positional `data-edit` ids, leaked reference branding.

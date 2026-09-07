---
name: reference-grade-product-film
description: Direct and author premium short product films in Motionly or HyperFrames using carrier-first morphs, aggressive scale contrast, causal product proof, restrained Apple-like physicality, and semantic backgrounds. Use for launch ads, app promos, AI product films, or when generated motion feels static, generic, gradient-heavy, or disconnected.
---

# Reference-grade product film

Create a coherent motion system, not a collage of fashionable effects. Borrow transferable mechanics from strong product advertising without copying another brand's exact assets, copy, or identity.

## The quality bar

A strong short film normally has:

- one dominant carrier that survives multiple beats;
- a large scale range, from cropped macro detail to a clean readable settle;
- product behavior that causes the next visual state;
- one accent color with a clear job;
- a background system that changes because of foreground events;
- only two or three transition vocabularies across the film;
- a clean resolved final frame.

Minimal frames are allowed. Static story logic is not.

## Build the carrier chain first

Before styling scenes, write the carrier chain in one line:

```text
editorial mark -> prompt/capture capsule -> working product surface -> compact app or brand mark
```

Adapt the chain to the product. The outgoing carrier and incoming carrier must share a center, silhouette, edge, path, or velocity at every boundary.

- Use **MORPH** when the same object's geometry changes continuously.
- Use **MATCH-CUT** when two identities can share the same silhouette for one frame.
- Use **PARTICLE-REASSEMBLE** only when fragments visibly leave one source and form one destination.

Opacity may swap internal faces after the carrier is matched. It is not the transition.

## Direct scale and pacing

- Open inside the idea: giant cropped text, a macro icon detail, or a close product state.
- Settle rapidly enough to restore orientation, then hold long enough to read.
- Use one decisive camera push to inspect proof and one pull to reveal context or conclude.
- Preserve velocity through a seam. Do not finish a move, reset, and start an unrelated move.
- Reserve bounce for tactile presses, toggles, and momentum. Macro geometry should usually be critically damped or use a long-tail `power4`/`expo` settle.
- Add a short stillness or near-stillness before the climax, then spend the final energy on the resolve.

## Make product proof causal

Show a real task, not a dashboard-shaped placeholder.

```text
input -> system response -> visible transformation -> useful result
```

Typing reveals text while the caret is present. Recording creates waveform activity and transcript evidence. A scan advances through the object it analyzes. A click compresses the target and ignites the result on the same frame. Keep the UI on screen long enough to inspect the result.

Use supplied screenshots or faithful semantic HTML. Keep chrome believable, copy meaningful, and small labels subordinate. Screenshots used as evidence belong in a dedicated gallery plane beside the live product—not as stickers covering its controls.

Keep the readable UI fit-safe. A camera push may crop expendable margins, but never the product title, primary navigation, active control, or the object being discussed. Prefer moving a fitted shell through space over magnifying its internal DOM inside an `overflow: hidden` carrier. Brief carrier-level `rotationX`/`rotationY` is useful during morphs and gallery reveals; return close to frontal for reading.

## Background director

Select one system from the subject:

| Subject           | Background system                | Destination                        |
| ----------------- | -------------------------------- | ---------------------------------- |
| Notes or writing  | ruled paper or layered page planes | waveform, connector, or note glyph |
| Voice or audio    | localized signal field           | transcript or generated result     |
| Analysis          | scan field + measurement marks   | classified or resolved state       |
| Data              | grid + one encoded trajectory    | proof number or final claim        |
| Developer product | code planes + depth rail         | working editor or terminal         |

Use at most three roles: tinted base, structural texture, local semantic accent. Mark authored decorative layers with `data-background-role` so their narrative job is explicit.

Reject decorative lines, dots, orbiters, and squiggles that do not originate from a foreground object and dock into a later product state. “It moves” is not a semantic role.

Avoid always-on auroras, mesh gradients, blurry blob stacks, random particles, and orbit rings with nothing to connect. A glow must have a source. Full-canvas color is for a real state change or brand resolve.

During a reading hold, finish a bounded action—path, scan, waveform phrase, evidence assembly, or camera settle—instead of looping idle drift.

## Typography

- One complete editorial thought per beat.
- Important statements enter at `scale >= 2` and settle as one centered unit.
- Reveal continuously word by word in reading order; use restrained `back.out(1.35)` unless the tone needs a critically damped settle.
- Keep settled type title-safe. Cropping belongs to the entrance, not the reading state.
- Emphasize one phrase with ink, weight, underline, or a sentence-wide gradient. Do not create headline + tiny subtitle hierarchy for one thought.

## Motionly implementation

Read `write-motionly` for the runtime contract. Keep `composition.html` as the visual source, write all motion to the caller-owned GSAP timeline in `timeline.js`, and keep `index.ts` thin.

Useful HyperFrames mechanics to retrieve and adapt by role include `modal-morph`, `morph-swap`, `icon-morph-beat`, `typed-prompt`, `notes-typing`, `ui-focus-zoom`, `offset-path-traveler`, and `beat-pulse-background`. Registry names are references, not callable Motionly functions.

Prefer real Motionly primitives such as `waterfallTextReveal`, `giantKineticCrop` with `unit: "words"`, `wordSlideRotate`, `morph`, `matchCut`, `motionArc`, `cameraPush`, and `cameraPull`. Use waterfall text when the words themselves need visible travel and a wrapper-level camera settle; use giant crop for a simpler editorial pullback. Set all initial states at timeline time zero and keep scene metadata truthful.

## Reject before delivery

- disconnected cards that merely fade in;
- a product screenshot appearing without an input or carrier handoff;
- repeated center zooms with no new information;
- generic purple/cyan gradient atmosphere;
- always-on breathing or `repeat: -1` wallpaper;
- early cursors, fake UI text, or unreadable proof;
- hard cuts, wipes, cross-dissolves, or fade-to-black boundaries;
- a final frame still carrying stale product layers.

Review representative frames plus continuous playback. If the film only looks good as a contact sheet, its motion system is not finished.

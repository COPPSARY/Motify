# GSAP motion helpers

Motify ships a small JavaScript/TypeScript motion surface:

- `reveal`
- `slide`
- `scalePop`
- `spring`
- `blurReveal`
- `maskWipe`
- `rotateReveal`
- `textReveal` for word or character choreography
- `staggerEntrance`
- `staggerExit`
- `cameraPush`
- `cameraPull`
- `sceneHandoff` for overlapping directional scene transitions
- `morph`

Every helper receives the caller's GSAP timeline and an optional `at` position. This makes overlaps and nested timing explicit.

```js
slide(timeline, panel, { direction: 'up', distance: 56, at: 0.2 });
textReveal(timeline, title, { unit: 'words', stagger: 0.05, at: 0.35 });
cameraPush(timeline, productWindow, { scale: 1.3, x: -220, at: 2.1 });
sceneHandoff(timeline, introScene, productScene, { direction: 'left', at: 3.6 });
```

Use `power4.out` for decisive arrivals, `power3.inOut` for camera/layout travel, and restrained `back.out` or spring motion for deliberately tactile elements. Build hierarchy through timing and distance rather than animating every object identically.

Each scene should have an arrival, an active transformation, and a resolve. Supporting labels, cards, diagrams, and metadata should reveal, react, or intentionally hold instead of appearing as unexplained static decoration. A subtle grid or light field can provide spatial reference for camera travel without becoming the subject.

Treat camera direction as `subject → destination → settle`: push toward a meaningful detail, pan only when focus changes, and leave enough time to read the result. Browser QA must confirm a visible target's computed transform or opacity changes while Play is active; a moving scrubber by itself is not a valid playback test.

Scene roots must not be hard-hidden and hard-shown at the same timestamp for ordinary product-film transitions. Begin the incoming scene during the outgoing scene's final 0.5–0.9 seconds, animate both roots through `sceneHandoff`, and give the outgoing scene an internal exit that hands energy into the next shot. Browser QA should inspect the midpoint of every handoff and confirm two scene roots are visible and transforming.

---
name: saas-motion-design
description: Complete SaaS and product marketing motion design skill — 50 transitions catalog (camera push/pull, card takeover, morph expansion, flip, shape wipe, UI zoom), continuity over cutting, motion hierarchy (primary, secondary, tertiary), mandatory scene planning, no dead time, and 1-thing-in-focus principle.
---

# MOTIONLY — SAAS MOTION DESIGN SKILL

You are a professional motion designer creating SaaS/product marketing animations.

Do not interpret a "transition" as a simple fade between two scenes.

A transition is a **visual transformation connecting two states**.

The viewer should feel that Scene B comes FROM Scene A.

Use HTML/SVG elements as physical visual objects and GSAP timelines as the choreography system.

---

# 01 — CORE TRANSITION RULE

NEVER default to:

Scene A → fade out → Scene B → fade in.

Prefer:

Scene A → element moves/transforms → camera follows → Scene B emerges.

A transition should usually be caused by something already visible.

Examples:

* Text becomes the next scene.
* A UI card expands into the next scene.
* A screenshot zooms into a feature.
* A panel slides across the viewport and reveals the next state.
* A floating card travels toward the camera and becomes full-screen.
* Multiple elements collapse into a new composition.
* A shape grows until it becomes a transition mask.
* The camera moves through an element into the next scene.

Think:

**CONTINUITY > CUTTING**

---

# 02 — TRANSITION LIBRARY

## 1. CAMERA PUSH

### What it is
The camera rapidly pushes toward an existing object until it fills the frame.

### Use when
Moving from a broad product overview into a specific feature.

### Implementation
Animate the scene/container scale upward while translating the focal element toward the viewport center.

GSAP: `scale: 1 → 3/6`
Combine with: `x`, `y`, `transformOrigin`, slight blur/opacity if appropriate.
Do not simply scale the entire scene randomly. Choose a visual target.

---

## 2. CAMERA PULL

### What it is
Start extremely close to an object and rapidly pull backward to reveal the larger composition.

### Use when
Introducing a product, dashboard, ecosystem, or multiple UI elements.

### Implementation
Start with a large scale and animate the camera/container toward normal scale.
Example: `scale: 4 → 1`
Reveal surrounding elements during the pull.

---

## 3. ZOOM THROUGH

### What it is
The camera zooms through an element rather than merely zooming toward it.
Example: Text: `BUILD FASTER` — The camera pushes through the word and emerges into the next scene.

### Use when
Moving between conceptual sections.

### Implementation
Place the target element above the next scene.
Scale the target aggressively while simultaneously revealing the next scene behind it.
Use `overflow:hidden` or SVG masking to control the viewport.

---

## 4. UI FEATURE ZOOM

### What it is
A complete dashboard is shown, then the camera zooms into one specific card/button/chart. That feature becomes the next scene.

### Use when
Explaining a product feature.

### Implementation
Calculate the target UI element's position.
Animate: `scale + x + y` so the target moves toward the center while everything else leaves the viewport.
The next scene should already exist underneath.

---

## 5. CARD TAKEOVER

### What it is
A floating card grows until it occupies the entire viewport. The card effectively becomes the next scene.

### Use when
Introducing a new feature, quote, metric, screenshot, or product state.

### Implementation
Animate: `width / height / scale / x / y / borderRadius` or use GSAP Flip when the same DOM element changes layout dramatically.

---

## 6. CARD PUSH

### What it is
A new card physically pushes the previous card out of the frame.

### Use when
Showing sequential features or multiple product capabilities.

### Implementation
Animate incoming card from the right/left while simultaneously moving the existing card away.
Avoid waiting for the first card to disappear. Overlap the timelines.

---

## 7. CARD STACK

### What it is
Multiple screenshots/cards stack on top of one another like physical cards. The top card becomes the next visual state.

### Use when
Showing multiple products, features, testimonials, or screens.

### Implementation
Animate cards with: `x`, `y`, `scale`, `rotation`, `z-index`.
Use staggered timing.

---

## 8. CARD UNSTACK

### What it is
A stack of cards explodes outward into a spatial composition.

### Use when
Revealing multiple features or capabilities.

### Implementation
Start cards at nearly identical coordinates.
Animate each card toward its final position with different rotations and timing. Use `stagger`.

---

## 9. FLIP TRANSITION

### What it is
An object changes its layout while visually appearing to remain continuous.
Example: Small dashboard card → full dashboard.

### Use when
The same product element exists in two different layouts.

### Implementation
Use GSAP Flip: `Flip.getState()` → Change DOM/layout → `Flip.from(state)`.

---

## 10. MORPH EXPANSION

### What it is
A small shape expands and transforms into a large visual surface.
Example: Circle → full-screen background.

### Use when
Changing visual chapters.

### Implementation
Animate SVG geometry, scale, or border-radius. For SVG, prefer animating the actual SVG geometry/path where possible.

---

## 11. SHAPE WIPE

### What it is
A circle, rectangle, rounded shape, or custom SVG shape expands across the viewport and temporarily covers the old scene.

### Use when
You need a clean but energetic scene change.

### Implementation
Create an absolutely positioned SVG mask/shape. Animate: `scale: 0 → large` or animate its path/clip geometry. Reveal Scene B underneath.

---

## 12. CIRCLE REVEAL

### What it is
A circular mask grows from a specific UI element.

### Use when
The transition should originate from a button, cursor, icon, or product element.

### Implementation
Use CSS `clip-path: circle()` or an SVG mask. Animate the radius from small to viewport-covering.

---

## 13. RECTANGLE REVEAL

### What it is
A rectangle expands from one edge or point to reveal the next scene.

### Use when
Creating clean SaaS/product transitions.

### Implementation
Use `clip-path: inset()` or SVG clipping. Animate: `inset(0 100% 0 0) → inset(0 0 0 0)`.

---

## 14. SLIDE REVEAL

### What it is
Scene B physically slides into the frame while Scene A moves away.

### Use when
Showing sequential screens or product steps.

### Implementation
Animate both scenes simultaneously. Scene A exits while Scene B enters.

---

## 15. PARALLAX REVEAL

### What it is
Multiple layers move at different speeds during a transition.

### Use when
Creating depth around screenshots/UI.

### Implementation
Separate background, UI, text, and decorative layers. Move them at different distances/speeds.

---

## 16. WHIP PAN

### What it is
The camera rapidly moves horizontally or vertically. The motion blur creates a feeling of speed.

### Use when
Changing topics or moving between energetic product sections.

### Implementation
Animate the entire composition rapidly off-screen. At the peak of movement, bring Scene B into position. Use aggressive easing.

---

## 17. WHIP REVEAL

### What it is
A whip pan ends on the next scene.

### Use when
The next scene should feel like the camera traveled there.

### Implementation
Move Scene A rapidly away. Move Scene B from the opposite direction.

---

## 18. OBJECT WIPE

### What it is
An existing object physically crosses the screen and temporarily blocks the camera. The next scene is revealed behind it.

### Use when
You want transitions to feel motivated.

### Implementation
Animate a UI card, text block, screenshot, or shape across the viewport. Change scenes while the object covers the frame.

---

## 19. TEXT WIPE

### What it is
Oversized typography sweeps across the screen and becomes the transition surface.

### Use when
Moving between messaging/story sections.

### Implementation
Use very large text positioned above both scenes. Animate `x / scale / opacity` while Scene B appears behind it.

---

## 20. TEXT TAKEOVER

### What it is
A word becomes so large that it completely dominates the frame.

### Use when
Emphasizing a major message.

### Implementation
Animate text scale aggressively. Use transform origin toward the focal point. Kinetic typography works best when movement reinforces meaning.

---

## 21. WORD MORPH

### What it is
One word visually transforms into another (e.g. MANUAL → AUTOMATED).

### Use when
Showing before/after or problem/solution.

### Implementation
Animate shared typography properties. Use character-level spans if necessary. Crossfade only as fallback. Prefer movement, scale, tracking, or positional transformation.

---

## 22. TEXT SPLIT

### What it is
A headline splits apart, revealing the next visual behind it.

### Use when
The message itself should create the transition.

### Implementation
Split text into individual words/characters. Move left/right or up/down. Scene B becomes visible through the opening.

---

## 23. TEXT COLLAPSE

### What it is
Several words collapse toward a single focal point.

### Use when
Transitioning from a broad message to one key idea.

### Implementation
Animate multiple text elements toward a shared coordinate. Scale down slightly as they converge. Then transform the resulting focal element into the next scene.

---

## 24. TEXT EXPLOSION

### What it is
A word breaks into multiple words/elements that spread outward.

### Use when
Introducing multiple features or concepts.

### Implementation
Start all words at the same position. Animate outward with staggered x/y/rotation.

---

## 25. SCREEN ROTATION

### What it is
A UI screenshot rotates slightly in perspective and becomes another screen.

### Use when
Showing multiple product screens.

### Implementation
Use CSS transforms or SVG transforms. Keep rotation subtle (e.g. `rotationY: -15 → 0`).

---

## 26. SCREEN SWAP

### What it is
One screenshot physically replaces another in the exact same spatial position.

### Use when
Demonstrating workflow steps.

### Implementation
Use identical positioning and animate between UI states.

---

## 27. BROWSER EXPAND

### What it is
A small browser/product window expands into a full-screen product experience.

### Use when
Introducing the actual SaaS product.

### Implementation
Animate `width`, `height`, `x`, `y`, `borderRadius`, `scale`.

---

## 28. BROWSER COLLAPSE

### What it is
A full product screen collapses into a floating browser/card.

### Use when
Returning from detailed product visualization to a higher-level story.

### Implementation
Reverse the Browser Expand concept. Scale and reposition the UI into its final card location.

---

## 29. CAMERA FOLLOW

### What it is
An object travels across the scene and the camera follows it.

### Use when
The transition needs to feel like movement through space.

### Implementation
Animate the object and inverse-transform the camera/container so the object remains near the focal area. The destination becomes Scene B.

---

## 30. ELEMENT TRAVEL

### What it is
An element physically travels from Scene A to its location in Scene B.

### Use when
You have a meaningful visual relationship between scenes.

### Implementation
Calculate start/end coordinates. Animate the same element between them. This is much stronger than deleting the first element and creating another.

---

## 31. ORBIT TRANSITION

### What it is
UI cards orbit around a central product element while the scene changes.

### Use when
Showing an ecosystem or multiple capabilities.

### Implementation
Use a shared SVG/HTML center point. Animate rotation around that origin.

---

## 32. SPIRAL REVEAL

### What it is
Elements rotate and move toward/out from a central point while revealing the next scene.

### Use when
The product has a playful/technical visual identity.

### Implementation
Combine `rotation + x + y + scale` with stagger.

---

## 33. DEPTH DIVE

### What it is
The camera moves through several layers of UI (e.g. Dashboard → card → button → detail screen).

### Use when
Explaining nested functionality.

### Implementation
Create multiple depth layers. Scale/translate each layer at different speeds. The next scene exists beyond the current visual layer.

---

## 34. DEPTH PULL

### What it is
The camera rapidly pulls backward through multiple layers.

### Use when
Ending a detailed feature explanation and returning to the broader product.

### Implementation
Reverse the depth hierarchy. Use scale and parallax.

---

## 35. MASKED UI REVEAL

### What it is
A screenshot is revealed through a custom shape/mask.

### Use when
Introducing polished product visuals.

### Implementation
Use SVG `<clipPath>` or `<mask>`. Animate mask geometry rather than simply fading.

---

## 36. LINE DRAW TRANSITION

### What it is
A line draws across the screen and becomes a divider, connector, or shape that reveals the next scene.

### Use when
The visual language uses diagrams, connections, workflows, or technical concepts.

### Implementation
Use SVG paths. Animate `stroke-dasharray` / `stroke-dashoffset`. At completion, transform or expand the line into the next visual.

---

## 37. CONNECTOR TRAVEL

### What it is
A dot travels along an SVG connector from one UI element to another. The destination becomes the next scene.

### Use when
Explaining workflows, automation, pipelines, integrations, or data flow.

### Implementation
Use SVG path motion / GSAP motion path techniques. The camera can follow the traveling object.

---

## 38. GRID TRANSFORM

### What it is
A grid of UI cards reorganizes into a completely different layout.

### Use when
Showing how the product organizes information.

### Implementation
Record first positions, change DOM/layout, use GSAP Flip. The same elements visibly travel into new positions.

---

## 39. GRID COLLAPSE

### What it is
Many UI elements collapse toward one focal point.

### Use when
Reducing complexity into one key feature.

### Implementation
Animate all cards toward a common coordinate. Scale down progressively. The focal element expands into Scene B.

---

## 40. GRID EXPANSION

### What it is
One visual expands into many cards/screens.

### Use when
Introducing multiple capabilities.

### Implementation
Start cards stacked/hidden. Expand them into their final grid positions with stagger.

---

## 41. MAGNETIC TRANSITION

### What it is
Multiple elements are pulled toward one central UI element as if attracted by a magnetic force.

### Use when
Showing consolidation, automation, or bringing scattered information together.

### Implementation
Animate each element toward a common focal point. Use different durations and easing. Avoid perfectly synchronized movement.

---

## 42. EXPLOSIVE TRANSITION

### What it is
A central element rapidly expands and surrounding elements shoot outward.

### Use when
Creating a high-energy section change.

### Implementation
Combine scale expansion of focal object with staggered outward movement.

---

## 43. SNAP TRANSITION

### What it is
Elements move quickly into a new layout with a strong mechanical snap.

### Use when
The product has a technical/productivity aesthetic.

### Implementation
Use short GSAP durations and strong easing: `move → overshoot → settle`.

---

## 44. MAGNETIC SNAP

### What it is
Elements travel toward their destination and snap precisely into place.

### Use when
Showing organization, workflow automation, or UI reconfiguration.

### Implementation
Animate elements toward final coordinates with slight overshoot, then settle rapidly.

---

## 45. MATCH-MOVE TRANSITION

### What it is
An element appears in Scene A and continues moving in exactly the same direction in Scene B.

### Use when
You need extremely smooth scene continuity.

### Implementation
Maintain the same element or calculate matching coordinates between scenes. Do not reset position at scene boundary.

---

## 46. MATCH-SCALE TRANSITION

### What it is
An element maintains its apparent size while the scene changes around it.

### Use when
Maintaining brand/product continuity.

### Implementation
Match position and scale across scenes. Use GSAP Flip when DOM structures differ.

---

## 47. ROTATIONAL WIPE

### What it is
A large circular/rectangular element rotates while covering the frame and revealing Scene B.

### Use when
An energetic transition is needed.

### Implementation
Use an oversized SVG shape. Animate rotation and scale simultaneously.

---

## 48. PORTAL TRANSITION

### What it is
A circular/rounded opening appears inside a UI element and camera travels through it into another scene.

### Use when
Creating a cinematic product-film feeling.

### Implementation
Use SVG mask/clipPath. Animate opening from small radius to viewport size. Place Scene B underneath.

---

## 49. SCROLL THROUGH

### What it is
The camera appears to scroll through a long product interface.

### Use when
Showing multiple sections of a website/product.

### Implementation
Animate product container vertically while keeping camera fixed. Combine with subtle parallax.

---

## 50. CONTINUOUS OBJECT TRANSFORM

### What it is
An object changes identity while moving (e.g. UI card → screenshot → full-screen dashboard → feature detail).

### Use when
Creating premium, cinematic SaaS product films.

### Implementation
Do not destroy/recreate visual if continuity can be preserved. Animate its: `position`, `scale`, `dimensions`, `border radius`, `content`, `opacity`, `rotation`, `clip path`, `children`.

---

# 03 — HOW TO CHOOSE A TRANSITION

* **SAME OBJECT, NEW LAYOUT**: FLIP, MATCH-MOVE, MATCH-SCALE, CARD TAKEOVER, GRID TRANSFORM
* **ZOOMING INTO A FEATURE**: CAMERA PUSH, ZOOM THROUGH, UI FEATURE ZOOM, DEPTH DIVE, PORTAL
* **MOVING TO A NEW SECTION**: WHIP PAN, SLIDE REVEAL, SHAPE WIPE, OBJECT WIPE, TEXT WIPE
* **SHOWING MULTIPLE FEATURES**: CARD STACK, CARD UNSTACK, GRID EXPANSION, ORBIT, EXPLOSION
* **PROBLEM → SOLUTION**: WORD MORPH, TEXT TAKEOVER, TEXT SPLIT, MAGNETIC TRANSITION, MATCH-MOVE
* **WORKFLOW / AUTOMATION**: CONNECTOR TRAVEL, CAMERA FOLLOW, ELEMENT TRAVEL, GRID TRANSFORM, MAGNETIC SNAP

---

# 04 — TRANSITION CHOREOGRAPHY

A transition should usually contain multiple simultaneous actions.
A transition should feel like **ONE continuous physical event**.

---

# 05 — GSAP IMPLEMENTATION RULES

Use GSAP timelines for choreography.
Use overlapping timing with position parameter (`<`, `<0.1`).
Use `stagger` for groups.
Use `Flip` when layout changes.
Use CSS transforms for HTML elements; SVG transforms, paths, masks, and clipPaths for vector transitions.

---

# 06 — HTML/SVG ARCHITECTURE

Structure scenes as layers:
```text
Scene
├── Background
├── Decorative layer
├── Camera layer
│   ├── UI
│   ├── Screenshots
│   ├── Typography
│   └── Foreground elements
└── Transition layer
```

---

# 07 — NEVER DO THESE BY DEFAULT

* Generic fade between every scene
* Identical slide-left transitions
* Static screenshots sitting in the center
* Text appearing and disappearing without purpose
* One animation finishing before the next starts
* 2–3 seconds of visual inactivity
* Random rotations or random bouncing
* Excessive particle effects
* Transitions unrelated to the story
* Rebuilding an element when the existing element could transform into the next state

---

# 08 — MOTION DENSITY & HIERARCHY

A SaaS promo should feel alive. During most moments, at least one meaningful visual operation should be occurring.
Create hierarchy:
* **PRIMARY**: Strongest movement (camera push, UI transformation, card takeover) — **EXACTLY 1 PRIMARY THING IN FOCUS AT A TIME!**
* **SECONDARY**: Supporting movement (cards sliding, icons moving, notifications appearing)
* **TERTIARY**: Subtle ambient movement (tiny floating details, gentle scale/opacity)
Never make elements compete or block each other.

---

# 09 — MANDATORY SCENE PLANNING

Before writing ANY animation code:
1. Break the animation into purposeful scenes with defined duration, message, focal element, and transitions in/out.
2. Plan transitions before coding.
3. Plan visual continuity: "What from the current scene can become something in the next scene?"
4. Plan motion hierarchy: 1 thing in focus; background and secondary elements never block the hero.
5. Plan time continuously with overlapping timelines.
6. Scene duration must have a purpose.
7. Think in shots, not slides.
8. Plan before implementation.
9. Use existing motion skills and presets.
10. Final pre-code check.

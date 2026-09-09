---
name: write-motionly
description: Create, edit, retime, review, and repair Motionly HTML/CSS and GSAP product films, SaaS ads, kinetic typography, physical transitions, UI cinematography, and deterministic preview/export compositions.
---

# Write Motionly compositions

You are filming **what a product does to the world**, not what its interface looks like.

The most common failure is treating "product video" as "pretty dashboard": a gradient, an app shell, a button press, some cards, a zoom out. That film communicates nothing, because the viewer only learns the product has a screen — which they already assumed. Build the concept first. An interface is one possible vocabulary for showing a concept, and usually not the right one.

The runtime law supplied before this skill governs execution and wins any conflict.

## SaaS advertising direction

The target is an authored SaaS ad with varied shots. Product UI is useful evidence when it shows a concrete action and its result. A full application window sitting on screen while its copy changes is not an ad structure.

For a general SaaS ad, build a shot progression from the request: editorial hook -> product material or problem -> mechanism close-up -> visible result -> brand. Adapt the number and order to the story; do not reuse this as a fixed template. Two adjacent beats must differ in framing and in what visibly happens. Alternate wide, medium, and detail views with a reason for each move.

- The ground is a lit space, never flat `#ffffff`: warm off-white with a blurred brand-hue bloom behind the subject, warm neutral grey, near-black with one warm source, or a full-bleed brand colour. Use the supplied product identity or explicit user palette when present. Dark is a deliberate contrast beat, not a synonym for premium.
- Make the subject large enough to read. An isolated icon or control may occupy 25-45% of frame height; a proof artifact may occupy 55-80% of frame width. Compose around the focal subject rather than padding every shot with cards.
- One bold, full-size editorial sentence per thought, centred, 96-150px/700 at 1920x1080 (150-220px for a two- or three-word statement), tracking -0.03em to -0.055em, spanning 45-85% of frame width. Enter cropped at scale 2.0+ and settle word-by-word with back.out(1.35). Colour exactly one word in the brand hue. Never add a smaller explanatory subtitle beneath it.
- A useful UI close-up may span an input and its result. Show the active detail, then leave it. Do not repeat sidebars, top bars, empty panels, generic response lists, and invented KPI tiles across scenes.
- Show actual proof: the edited word, organized tasks, built scene, completed document or generated image. Never invent 98% success, 12ms latency, or 10x ROI as decoration. Use supplied images when available; otherwise use honest authored HTML/SVG material rather than fake image placeholders or invented asset URLs.
- During a reading hold, let a meaningful secondary action or bounded camera movement continue. Tiny global drift cannot substitute for the scene's primary action. Shorten a beat whose work is already complete.
- End on a prominent mark and a short promise on open or full-bleed brand ground. Do not put the ending inside a small rounded pill.

Borrow the reference shot design while obeying Motionly's MORPH, MATCH-CUT and PARTICLE-REASSEMBLE boundary rules. Recreate any reference edit that would break continuity with a real shared carrier.

## Step 1 — Write the transformation chain

Before choosing a single visual, write the chain: four to six states, from what the world looks like before the product to what it looks like after. This is the film. Each state is a beat.

The form is always **input state -> the product's actual mechanism -> output state**.

```
AI security scanner
  website -> SCANNER -> code streams through -> threats detected
          -> red nodes isolate -> clean secure state

Collaborative writing tool
  messy ideas -> several people contribute -> ideas converge
              -> document crystallises -> finished piece

Delivery optimisation
  orders -> many tangled routes -> routes reorganise
         -> optimal paths emerge -> deliveries complete

Motion-graphics generator
  a sentence -> words break into parts -> parts take on motion
             -> the sentence is now a moving scene
```

Compare the first one with the dashboard version it replaces: gradient -> dashboard -> scan button -> vulnerability cards -> zoom out. Nothing in that sequence is the product's mechanism. It is furniture.

Rules for the chain:

- Every state must be **visually different from the one before it**, not the same screen with different copy.
- The middle states are the product's mechanism. If you cannot name a mechanism, the film has no content yet — go back and find what actually changes.
- Record each state in `direction` so the chain is inspectable.

## Step 2 — Choose the vocabulary

The user message carries a `FILM SHAPE` brief with a premise and a guard chosen for this request, and the retrieved mechanics are selected to match it. **Follow it.** The five shapes:

| Shape | The subject is | Interface? |
| --- | --- | --- |
| **transformation** (default) | material changing state: scattered to ordered, noise to signal, many to one | focused input/result evidence when useful |
| **hero-object** | one artefact: a mark, a device, a symbol | no |
| **editorial** | the words themselves; type and colour carry the argument | no |
| **data** | real numbers, with units and periods | only as the surface holding them |
| **task** | the interface itself, genuinely used | yes — this is the one |

**The interface test.** Build a product UI only when *both* are true: the request asks to see the product used (a walkthrough, a tour, "show the app", "demo the interface"), **and** the interface is the thing the viewer must judge. An AI assistant whose entire product *is* the conversation surface passes. A security scanner, a logistics optimiser, a writing tool, an infrastructure product almost never do — their concept lives outside the screen.

When in doubt you are making a **transformation** film. The chain is the spine; focused product details may provide evidence, never become a repeated shell. Naming an AI assistant, analytics product, or a closing logo does not by itself request a walkthrough, a chart film, or a logo sting.

## Step 3 — Make each state physical

A state is not a caption. It is something on screen with mass, position, and behaviour.

| State in the chain | How to stage it |
| --- | --- |
| Chaos, overload, mess | Many real objects crowding the frame, overlapping at depth, drifting inward. Not a caption saying "it is messy". |
| A process running | Material physically travelling through a gate, beam, or aperture — streams of code, orders, words — with the gate reacting as it passes. |
| Detection, selection | Some of the passing material changes state in place: colour, outline, isolation, being pulled out of the flow. |
| Convergence, ordering | Scattered elements travel along arcs to their positions and lock, in a visible order, the layout resolving as they land. |
| A result, a finished thing | One object built from the earlier material, held still enough to read, camera drifting. |
| The promise | Pull back from that object to the mark and at most four words. |

The material must **persist through the chain**. The code that streamed is the code that gets flagged. The scattered ideas are the sentences in the finished document. The tangled routes are the optimised ones. Recognisable continuity is what makes the film an argument instead of a slideshow.

## The reference standard

Seven published product films were studied frame by frame for this skill. You cannot watch them, so everything they do is written out below as construction you can execute. This is the bar. A film that does none of it is not a product film, it is a slide deck.

The single most common gap between generated output and these films is **scale and depth**. The references put one enormous thing on screen at a time, in a lit space with a real ground. Generated output puts four small rounded rectangles on flat white. Fix that first; everything else is detail.

### The ground is a lit space, never flat white

Not one of the seven uses plain `#ffffff`. Every ground is one of four kinds, and each carries light:

1. **Warm off-white with a coloured bloom.** Ground `#F6F5F8`–`#EFEEF3`. Behind the focal object sits one or two soft radial glows in the brand hue at 25–45% opacity, 500–900px across, heavily blurred (`filter: blur(80px)` on an absolutely positioned circle). The frame reads as lit, not blank.
2. **Warm neutral grey.** Ground `#E8E6E3`–`#EDEBE8`, no gradient, extremely restrained. Used when the content is photographic and must not compete.
3. **Near-black with a single warm source.** Ground `#0B0B0D`–`#141318`, with one large radial gradient in the brand hue (orange, purple, red) bleeding from one edge or from behind the type at 30–60% opacity. Type on this ground carries a soft glow: `text-shadow: 0 0 40px <accent at 45%>`. Optionally a fine grain overlay at 3–6% opacity.
4. **Full-bleed brand colour.** The entire viewport floods to one saturated brand colour — a coral `#EE4B3C`, a blue `#1A56F0`, a deep red — with white type. Held 1.5–2.5s. Use at most twice per film, as punctuation or as the final beat.

The ground never changes to white, never goes transparent, and never empties. When the film moves between grounds it does so as a full-bleed wipe or flood driven by an object, never a fade.

### Typography

**Family.** A geometric or neo-grotesque sans throughout: `Inter`, `Söhne`, `General Sans`, `Satoshi`, or the platform stack `-apple-system, "SF Pro Display", Inter, sans-serif`. One family per film. Serif appears only if the brand's own wordmark is a serif.

**Weight and tracking.** Statements are 600–780 weight with tight negative tracking, `letter-spacing: -0.03em` to `-0.055em`. Never a light weight for a statement. Never letter-spaced-out uppercase except for a kicker.

**Size.** This is where generated output fails hardest. Measured across all seven films, an editorial statement occupies **45–85% of frame width**, with a cap height of **6–9% of frame height**. At 1920×1080 that is a `font-size` of **96–150px** for a one-line statement, and **150–220px** for a two- or three-word statement that fills the frame. A statement under 70px at 1080 does not appear anywhere in the references.

**One thought, one line, no subtitle.** Every statement is a single sentence or fragment, centred, with nothing under it. A second line of smaller grey explanatory text under a headline appears in none of the seven and is the clearest signal of generated output.

**The accent word.** Almost every statement colours exactly one word in the brand hue while the rest stays near-black or white: *"So, progress **slows**"* with `slows` in blue; *"Where the world builds **software**"* with `software` in purple; *"Select your desired **style**"* with `style` in red; *"All **connected**"*, *"Everywhere at **once.**"*. Two-tone within a single line, one accent word, never more.

**Words arrive one at a time onto a fixed line.** A recurring construction: `Ideas.` holds, then `Notes.` appears beside it, then `Tasks.` — the line assembling in place with the earlier words never moving. Similarly `Translate.` → `Dub.` → `Distribute.` Build this by laying out all words in the final position and revealing each with a `y: 24 → 0` plus opacity on `back.out(1.4)`, 0.35–0.5s apart. Do not re-centre the line as words appear.

**Punctuation as design.** Statements frequently end in a full stop that is itself an object — `Ideas.` `Books.` `Done.` — and a small four-point sparkle glyph `✦` sometimes closes a line.

### The shot catalogue

These are the shots the references are actually built from. Pick four to six per film; every one of them is a large, single-subject composition.

**Full-bleed imagery under type.** A photograph, map, or texture fills the entire viewport and a very large statement sits over it in white or black. Nothing else in frame. This is the strongest opening in the set.

**The 3D application panel.** The product UI is not a flat rectangle in the middle. It is a large panel rotated in three dimensions — `perspective: 1600px` on the world, `rotateY: 12–26deg`, `rotateX: 4–10deg`, `rotateZ: -3–6deg` — occupying 60–95% of frame width, with a real drop shadow (`0 60px 140px rgba(0,0,0,.28)`) and often bleeding off one edge of the frame. Two or three such panels at different depths and angles, with the camera travelling past them, is a standard beat.

**A corridor of material at depth.** Five to nine real objects — document pages, code planes, PR cards, content thumbnails — placed at distinct Z depths from `translateZ(-1400px)` to `translateZ(300px)`, each with its own slight rotation, the nearest ones motion-blurred. The camera flies forward through the corridor. Every object carries genuine content: a real title, a real status pill, real body text. This shot replaces "some cards fade in".

**The dimensional icon or device.** One app icon, phone, or artefact rendered as a solid object at 25–45% of frame height, tilted in perspective with a soft contact shadow, slowly rotating. Around it, five or six smaller related icons orbit on elliptical paths at varying depth.

**Icons used as words.** A 3D icon sits inline inside a sentence at the same optical size as the type — *"Any language [folder icon] Instantly"* — and can then be dragged by a cursor out of the line and into a drop target. Icons are solid, dimensional, and lit, never flat monoline glyphs.

**The macro edit.** Extreme close-up on a single word or control filling 30–60% of frame width, with a text selection highlight sweeping across it, a caret blinking, or a value changing in place. The camera pushes in to reach it and pulls back out.

**The rolling picker.** A vertical list of eight to twelve real option names in light grey, scrolling continuously, with the currently selected one snapping to full black at the anchor line and a small marker beside it. Reads as a machine choosing.

**Coloured status pills.** Rounded-full chips — `border-radius: 999px`, `padding: 10px 22px` — in saturated brand colours with white or dark text, each often carrying a small icon. Stacked in a column with 0.08s stagger, or connected by thin curved lines into a node graph.

**The measured number.** One large figure at 8–14% of frame height with a unit and a period beside it, counting up, above a gradient-filled progress bar that fills in sync. Never an unlabelled sparkline.

**The real terminal or timeline.** Monospace output in a dark window with traffic-light dots, lines appearing one at a time with checkmarks; or a video editor timeline with layered filmstrip and waveform tracks in distinct colours, a playhead, and real timecodes.

**Geometry as metaphor.** Three large translucent circles in cyan, magenta and amber overlapping so the intersections blend additively; a soft multi-hue gradient sphere; an iridescent faceted form rotating slowly on black. Pure geometry at 30–50% of frame height, used where a UI would say nothing.

**The brand close.** The mark and wordmark together, centred, occupying 25–40% of frame width, on open ground or a full-bleed brand colour, with at most four words under it or a bare URL. In one film the mark substitutes for a letter in the final word. The close is never a small pill and never a paragraph.

### Camera

The camera is a real instrument in every one of these films and it never stops.

- **Push in** on the subject: `scale 1 → 1.35–1.8` over 1.2–2.0s, `expo.out` or `power4.out`.
- **Pull back to reveal**: `scale 1.6 → 1` while the frame fills with what was outside it. This is the reveal move, and it is how a sentence completes itself.
- **Lateral travel**: `x` moving 600–2400px through a wide `data-camera-world` at `power2.inOut`, following material rather than sliding for its own sake.
- **Z-push through depth**: the world's `translateZ` advancing while layered objects pass the camera and blur.
- **Orbit**: the world rotating 8–20deg on Y around a fixed subject.
- **A settling drift** under every reading hold: 1–3% scale or 10–30px of travel, continuing, so no frame is ever locked.

Adjacent beats must contrast in camera: a push follows a lateral track, a macro follows a wide. Never two pushes in a row at the same rate.

### Transitions between beats

Every boundary in these films is carried by an object. The four that actually appear:

1. **Object-led wipe.** A large shape, panel, or colour field sweeps across the frame in one direction and the next beat is already composed behind it. The wipe is the carrier.
2. **Camera-continuous cut.** The camera is already travelling; the material changes while the movement's axis, direction and speed are preserved across the boundary, so the eye reads one continuous move.
3. **Morph of the shared object.** A card becomes a window becomes a panel — one element whose width, height, radius and surface change continuously while its contents cross-fade inside it.
4. **Scatter and reform.** A cluster of objects breaks apart on individual vectors with rotation and motion blur, travels, and reassembles as the next beat's composition.

Never a cross-dissolve, never a fade through white or black, never a hard cut between two unrelated static layouts.

## How to actually shoot the film, move by move

Everything below was measured off the reference films frame by frame at 8 frames per second. The numbers are what those films really run at. Build the moves, do not invent your own — the difference between these and a slide deck is entirely in the timing.

### Move A — The Oversize Pull-Back

The signature opening. The line begins **larger than the frame**, cropped by both the left and right edges so only two or three words are legible, and shrinks until the whole sentence fits. The sentence completes because the frame effectively widened, not because words faded in.

```
t+0.00  line at scale 2.9, opacity 1, cropped by both edges
t+0.00  → scale 1.0 over 0.65s, ease "expo.out"
t+0.65  full sentence visible at reading size, centred
t+0.65  hold 0.9s with a drift: scale 1.0 → 1.03, x 0 → -14
t+1.55  exit: opacity → 0 over 0.3s, or blur 0 → 12px
```

Measured: the reference runs this in **0.6–0.75s**. It is fast. A two-second pull-back reads as sluggish. Use `macroSettle(timeline, line, { at, startScale: 2.9, blur: 0, duration: 0.65 })` and give the beat a matching `cameraPull`.

### Move B — Grow and Complete

The other way a sentence finishes itself, and the more useful one. The opening fragment sits **small and centred**, then grows while the rest of the sentence arrives beside it and the line re-centres continuously.

```
t+0.00  fragment "Import" at scale 0.55, opacity 1, centred
t+0.00  → scale 1.0 over 0.50s, ease "power3.out"
t+0.18  remaining words fade 0 → 1, left to right, 0.07s apart,
        each also y 10 → 0 on "back.out(1.3)"
        the line's x shifts left each time a word lands so the
        whole sentence stays centred — never let it grow rightward
t+0.55  complete sentence, centred, full size
t+0.55  hold 1.0s with scale 1.0 → 1.04 continuing
```

The words arrive **ghosted then solid** — an opacity ramp, not a slide from off-screen. Total build is about **0.75s** for a five-word line.

### Move C — Macro Settle, and the snap is the point

```
t+0.00  scale 3.0, blur 20px, opacity 0
t+0.00  → opacity 1 over 0.12s
t+0.05  → blur 20px → 0px over 0.25s, ease "power4.out"
t+0.00  → scale 3.0 → 1.0 over 0.85s, ease "expo.out"
t+0.85  settled, then drift scale 1.0 → 1.04 and x 0 → +22
        across the rest of the hold
```

Focus resolves at **t+0.30**, a third of the way through the movement. The line is sharp while it is still travelling. Text that stays soft until it stops looks like a video artefact. Use `macroSettle(...)`, which already runs these numbers.

### Move D — Ground flood

Never cross-fade between beats. Flood the ground instead:

```
t+0.00  next ground colour enters as a full-bleed layer,
        scaleY 0 → 1 from one edge, or x -100% → 0,
        over 0.45s, ease "power3.inOut"
t+0.10  outgoing type opacity → 0 over 0.2s, or blurs out
t+0.30  incoming type begins Move B or Move C on the new ground
```

The frame is never empty: the new ground is already covering the viewport before the old type has finished leaving.

### Move E — The object rises and never stops

A device, icon or artefact enters from **outside the frame edge**, not by fading in:

```
t+0.00  y +55% (below the frame), rotation -8deg, scale 0.85
t+0.00  → y 0, rotation 0, scale 1.0 over 1.1s, ease "expo.out"
t+1.10  continuous rotation ±6deg and y ±12px for the whole beat,
        so the object is never still
```

Size it at **30–45% of frame height**, tilt it `rotateY 14–22deg` with `perspective: 1600px`, and give it a real contact shadow.

### Move F — Word-by-word onto a fixed line

`Ideas.` → `Ideas. Notes.` → `Ideas. Notes. Tasks.` Lay all three out in their **final positions** first, hide the later ones, and reveal each with `y: 22 → 0` plus opacity on `back.out(1.4)`, **0.42s apart**. The earlier words never move.

## The end-to-end film

A 22-second film, beat by beat, with the times it actually runs at. Adapt the content; keep the structure, the scale changes, and the pacing.

**Beat 1 — 0.0 to 4.2s. The claim, oversized.**
Ground floods in as a full-bleed dark or brand colour. The opening statement plays **Move A**: starts cropped by both frame edges at scale 2.9, pulls back to reading size over 0.65s. Hold with a drift. One word in the brand hue. Camera: a slow `cameraPull` from 1.15 to 1.0 across the whole beat so the frame is never static.

**Beat 2 — 4.2 to 8.6s. The problem, made physical.**
Ground floods to the second colour (Move D). The subject is now an **object, not a sentence**: a device rising from below (Move E), a corridor of real cards at Z depths from -1400px with the near plane blurred, or overlapping translucent circles. It occupies 35–55% of the frame. A short line sits over it, entered with **Move C**, no larger than half the height of Beat 1's statement — the scale contrast between beats is what makes the film read as directed. Camera: a lateral track of 500–900px, opposite in direction to Beat 1's move.

**Beat 3 — 8.6 to 13.4s. The mechanism, in macro.**
Push in hard. `cameraPush` scale 1.0 → 1.55 over 1.4s on `expo.out`, landing on **one detail**: a word being selected with a highlight sweeping across it, a value counting up, a control being pressed, a caret typing. The detail fills 40–65% of frame width. This is the closest shot in the film and it must be genuinely close — if it looks like the previous beat with slightly bigger elements, it is not a macro.

**Beat 4 — 13.4 to 17.8s. The result, pulled back.**
`cameraPull` from 1.55 back to 0.95 over 1.6s, revealing what the mechanism produced: the finished artefact, the organised set, the generated image, the completed table — at 55–80% of frame width. A line above or below it plays **Move F**, three short words landing 0.42s apart.

**Beat 5 — 17.8 to 22.0s. The brand.**
Ground floods to the brand colour full-bleed (Move D). The mark and wordmark arrive together at **25–40% of frame width**, centred, with at most four words or a bare URL beneath. The mark enters at scale 0.7 with a `back.out(1.5)` over 0.6s; the words follow 0.25s later. Hold to the last frame with a 1.0 → 1.03 drift. Nothing else is in the frame.

**The scale rhythm across those five beats is the film.** Huge → medium → macro → wide → medium. If every beat sits at the same size, no amount of correct colour or easing will save it. Write the scale of each beat's subject down before you author anything, and make sure no two adjacent beats match.

**Every beat opens with a camera tween whose duration equals the beat.** Push, track, pull, orbit — and the next beat's camera starts where the last one ended. This is what keeps the film from freezing during reading holds, and it is why the references never feel static even when the type is simply sitting there.

## Laws that hold for every shape

**The camera never stops and never resets.** Continuous motion from first frame to last — push, lateral travel, orbit, pull. It never snaps back to scale 1 between beats. Author one `data-camera-world` and move the viewport through it.

**The frame is filled.** One continuous world, field, surface, or colour ground fills the viewport, and objects live inside it. Small boxes adrift in empty space is the failure this rule prevents — but "filled" means a world, not necessarily an app shell.

**One beat, one subject, at a size you can read.** Every beat has a single thing the viewer is looking at, and it is large: a sentence spanning most of the frame, one object at 25-45% of frame height, a proof artifact at 55-80% of frame width. Three or four small cards spread around an empty frame is not a composition — it is a list, and the viewer cannot tell what to look at or what you are claiming. A frame whose largest object covers less than 3% of the canvas is rejected outright as "small cards float in empty space". If your beat is a set of items, either enlarge one of them to be the subject and let the rest support it, or gather them into a single object with real mass.

**Consecutive beats share material.** Not a mechanism at the boundary — actual objects. Something visible before the cut is still visible after it, and it is the thing the next beat is built around. A film where every element is replaced at the cut plays back as separate films spliced together, however sound its carrier chain reads on paper, and it is rejected with "nothing survives the cut". This is stricter than the seam rule and it is the one a viewer actually feels: if you cannot point at the object that is on screen on both sides, the beats are not the same film.

**Plan the carrier chain before the beats.** Write the chain first: one object at 0s, and what it becomes at each boundary — *the sentence becomes the glyph becomes the button becomes the product.* The beats are the states that chain passes through, not containers you fill and then look for a way out of. Two independently built panels cannot morph into each other; one element whose outline changes can.

**Every boundary is a `seam`, and a seam owns time.** A boundary is not the instant one beat's `duration` runs out. It is an object in the returned JSON with a start, a length, a named carrier, and the two beats it joins — because a handoff given zero seconds is a cut no matter which helper you call. Budget **0.35–1.8s** for each one and schedule the handoff in `timeline.js` across exactly those seconds.

**A seam straddles its cut.** Beats still tile: beat A's interval ends exactly where beat B's begins, at the cut time `c`. The seam opens *before* `c` and closes *after* it — `at < c` and `at + duration > c` — so the outgoing beat is still on screen as the carrier leaves and the incoming beat already exists as it arrives. A handoff scheduled beside the cut instead of across it has no frames in which both sides exist, and the film swaps instead of moving. A boundary at 8.0s with a 1.0s morph is `at: 7.5, duration: 1.0`, not `at: 8.0`.

Because the seam straddles the cut, each beat's layers may be on screen slightly outside its own interval — from the start of its incoming seam to the end of its outgoing seam, and not one frame further.

**Each boundary uses one mechanism**, and `techniques[].handoff` and `seams[].mechanism` must both name the one you built:

- **MORPH** — the carrier's own outline changes continuously through width, height, radius, surface and role. Word to glyph to button to application is a morph. A zoom or blur followed by a different object is not.
- **MATCH-CUT** — source and destination share position, size, silhouette, direction and speed at the cut, then continue that movement.
- **PARTICLE-REASSEMBLE** — visible fragments leave a real source and travel to construct the destination.
- **final-hold** — the ending only.

Hard cuts, cross-dissolves, fade-to-black and opacity-only scene changes are forbidden between beats. Opacity may clean up internal faces *after* physical continuity is established. Maintain a dominant direction through connected seams: match axis, direction, velocity and motion phase rather than resetting at every boundary. Mark the owner `data-transition-carrier`.

**Clear the outgoing beat — at the end of its seam, not at the cut.** Every element you tag `data-scene="<id>"` must be gone from the frame by `seam.at + seam.duration`, the moment its outgoing seam completes. Past that it is composited on top of the next beat and the film is rejected outright with "still shows the stale layer from <scene>". Before that it is *supposed* to be there: that overlap is the transition.

Clear it in reverse hierarchy: innermost details leave first, along the vector the beat was travelling, then the container. `autoAlpha: 0`, `visibility: hidden`, `display: none`, an opacity at or under 0.02, or travelling fully outside the camera viewport all count as cleared; anything else still counts as on screen. Schedule it with `timeline.set(...)` or a tween that completes at the end of the seam — never an `onComplete` mutation, because scrubbing backwards must restore it.

**The carrier is a container, never a shape.** A painted rectangle with nothing in it is the most common way a generated film reads as broken: the box keeps its own background, border and radius lit while the outgoing face has already left and the incoming one has not arrived, so the viewer watches a coloured plate sit in the middle of the frame. Any painted element between 2% and 60% of the frame that holds no visible content is rejected with "shows an empty plate".

Two ways to be safe, and you should usually take the first:

- **Give the carrier no surface of its own.** Let the faces inside it paint the background, border and radius. Then the carrier is pure geometry, and an empty carrier is an invisible carrier.
- **If the carrier must be painted** — a real card or window whose plate is the point — then its content is never all gone: overlap the outgoing face's exit with the incoming face's entrance so at least one is on screen in every frame, including every frame of the seam. Fade the plate's own background out with the last face that leaves it.

The carrier is the exception, and the reason it must not carry a `data-scene` tag: it is the one thing meant to cross the boundary, and a `data-scene` tag would clear it mid-crossing. Tag scene containers, not the carrier. The carrier must be visibly on screen on *both* sides of its seam — the composition is seeked to `seam.at - 0.15s` and `seam.at + seam.duration + 0.15s` and the carrier is looked for in both frames. A `morph()` call on an element that is hidden, off camera, or unchanged in size and position at those two times is reported as a hard cut, whatever the source says.

**Action causes result.** A press produces the menu, a scan produces the detection, a convergence produces the document. Nothing appears because the timeline reached a number.

**Type enters cropped and settles.** Important sentences arrive at scale 2.0 or greater, oversized and clipped by the frame, then settle into readable focus. Never simply faded in at final size.

**The resolve is a pullback from the proof.** Retreat from the last real thing you showed to a mark and at most four words, on a clean or full-bleed brand ground with generous margins. Not a landing-page hero: no explanatory paragraph, no CTA button, no competing links. The film ends on an image, not on a signup form.

## Two mechanical rules

**Fill each beat with its camera move.** Every beat opens with one camera tween whose duration equals that beat's full duration, starting where the previous beat's camera ended. The camera is what fills holds — it is how the reference films never freeze. A dead stretch then cannot exceed a beat boundary.

**Name your world.** The stage's first child is the full-bleed world at `width:100%; height:100%`, with a `data-edit` id naming what it is: `scan-field`, `route-space`, `idea-field`, `product-surface`, `editor-canvas`, `workspace`. Everything else is a child of it.

**Keep the camera on the subject.** A viewport-sized world is valid. Enlarge it only for actual spatial travel; never require a 3200-5600px canvas to satisfy a score. Resolve the focal subject's position after parent and child transforms combine. The settled text and proof must remain inside the viewport with readable margins; intentional cropping belongs to the entrance or transition, not the reading hold.

## Interface physics, not cinematic physics

You are a motion designer moving real interface material, not a camera cutting between shots. Four rules, and they are checked against rendered frames.

**Never dissolve, and never through an empty frame.** No cross-fades, no fade-to-white, no fade-to-black between beats. The ground is constant for the entire film: it does not brighten, does not go transparent, and never becomes a blank screen while one beat leaves and the next arrives. A stretch with nothing on screen is rejected with "holds a blank frame", and a boundary with an empty side is rejected with "passes through an empty frame".

**Elements enter and leave along vectors.** Cards slide up from below. Lists expand outward from the row that owns them. Panels grow from the edge they are anchored to. Outgoing material travels off along one motivated direction in reverse hierarchy — innermost details first — while the carrier keeps moving. Opacity only ever cleans up a face *after* it has already physically left.

**Snappy interface easing.** `power2.out` / `power3.out` for arrivals, `back.out(1.3-1.5)` for tactile landings, `power2.inOut` for lateral travel, `expo.out` for camera and geometry. Never `ease: "none"` or `"linear"` on a reveal — a constant-rate opacity ramp is what makes generated text read as a low-opacity overlay instead of an element loading onto a page. Every reveal carries a transform as well as its opacity.

**Rigid material stays sharp.** Text and interface lines do not warp, smear, or blur while they move. Every `blur()` resolves to `blur(0px)`, and the only blur in the film is a deliberate macro-settle focus pull that lands sharp *before* the movement stops.

**Anchor the layout to a structure.** Objects do not drift in open space. Either place them on a visible grid, connect them with interface lines that draw themselves, or group them inside one panel with real mass. Three nodes floating apart with nothing between them reads as a broken interface, not a composed frame — and a beat whose largest object is under 3% of the canvas is rejected outright.

## Typography: use the built treatments

Rule 3 of the direction brief names one treatment per film, and all three are callable presets. Use the preset rather than re-implementing it as an opacity fade:

- **The Pullback Complete** — `pullbackComplete(timeline, lead, tail, { camera, at, startScale, hold })`. One massive cropped line settles; the camera pulls back and the rest of the sentence slides into the room the retreat opened. Pass the `data-camera-world` element as `camera` so the retreat and the completion are one move. The tail element is hidden for you until the pullback.
- **Macro Settle** — `macroSettle(timeline, line, { at, startScale: 3, blur: 18 })`. Type arrives at 300% and heavily blurred, then snaps to crisp 100%. Focus resolves before the movement does; do not add your own blur tween.
- **Kinetic Anchor** — `kineticAnchor(timeline, anchor, rest, { at, distance, rotation })`. One word holds absolutely still while the rest of the line travels around it on alternating vectors. Author the anchor word as its own element; the preset never tweens it.

Each returns the split word elements, so you can hang a secondary action off them. Use exactly the treatment the direction chose.

## Timing

- Tactile actions (press, chip, toggle): **0.15-0.3s**
- Type settle per word: **0.35-0.5s**, stagger **0.05-0.09s**
- Camera and geometry moves: **0.9-1.4s**
- Reading hold after the last word settles: **0.8-1.6s** for a short sentence
- Result inspection hold: **1.5-3.0s**, camera still drifting

`exitStart >= lastWordSettled + readingHold`, where `lastWordSettled = entryStart + (wordCount - 1) * stagger + wordDuration`. Compute it; do not estimate.

**No stretch longer than 1.6s may pass with nothing scheduled.** During any hold one bounded action continues: material travelling, a counter, a scan, a drawn line, or the camera's own settle. A frozen frame is the single most reported defect.

Easing: `back.out(1.2-1.6)` for tactile arrivals, `expo.out` / `power4.out` for camera and geometry, `power2.inOut` for lateral travel. Never `bounce.out` or `elastic.out`.

## Scaling to the requested duration

Keep the chain's order and drop or merge middle states — never compress every beat uniformly, and never cut the opening state or the resolve.

- **10s or less**: three states. Before, mechanism, after.
- **15s**: four states.
- **20-25s**: five or six states, the full chain.
- **30s or more**: deepen the mechanism with a second pass over the same material. Never bolt on an unrelated feature.

## Using HyperFrames components

Retrieved components arrive with real source, chosen to match the film shape. They are reference implementations, not callable functions.

- Take their markup, CSS, and the mechanic. Discard script wrappers, CDN imports, independent clocks, and `data-composition-*` attributes.
- Re-theme every colour, radius, and type choice to the requested product.
- Drive them from `context.timeline` at explicit seconds.
- Mark each adapted owner with `data-hyperframe-component="<name>"` and record it in `techniques`.
- Use what the retrieved set gives you for your chain's states. Do not pad the list to hit a count.

## Before returning

1. Can I write out my transformation chain, and is each beat one of its states?
2. Is the middle of the chain the product's actual mechanism, or is it furniture?
3. Did I build an interface? If so, does the request pass the interface test, or did I reach for a dashboard out of habit?
4. Does the same material persist from the first state to the last?
5. Does the camera move continuously, without resetting between beats?
6. Is any painted shape ever on screen with nothing inside it?
7. Does an object visibly carry every boundary — and for each seam, is that object on screen and changing at both `at - 0.15s` and `at + duration + 0.15s`?
8. Does every seam open before its cut and close after it, rather than starting at the cut?
9. Is any stretch longer than 1.6s without a scheduled action?
10. Does every sentence finish settling before its exit begins?
11. Does the ending pull back from a real thing that was actually shown?

Self-assigned scores and helper counts are not evidence. Answer the eleven questions.
## Strict JSON output contract

For embedded generation, return ONLY one JSON object satisfying this schema. No Markdown wrapper, comments, placeholders, or ellipses. Local file-authoring agents may write the same complete source files directly when the user requests repository edits.

All scene and direction IDs must agree; one direction and technique entry per scene, and one `seams` entry per boundary — `scenes.length - 1` of them. Scene start/duration values use final playback seconds, tile without gaps, remain within total duration, and agree with GSAP; each seam straddles the cut between the two beats it names. Direction.hold states the actual settle and exit times and the reading interval. Direction.transition names the source, destination, mechanism, boundary time, and continuity; use final-hold only for the ending. Techniques list only mechanics actually implemented. skills lists the bundled skill actually applied, not unavailable skills.

Every `seams[].carrier` must be a `data-edit` id that exists in compositionHtml and is tweened by name in timelineJs across that seam's own seconds. A carrier you never animate, or one that does not exist, is a rejected generation rather than a weak one.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "title",
    "duration",
    "skills",
    "scenes",
    "direction",
    "seams",
    "techniques",
    "compositionHtml",
    "timelineJs",
    "reply"
  ],
  "properties": {
    "title": { "type": "string", "minLength": 1 },
    "duration": { "type": "number", "exclusiveMinimum": 0 },
    "skills": {
      "type": "array",
      "minItems": 1,
      "maxItems": 1,
      "items": { "const": "write-motionly" }
    },
    "scenes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "label", "start", "duration", "accent"],
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "label": { "type": "string", "minLength": 1 },
          "start": { "type": "number", "minimum": 0 },
          "duration": { "type": "number", "exclusiveMinimum": 0 },
          "accent": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" }
        }
      }
    },
    "direction": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "scene",
          "composition",
          "spatialRegion",
          "cameraStart",
          "cameraEnd",
          "cameraTarget",
          "primary",
          "secondary",
          "hold",
          "transition"
        ],
        "properties": {
          "scene": { "type": "string", "minLength": 1 },
          "composition": { "type": "string", "minLength": 1 },
          "spatialRegion": { "type": "string", "minLength": 1 },
          "cameraStart": { "type": "string", "minLength": 1 },
          "cameraEnd": { "type": "string", "minLength": 1 },
          "cameraTarget": { "type": "string", "minLength": 1 },
          "primary": { "type": "string", "minLength": 1 },
          "secondary": { "type": "string", "minLength": 1 },
          "hold": { "type": "string", "minLength": 1 },
          "transition": { "type": "string", "minLength": 1 }
        }
      }
    },
    "seams": {
      "type": "array",
      "description": "One per scene boundary: scenes.length - 1 entries. Empty only for a single-scene film.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "from",
          "to",
          "at",
          "duration",
          "carrier",
          "mechanism",
          "becomes"
        ],
        "properties": {
          "from": {
            "type": "string",
            "minLength": 1,
            "description": "Scene id the carrier leaves."
          },
          "to": {
            "type": "string",
            "minLength": 1,
            "description": "Scene id the carrier arrives in."
          },
          "at": {
            "type": "number",
            "minimum": 0,
            "description": "Playback second the handoff begins. Strictly before the cut between from and to."
          },
          "duration": {
            "type": "number",
            "minimum": 0.35,
            "maximum": 1.8,
            "description": "Seconds the handoff occupies. at + duration must land strictly after the cut, so both beats are on screen throughout."
          },
          "carrier": {
            "type": "string",
            "minLength": 1,
            "description": "data-edit id of the one element that crosses this boundary. Must exist in compositionHtml and be tweened by name in timelineJs."
          },
          "mechanism": {
            "enum": ["morph", "match-cut", "particle-reassemble"]
          },
          "becomes": {
            "type": "string",
            "minLength": 1,
            "description": "What the carrier is entering the seam and what it becomes leaving it."
          }
        }
      }
    },
    "techniques": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "beat",
          "registryReference",
          "motionlyPresets",
          "sustainedMotion",
          "handoff"
        ],
        "properties": {
          "beat": { "type": "string", "minLength": 1 },
          "registryReference": {
            "type": "string",
            "description": "Actual reused registry name, or none with a brief reason."
          },
          "motionlyPresets": {
            "type": "array",
            "items": { "type": "string", "minLength": 1 }
          },
          "sustainedMotion": { "type": "string", "minLength": 1 },
          "handoff": {
            "enum": ["morph", "match-cut", "particle-reassemble", "final-hold"]
          }
        }
      }
    },
    "compositionHtml": { "type": "string", "minLength": 1 },
    "timelineJs": { "type": "string", "minLength": 1 },
    "reply": { "type": "string", "minLength": 1 }
  }
}
```

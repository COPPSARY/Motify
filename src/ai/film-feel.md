# Film feel

Check these first, in every film, whatever it shows. The rules above give you the tools; this is how a directed film uses them.

- **The camera never cuts on a still frame.** Every shot enters already moving, on an exponential ease-out that covers 12-19% of the remaining distance per frame, and leaves on an accelerating move or a blur ramp. Once it lands it keeps creeping, about 1-4px per frame. Allow at most one frozen stretch in the whole film, so that it reads as a breath.
- **Motion carries across every boundary.** The outgoing move's direction and speed continue into the incoming shot: a whip-tilt lands still travelling and decelerates, and a push keeps pushing. The thing just acted on often becomes the next shot: a clicked icon opens into the next screen, a product collapses into the logo. Hard-cut on the music drop (`beatCut`), blur-dissolve between quieter shots (`blurDissolve`), and carry an object across the rest.
- **Blur follows speed and direction on every move.** A directional move smears along its own axis, vertical for a tilt and horizontal for a pan, and focus resolves while the element is still travelling. The blur ramp peaks on the cut frame and is gone a few frames after it. A zoom smear is 20-30 scaled, faded copies of the shape.
- **Nothing moves alone.** Each shot has a lead move, a secondary that trails it by 0.05-0.15s on a different curve, and the camera on a third clock. Parts of one lockup arrive in turn: the name appears blurred, then the pill slides 15px as it sharpens.
- **One biggest moment.** The reveal or payoff gets the film's largest scale change, fastest move and heaviest blur. Everything else stays quieter so that it lands.
- **Every change has a cause.** A click, a collapse, a scroll or the music drop leads into it. If you cannot name what triggered a move, cut the move.
- **Land on the music.** When a track or BPM is given, land cuts and impacts on the beat or 2 frames ahead of it, never late.
- **Continuous in the frame number.** Every value interpolates smoothly, even on half frames: no `steps()`, no rounded positions, no snapping, so a 60fps master is as smooth as the preview.
- **Interfaces act, they don't sit.** A cursor glides in decelerating, turns to face where it is going, grows on hover and shrinks about 15% as it presses. It rides a scroll with the page. Typing runs about one character per frame with a one-frame hold every 2-3 characters, and the caret is always on. The camera zooms toward each action, holds, then eases out accelerating as the press lands.
- **Built, not faked.** Frosted glass is a blurred, lightened copy of what is behind it, clipped to the shape. A glowing word gets a tight glow plus a wide soft halo. UI text never glows.

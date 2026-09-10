# Recoup: Stop losing revenue you already earned

26 seconds, 1920 x 1080, 60 fps. A fictional failed-payment recovery product, authored as an illustrative preset. No real customer names, adoption numbers or performance claims. Silent.

## The grammar

**A statement owns its frame, or the interface owns its frame. Never both.** A headline over a product shot with a second label underneath is slide layout, not advertising. So the two statements here play to an empty stage, and the three product beats carry no floating copy at all. Facts that belong to the account — how long it has gone unpaid, what state it is in — live *inside* the interface, because that is where a user would actually read them.

Built in **liquid glass on a real 3D camera**. Every pane carries its light as a soft elliptical **hotspot** that slides across the surface as the pane turns, plus a lit bevel and a top lip. Deliberately not a `linear-gradient` band: a gradient across a rectangle can only ever be a straight stripe, and no amount of softening stops it reading as a wiper blade instead of a reflection.

The ground is near-black with **two** contained sources — a key behind the subject and a cool rim — over a **perspective floor grid inside the 3D rig**. That grid is what makes the camera legible; against a flat backdrop a dolly reads as nothing. The key is magenta while revenue is leaking and turns brand-green on the frame the mechanism works, taking the floor with it. Fine grain kills the banding a heavy blur always produces.

## The beats

| Time | Beat | What is in the frame | Camera |
| --- | --- | --- | --- |
| 0-4.2 | **Statement** | *A card declines. A customer disappears.* Cropped by both frame edges at 2.8x, pulling back to reading size. Nothing else. | Slow dolly, z 0 → 228 |
| 4.2-10.5 | **The problem** | Interface only. Four declined charges at authored depths (z -560 to -1750), the far ones small and defocused. Nordvik is refused and drops **Active → Past due** on that frame; over fourteen unpaid days it decays to **Suspended**. The day count sits in the total pane, where it belongs. | **Fly-through**, then a corridor drift |
| 10.5-12.4 | **Statement** | *So Recoup tries again. When the bank will say yes.* Word by word at reading size — not a second giant-to-settle, which needs about 1.5s to land and would still be oversized as it left. Nothing else. | Held at z 900 |
| 12.4-18.6 | **The mechanism** | Interface only, ~80% of frame. The carrier returns and turns 180° to reveal the retry schedule. Three attempts resolve in turn: a sweep runs each row, then it settles. Two decline. The third clears, and the account goes back to **Active**. | Hard push, z 900 → 1150 |
| 18.6-22.4 | **The proof** | Interface only, ~63%. Twelve bars rise; `$6,795` and `91.7%` count up. | Pull back and **orbit** |
| 22.4-26 | **Brand** | The panel tips away on X and the mark tips in. Wordmark, one line, and the only overshoot in the film: the call to action. | Settle, yaw held at zero |

## How it is built

**One camera.** `rcpCam` is a single `preserve-3d` rig making four real moves: a dolly, a fly-through, a hard push and an orbit. Panes carry authored `z` and the rig's own `z` carries the viewer through them. Nothing fakes depth with scale.

**Type rides above the world.** The six `data-scene` blocks live on a flat `.rcp-hud` layer, not inside the rig. Inside `preserve-3d` a dolly rescales type by perspective — a 44px line would double as the camera moves. This is the 3D-comp-plus-title-layer split. The carrier still lives inside the rig and outside every scene, which is what the carrier rule actually protects.

**The flip is real.** At the third seam the pane rotates away to edge-on, and on the frame it is a line — zero width, nothing to see — the rig is reset to the opposite 90° and the incoming face turns toward the viewer. One continuous 180° turn, no face ever mirrored. The fifth seam does the same on X to reach the mark.

**There is a protagonist, and something happens to it.** Nordvik Studio is an account with a state, and that state is the spine: **Active** in the opening product frame, **Past due** the instant the card is refused, **Suspended** while two weeks pass and the money sits stuck, **Active** again on the frame the third retry clears. Beat 1 promises a customer disappears; the film shows it happening and then undoes it. The payoff is not the charge going through — it is the customer not being lost, which is what the closing line is actually selling.

**Pacing is measured, not eyeballed.** Directed motion runs at about **4.7x** peak-to-mean velocity; anything at or under 2 reads as constant-rate however long you spend on the curve. The trap this preset fell into first was applying the ambient-drift rule to multi-second *directed* camera moves — a 4.2s track on `sine.inOut` is the textbook slow-linear feel. Camera moves are a **ramped move followed by a hold**, never one long crawl, and `sine.inOut` is reserved for what is genuinely ambient.

**Every beat has events all the way through it.** No stretch holds a finished result. Each charge fails in turn in beat 2; each retry is swept and resolved in beat 4. The whole retry schedule is on screen from the start so the pane is never a half-empty plate — what arrives over time is each attempt's outcome.

**The carrier chain, written before the beats:** one declined charge becomes a corridor of declined charges, absorbs them and recedes for the pitch, returns and turns to reveal the retry, opens into the month's recovery, and folds into the mark. Every seam straddles its cut.

Scale rhythm: huge type → 40% → huge type → 80% → 63% → the mark. No two adjacent beats match.

The arithmetic agrees with itself: the four charges total $7,410, the recovered figure is $6,795, and 6795/7410 is the 91.7% on screen.

## Four things worth stealing

**Give copy its own frames.** If a viewer has to choose between reading a headline and reading an interface, the frame has failed at both. Alternate; do not stack.

**Glass reflects a light, it does not get wiped by one.** A `linear-gradient` at an angle across a rectangle is a straight band, full stop — softening the stops only makes a blurrier straight band. Use a radial hotspot anchored to a light position (`--lx`/`--ly`) and move the position; the highlight then slides across the surface the way a reflection does, and bends around the corners for free.

**A 3D camera needs something to move against.** The floor grid costs almost nothing and it is the difference between a dolly you can feel and a dolly you have to be told about.

**Structure over surface.** A SaaS ad earns its claim by showing the mechanism at its closest, not by stating the outcome loudest — and it earns its *feeling* by having something at stake. Copy the problem → statement → macro-mechanism → proof → CTA structure, and give whatever the product acts on a state that can be lost and won back.

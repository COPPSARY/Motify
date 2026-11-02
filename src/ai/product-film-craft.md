# Product film craft

Motion that looks expensive comes from a few techniques used on purpose.

## Show the product working

Each product beat is one cause and effect: input → response → result.

- A cursor arrives, presses (scale 0.96 for 0.1s), and the result lights up on the same frame.
- Text types while the caret is on screen.
- A number climbs to its value with `stepSurgeCounter`.
- A scan line crosses the thing it is analysing.

Hold the result for 1-1.5s so it can be read.

## Use the whole scale range

Open inside the idea — a macro crop of one icon, one word at 3x — and settle out to a readable frame with `macroSettle` or `giantKineticCrop`. Spend one decisive `cameraPush` inspecting the proof and one `cameraPull` revealing context or closing.

## Reveals that build the surface

- Surfaces open with `maskReveal`, `maskWipe` or `splitReveal`.
- Lines, charts and connectors draw on: animate `strokeDashoffset` from the path length to 0 on `EASE.travel`.
- Cards tilt in through depth with `perspectiveCardReveal`, then return close to frontal for reading.
- A payoff lands with a light pass across glass or type using `gradientSweep`.

## Momentum

- Carry velocity through a seam. The next beat starts already moving in the direction the last one left.
- Objects travel on arcs with `motionArc`. UI and mechanical parts travel straight.
- Before the payoff, slow to a near-stillness of drift alone for 0.3-0.5s, so the payoff hits harder.

## The background answers the foreground

A bloom brightens when the result arrives. Grid lines draw toward the active element. The ground hue shifts when the product changes state.

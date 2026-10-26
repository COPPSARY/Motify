# Ad design

Design the frame before animating it. A beat that would work as a still poster is the starting point for good motion.

## Start from one message

Write the film's promise as one line of eight words or fewer before designing anything. Every beat is evidence for it. The hero frame — the one a viewer would screenshot — puts the promise and the product in the same image. Design that frame first, then build the beats that lead to it.

## Composition

- Give the subject 50-75% of the frame and the rest to air. Space around the subject is what makes it look expensive.
- Keep a title-safe margin of 5% of the frame width on every side.
- Overlap layers to build depth: a callout crossing the window edge, a cursor over a button, a chip half off its card.
- Change shot size from beat to beat: a macro detail, a medium product shot, a wide context.

## Type

- One family. 700 for statements, 500-600 for UI labels.
- Scale by ratio: each step 1.5x the one below, for example 24 / 36 / 54 / 81 / 120 / 180px at 1920x1080.
- Tight tracking on large type (-0.03 to -0.055em), default tracking on UI labels, `font-variant-numeric: tabular-nums` on any number that changes.

## Colour and light

- Three roles: ground about 60% of the frame, surfaces about 30%, accent about 10%. The accent marks the one thing each beat is about.
- Build light in layers: a bloom behind the subject, a 1px top highlight on glass, a soft shadow below.
- Shadows in two layers, tinted with the ground hue: a tight contact shadow (`0 2px 6px`, 20%) and a wide ambient one (`0 30px 80px`, 15-25%).

## Product that looks real

- Real content: named people, plausible numbers (1,284 rather than 1,000), real timestamps, a status colour for each state.
- An 8px spacing grid inside UI. Nested radii match: outer radius = inner radius + padding.
- An icon from the scene kit sprite on every row and control.
- Crop into the product. A quarter of a dashboard at 2x reads richer than the whole thing at 0.5x.

## The close

The wordmark, one line and one call to action, on the same ground the film opened on, with the accent spent once.

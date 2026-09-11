---
name: scene-design
description: How a Motionly frame is designed and how beats hand off — built from the runtime scene kit so a generated film looks art-directed instead of default HTML on grey.
---

# Designing the frame

Motion cannot rescue a badly designed frame. The failure this pipeline keeps
producing is not bad choreography — it is small, low-contrast cards parked in the
corners of a flat stage, a table whose columns wrap under each other, and a stray
shape sliding across every cut.

The runtime now mounts a **scene kit** into every composition: a tested
stylesheet and an icon sprite that render grounds, glass, app windows, tables,
rows, controls, charts and type the way the reference films look. The kit
reference and complete beat templates follow this skill. Compose from them.

## What good looks like

The reference films share five qualities. Every beat should have all five.

1. **A lit ground.** Deep indigo with a glowing horizon, violet into teal, pale
   sky light, saturated brand blue, or a bright wallpaper under glass — never a
   flat page colour. The ground is one continuous surface for the whole film.
2. **One big subject, centred.** A headline, a product window, a proof card or a
   cluster of glass — filling roughly half to three quarters of the frame width.
   Big enough to read from across a room.
3. **Real product texture.** Icons, avatars, badges, status colour, numbers,
   named rows. An interface with no icons reads as a wireframe.
4. **Contrast you can see.** White type on deep grounds, deep ink on light ones.
   Nothing the viewer must read sits in a mid-grey on a mid-grey card.
5. **Three layers.** The ground, the subject, and something between them — a
   horizon, a bloom, a floating glass callout overlapping the window's edge.

## Choosing a theme

Match the product, not a default. AI, developer and data products sit on
`mk-theme-midnight` or `mk-theme-dusk`. Education, productivity and friendly
consumer tools sit on `mk-theme-sky` or `mk-theme-ocean`. Mobile and iOS-style
apps sit on `mk-theme-aurora` with glass.

Then re-colour to the real brand with `--mk-accent` and `--mk-accent-2` on the
stage. The accent is rationed: it belongs to the one thing each beat is about —
the active row, the live number, the call to action.

## Beats and cuts

Each beat is a transparent layer over the one ground. A cut hands the whole beat
off with `zoomThrough`, `inverseZoomThrough` or `cutTheCurve`, so the ground stays
continuous behind it: nothing flashes to black, nothing is left half-built, and
no substitute shape is needed to cover the cut.

- The seam's carrier is the outgoing beat itself, with `mechanism: "match-cut"`.
- Never invent a separate square, pill or dot to carry a transition. On screen it
  sits on top of the words and reads as a glitch.
- The ground drifts and breathes on its own. Never add circles, dots or blobs to
  decorate it, and never lay any shape over the words.

## Framing

- Centre the subject with `mk-center`. Asymmetry comes from what is inside the
  subject — a floating callout, an offset metric — not from pushing the subject
  into a corner.
- Never let the frame edge crop the subject. A window sliding in from off-frame
  is fine; a window that sits cut in half is not.
- Camera moves on a beat are gentle: a push of a few percent, a slow drift. Panning
  a camera world until the content lands in a corner empties the frame.

## Type

- The beat's claim uses `mk-display` or `mk-headline` — nothing smaller.
- One highlighted phrase per statement with `mk-gradient-text`.
- `mk-subtitle` carries a supporting line; `mk-label` and `mk-kicker` carry
  categories. Body copy is rare in a film: if it is a paragraph, cut it.

## What generic looks like

Redesign before animating if a beat has any of these:

- a hand-written ground, card or table instead of the kit's
- a flat stage colour with a single blurred circle on it
- the subject in a corner, or cropped by the frame edge
- the beat's main claim in anything smaller than `mk-headline`
- an interface with no icons, no badges, no avatars and no numbers
- a standalone shape carrying a transition, or a dot parked on the text
- a window, board or list with one or two items in it and the rest empty
- the accent colour on six things at once

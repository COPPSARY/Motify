---
name: scene-design
description: How a Motionly frame is designed — ground, material, palette, elevation, type and icons — so a generated film looks art-directed instead of like default HTML on grey.
---

# Designing the frame

Motion cannot rescue a badly designed frame. A film whose beats are small white
cards on `#f5f5f5` reads as unfinished no matter how well it moves, and that is
the most common thing wrong with generated output: the *choreography* is fine and
the *picture* is default.

Everything below is authored HTML and scoped CSS inside the composition. There is
no design system to import and no asset to fetch — the frame is built out of
`<div>`, `<svg>`, gradients and shadows, and every value here is one you type.

## 1. The ground is lit, never a page background

The single strongest signal of generic output is a flat near-white or flat dark
stage with one blurry blob floating on it. Real product films sit on a ground
that has direction, depth and colour temperature.

Pick one ground per film and commit:

**Deep gradient (default for product and AI films)** — the ground carries the
brand hue at low lightness, with a warm or cool pole so it is not uniform.

```css
.stage {
  background:
    radial-gradient(900px 600px at 22% 18%, rgba(99,102,241,.28), transparent 62%),
    radial-gradient(1100px 700px at 82% 76%, rgba(14,165,233,.20), transparent 66%),
    linear-gradient(168deg, #0b1020 0%, #0d1526 48%, #070a14 100%);
}
```

**Light architectural** — for calm, editorial or document products. Still not
white: it is a tinted paper with a soft directional wash.

```css
.stage {
  background:
    radial-gradient(1000px 680px at 78% 12%, rgba(59,130,246,.14), transparent 60%),
    linear-gradient(172deg, #f4f7fd 0%, #eaf0fa 55%, #e3ebf7 100%);
}
```

Two rules that hold for both:

- The gradient must have a **direction** — a light source at a stated corner —
  and every shadow in the frame falls away from it.
- A blurred blob is not a ground. If the only background element is one
  `filter: blur(120px)` circle on a flat fill, the frame is undesigned.

## 2. Material: glass, solid, and when each

Surfaces carry the design. Give every panel a material rather than
`background: white; border-radius: 8px`.

**Glass** — for overlays, floating controls, HUDs, anything reading as *above*
the scene. This is the liquid-glass / macOS look, and it only works over a ground
with content behind it.

```css
.glass {
  background: linear-gradient(
    150deg,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.04)
  );
  backdrop-filter: blur(28px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 22px;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.22) inset,
    0 24px 60px -16px rgba(3, 7, 18, 0.55);
}
```

The three parts that make glass read as glass — omit any one and it looks like a
grey box: the **inner top highlight**, the **1px light border**, and **real
content visible behind it**.

**Solid surface** — for the product UI itself: sidebars, tables, editors. Opaque,
so text on it stays crisp.

```css
.surface {
  background: linear-gradient(180deg, #131a2c, #0f1526);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  box-shadow: 0 32px 80px -24px rgba(2, 6, 16, 0.7);
}
```

Never put body text on glass. Glass holds a title, a control, a metric — reading
material goes on a solid surface.

## 3. Elevation is a ladder, not a value

Three levels, and a frame should show at least two so depth is legible.

| level | use | shadow |
| --- | --- | --- |
| resting | rows, chips, list items | `0 2px 6px -2px rgba(2,6,16,.35)` |
| raised | cards, panels | `0 18px 44px -14px rgba(2,6,16,.55)` |
| floating | the focal object, modals | `0 40px 100px -28px rgba(2,6,16,.72)` |

The focal object of a beat is always one level above everything else. That is
what makes the eye land, and it is cheaper and more reliable than a scale bump.

Add a **bloom** behind the focal object on dark grounds — a soft radial in the
accent hue at 18–28% alpha, sized about 1.6× the object. That is the glow in
every reference film, and it is a sibling element behind the object, never a
`box-shadow` in a bright colour.

## 4. Palette: one accent, derived from the product

Generic colour is the complaint. The cause is always the same: a purple-blue
gradient applied to a product that has nothing to do with purple.

Build the palette in this order:

1. **Accent** — one hue, taken from the real product if it has one (Linear
   indigo, Stripe violet, Notion near-black, a finance product's green). One
   accent per film.
2. **Ground** — the accent's hue at 8–14% lightness for dark, or 96–98% with a
   4–8% saturation tint for light. The ground is a *relative* of the accent, not
   a different story.
3. **Surface** — one or two steps up from the ground, same hue family.
4. **Text** — `rgba(255,255,255,.94)` primary and `rgba(255,255,255,.62)`
   secondary on dark; `#0b1220` and `rgba(11,18,32,.62)` on light.
5. **Semantics** — green `#10b981`, amber `#f59e0b`, red `#ef4444`, used only
   for actual status, never decoration.

Rules:

- The accent is **rationed**. It belongs to the one thing the beat is about — the
  active state, the live metric, the CTA. An accent on every card is no accent.
- Never place two saturated hues at equal weight. A second hue may appear at
  ≤20% of the accent's area, as support.
- Grey text on a grey card is the signature of undesigned output. Every text run
  needs a stated contrast relationship with the surface beneath it.

## 5. Type at 1920×1080

The canvas is a screen watched from across a room, not a page.

| role | size | weight | tracking |
| --- | --- | --- | --- |
| editorial statement | 68–96px | 700 | −0.02em |
| section title | 34–44px | 600 | −0.01em |
| UI title | 20–26px | 600 | 0 |
| body / row text | 15–18px | 400–500 | 0 |
| label / chip | 12–13px | 600 | 0.04em, uppercase |

Set `font-family` to a real stack — `"Inter", "SF Pro Display", system-ui,
-apple-system, "Segoe UI", sans-serif` — and never let a heading land under 28px.
A statement under ~45% of frame width reads as a caption, not a claim.

## 6. Icons, when the frame needs one

A product UI without icons looks like a wireframe. There is no icon library in
scope, so author them as inline `<svg>`: a 24×24 viewBox, `fill="none"`,
`stroke="currentColor"`, `stroke-width="1.75"`, round caps and joins. That single
spec produces a coherent set across the whole film.

- Draw the six or eight shapes the film actually needs — search, check, chart,
  bell, folder, user, arrow, sparkle. Simple geometry beats detail at this size.
- App-icon tiles are a rounded square (22% radius) with a soft gradient fill and
  the glyph in white, mirroring the reference: a coloured chip, not a photo.
- Never substitute an emoji for an icon, and never leave an empty square where an
  icon belongs.

## 7. Composition

- **One subject per beat.** The focal object occupies 25–60% of the frame. Below
  ~15% the frame reads as empty regardless of how many elements are in it.
- **Anchor to a structure.** Objects sit on a grid, connect with drawn lines, or
  group inside one panel with real mass. Three cards floating apart with nothing
  between them is the most-reported failure.
- **Asymmetry over centring.** A panel offset to one third with supporting
  material opposite reads as designed; everything centred reads as a slide.
- **Crop into things.** A product surface that runs off the frame edge feels
  larger than one floating with margin on all four sides.
- **Three visual layers**, matching the three motion layers: the ground, the
  subject, and something between them — a rail, a soft shape, a reflection. A
  frame with only ground and subject is the flat look.

## 8. What generic looks like

If the frame has any of these, redesign it before animating:

- flat `#fff` / `#f5f5f5` / `#111` ground with one blurred circle on it
- every panel the same size, same elevation, same radius, evenly spaced
- text at 28px or smaller carrying the film's main claim
- purple-to-blue gradient chosen with no relationship to the product
- an interface with no icons, no avatars, no chips, no status colour
- shadows that are `0 4px 6px rgba(0,0,0,.1)` on everything
- the accent colour used on six things at once

## 9. Foundation to start from

```css
.stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: "Inter", "SF Pro Display", system-ui, -apple-system, "Segoe UI", sans-serif;
  color: rgba(255, 255, 255, 0.94);
  background:
    radial-gradient(900px 600px at 22% 18%, rgba(99,102,241,.28), transparent 62%),
    radial-gradient(1100px 700px at 82% 76%, rgba(14,165,233,.20), transparent 66%),
    linear-gradient(168deg, #0b1020 0%, #0d1526 48%, #070a14 100%);
}
.bloom {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99,102,241,.42), transparent 68%);
  filter: blur(60px);
  pointer-events: none;
}
```

Keep every animated property to transforms and opacity. Gradients, blurs and
shadows are set once in CSS and left alone: tweening a `box-shadow` or a
`backdrop-filter` costs frames and buys nothing the eye can read.

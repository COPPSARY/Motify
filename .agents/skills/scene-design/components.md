# The scene kit

The runtime mounts a tested stylesheet and an icon sprite into every composition.
Build the film out of these classes. Do not hand-write CSS for grounds, surfaces,
windows, tables, rows, chips, buttons, charts or type — the kit already renders
them the way the reference films look, identically in preview and export, and a
hand-rolled version is where layouts break.

Your own scoped CSS is for positioning a beat's pieces and for one-off touches.
Never restyle a kit class.

---

## 1. Structure: one ground, beats on top

The whole film sits on one continuous, lit ground. Beats are transparent layers
that hand off to each other over it. This is what keeps transitions clean: when a
beat zooms or whips away, the ground is still there behind it — nothing ever cuts
to black, and nothing needs a stand-in shape to cover the cut.

```html
<template>
  <main class="mk-stage mk-theme-midnight" data-edit="stage">
    <div class="mk-horizon" data-edit="horizon"></div>

    <section data-scene="scene-01" data-edit="scene-01"> … </section>
    <section data-scene="scene-02" data-edit="scene-02"> … </section>
    <section data-scene="scene-03" data-edit="scene-03"> … </section>
  </main>
</template>
```

Handing off between beats — the outgoing beat is the seam's carrier:

```js
export function buildTimeline({ root, timeline, register }) {
  // Plain string concatenation, never a template literal: this code travels
  // inside a JSON string, and a mangled `${id}` produces an invalid selector
  // that stops the whole film.
  const beat = (id) => root.querySelector('[data-edit="' + id + '"]');
  const s1 = beat("scene-01"), s2 = beat("scene-02"), s3 = beat("scene-03");
  timeline.set([s2, s3], { autoAlpha: 0 }, 0);

  // …each beat's own entrances and holds…

  zoomThrough(timeline, { outgoing: s1, incoming: s2, at: 4.6, duration: 0.8 });
  cutTheCurve(timeline, { outgoing: s2, incoming: s3, at: 9.6, duration: 0.7, direction: "left" });

}
```

```json
"seams": [
  { "from": "scene-01", "to": "scene-02", "at": 4.6, "duration": 0.8, "carrier": "scene-01", "mechanism": "match-cut", "becomes": "the headline pushes through into the product" },
  { "from": "scene-02", "to": "scene-03", "at": 9.6, "duration": 0.7, "carrier": "scene-02", "mechanism": "match-cut", "becomes": "the window whips left and the proof lands on its vector" }
]
```

Rules that keep this working:

- Put every beat directly inside `mk-stage`. The kit makes each one a full-frame
  layer on its own; do not give beats a position, size or display of your own.
- Give each beat `data-edit` equal to its `data-scene` id, and name that id as
  the seam carrier.
- `zoomThrough` for a push forward, `inverseZoomThrough` for a pull back,
  `cutTheCurve` for a sideways whip. Alternate them; never use the same one three
  times running.
- **Never create a separate shape to carry a transition.** A small square, pill or
  dot dragged across the cut sits on top of the words and reads as a glitch.
- Never switch the whole `mk-stage` or its background off mid-film.

## 2. Themes

Pick one for the whole film from what the product is.

| class | looks like | for |
| --- | --- | --- |
| `mk-theme-midnight` | deep indigo, glowing horizon | AI, developer, data, security |
| `mk-theme-dusk` | violet into teal glow | SaaS launches, analytics, creative tools |
| `mk-theme-sky` | pale blue light, white UI | education, productivity, friendly consumer |
| `mk-theme-ocean` | saturated brand blue, white UI | explainers, onboarding, fintech |
| `mk-theme-aurora` | bright wallpaper, liquid glass | mobile apps, iOS-style consumer products |

Re-colour to the real product by setting `--mk-accent` and `--mk-accent-2` on the
`mk-stage` element: `style="--mk-accent:#5e6ad2;--mk-accent-2:#8b93ff"`.

The ground is already alive: the runtime drifts and breathes its light, sweeps a
band of light across it and raises the horizon over the film. Do not animate it,
and never decorate it with circles, dots or blobs.

Optional layers: `mk-horizon` for the glowing planet rim along the bottom (never
resize or reposition it), `mk-horizon mk-horizon-top` for an arc hanging from the
top, `mk-grid-lines` for a faint technical floor, and at most one `mk-glow`
directly behind the subject.

## 3. Framing

- Every beat's subject sits in the **centre** of the frame (`mk-center`) and fills
  **45–75% of the frame width**. Nothing parks in a corner, nothing is cut off by
  the frame edge.
- Type is never smaller than `mk-body` for anything the viewer must read.
- One idea per beat: a statement, *or* a product surface, *or* a proof.
- **Fill every surface you show.** A list holds 4–6 rows, a board column holds
  3–4 cards, a table holds 4–6 rows, a dashboard fills its content area. A window
  with one item in it reads as an empty window. If the beat is about one item,
  show that item large on its own card — not one item inside a big frame.

## 4. Icons

```html
<svg class="mk-icon"><use href="#mk-i-sparkle"/></svg>
```

The icon takes its size from `font-size` and its colour from `color`. Names:
home, inbox, search, bell, settings, user, users, chat, mail, calendar, folder,
file, chart, trend, pie, check, check-circle, x, plus, arrow, arrow-up-right,
sparkle, star, heart, lock, shield, bolt, globe, clock, play, mic, image, link,
tag, filter, grid, list, code, layers, dollar, card, cloud, cursor-arrow.

The clicking pointer: `<svg class="mk-cursor" style="left:…;top:…"><use href="#mk-cursor"/></svg>`.

---

## 5. Beat templates

Each template is a complete beat. Keep its structure, replace every word with
this film's content.

### Statement

```html
<section data-scene="scene-01" data-edit="scene-01">
  <div class="mk-center mk-vstack mk-middle" style="--gap:32px">
    <span class="mk-kicker" data-edit="kicker"><svg class="mk-icon"><use href="#mk-i-sparkle"/></svg> Introducing Relay AI</span>
    <h1 class="mk-display" data-edit="headline" style="width:1500px">Ship work at <span class="mk-gradient-text">machine speed</span></h1>
    <p class="mk-subtitle" data-edit="subline" style="width:1100px">Every request triaged, drafted and routed before your team opens Slack.</p>
  </div>
</section>
```

Motion: `editorialTextReveal` or `macroSettle` on the headline, the kicker and
subline rising in behind it.

### Prompt

```html
<div class="mk-center mk-vstack mk-middle" style="--gap:40px">
  <h2 class="mk-headline" data-edit="ask">Just ask.</h2>
  <div class="mk-input" data-edit="prompt">
    <span style="font-size:40px;color:var(--mk-accent)"><svg class="mk-icon"><use href="#mk-i-sparkle"/></svg></span>
    <span class="mk-input-text"><span data-edit="prompt-text">Summarize this week's escalations</span><span class="mk-caret" data-edit="caret"></span></span>
    <span class="mk-btn mk-btn-primary" data-edit="send">Generate <svg class="mk-icon"><use href="#mk-i-arrow"/></svg></span>
  </div>
</div>
```

Motion: type the prompt text letter by letter, press the button (`scalePop`),
then hand off.

### Product window

```html
<div class="mk-center">
  <div class="mk-window" data-edit="app-window">
    <div class="mk-window-bar"><span class="mk-dots"><i></i><i></i><i></i></span><span class="mk-window-title">app.relay.so</span></div>
    <div class="mk-window-body">
      <aside class="mk-sidebar">
        <div class="mk-brand"><span class="mk-brand-mark"><svg class="mk-icon"><use href="#mk-i-bolt"/></svg></span>Relay</div>
        <div class="mk-nav-item is-active"><svg class="mk-icon"><use href="#mk-i-inbox"/></svg> Inbox</div>
        <div class="mk-nav-item"><svg class="mk-icon"><use href="#mk-i-chart"/></svg> Insights</div>
        <div class="mk-nav-item"><svg class="mk-icon"><use href="#mk-i-users"/></svg> Team</div>
      </aside>
      <main class="mk-content">
        <div class="mk-toolbar">
          <h2 class="mk-title" data-edit="view-title">Inbox</h2>
          <span class="mk-seg"><span class="is-on">Open</span><span>Done</span></span>
        </div>
        <div class="mk-vstack" style="--gap:12px">
          <div class="mk-row is-active" data-edit="row-1">
            <span class="mk-icon-box"><svg class="mk-icon"><use href="#mk-i-lock"/></svg></span>
            <span class="mk-row-text"><span class="mk-row-title">Enterprise SSO rollout</span><span class="mk-row-sub">Requested by 142 accounts</span></span>
            <span class="mk-badge mk-badge-danger">Urgent</span>
          </div>
          <div class="mk-row" data-edit="row-2">
            <span class="mk-icon-box"><svg class="mk-icon"><use href="#mk-i-file"/></svg></span>
            <span class="mk-row-text"><span class="mk-row-title">Export to CSV and PDF</span><span class="mk-row-sub">Mentioned in 88 threads</span></span>
            <span class="mk-badge mk-badge-warning">Medium</span>
          </div>
        </div>
      </main>
    </div>
  </div>
</div>
```

Motion: the window rises in (`perspectiveCardReveal`), rows arrive with
`staggerEntrance`, the active row gets `punchIn`. Omit `mk-window-bar` for an
app that is not a desktop window. For a window without a sidebar, put
`mk-content` straight inside `mk-window`.

### Table

```html
<div class="mk-center mk-card" style="width:1400px">
  <div class="mk-table" style="--cols:1.6fr 1fr 2.2fr 0.9fr">
    <div class="mk-tr mk-th"><span>Request</span><span>Source</span><span>Latest comment</span><span>Status</span></div>
    <div class="mk-tr" data-edit="tr-1"><span>Export to CSV</span><span>Email</span><span>"Can we get this before Q4?"</span><span class="mk-badge mk-badge-warning">Buried</span></div>
    <div class="mk-tr" data-edit="tr-2"><span>Upload crash</span><span>Slack</span><span>"Crashes above 50MB"</span><span class="mk-badge mk-badge-danger">Lost</span></div>
  </div>
</div>
```

Set `--cols` to one track per column. Every row lines up on it and cannot wrap.

### Proof

```html
<div class="mk-center mk-grid" style="--cols:1.3fr 1fr;--gap:28px;width:1440px">
  <div class="mk-card mk-metric" data-edit="metric-card">
    <span class="mk-label">Comments organized</span>
    <div class="mk-hstack" style="--gap:18px"><span class="mk-metric-value" data-edit="metric-value">3,420</span><span class="mk-delta"><svg class="mk-icon"><use href="#mk-i-trend"/></svg> 18%</span></div>
    <div class="mk-bars" style="--h:200px" data-edit="bars"><i class="is-muted" style="--v:.35"></i><i class="is-muted" style="--v:.48"></i><i style="--v:.62"></i><i style="--v:.74"></i><i style="--v:.95"></i></div>
  </div>
  <div class="mk-card mk-hstack" style="--gap:30px" data-edit="ring-card">
    <div class="mk-ring" style="--v:.95" data-edit="ring"></div>
    <div class="mk-vstack" style="--gap:10px"><span class="mk-label">Resolved</span><span class="mk-metric-value">95%</span></div>
  </div>
</div>
```

Motion: count the value up with `stepSurgeCounter`; grow bars with
`fromTo(bars.children, { scaleY: 0 }, { scaleY: 1, stagger: 0.07, ease: EASE.arrive })`;
fill the ring with `fromTo(ring, { "--v": 0 }, { "--v": 0.95, ease: EASE.settle })`.
Other pieces: `mk-progress` (child `<i style="--v:.6">`), `mk-chart` around an
authored `<svg>` using `mk-chart-grid`, `mk-chart-area` and `mk-chart-line` paths.

### Glass (use on `mk-theme-aurora`)

```html
<div class="mk-center mk-vstack mk-middle" style="--gap:36px">
  <div class="mk-glass mk-toast" data-edit="toast">
    <span class="mk-tile mk-tile-blue"><svg class="mk-icon"><use href="#mk-i-mail"/></svg></span>
    <span class="mk-row-text"><span class="mk-row-title">Contract signed</span><span class="mk-row-sub">Ready for review</span></span>
  </div>
  <div class="mk-liquid mk-hstack" data-edit="glass-pill" style="padding:30px 64px;font-size:60px;font-weight:650;letter-spacing:-.02em;color:#08204f">Contact Management</div>
  <div class="mk-hstack" style="--gap:32px" data-edit="apps">
    <span class="mk-tile mk-tile-green"><svg class="mk-icon"><use href="#mk-i-chat"/></svg></span>
    <span class="mk-tile mk-tile-red"><svg class="mk-icon"><use href="#mk-i-heart"/></svg></span>
    <span class="mk-tile mk-tile-orange"><svg class="mk-icon"><use href="#mk-i-star"/></svg></span>
  </div>
</div>
```

Other glass pieces: `mk-glass` on any panel, `mk-widget` for a square home-screen
widget, `mk-toggle` (add `is-on`), `mk-seg`. Tile colours: `mk-tile-blue`,
`-green`, `-red`, `-orange`, `-purple`, `-pink`, `-teal`, `-dark`, `-white`.

### Brand close

```html
<div class="mk-center mk-vstack mk-middle" style="--gap:36px">
  <div class="mk-hstack" style="--gap:22px" data-edit="lockup">
    <span class="mk-brand-mark" style="width:96px;height:96px;border-radius:26px;font-size:48px"><svg class="mk-icon"><use href="#mk-i-bolt"/></svg></span>
    <span class="mk-display" style="font-size:112px">Relay</span>
  </div>
  <p class="mk-subtitle" data-edit="tagline">Stop sorting feedback. Start shipping it.</p>
  <span class="mk-btn mk-btn-primary" data-edit="cta">Start free trial <svg class="mk-icon"><use href="#mk-i-arrow"/></svg></span>
</div>
```

---

## 6. Other pieces

- Text: `mk-display`, `mk-headline`, `mk-title`, `mk-subtitle`, `mk-body`,
  `mk-label`, `mk-kicker`; accents `mk-gradient-text`, `mk-glow-text`,
  `mk-highlight`.
- Layout: `mk-center`, `mk-abs`, `mk-vstack`, `mk-hstack`, `mk-grid` (`--cols`,
  `--gap`), `mk-middle`, `mk-spread`.
- Surfaces: `mk-card`, `mk-glass`, `mk-liquid`, `mk-window`.
- Controls: `mk-btn` with `mk-btn-primary`, `mk-btn-light`, `mk-btn-ghost`;
  `mk-chip` (add `is-on`); `mk-badge` with `mk-badge-accent`, `-success`,
  `-warning`, `-danger`.
- People: `mk-avatar` (`--c1`, `--c2` gradient, initials inside) grouped in
  `mk-avatars`.
- Floating callouts over a window: `mk-glass mk-hstack mk-abs` with `left`/`top`.

---
name: write-raw-film
description: Author, check and ship a Motify raw film by hand - one self-contained HTML document drawn by window.seek(t), with its own soundtrack. Use when building or remaking a film directly (not through the agent), when a film feels choppy or has still frames, or when checking that a film exports the way it previews.
---

# Write a raw film

Every new Motify film is a raw film: one HTML document, no GSAP, that draws any moment with `window.seek(t)`. The editor mounts it in an iframe and calls `seek` on every frame of preview and export; `src/composition/raw-film.ts` is that boundary. The agent writes them from the backend skill `packages/motify-skills/motify-film/SKILL.md` in Motionly-Backend, which holds the full contract; this skill is the same craft for a person or an agent working by hand.

## The contract, short

- `window.DURATION = <seconds>`, `window.seek = (t) => { ... }`, `seek(0)` at load. `seek(t)` draws the whole frame from `t` alone: no state between calls, no timers, no `Math.random` (seed one), no network.
- 1920x1080 stage at `left:0; top:0`. Bundled families by name: Inter, Plus Jakarta Sans, Space Grotesk, Fraunces, JetBrains Mono, Oswald.
- Sound: `window.motifySoundtrack = (ctx) => { ... }` schedules a soundtrack on the `OfflineAudioContext` it is given. The editor renders it, plays it in step and mixes it into exports.
- Wrap the script in an IIFE: a top-level `let top` stops the whole film.

## What makes it read as finished

**Choose what carries each beat; it is rarely the UI.** Alternate statements with material:
- a sentence whose words converge onto one baseline inside bold abstract geometry
- a sentence over the product's real material (code, logs, rows) as tilted, soft texture under a drifting light leak
- one object doing one real thing (a terminal typing a real command)
- material at scale with depth (near items large and sharp, far ones smaller, softer and lagging)
- names becoming a system, and the mark the material resolves into

Neighbouring beats change scale and ground.

**Every move has a speed curve.**
- Arrivals go fast to slow, exits slow to fast, camera travel slow, fast, slow.
- A cut lands at peak speed: the outgoing shot accelerates into it, and the incoming shot leaves it moving the same way at the same speed, then settles (push in, then arrive still growing; whip up, then rise from below).
- Bridge with a 2-4 frame overlap, and blur only the outgoing side.
- Layer moves as independent terms (`base + arrive + creep + push`) instead of chaining keyframes: each eased-out segment stops dead, and that is what reads as choppy.

**No still frames.** Under every hold, keep a slow camera creep (2-5% scale a second) in the direction the scene arrived in, and one inner action going: a gradient flowing along a shape, code scrolling, a caret blinking.

**Surfaces stay alive cheaply:**
- move a gradient's `gradientTransform` along its axis
- give shapes thickness with an offset dark copy in one fixed screen direction
- sweep a light across a panel once, on its payoff
- put soft light on the ground behind the subject

**Render so it holds up:**
- `transform`, never `top`/`left`; slow scales to 5 decimals
- glows as pre-blurred layers that only change opacity, never an animated `box-shadow`
- SVG filters only while their effect runs, with a tight region
- `opacity` (not `visibility: visible`) on children of hidden scenes
- no blur on the incoming shot: its first paint is already the expensive frame

**Sound follows the picture:**
- a whoosh rises slow to fast into the cut it carries and decays after it, with an impact on the cut
- the sub swells on cuts instead of droning
- the chord changes at each cut
- key clicks per typed character, a pop and a bell on a state change, rising plucks as items arrive
- master: compressor, make-up gain, limiter, a fade over the last 0.4s, about -16 LUFS

## Check it before shipping

`npm run raw-film -- <film.html> <mode> [--out dir]` serves the film with its fonts as the editor declares them:

| Mode | What it tells you |
| --- | --- |
| `audio` | renders the soundtrack to `film.wav`: peak, clipped samples, loudness in LUFS |
| `export` | 12 live frames beside the same frames drawn through the export path (document serialized into an SVG `foreignObject`); every pair should match |
| `cost` | real-time cost per frame, two passes; spikes mark heavy first paints and blurs (headless runs on the CPU, so read where, not how much) |
| `video` | a 60fps MP4 with the soundtrack: the smooth reference to watch |
| `still` | on that MP4, frames that barely change: there should be no still frames |

Compare against the reference frame by frame (`ffmpeg -ss <t> -frames:v 1`) when remaking a film: framing, sizes and timing drift quietly.

To put a finished film into an account, use Motionly-Backend's `npm run film:import -- --email <account> --file film.html --name "<title>" --scenes scenes.json`. It validates the film the way the agent's films are validated and creates it in the account's personal workspace.

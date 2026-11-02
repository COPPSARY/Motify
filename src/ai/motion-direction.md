# Motion direction

Decide these before writing any markup or timeline. One line each, in the plan.

1. **Feeling** — the one thing the viewer should feel: trust, delight, urgency, calm, awe, confidence.
2. **Personality** — pick one and keep 90% of the film in it. Borrow another only for a single moment, such as the payoff.
3. **Signature** — one curve for most moves, three durations (quick / standard / slow), one entrance pattern. A film without these has no voice.
4. **Hero per beat** — the one thing the eye follows. It gets the largest move and the strongest curve. Everything else is quieter in every dimension.

## Personality

Durations are relative to the house medians in the measured house style. Personality sets everything except statement type, which keeps its word-by-word `back.out(1.35)` settle in every film.

| | duration | overshoot | paths | signature |
| --- | --- | --- | --- | --- |
| Playful | 0.8x | 10-20% | arcs, never straight | squash on impact, varied stagger |
| Premium | 1.2x | 0% | long smooth arcs, parallax | generous holds, few properties, `EASE.settle` |
| Precise | 1x | 0-3% | mostly straight | uniform stagger, clean stops |
| Energetic | 0.6x | 15-30% | diagonals, from the edges | 50-150% scale changes, accelerating stagger |

Common failures: overshoot above 25% looks broken; premium that is too subtle is invisible; energetic everywhere means nothing stands out.

## Every beat has three layers

| layer | amplitude | behaviour |
| --- | --- | --- |
| Primary | 100% | the action the viewer follows |
| Secondary | 30-50% | trails primary by 0.05-0.15s on a different curve: shadow, siblings, echo |
| Ambient | 10-20% | continuous, slow, `sine.inOut`, never asks for attention |

Primary alone reads as flat.

## Beat shape

Anticipation 15-20% (a small move opposite the main one) → action 30-40% → reaction 15-20% (shadows, siblings, environment respond) → resolution 25-30% (settle, then 0.15-0.3s of breath before the next beat).

## Choreography

- At most 2-3 elements in motion at once. Ambient does not count.
- One origin per beat. Mixed entry directions read as chaos.
- Counter-motion: the background moves against the hero at 20-30% of its speed. Depth by speed: foreground 1x, midground 0.5x, background 0.2x.
- Stagger varies start time only, never the curve. The last element may overshoot as punctuation.

## Direction, path and material carry meaning

- Up = growth. Right = progress. Inward = focus. Outward = emergence.
- Curved = friendly. Angular = tense. Diagonal = purposeful.
- Decide what the hero is made of and let that set its curve:

| material | duration | overshoot |
| --- | --- | --- |
| Rigid | 1.2x | 0% |
| Paper | 1x | 3-5% |
| Elastic | 0.8x | 15-25% |
| Fluid | 1.5x | 5% |
| Glass | 0.9x | 0% |
| Gas | 2x | 0% |

## Before shipping

- Robotic → uniform timing, everything synced, straight paths. Offset starts by 0.05-0.15s, add arcs.
- Flat → missing secondary or ambient layers, opacity-only reveals, the same curve everywhere.
- Distracting → competing heroes, ambient too loud.
- No voice → no signature curve, every duration the same.

Adapted from LottieFiles/motion-design-skill (MIT), rescaled from UI timing to film timing.

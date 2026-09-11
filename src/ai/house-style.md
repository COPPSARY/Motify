# Measured house style

These are measurements taken from the finished Motionly films authored by hand for this product — KiriTTS, recoup, relay, tessera. They are the standard a generation is held to.

The films are not shown to you and must not be reconstructed: their layouts, product chrome, copy and stories belong to them. What follows is how they *move*, which is what you are expected to match.

## What each curve is actually used at

Duration in seconds, across every tween in those films that pairs an `EASE` curve with a duration.

| curve | its job | uses | shortest | median | longest |
| --- | --- | --- | --- | --- | --- |
| `EASE.arrive` | something landing in place | 17 | 0.32s | 0.62s | 1.05s |
| `EASE.travel` | an object crossing the frame under its own direction | 15 | 0.5s | 1.2s | 1.5s |
| `EASE.depart` | something accelerating out of frame | 15 | 0.45s | 0.95s | 1.05s |
| `EASE.material` | a carrier's own outline changing | 8 | 0.75s | 1.17s | 1.6s |
| `EASE.settle` | an oversized element pulling back to rest | 6 | 0.95s | 1.15s | 1.4s |
| `EASE.cameraRamp` | a camera or world travelling a long way | 3 | 2.6s | 2.65s | 5.25s |

Read the medians as the default and the range as the room you have. A directed move that lands well outside its curve's range is usually the wrong curve rather than the wrong duration.

## Stagger

10 staggered tweens across those films run between 0.04s and 0.14s, median 0.09s. Word-by-word type sits at the low end of that; groups of cards or rows at the high end.

## What this implies

- Every directed move gets an `EASE` curve. The house films use them 64 times between them.
- Stock GSAP curves are for short tactile responses under about 0.4s, ambient drift on `sine.inOut`, and constant-rate readouts on `none`. A one-second travel on `power2.inOut` is the single most common way a generated film reads as flat.
- Reach for a preset when one matches the move. Hand-authored tweens on the right curve are equally house style — the authored films are mostly that.

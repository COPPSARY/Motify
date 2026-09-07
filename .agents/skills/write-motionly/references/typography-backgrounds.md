# Typography and background systems

## One thought, one hierarchy

Set one complete sentence at the dominant editorial size. Highlight a phrase within it by color, weight, or motion instead of demoting the rest into a subtitle.

Do not use oversized title plus microcopy, eyebrow + headline + body for one spoken line, stacked cards carrying sentence fragments, or unreadable secondary text. Secondary labels are valid only when they belong to a real interface, metric, source, or CTA.

## Split-text integrity

- Split after fonts load and dimensions are measurable.
- Make word spans `inline-block` while preserving whitespace inline.
- Keep punctuation with its word.
- Set stable width or `white-space` behavior before animation.
- Avoid letter-spacing or width changes that cause collisions.
- Reuse existing split spans; do not split them into overlapping copies.
- Test the longest sentence at the target aspect ratio.

## Continuous gradients

For split words, map every word to the parent sentence coordinates: measure the full width, share one gradient and background size, and offset each word by its position. Never restart `0% -> 100%` independently on every word.

## Select text motion by purpose

- Giant-to-settle: hooks, turns, and final promises.
- Word slide/rotate: conversational editorial lines.
- Character spring: short tactile objections or confirmations.
- 3D reveal: structured statements and typed content.
- Gradient sweep: one keyword or payoff, not every sentence.

Stagger in reading order and leave time after the last word for the full sentence to be read.

## Background direction

Build at most three roles: a tinted base field, one structural texture, and one local semantic accent attached to the carrier. Name the accent's job before authoring it. Useful jobs include `signal-path`, `paper-grid`, `scan-field`, `trajectory`, and `convergence-ring`; “make the frame less empty” is not a job.

The background needs an arc, not an idle loop:

1. Establish the structure with the hook.
2. Make the foreground action visibly disturb, extend, scan, or redirect it.
3. Reuse its line, energy, or geometry in the product proof.
4. Converge it into the final carrier or remove it cleanly.

Keep the semantic accent behind the subject. Lower its contrast and sharpness when text arrives. Avoid always-on auroras, mesh gradients, random particles, and unrelated orbit rings; these are common generation defaults, not automatic production value. If light is used, anchor it to a visible source and animate it only while that source performs.

## Stability

- Lock counters to fixed or tabular width.
- Constrain fixed-format stages explicitly.
- Keep settled text inside title-safe bounds.
- Giant entrances may crop; settled text may not.
- Remove obsolete clipping masks.
- Ensure filters sharpen fully at the readable state.

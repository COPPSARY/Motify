/**
 * Measures the authored house films and compiles what they do into the prompt.
 *
 * The pipeline deliberately withholds whole-film source from the model: a
 * complete example anchors it to that film's UI and story even when labelled
 * "reference only" (see `buildMotionlyUserMessage`), and `generation-basis.ts`
 * omits the foundation's markup for the same reason. That decision stands. But
 * it left the model with prose about quality and no measurement of it, while
 * seven finished films sat in `src/compositions/presets/` reachable only from
 * the editor's Presets tab.
 *
 * So this ships the craft and none of the content: which curve each kind of
 * move rides, how long moves actually last, how words are staggered. Numbers
 * and mechanics cannot be pasted into a generation as somebody else's product.
 *
 * Films select themselves. Any film using the `EASE` vocabulary is house style
 * and counts; the three authored before that vocabulary existed do not, and a
 * new film built the right way joins the reference automatically.
 */

/** Innermost `{ ... }` blocks: one tween's vars, whatever order they are in. */
function tweenBlocks(source) {
  return [...source.matchAll(/\{[^{}]{0,400}\}/g)].map((match) => match[0]);
}

function numeric(vars, key) {
  const match = new RegExp(`${key}\\s*:\\s*(\\d*\\.?\\d+)`).exec(vars);
  return match ? Number(match[1]) : null;
}

/** Ease -> the durations it is used at, across one film. */
function easeDurations(source) {
  const pairs = new Map();
  for (const vars of tweenBlocks(source)) {
    const ease = /ease\s*:\s*EASE\.(\w+)/.exec(vars);
    const duration = numeric(vars, "duration");
    if (!ease || duration === null) continue;
    const list = pairs.get(ease[1]) ?? [];
    list.push(duration);
    pairs.set(ease[1], list);
  }
  return pairs;
}

function staggerValues(source) {
  const values = [];
  for (const vars of tweenBlocks(source)) {
    const stagger = numeric(vars, "stagger");
    if (stagger !== null && stagger > 0) values.push(stagger);
  }
  return values;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value) {
  return Number(value.toFixed(2));
}

/**
 * Aggregates the measurement.
 * `films` is `[{ name, timeline }]`; those without `EASE` usage are dropped.
 */
export function measureHouseStyle(films) {
  const house = films.filter((film) => /\bEASE\.\w+/.test(film.timeline));
  const byEase = new Map();
  const staggers = [];
  for (const film of house) {
    for (const [ease, durations] of easeDurations(film.timeline)) {
      const list = byEase.get(ease) ?? [];
      list.push(...durations);
      byEase.set(ease, list);
    }
    staggers.push(...staggerValues(film.timeline));
  }
  const curves = [...byEase.entries()]
    .map(([ease, durations]) => ({
      ease,
      uses: durations.length,
      min: round(Math.min(...durations)),
      median: round(median(durations)),
      max: round(Math.max(...durations)),
    }))
    .sort((a, b) => b.uses - a.uses);
  return {
    films: house.map((film) => film.name),
    curves,
    stagger: staggers.length
      ? {
          uses: staggers.length,
          min: round(Math.min(...staggers)),
          median: round(median(staggers)),
          max: round(Math.max(...staggers)),
        }
      : null,
  };
}

/** What each curve is for, so the numbers are not read as arbitrary. */
const CURVE_JOBS = {
  cameraRamp: "a camera or world travelling a long way",
  travel: "an object crossing the frame under its own direction",
  material: "a carrier's own outline changing",
  arrive: "something landing in place",
  depart: "something accelerating out of frame",
  settle: "an oversized element pulling back to rest",
};

export function buildHouseStyle(films) {
  const measured = measureHouseStyle(films);
  if (measured.curves.length === 0) return "";
  const lines = [
    "# Measured house style",
    "",
    "These are measurements taken from the finished Motionly films authored by hand for this product — " +
      measured.films.join(", ") +
      ". They are the standard a generation is held to.",
    "",
    "The films are not shown to you and must not be reconstructed: their layouts, product chrome, copy and stories belong to them. What follows is how they *move*, which is what you are expected to match.",
    "",
    "## What each curve is actually used at",
    "",
    "Duration in seconds, across every tween in those films that pairs an `EASE` curve with a duration.",
    "",
    "| curve | its job | uses | shortest | median | longest |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const curve of measured.curves) {
    lines.push(
      `| \`EASE.${curve.ease}\` | ${CURVE_JOBS[curve.ease] ?? "a directed move"} | ${curve.uses} | ${curve.min}s | ${curve.median}s | ${curve.max}s |`,
    );
  }
  lines.push(
    "",
    "Read the medians as the default and the range as the room you have. A directed move that lands well outside its curve's range is usually the wrong curve rather than the wrong duration.",
  );
  if (measured.stagger) {
    lines.push(
      "",
      "## Stagger",
      "",
      `${measured.stagger.uses} staggered tweens across those films run between ${measured.stagger.min}s and ${measured.stagger.max}s, median ${measured.stagger.median}s. Word-by-word type sits at the low end of that; groups of cards or rows at the high end.`,
    );
  }
  lines.push(
    "",
    "## What this implies",
    "",
    "- Every directed move gets an `EASE` curve. The house films use them " +
      `${measured.curves.reduce((total, curve) => total + curve.uses, 0)} times between them.`,
    "- Stock GSAP curves are for short tactile responses under about 0.4s, ambient drift on `sine.inOut`, and constant-rate readouts on `none`. A one-second travel on `power2.inOut` is the single most common way a generated film reads as flat.",
    "- Reach for a preset when one matches the move. Hand-authored tweens on the right curve are equally house style — the authored films are mostly that.",
  );
  return lines.join("\n");
}

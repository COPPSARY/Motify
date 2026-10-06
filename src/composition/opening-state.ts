/**
 * Tween vars that configure the tween rather than name a property it animates.
 */
const CONFIG_KEYS = new Set([
  "duration",
  "delay",
  "ease",
  "stagger",
  "repeat",
  "repeatDelay",
  "repeatRefresh",
  "yoyo",
  "yoyoEase",
  "overwrite",
  "immediateRender",
  "lazy",
  "runBackwards",
  "startAt",
  "id",
  "data",
  "paused",
  "reversed",
  "inherit",
  "parent",
  "callbackScope",
  "keyframes",
  "onStart",
  "onStartParams",
  "onUpdate",
  "onUpdateParams",
  "onComplete",
  "onCompleteParams",
  "onRepeat",
  "onRepeatParams",
  "onReverseComplete",
  "onReverseCompleteParams",
  "onInterrupt",
  "onInterruptParams",
]);

/** Shorthand properties that write the same underlying channel as another. */
const CHANNELS: Record<string, readonly string[]> = {
  autoAlpha: ["opacity", "visibility"],
  scale: ["scaleX", "scaleY"],
  rotate: ["rotation"],
  rotationZ: ["rotation"],
  translateX: ["x"],
  translateY: ["y"],
};

const EPSILON = 1e-6;

type Claim = { start: number; tween: gsap.core.Tween | null };

function channelsOf(key: string): readonly string[] {
  return CHANNELS[key] ?? [key];
}

function propertyKeys(vars: object | undefined): string[] {
  return vars ? Object.keys(vars).filter((key) => !CONFIG_KEYS.has(key)) : [];
}

/** Where a nested tween starts on the root timeline. */
function startOn(tween: gsap.core.Animation, root: gsap.core.Timeline): number {
  let start = tween.startTime();
  let parent = tween.parent;
  while (parent && parent !== root) {
    start = parent.startTime() + start / (parent.timeScale() || 1);
    parent = parent.parent;
  }
  return start;
}

/**
 * The start values a tween defers until its own start time, or undefined when
 * it renders them as soon as it is created.
 */
function deferredFromVars(
  tween: gsap.core.Tween,
): Record<string, unknown> | undefined {
  const vars = tween.vars as Record<string, unknown>;
  if (vars["immediateRender"] !== false || tween.duration() <= 0) return;
  const startAt = vars["startAt"];
  if (startAt && typeof startAt === "object")
    return startAt as Record<string, unknown>;
  // A `from()` keeps its start values in its own vars and plays them backwards.
  if (vars["runBackwards"]) {
    return Object.fromEntries(
      propertyKeys(vars).map((key) => [key, vars[key]]),
    );
  }
  return undefined;
}

/**
 * Applies the opening state of every entrance that waits for its own start.
 *
 * `fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, immediateRender: false }, 2)`
 * keeps scrubbing deterministic, but it leaves `el` at its plain CSS state —
 * fully visible — from 0s until 2s, then snaps it hidden and fades it in. On
 * screen that is a flash of every element before its own entrance. When such a
 * tween is the first thing on the timeline to touch a property of its target,
 * that property's start value is the target's opening state, so it is set at 0
 * the same way an authored `timeline.set(el, …, 0)` would.
 *
 * A property some earlier (or simultaneous) tween already owns is left alone:
 * the author decided its opening state.
 */
export function primeDeferredOpeningStates(
  timeline: gsap.core.Timeline,
): number {
  const tweens = timeline
    .getChildren(true, true, false)
    .filter(
      (child): child is gsap.core.Tween => "targets" in child,
    ) as gsap.core.Tween[];

  // The earliest claim on every channel of every target.
  const claims = new Map<object, Map<string, Claim>>();
  for (const tween of tweens) {
    const start = startOn(tween, timeline);
    const vars = tween.vars as Record<string, unknown>;
    const startAt = vars["startAt"] as object | undefined;
    const channels = new Set(
      [...propertyKeys(vars), ...propertyKeys(startAt)].flatMap(channelsOf),
    );
    for (const target of tween.targets() as object[]) {
      let perTarget = claims.get(target);
      if (!perTarget) claims.set(target, (perTarget = new Map()));
      for (const channel of channels) {
        const current = perTarget.get(channel);
        if (!current || start < current.start - EPSILON) {
          perTarget.set(channel, { start, tween });
        } else if (
          Math.abs(start - current.start) <= EPSILON &&
          current.tween !== tween
        ) {
          // Two tweens open the same channel together: neither decides alone.
          perTarget.set(channel, { start, tween: null });
        }
      }
    }
  }

  let primed = 0;
  for (const tween of tweens) {
    const from = deferredFromVars(tween);
    if (!from) continue;
    const targets = tween.targets() as object[];
    targets.forEach((target, index) => {
      const perTarget = claims.get(target);
      const opening: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(from)) {
        if (CONFIG_KEYS.has(key)) continue;
        // A relative or random start resolves against the value at the
        // tween's own start; applying it early would offset it twice.
        if (typeof value === "string" && /^[+\-*/]=|random\(/.test(value))
          continue;
        const owned = channelsOf(key).every(
          (channel) => perTarget?.get(channel)?.tween === tween,
        );
        if (!owned) continue;
        opening[key] =
          typeof value === "function"
            ? (value as (i: number, t: object, all: object[]) => unknown)(
                index,
                target,
                targets,
              )
            : value;
      }
      if (Object.keys(opening).length === 0) return;
      timeline.set(target, opening, 0);
      primed += 1;
    });
  }
  return primed;
}

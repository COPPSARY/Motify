import { EASE, editorialTextReveal, morph } from "../../../composition/presets";

/**
 * Recoup, 26 seconds. A liquid-glass SaaS ad shot on a real 3D camera.
 *
 * GRAMMAR: a statement owns its frame, or the interface owns its frame. Never
 * both. A headline over a product shot with a second label underneath is slide
 * layout, not advertising — so the two statements here play to an empty stage,
 * and the three product beats carry no floating copy at all. Facts that belong
 * to the account (how long it has gone unpaid, what state it is in) live
 * inside the interface, because that is where a user would actually read them.
 *
 * Every pane is glass: a translucent plate whose face carries a soft elliptical
 * hotspot at `--lx`/`--ly` and whose bevel is lit directionally by `--a`. Both
 * are driven for the whole film, so light slides across a surface as it turns.
 * A linear band across the face would only ever read as a wiper blade.
 *
 * The camera is one `preserve-3d` rig (`rcpCam`) making four real moves: a
 * dolly, a fly-through, a hard push, and an orbit. Panes live at authored
 * depths from z 120 to z -1750 and the rig's own z carries the viewer through
 * them; nothing fakes depth with scale, and a floor grid inside the rig is
 * what makes those moves legible.
 *
 * THE STORY: Nordvik Studio is an account, and its state is the spine.
 * Active -> Past due the instant the card is refused -> Suspended while two
 * weeks pass and the money sits stuck -> Active again on the frame the third
 * retry clears. The payoff is not the charge going through; it is the customer
 * not being lost.
 *
 * The carrier chain: one declined charge becomes a corridor of declined
 * charges, absorbs them and recedes for the pitch, returns and turns 180
 * degrees to reveal the retry running on its other face, opens into the
 * month's recovery, and folds into the mark. `rcpCard` is that carrier — a
 * sibling of every scene, so no beat's clear can take it.
 *
 * Scale rhythm: huge type -> 40% plates in depth -> huge type -> 80% macro ->
 * 63% panel -> the mark. No two adjacent beats match.
 *
 * The four amounts total $7,410, the recovered figure is $6,795, and the rate
 * is the quotient of the two. The arithmetic agrees with itself.
 */
export function buildRecoupTimeline({ root, timeline: t, register }) {
  const get = (id) => root.querySelector(`[data-edit="${id}"]`);
  root
    .querySelectorAll("[data-edit]")
    .forEach((el) => register(el.dataset.edit, el));

  const cam = get("rcpCam");
  const card = get("rcpCard");
  const total = get("rcpTotalPane");
  const plates = ["B", "C", "D"].map((n) => get("rcpPlate" + n));
  const faces = {
    charge: get("rcpChargeFace"),
    retry: get("rcpRetryFace"),
    result: get("rcpResultFace"),
    brand: get("rcpBrandFace"),
  };
  const key = get("rcpKey");
  const rim = get("rcpRim");
  const grid = get("rcpGrid");
  const attempts = ["A", "B", "C"].map((n) => get("rcpAttempt" + n));
  const sweeps = ["A", "B", "C"].map((n) => get("rcpSweep" + n));
  const statuses = ["A", "B", "C"].map((n) => get("rcpStatus" + n));
  const bars = [...get("rcpChart").children];
  const stateActive = get("rcpStateActive");
  const statePast = get("rcpStatePast");
  const stateSusp = get("rcpStateSusp");
  const glassSkins = [...root.querySelectorAll(".lg-spec, .lg-edge")];
  const cardSkins = card.querySelectorAll(".lg-spec, .lg-edge");
  const cardFace = card.querySelectorAll(".lg-spec");

  /* ---- local vocabulary ------------------------------------------------ */

  const place = (el, extra = {}) =>
    t.set(el, { xPercent: -50, yPercent: -50, ...extra }, 0);

  /** The camera rig. Ramps for every move; sine only for drift. */
  const look = (at, vars, duration = 1.4, ease = EASE.cameraRamp) =>
    t.to(cam, { ...vars, duration, ease }, at);

  /** The carrier's own outline changing — the only shape that morphs. */
  const shape = (styles, at, duration = 1.2) =>
    morph(t, card, styles, { at, duration, ease: EASE.material });

  /** Light on a pane: `--a` aims the bevel, `--lx` slides the face hotspot. */
  const relight = (el, to, at, duration = 1.2, ease = EASE.material) =>
    t.to(el, { "--a": to, duration, ease }, at);
  const movelight = (el, lx, at, duration = 1.2, ease = EASE.material) =>
    t.to(el, { "--lx": lx + "%", duration, ease }, at);

  const faceOut = (el, at, duration = 0.45) =>
    t.to(el, { autoAlpha: 0, duration, ease: EASE.depart }, at);
  const faceIn = (el, at, duration = 0.55) =>
    t.to(el, { autoAlpha: 1, duration, ease: EASE.arrive }, at);

  const leave = (el, at, to = {}, duration = 0.55) =>
    t.to(el, { ...to, autoAlpha: 0, duration, ease: EASE.depart }, at);

  const words = (el, at, extra = {}) =>
    editorialTextReveal(t, el, {
      at,
      duration: 0.46,
      stagger: 0.085,
      distance: 26,
      blur: 3,
      ...extra,
    });

  /** A statement arrives cropped by both frame edges and pulls back to reading
   *  size, resolving focus before it stops moving. */
  const statement = (el, at) => {
    t.set(el, { scale: 2.8, filter: "blur(8px)" }, 0);
    t.to(el, { autoAlpha: 1, duration: 0.22, ease: "power2.out" }, at);
    t.to(el, { filter: "blur(0px)", duration: 0.44, ease: "power4.out" }, at + 0.12);
    t.to(el, { scale: 1, duration: 0.95, ease: EASE.settle }, at + 0.86);
    t.to(el, { scale: 1.02, duration: 1.6, ease: "sine.inOut" }, at + 2.1);
  };

  /** Money reads as money: grouped thousands, fixed decimals, tabular. */
  const count = (el, to, at, { prefix = "", suffix = "", decimals = 0 } = {}) => {
    if (!el) return;
    const state = { v: 0 };
    const write = () =>
      (el.textContent =
        prefix +
        state.v.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }) +
        suffix);
    write();
    t.fromTo(
      state,
      { v: 0 },
      { v: to, duration: 1.4, ease: EASE.settle, onUpdate: write },
      at,
    );
  };

  /* ---- opening state, all of it at t=0 --------------------------------- */

  t.set(cam, { x: 0, y: 0, z: 0, rotationY: 3, rotationX: -1, transformOrigin: "50% 50%" }, 0);
  t.set(glassSkins, { "--a": 116, "--s": 1, "--lx": 22, "--ly": 2 }, 0);

  place(card, { x: -355, y: -250, z: -1500, rotationY: 16, rotationX: -2 });
  place(plates[0], { x: 430, y: -80, z: -920, rotationY: -16, rotationX: 4 });
  place(plates[1], { x: -400, y: 130, z: -1280, rotationY: 14, rotationX: -3, filter: "blur(2px)" });
  place(plates[2], { x: 480, y: -350, z: -1750, rotationY: -12, rotationX: 5, filter: "blur(4px)" });
  place(total, { x: 430, y: 290, z: -300, rotationY: -18, rotationX: 3 });

  t.set([...plates, total, faces.retry, faces.result, faces.brand], { autoAlpha: 0 }, 0);
  t.set(card, { autoAlpha: 0 }, 0);
  t.set(
    [
      get("rcpLeakLine"),
      get("rcpPitchLine"),
      get("rcpWordmark"),
      get("rcpClose"),
      get("rcpCta"),
      ...sweeps,
      ...statuses,
      statePast,
      stateSusp,
      get("rcpRetryActive"),
    ],
    { autoAlpha: 0 },
    0,
  );

  place(get("rcpLeakLine"), { y: -40 });
  place(get("rcpPitchLine"), { y: -40 });
  place(get("rcpWordmark"), { y: 62 });
  place(get("rcpClose"), { y: 196 });
  place(get("rcpCta"), { y: 336 });
  t.set(get("rcpCheck"), { strokeDasharray: 1, strokeDashoffset: 1 }, 0);
  t.set(bars, { scaleY: 0 }, 0);
  t.set(attempts, { autoAlpha: 0, x: -30 }, 0);

  /* ---- the ground, for the whole film ---------------------------------- */

  t.set(grid, { rotationX: 74, y: 520, z: -820, opacity: 0.78 }, 0);
  t.set(key, { backgroundColor: "#8A2748", opacity: 0.44 }, 0);
  // Ambient drift genuinely is ambient, so sine belongs here and nowhere else.
  t.to(key, { x: 150, y: 90, duration: 13, ease: "sine.inOut" }, 0);
  t.to(key, { x: -60, y: -50, duration: 12, ease: "sine.inOut" }, 13);
  t.to(rim, { x: -180, y: 130, duration: 15, ease: "sine.inOut" }, 0);
  // Loss is a magenta key. On the frame the retry clears it becomes the brand
  // green, and the floor lights up with it.
  t.to(key, { backgroundColor: "#0F7A55", opacity: 0.56, duration: 1.5, ease: EASE.material }, 16.2);
  t.to(grid, { opacity: 1, duration: 1.6, ease: EASE.material }, 16.2);
  t.to(grid, { opacity: 0.8, duration: 3.0, ease: "sine.inOut" }, 18.6);

  /* ---- 01 / 0-4.2 — THE STATEMENT. Nothing else in the frame. ---------- */

  statement(get("rcpLeakLine"), 0.06);
  look(0.1, { z: 200, rotationY: -2 }, 2.3);
  t.to(cam, { z: 228, duration: 1.4, ease: "sine.inOut" }, 2.4);

  /* ---- seam 01>02 / 3.6-4.8 — the camera flies through the statement --- */

  // MATCH-CUT in depth: the line does not fade, it passes the lens. The dolly
  // already running accelerates, the type travels toward the viewer on that
  // same axis and defocuses as it goes by, and the corridor it emerges into is
  // the next beat's material — already arriving before the cut.
  t.to(
    get("rcpLeakLine"),
    { scale: 5.2, filter: "blur(26px)", autoAlpha: 0, duration: 1.05, ease: EASE.depart },
    3.6,
  );
  look(3.7, { z: 560, rotationY: 2 }, 1.5);
  t.to(
    card,
    { autoAlpha: 1, z: -560, rotationY: 12, duration: 1.2, ease: EASE.travel },
    3.75,
  );
  plates.forEach((plate, i) =>
    t.to(plate, { autoAlpha: 1, duration: 0.6, ease: EASE.arrive }, 4.0 + i * 0.14),
  );
  relight(glassSkins, 58, 3.9, 1.6);
  movelight(glassSkins, 34, 3.9, 1.6);

  /* ---- 02 / 4.2-10.5 — THE PROBLEM. Interface only, no copy over it. --- */

  // The charge is refused, and the account falls out of good standing on that
  // same frame. The consequence is shown, not asserted in a caption.
  t.to(card, { rotationY: 4, duration: 0.09, repeat: 5, yoyo: true, ease: "sine.inOut" }, 5.1);
  t.to(stateActive, { autoAlpha: 0, duration: 0.26, ease: "power2.out" }, 5.24);
  t.fromTo(
    statePast,
    { autoAlpha: 0, scale: 0.86 },
    { autoAlpha: 1, scale: 1, duration: 0.36, ease: "back.out(2)", immediateRender: false },
    5.3,
  );

  t.to(total, { autoAlpha: 1, duration: 0.6, ease: EASE.arrive }, 5.9);
  count(get("rcpRiskValue"), 7410, 6.2, { prefix: "$" });
  count(get("rcpElapsedValue"), 14, 7.4, { prefix: "DAY " });

  // Drift along the corridor: the panes parallax because they are genuinely at
  // different depths, and the floor underneath makes that legible.
  look(5.0, { z: 680, x: -20, rotationY: 5, rotationX: 1 }, 2.2);
  plates.forEach((plate, i) =>
    t.to(plate, { rotationY: `+=${i % 2 ? 6 : -6}`, duration: 4.4, ease: "sine.inOut" }, 5.4),
  );
  relight(glassSkins, 156, 5.6, 2.6);
  movelight(glassSkins, 72, 5.6, 2.6);

  // Every charge fails in turn — the claim is that this happens over and over,
  // so the beat shows it happening rather than holding a finished number.
  [card, ...plates].forEach((pane, i) => {
    t.to(pane, { borderColor: "#FF6B8A6B", duration: 0.22, ease: "power2.out" }, 7.7 + i * 0.42);
    t.to(pane, { borderColor: "rgba(255,255,255,0.09)", duration: 0.5, ease: "power2.inOut" }, 7.97 + i * 0.42);
  });
  // Two weeks in, the account is suspended. This is the stake the film turns on.
  t.to(statePast, { autoAlpha: 0, duration: 0.26, ease: "power2.out" }, 8.9);
  t.fromTo(
    stateSusp,
    { autoAlpha: 0, scale: 0.86 },
    { autoAlpha: 1, scale: 1, duration: 0.36, ease: "back.out(2)", immediateRender: false },
    8.96,
  );
  t.to(cam, { z: 712, rotationY: 3, duration: 1.4, ease: EASE.travel }, 8.4);

  /* ---- seam 02>03 / 9.9-11.1 — the corridor collapses, the stage clears */

  // The carrier takes the other three charges' mass along z, then keeps
  // travelling back so the next frame belongs to the statement alone.
  plates.forEach((plate, i) =>
    t.to(
      plate,
      { x: 0, y: 0, z: -700, scale: 0.14, autoAlpha: 0, duration: 0.8, ease: EASE.depart },
      9.9 + i * 0.07,
    ),
  );
  t.to(total, { x: 0, y: 0, z: -700, scale: 0.14, autoAlpha: 0, duration: 0.8, ease: EASE.depart }, 9.95);
  t.to(card, { x: 0, y: 0, z: -700, rotationX: 0, duration: 0.85, ease: EASE.travel }, 9.9);
  t.to(card, { z: -3000, autoAlpha: 0.1, duration: 1.0, ease: EASE.depart }, 10.5);
  look(9.95, { z: 900, x: 0, rotationY: 0, rotationX: 0 }, 1.4);

  /* ---- 03 / 10.5-12.4 — THE PITCH. Nothing else in the frame. --------- */

  // Not a second giant-to-settle: that move needs about 1.5s to land and this
  // frame is 1.9s long, so the line would still be oversized as it left. The
  // turn in the argument gets its own move — word by word at reading size,
  // which also stops the two statements playing as a repeat.
  t.set(get("rcpPitchLine"), { scale: 1 }, 0);
  t.to(get("rcpPitchLine"), { autoAlpha: 1, duration: 0.2 }, 10.62);
  words(get("rcpPitchLine"), 10.68, { stagger: 0.075, distance: 34, duration: 0.5 });
  t.to(get("rcpPitchLine"), { scale: 1.03, duration: 1.5, ease: "sine.inOut" }, 10.9);

  /* ---- seam 03>04 / 11.8-13.1 — the carrier returns, and turns -------- */

  t.to(
    get("rcpPitchLine"),
    { scale: 4.4, filter: "blur(22px)", autoAlpha: 0, duration: 0.95, ease: EASE.depart },
    11.85,
  );
  t.to(card, { z: -700, autoAlpha: 1, duration: 0.9, ease: EASE.travel }, 11.8);

  // THE FLIP. A real 180-degree turn, not a cross-fade: the pane rotates away
  // to edge-on, and on the frame it is a line — zero width, nothing to see —
  // the rig is reset to the opposite 90 and the incoming face turns toward the
  // viewer. One continuous rotation to the eye, and no face is ever mirrored.
  t.to(card, { rotationY: -90, duration: 0.6, ease: "power2.in" }, 11.95);
  t.set(card, { rotationY: 90 }, 12.55);
  t.to(card, { rotationY: 0, duration: 0.6, ease: "power3.out" }, 12.55);
  faceOut(faces.charge, 12.49, 0.12);
  faceIn(faces.retry, 12.58, 0.3);
  shape({ width: 1180, height: 500, borderRadius: 44 }, 12.05, 1.1);
  // Light rakes across the surface as it turns — the whole point of glass.
  relight(cardSkins, 470, 11.95, 1.3, "power2.inOut");
  movelight(cardFace, 16, 11.95, 1.3, "power2.inOut");
  // The hard push. This is the closest the camera gets in the film.
  look(11.9, { z: 1150 }, 1.6);

  /* ---- 04 / 12.4-18.6 — THE MECHANISM. Interface only. ---------------- */

  // The whole schedule is on screen from the start, so the pane is never a
  // half-empty plate. What resolves over time is each attempt's outcome: the
  // row is swept, and only then does it settle. Two decline. The third clears.
  attempts.forEach((row, i) =>
    t.to(row, { autoAlpha: 1, x: 0, duration: 0.42, ease: EASE.arrive }, 13.0 + i * 0.09),
  );
  const tryAt = [13.45, 14.5, 15.55];
  attempts.forEach((row, i) => {
    const at = tryAt[i];
    t.fromTo(
      sweeps[i],
      { xPercent: -108, autoAlpha: 1 },
      { xPercent: 108, duration: 0.62, ease: "power2.inOut", immediateRender: false },
      at,
    );
    t.to(sweeps[i], { autoAlpha: 0, duration: 0.16 }, at + 0.54);
    t.fromTo(
      statuses[i],
      { autoAlpha: 0, x: 14 },
      { autoAlpha: 1, x: 0, duration: 0.32, ease: EASE.arrive, immediateRender: false },
      at + 0.48,
    );
    if (i !== 2) {
      t.to(row, { backgroundColor: "#FF6B8A1F", duration: 0.18, ease: "power2.out" }, at + 0.46);
      t.to(row, { backgroundColor: "#FFFFFF0F", duration: 0.7, ease: "power2.inOut" }, at + 0.68);
    }
  });

  // The third clears. Every green thing in the film starts on this frame.
  t.to(attempts[2], { backgroundColor: "#41E39B26", duration: 0.4 }, 16.05);
  t.to(get("rcpCheck"), { strokeDashoffset: 0, duration: 0.45, ease: EASE.arrive }, 16.05);
  t.to(get("rcpRetryAmount"), { color: "#5BF0AE", duration: 0.45 }, 16.18);
  // What the film has actually been about: the customer is not lost.
  t.to(get("rcpRetrySusp"), { autoAlpha: 0, duration: 0.24, ease: "power2.out" }, 16.26);
  t.fromTo(
    get("rcpRetryActive"),
    { autoAlpha: 0, scale: 0.82 },
    { autoAlpha: 1, scale: 1, duration: 0.44, ease: "back.out(2.2)", immediateRender: false },
    16.34,
  );
  // The pane catches the win: one bright pass of light across the glass.
  t.to(get("rcpCardSpec"), { "--s": 1.5, duration: 0.26, ease: "power2.out" }, 16.05);
  t.to(get("rcpCardSpec"), { "--s": 1, duration: 1.0, ease: "power2.inOut" }, 16.35);
  relight(cardSkins, 588, 16.0, 1.7);
  movelight(cardFace, 62, 16.0, 1.7);
  // Never still, and a small push on the frame the charge clears.
  t.to(card, { rotationY: 5, rotationX: -2, duration: 2.6, ease: "sine.inOut" }, 13.1);
  t.to(card, { rotationY: -3, duration: 2.2, ease: "sine.inOut" }, 16.2);
  t.to(cam, { z: 1212, duration: 2.4, ease: "sine.inOut" }, 13.2);
  look(16.0, { z: 1268, rotationY: -2 }, 1.1, EASE.arrive);

  /* ---- seam 04>05 / 17.95-19.25 — the charge opens into the month ----- */

  attempts.forEach((row, i) =>
    t.to(row, { y: -26, autoAlpha: 0, duration: 0.45, ease: EASE.depart }, 18.0 + i * 0.05),
  );
  shape({ width: 1340, height: 620, borderRadius: 48 }, 18.05, 1.2);
  faceOut(faces.retry, 18.4);
  faceIn(faces.result, 18.6);
  // Pull back and start the orbit in one continuous move.
  look(17.95, { z: 640, rotationY: -13, rotationX: 3 }, 1.6);
  relight(glassSkins, 700, 18.0, 1.8);
  movelight(glassSkins, 30, 18.0, 1.8);

  /* ---- 05 / 18.6-22.4 — THE PROOF. Interface only. -------------------- */

  const heights = [0.22, 0.3, 0.26, 0.38, 0.44, 0.4, 0.53, 0.6, 0.57, 0.73, 0.86, 1];
  bars.forEach((bar, i) =>
    t.to(bar, { scaleY: heights[i], duration: 0.62, ease: EASE.arrive }, 18.95 + i * 0.055),
  );
  count(get("rcpRecoveredValue"), 6795, 19.5, { prefix: "$" });
  count(get("rcpRateValue"), 91.7, 19.8, { suffix: "%", decimals: 1 });
  // The orbit carries through the beat, sweeping the highlight with it.
  look(19.6, { rotationY: 7, rotationX: -2, z: 700 }, 2.1);
  t.to(card, { rotationY: -6, duration: 2.8, ease: "sine.inOut" }, 19.6);
  relight(glassSkins, 850, 19.7, 2.2);
  movelight(glassSkins, 74, 19.7, 2.2);

  /* ---- seam 05>06 / 21.8-23.0 — the month folds into the mark --------- */

  bars.forEach((bar, i) =>
    t.to(bar, { scaleY: 0, duration: 0.45, ease: EASE.depart }, 21.85 + i * 0.026),
  );
  // The second real turn, on the other axis: the panel tips away on X and the
  // mark tips in, so the brand is the carrier's last state and not a new
  // object dropped over it.
  t.to(card, { rotationX: 84, duration: 0.58, ease: "power2.in" }, 21.95);
  t.set(card, { rotationX: -84 }, 22.53);
  t.to(card, { rotationX: 0, duration: 0.64, ease: "power3.out" }, 22.53);
  faceOut(faces.result, 22.47, 0.12);
  faceIn(faces.brand, 22.56, 0.3);
  shape({ width: 196, height: 196, borderRadius: 54, y: -180 }, 22.0, 1.15);
  look(21.95, { z: 840, rotationY: 0, rotationX: 0 }, 1.3, EASE.settle);
  relight(glassSkins, 1010, 21.95, 1.6);
  movelight(glassSkins, 40, 21.95, 1.6);

  /* ---- 06 / 22.4-26 — the brand, and the one thing to do -------------- */

  t.fromTo(
    get("rcpWordmark"),
    { autoAlpha: 0, y: 108 },
    { autoAlpha: 1, y: 62, duration: 0.7, ease: EASE.arrive },
    23.1,
  );
  words(get("rcpClose"), 23.6, { stagger: 0.09, distance: 30 });
  // The call to action is the only thing in the film that overshoots.
  t.fromTo(
    get("rcpCta"),
    { autoAlpha: 0, scale: 0.8, y: 378 },
    { autoAlpha: 1, scale: 1, y: 336, duration: 0.6, ease: "back.out(1.5)" },
    24.35,
  );
  t.to(get("rcpCta"), { scale: 1.035, duration: 0.95, ease: "sine.inOut" }, 24.9);
  t.to(card, { y: -190, rotationY: 8, duration: 2.4, ease: "sine.inOut" }, 23.5);
  look(23.6, { z: 880, rotationY: 0, rotationX: 1.5 }, 1.8, EASE.settle);
  relight(glassSkins, 1140, 23.6, 2.2);
  movelight(glassSkins, 58, 23.6, 2.2);
}

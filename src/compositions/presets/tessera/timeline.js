import { EASE, editorialTextReveal } from "../../../composition/presets";

/**
 * Tessera, 20 seconds.
 *
 * A transformation film with no application shell in it. The chain is the
 * product's actual mechanism made physical: records arrive from many systems
 * in many shapes -> they fly a corridor toward the camera -> each passes
 * through a gate and its own field names, values and formats resolve to one
 * contract at the instant it crosses -> the crossed records settle side by
 * side, now visibly identical -> they converge and build the mark.
 *
 * The material persists all the way through: the five planes that fly the
 * corridor are the five cards of the finished set and the pieces the mark is
 * assembled from.
 *
 * Depth note: the world translates on z, so a plane's authored z is world
 * space. With the camera parked at z 3300, a plane sits at the gate when its
 * own z reaches about -3400.
 */
export function buildTesseraTimeline({ root, timeline: t, register }) {
  const get = (id) => root.querySelector(`[data-edit="${id}"]`);
  root
    .querySelectorAll("[data-edit]")
    .forEach((el) => register(el.dataset.edit, el));

  const camera = get("tessCameraWorld");
  // The corridor is what travels in depth; the camera only frames it. Moving
  // the whole world would carry the type and the mark past the camera too.
  const corridor = get("tessCorridor");
  const gate = get("tessGate");
  const beam = get("tessGateBeam");
  const mark = get("tessBrandMark");
  const markTiles = [...mark.querySelectorAll("rect")];
  const claim = get("tessClaimLine");
  const records = ["One", "Two", "Three", "Four", "Five"].map((n) =>
    get("tessRecord" + n),
  );
  const flybys = ["Alpha", "Beta", "Gamma"].map((n) => get("tessFlyby" + n));
  const kickers = {
    stream: get("tessStreamKicker"),
    gate: get("tessGateKicker"),
    shape: get("tessShapeKicker"),
  };

  const centre = (el, extra = {}) =>
    t.set(el, { xPercent: -50, yPercent: -50, ...extra }, 0);

  const leave = (el, at, to = {}, duration = 0.7) =>
    t.to(el, { ...to, autoAlpha: 0, duration, ease: EASE.depart }, at);

  const kickerIn = (el, at) =>
    t.fromTo(
      el,
      { autoAlpha: 0, y: -438 },
      { autoAlpha: 1, y: -404, duration: 0.6, ease: EASE.arrive },
      at,
    );

  /* ---- opening state, all of it at t=0 -------------------------------- */

  t.set(camera, { x: 0, y: 0, scale: 1, transformOrigin: "50% 50%" }, 0);
  t.set(corridor, { z: 0 }, 0);
  t.set(
    [
      ...records,
      ...flybys,
      gate,
      mark,
      kickers.stream,
      kickers.gate,
      kickers.shape,
      get("tessWordmark"),
      get("tessBrandLine"),
    ],
    { autoAlpha: 0 },
    0,
  );
  centre(claim, { scale: 2.95, filter: "blur(7px)" });
  centre(get("tessWordmark"), { y: 84 });
  centre(get("tessBrandLine"), { y: 214 });
  centre(kickers.stream, { y: -404 });
  centre(kickers.gate, { y: -404 });
  centre(kickers.shape, { y: -404 });
  centre(mark, { y: -96 });
  centre(gate, { z: -3500, x: -330 });

  // The corridor. Three planes establish it and fly past the camera; the five
  // carrying real data sit further back and reach the gate in sequence.
  const flybyZ = [-900, -1800, -2600];
  const flybyX = [-620, 700, -520];
  const flybyY = [-260, 210, 300];
  flybys.forEach((el, i) =>
    centre(el, {
      z: flybyZ[i],
      x: flybyX[i],
      y: flybyY[i],
      rotationY: i % 2 ? -14 : 12,
    }),
  );
  const recordZ = [-4800, -5600, -6400, -7200, -8000];
  const recordX = [-90, 120, -150, 80, -40];
  const recordY = [40, -70, 90, -50, 30];
  records.forEach((el, i) =>
    centre(el, {
      z: recordZ[i],
      x: recordX[i],
      y: recordY[i],
      rotationY: i % 2 ? -7 : 6,
    }),
  );

  // Every field is a two-line roll: the source's own name and value on top,
  // the contract's underneath. Nothing is revealed — it is resolved in place.
  // The window is fixed; what moves is the pair of lines inside it.
  const rolls = (el) => [...el.querySelectorAll(".tess-roll span")];
  records.forEach((el) => t.set(rolls(el), { y: 0 }, 0));

  /* ---- 01 / 0-4.5 — the claim, oversized and alone -------------------- */

  t.to(claim, { autoAlpha: 1, duration: 0.22, ease: "power2.out" }, 0.05);
  t.to(
    claim,
    { filter: "blur(0px)", duration: 0.42, ease: "power4.out" },
    0.16,
  );
  t.to(claim, { scale: 3.08, duration: 0.85, ease: EASE.material }, 0.05);
  t.to(claim, { scale: 1, duration: 1.05, ease: EASE.settle }, 0.9);
  t.to(claim, { scale: 1.03, x: -12, duration: 1.1, ease: "sine.inOut" }, 1.95);

  /* ---- seam 01>02 / 3.9-5.1 — the claim recedes into the corridor ----- */

  // MATCH-CUT in depth. The camera is already travelling forward, the line
  // recedes on that same axis, and what it recedes into is the material the
  // next beat is built from.
  t.to(
    claim,
    { z: -1500, autoAlpha: 0, duration: 1.05, ease: EASE.depart },
    3.9,
  );
  flybys.forEach((el, i) =>
    t.to(el, { autoAlpha: 0.85, duration: 0.4 }, 3.95 + i * 0.12),
  );
  records.forEach((el, i) =>
    t.to(el, { autoAlpha: 1, duration: 0.45 }, 4.05 + i * 0.07),
  );
  t.to(corridor, { z: 3300, duration: 5.25, ease: EASE.cameraRamp }, 3.95);

  /* ---- 02 / 4.5-9 — a corridor of mismatched material ----------------- */

  kickerIn(kickers.stream, 4.9);
  // The establishing planes pass the camera and leave along their own vector.
  flybys.forEach((el, i) =>
    t.to(
      el,
      {
        x: flybyX[i] * 2.6,
        y: flybyY[i] * 2.2,
        autoAlpha: 0,
        duration: 0.9,
        ease: EASE.depart,
      },
      5.4 + i * 0.75,
    ),
  );
  leave(kickers.stream, 8.4, { y: -438 }, 0.6);

  /* ---- seam 02>03 / 8.4-9.6 — the gate arrives on the same move ------- */

  t.to(gate, { autoAlpha: 1, duration: 0.7, ease: EASE.arrive }, 8.4);
  t.fromTo(
    beam,
    { scaleX: 0, transformOrigin: "50% 50%" },
    { scaleX: 1, duration: 0.8, ease: EASE.arrive },
    8.6,
  );
  kickerIn(kickers.gate, 9.1);

  /* ---- 03 / 9-14 — the mechanism, one record at a time ---------------- */

  // The camera has stopped at the gate; now the material moves through it.
  // Each record's names, values and formats resolve to the contract *as it
  // crosses*, so the gate is visibly what causes the change.
  const crossAt = [9.6, 10.35, 11.1, 11.85, 12.6];
  records.forEach((el, i) => {
    t.to(
      el,
      {
        z: -3400,
        x: -330,
        y: 0,
        scale: 1.35,
        rotationY: 0,
        duration: crossAt[i] - 9,
        ease: EASE.travel,
      },
      9,
    );
    t.to(
      rolls(el),
      { y: -30, duration: 0.4, ease: "power3.inOut" },
      crossAt[i] - 0.1,
    );
    t.to(
      el,
      { borderColor: "rgba(79,70,229,0.55)", duration: 0.4 },
      crossAt[i],
    );
    // A crossed record takes its place in the set. Five cards that arrived in
    // five different shapes are now identical, side by side, at a size the
    // difference can be read at.
    t.to(
      el,
      {
        x: 660,
        y: (i - 2) * 98,
        scale: 0.54,
        duration: 0.55,
        ease: EASE.travel,
      },
      crossAt[i] + 0.4,
    );
    t.to(
      el,
      { borderColor: "rgba(20,20,25,0.12)", duration: 0.5 },
      crossAt[i] + 0.85,
    );
  });
  // The beam reacts to every crossing.
  crossAt.forEach((at) =>
    t.fromTo(
      beam,
      { opacity: 1 },
      {
        opacity: 0.35,
        duration: 0.16,
        repeat: 1,
        yoyo: true,
        ease: "power2.out",
        immediateRender: false,
      },
      at - 0.08,
    ),
  );
  leave(kickers.gate, 13.4, { y: -438 }, 0.6);

  /* ---- seam 03>04 / 13.4-14.6 — the gate has nothing left to do ------- */

  t.to(
    gate,
    { autoAlpha: 0, scale: 1.08, duration: 1, ease: EASE.depart },
    13.5,
  );

  /* ---- 04 / 14-17.5 — five sources, one shape ------------------------- */

  kickerIn(kickers.shape, 14.2);
  // Resolve into a complete comparison, not a cropped row travelling past
  // an empty gate. Every source has a reserved destination inside the frame.
  const resultSlots = [
    [-600, -170],
    [0, -170],
    [600, -170],
    [-300, 170],
    [300, 170],
  ];
  records.forEach((record, i) =>
    t.to(
      record,
      {
        x: resultSlots[i][0],
        y: resultSlots[i][1],
        scale: 0.95,
        duration: 0.9,
        ease: EASE.travel,
      },
      13.65 + i * 0.055,
    ),
  );

  /* ---- seam 04>05 / 16.9-18.2 — the set becomes the mark -------------- */

  // PARTICLE-REASSEMBLE: the five converge on one point and the mark's four
  // tiles land out of them.
  leave(kickers.shape, 16.9, { y: -438 }, 0.6);
  records.forEach((el, i) =>
    t.to(
      el,
      {
        x: 0,
        y: -96,
        scale: 0.05,
        autoAlpha: 0,
        duration: 0.85,
        ease: EASE.depart,
      },
      16.9 + i * 0.07,
    ),
  );
  t.to(camera, { x: 0, scale: 1, duration: 1.2, ease: EASE.settle }, 17);
  t.fromTo(
    mark,
    { scale: 0.18, autoAlpha: 0 },
    {
      scale: 1,
      autoAlpha: 1,
      duration: 0.9,
      ease: EASE.arrive,
      immediateRender: false,
    },
    17.35,
  );
  markTiles.forEach((tile, i) =>
    t.fromTo(
      tile,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.45,
        ease: "power2.out",
        immediateRender: false,
      },
      17.5 + i * 0.08,
    ),
  );

  /* ---- 05 / 17.5-20 — the close --------------------------------------- */

  t.fromTo(
    get("tessWordmark"),
    { autoAlpha: 0, y: 122 },
    { autoAlpha: 1, y: 84, duration: 0.7, ease: EASE.arrive },
    18.05,
  );
  editorialTextReveal(t, get("tessBrandLine"), {
    at: 18.4,
    duration: 0.46,
    stagger: 0.1,
    distance: 28,
    blur: 3,
  });
  t.to(mark, { y: -110, duration: 1.9, ease: "sine.inOut" }, 18.1);
  t.to(camera, { scale: 1.03, duration: 1.9, ease: "sine.inOut" }, 18.1);
}

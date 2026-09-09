/**
 * The reference film, shot by shot.
 *
 * Read this alongside the skill's move list — every number here is one the
 * studied films actually run at, and the structure is the five-beat film the
 * playbook describes: huge, medium, objects, macro, brand.
 *
 * Three things worth noticing, because they are what generated output usually
 * gets wrong:
 *
 * 1. The camera holds through the two statement beats. The *type* carries the
 *    motion there — it grows, it settles, it drifts. There are three camera
 *    moves across five beats, and all three travel the same direction: inward.
 * 2. One carrier crosses all four boundaries and is a sibling of every scene
 *    container, so clearing a beat never clears it. It is an accent bar, then
 *    the colour ground, then a chip, then the plate behind an edited word, then
 *    the brand ground.
 * 3. No boundary passes through an empty frame. The incoming ground is already
 *    covering the viewport before the outgoing type has finished leaving.
 */
export function buildTimeline(context) {
  const { root, timeline, register } = context;
  const get = (id) => {
    const element = root.querySelector('[data-edit="' + id + '"]');
    if (!element) console.warn("reference-film: missing layer", id);
    else if (register) register(id, element);
    return element;
  };
  const all = (selector) => Array.from(root.querySelectorAll(selector));

  const stage = get("stage");
  const world = get("camera-world");
  const bloom = get("warm-bloom");
  const carrier = get("story-carrier");

  const claimLine = get("claim-line");
  const beatClaim = get("beat-claim");

  const beatImport = get("beat-import");
  const importLead = get("import-lead");
  const importTail = get("import-tail");
  const importRow = get("import-row");

  const beatStyles = get("beat-styles");
  const chips = all(".rf-chip");

  const beatEdit = get("beat-edit");
  const macroWord = get("macro-word");
  const macroCaret = get("macro-caret");
  const selection = get("edit-selection");

  const beatBrand = get("beat-brand");
  const lockup = get("brand-lockup");
  const petals = all(".rf-petal");
  const promise = get("brand-promise");

  /* --- deterministic state at t=0 ------------------------------------- */
  timeline.set(stage, { backgroundColor: "#0b0b0d" }, 0);
  timeline.set(world, { scale: 1, x: 0, y: 0 }, 0);
  timeline.set(bloom, { autoAlpha: 0.9, scale: 1 }, 0);
  timeline.set(
    carrier,
    { width: 220, height: 10, borderRadius: 999, backgroundColor: "#ee4b3c", x: 0, y: 210, autoAlpha: 1 },
    0,
  );
  timeline.set([beatImport, beatStyles, beatEdit, beatBrand], { autoAlpha: 0 }, 0);
  timeline.set(beatClaim, { autoAlpha: 1 }, 0);
  timeline.set(chips, { autoAlpha: 0, y: 40, scale: 0.9 }, 0);
  timeline.set(selection, { autoAlpha: 0, scaleX: 0 }, 0);
  timeline.set(macroCaret, { autoAlpha: 0 }, 0);
  timeline.set(lockup, { autoAlpha: 0 }, 0);
  timeline.set(promise, { autoAlpha: 0, y: 18 }, 0);

  /* --- beat 1 (0.0-3.6) the claim, oversized -------------------------- */
  // Macro Settle: 300% and blurred, sharp a third of the way through the move.
  macroSettle(timeline, claimLine, {
    at: 0.15,
    startScale: 2.9,
    blur: 20,
    duration: 0.95,
    unit: "words",
    stagger: 0.05,
  });
  // The camera holds. The line keeps breathing so the frame is never locked.
  timeline.to(
    claimLine,
    { scale: 1.035, duration: 2.0, ease: "sine.inOut" },
    1.3,
  );
  timeline.to(bloom, { scale: 1.14, duration: 3.0, ease: "sine.inOut" }, 0.4);
  // The carrier announces itself under the line before it has to do anything.
  timeline.fromTo(
    carrier,
    { scaleX: 0 },
    { scaleX: 1, duration: 0.7, ease: "expo.out" },
    0.9,
  );

  /* --- seam 1 (3.2-4.0) the bar floods into the ground ----------------- */
  // Ground flood, not a cross-fade: the carrier grows to fill the viewport and
  // the next beat is already composed on top of it.
  morph(
    timeline,
    carrier,
    { width: 2400, height: 1400, borderRadius: 0, y: 0 },
    { at: 3.2, duration: 0.8, ease: "expo.inOut" },
  );
  timeline.to(claimLine, { autoAlpha: 0, y: -40, duration: 0.34, ease: "power2.in" }, 3.3);
  timeline.set(beatClaim, { autoAlpha: 0 }, 3.7);
  timeline.set(beatImport, { autoAlpha: 1 }, 3.55);

  /* --- beat 2 (3.6-7.4) the line completes itself ---------------------- */
  // Grow and Complete: the fragment grows while the rest lands beside it and
  // the row re-centres. This is the move the references use most.
  growAndComplete(timeline, importLead, importTail, {
    at: 3.75,
    startScale: 0.55,
    duration: 0.5,
    stagger: 0.07,
  });
  timeline.to(importRow, { scale: 1.04, duration: 2.2, ease: "sine.inOut" }, 4.4);
  // Still no camera move. Two statement beats, two held frames.

  /* --- seam 2 (7.0-7.8) the ground contracts into a chip --------------- */
  timeline.to(stage, { backgroundColor: "#f6f5f8", duration: 0.5 }, 7.05);
  timeline.to(bloom, { autoAlpha: 0.22, duration: 0.6 }, 7.0);
  morph(
    timeline,
    carrier,
    { width: 300, height: 106, borderRadius: 999, y: -190 },
    { at: 7.0, duration: 0.8, ease: "expo.inOut" },
  );
  timeline.to(importRow, { autoAlpha: 0, y: -46, duration: 0.36, ease: "power2.in" }, 7.1);
  timeline.set(beatImport, { autoAlpha: 0 }, 7.5);
  timeline.set(beatStyles, { autoAlpha: 1 }, 7.35);

  /* --- beat 3 (7.4-11.2) real objects with mass ------------------------ */
  // The carrier is now the first chip in the column; the rest stack under it.
  chips.forEach((chip, index) => {
    timeline.fromTo(
      chip,
      { autoAlpha: 0, y: 46, scale: 0.9 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.52, ease: "back.out(1.4)" },
      7.75 + index * 0.14,
    );
  });
  // The film's first camera move, and it is motivated: settle onto the choice.
  cameraPush(timeline, world, {
    at: 8.6,
    scale: 1.12,
    duration: 1.6,
    ease: "expo.out",
  });
  timeline.to(chips[1], { scale: 1.06, duration: 0.5, ease: "back.out(1.6)" }, 9.9);

  /* --- seam 3 (10.8-11.6) the chip becomes the selection plate ---------- */
  morph(
    timeline,
    carrier,
    { width: 940, height: 190, borderRadius: 10, y: 0 },
    { at: 10.8, duration: 0.8, ease: "expo.inOut" },
  );
  timeline.to(chips, { autoAlpha: 0, y: -30, duration: 0.34, stagger: -0.05, ease: "power2.in" }, 10.85);
  timeline.set(beatStyles, { autoAlpha: 0 }, 11.35);
  timeline.set(beatEdit, { autoAlpha: 1 }, 11.15);

  /* --- beat 4 (11.2-15.4) the macro edit ------------------------------- */
  // The closest shot in the film, and it is genuinely close: one word, filling
  // most of the frame, being changed while the camera is pushed all the way in.
  cameraPush(timeline, world, {
    at: 11.2,
    scale: 1.45,
    duration: 1.5,
    ease: "expo.out",
  });
  timeline.fromTo(
    macroWord,
    { autoAlpha: 0, y: 26 },
    { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" },
    11.5,
  );
  // A selection sweeps across the word, then the caret arrives with the edit.
  timeline.set(selection, { autoAlpha: 1 }, 12.2);
  timeline.fromTo(
    selection,
    { scaleX: 0 },
    { scaleX: 1, duration: 0.42, ease: "power3.inOut" },
    12.2,
  );
  timeline.to(macroCaret, { autoAlpha: 1, duration: 0.1 }, 12.75);
  // A caret blinks hard on and off. `steps(1)` is what that actually is, and it
  // keeps the example clear of the linear-opacity-fade rule it teaches.
  timeline.to(macroCaret, { autoAlpha: 0.1, duration: 0.36, repeat: 3, yoyo: true, ease: "steps(1)" }, 12.9);
  timeline.to(selection, { autoAlpha: 0, duration: 0.3 }, 14.2);
  timeline.to(macroWord, { scale: 1.05, duration: 1.6, ease: "sine.inOut" }, 13.6);

  /* --- seam 4 (15.0-15.8) the plate floods to brand ground ------------- */
  cameraPull(timeline, world, {
    at: 15.0,
    scale: 1,
    duration: 1.4,
    ease: "expo.out",
  });
  morph(
    timeline,
    carrier,
    { width: 2400, height: 1400, borderRadius: 0, y: 0 },
    { at: 15.0, duration: 0.8, ease: "expo.inOut" },
  );
  timeline.to(macroWord, { autoAlpha: 0, scale: 0.94, duration: 0.34, ease: "power2.in" }, 15.05);
  timeline.to(macroCaret, { autoAlpha: 0, duration: 0.16 }, 15.0);
  timeline.set(beatEdit, { autoAlpha: 0 }, 15.5);
  timeline.set(beatBrand, { autoAlpha: 1 }, 15.35);

  /* --- beat 5 (15.4-20.0) the brand ------------------------------------ */
  timeline.to(stage, { backgroundColor: "#ee4b3c", duration: 0.4 }, 15.1);
  timeline.to(bloom, { autoAlpha: 0.3, duration: 0.6 }, 15.2);
  timeline.fromTo(
    lockup,
    { autoAlpha: 0, scale: 0.7 },
    { autoAlpha: 1, scale: 1, duration: 0.62, ease: "back.out(1.5)" },
    15.55,
  );
  petals.forEach((petal, index) => {
    timeline.fromTo(
      petal,
      { rotation: index * 60 - 40, scale: 0.4 },
      { rotation: index * 60, scale: 1, duration: 0.72, ease: "back.out(1.6)" },
      15.62 + index * 0.06,
    );
  });
  timeline.fromTo(
    promise,
    { autoAlpha: 0, y: 18 },
    { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" },
    15.95,
  );
  // Hold to the last frame with a drift, so nothing freezes.
  timeline.to(lockup, { scale: 1.03, duration: 2.6, ease: "sine.inOut" }, 16.6);
  timeline.to(petals, { rotation: "+=8", duration: 3.0, ease: "sine.inOut" }, 16.6);
  timeline.to({}, { duration: 0.2 }, 19.8);
}

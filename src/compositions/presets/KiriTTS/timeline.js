import {
  EASE,
  editorialTextReveal,
  morph,
  splitText,
} from "../../../composition/presets";

/**
 * KiriTTS, 48 seconds.
 *
 * The chain: an oversized English claim pulls back, and the retreat opens the
 * room Khmer rises into to complete the thought -> both collapse into the mark
 * -> the mark's own outline opens into the real Generate Speech screen -> a
 * script is typed, a voice is picked out of the full roster, Generate is
 * pressed, and the words become a waveform -> the screen leaves, the waveform
 * stays, and pulling back shows the thirteen voices that one came from -> the
 * same surface takes a dragged-in recording and becomes a transcript -> the
 * transcript releases its subtitle exports -> they rebuild the mark, which
 * retreats to the platform's nine capabilities and the closing question.
 *
 * One camera on a single inward journey. Every hide has a duration, so
 * scrubbing backwards reconstructs the frame exactly.
 */
export function buildKiriTtsTimeline({ root, timeline: t, register }) {
  const get = (id) => root.querySelector(`[data-edit="${id}"]`);
  const all = (selector) => [...root.querySelectorAll(selector)];
  root
    .querySelectorAll("[data-edit]")
    .forEach((el) => register(el.dataset.edit, el));

  const camera = get("kiriCameraWorld");
  const mark = get("kiriBrandMark");
  const markLogo = mark.querySelector("img");
  const host = get("kiriVoiceCarrier");
  const audioFace = get("kiriAudioFace");
  const dropFace = get("kiriDropFace");
  const docFace = get("kiriTranscriptFace");
  const app = get("kiriEditor");
  const cursor = get("kiriCursor");
  const menu = get("kiriVoiceMenu");
  const scroll = get("kiriVoiceScroll");
  const playhead = get("kiriPlayhead");
  const waveBase = get("kiriWaveBase");
  const wavePlayed = get("kiriWavePlayed");
  const upload = get("kiriUploadFile");
  const hook = get("kiriHookLine");
  const khmer = get("kiriHookKhmer");
  const gallery = get("kiriVoiceGallery");
  const galleryCards = all(".kiri-gallery-card");
  const featureGrid = get("kiriFeatureGrid");
  const featureCards = all(".kiri-feature-card");
  const files = ["SRT", "VTT", "JSON", "TXT", "CSV"].map((n) =>
    get("kiriFile" + n),
  );
  const speakers = ["One", "Two", "Three"].map((n) => get("kiriSpeaker" + n));
  const maly = get("kiriMalySelect");

  /* ---- helpers ------------------------------------------------------- */

  const place = (el, x = 0, y = 0, extra = {}) =>
    t.set(el, { xPercent: -50, yPercent: -50, x, y, ...extra }, 0);

  /** Point the camera at a world coordinate; origin stays the frame centre. */
  const look = (at, x, y, scale, duration = 1.2, ease = EASE.cameraRamp) =>
    t.to(camera, { x: -x * scale, y: -y * scale, scale, duration, ease }, at);

  /** Nothing is switched off: every exit travels for a real duration. */
  const leave = (el, at, to = {}, duration = 0.75) =>
    t.to(el, { ...to, autoAlpha: 0, duration, ease: EASE.depart }, at);

  /** The carrier's own outline changing — the only shape that morphs. */
  const shape = (styles, at, duration = 1) =>
    morph(t, host, styles, { at, duration, ease: EASE.material });

  const click = (el, at) =>
    t.to(
      el,
      {
        scale: 0.95,
        duration: 0.1,
        repeat: 1,
        yoyo: true,
        ease: "power2.inOut",
      },
      at,
    );

  const words = (el, at, extra = {}) =>
    editorialTextReveal(t, el, {
      at,
      duration: 0.46,
      stagger: 0.085,
      distance: 26,
      blur: 3,
      ...extra,
    });

  /** Explicit endpoints so seeking backwards through a morph rebuilds it. */
  const face = (el, at, on, duration = 0.5) =>
    t.fromTo(
      el,
      { autoAlpha: on ? 0 : 1 },
      {
        autoAlpha: on ? 1 : 0,
        duration,
        ease: "power2.inOut",
        immediateRender: false,
      },
      at,
    );

  /** Swap a label mid-fade, driven by a proxy so scrubbing restores it. */
  const swapText = (el, at, before, after) => {
    const p = { v: 0 };
    t.to(
      p,
      {
        v: 1,
        duration: 0.4,
        ease: "none",
        onUpdate() {
          el.textContent = p.v < 0.5 ? before : after;
        },
      },
      at,
    );
    t.fromTo(
      el,
      { autoAlpha: 1 },
      {
        autoAlpha: 0,
        duration: 0.2,
        ease: "power2.in",
        immediateRender: false,
      },
      at,
    );
    t.fromTo(
      el,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        duration: 0.2,
        ease: "power2.out",
        immediateRender: false,
      },
      at + 0.2,
    );
  };

  /* ---- opening state, all of it at t=0 -------------------------------- */

  t.set(camera, { x: 0, y: 0, scale: 1, transformOrigin: "50% 50%" }, 0);
  t.set(
    [
      khmer,
      get("kiriIntroName"),
      get("kiriIntroKicker"),
      app,
      get("kiriVoicesKicker"),
      get("kiriFeaturesKicker"),
      get("kiriSttLine"),
      get("kiriBrandLine"),
      get("kiriStartBuilding"),
      mark,
      audioFace,
      dropFace,
      docFace,
      upload,
      cursor,
      menu,
      playhead,
      get("kiriAudioLabel"),
      get("kiriExportControls"),
      get("kiriMalyCheck"),
      get("kiriTypingCaret"),
      ...files,
      ...galleryCards,
      ...featureCards,
    ],
    { autoAlpha: 0 },
    0,
  );
  t.set([waveBase, wavePlayed], { clipPath: "inset(0 100% 0 0)" }, 0);
  t.set(playhead, { left: "0%" }, 0);
  t.set(speakers, { autoAlpha: 0, y: 34 }, 0);
  // The picker unfolds downward out of its own control rather than scaling as
  // a whole card, which is what a dropdown actually does.
  t.set(menu, { transformOrigin: "12% 0%", clipPath: "inset(0 0 100% 0)" }, 0);
  t.set(scroll, { y: 0 }, 0);

  place(hook, 0, 0, { fontSize: 104, scale: 3.15, filter: "blur(6px)" });
  place(khmer, 0, 96, { fontSize: 92 });
  place(mark, 0, -170, { width: 300, height: 300, borderRadius: 90 });
  t.set(markLogo, { left: 57, top: 57, width: 186, height: 186 }, 0);
  place(get("kiriIntroName"), 0, 62);
  place(get("kiriIntroKicker"), 0, 172);
  place(app, 0, 0, { rotationY: 0, rotationX: 0 });
  place(host, -235, 230, { width: 1080, height: 110, borderRadius: 22 });
  place(get("kiriAudioLabel"), -570, 315);
  place(get("kiriVoicesKicker"), 0, -318);
  place(gallery, 0, 160);
  place(get("kiriFeaturesKicker"), 0, 410);
  place(featureGrid, 0, 70);
  place(get("kiriSttLine"), 0, -50, { fontSize: 88 });
  place(upload, -700, 300);
  files.forEach((file) => place(file, 0, 300, { scale: 0.12 }));
  place(get("kiriBrandLine"), 0, 44, { fontSize: 92 });
  place(get("kiriStartBuilding"), 0, 244);
  place(cursor, 780, 520);

  const script = get("kiriInputWords");
  const scriptText = script.textContent.replace(/\s+/g, " ").trim();
  script.textContent = scriptText;
  const typed = splitText(script, "words")
    .filter((word) => word.textContent.trim())
    .flatMap((word) => {
      word.style.whiteSpace = "nowrap";
      return splitText(word, "chars");
    });
  t.set(typed, { autoAlpha: 0 }, 0);

  /* ---- 01 / 0-7 — the claim, and Khmer completing it ------------------ */

  // Move A: cropped by both frame edges, focus resolving while it is still
  // huge and still, then the pull-back to reading size.
  t.to(hook, { autoAlpha: 1, duration: 0.22, ease: "power2.out" }, 0.05);
  t.to(hook, { filter: "blur(0px)", duration: 0.44, ease: "power4.out" }, 0.18);
  t.to(hook, { scale: 3.3, duration: 0.9, ease: "sine.inOut" }, 0.05);
  t.to(hook, { scale: 1, duration: 1.1, ease: EASE.settle }, 0.95);
  t.to(hook, { scale: 1.03, duration: 0.9, ease: "sine.inOut" }, 2.05);

  // The retreat is what makes the room, and Khmer rises into the room it
  // opens — the claim answered in the language it is about, rather than
  // replaced by a second slide that looks exactly like the first.
  look(3, 0, -30, 0.74, 1.5, EASE.settle);
  t.to(hook, { y: -132, duration: 1.5, ease: EASE.travel }, 3);
  const khmerWords = editorialTextReveal(t, khmer, {
    at: 3.45,
    duration: 0.55,
    stagger: 0.14,
    distance: 92,
    blur: 4,
  });
  t.fromTo(
    khmer,
    { y: 210 },
    { y: 96, duration: 1.2, ease: EASE.travel, immediateRender: false },
    3.45,
  );
  t.to(khmer, { scale: 1.03, duration: 1.6, ease: "sine.inOut" }, 4.8);

  /* ---- seam 01>02 / 6.3-7.7 — both lines collapse into the mark ------- */

  t.set(khmerWords, { filter: "none" }, 6.3);
  khmerWords.forEach((piece, i) =>
    t.to(
      piece,
      {
        rotation: (i % 2 ? 1 : -1) * (11 + (i % 3) * 8),
        y: (i % 3) * 20 - 20,
        duration: 0.85,
        ease: "power2.in",
      },
      6.3 + i * 0.05,
    ),
  );
  t.to(
    hook,
    { scale: 0.05, y: -170, autoAlpha: 0, duration: 1, ease: EASE.depart },
    6.3,
  );
  t.to(
    khmer,
    { scale: 0.05, y: -170, autoAlpha: 0, duration: 1, ease: EASE.depart },
    6.4,
  );
  look(6.35, 0, -60, 0.86, 1.35, EASE.settle);
  t.fromTo(
    mark,
    { scale: 0.26, autoAlpha: 0, rotationY: -24 },
    {
      scale: 1,
      autoAlpha: 1,
      rotationY: -11,
      duration: 0.95,
      ease: "power3.out",
    },
    6.85,
  );

  /* ---- 02 / 7-10.5 — the mark, as an object --------------------------- */

  t.to(mark, { rotationY: 10, duration: 2.6, ease: "sine.inOut" }, 7.8);
  t.to(mark, { y: -184, duration: 2.6, ease: "sine.inOut" }, 7.8);
  t.fromTo(
    get("kiriIntroName"),
    { y: 118, autoAlpha: 0 },
    { y: 62, autoAlpha: 1, duration: 0.8, ease: "power3.out" },
    7.95,
  );
  t.fromTo(
    get("kiriIntroKicker"),
    { y: 208, autoAlpha: 0 },
    { y: 172, autoAlpha: 1, duration: 0.65, ease: "power3.out" },
    8.4,
  );
  look(8.9, 0, -40, 0.95, 1.2);

  /* ---- seam 02>03 / 9.8-11.2 — the mark opens into the screen --------- */

  leave(get("kiriIntroName"), 9.8, { y: -60, scale: 0.9 }, 0.6);
  leave(get("kiriIntroKicker"), 9.85, { y: -40 }, 0.55);
  // Dock the original tile into the header. Its outline never becomes an
  // empty application-sized plate in front of the incoming editor.
  t.to(
    mark,
    {
      x: -783,
      y: -403,
      width: 34,
      height: 34,
      borderRadius: 8,
      rotationY: 0,
      rotationX: 0,
      backgroundColor: "transparent",
      borderColor: "transparent",
      boxShadow: "none",
      duration: 1.15,
      ease: EASE.material,
    },
    9.85,
  );
  t.to(
    markLogo,
    {
      left: 0,
      top: 0,
      width: 34,
      height: 34,
      duration: 1.15,
      ease: EASE.material,
    },
    9.85,
  );
  look(9.85, 0, 0, 1, 1.2);
  t.fromTo(
    app,
    { y: 160, autoAlpha: 0 },
    {
      y: 0,
      autoAlpha: 1,
      duration: 0.85,
      ease: "power3.out",
      immediateRender: false,
    },
    10.25,
  );
  leave(mark, 11.05, {}, 0.25);

  /* ---- 03 / 10.5-20.5 — Generate Speech, actually used ---------------- */

  t.to(app, { rotationY: -7, rotationX: 3, duration: 0.85, ease: "power2.inOut" }, 11.15);
  t.to(app, { rotationY: 0, rotationX: 0, duration: 0.8, ease: "power2.inOut" }, 13.4);
  look(11.4, -235, -93, 1.62, 1.35);
  leave(get("kiriStarters"), 11.5, { y: 30 }, 0.45);
  leave(get("kiriComposerHint"), 11.55, {}, 0.3);

  const caret = get("kiriTypingCaret");
  t.fromTo(
    caret,
    { autoAlpha: 0 },
    {
      autoAlpha: 1,
      duration: 0.15,
      ease: "power1.out",
      immediateRender: false,
    },
    11.65,
  );
  t.fromTo(
    caret,
    { autoAlpha: 1 },
    {
      autoAlpha: 0.2,
      duration: 0.43,
      repeat: 5,
      yoyo: true,
      ease: "steps(1)",
      immediateRender: false,
    },
    11.9,
  );
  t.to(
    typed,
    { autoAlpha: 1, duration: 0.012, stagger: 0.041, ease: "none" },
    11.8,
  );
  const typingEnd = 11.8 + typed.length * 0.041;
  const counter = { n: 0 };
  const countEl = get("kiriCharCount");
  t.to(
    counter,
    {
      n: scriptText.length,
      duration: typingEnd - 11.8,
      ease: "none",
      onUpdate() {
        countEl.textContent = Math.round(counter.n) + " / 5000";
      },
    },
    11.8,
  );
  swapText(
    get("kiriParagraphNote"),
    typingEnd - 0.2,
    "Empty — start typing in the editor",
    "1 paragraph · " + scriptText.length + " characters",
  );

  // The picker opens and the whole roster is there to be read.
  t.fromTo(
    cursor,
    { x: 780, y: 520, autoAlpha: 0 },
    { x: -656, y: -279, autoAlpha: 1, duration: 0.8, ease: "power2.inOut" },
    14.4,
  );
  look(14.5, -430, -110, 2.35, 1.25);
  t.fromTo(
    caret,
    { autoAlpha: 1 },
    { autoAlpha: 0, duration: 0.25, ease: "power2.in", immediateRender: false },
    14.55,
  );
  click(cursor, 15.2);
  click(get("kiriVoicePill"), 15.2);
  t.fromTo(
    menu,
    { clipPath: "inset(0 0 100% 0)", autoAlpha: 0, y: -10 },
    {
      clipPath: "inset(0 0 0% 0)",
      autoAlpha: 1,
      y: 0,
      duration: 0.42,
      ease: "power3.out",
      immediateRender: false,
    },
    15.3,
  );
  // The material behind the open menu recedes, so the two never read as two
  // panels competing for the same space.
  t.to(
    [get("kiriComposer"), get("kiriComposerTools")],
    { autoAlpha: 0.3, duration: 0.35, ease: "power2.out" },
    15.3,
  );
  // The list is read the way a machine reads a roster, and Maly snaps in at
  // the anchor rather than being the only option that was ever on screen.
  t.fromTo(
    scroll,
    { y: 0 },
    { y: -318, duration: 1.15, ease: EASE.travel, immediateRender: false },
    15.85,
  );
  t.to(cursor, { x: -472, y: -120, duration: 0.5, ease: EASE.travel }, 16.6);
  click(cursor, 17.15);
  click(maly, 17.15);
  t.to(
    maly,
    { backgroundColor: "#ffffff16", borderColor: "#f0a44a66", duration: 0.3 },
    17.15,
  );
  t.fromTo(
    get("kiriMalyCheck"),
    { autoAlpha: 0, scale: 0.4 },
    { autoAlpha: 1, scale: 1, duration: 0.36, ease: "back.out(1.6)" },
    17.25,
  );
  swapText(get("kiriVoicePillLabel"), 17.5, "Select voice", "Maly");
  swapText(get("kiriSideVoiceLabel"), 17.55, "Select a voice", "Maly · Khmer");
  t.to(
    menu,
    {
      clipPath: "inset(0 0 100% 0)",
      autoAlpha: 0,
      duration: 0.34,
      ease: "power2.in",
    },
    17.55,
  );
  t.to(
    [get("kiriComposer"), get("kiriComposerTools")],
    { autoAlpha: 1, duration: 0.35, ease: "power2.out" },
    17.6,
  );

  // Pull back off the macro to press the button and watch the result arrive.
  look(17.75, 0, 30, 1.06, 1.35, EASE.settle);
  t.to(cursor, { x: 186, y: 377, duration: 0.8, ease: "power2.inOut" }, 17.9);
  click(cursor, 18.4);
  click(get("kiriGenerateButton"), 18.4);
  leave(cursor, 18.65, { x: 420, y: 470 }, 0.4);
  swapText(get("kiriGenerateLabel"), 18.45, "Generate Speech", "Generating…");

  t.fromTo(
    audioFace,
    { autoAlpha: 0, scaleY: 0.15 },
    { autoAlpha: 1, scaleY: 1, duration: 0.6, ease: "power3.out" },
    18.7,
  );
  t.to(
    waveBase,
    { clipPath: "inset(0 0% 0 0)", duration: 1.25, ease: EASE.material },
    18.8,
  );
  t.fromTo(
    get("kiriAudioLabel"),
    { autoAlpha: 0, y: 335 },
    { autoAlpha: 1, y: 315, duration: 0.45, ease: "power3.out" },
    19.4,
  );
  swapText(get("kiriGenerateLabel"), 19.45, "Generating…", "Generate Speech");
  t.to(
    wavePlayed,
    { clipPath: "inset(0 0% 0 0)", duration: 5.4, ease: "none" },
    19.7,
  );
  t.fromTo(
    playhead,
    { left: "0%", autoAlpha: 0 },
    { left: "100%", autoAlpha: 1, duration: 5.4, ease: "none" },
    19.7,
  );
  // GSAP folds a stagger into every repeat, so the cycle stays short.
  const bars = [...get("kiriWaveform").querySelectorAll("rect")];
  t.fromTo(
    bars,
    { scaleY: 0.93 },
    {
      scaleY: 1.07,
      duration: 0.62,
      repeat: 9,
      yoyo: true,
      ease: "sine.inOut",
      stagger: { each: 0.004, from: "start" },
    },
    19,
  );

  /* ---- seam 03>04 / 19.8-21.2 — the screen leaves, its audio stays ---- */

  t.to(
    app,
    {
      x: -1900,
      rotationY: 0,
      autoAlpha: 0,
      duration: 0.85,
      ease: "power3.inOut",
    },
    19.8,
  );
  shape(
    { x: 0, y: -140, width: 1320, height: 148, borderRadius: 26 },
    20.2,
    1.0,
  );
  t.to(
    get("kiriAudioLabel"),
    { x: 0, y: -32, duration: 1, ease: EASE.travel },
    20.2,
  );

  /* ---- 04 / 20.5-26 — the whole roster, revealed by pulling back ------ */

  // The camera is still tight from the picker; the retreat is what shows that
  // the one voice chosen came out of thirteen.
  look(19.9, 0, -20, 0.92, 1.6, EASE.settle);
  t.fromTo(
    get("kiriVoicesKicker"),
    { autoAlpha: 0, y: -352 },
    { autoAlpha: 1, y: -318, duration: 0.7, ease: "power3.out" },
    20.85,
  );
  galleryCards.forEach((card, i) =>
    t.fromTo(
      card,
      { autoAlpha: 0, y: 54, scale: 0.94, rotationY: -14, rotationX: 6 },
      { autoAlpha: 1, y: 0, scale: 1, rotationY: (i - 1) * -6, rotationX: 3, duration: 0.8, ease: "power3.out" },
      21.05 + i * 0.14,
    ),
  );
  // Maly, the one that was chosen, keeps its selected state in the roster.
  t.to(
    galleryCards[0],
    { borderColor: "#f0a44a80", backgroundColor: "#1c1913", duration: 0.5 },
    21.9,
  );
  look(22.4, 0, 10, 0.96, 2.4, "sine.inOut");

  /* ---- seam 04>05 / 25.3-26.7 — the audio becomes a target ------------ */

  galleryCards.forEach((card, i) =>
    t.to(
      card,
      { y: 92, autoAlpha: 0, duration: 0.6, ease: "power2.in" },
      25.3 + i * 0.03,
    ),
  );
  leave(get("kiriVoicesKicker"), 25.35, { y: -352 }, 0.6);
  shape(
    { x: 0, y: 344, width: 620, height: 122, borderRadius: 22 },
    25.45,
    1.2,
  );
  t.to(
    get("kiriAudioLabel"),
    { y: 442, duration: 1.2, ease: EASE.travel },
    25.45,
  );
  look(25.5, 0, 0, 1, 1.3);

  /* ---- 05 / 26-34 — the same engine, backwards ------------------------ */

  const sttWords = words(get("kiriSttLine"), 26.15, { stagger: 0.085 });
  t.set(sttWords, { filter: "none" }, 27.85);
  leave(get("kiriSttLine"), 27.85, { y: -300 }, 0.7);
  leave(get("kiriAudioLabel"), 27.85, { y: 500 }, 0.55);

  // The generated audio does not fade out and a dropzone fade in. The same
  // surface opens, the target arrives first, and the player face leaves only
  // once something has physically taken its place.
  shape({ x: 0, y: 26, width: 1040, height: 520, borderRadius: 30 }, 27.9, 1);
  face(dropFace, 28.05, true, 0.6);
  face(audioFace, 28.25, false, 0.5);

  // The file is dragged in, not teleported.
  t.fromTo(
    upload,
    { x: -700, y: 300, autoAlpha: 0, scale: 0.9 },
    { autoAlpha: 1, scale: 1, duration: 0.5, ease: "power3.out" },
    28.5,
  );
  t.fromTo(
    cursor,
    { x: 780, y: 520, autoAlpha: 0 },
    { x: -628, y: 330, autoAlpha: 1, duration: 0.65, ease: "power2.inOut" },
    28.6,
  );
  click(cursor, 28.95);
  t.to(
    upload,
    {
      scale: 1.06,
      rotation: -4,
      boxShadow: "0 60px 120px #000000cc",
      duration: 0.24,
      ease: "power2.out",
    },
    28.95,
  );
  t.to(cursor, { x: 72, y: 56, duration: 0.95, ease: "power2.inOut" }, 29.15);
  t.to(upload, { x: 0, y: 26, duration: 0.95, ease: "power2.inOut" }, 29.15);
  t.to(
    dropFace,
    { borderColor: "#f0a44a80", backgroundColor: "#1b1712", duration: 0.3 },
    29.7,
  );
  t.to(
    get("kiriDropIcon"),
    { scale: 1.14, duration: 0.3, ease: "power2.out" },
    29.7,
  );
  click(cursor, 30.1);
  t.to(
    upload,
    {
      scale: 0.94,
      rotation: 0,
      boxShadow: "0 30px 80px #00000073",
      duration: 0.2,
      ease: "power2.out",
    },
    30.1,
  );
  t.to(
    get("kiriDropIcon"),
    { scale: 1, duration: 0.35, ease: "back.out(2)" },
    30.15,
  );
  t.to(
    dropFace,
    {
      borderColor: "#ffffff1c",
      backgroundColor: "rgba(0,0,0,0)",
      duration: 0.4,
    },
    30.2,
  );
  t.to(
    upload,
    { scale: 0.2, autoAlpha: 0, duration: 0.5, ease: "power3.in" },
    30.25,
  );
  leave(cursor, 30.3, { x: 320, y: 430 }, 0.4);

  // Target becomes document. The three advertised capabilities are proved by
  // the artefact — labelled speakers, per-segment timestamps, detected
  // languages — rather than by a row of small caption columns.
  shape(
    { x: 0, y: 30, width: 1380, height: 600, borderRadius: 28 },
    30.45,
    1.1,
  );
  face(docFace, 30.7, true, 0.6);
  face(dropFace, 30.9, false, 0.45);
  speakers.forEach((row, i) =>
    t.to(
      row,
      { y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out" },
      31.3 + i * 0.65,
    ),
  );

  /* ---- seam 05>06 / 33.4-34.6 — the document offers its formats ------- */

  look(33.4, 0, 90, 1.1, 1.3);
  t.fromTo(
    get("kiriExportControls"),
    { y: 44, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.75, ease: "power3.out" },
    33.7,
  );

  /* ---- 06 / 34-38.5 — what the transcript releases -------------------- */

  t.fromTo(
    cursor,
    { x: 780, y: 470, autoAlpha: 0 },
    { x: 505, y: 272, autoAlpha: 1, duration: 0.75, ease: "power2.inOut" },
    34.4,
  );
  click(cursor, 35.15);
  click(get("kiriExportButton"), 35.15);
  leave(cursor, 35.4, { x: 720, y: 460 }, 0.4);
  look(35.25, 0, 0, 0.94, 1.5);
  files.forEach((file, i) =>
    t.to(
      file,
      {
        x: (i - 2) * 300,
        y: -20 + Math.abs(i - 2) * 26,
        rotation: (i - 2) * 6,
        scale: 1,
        autoAlpha: 1,
        duration: 1.05,
        ease: EASE.arrive,
      },
      35.4 + i * 0.075,
    ),
  );
  // The document travels away completely rather than ghosting behind them.
  leave(host, 35.75, { y: 900 }, 1.1);
  leave(get("kiriExportControls"), 35.75, {}, 0.5);
  files.forEach((file, i) =>
    t.to(
      file,
      {
        y: "+=" + (i % 2 ? 16 : -16),
        rotation: (i - 2) * 6 + (i % 2 ? 2 : -2),
        duration: 1.6,
        ease: "sine.inOut",
      },
      36.4,
    ),
  );

  /* ---- seam 06>07 / 37.9-39.1 — the files rebuild the mark ------------ */

  files.forEach((file, i) =>
    t.to(
      file,
      {
        x: 0,
        y: -300,
        rotation: 0,
        scale: 0.04,
        autoAlpha: 0,
        duration: 0.85,
        ease: "power3.inOut",
      },
      37.9 + i * 0.055,
    ),
  );
  t.set(
    markLogo,
    { autoAlpha: 1, left: 57, top: 57, width: 186, height: 186 },
    38.2,
  );
  t.fromTo(
    mark,
    {
      x: 0,
      y: -300,
      width: 300,
      height: 300,
      borderRadius: 90,
      backgroundColor: "rgba(42,42,49,1)",
      scale: 0.3,
      rotationY: -18,
      rotationX: 0,
      autoAlpha: 0,
    },
    {
      x: 0,
      y: -300,
      width: 300,
      height: 300,
      borderRadius: 90,
      backgroundColor: "#2a2a31",
      borderColor: "#ffffff22",
      boxShadow: "0 30px 70px #00000080",
      rotationX: 0,
      scale: 0.52,
      rotationY: 0,
      autoAlpha: 1,
      duration: 0.9,
      ease: "power3.out",
      immediateRender: false,
    },
    38.3,
  );

  /* ---- 07 / 38.5-44 — the platform, in its own words ------------------ */

  // Two proof actions, each with its own reading window. No feature grid.
  look(38.5, 0, 20, 0.94, 1.3, EASE.cameraRamp);
  t.to(mark, { y: -380, duration: 1.3, ease: EASE.travel }, 38.5);
  const [apiProof, browserProof] = featureCards;
  t.fromTo(
    apiProof,
    { y: 45, autoAlpha: 0 },
    {
      y: 0,
      autoAlpha: 1,
      duration: 0.6,
      ease: "power3.out",
    },
    39.05,
  );
  t.fromTo(
    get("kiriApiResult"),
    { x: 70, autoAlpha: 0 },
    {
      x: 0,
      autoAlpha: 1,
      duration: 0.6,
      ease: "power3.out",
    },
    39.7,
  );
  leave(apiProof, 40.85, { x: -220 }, 0.55);
  t.fromTo(
    browserProof,
    { x: 220, autoAlpha: 0 },
    {
      x: 0,
      autoAlpha: 1,
      duration: 0.65,
      ease: "power3.out",
    },
    41.35,
  );
  t.fromTo(
    get("kiriBrowserHighlight"),
    { backgroundColor: "#ffffff00" },
    {
      backgroundColor: "#f0a44a40",
      duration: 0.6,
      ease: "power2.inOut",
    },
    41.65,
  );
  t.fromTo(
    get("kiriBrowserPlayer"),
    { y: 35, autoAlpha: 0 },
    {
      y: 0,
      autoAlpha: 1,
      duration: 0.6,
      ease: "power3.out",
    },
    42.05,
  );

  /* ---- seam 07>08 / 43.4-44.6 — the grid recedes, the mark returns ---- */

  leave(browserProof, 43.4, { y: 80 }, 0.6);
  leave(get("kiriFeaturesKicker"), 43.45, { y: 486 }, 0.55);
  t.to(
    mark,
    { y: -300, scale: 0.76, duration: 1.3, ease: EASE.travel },
    43.5,
  );
  look(43.5, 0, -10, 1, 1.4, EASE.settle);

  /* ---- 08 / 44-48 — the close ----------------------------------------- */

  words(get("kiriBrandLine"), 44.4, { stagger: 0.1, distance: 32 });
  t.fromTo(
    get("kiriStartBuilding"),
    { y: 300, autoAlpha: 0 },
    { y: 244, autoAlpha: 1, duration: 0.85, ease: "power3.out" },
    45.5,
  );
  t.to(
    mark,
    { y: -312, rotationY: 9, duration: 2.6, ease: "sine.inOut" },
    45.3,
  );
  look(45.4, 0, -6, 1.03, 2.6, "sine.inOut");
}

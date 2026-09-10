import { gsap } from "gsap";

export function buildAppleNotesTimeline({
  root,
  timeline: masterTimeline,
  register,
}) {
  const timeline = gsap.timeline({ paused: true });
  const playbackScale = 1.3;
  const get = (id) => root.querySelector(`[data-edit='${id}']`);
  const all = (selector) => Array.from(root.querySelectorAll(selector));

  all("[data-edit]").forEach((element) =>
    register(element.dataset.edit, element),
  );

  const stage = get("notesFilmRoot");
  const paper = get("notesPaperField");
  const camera = get("notesCameraWorld");

  // Scene 1: Hook (Claude-Grade Cinematic Statement)
  const intro = get("notesStageIntro");
  const introTitle = get("notesIntroTitle");
  const brandMark = get("notesBrandMark");
  const introPrefix = introTitle?.querySelector(".notes-editorial-prefix");
  const introHighlight = introTitle?.querySelector(
    ".notes-editorial-highlight",
  );
  const scribble = get("notesBlueScribble");
  const scribblePath = root.querySelector(".notes-scribble-path");

  // Scene 2: Scattered Inputs & Carrier
  const fragments = get("notesStageFragments");
  const fragmentDeck = get("notesFragmentDeck");
  const safariCard = get("notesSafariCard");
  const voiceCard = get("notesVoiceCard");
  const photoCard1 = get("notesPhotoCard1");
  const captureCard = get("notesCaptureCard");
  const waveBars = all(".notes-wave-bar");

  // Scene 3: Notes Workspace Proof
  const pills = get("notesStagePills");
  const appShell = get("notesAppShell");
  const toolbar = root.querySelector(".notes-toolbar");
  const folders = all(".notes-folder");
  const listItems = all(".notes-list-item");
  const editorHead = root.querySelector(".notes-editor h2");
  const editorBody = root.querySelector(".notes-editor p");
  const checkRows = all(".notes-check-row");
  const checkmark = get("notesCheckmarkIcon");
  const checkText2 = get("notesCheckText2");
  const cursor = get("notesCursor");

  // Scene 4: Ecosystem Sync
  const ecosystem = get("notesStageEcosystem");
  const ecosystemStatement = get("notesEcosystemStatement");
  const ecosystemPrefix = ecosystemStatement?.querySelector(
    ".notes-editorial-prefix",
  );
  const ecosystemHighlight = ecosystemStatement?.querySelector(
    ".notes-editorial-highlight",
  );

  // Scene 5: Grand Climax
  const climax = get("notesStageClimax");
  const climaxIcon = get("notesClimaxIcon");
  const climaxTitle = get("notesClimaxTitle");
  const climaxPrefix = climaxTitle?.querySelector(".notes-editorial-prefix");
  const climaxHighlight = climaxTitle?.querySelector(
    ".notes-editorial-highlight",
  );
  const climaxTagline = get("notesClimaxTagline");

  const required = [
    stage,
    paper,
    camera,
    intro,
    introTitle,
    brandMark,
    scribble,
    scribblePath,
    fragments,
    fragmentDeck,
    safariCard,
    voiceCard,
    photoCard1,
    captureCard,
    pills,
    appShell,
    checkmark,
    cursor,
    ecosystem,
    ecosystemStatement,
    climax,
    climaxIcon,
    climaxTitle,
    climaxTagline,
  ];
  if (required.some((element) => !element)) {
    throw new Error(
      "Apple Notes preset composition is missing required elements.",
    );
  }

  // ============================================================
  // INITIAL DETERMINISTIC SETUP AT t = 0
  // ============================================================
  timeline.set(stage, { autoAlpha: 1 }, 0);
  timeline.set(paper, { scale: 1.04, x: 0, y: 0 }, 0);
  timeline.set(camera, { x: 0, y: 0, scale: 1, rotateZ: 0 }, 0);

  // Strict layer segregation: Hide all non-intro scene stages completely
  timeline.set(
    [fragments, pills, ecosystem, climax],
    { display: "none", autoAlpha: 0 },
    0,
  );
  timeline.set(intro, { display: "grid", autoAlpha: 1 }, 0);

  // Scene 1 elements
  timeline.set(
    scribblePath,
    { strokeDasharray: 980, strokeDashoffset: 980 },
    0,
  );
  timeline.set(introTitle, { scale: 1.35, autoAlpha: 0 }, 0);
  timeline.set(brandMark, { scale: 0, rotate: -40, autoAlpha: 0 }, 0);
  timeline.set(introPrefix, { autoAlpha: 0, y: 20 }, 0);
  timeline.set(introHighlight, { autoAlpha: 0, y: 65 }, 0);

  // Scene 2 elements
  timeline.set(
    [safariCard, voiceCard, photoCard1],
    { autoAlpha: 0, scale: 0.85 },
    0,
  );
  timeline.set(captureCard, { autoAlpha: 0, scale: 0.82 }, 0);

  // Scene 3 elements
  timeline.set(appShell, { autoAlpha: 0, scale: 0.95 }, 0);
  timeline.set([toolbar, editorHead, editorBody], { autoAlpha: 0, y: 20 }, 0);
  timeline.set(
    [...folders, ...listItems, ...checkRows],
    { autoAlpha: 0, y: 20 },
    0,
  );
  timeline.set(cursor, { autoAlpha: 0, x: 1200, y: 700 }, 0);

  // Scene 4 elements
  timeline.set(ecosystemStatement, { scale: 1.35, autoAlpha: 0 }, 0);
  timeline.set(
    [ecosystemPrefix, ecosystemHighlight],
    { autoAlpha: 0, y: 20 },
    0,
  );

  // Scene 5 elements
  timeline.set(climaxIcon, { autoAlpha: 0, scale: 0.5, rotate: -30 }, 0);
  timeline.set(
    [climaxPrefix, climaxHighlight, climaxTagline],
    { autoAlpha: 0, y: 30 },
    0,
  );

  // ============================================================
  // SCENE 1: HOOK — "Every useful idea starts as something easy to lose." (0.0s – 3.6s)
  // Executed with the exact same prestige and kinetic lockup as Claude is Everywhere!
  // ============================================================
  // 1. Giant-to-Settle Kinetic Zoom: enters large (scale: 1.35) and settles cleanly into 1.0
  timeline.fromTo(
    introTitle,
    { scale: 1.35, autoAlpha: 0 },
    { scale: 1.0, autoAlpha: 1, duration: 0.7, ease: "power3.out" },
    0.15,
  );

  // 2. Brand Icon blooms and rotates with spring bounce
  timeline.fromTo(
    brandMark,
    { scale: 0, rotate: -40, autoAlpha: 0 },
    { scale: 1, rotate: 0, autoAlpha: 1, duration: 0.6, ease: "back.out(1.8)" },
    0.18,
  );

  // 3. Prefix enters cleanly
  timeline.fromTo(
    introPrefix,
    { autoAlpha: 0, y: 20 },
    { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" },
    0.25,
  );

  // 4. Highlight slides UP from overflow box in radiant amber to finish the statement
  timeline.fromTo(
    introHighlight,
    { autoAlpha: 0, y: 65 },
    { autoAlpha: 1, y: 0, duration: 0.6, ease: "back.out(1.4)" },
    0.5,
  );

  // 5. Blue ink signature draws smoothly underneath
  timeline.to(
    scribblePath,
    { strokeDashoffset: 0, duration: 1.3, ease: "power2.inOut" },
    0.8,
  );

  // Subtle continuous paper and typography breathing
  timeline.to(
    paper,
    { x: -14, y: 8, scale: 1.06, duration: 3.5, ease: "sine.inOut" },
    0.15,
  );
  timeline.to(
    introTitle,
    { scale: 1.03, duration: 2.1, ease: "sine.inOut" },
    0.9,
  );

  // Pristine optical zoom-out exit
  timeline.to(
    introTitle,
    {
      scale: 1.16,
      y: -30,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.55,
      ease: "power3.in",
    },
    3.15,
  );
  timeline.to(
    scribble,
    { autoAlpha: 0, scaleX: 1.2, duration: 0.45, ease: "power2.in" },
    3.2,
  );

  // ============================================================
  // SCENE 2: FLOATING INPUTS & CAMERA ZOOM REVIEW (3.6s – 7.4s)
  // "UI components float and camera zooms to review each one!"
  // ============================================================
  timeline.set(intro, { display: "none", autoAlpha: 0 }, 3.6);
  timeline.set(fragments, { display: "grid", autoAlpha: 1 }, 3.6);
  timeline.set(
    camera,
    { x: 0, y: 0, scale: 1, rotateX: 0, rotateY: 0, rotateZ: 0 },
    3.6,
  );

  // Central Quick Note Carrier card arrives in center with tactile spring bounce
  timeline.fromTo(
    captureCard,
    { autoAlpha: 0, scale: 0.8, y: 30 },
    { autoAlpha: 1, scale: 1.0, y: 0, duration: 0.7, ease: "back.out(1.35)" },
    3.65,
  );

  // Floating UI Components arrive in 3D space with staggered momentum
  timeline.fromTo(
    safariCard,
    { autoAlpha: 0, x: -160, y: -60, rotation: -8, scale: 0.82 },
    {
      autoAlpha: 1,
      x: 0,
      y: 0,
      rotation: -3,
      scale: 1,
      duration: 0.7,
      ease: "back.out(1.3)",
    },
    3.85,
  );
  timeline.fromTo(
    voiceCard,
    { autoAlpha: 0, x: 160, y: -60, rotation: 8, scale: 0.82 },
    {
      autoAlpha: 1,
      x: 0,
      y: 0,
      rotation: 3,
      scale: 1,
      duration: 0.7,
      ease: "back.out(1.3)",
    },
    4.05,
  );
  timeline.fromTo(
    photoCard1,
    { autoAlpha: 0, y: 90, rotation: -6, scale: 0.82 },
    {
      autoAlpha: 1,
      y: 0,
      rotation: -2,
      scale: 1,
      duration: 0.7,
      ease: "back.out(1.3)",
    },
    4.25,
  );

  // Dynamic Floating UI Motion: Subtle continuous 3D levitation on the cards
  timeline.to(
    safariCard,
    {
      y: "-=12",
      rotation: -1.5,
      duration: 1.4,
      yoyo: true,
      repeat: 2,
      ease: "sine.inOut",
    },
    4.1,
  );
  timeline.to(
    voiceCard,
    {
      y: "+=10",
      rotation: 4.5,
      duration: 1.3,
      yoyo: true,
      repeat: 2,
      ease: "sine.inOut",
    },
    4.3,
  );
  timeline.to(
    photoCard1,
    {
      y: "-=8",
      rotation: -0.5,
      duration: 1.5,
      yoyo: true,
      repeat: 2,
      ease: "sine.inOut",
    },
    4.5,
  );

  // Equalizer wave bars bounce rhythmically on Voice Memo
  waveBars.forEach((bar, index) => {
    timeline.to(
      bar,
      {
        scaleY: index % 2 ? 0.4 : 1.5,
        duration: 0.2,
        repeat: 7,
        yoyo: true,
        ease: "sine.inOut",
      },
      4.3 + index * 0.04,
    );
  });

  // Dynamic Camera Movement: Zoom into each floating UI component to review them!
  // 1. Zoom into Safari Research card (centers Safari card)
  timeline.to(
    camera,
    {
      scale: 1.42,
      x: 500,
      y: 120,
      rotateZ: -1.2,
      rotateX: 1.5,
      rotateY: -2.5,
      duration: 0.85,
      ease: "power3.inOut",
    },
    3.9,
  );

  // 2. Camera sweeps across in 3D to review the Voice Memo card (centers Voice memo)
  timeline.to(
    camera,
    {
      scale: 1.46,
      x: -500,
      y: 110,
      rotateZ: 1.4,
      rotateX: 1,
      rotateY: 2.5,
      duration: 0.95,
      ease: "power3.inOut",
    },
    4.75,
  );

  // 3. Camera swoops down to review the Whiteboard Strategy diagram card (centers Whiteboard)
  timeline.to(
    camera,
    {
      scale: 1.44,
      x: 460,
      y: -260,
      rotateZ: -1,
      rotateX: -1,
      rotateY: -1.8,
      duration: 0.85,
      ease: "power3.inOut",
    },
    5.65,
  );

  // 4. Camera pulls back smoothly as all 3 floating cards converge into Quick Note carrier
  timeline.to(
    camera,
    {
      scale: 1.05,
      x: 0,
      y: 0,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      duration: 0.85,
      ease: "power3.inOut",
    },
    6.4,
  );

  // Causal Convergence: cards smoothly slide directly INTO the Quick Note card
  timeline.to(
    safariCard,
    {
      x: 380,
      y: 60,
      scale: 0.1,
      rotation: 0,
      autoAlpha: 0,
      duration: 0.55,
      ease: "power3.in",
    },
    6.45,
  );
  timeline.to(
    voiceCard,
    {
      x: -380,
      y: 60,
      scale: 0.1,
      rotation: 0,
      autoAlpha: 0,
      duration: 0.55,
      ease: "power3.in",
    },
    6.5,
  );
  timeline.to(
    photoCard1,
    {
      x: 280,
      y: -200,
      scale: 0.1,
      rotation: 0,
      autoAlpha: 0,
      duration: 0.55,
      ease: "power3.in",
    },
    6.55,
  );

  // Carrier card pulses with golden amber bloom and spring scale as it absorbs the inputs
  timeline.to(
    captureCard,
    {
      scale: 1.08,
      boxShadow: "0 45px 120px rgba(255, 159, 10, 0.45)",
      duration: 0.35,
      ease: "back.out(1.5)",
    },
    6.85,
  );
  timeline.to(
    captureCard,
    { scale: 1.0, duration: 0.35, ease: "power2.inOut" },
    7.2,
  );

  // ============================================================
  // SCENE 3: APPLE NOTES WORKSPACE PROOF (7.4s – 14.0s)
  // Seamless Morph + 2.5D Construction + Deep Macro Zoom on Checklist + Continuous Camera Drift!
  // ============================================================
  timeline.set(pills, { display: "grid", autoAlpha: 1 }, 7.4);
  timeline.fromTo(
    appShell,
    {
      autoAlpha: 0.9,
      scale: 0.38,
      borderRadius: "28px",
    },
    {
      autoAlpha: 1,
      scale: 1.0,
      borderRadius: "32px",
      duration: 0.85,
      ease: "power3.inOut",
    },
    7.42,
  );
  timeline.set(captureCard, { autoAlpha: 0 }, 7.55);
  timeline.set(fragments, { display: "none", autoAlpha: 0 }, 7.6);

  // 1. Camera dives into dynamic 2.5D perspective to watch sidebar & note list construct
  timeline.to(
    camera,
    {
      scale: 1.25,
      x: 220,
      y: 60,
      rotateY: 3.5,
      rotateX: 2,
      duration: 1.1,
      ease: "power3.out",
    },
    7.55,
  );

  // Architectural UI Construction in reading order
  timeline.fromTo(
    toolbar,
    { y: -20, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out" },
    7.95,
  );
  timeline.to(
    folders,
    { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.07, ease: "power3.out" },
    8.15,
  );
  timeline.to(
    listItems,
    { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.08, ease: "power3.out" },
    8.45,
  );
  timeline.fromTo(
    [editorHead, editorBody],
    { y: 24, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.1, ease: "power3.out" },
    8.75,
  );
  timeline.to(
    checkRows,
    { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.1, ease: "back.out(1.3)" },
    9.05,
  );

  // 2. Camera sweeps across from sidebar directly into DEEP MACRO ZOOM on the checklist
  timeline.to(
    camera,
    {
      scale: 1.76,
      x: -300,
      y: -75,
      rotateY: -1.2,
      rotateX: 1,
      duration: 1.15,
      ease: "power3.inOut",
    },
    9.15,
  );

  // macOS pointer arrives and glides to target checkbox
  timeline.fromTo(
    cursor,
    { autoAlpha: 0, x: 1220, y: 640 },
    { autoAlpha: 1, x: 990, y: 490, duration: 0.7, ease: "power3.out" },
    9.65,
  );

  // Cursor taps checkbox with tactile squash
  timeline.to(
    cursor,
    { scale: 0.82, duration: 0.1, yoyo: true, repeat: 1, ease: "power2.inOut" },
    10.3,
  );

  // Checkmark circle blooms into vibrant Notes yellow and checks off
  timeline.to(
    checkmark,
    {
      backgroundColor: "#ffd60a",
      borderColor: "#ffd60a",
      color: "#5d4900",
      scale: 1.28,
      duration: 0.22,
      ease: "back.out(2.0)",
    },
    10.4,
  );
  timeline.to(
    checkmark,
    { scale: 1.0, duration: 0.18, ease: "power2.out" },
    10.62,
  );

  // Checklist row text gets subtle completed styling
  timeline.to(
    checkText2,
    { color: "#8e8e93", duration: 0.25, ease: "power2.out" },
    10.5,
  );

  // Cursor glides away and fades out
  timeline.to(
    cursor,
    { x: 1060, y: 550, autoAlpha: 0, duration: 0.45, ease: "power2.in" },
    10.75,
  );

  // 3. CONTINUOUS CINEMATIC DRIFT & RE-FRAMING (NO STATIC/FROZEN WINDOW!)
  // The camera pulls back into an alive floating re-framing with continuous drift
  timeline.to(
    camera,
    {
      scale: 1.2,
      x: -90,
      y: -20,
      rotateY: 1.5,
      rotateX: -0.8,
      duration: 1.5,
      ease: "sine.inOut",
    },
    11.0,
  );
  timeline.to(
    camera,
    {
      scale: 1.14,
      x: -20,
      y: 10,
      rotateY: -0.8,
      rotateX: 0.5,
      duration: 1.4,
      ease: "sine.inOut",
    },
    12.4,
  );
  timeline.to(
    appShell,
    { y: -8, duration: 1.4, yoyo: true, repeat: 1, ease: "sine.inOut" },
    11.2,
  );

  // 4. Seamless Cinematic Zoom-Through into Scene 4
  timeline.to(
    camera,
    { scale: 1.38, z: 120, duration: 0.65, ease: "power3.in" },
    13.6,
  );
  timeline.to(
    appShell,
    {
      autoAlpha: 0,
      filter: "blur(14px)",
      duration: 0.6,
      ease: "power3.in",
    },
    13.65,
  );
  timeline.set(pills, { display: "none", autoAlpha: 0 }, 14.25);
  timeline.set(
    camera,
    { scale: 1.0, x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0 },
    14.2,
  );

  // ============================================================
  // SCENE 4: ECOSYSTEM STATEMENT (14.2s – 18.2s)
  // Pure, centered, isolated editorial thought — NO MOCKUPS!
  // ============================================================
  timeline.set(ecosystem, { display: "grid", autoAlpha: 1 }, 14.2);

  // Luminous subtle continuous breathing camera drift
  timeline.to(camera, { scale: 1.04, duration: 3.5, ease: "sine.inOut" }, 14.3);

  // Giant-to-Settle Kinetic Zoom: enters large (scale: 1.35) and settles cleanly into 1.0
  timeline.fromTo(
    ecosystemStatement,
    { scale: 1.35, autoAlpha: 0 },
    { scale: 1.0, autoAlpha: 1, duration: 0.65, ease: "power3.out" },
    14.25,
  );

  // Prefix enters with luminous clarity
  timeline.fromTo(
    ecosystemPrefix,
    { autoAlpha: 0, y: 20 },
    { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" },
    14.35,
  );

  // "available everywhere." slides UP from overflow box in vibrant Notes amber
  timeline.fromTo(
    ecosystemHighlight,
    { autoAlpha: 0, y: 65 },
    { autoAlpha: 1, y: 0, duration: 0.6, ease: "back.out(1.4)" },
    14.65,
  );

  // Rock-solid reading hold with subtle continuous breathing drift
  timeline.to(
    ecosystemStatement,
    { scale: 1.03, duration: 2.5, ease: "sine.inOut" },
    14.7,
  );

  // Pristine optical zoom-out transition
  timeline.to(
    ecosystemStatement,
    {
      scale: 1.15,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.55,
      ease: "power3.in",
    },
    17.6,
  );

  // ============================================================
  // SCENE 5: GRAND CLIMAX — "Everything worth keeping, in one place." (18.2s – 24.0s)
  // Official Apple Notes App Icon + statement + Open Notes CTA
  // ============================================================
  timeline.set(ecosystem, { display: "none", autoAlpha: 0 }, 18.15);
  timeline.set(climax, { display: "grid", autoAlpha: 1 }, 18.2);

  // Note card resolves directly into the official Apple Notes App Icon
  timeline.fromTo(
    climaxIcon,
    { autoAlpha: 0, scale: 0.5, rotate: -30 },
    {
      autoAlpha: 1,
      scale: 1.0,
      rotate: 0,
      duration: 0.65,
      ease: "back.out(1.6)",
    },
    18.25,
  );

  // "Everything worth keeping," enters centered
  timeline.fromTo(
    climaxPrefix,
    { autoAlpha: 0, y: 20 },
    { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" },
    18.6,
  );

  // "in one place." slides UP from overflow box in radiant amber to finish the statement!
  timeline.fromTo(
    climaxHighlight,
    { autoAlpha: 0, y: 65 },
    { autoAlpha: 1, y: 0, duration: 0.6, ease: "back.out(1.4)" },
    18.95,
  );

  // "Open Notes" CTA capsule blooms below
  timeline.fromTo(
    climaxTagline,
    { autoAlpha: 0, scale: 0.84, y: 25 },
    { autoAlpha: 1, scale: 1.0, y: 0, duration: 0.5, ease: "back.out(1.35)" },
    19.5,
  );

  // Rock-solid reading hold with subtle breathing scale to 24.0s
  timeline.to(
    climax,
    { scale: 1.025, duration: 4.4, ease: "sine.inOut" },
    19.5,
  );
  timeline.set(climax, { autoAlpha: 1 }, 24.0);

  // Scale timeline to master playback
  timeline.timeScale(1 / playbackScale).paused(false);
  masterTimeline.add(timeline, 0);
  return masterTimeline;
}

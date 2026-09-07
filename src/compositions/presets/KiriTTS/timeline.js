import { continuousTextGradient, giantKineticCrop, matchCut } from "../../../composition/presets";
import { gsap } from "gsap";

export function buildKiriTtsTimeline(context) {
  const { root, timeline: masterTimeline, register } = context;
  const timeline = gsap.timeline({ paused: true });
  const playbackScale = 1.3;
  const get = (id) => root.querySelector(`[data-edit='${id}']`);

  const ids = [
    // Root, Camera, Ambience & Tactile Cursor
    "kiriFilmRoot",
    "kiriCameraWorld",
    "kiriAmbientGlow",
    "kiriCursor",
    "kiriCursorRipple",

    // Authentic KiriTTS Topbar (No fake Claude sidebar!)
    "kiriTopbar",
    "kiriTopBreadcrumb",
    "kiriBreadcrumbText",
    "kiriTopRightActions",
    "kiriTopCredits",
    "kiriTopAvatar",

    // Main Stage Workspace
    "kiriStageWorkspace",

    // Act 1: The Linguistic Crisis & Native Word Boundary Segmentation (0–5.5s)
    "kiriAct1Linguistic",
    "kiriAct1Headline",
    "kiriMonolithicBox",
    "kiriErrorBadge1",
    "kiriUnspacedScript",
    "kiriRobotWave",
    "kiriErrorBadge2",
    "kiriSegmentBeam",
    "kiriSegmentedWords",
    "kiriWordChip1",
    "kiriWordChip2",
    "kiriWordChip3",
    "kiriWordChip4",
    "kiriNativeSolvedBadge",

    // Act 2: Real KiriTTS Studio Workspace (TTS.png: Left Editor + Right Settings) (5.5–12.0s)
    "kiriAct2TtsStudio",
    "kiriLineEditor",
    "kiriVoicePill",
    "kiriExprToggles",
    "kiriEditorRow1",
    "kiriTypedKhmer",
    "kiriTtsCaret",
    "kiriEditorRow2",
    "kiriRow2Notice",
    "kiriBtnGenerate",
    "kiriAudioPlayerCard",
    "kiriEqWaveBars",
    "kiriRightSettingsPanel",
    "kiriStabilitySlider",
    "kiriFillStability",
    "kiriThumbStability",
    "kiriSpeedSlider",
    "kiriFillSpeed",
    "kiriThumbSpeed",

    // Act 3: Speech-to-Text, Diarization & Word-Level Timestamps (STT.png) (12.0–18.5s)
    "kiriAct3SttStudio",
    "kiriSttDropCard",
    "kiriDroppedAudioChip",
    "kiriBtnExportSrt",
    "kiriDiarizeStream",
    "kiriDiarizeSpeaker1",
    "kiriTimestampPills",
    "kiriDiarizeSpeaker2",
    "kiriSrtSuccessBadge",

    // Act 4: 10s Voice Cloning & OpenAI-Compatible REST API (Voice Cloning.png + API.png) (18.5–24.5s)
    "kiriAct4CloneApi",
    "kiriCloneCard",
    "kiri10sSampleBadge",
    "kiriProgressRing",
    "kiriProgCircle",
    "kiriVerifiedProfile",
    "kiriAmberDisclaimer",
    "kiriApiCard",
    "kiriApiHubLogo",
    "kiriEndpointBox",
    "kiriLiveCounter",

    // Act 5: Grand Climax & Landing Hero (Landing Page.png) (24.5–28.5s)
    "kiriAct5Climax",
    "kiriClimaxEmblem",
    "kiriClimaxHeadline",
    "kiriClimaxSubtitle",
    "kiriClimaxCtas",
    "kiriBtnGetStarted",
    "kiriCtaShimmer",

    // Pure SaaS Kinetic Editorial Stage & Feature Transitions
    "kiriEditorialStage",
    "kiriBeatIntro",
    "kiriBeatIntroText",
    "kiriBeatObstacle",
    "kiriBeatObstacleText",
    "kiriBeatSolution",
    "kiriBeatSolutionText",
    "kiriBannerStt",
    "kiriBannerClone",
  ];

  ids.forEach((id) => {
    const element = get(id);
    if (!element) throw new Error(`KiriTTS preset is missing [data-edit='${id}']`);
    register(id, element);
  });

  // Core Stage & Camera Elements
  const stage = get("kiriFilmRoot");
  const camera = get("kiriCameraWorld");
  const ambientGlow = get("kiriAmbientGlow");
  const cursor = get("kiriCursor");
  const cursorRipple = get("kiriCursorRipple");

  // Topbar Elements
  const topbar = get("kiriTopbar");
  const topBreadcrumb = get("kiriTopBreadcrumb");
  const breadcrumbText = get("kiriBreadcrumbText");
  const topRightActions = get("kiriTopRightActions");
  const topCredits = get("kiriTopCredits");
  const topAvatar = get("kiriTopAvatar");

  // Act 1 Elements
  const act1 = get("kiriAct1Linguistic");
  const act1Headline = get("kiriAct1Headline");
  const monolithicBox = get("kiriMonolithicBox");
  const errorBadge1 = get("kiriErrorBadge1");
  const unspacedScript = get("kiriUnspacedScript");
  const robotWave = get("kiriRobotWave");
  const errorBadge2 = get("kiriErrorBadge2");
  const segmentBeam = get("kiriSegmentBeam");
  const segmentedWords = get("kiriSegmentedWords");
  const wordChips = [
    get("kiriWordChip1"),
    get("kiriWordChip2"),
    get("kiriWordChip3"),
    get("kiriWordChip4"),
  ];
  const nativeSolvedBadge = get("kiriNativeSolvedBadge");

  // Act 2 Elements
  const act2 = get("kiriAct2TtsStudio");
  const lineEditor = get("kiriLineEditor");
  const voicePill = get("kiriVoicePill");
  const exprToggles = get("kiriExprToggles");
  const editorRow1 = get("kiriEditorRow1");
  const typedKhmer = get("kiriTypedKhmer");
  const ttsCaret = get("kiriTtsCaret");
  const editorRow2 = get("kiriEditorRow2");
  const row2Notice = get("kiriRow2Notice");
  const btnGenerate = get("kiriBtnGenerate");
  const audioPlayerCard = get("kiriAudioPlayerCard");
  const eqWaveBars = get("kiriEqWaveBars");
  const rightSettingsPanel = get("kiriRightSettingsPanel");
  const stabilitySlider = get("kiriStabilitySlider");
  const fillStability = get("kiriFillStability");
  const thumbStability = get("kiriThumbStability");
  const speedSlider = get("kiriSpeedSlider");
  const fillSpeed = get("kiriFillSpeed");
  const thumbSpeed = get("kiriThumbSpeed");
  const borderBeamRect = root.querySelector(".kiri-border-beam-rect");

  // Act 3 Elements
  const act3 = get("kiriAct3SttStudio");
  const sttDropCard = get("kiriSttDropCard");
  const droppedAudioChip = get("kiriDroppedAudioChip");
  const btnExportSrt = get("kiriBtnExportSrt");
  const diarizeStream = get("kiriDiarizeStream");
  const diarizeSpeaker1 = get("kiriDiarizeSpeaker1");
  const timestampPills = get("kiriTimestampPills");
  const diarizeSpeaker2 = get("kiriDiarizeSpeaker2");
  const srtSuccessBadge = get("kiriSrtSuccessBadge");

  // Act 4 Elements
  const act4 = get("kiriAct4CloneApi");
  const cloneCard = get("kiriCloneCard");
  const sample10sBadge = get("kiri10sSampleBadge");
  const progressRing = get("kiriProgressRing");
  const progCircle = get("kiriProgCircle");
  const progLabel = root.querySelector(".kiri-prog-label");
  const verifiedProfile = get("kiriVerifiedProfile");
  const amberDisclaimer = get("kiriAmberDisclaimer");
  const apiCard = get("kiriApiCard");
  const apiHubLogo = get("kiriApiHubLogo");
  const endpointBox = get("kiriEndpointBox");
  const liveCounter = get("kiriLiveCounter");
  const counterNumber = root.querySelector(".kiri-counter-number");

  // Act 5 Elements
  const act5 = get("kiriAct5Climax");
  const climaxEmblem = get("kiriClimaxEmblem");
  const climaxHeadline = get("kiriClimaxHeadline");
  const climaxSubtitle = get("kiriClimaxSubtitle");
  const climaxCtas = get("kiriClimaxCtas");
  const btnGetStarted = get("kiriBtnGetStarted");
  const ctaShimmer = get("kiriCtaShimmer");

  // Kinetic Typography & Transition Elements
  const editorialStage = get("kiriEditorialStage");
  const beatIntro = get("kiriBeatIntro");
  const beatIntroText = get("kiriBeatIntroText");
  const beatObstacle = get("kiriBeatObstacle");
  const beatObstacleText = get("kiriBeatObstacleText");
  const beatSolution = get("kiriBeatSolution");
  const beatSolutionText = get("kiriBeatSolutionText");
  const bannerStt = get("kiriBannerStt");
  const bannerClone = get("kiriBannerClone");

  [beatIntroText, beatObstacleText, beatSolutionText, bannerStt.querySelector(".kiri-editorial-text"), bannerClone.querySelector(".kiri-editorial-text"), climaxHeadline].forEach((element) => {
    continuousTextGradient(element, "linear-gradient(96deg,#ffffff 0%,#ffffff 28%,#00d2ff 56%,#10b981 78%,#ffffff 100%)");
  });

  // Typewriter Helper (Character-by-character with tight 0px caret alignment)
  const typeText = (targetSpan, text, start, duration) => {
    timeline.set(targetSpan, { textContent: "" }, 0);
    timeline.set(targetSpan, { textContent: "" }, start);
    const obj = { count: 0 };
    timeline.fromTo(
      obj,
      { count: 0 },
      {
        count: text.length,
        duration: duration,
        ease: `steps(${text.length})`,
        onUpdate: () => {
          targetSpan.textContent = text.slice(0, Math.round(obj.count));
        },
      },
      start
    );
  };

  // Metric Counter Animation Helper
  const animateCounter = (targetElement, startVal, endVal, suffix, start, duration) => {
    const obj = { val: startVal };
    timeline.fromTo(
      obj,
      { val: startVal },
      {
        val: endVal,
        duration,
        ease: "power2.out",
        onUpdate: () => {
          targetElement.textContent = Math.round(obj.val).toLocaleString() + suffix;
        },
      },
      start
    );
  };

  // Kinetic Editorial Sentence Word-by-Word Animation Helper
  const animateSentenceWords = (beatElement, start, duration = 0.96, stagger = 0.07) => {
    const sentence = beatElement.querySelector(".kiri-editorial-text");
    timeline.set(beatElement, { autoAlpha: 1, xPercent: -50, yPercent: -50 }, start);
    giantKineticCrop(timeline, sentence, {
      at: start,
      unit: "words",
      startScale: 2.35,
      endScale: 1,
      duration,
      stagger,
      settleEase: "back.out(1.35)",
    });
  };

  const exitSentenceWords = (beatElement, start, duration = 0.48) => {
    const exitDuration = Math.max(duration, 0.48);
    const motionLayer = beatElement.querySelector(".motionly-text-motion-layer") || beatElement.querySelector(".kiri-editorial-text");
    timeline.to(motionLayer, {
      autoAlpha: 0,
      y: -28,
      scale: 3.4,
      filter: "blur(9px)",
      duration: exitDuration,
      ease: "expo.in",
    }, start);
    timeline.set(beatElement, { autoAlpha: 0 }, start + exitDuration);
  };

  const centerInStage = (element) => {
    let x = element.offsetWidth / 2;
    let y = element.offsetHeight / 2;
    let current = element;
    while (current && current !== root) {
      x += current.offsetLeft || 0;
      y += current.offsetTop || 0;
      current = current.offsetParent;
    }
    return { x, y };
  };
  const projectThroughCamera = (element, pose) => {
    const point = centerInStage(element);
    return {
      x: (point.x - 960) * pose.scale + 960 + pose.x,
      y: (point.y - 540) * pose.scale + 540 + pose.y,
    };
  };
  const generateTarget = projectThroughCamera(btnGenerate, { scale: 1.48, x: -320, y: -120 });
  const exportTarget = projectThroughCamera(btnExportSrt, { scale: 1.42, x: -300, y: 110 });

  // ============================================================
  // INITIAL ZERO STATES (t = 0.0s)
  // ============================================================
  timeline.set(stage, { autoAlpha: 1 }, 0);
  timeline.set(camera, { x: 0, y: 0, scale: 1.0, rotateX: 0, rotateY: 0, rotateZ: 0, z: 0 }, 0);
  timeline.set(ambientGlow, { display: "none", autoAlpha: 0 }, 0);

  // Tactile Cursor & Ripple
  timeline.set(cursor, { autoAlpha: 0, x: 1400, y: 700, scale: 1 }, 0);
  timeline.set(cursorRipple, { autoAlpha: 0, scale: 0.5 }, 0);

  // Pure SaaS Kinetic Editorial Stage & Feature Transitions Zero States
  timeline.set(editorialStage, { autoAlpha: 1 }, 0);
  timeline.set([beatIntro, beatObstacle, beatSolution, bannerStt, bannerClone], {
    autoAlpha: 0,
    xPercent: -50,
    yPercent: -50,
  }, 0);

  // Authentic Website Navbar - Hidden Completely
  timeline.set([topbar, topBreadcrumb, topRightActions, topCredits, topAvatar], { display: "none", autoAlpha: 0 }, 0);

  // Act 1 Initial State (Active first view)
  timeline.set(act1, { autoAlpha: 1, display: "flex", scale: 1, y: 0 }, 0);
  timeline.set(act1Headline, { display: "none", autoAlpha: 0 }, 0);
  timeline.set(monolithicBox, { autoAlpha: 0, scale: 0.94, y: 28, rotateX: 7, rotateY: -8, z: -70, transformPerspective: 1200 }, 0);
  timeline.set(errorBadge1, { autoAlpha: 0, scale: 0.8 }, 0);
  timeline.set(errorBadge2, { autoAlpha: 0, y: 6 }, 0);
  timeline.set(segmentBeam, { autoAlpha: 0, x: 0 }, 0);
  timeline.set(segmentedWords, { autoAlpha: 0, display: "none" }, 0);
  wordChips.forEach((chip) => timeline.set(chip, { scale: 0.82, autoAlpha: 0 }, 0));
  timeline.set(nativeSolvedBadge, { autoAlpha: 0, scale: 0.85, y: 10 }, 0);

  // Act 2 Initial State (Hidden until morphed into)
  timeline.set(act2, { autoAlpha: 0, display: "none", scale: 0.95, y: 20 }, 0);
  timeline.set(lineEditor, { autoAlpha: 0, scale: 0.96, rotateX: 5, rotateY: -7, z: -55, transformPerspective: 1200 }, 0);
  timeline.set(typedKhmer, { textContent: "" }, 0);
  timeline.set(ttsCaret, { autoAlpha: 0 }, 0);
  timeline.set(editorRow2, { autoAlpha: 0, y: 12 }, 0);
  timeline.set(rightSettingsPanel, { autoAlpha: 0, x: 25, rotateX: 3, rotateY: 9, z: -45, transformPerspective: 1200 }, 0);
  timeline.set(fillStability, { scaleX: 0.533, transformOrigin: "0% 50%" }, 0);
  timeline.set(thumbStability, { x: -98 }, 0);
  timeline.set(fillSpeed, { scaleX: 0.545, transformOrigin: "0% 50%" }, 0);
  timeline.set(thumbSpeed, { x: -126 }, 0);
  timeline.set(btnGenerate, { scale: 1 }, 0);
  timeline.set(audioPlayerCard, { autoAlpha: 0, scale: 0.92, y: 16, rotateX: 7, z: -65, transformPerspective: 1200 }, 0);
  if (borderBeamRect) {
    timeline.set(borderBeamRect, { opacity: 0, strokeDashoffset: 2480 }, 0);
  }

  // Act 3 Initial State
  timeline.set(act3, { autoAlpha: 0, display: "none", scale: 0.95, y: 20 }, 0);
  timeline.set(sttDropCard, { autoAlpha: 0, scale: 0.96, rotateX: 5, rotateY: -6, z: -60, transformPerspective: 1200 }, 0);
  timeline.set(droppedAudioChip, { autoAlpha: 0, x: -20 }, 0);
  timeline.set(btnExportSrt, { autoAlpha: 0, scale: 0.85 }, 0);
  timeline.set(diarizeSpeaker1, { autoAlpha: 0, y: 14 }, 0);
  timeline.set(diarizeSpeaker2, { autoAlpha: 0, y: 14 }, 0);
  timeline.set(srtSuccessBadge, { autoAlpha: 0, scale: 0.85, y: 10 }, 0);

  // Act 4 Initial State
  timeline.set(act4, { autoAlpha: 0, display: "none", scale: 0.95, y: 20 }, 0);
  timeline.set(cloneCard, { autoAlpha: 0, x: -25, rotateX: 3, rotateY: 8, z: -55, transformPerspective: 1200 }, 0);
  timeline.set(apiCard, { autoAlpha: 0, x: 25, rotateX: 3, rotateY: -8, z: -55, transformPerspective: 1200 }, 0);
  timeline.set(sample10sBadge, { autoAlpha: 0, y: 10 }, 0);
  timeline.set(progCircle, { strokeDashoffset: 314.15 }, 0);
  if (progLabel) timeline.set(progLabel, { textContent: "0%" }, 0);
  timeline.set(verifiedProfile, { autoAlpha: 0, scale: 0.85 }, 0);
  timeline.set(amberDisclaimer, { autoAlpha: 0, y: 8 }, 0);
  timeline.set(endpointBox, { autoAlpha: 0, y: 10 }, 0);
  timeline.set(liveCounter, { autoAlpha: 0, y: 10 }, 0);
  if (counterNumber) timeline.set(counterNumber, { textContent: "0+" }, 0);

  // Act 5 Initial State
  timeline.set(act5, { autoAlpha: 0, display: "none", scale: 0.95, y: 0 }, 0);
  timeline.set(climaxEmblem, { scale: 0.82, autoAlpha: 0, rotate: -18 }, 0);
  timeline.set(climaxHeadline, { autoAlpha: 0 }, 0);
  timeline.set(climaxSubtitle, { autoAlpha: 0, y: 25 }, 0);
  timeline.set(climaxCtas, { autoAlpha: 0, y: 20 }, 0);
  timeline.set(ctaShimmer, { xPercent: -220 }, 0);

  // ============================================================
  // ACT 1: THE LINGUISTIC BARRIER & NATIVE ARCHITECTURE (0.0s – 5.5s)
  // Continuous Word-by-Word Kinetic Typography & Challenge Card Reveal
  // ============================================================

  // Editorial Thought 1 (Word-by-word reveal)
  animateSentenceWords(beatIntro, 0.05);
  exitSentenceWords(beatIntro, 1.85, 0.25);

  // 2.05s – 3.2s: PURE KINETIC EDITORIAL THOUGHT 2 (The Linguistic Crisis - Word-by-word)
  animateSentenceWords(beatObstacle, 2.05);
  exitSentenceWords(beatObstacle, 3.15, 0.22);

  // 3.3s – 5.2s: CAMERA GLIDES DOWN INTO LINGUISTIC SOLUTION
  timeline.to(camera, {
    scale: 1.22,
    x: 0,
    y: -15,
    rotateX: 0.8,
    rotateY: 0,
    duration: 1.8,
    ease: "power3.inOut",
  }, 3.3);

  // 1-by-1 Staggered Construction of the Linguistic Challenge Card
  timeline.fromTo(monolithicBox,
    { y: 80, autoAlpha: 0, scale: 0.94 },
    { y: 0, autoAlpha: 1, scale: 1, rotateX: 0, rotateY: 0, z: 0, duration: 1.15, ease: "power3.out" },
    3.35
  );
  timeline.fromTo(errorBadge1,
    { scale: 0.82, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 0.8, ease: "back.out(1.5)" },
    3.55
  );
  timeline.fromTo(errorBadge2,
    { y: 30, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.7, ease: "power2.out" },
    3.65
  );

  // Red wave jitter simulation
  timeline.to(robotWave, { x: -3, duration: 0.08, repeat: 5, yoyo: true, ease: "sine.inOut" }, 3.65);

  // Track-matte cyan scanning beam sweeps across script
  timeline.set(segmentBeam, { autoAlpha: 1, x: 0 }, 3.95);
  timeline.to(segmentBeam, { x: 1020, duration: 0.85, ease: "power2.inOut" }, 3.95);
  timeline.to(unspacedScript, { autoAlpha: 0.15, duration: 0.4, ease: "power2.in" }, 4.15);
  timeline.set(segmentedWords, { display: "flex", autoAlpha: 1 }, 4.2);

  wordChips.forEach((chip, idx) => {
    timeline.fromTo(chip,
      { scale: 0.82, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 0.75, ease: "back.out(1.6)" },
      4.25 + idx * 0.08
    );
  });

  // Error badges collapse & Native Solved Badge pops
  timeline.to([errorBadge1, errorBadge2, robotWave], {
    scale: 0.85,
    autoAlpha: 0,
    duration: 0.25,
    ease: "power2.in",
  }, 4.7);

  timeline.fromTo(nativeSolvedBadge,
    { scale: 0.82, y: 30, autoAlpha: 0 },
    { scale: 1, y: 0, autoAlpha: 1, duration: 0.85, ease: "back.out(1.8)" },
    4.85
  );

  timeline.to(act1, { scale: 1.42, y: -70, clipPath: "inset(47% 8% 47% 8% round 40px)", autoAlpha: 0, duration: 0.48, ease: "expo.in" }, 5.02);
  timeline.set(act1, { display: "none" }, 5.5);

  // Reset camera smoothly for Beat Solution sentence
  timeline.to(camera, {
    scale: 1.0,
    x: 0,
    y: 0,
    rotateX: 0,
    rotateY: 0,
    duration: 0.5,
    ease: "power2.out",
  }, 5.15);

  // ============================================================
  // TRANSITION 1 -> 2: KINETIC SOLUTION PUNCH (5.25s – 6.4s)
  // Thought 3 word-by-word reveal, then direct switch into Studio Editor
  // ============================================================
  animateSentenceWords(beatSolution, 5.25);
  exitSentenceWords(beatSolution, 6.25, 0.22);

  // ============================================================
  // ACT 2: NATURAL TTS & INTERACTIVE PLAYGROUND (6.45s – 11.4s)
  // Macro Camera Zoom, Real-Time Typing Follow & 1-by-1 Construction
  // ============================================================

  // 5.5s – 6.8s: ELEGANT FRAMING ONTO STUDIO WORKSPACE
  timeline.to(camera, {
    scale: 1.12,
    x: 0,
    y: -10,
    rotateX: 0.6,
    rotateY: -0.4,
    duration: 1.2,
    ease: "power3.inOut",
  }, 5.5);

  timeline.set(act2, { display: "flex", autoAlpha: 1, scale: 1 }, 6.25);

  // 1-by-1 Progressive Architectural UI Construction:
  // 1. Voice selector pill rises smoothly
  timeline.fromTo(voicePill,
    { y: 65, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.85, ease: "power3.out" },
    6.3
  );

  // 2. Editor card shell rises with physical settle
  timeline.fromTo(lineEditor,
    { y: 85, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, rotateX: 0, rotateY: 0, z: 0, duration: 1.15, ease: "back.out(1.2)" },
    6.4
  );

  // 3. Right settings panel slides in from right
  timeline.fromTo(rightSettingsPanel,
    { x: 80, autoAlpha: 0 },
    { x: 0, autoAlpha: 1, rotateX: 0, rotateY: 0, z: 0, duration: 1.2, ease: "power4.out" },
    6.5
  );

  // 4. Line 2 Bora voice notice & subactions rise beneath
  timeline.fromTo(editorRow2,
    { y: 55, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 1.2, ease: "power4.out" },
    6.6
  );

  // Traveling border beam
  if (borderBeamRect) {
    timeline.to(borderBeamRect, { opacity: 0.85, duration: 0.3 }, 6.65);
    timeline.to(borderBeamRect, {
      strokeDashoffset: 0,
      duration: 4.8,
      ease: "none",
    }, 6.65);
  }

  // Caret activates at text start position (0px gap to text)
  timeline.to(ttsCaret, { autoAlpha: 1, duration: 0.1 }, 6.7);
  timeline.to(ttsCaret, { autoAlpha: 0, duration: 0.25, repeat: 8, yoyo: true, ease: "steps(1)" }, 6.75);

  // Inline Khmer typing begins at 6.85s (1.6s duration)
  typeText(typedKhmer, "សូមស្វាគមន៍មកកាន់ Kiri TTS។ សំឡេង AI ធម្មជាតិពិតៗ។", 6.85, 1.6);

  // CAMERA SMOOTHLY PANS RIGHTWARD FOLLOWING THE TYPED TEXT
  timeline.to(camera, {
    scale: 1.32,
    x: 80,
    y: -30,
    duration: 1.6,
    ease: "sine.inOut",
  }, 6.85);

  // 7.8s – 8.5s: CAMERA GLIDES ACROSS TO SETTINGS SLIDERS
  timeline.to(camera, {
    scale: 1.34,
    x: -190,
    y: -20,
    rotateX: 0.6,
    rotateY: 0.4,
    duration: 0.9,
    ease: "power2.inOut",
  }, 7.8);

  // Sliders adjust smoothly
  timeline.to(fillStability, { scaleX: 1, duration: 0.8, ease: "power3.out" }, 7.8);
  timeline.to(thumbStability, { x: 0, duration: 0.8, ease: "power3.out" }, 7.8);
  timeline.to(fillSpeed, { scaleX: 1, duration: 0.8, ease: "power3.out" }, 8.0);
  timeline.to(thumbSpeed, { x: 0, duration: 0.8, ease: "power3.out" }, 8.0);
  timeline.to(rightSettingsPanel, { rotateX: 2, rotateY: -4, z: 55, duration: 0.82, ease: "power3.inOut" }, 7.8);

  // ============================================================
  // PAN TO GENERATE BUTTON & TACTILE CLICK (8.5s – 9.7s)
  // ============================================================
  // Gentle camera framing on the Generate Speech button
  timeline.to(camera, {
    scale: 1.48,
    x: -320,
    y: -120,
    rotateX: 0.4,
    rotateY: 0,
    duration: 0.9,
    ease: "expo.inOut",
  }, 8.5);
  timeline.to(lineEditor, { rotateX: 2.5, rotateY: 4, z: 65, duration: 0.9, ease: "power3.inOut" }, 8.5);
  timeline.to(rightSettingsPanel, { rotateX: 0, rotateY: 0, z: 0, duration: 0.72, ease: "power3.out" }, 8.55);

  // Cursor sweeps directly over Generate button
  timeline.to(cursor, {
    x: generateTarget.x - 8,
    y: generateTarget.y - 7,
    autoAlpha: 1,
    duration: 0.55,
    ease: "power2.out",
  }, 9.05);

  // Tactile Click at 9.6s: quick 0.08s tap down, button depression & glow
  timeline.to(cursor, {
    scale: 0.8,
    duration: 0.08,
    yoyo: true,
    repeat: 1,
    ease: "power2.inOut",
  }, 9.6);

  timeline.to(btnGenerate, {
    scale: 0.88,
    duration: 0.09,
    yoyo: true,
    repeat: 1,
    ease: "power2.inOut",
  }, 9.6);

  timeline.to(btnGenerate, {
    boxShadow: "0 0 40px rgba(0, 210, 255, 0.95), 0 0 18px rgba(16, 185, 129, 0.75)",
    duration: 0.2,
  }, 9.6);

  // Contact ripple on button
  timeline.set(cursorRipple, { x: generateTarget.x, y: generateTarget.y, autoAlpha: 0.9, scale: 0.3 }, 9.6);
  timeline.to(cursorRipple, {
    scale: 1.8,
    autoAlpha: 0,
    duration: 0.38,
    ease: "power2.out",
  }, 9.62);

  timeline.to(cursor, {
    scale: 1.0,
    duration: 0.2,
    ease: "back.out(2)",
  }, 9.68);

  // ============================================================
  // CAMERA IN STUDIO FOCUS FOR AUDIO RESPONSE (9.7s – 11.35s)
  // 1-by-1 Response Construction: Audio Player Card + Waveform Bloom
  // ============================================================
  timeline.to(camera, {
    scale: 1.2,
    x: 0,
    y: -60,
    duration: 0.9,
    ease: "expo.inOut",
  }, 9.7);

  // Master Audio Card rises smoothly
  timeline.fromTo(audioPlayerCard,
    { y: 90, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, rotateX: 0, z: 0, duration: 1.05, ease: "power3.out" },
    9.7
  );

  // EQ waveform bars bloom
  timeline.fromTo(eqWaveBars,
    { scale: 0.82, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 1.2, ease: "back.out(1.5)" },
    9.85
  );

  // Continuous Camera Floating on Audio Playback
  timeline.to(camera, {
    scale: 1.24,
    y: -48,
    duration: 1.5,
    ease: "sine.inOut",
  }, 10.5);

  const eqSpans = eqWaveBars.querySelectorAll("span");
  eqSpans.forEach((bar, idx) => {
    timeline.to(bar, {
      scaleY: 1.5,
      duration: 0.18 + (idx % 3) * 0.06,
      repeat: 8,
      yoyo: true,
      ease: "sine.inOut",
    }, 9.85 + idx * 0.04);
  });

  timeline.to(cursor, {
    x: 1320,
    y: 450,
    autoAlpha: 0.3,
    duration: 0.7,
    ease: "power2.out",
  }, 10.1);

  // ============================================================
  // TRANSITION 2 -> 3: KINETIC FEATURE BANNER (11.35s – 12.45s)
  // Word-Level Forced Alignment kicker word-by-word reveal
  // ============================================================
  timeline.to(audioPlayerCard, { scale: 3.6, y: -120, filter: "blur(9px)", duration: 0.48, ease: "expo.in" }, 11.18);
  timeline.to(act2, { scale: 1.18, autoAlpha: 0, duration: 0.42, ease: "power3.in" }, 11.28);
  timeline.set(act2, { display: "none" }, 11.72);

  // Reset camera smoothly for Banner STT
  timeline.to(camera, {
    scale: 1.0,
    x: 0,
    y: 0,
    rotateX: 0,
    rotateY: 0,
    duration: 0.4,
    ease: "power2.out",
  }, 11.35);

  animateSentenceWords(bannerStt, 11.45);
  exitSentenceWords(bannerStt, 12.25, 0.2);

  // ============================================================
  // ACT 3: SPEECH-TO-TEXT & FORCED ALIGNMENT SUBTITLES (12.45s – 17.4s)
  // Macro Camera Glide, 1-by-1 Construction & Word Timestamp Illumination
  // ============================================================

  // 12.0s – 13.8s: ELEGANT FRAMING ONTO STT WORKSPACE
  timeline.to(camera, {
    scale: 1.12,
    x: 0,
    y: -10,
    rotateX: 0.6,
    rotateY: 0.3,
    duration: 1.3,
    ease: "power3.inOut",
  }, 12.0);

  timeline.set(act3, { display: "flex", autoAlpha: 1, scale: 1 }, 12.4);

  // 1-by-1 Staggered Construction of STT Workspace:
  // 1. Audio Drop Card rises
  timeline.fromTo(sttDropCard,
    { y: 85, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, rotateX: 0, rotateY: 0, z: 0, duration: 1.1, ease: "power3.out" },
    12.45
  );

  // 2. Dropped audio chip slides in
  timeline.fromTo(droppedAudioChip,
    { x: -70, autoAlpha: 0 },
    { x: 0, autoAlpha: 1, duration: 0.85, ease: "back.out(1.2)" },
    12.6
  );

  // 3. Export SRT button blooms
  timeline.fromTo(btnExportSrt,
    { scale: 0.7, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 0.8, ease: "back.out(1.4)" },
    12.75
  );

  // 4. Speaker 1 Diarization stream rises smoothly
  timeline.fromTo(diarizeSpeaker1,
    { y: 80, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.95, ease: "power4.out" },
    12.85
  );

  const spk1Stamps = diarizeSpeaker1.querySelectorAll(".kiri-word-stamp");
  spk1Stamps.forEach((stamp, idx) => {
    timeline.to(stamp, {
      borderColor: "#00D2FF",
      backgroundColor: "rgba(0, 210, 255, 0.2)",
      color: "#00D2FF",
      duration: 0.2,
      ease: "power2.out",
    }, 13.0 + idx * 0.25);
  });

  // Camera tracks down gently as speech progresses
  timeline.to(camera, {
    scale: 1.24,
    x: -30,
    y: -100,
    duration: 1.4,
    ease: "sine.inOut",
  }, 13.8);

  // 5. Speaker 2 English Diarization stream rises smoothly
  timeline.fromTo(diarizeSpeaker2,
    { y: 80, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.95, ease: "power4.out" },
    14.4
  );

  const spk2Stamps = diarizeSpeaker2.querySelectorAll(".kiri-word-stamp");
  spk2Stamps.forEach((stamp, idx) => {
    timeline.to(stamp, {
      borderColor: "#10B981",
      backgroundColor: "rgba(16, 185, 129, 0.2)",
      color: "#10B981",
      duration: 0.18,
      ease: "power2.out",
    }, 14.6 + idx * 0.2);
  });

  // 15.2s – 16.5s: CAMERA GENTLY FRAMES EXPORT BUTTON
  timeline.to(camera, {
    scale: 1.42,
    x: -300,
    y: 110,
    duration: 0.9,
    ease: "expo.inOut",
  }, 15.2);
  timeline.to(sttDropCard, { rotateX: 2, rotateY: 4, z: 55, duration: 0.95, ease: "power3.inOut" }, 15.2);

  // Cursor frames Export SRT button
  timeline.to(cursor, {
    x: exportTarget.x - 8,
    y: exportTarget.y - 7,
    autoAlpha: 1,
    duration: 0.6,
    ease: "power2.out",
  }, 15.8);

  // Tactile Click at 16.5s
  timeline.to(cursor, {
    scale: 0.8,
    duration: 0.08,
    yoyo: true,
    repeat: 1,
    ease: "power2.inOut",
  }, 16.5);

  timeline.to(btnExportSrt, {
    scale: 0.92,
    duration: 0.09,
    yoyo: true,
    repeat: 1,
    ease: "power2.inOut",
  }, 16.5);

  timeline.set(cursorRipple, { x: exportTarget.x, y: exportTarget.y, autoAlpha: 0.9, scale: 0.3 }, 16.5);
  timeline.to(cursorRipple, {
    scale: 1.8,
    autoAlpha: 0,
    duration: 0.38,
    ease: "power2.out",
  }, 16.52);

  // Emerald Subtitle Export Success Banner Pops
  timeline.fromTo(srtSuccessBadge,
    { scale: 0.82, y: 25, autoAlpha: 0 },
    { scale: 1, y: 0, autoAlpha: 1, duration: 0.65, ease: "back.out(1.6)" },
    16.65
  );

  // ============================================================
  // TRANSITION 3 -> 4: KINETIC FEATURE BANNER (17.4s – 18.45s)
  // 10-Second Voice Cloning & REST API kicker word-by-word reveal
  // ============================================================
  timeline.to(srtSuccessBadge, { scale: 3.8, filter: "blur(9px)", duration: 0.46, ease: "expo.in" }, 17.18);
  timeline.to(act3, { scale: 1.16, autoAlpha: 0, duration: 0.4, ease: "power3.in" }, 17.3);
  timeline.set(act3, { display: "none" }, 17.72);

  // Reset camera for banner Clone
  timeline.to(camera, {
    scale: 1.0,
    x: 0,
    y: 0,
    duration: 0.4,
    ease: "power2.out",
  }, 17.4);

  animateSentenceWords(bannerClone, 17.5);
  exitSentenceWords(bannerClone, 18.25, 0.2);

  // ============================================================
  // ACT 4: 10s VOICE CLONING & OPENAI REST API (18.45s – 23.9s)
  // Macro Camera Framing, 1-by-1 Construction & Live Metric Counting
  // ============================================================

  // 18.2s – 19.5s: CAMERA FRAMING ONTO VOICE CLONING CARD
  timeline.to(camera, {
    scale: 1.2,
    x: 210,
    y: -35,
    rotateX: 0.5,
    rotateY: -0.3,
    duration: 1.2,
    ease: "expo.inOut",
  }, 18.2);
  timeline.to(cloneCard, { rotateX: 2, rotateY: -4, z: 58, duration: 1.05, ease: "power3.inOut" }, 19.1);

  timeline.set(act4, { display: "flex", autoAlpha: 1, scale: 1 }, 18.4);

  // 1-by-1 Staggered Construction of Voice Cloning Card:
  timeline.fromTo(cloneCard,
    { y: 95, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, rotateX: 0, rotateY: 0, z: 0, duration: 1.1, ease: "power3.out" },
    18.5
  );
  timeline.fromTo(sample10sBadge,
    { y: 35, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.8, ease: "back.out(1.3)" },
    18.65
  );
  timeline.fromTo(progressRing,
    { scale: 0.82, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 1.0, ease: "back.out(1.5)" },
    18.8
  );

  // Progress circle draws from 0% to 100%
  timeline.to(progCircle, {
    strokeDashoffset: 0,
    duration: 1.1,
    ease: "power2.inOut",
  }, 18.8);

  if (progLabel) {
    const progObj = { val: 0 };
    timeline.to(progObj, {
      val: 100,
      duration: 1.1,
      ease: "power2.inOut",
      onUpdate: () => {
        progLabel.textContent = `${Math.round(progObj.val)}%`;
      },
    }, 18.8);
  }

  // Verified Profile & Amber Note Pop
  timeline.fromTo(verifiedProfile,
    { scale: 0.6, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 0.6, ease: "back.out(1.7)" },
    20.0
  );
  timeline.fromTo(amberDisclaimer,
    { y: 30, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.8, ease: "power4.out" },
    20.2
  );

  // 20.2s – 21.5s: CAMERA GENTLE GLIDE TO REST API & LIVE COUNTER
  timeline.to(camera, {
    scale: 1.3,
    x: -230,
    y: -35,
    rotateX: 0.5,
    rotateY: 0.3,
    duration: 1.2,
    ease: "expo.inOut",
  }, 20.2);
  timeline.to(cloneCard, { rotateX: 0, rotateY: 0, z: 0, duration: 0.85, ease: "power3.out" }, 20.2);
  timeline.to(apiCard, { rotateX: 2, rotateY: 4, z: 58, duration: 1.05, ease: "power3.inOut" }, 20.45);

  // 1-by-1 Construction of API Card
  timeline.fromTo(apiCard,
    { y: 95, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, rotateX: 0, rotateY: 0, z: 0, duration: 1.1, ease: "power3.out" },
    20.4
  );
  timeline.fromTo(apiHubLogo,
    { scale: 0.82, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 0.8, ease: "back.out(1.5)" },
    20.55
  );
  timeline.fromTo(endpointBox,
    { y: 40, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.9, ease: "power4.out" },
    20.7
  );
  timeline.fromTo(liveCounter,
    { y: 40, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.9, ease: "power4.out" },
    20.85
  );

  // Request counter animates to 3,250,000+
  if (counterNumber) {
    animateCounter(counterNumber, 480000, 3250000, "+", 20.85, 1.8);
  }

  // ============================================================
  // ACT 5: GRAND CLIMAX & BRAND FINALE (23.5s – 28.5s)
  // Grand Optical Zoom-Out Pullback & 1-by-1 Climax Construction
  // ============================================================
  timeline.set(act5, { display: "flex", autoAlpha: 1 }, 23.5);
  matchCut(timeline, apiHubLogo, climaxEmblem, { at: 23.55, duration: 0.72, scale: 0.82 });
  timeline.to(act4, { scale: 1.28, autoAlpha: 0, duration: 0.55, ease: "expo.in" }, 23.55);
  timeline.set(act4, { display: "none" }, 24.12);

  // 23.5s – 25.8s: GRAND OPTICAL CAMERA SETTLE
  timeline.to(camera, {
    scale: 1.0,
    x: 0,
    y: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    duration: 1.8,
    ease: "expo.out",
  }, 23.5);

  // 1-by-1 Climax Elements Construction:
  // 1. Emblem blooms with electric cyan aura and settles
  timeline.fromTo(climaxEmblem,
    { scale: 0.82, autoAlpha: 0, rotate: -18 },
    { scale: 1, autoAlpha: 1, rotate: 0, duration: 1.3, ease: "back.out(1.5)" },
    24.2
  );

  // 2. The complete hero statement arrives giant and settles word by word.
  giantKineticCrop(timeline, climaxHeadline, {
    at: 24.5,
    unit: "words",
    startScale: 2.2,
    endScale: 1,
    duration: 0.95,
    stagger: 0.05,
    settleEase: "back.out(1.35)",
  });

  // 3. Hero Subtitle rises smoothly
  timeline.fromTo(climaxSubtitle,
    { y: 45, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 1.0, ease: "power4.out" },
    24.8
  );

  // 4. Dual Action Pills (Get Started / Watch Demo) rise
  timeline.fromTo(climaxCtas,
    { y: 35, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 1.1, ease: "back.out(1.3)" },
    25.1
  );

  // 25.8s – 28.5s: CONTINUOUS MAJESTIC CAMERA BREATHING ON FINALE
  timeline.to(camera, {
    scale: 1.02,
    duration: 2.7,
    ease: "sine.inOut",
  }, 25.8);

  // The pointer leaves before the brand hold so the CTA remains visually quiet.
  timeline.to(cursor, { x: 1100, y: 560, autoAlpha: 0, duration: 0.45, ease: "power2.in" }, 24.2);

  // Specular light shimmer sweeps across "Get Started" button
  timeline.to(ctaShimmer, {
    xPercent: 280,
    duration: 1.1,
    ease: "power2.inOut",
  }, 26.2);

  // Ambient aura breathes softly into completion
  timeline.to(ambientGlow, {
    scale: 1.05,
    autoAlpha: 1,
    duration: 1.8,
    ease: "sine.inOut",
  }, 26.5);

  timeline.timeScale(1 / playbackScale).paused(false);
  masterTimeline.add(timeline, 0);
  return masterTimeline;
}

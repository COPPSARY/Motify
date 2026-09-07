export function buildClaudeTimeline(context) {
  const { root, timeline, register } = context;
  const get = (id) => root.querySelector(`[data-edit='${id}']`);

  const ids = [
    "claudeFilmRoot",
    "claudeCameraWorld",
    "claudeAmbientGlow",
    "claudeSidebar",
    "claudeSideBtnNew",
    "claudeStageWorkspace",
    "claudeHomeView",
    "claudeGreetingBox",
    "claudeSparkIcon",
    "claudeGreeting",
    "claudePromptShell",
    "claudeBorderBeamRect",
    "claudeAttachedChip",
    "claudePlaceholder",
    "claudeTypedInput",
    "claudePromptCaret",
    "claudeBtnAdd",
    "claudeModelBadge",
    "claudeBtnSend",
    "claudeScene2PromptView",
    "claudePromptShell2",
    "claudePlaceholder2",
    "claudeTypedInput2",
    "claudePromptCaret2",
    "claudeBtnAdd2",
    "claudePlusDropdown",
    "claudeDropdownCreateImage",
    "claudeBtnSend2",
    "claudeDraggedImage",
    "claudeCursor",
    "claudeCursorRipple",
    "claudeReplyThread",
    "claudeUserMessagePill",
    "claudeResponseText",
    "claudeArtifactCard",
    "claudeCalorieDetails",
    "claudeStreamSpark",
    "claudeBottomChatBar1",
    "claudeImageGenThread",
    "claudeSkyUserPill",
    "claudeThinkingRow",
    "claudeThinkingPill",
    "claudeThinkingText",
    "claudeSkyResponse",
    "claudeSkyResponseHeadline",
    "claudeSkyCard",
    "claudeBottomChatBar2",
    "claudeClimaxSequence",
    "claudeClimaxPrefix",
    "claudeClimaxEverywhereBox",
    "claudeClimaxEverywhere",
  ];

  ids.forEach((id) => {
    const element = get(id);
    if (!element) throw new Error(`Claude preset is missing [data-edit='${id}']`);
    register(id, element);
  });

  const stage = get("claudeFilmRoot");
  const camera = get("claudeCameraWorld");
  const ambientGlow = get("claudeAmbientGlow");
  const sidebar = get("claudeSidebar");
  const sideBtnNew = get("claudeSideBtnNew");
  const stageWorkspace = get("claudeStageWorkspace");
  const homeView = get("claudeHomeView");
  const greetingBox = get("claudeGreetingBox");
  const sparkIcon = get("claudeSparkIcon");
  const greeting = get("claudeGreeting");
  const promptShell = get("claudePromptShell");
  const borderBeamRect = get("claudeBorderBeamRect");
  const attachedChip = get("claudeAttachedChip");
  const placeholder = get("claudePlaceholder");
  const typedInput = get("claudeTypedInput");
  const promptCaret = get("claudePromptCaret");
  const btnAdd = get("claudeBtnAdd");
  const modelBadge = get("claudeModelBadge");
  const btnSend = get("claudeBtnSend");
  const scene2PromptView = get("claudeScene2PromptView");
  const promptShell2 = get("claudePromptShell2");
  const placeholder2 = get("claudePlaceholder2");
  const typedInput2 = get("claudeTypedInput2");
  const promptCaret2 = get("claudePromptCaret2");
  const btnAdd2 = get("claudeBtnAdd2");
  const plusDropdown = get("claudePlusDropdown");
  const dropdownCreateImage = get("claudeDropdownCreateImage");
  const btnSend2 = get("claudeBtnSend2");
  const draggedImage = get("claudeDraggedImage");
  const cursor = get("claudeCursor");
  const cursorRipple = get("claudeCursorRipple");
  const replyThread = get("claudeReplyThread");
  const userMessagePill = get("claudeUserMessagePill");
  const responseText = get("claudeResponseText");
  const artifactCard = get("claudeArtifactCard");
  const calorieDetails = get("claudeCalorieDetails");
  const streamSpark = get("claudeStreamSpark");
  const bottomChatBar1 = get("claudeBottomChatBar1");
  const imageGenThread = get("claudeImageGenThread");
  const skyUserPill = get("claudeSkyUserPill");
  const thinkingRow = get("claudeThinkingRow");
  const thinkingPill = get("claudeThinkingPill");
  const thinkingText = get("claudeThinkingText");
  const skyResponse = get("claudeSkyResponse");
  const skyResponseHeadline = get("claudeSkyResponseHeadline");
  const skyCard = get("claudeSkyCard");
  const bottomChatBar2 = get("claudeBottomChatBar2");
  const climaxSequence = get("claudeClimaxSequence");
  const climaxPrefix = get("claudeClimaxPrefix");
  const climaxEverywhereBox = get("claudeClimaxEverywhereBox");
  const climaxEverywhere = get("claudeClimaxEverywhere");

  // Granular Authentic Sidebar Elements for Staggered Construction & Interaction
  const sidebarBrand = root.querySelector(".cl-sidebar-brand");
  const navItems = root.querySelectorAll(".cl-sidebar-nav-list .cl-nav-item");
  const sideSections = root.querySelectorAll(".cl-sidebar-section");
  const chatItems = root.querySelectorAll(".cl-chat-list .cl-chat-item");
  const sidebarBottom = root.querySelector(".cl-sidebar-bottom");

  // Deterministic typewriter animation helper
  // Keeps caret directly touching the text edge with 0px gap throughout typing
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

  // ============================================================
  // INITIAL ZERO STATES (t = 0.0s)
  // ============================================================
  timeline.set(stage, { autoAlpha: 1 }, 0);
  timeline.set(camera, { x: 0, y: 0, scale: 1, rotateX: 0, rotateY: 0, rotateZ: 0, z: 0 }, 0);
  timeline.set(stageWorkspace, { autoAlpha: 1 }, 0);

  // Ambient Glow & Authentic Sidebar Construction Zero States
  timeline.set(ambientGlow, { autoAlpha: 0, scale: 0.88 }, 0);
  timeline.set(sidebar, { x: 0, autoAlpha: 1 }, 0);
  timeline.set(sidebarBrand, { autoAlpha: 0, x: -20 }, 0);
  timeline.set(sideBtnNew, { scale: 0, autoAlpha: 0, backgroundColor: "rgba(255, 255, 255, 0.09)" }, 0);
  timeline.set(navItems, { x: -24, autoAlpha: 0 }, 0);
  timeline.set(sideSections, { autoAlpha: 0, y: 12 }, 0);
  timeline.set(chatItems, { x: -28, autoAlpha: 0 }, 0);
  timeline.set(sidebarBottom, { y: 24, autoAlpha: 0 }, 0);

  // Initial Home View ("Good Morning, Sou" + Big Prompt Box)
  timeline.set(homeView, { autoAlpha: 1, y: 0, scale: 1, display: "flex" }, 0);
  timeline.set(greetingBox, { autoAlpha: 1, display: "flex" }, 0);
  timeline.set(sparkIcon, { scale: 0, autoAlpha: 0, rotate: -45 }, 0);
  timeline.set(greeting, { autoAlpha: 0, y: 22 }, 0);
  timeline.set(promptShell, {
    autoAlpha: 0,
    scale: 0.94,
    y: 32,
    rotateX: 0,
    display: "flex",
    borderColor: "rgba(255, 255, 255, 0.11)",
    boxShadow: "0 30px 80px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.12)",
  }, 0);
  timeline.set(borderBeamRect, { opacity: 0, strokeDashoffset: 0 }, 0);
  timeline.set(attachedChip, { autoAlpha: 0, display: "none" }, 0);
  timeline.set(placeholder, { autoAlpha: 1, display: "block" }, 0);
  timeline.set(typedInput, { textContent: "" }, 0);
  timeline.set(promptCaret, { autoAlpha: 0 }, 0);
  timeline.set(btnAdd, { scale: 1, rotate: 0 }, 0);
  timeline.set(btnSend, {
    scale: 1,
    boxShadow: "0 4px 16px rgba(224, 104, 59, 0.45)",
  }, 0);

  // Scene 2 Prompt View Zero States (Pure fresh chat, NO attached ramen chip!)
  timeline.set(scene2PromptView, { autoAlpha: 0, display: "none", y: 0 }, 0);
  timeline.set(promptShell2, {
    autoAlpha: 1,
    scale: 1,
    display: "flex",
    borderColor: "rgba(255, 255, 255, 0.11)",
    boxShadow: "0 30px 80px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.12)",
  }, 0);
  timeline.set(placeholder2, { autoAlpha: 1, display: "block" }, 0);
  timeline.set(typedInput2, { textContent: "" }, 0);
  timeline.set(promptCaret2, { autoAlpha: 0 }, 0);
  timeline.set(btnAdd2, { scale: 1, rotate: 0 }, 0);
  timeline.set(plusDropdown, { autoAlpha: 0, scale: 0.9, display: "none" }, 0);
  timeline.set(btnSend2, {
    scale: 1,
    boxShadow: "0 4px 16px rgba(224, 104, 59, 0.45)",
  }, 0);

  // Clean Dragged Image & Pointer
  timeline.set(draggedImage, {
    x: 1360,
    y: 720,
    scale: 1,
    rotate: -8,
    display: "flex",
    autoAlpha: 0,
  }, 0);

  timeline.set(cursor, {
    x: 1510,
    y: 740,
    scale: 1,
    autoAlpha: 0,
  }, 0);

  timeline.set(cursorRipple, { autoAlpha: 0, scale: 0.5 }, 0);

  // Act 1 Reply Thread
  timeline.set(replyThread, { autoAlpha: 0, y: 0, display: "none" }, 0);
  timeline.set(userMessagePill, { autoAlpha: 0, y: 80 }, 0);
  timeline.set(responseText, { autoAlpha: 0, y: 100 }, 0);
  timeline.set(artifactCard, { autoAlpha: 0, y: 120 }, 0);
  timeline.set(calorieDetails, { autoAlpha: 0, y: 20 }, 0);
  timeline.set(streamSpark, { autoAlpha: 0, scale: 0 }, 0);
  timeline.set(bottomChatBar1, { autoAlpha: 0, y: 40 }, 0);

  // Act 2 Image Gen Thread
  timeline.set(imageGenThread, { autoAlpha: 0, y: 0, display: "none" }, 0);
  timeline.set(skyUserPill, { autoAlpha: 0, y: 80 }, 0);
  timeline.set(thinkingPill, { autoAlpha: 0, scale: 0.85 }, 0);
  timeline.set(skyResponse, { autoAlpha: 0, y: 25 }, 0);
  timeline.set(skyCard, { autoAlpha: 0, scale: 0.94, y: 30 }, 0);
  timeline.set(bottomChatBar2, { autoAlpha: 0, y: 40 }, 0);

  // Climax Sequence Zero States
  timeline.set(climaxSequence, { autoAlpha: 0, display: "none" }, 0);
  timeline.set(climaxPrefix, { autoAlpha: 1, scale: 1, x: 0 }, 0);
  timeline.set(climaxEverywhere, { y: 80, autoAlpha: 0 }, 0);

  // ============================================================
  // BEAT 1: UI CONSTRUCTION (0.0s – 1.4s)
  // ============================================================
  // 1. Ambient warm terracotta ember bloom powers on
  timeline.to(ambientGlow, {
    autoAlpha: 1,
    scale: 1.0,
    duration: 0.85,
    ease: "power2.out",
  }, 0.0);

  // 2. Authentic Claude Sidebar CONSTRUCTS piece-by-piece!
  // Brand "Claude" serif title slides in
  timeline.to(sidebarBrand, {
    x: 0,
    autoAlpha: 1,
    duration: 0.5,
    ease: "power2.out",
  }, 0.08);

  // "+ New" button pops in with energetic spring bounce
  timeline.to(sideBtnNew, {
    scale: 1,
    autoAlpha: 1,
    duration: 0.55,
    ease: "back.out(1.8)",
  }, 0.16);

  // Nav items (Projects, Artifacts, Code, Customize) cascade in 1 by 1
  timeline.to(navItems, {
    x: 0,
    autoAlpha: 1,
    stagger: 0.06,
    duration: 0.45,
    ease: "power2.out",
  }, 0.22);

  // Section headers ("Projects", "Chats and tasks") fade in
  timeline.to(sideSections, {
    y: 0,
    autoAlpha: 1,
    stagger: 0.08,
    duration: 0.4,
    ease: "power2.out",
  }, 0.36);

  // Recent chat items construct 1 BY 1 cascading down the list!
  timeline.to(chatItems, {
    x: 0,
    autoAlpha: 1,
    stagger: 0.05,
    duration: 0.4,
    ease: "power2.out",
  }, 0.42);

  // Bottom user profile row ("Prom · Free") snaps into place
  timeline.to(sidebarBottom, {
    y: 0,
    autoAlpha: 1,
    duration: 0.5,
    ease: "back.out(1.4)",
  }, 0.58);

  // 3. Anthropic spark asterisk ✳ pops and spins into place
  timeline.to(sparkIcon, {
    scale: 1,
    rotate: 0,
    autoAlpha: 1,
    duration: 0.55,
    ease: "back.out(1.8)",
  }, 0.25);

  // 4. Serif headline "Good Morning, Sou" rises into place
  timeline.to(greeting, {
    y: 0,
    autoAlpha: 1,
    duration: 0.65,
    ease: "power3.out",
  }, 0.3);

  // 5. Big Claude Prompt Box settles into place with frosted elevation
  timeline.to(promptShell, {
    autoAlpha: 1,
    scale: 1.0,
    y: 0,
    duration: 0.7,
    ease: "back.out(1.2)",
  }, 0.45);

  // ============================================================
  // BEAT 2: BUTTERY SMOOTH GENTLE CAMERA ZOOM & IMAGE DROP (1.4s – 3.2s)
  // ============================================================


  // BUTTERY SMOOTH CAMERA PUSH-IN (NO ABRUPT SNAP! 1.5s gentle power2.inOut curve):
  // Smoothly pushes into dead-center left framing as the image approaches the box
  timeline.to(camera, {
    scale: 2.5,
    x: 790,
    y: -20,
    duration: 1.5,
    ease: "expo.inOut",
  }, 1.4);

  // Cursor and image enter together
  timeline.to(cursor, {
    x: 1040,
    y: 620,
    autoAlpha: 1,
    duration: 0.65,
    ease: "expo.out",
  }, 1.3);

  timeline.to(draggedImage, {
    autoAlpha: 1,
    x: 890,
    y: 570,
    duration: 0.65,
    ease: "expo.out",
  }, 1.3);

  // Continuous drag into the slot
  timeline.to(cursor, {
    x: 580,
    y: 535,
    duration: 0.9,
    ease: "power3.inOut",
  }, 1.7);

  timeline.to(draggedImage, {
    x: 544,
    y: 496,
    scale: 0.514,
    rotate: 0,
    duration: 0.9,
    ease: "power3.inOut",
  }, 1.7);

  // At 2.45s: Cursor releases image with subtle tactile tap
  timeline.to(cursor, { scale: 0.88, duration: 0.08, yoyo: true, repeat: 1 }, 2.3);

  // Handoff to docked thumbnail at 2.3s (ZERO duplicate or blurred background!)
  timeline.set(attachedChip, { display: "inline-flex", autoAlpha: 1 }, 2.3);
  timeline.set(draggedImage, { autoAlpha: 0, display: "none" }, 2.3);

  // "How can I help you today?" placeholder IMMEDIATELY DISAPPEARS upon drop!
  timeline.set(placeholder, { autoAlpha: 0, display: "none" }, 2.7);


  // Cursor glides away to rest
  timeline.to(cursor, {
    x: 1220,
    y: 590,
    autoAlpha: 0.6,
    duration: 0.5,
    ease: "power2.out",
  }, 2.2);

  // ============================================================
  // BEAT 3: 0.5s CENTERED PAUSE -> TYPING WITH FOLLOW PAN (2.8s – 5.0s)
  // ============================================================
  // Caret activates at text start position
  timeline.to(promptCaret, { autoAlpha: 1, duration: 0.1 }, 2.7);
  timeline.to(promptCaret, { autoAlpha: 0, duration: 0.28, repeat: 10, yoyo: true, ease: "steps(1)" }, 2.75);

  // 0.5s PAUSE (2.8s – 3.3s): Camera holds dead center on the big attached image & caret!

  // Typing begins at 3.3s! Natural inline character typing (0px gap to caret):
  typeText(typedInput, "How many calories are in this ramen meal?", 3.3, 1.25);

  // Camera smoothly pans rightward following the typed text
  timeline.to(camera, {
    x: 320,
    duration: 1.25,
    ease: "sine.inOut",
  }, 3.3);

  // ============================================================
  // BEAT 4: PAN TO ORANGE SEND BUTTON & CLICK (4.75s – 5.4s)
  // ============================================================
  // Camera pans smoothly to frame the orange send button
  timeline.to(camera, {
    scale: 2.3,
    x: -960,
    duration: 1,
    ease: "expo.inOut",
  }, 4.3);

  // Cursor sweeps directly over the orange send button
  timeline.to(cursor, {
    x: 1360,
    y: 638,
    autoAlpha: 1,
    duration: 0.45,
    ease: "power2.out",
  }, 5.2);

  // Cursor clicks orange send button at 5.3s
  timeline.to(cursor, {
    scale: 0.82,
    duration: 0.08,
    yoyo: true,
    repeat: 1,
    ease: "power2.inOut",
  }, 5.45);

  timeline.to(btnSend, {
    scale: 0.85,
    duration: 0.09,
    yoyo: true,
    repeat: 1,
    ease: "power2.inOut",
  }, 5.5);

  timeline.to(btnSend, {
    boxShadow: "0 0 45px rgba(224, 104, 59, 0.95), 0 0 20px rgba(224, 104, 59, 0.7)",
    duration: 0.2,
  }, 5.5);

  // ============================================================
  // BEAT 5: RESPONSE VIEW — CLOSE ZOOM & CHAT BOX BELOW (5.4s – 7.8s)
  // ============================================================
  // "Good Morning, Sou" fades out smoothly
  timeline.to([greetingBox, greeting, sparkIcon], {
    autoAlpha: 0,
    y: -25,
    duration: 0.35,
    ease: "power2.in",
  }, 5.8);
  timeline.set(greetingBox, { display: "none" }, 5.75);

  // Home prompt box dissolves as response takes over
  timeline.to(promptShell, {
    autoAlpha: 0,
    y: -650,
    duration: 0.8,
    ease: "power2.out",
  }, 5.8);


  // CAMERA REMAINS ZOOMED IN / CLOSE TO RESPONSE (scale: 1.35, NOT zoomed out to tiny distance!):
  timeline.to(camera, {
    x: -960,
    y: -30,
    duration: 0.2,
    ease: "expo.in",
  }, 5.4);

  timeline.to(camera, {
    scale: 1.5,
    x: 30,
    y: -50,
    duration: 0.9,
    ease: "expo.inOut",
  }, 5.7);

  // Activate reply thread
  timeline.set(replyThread, { display: "flex", autoAlpha: 1 }, 5.7);

  // User query pill rises into top right
  timeline.fromTo(userMessagePill,
    { y: 250, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.7, ease: "power4.out" },
    5.8
  );

  // Claude response text rises smoothly
  timeline.fromTo(responseText,
    { y: 90, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out" },
    6
  );

  // Calorie Artifact card rises smoothly
  timeline.fromTo(artifactCard,
    { y: 100, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 1, ease: "back.out(1.2)" },
    6.1
  );

  // Streaming spark blooms
  timeline.fromTo(streamSpark,
    { scale: 0, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 1.4, ease: "back.out(1.5)" },
    6.3
  );

  // Slower non-linear slide-up reveals itemized calorie breakdown lines (~590 kcal)
  timeline.fromTo(calorieDetails,
    { autoAlpha: 1, y: 95 },
    { autoAlpha: 1, y: 0, duration: 1.3, ease: "power4.out" },
    6.3
  );

  // Floating bottom chat bar appears beneath the conversation (Screenshot 4)
  timeline.fromTo(bottomChatBar1,
    { autoAlpha: 1, y: 45 },
    { autoAlpha: 1, y: 0, duration: 1.4, ease: "power4.out" },
    6.4
  );

  // ============================================================
  // BEAT 6: ACT 2 — GLIDE TO SIDEBAR & CONNECTED APPLICATION VIEW (7.8s – 9.6s)
  // ============================================================
  const connectedCanvas = root.querySelector("[data-edit='claudeConnectedCanvas']") || root.querySelector(".cl-connected-canvas");

  // Clean workspace: dissolve previous calorie conversation so sidebar seamlessly connects to clean UI canvas
  timeline.to(replyThread, {
    autoAlpha: 0,
    duration: 0.35,
    ease: "power2.in",
  }, 7.8);
  timeline.set(replyThread, { display: "none" }, 8.15);
  timeline.set(scene2PromptView, { display: "none", autoAlpha: 0 }, 7.8);

  // Reveal connected UI workspace canvas so sidebar and main window look physically unified
  if (connectedCanvas) {
    timeline.set(connectedCanvas, { display: "block" }, 7.8);
    timeline.to(connectedCanvas, {
      autoAlpha: 1,
      duration: 0.65,
      ease: "power2.out",
    }, 7.8);
  }

  // 1-THING-IN-FOCUS: HERO CLOSE-UP ZOOM ON SIDEBAR (+ NEW BUTTON) WITH 2.5D PERSPECTIVE TILT
  timeline.to(camera, {
    scale: 2.25,
    x: 1560,
    y: 960,
    rotateY: 4.0,
    rotateX: 1.5,
    rotateZ: -0.8,
    duration: 1.35,
    ease: "expo.inOut",
  }, 7.8);

  // Subtle continuous camera drift during sidebar interaction hold
  timeline.to(camera, {
    scale: 2.32,
    x: 1585,
    y: 975,
    duration: 0.8,
    ease: "sine.inOut",
  }, 8.8);

  // Cursor sweeps organically to "+ New" button (center: x: 130, y: 81) with generous deceleration
  timeline.to(cursor, {
    x: 130,
    y: 81,
    autoAlpha: 1,
    duration: 1.25,
    ease: "power3.out",
  }, 7.85);

  // ANTICIPATORY HOVER STATE on "+ New" (Clean, native highlight — ZERO hollow glow outline!)
  timeline.to(sideBtnNew, {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    boxShadow: "none",
    duration: 0.22,
    ease: "power2.out",
  }, 9.15);
  timeline.to(cursor, { scale: 1.05, duration: 0.2, ease: "power2.out" }, 9.15);

  // TACTILE CLICK FEEDBACK on "+ New" at 9.38s!
  timeline.to(cursor, { scale: 0.8, duration: 0.08, ease: "power2.in" }, 9.38);
  timeline.to(sideBtnNew, {
    scale: 0.94,
    backgroundColor: "rgba(255, 255, 255, 0.24)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    boxShadow: "none",
    duration: 0.08,
    ease: "power2.in",
  }, 9.38);

  // Click ripple feedback on "+ New" at (130, 81)
  timeline.set(cursorRipple, { x: 130, y: 81, scale: 0.3, autoAlpha: 0.8 }, 9.38);
  timeline.to(cursorRipple, { scale: 1.8, autoAlpha: 0, duration: 0.35, ease: "power2.out" }, 9.40);

  // ELASTIC RELEASE on "+ New" at 9.46s
  timeline.to(cursor, { scale: 1, duration: 0.22, ease: "back.out(2)" }, 9.46);
  timeline.to(sideBtnNew, {
    scale: 1,
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    borderColor: "rgba(255, 255, 255, 0.05)",
    boxShadow: "none",
    duration: 0.25,
    ease: "back.out(2)",
  }, 9.46);
  timeline.set([replyThread, homeView], { display: "none" }, 9.6);

  // ============================================================
  // BEAT 7: ACT 2 — FLUID PAN TO FRESH PROMPT BOX, (+) DROPDOWN & "CREATE IMAGE" (9.6s – 11.85s)
  // ============================================================
  const imageModeChip = root.querySelector("[data-edit='claudeImageModeChip']");

  // Fresh prompt box activates cleanly with 2.5D physical tilt
  timeline.set(scene2PromptView, { display: "flex", autoAlpha: 0, scale: 0.94, y: 18 }, 9.6);
  timeline.set(promptShell2, {
    display: "flex",
    autoAlpha: 1,
    scale: 1,
    rotateX: 3.5,
    rotateY: -2.5,
    rotateZ: 0.6,
    transformPerspective: 1200,
  }, 9.6);
  timeline.set(placeholder2, { display: "block", autoAlpha: 1 }, 9.6);
  timeline.set(typedInput2, { textContent: "" }, 9.6);
  timeline.set(promptCaret2, { autoAlpha: 0 }, 9.6);
  if (imageModeChip) timeline.set(imageModeChip, { display: "none", autoAlpha: 0, scale: 0.3 }, 9.6);

  // Guarantee dropdown starts completely unselected with transparent borders!
  timeline.set(dropdownCreateImage, {
    backgroundColor: "transparent",
    borderColor: "transparent",
    boxShadow: "none",
    color: "rgba(255, 255, 255, 0.82)",
    scale: 1,
  }, 9.6);

  // Fresh prompt box settles with elegant spring rise!
  timeline.to(scene2PromptView, {
    autoAlpha: 1,
    scale: 1,
    y: 0,
    duration: 0.7,
    ease: "power3.out",
  }, 9.65);

  // 1-THING-IN-FOCUS: HERO CLOSE-UP ZOOM ON (+) BUTTON & PROMPT CARD WITH 2.5D PERSPECTIVE TILT
  timeline.to(camera, {
    scale: 2.25,
    x: 780,
    y: 20,
    rotateY: -2.5,
    rotateX: 3.0,
    rotateZ: 0.6,
    duration: 1.1,
    ease: "power3.inOut",
  }, 9.6);

  // Cursor sweeps organically to (+) button at (562, 610) with gentle settle
  timeline.to(cursor, {
    x: 562,
    y: 610,
    duration: 1.15,
    ease: "power3.out",
  }, 9.65);

  // CONTINUOUS CAMERA PUSH-IN following cursor into (+) button & dropdown selection (NO FREEZING!)
  timeline.to(camera, {
    scale: 2.38,
    x: 760,
    y: 10,
    rotateY: -2.2,
    rotateX: 2.8,
    rotateZ: 0.5,
    duration: 0.8,
    ease: "power2.out",
  }, 10.7);

  // TACTILE CLICK FEEDBACK on (+) button at 10.88s
  timeline.to(cursor, { scale: 0.78, duration: 0.08, ease: "power2.in" }, 10.88);
  timeline.to(btnAdd2, { scale: 0.88, duration: 0.08, ease: "power2.in" }, 10.88);
  timeline.set(cursorRipple, { x: 562, y: 610, scale: 0.25, autoAlpha: 0.8 }, 10.88);
  timeline.to(cursorRipple, { scale: 1.6, autoAlpha: 0, duration: 0.32, ease: "power2.out" }, 10.90);

  // On release: Cursor springs back, (+) springs and rotates 45 degrees into an 'x' icon
  timeline.to(cursor, { scale: 1, duration: 0.22, ease: "back.out(2)" }, 10.96);
  timeline.to(btnAdd2, { rotate: 45, scale: 1, duration: 0.35, ease: "back.out(1.8)" }, 10.96);

  // Authentic Claude Plus Dropdown Menu POPS OPEN directly connected above (+)
  timeline.set(plusDropdown, { display: "flex" }, 10.92);
  timeline.fromTo(plusDropdown,
    { scale: 0.85, y: 14, autoAlpha: 0 },
    { scale: 1, y: 0, autoAlpha: 1, duration: 0.42, ease: "back.out(1.5)" },
    10.92
  );

  // Cursor glides up smoothly to hover on "Create image" at (630, 515)
  timeline.to(cursor, {
    x: 630,
    y: 515,
    duration: 0.38,
    ease: "power2.out",
  }, 11.05);

  // HOVER FEEDBACK on "Create image" (Clean native solid highlight — ZERO glowing orange outline!)
  timeline.to(dropdownCreateImage, {
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    color: "#ffffff",
    borderColor: "transparent",
    boxShadow: "none",
    duration: 0.2,
    ease: "power2.out",
  }, 11.25);

  // TACTILE CLICK FEEDBACK on "Create image" at 11.45s!
  timeline.to(cursor, { scale: 0.78, duration: 0.08, ease: "power2.in" }, 11.45);
  timeline.to(dropdownCreateImage, {
    scale: 0.96,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderColor: "transparent",
    boxShadow: "none",
    duration: 0.08,
    ease: "power2.in",
  }, 11.45);

  // Click ripple on "Create image" item
  timeline.set(cursorRipple, { x: 630, y: 515, scale: 0.25, autoAlpha: 0.75 }, 11.45);
  timeline.to(cursorRipple, { scale: 1.5, autoAlpha: 0, duration: 0.3, ease: "power2.out" }, 11.47);

  // CONTINUITY SHAPE MORPH: "Create image" icon expands and morphs into the prompt box!
  if (imageModeChip) {
    timeline.set(imageModeChip, { display: "inline-flex" }, 11.47);
    timeline.fromTo(imageModeChip,
      { autoAlpha: 0, scale: 0.2, x: -70, y: -25 },
      { autoAlpha: 1, scale: 1, x: 0, y: 0, duration: 0.45, ease: "back.out(1.6)" },
      11.48
    );
  }

  // Camera & card level out to flat perspective and smoothly reframe across the typing field
  timeline.to(camera, {
    scale: 1.75,
    x: 140,
    y: -20,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    duration: 0.8,
    ease: "power2.inOut",
  }, 11.5);

  timeline.to(promptShell2, {
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    duration: 0.6,
    ease: "power2.out",
  }, 11.5);

  // Elastic rebound on "Create image"
  timeline.to(cursor, { scale: 1, duration: 0.2, ease: "back.out(2)" }, 11.53);
  timeline.to(dropdownCreateImage, { scale: 1, duration: 0.2, ease: "back.out(2)" }, 11.53);

  // Dropdown closes cleanly & (+) rotates back with bounce!
  timeline.to(plusDropdown, {
    scale: 0.9,
    autoAlpha: 0,
    y: 8,
    duration: 0.24,
    ease: "power4.in",
  }, 11.58);
  timeline.set(plusDropdown, { display: "none" }, 11.82);
  timeline.to(btnAdd2, { rotate: 0, duration: 0.3, ease: "back.out(1.6)" }, 11.58);

  // ============================================================
  // BEAT 8: ACT 2 — TYPING "Create an image of a blue sky" & SEND (11.85s – 13.5s)
  // ============================================================
  // Hide placeholder
  timeline.to(placeholder2, { autoAlpha: 0, duration: 0.15, ease: "expo.out" }, 11.85);

  // Caret activates and blinks with 0px gap to text
  timeline.to(promptCaret2, { autoAlpha: 1, duration: 0.05 }, 11.9);
  timeline.to(promptCaret2, { autoAlpha: 0, duration: 0.28, repeat: 7, yoyo: true, ease: "steps(1)" }, 11.95);

  // Stepped character typewriter: "Create an image of a blue sky"
  typeText(typedInput2, "Create an image of a blue sky", 11.95, 0.95);

  // CONTINUOUS CAMERA PAN smoothly accelerating into Send button as typing completes
  timeline.to(camera, {
    scale: 2.15,
    x: -900,
    y: -225,
    duration: 0.95,
    ease: "power3.inOut",
  }, 12.3);

  // Cursor sweeps to send button (1360, 612)
  timeline.to(cursor, {
    x: 1360,
    y: 612,
    duration: 0.65,
    ease: "power3.out",
  }, 12.7);

  // TACTILE CLICK FEEDBACK on send button at 13.35s!
  timeline.to(cursor, { scale: 0.78, duration: 0.08, ease: "power2.in" }, 13.35);
  timeline.to(btnSend2, {
    scale: 0.86,
    boxShadow: "0 0 55px rgba(224, 104, 59, 1), 0 0 25px rgba(224, 104, 59, 0.85)",
    duration: 0.08,
    ease: "power2.in",
  }, 13.35);
  timeline.set(cursorRipple, { x: 1360, y: 612, scale: 0.3, autoAlpha: 0.9 }, 13.35);
  timeline.to(cursorRipple, { scale: 1.8, autoAlpha: 0, duration: 0.35, ease: "power2.out" }, 13.37);

  // Tactile micro-punch on camera at send click
  timeline.to(camera, {
    scale: 2.18,
    duration: 0.25,
    ease: "sine.out",
  }, 13.25);

  // Release on send button
  timeline.to(cursor, { scale: 1, duration: 0.18, ease: "back.out(2)" }, 13.43);
  timeline.to(btnSend2, { scale: 1, duration: 0.25, ease: "back.out(1.8)" }, 13.43);
  timeline.to(promptCaret2, { autoAlpha: 0, duration: 0.05 }, 13.35);

  // Cursor glides off
  timeline.to(cursor, { x: 1440, y: 720, autoAlpha: 0, duration: 0.4, ease: "power3.out" }, 13.48);

  // ============================================================
  // BEAT 9: STANDALONE THINKING STATE — ALONE IN CENTER (13.5s – 15.0s)
  // IT IS COMPLETELY ALONE. NOTHING WITH IT ON SCREEN.
  // Sidebar & Connected Canvas dissolve cleanly into the dark ember void.
  // No image card, no user pill, no bottom bar during thinking!
  // The thinking pill sits alone in the dead center with cycling verbs.
  // ============================================================
  const skyImg = skyCard.querySelector(".cl-sky-img");
  const skyCardFooter = skyCard.querySelector(".cl-sky-card-footer");
  const claudeMsgHeader = root.querySelector("[data-edit='claudeMsgHeader']");

  // 1. DISCONNECT EVERYTHING: Clean workspace with zero sidebar or canvas distraction
  timeline.to([sidebar, connectedCanvas, scene2PromptView], {
    autoAlpha: 0,
    duration: 0.35,
    ease: "power2.in",
  }, 13.5);
  timeline.set([sidebar, connectedCanvas, scene2PromptView, homeView, replyThread, imageGenThread], {
    display: "none",
    autoAlpha: 0,
  }, 13.85);

  // Camera centers dead-center on the screen with 0 rotation
  timeline.to(camera, {
    scale: 1.25,
    x: 0,
    y: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    duration: 0.75,
    ease: "power3.out",
  }, 13.5);

  // 2. STANDALONE THINKING PILL: Mounts alone in the center of the dark screen
  timeline.set(thinkingRow, { display: "flex", autoAlpha: 1 }, 13.55);
  timeline.fromTo(thinkingPill,
    { scale: 0.82, autoAlpha: 0, y: 12 },
    { scale: 1.0, autoAlpha: 1, y: 0, duration: 0.42, ease: "back.out(1.4)" },
    13.58
  );

  // Thinking spark rotates smoothly
  const thinkingSpark = thinkingRow.querySelector(".cl-thinking-spark");
  if (thinkingSpark) {
    timeline.fromTo(thinkingSpark,
      { rotate: 0 },
      { rotate: 360, duration: 1.4, ease: "none" },
      13.58
    );
  }

  // Dynamic cycling random thinking verbs reflecting active reasoning & synthesis
  timeline.call(() => { thinkingText.textContent = "Thinking..."; }, null, 13.60);
  timeline.call(() => { thinkingText.textContent = "Imagining vast blue sky..."; }, null, 14.05);
  timeline.call(() => { thinkingText.textContent = "Synthesizing golden hour lighting..."; }, null, 14.50);

  // Subtle breathing scale on the standalone thinking pill
  timeline.to(thinkingPill, {
    scale: 1.05,
    duration: 0.8,
    ease: "sine.inOut",
  }, 14.0);

  // Thinking finishes! Pill dissolves smoothly before revealing chat
  timeline.to(thinkingPill, {
    autoAlpha: 0,
    scale: 0.92,
    duration: 0.22,
    ease: "power2.in",
  }, 14.85);
  timeline.set(thinkingRow, { display: "none" }, 15.02);

  // ============================================================
  // BEAT 10: GO TO CHAT — PHOTOREALISTIC 8K BLUE SKY CARD REVEAL (15.0s – 17.8s)
  // "after its done we can go to the chat"
  // Generous, proud ~2.8s hold so the viewer can actually absorb and admire the result!
  // ============================================================
  timeline.set(imageGenThread, { display: "flex", autoAlpha: 1 }, 15.0);
  timeline.set(skyResponse, { autoAlpha: 1 }, 15.0);

  // Camera frames the chat nicely
  timeline.to(camera, {
    scale: 1.14,
    x: 0,
    y: -10,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    duration: 0.75,
    ease: "power3.out",
  }, 15.0);

  // User message bubble rises into view at top right
  timeline.fromTo(skyUserPill,
    { y: 22, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out" },
    15.04
  );

  // Claude message header ("Claude" + Sonnet 4.6 + spark) reveals
  if (claudeMsgHeader) {
    timeline.set(claudeMsgHeader, { display: "flex" }, 15.08);
    timeline.fromTo(claudeMsgHeader,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" },
      15.08
    );
  }

  // Claude response text headline reveals
  timeline.fromTo(skyResponseHeadline,
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" },
    15.12
  );

  // The 8K Blue Sky card mounts with pristine clarity and blooms
  if (skyImg) {
    timeline.set(skyImg, { autoAlpha: 1 }, 15.0);
    timeline.fromTo(skyImg,
      { scale: 1.05 },
      { scale: 1.0, duration: 0.7, ease: "power3.out" },
      15.14
    );
  }
  if (skyCardFooter) {
    timeline.set(skyCardFooter, { autoAlpha: 1, y: 0 }, 15.0);
  }
  timeline.fromTo(skyCard,
    { scale: 0.94, autoAlpha: 0, y: 24 },
    { scale: 1.0, autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" },
    15.14
  );

  // Bottom chat bar anchors the response view
  timeline.fromTo(bottomChatBar2,
    { autoAlpha: 0, y: 16 },
    { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" },
    15.18
  );

  // PROUD CINEMATIC HOLD (15.18s – 17.8s):
  // Continuous gentle breathing drift so it feels alive and proud, letting viewer absorb every detail
  timeline.to(camera, {
    scale: 1.18,
    x: 0,
    y: -14,
    duration: 2.6,
    ease: "sine.inOut",
  }, 15.20);

  // ============================================================
  // SCENE 3: CLAUDE MOBILE SHOWCASE — DEEP ZOOM & ACTIVE USER INTERACTION (17.8s – 21.6s)
  // Smooth spatial handoff: phone enters gracefully, camera zooms deep (scale: 1.62),
  // user taps composer, types new prompt, and clicks send!
  // ============================================================
  const mobileShowcase = root.querySelector("[data-edit='claudeMobileShowcase']");
  const mobileDevice = root.querySelector("[data-edit='claudeMobileDevice']");
  const mobileThread = root.querySelector("[data-edit='claudeMobileThread']");
  const mobileThinking = root.querySelector("[data-edit='claudeMobileThinking']");
  const mobileCard = root.querySelector("[data-edit='claudeMobileCard']");
  const mobileUserRow = root.querySelector(".cl-m-user-row");
  const mobileUserRow2 = root.querySelector("[data-edit='claudeMobileUserRow2']");
  const mobileThinking2 = root.querySelector("[data-edit='claudeMobileThinking2']");
  const mobileComposer = root.querySelector(".cl-m-composer");
  const mobilePlaceholder = root.querySelector("[data-edit='claudeMobilePlaceholder']");
  const mobileTyped = root.querySelector("[data-edit='claudeMobileTyped']");
  const mobileCaret = root.querySelector("[data-edit='claudeMobileCaret']");
  const mobileSendBtn = root.querySelector("[data-edit='claudeMobileSendBtn']");

  // 1. Desktop chat recedes smoothly
  timeline.to(imageGenThread, {
    scale: 0.94,
    autoAlpha: 0,
    duration: 0.4,
    ease: "power2.inOut",
  }, 17.8);
  timeline.set(imageGenThread, { display: "none" }, 18.2);

  // 2. Mobile showcase mounts with steady, elegant framing (no 3D z-fighting)
  if (mobileShowcase) {
    timeline.set(mobileShowcase, { display: "flex", autoAlpha: 1 }, 17.82);
  }

  if (mobileDevice) {
    timeline.fromTo(mobileDevice,
      {
        y: 280,
        scale: 0.92,
        autoAlpha: 0,
      },
      {
        y: 0,
        scale: 1.0,
        autoAlpha: 1,
        duration: 0.75,
        ease: "power3.out",
      },
      17.85
    );
  }

  // Camera frames the mobile device perfectly with luxurious margins (whole phone visible)
  timeline.to(camera, {
    scale: 1.25,
    x: 0,
    y: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    duration: 0.75,
    ease: "power3.out",
  }, 17.85);

  // 3. Cascade internal mobile thread elements
  if (mobileUserRow) {
    timeline.fromTo(mobileUserRow,
      { y: 16, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" },
      18.00
    );
  }

  if (mobileComposer) {
    timeline.fromTo(mobileComposer,
      { y: 20, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" },
      18.05
    );
  }

  if (mobileThinking) {
    timeline.fromTo(mobileThinking,
      { scale: 0.88, autoAlpha: 0, y: 8 },
      { scale: 1.0, autoAlpha: 1, y: 0, duration: 0.35, ease: "back.out(1.5)" },
      18.15
    );
  }

  // Mobile Blue Sky response card blooms in with instant sync confirmation
  if (mobileCard) {
    timeline.fromTo(mobileCard,
      { scale: 0.94, autoAlpha: 0, y: 14 },
      { scale: 1.0, autoAlpha: 1, y: 0, duration: 0.5, ease: "back.out(1.35)" },
      18.25
    );
  }

  // Gentle, steady cinematic breathing drift during the mobile interaction (NO jerky zoom down!)
  timeline.to(camera, {
    scale: 1.30,
    x: 0,
    y: -8,
    duration: 3.3,
    ease: "sine.inOut",
  }, 18.30);

  // 4. ACTIVE USER INTERACTION: Cursor glides to mobile composer & types another prompt
  timeline.fromTo(cursor,
    { x: 1020, y: 920, autoAlpha: 0, scale: 0.9 },
    { x: 930, y: 860, autoAlpha: 1, scale: 1, duration: 0.45, ease: "power3.out" },
    18.80
  );

  // TACTILE TOUCH TAP on mobile composer at 19.15s
  timeline.to(cursor, { scale: 0.78, duration: 0.08, ease: "power2.in" }, 19.15);
  timeline.to(cursor, { scale: 1.0, duration: 0.18, ease: "back.out(2)" }, 19.23);
  timeline.set(cursorRipple, { x: 930, y: 860, scale: 0.3, autoAlpha: 0.85 }, 19.15);
  timeline.to(cursorRipple, { scale: 1.8, autoAlpha: 0, duration: 0.35, ease: "power2.out" }, 19.17);

  // Composer activates: placeholder fades out, caret blinks
  if (mobilePlaceholder) timeline.to(mobilePlaceholder, { autoAlpha: 0, duration: 0.12 }, 19.18);
  if (mobileCaret) {
    timeline.to(mobileCaret, { autoAlpha: 1, duration: 0.05 }, 19.20);
    timeline.to(mobileCaret, { autoAlpha: 0, duration: 0.22, repeat: 4, yoyo: true, ease: "steps(1)" }, 19.22);
  }

  // Stepped typewriter inputs the new prompt: "Explain the atmospheric lighting here"
  if (mobileTyped) {
    typeText(mobileTyped, "Explain the atmospheric lighting here", 19.30, 0.80);
  }

  // Cursor sweeps to mobile send button at (1115, 860)
  timeline.to(cursor, { x: 1115, y: 860, duration: 0.28, ease: "power3.out" }, 20.20);

  // TACTILE CLICK ON SEND at 20.45s
  timeline.to(cursor, { scale: 0.78, duration: 0.08, ease: "power2.in" }, 20.45);
  if (mobileSendBtn) {
    timeline.to(mobileSendBtn, {
      scale: 0.84,
      boxShadow: "0 0 25px rgba(224, 104, 59, 0.95)",
      duration: 0.08,
      ease: "power2.in",
    }, 20.45);
  }
  timeline.set(cursorRipple, { x: 1115, y: 860, scale: 0.3, autoAlpha: 0.9 }, 20.45);
  timeline.to(cursorRipple, { scale: 1.8, autoAlpha: 0, duration: 0.35, ease: "power2.out" }, 20.47);
  timeline.to(cursor, { scale: 1.0, duration: 0.18, ease: "back.out(2)" }, 20.53);
  if (mobileSendBtn) timeline.to(mobileSendBtn, { scale: 1.0, duration: 0.22, ease: "back.out(1.8)" }, 20.53);
  if (mobileCaret) timeline.to(mobileCaret, { autoAlpha: 0, duration: 0.05 }, 20.45);
  timeline.to(cursor, { autoAlpha: 0, duration: 0.25 }, 20.65);

  // Composer resets & new user bubble pops up naturally below the card (ZERO header overlap!)
  if (mobileTyped) timeline.set(mobileTyped, { textContent: "" }, 20.55);
  if (mobilePlaceholder) timeline.to(mobilePlaceholder, { autoAlpha: 1, duration: 0.2 }, 20.55);

  if (mobileUserRow2) {
    timeline.set(mobileUserRow2, { display: "flex" }, 20.55);
    timeline.fromTo(mobileUserRow2,
      { y: 16, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.4, ease: "back.out(1.4)" },
      20.55
    );
  }
  if (mobileThinking2) {
    timeline.set(mobileThinking2, { display: "flex" }, 20.72);
    timeline.fromTo(mobileThinking2,
      { scale: 0.85, autoAlpha: 0, y: 8 },
      { scale: 1.0, autoAlpha: 1, y: 0, duration: 0.35, ease: "back.out(1.5)" },
      20.72
    );
    const mSpark2 = mobileThinking2.querySelector(".cl-m-spark-spin");
    if (mSpark2) {
      timeline.fromTo(mSpark2, { rotate: 0 }, { rotate: 360, duration: 1.2, ease: "none" }, 20.72);
    }
  }

  // Proud hold on the interactive mobile result until 21.60s
  // 5. Clean handoff to climax: phone recedes
  if (mobileDevice) {
    timeline.to(mobileDevice, {
      scale: 0.92,
      autoAlpha: 0,
      duration: 0.38,
      ease: "power2.in",
    }, 21.60);
  }
  if (mobileShowcase) {
    timeline.to(mobileShowcase, {
      autoAlpha: 0,
      duration: 0.38,
      ease: "power2.in",
    }, 21.60);
    timeline.set(mobileShowcase, { display: "none" }, 22.0);
  }

  // Camera pulls back smoothly to dead center (scale 1.0, x: 0, y: 0)
  timeline.to(camera, {
    scale: 1.0,
    x: 0,
    y: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    duration: 0.75,
    ease: "power2.inOut",
  }, 21.60);

  // ============================================================
  // SCENE 4: GRAND CLIMAX — "✳ Claude is everywhere." (22.0s – 24.5s)
  // Completely segregated: mounts ONLY AFTER mobile is 100% hidden (at 22.0s)!
  // Zero double-exposure, zero z-fighting, zero flickering!
  // ============================================================
  const climaxSpark = root.querySelector(".cl-climax-spark");

  // Climax sequence activates in complete isolation
  timeline.set(climaxSequence, { display: "flex", autoAlpha: 1 }, 22.0);

  // Giant-to-Settle Kinetic Zoom: enters large (scale: 1.35) and settles directly into centered lockup
  timeline.fromTo(climaxSequence,
    { scale: 1.35, autoAlpha: 0 },
    { scale: 1.0, autoAlpha: 1, duration: 0.65, ease: "power3.out" },
    22.0
  );

  // Asterisk spark blooms and spins into place
  if (climaxSpark) {
    timeline.fromTo(climaxSpark,
      { scale: 0, rotate: -90, autoAlpha: 0 },
      { scale: 1, rotate: 0, autoAlpha: 1, duration: 0.55, ease: "back.out(1.8)" },
      22.05
    );
  }

  // "Claude is" enters cleanly with luminous presence
  timeline.fromTo(climaxPrefix,
    { autoAlpha: 0, y: 15 },
    { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" },
    22.10
  );

  // "everywhere." slides UP from below in radiant terracotta #e0683b to complete the full sentence
  timeline.fromTo(climaxEverywhere,
    { y: 55, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.55, ease: "back.out(1.4)" },
    22.35
  );

  // Continuous subtle breathing & confident, rock-solid reading hold until 24.5s
  timeline.to(climaxSequence, {
    scale: 1.03,
    duration: 2.1,
    ease: "sine.inOut",
  }, 22.40);

  // Ensure all prior background UI elements are cleanly hidden
  timeline.set([homeView, greetingBox, promptShell, replyThread, scene2PromptView, sidebar, imageGenThread, mobileShowcase], {
    autoAlpha: 0,
    display: "none",
  }, 22.0);
}

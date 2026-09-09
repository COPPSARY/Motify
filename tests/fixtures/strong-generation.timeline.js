export function buildTimeline(context) {
  const { root, timeline, register } = context;
  const get = (id) => {
    const element = root.querySelector('[data-edit="' + id + '"]');
    if (!element) {
      console.warn('Motionly: no [data-edit="' + id + '"] layer to animate.');
      return document.createElement("div");
    }
    register(id, element);
    return element;
  };
  const all = (selector) => Array.from(root.querySelectorAll(selector));

  const stage = get("stage");
  const signal = get("semantic-signal");
  const world = get("camera-world");
  const carrier = get("story-carrier");
  const hookFace = get("hook-face");
  const hookCopy = get("hook-copy");
  const productFace = get("product-face");
  const sidebar = get("product-sidebar");
  const navItems = all(".motionly-product-face .motionly-nav-item");
  const workspace = get("product-workspace");
  const productTitle = get("product-title");
  const focusRig = get("focus-rig");
  const promptShell = get("prompt-shell");
  const promptCopy = get("prompt-copy");
  const caret = get("prompt-caret");
  const action = get("action-button");
  const cursor = get("cursor");
  const proofFace = get("proof-face");
  const response = get("response-copy");
  const responseLines = all(".motionly-response-line");
  const proofCard = get("proof-card");
  const proofValue = get("proof-value");
  const finalFace = get("final-face");
  const finalCopy = get("final-copy");

  const typeText = (target, text, start, duration) => {
    timeline.set(target, { textContent: "" }, 0);
    timeline.set(target, { textContent: "" }, start);
    const state = { count: 0 };
    timeline.fromTo(
      state,
      { count: 0 },
      {
        count: text.length,
        duration: duration,
        ease: "steps(" + text.length + ")",
        onUpdate: () => {
          target.textContent = text.slice(0, Math.round(state.count));
        },
      },
      start,
    );
  };

  // --- Time 0: Initial states --- 
  timeline.set(stage, { autoAlpha: 1 }, 0);
  timeline.set(world, { x: 0, y: 0, scale: 1 }, 0);
  timeline.set(carrier, { x: 310, y: 390, width: 1300, height: 300, borderRadius: 30, background: "rgba(15,17,23,0)", borderColor: "rgba(255,255,255,0)", boxShadow: "0 0 0 rgba(0,0,0,0)" }, 0);
  timeline.set(hookFace, { display: "flex", autoAlpha: 1 }, 0);
  timeline.set(productFace, { display: "none", autoAlpha: 0 }, 0);
  timeline.set(proofFace, { display: "none", autoAlpha: 0 }, 0);
  timeline.set(finalFace, { display: "none", autoAlpha: 0 }, 0);
  timeline.set(signal, { scaleX: 0, autoAlpha: .4 }, 0);
  timeline.set(focusRig, { scale: 1 }, 0);
  timeline.set(caret, { autoAlpha: 0 }, 0);
  timeline.set(cursor, { x: 1340, y: 1040, scale: 1, autoAlpha: 0 }, 0);
  timeline.set(proofCard, { autoAlpha: 0 }, 0);

  // --- scene-01 (0.0 - 4.5): Kinetic center build --- 
  continuousTextGradient(hookCopy, "linear-gradient(90deg, #fff 0%, #4f46e5 60%, #a855f7 100%)");
  giantKineticCrop(timeline, hookCopy, { at: 0.2, startScale: 2.2, endScale: 1, duration: 1.4, unit: "words", stagger: .08, settleEase: "back.out(1.35)" });
  timeline.to(signal, { scaleX: 1, duration: 3.5, ease: "power2.inOut" }, 0.4);
  timeline.to(carrier, { y: 380, duration: 2.2, ease: "sine.inOut" }, 1.5);

  // --- scene-02 (4.5 - 9.5): Morph handoff & progressive construction --- 
  timeline.set(productFace, { display: "grid", autoAlpha: 0 }, 4.38);
  morph(timeline, carrier, { x: 2130, y: 130, width: 1500, height: 820, borderRadius: 32, background: "rgba(15,17,23,.98)", borderColor: "rgba(255,255,255,.14)", boxShadow: "0 40px 120px rgba(0,0,0,.6)" }, { at: 4.5, duration: 1.25, ease: "expo.inOut" });
  timeline.to(world, { x: -1920, y: 0, scale: 1, duration: 1.25, ease: "expo.inOut" }, 4.5);
  timeline.to(hookFace, { autoAlpha: 0, duration: .35, ease: "power2.in" }, 4.52);
  timeline.to(productFace, { autoAlpha: 1, duration: .45, ease: "power2.out" }, 4.62);
  timeline.set(hookFace, { display: "none" }, 4.9);

  timeline.fromTo(sidebar, { x: -90, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .9, ease: "power4.out" }, 4.7);
  timeline.fromTo(navItems, { x: -26, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .6, stagger: .09, ease: "power3.out" }, 4.88);
  timeline.fromTo(workspace, { y: 54, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: "power4.out" }, 5.02);
  wordSlideRotate(timeline, productTitle, { at: 5.25, distance: 38, stagger: .07, rotation: 2, duration: .75, ease: "back.out(1.25)" });
  timeline.fromTo(promptShell, { y: 72, autoAlpha: 0, scale: .96 }, { y: 0, autoAlpha: 1, scale: 1, duration: 1.05, ease: "back.out(1.25)" }, 5.6);

  timeline.to(caret, { autoAlpha: 1, duration: .12 }, 6.5);
  typeText(promptCopy, "Create a cinematic SaaS product walkthrough with neon particle accents", 6.6, 1.8);
  timeline.to(world, { x: -2050, y: -28, duration: 1.8, ease: "sine.inOut" }, 6.6);

  timeline.to(world, { x: -3367, y: -595, scale: 1.42, duration: 1.0, ease: "expo.inOut" }, 8.5);
  timeline.fromTo(cursor, { x: 1340, y: 1040, autoAlpha: 0 }, { x: 1104, y: 700, autoAlpha: 1, duration: .8, ease: "power3.inOut" }, 8.6);
  timeline.to(cursor, { scale: .84, duration: .09, yoyo: true, repeat: 1, ease: "power2.inOut" }, 9.34);
  timeline.to(action, { scale: .89, duration: .1, yoyo: true, repeat: 1, ease: "back.out(1.45)" }, 9.36);
  timeline.to(caret, { autoAlpha: 0, duration: .12 }, 9.44);

  // --- scene-03 (9.5 - 14.0): Structured proof and metrics --- 
  timeline.set(proofFace, { display: "grid", autoAlpha: 0 }, 9.34);
  timeline.to([promptShell, productTitle], { y: -46, autoAlpha: 0, duration: .5, ease: "power3.in" }, 9.38);
  timeline.to(cursor, { y: 900, autoAlpha: 0, duration: .45, ease: "power2.in" }, 9.4);
  morph(timeline, carrier, { x: 4050, y: 130, width: 1500, height: 820, borderRadius: 32 }, { at: 9.5, duration: 1.15, ease: "expo.inOut" });
  timeline.to(world, { x: -3840, y: 0, scale: 1, duration: 1.15, ease: "expo.inOut" }, 9.5);
  timeline.to(productFace, { autoAlpha: 0, duration: .35, ease: "power2.in" }, 9.54);
  timeline.to(proofFace, { autoAlpha: 1, duration: .45, ease: "power2.out" }, 9.6);
  timeline.set(productFace, { display: "none" }, 9.9);

  wordSlideRotate(timeline, response, { at: 9.8, distance: 44, stagger: .06, rotation: 1.5, duration: .8, ease: "back.out(1.3)" });
  timeline.fromTo(responseLines, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .12, ease: "power3.out" }, 10.4);
  timeline.fromTo(proofCard, { autoAlpha: 0, y: 40, scale: 0.95 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: "back.out(1.2)" }, 10.8);
  stepSurgeCounter(timeline, proofValue, { at: 11.2, start: 0, surgeTarget: 85, end: 98, suffix: "%", duration: 1.4 });
  timeline.to(world, { x: -3910, y: -20, scale: 1.05, duration: 2.2, ease: "sine.inOut" }, 11.5);

  // --- scene-04 (14.0 - 18.0): Final resolve --- 
  timeline.set(finalFace, { display: "flex", autoAlpha: 0 }, 13.74);
  timeline.to(responseLines, { y: -30, autoAlpha: 0, duration: .4, stagger: -.05, ease: "power3.in" }, 13.8);
  timeline.to([response, proofCard], { y: -36, autoAlpha: 0, duration: .45, ease: "power3.in" }, 13.86);
  morph(timeline, carrier, { x: 4450, y: 418, width: 700, height: 244, borderRadius: 122 }, { at: 14.0, duration: 1.2, ease: "expo.inOut" });
  timeline.to(world, { x: -3840, y: 0, scale: 1, duration: 1.2, ease: "expo.inOut" }, 14.0);
  timeline.to(proofFace, { autoAlpha: 0, duration: .34, ease: "power2.in" }, 13.94);
  timeline.to(finalFace, { autoAlpha: 1, duration: .45, ease: "power2.out" }, 13.98);
  timeline.set(proofFace, { display: "none" }, 14.3);

  charSpringBounce(timeline, finalCopy, { at: 14.15, distance: 40, stagger: .035, duration: .65, ease: "back.out(1.4)" });
  timeline.to(signal, { scaleX: .18, autoAlpha: .8, duration: 1.0, ease: "power3.inOut" }, 14.5);
  timeline.to(carrier, { scale: 1.02, duration: 2.5, ease: "sine.inOut" }, 15.2);
  timeline.to({}, { duration: .2 }, 17.8);
}
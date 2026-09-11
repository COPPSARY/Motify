import type { SceneDefinition } from "../composition/types";

/**
 * The starting composition every AI generation edits, so a new film begins from
 * directed choreography instead of an empty stage.
 *
 * It is a brand-neutral distillation of what makes the reference presets
 * (Claude, KiriTTS, Apple Notes) feel directed, and it is the *quality* floor,
 * not a visual template: carrier-led construction, a camera with destinations, a
 * typing-follow pan, a macro interaction shot, readable holds, and
 * reverse-hierarchy deconstruction. The model must re-theme the product,
 * palette, copy, and information architecture for each request.
 */

/**
 * Persisted marker written into generated HTML as
 * `data-motionly-generation-profile`. The value is deliberately frozen: existing
 * user compositions and local drafts carry it, and changing the string would
 * make the editor treat them as un-founded projects.
 */
export const GENERATION_FOUNDATION_PROFILE = "claude-foundation-v1";

export const foundationScenes: readonly SceneDefinition[] = [
  {
    id: "scene-01",
    label: "01 · Editorial hook",
    start: 0,
    duration: 4,
    accent: "#d97757",
  },
  {
    id: "scene-02",
    label: "02 · Product construction",
    start: 4,
    duration: 6,
    accent: "#8b5cf6",
  },
  {
    id: "scene-03",
    label: "03 · Interaction and proof",
    start: 10,
    duration: 5.5,
    accent: "#22c55e",
  },
  {
    id: "scene-04",
    label: "04 · Carrier resolve",
    start: 15.5,
    duration: 4.5,
    accent: "#f59e0b",
  },
];

/**
 * The foundation's own carrier chain: one `story-carrier` whose outline morphs
 * from the hook plate into the product window, into the proof window, and down
 * into the closing lockup. Each seam opens before its cut and closes after it,
 * which is what lets both faces be on screen while the carrier crosses.
 *
 * Shipping these with the scaffold means the first thing every generation reads
 * is a worked example of the contract it has to return.
 */
export const foundationSeams = [
  {
    from: "scene-01",
    to: "scene-02",
    at: 3.88,
    duration: 1.37,
    carrier: "story-carrier",
    mechanism: "morph" as const,
    becomes: "the hook plate stretches into the product window",
  },
  {
    from: "scene-02",
    to: "scene-03",
    at: 9.74,
    duration: 1.46,
    carrier: "story-carrier",
    mechanism: "morph" as const,
    becomes: "the product window travels and reforms as the proof window",
  },
  {
    from: "scene-03",
    to: "scene-04",
    at: 15.24,
    duration: 1.51,
    carrier: "story-carrier",
    mechanism: "morph" as const,
    becomes: "the proof window collapses into the closing lockup",
  },
];

export const foundationHtml = `<template id="motionly-composition-template">
  <style>
    .motionly-stage {
      --ink: #f7f4ef;
      --muted: #a7a0b2;
      --surface: #17151d;
      --surface-2: #211e29;
      --accent: #d97757;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      color: var(--ink);
      background: #09080d;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }
    .motionly-field {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
        radial-gradient(circle at 50% 45%, rgba(217,119,87,.16), transparent 34%);
      background-size: 88px 88px, 88px 88px, 100% 100%;
    }
    .motionly-signal {
      position: absolute;
      left: 8%;
      right: 8%;
      top: 50%;
      height: 1px;
      transform-origin: left center;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      box-shadow: 0 0 26px rgba(217,119,87,.55);
    }
    .motionly-world {
      position: absolute;
      left: 0;
      top: 0;
      width: 5760px;
      height: 1080px;
      transform-origin: 0 0;
      will-change: transform;
    }
    .motionly-carrier {
      position: absolute;
      left: 0;
      top: 0;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(20,18,26,.92);
      box-shadow: 0 38px 110px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.025) inset;
      transform-origin: center;
    }
    .motionly-face { position: absolute; inset: 0; }
    .motionly-hook-face {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 42px 58px;
      text-align: center;
    }
    .motionly-hook-copy {
      margin: 0;
      max-width: 1120px;
      font-size: 68px;
      line-height: .98;
      letter-spacing: -.055em;
      font-weight: 760;
    }
    .motionly-product-face,
    .motionly-proof-face {
      display: grid;
      grid-template-columns: 270px 1fr;
      background: #111016;
    }
    .motionly-sidebar {
      padding: 28px 22px;
      border-right: 1px solid rgba(255,255,255,.08);
      background: #19171f;
    }
    .motionly-brand { font: 700 31px/1 Georgia, serif; margin-bottom: 32px; }
    .motionly-nav-item {
      margin: 9px 0;
      padding: 12px 14px;
      border-radius: 12px;
      color: #c7c1ce;
      font-size: 16px;
    }
    .motionly-nav-item.is-active { color: white; background: rgba(255,255,255,.075); }
    .motionly-workspace { position: relative; padding: 52px 64px; overflow: hidden; }
    .motionly-kicker { color: var(--accent); font-size: 14px; font-weight: 750; letter-spacing: .16em; text-transform: uppercase; }
    .motionly-product-title { margin: 14px 0 0; font-size: 52px; line-height: 1.02; letter-spacing: -.045em; }
    .motionly-focus-rig {
      position: absolute;
      left: 64px;
      right: 64px;
      bottom: 56px;
      transform-origin: 50% 100%;
    }
    .motionly-prompt {
      position: relative;
      min-height: 190px;
      padding: 30px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 24px;
      background: #211e29;
      box-shadow: 0 24px 70px rgba(0,0,0,.35);
    }
    .motionly-prompt-line { max-width: 850px; font-size: 26px; line-height: 1.35; }
    .motionly-prompt-copy { font-size: 26px; line-height: 1.35; }
    .motionly-caret {
      display: inline-block;
      width: 3px;
      height: 27px;
      margin: 0;
      vertical-align: -3px;
      background: var(--accent);
    }
    .motionly-action {
      position: absolute;
      right: 24px;
      bottom: 22px;
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      border-radius: 16px;
      color: #fff;
      background: var(--accent);
      font-size: 22px;
      font-weight: 800;
    }
    .motionly-cursor {
      position: absolute;
      left: 0;
      top: 0;
      width: 34px;
      height: 46px;
      pointer-events: none;
      filter: drop-shadow(0 10px 22px rgba(0,0,0,.55));
    }
    .motionly-response {
      margin-top: 38px;
      max-width: 820px;
      font-size: 38px;
      line-height: 1.12;
      letter-spacing: -.035em;
      font-weight: 720;
    }
    .motionly-response-list { margin: 30px 0 0; padding: 0; max-width: 780px; list-style: none; }
    .motionly-response-line {
      margin: 0 0 14px;
      padding: 16px 20px;
      border-radius: 14px;
      background: rgba(255,255,255,.045);
      font-size: 21px;
      color: #ddd7e4;
    }
    .motionly-proof-card {
      position: absolute;
      right: 62px;
      top: 150px;
      width: 390px;
      min-height: 470px;
      padding: 30px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 28px;
      background: linear-gradient(145deg, #292532, #18161d);
    }
    .motionly-proof-label { color: var(--muted); font-size: 14px; letter-spacing: .12em; text-transform: uppercase; }
    .motionly-proof-value { margin-top: 18px; font-size: 74px; letter-spacing: -.06em; font-weight: 780; font-variant-numeric: tabular-nums; }
    .motionly-proof-line { height: 8px; margin-top: 20px; border-radius: 999px; background: rgba(255,255,255,.1); overflow: hidden; }
    .motionly-proof-line::after { content: ""; display: block; width: 72%; height: 100%; background: var(--accent); }
    .motionly-final-face { display: flex; align-items: center; justify-content: center; text-align: center; padding: 38px; }
    .motionly-final-copy { font-size: 50px; line-height: 1; letter-spacing: -.05em; font-weight: 780; }
    .motionly-final-copy strong { color: var(--accent); }
  </style>
  <main class="motionly-stage" data-edit="stage" data-edit-label="Background" data-motionly-generation-profile="claude-foundation-v1">
    <div class="motionly-field" data-background-role="carrier-grid"></div>
    <div class="motionly-signal" data-edit="semantic-signal" data-edit-label="Signal path" data-background-role="signal-path"></div>
    <div class="motionly-world" data-edit="camera-world" data-edit-label="Camera world" data-camera-world>
      <section class="motionly-carrier" data-edit="story-carrier" data-edit-label="Story carrier" data-transition-carrier data-hyperframe-component="morph-swap">
        <div class="motionly-face motionly-hook-face" data-edit="hook-face" data-edit-label="Hook" data-scene="scene-01" data-hyperframe-component="per-word-rise">
          <h1 class="motionly-hook-copy" data-edit="hook-copy" data-edit-label="Hook statement" data-field="content" data-field-label="Statement" data-field-type="text" data-field-binding="text">Your product should feel inevitable.</h1>
        </div>
        <div class="motionly-face motionly-product-face" data-edit="product-face" data-edit-label="Product UI" data-scene="scene-02" data-hyperframe-component="browser-device-stage">
          <aside class="motionly-sidebar" data-edit="product-sidebar" data-edit-label="Navigation">
            <div class="motionly-brand" data-edit="product-brand" data-edit-label="Product name" data-field="content" data-field-label="Product name" data-field-type="text" data-field-binding="text">Northstar</div>
            <div class="motionly-nav-item is-active" data-edit="product-nav-1" data-edit-label="Nav item 1">Workspace</div>
            <div class="motionly-nav-item" data-edit="product-nav-2" data-edit-label="Nav item 2">Automations</div>
            <div class="motionly-nav-item" data-edit="product-nav-3" data-edit-label="Nav item 3">Insights</div>
          </aside>
          <div class="motionly-workspace" data-edit="product-workspace" data-edit-label="Workspace">
            <div class="motionly-kicker" data-edit="product-kicker" data-edit-label="Kicker">Intelligent workflow</div>
            <h2 class="motionly-product-title" data-edit="product-title" data-edit-label="Product headline" data-field="content" data-field-label="Headline" data-field-type="text" data-field-binding="text">Turn a request into finished work.</h2>
            <div class="motionly-focus-rig" data-edit="focus-rig" data-edit-label="Macro focus rig" data-hyperframe-component="ui-focus-zoom">
              <div class="motionly-prompt" data-edit="prompt-shell" data-edit-label="Prompt" data-hyperframe-component="typed-prompt">
                <div class="motionly-prompt-line"><span class="motionly-prompt-copy" data-edit="prompt-copy" data-edit-label="Prompt text" data-field="content" data-field-label="Prompt" data-field-type="text" data-field-binding="text"></span><span class="motionly-caret" data-edit="prompt-caret" data-edit-label="Caret"></span></div>
                <div class="motionly-action" data-edit="action-button" data-edit-label="Action button">↑</div>
              </div>
            </div>
            <svg class="motionly-cursor" data-edit="cursor" data-edit-label="Cursor" viewBox="0 0 34 46" aria-hidden="true"><path d="M2 2l28 17-12 3 7 14-6 3-7-14-10 8z" fill="#fff" stroke="#0d0c11" stroke-width="2" stroke-linejoin="round"/></svg>
          </div>
        </div>
        <div class="motionly-face motionly-proof-face" data-edit="proof-face" data-edit-label="Product proof" data-scene="scene-03" data-hyperframe-component="streaming-text">
          <aside class="motionly-sidebar" data-edit="proof-sidebar" data-edit-label="Proof navigation">
            <div class="motionly-brand" data-edit="proof-brand" data-edit-label="Product name">Northstar</div>
            <div class="motionly-nav-item is-active" data-edit="proof-nav-1" data-edit-label="Proof nav 1">Launch plan</div>
            <div class="motionly-nav-item" data-edit="proof-nav-2" data-edit-label="Proof nav 2">Evidence</div>
          </aside>
          <div class="motionly-workspace" data-edit="proof-workspace" data-edit-label="Proof workspace">
            <div class="motionly-kicker" data-edit="proof-kicker" data-edit-label="Proof kicker">Completed in context</div>
            <div class="motionly-response" data-edit="response-copy" data-edit-label="Response" data-field="content" data-field-label="Response" data-field-type="text" data-field-binding="text">The plan arrives structured, prioritized, and ready to act on.</div>
            <ul class="motionly-response-list" data-edit="response-list" data-edit-label="Response detail">
              <li class="motionly-response-line" data-edit="response-line-1" data-edit-label="Response line 1">Positioning brief approved by the launch group</li>
              <li class="motionly-response-line" data-edit="response-line-2" data-edit-label="Response line 2">Pricing page rewritten against the new segment</li>
              <li class="motionly-response-line" data-edit="response-line-3" data-edit-label="Response line 3">Announcement sequence scheduled for 14 March</li>
            </ul>
            <div class="motionly-proof-card" data-edit="proof-card" data-edit-label="Proof card" data-hyperframe-component="count-up">
              <div class="motionly-proof-label" data-edit="proof-label" data-edit-label="Proof label">Impact score</div>
              <div class="motionly-proof-value" data-edit="proof-value" data-edit-label="Proof value">94%</div>
              <div class="motionly-proof-line"></div><div class="motionly-proof-line"></div><div class="motionly-proof-line"></div>
            </div>
          </div>
        </div>
        <div class="motionly-face motionly-final-face" data-edit="final-face" data-edit-label="Final promise" data-scene="scene-04">
          <div class="motionly-final-copy" data-edit="final-copy" data-edit-label="Final statement" data-field="content" data-field-label="Final statement" data-field-type="text" data-field-binding="text">From intent to <strong>impact.</strong></div>
        </div>
      </section>
    </div>
  </main>
</template>`;

export const foundationTimeline = `export function buildTimeline(context) {
  const { root, timeline, register } = context;
  // A missing layer costs that layer its motion, never the whole film: this
  // helper is copied into generated timelines, and one mistyped id must not
  // take down every other beat with it. The stand-in is a detached node, so
  // tweens written against it run harmlessly and render nothing.
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

  // Deterministic stepped typewriter with a zero-gap caret. Reverse-seek safe:
  // every frame recomputes the slice from the tweened counter.
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

  // --- Time 0: every layered state is explicit -----------------------------
  timeline.set(stage, { autoAlpha: 1 }, 0);
  timeline.set(world, { x: 0, y: 0, scale: 1 }, 0);
  timeline.set(carrier, { x: 310, y: 390, width: 1300, height: 300, borderRadius: 30, background: "rgba(20,18,26,0)", borderColor: "rgba(255,255,255,0)", boxShadow: "0 0 0 rgba(0,0,0,0)" }, 0);
  timeline.set(hookFace, { display: "flex", autoAlpha: 1 }, 0);
  timeline.set(productFace, { display: "none", autoAlpha: 0 }, 0);
  timeline.set(proofFace, { display: "none", autoAlpha: 0 }, 0);
  timeline.set(finalFace, { display: "none", autoAlpha: 0 }, 0);
  timeline.set(signal, { scaleX: 0, autoAlpha: .35 }, 0);
  timeline.set(focusRig, { scale: 1 }, 0);
  timeline.set(caret, { autoAlpha: 0 }, 0);
  timeline.set(cursor, { x: 1340, y: 1040, scale: 1, autoAlpha: 0 }, 0);
  timeline.set(proofCard, { autoAlpha: 0 }, 0);

  // --- scene-01 (0.0 - 4.0): one editorial thought --------------------------
  continuousTextGradient(hookCopy, "linear-gradient(90deg, #fff 0%, #d97757 55%, #a78bfa 100%)");
  giantKineticCrop(timeline, hookCopy, { at: 0.15, startScale: 2.2, endScale: 1, duration: 1.3, unit: "words", stagger: .07, settleEase: "back.out(1.35)" });
  timeline.to(signal, { scaleX: 1, duration: 3.2, ease: EASE.travel }, .35);
  timeline.to(carrier, { y: 380, duration: 2.1, ease: "sine.inOut" }, 1.5);

  // --- scene-02 (4.0 - 10.0): MORPH handoff, then progressive construction --
  timeline.set(productFace, { display: "grid", autoAlpha: 0 }, 3.88);
  morph(timeline, carrier, { x: 2130, y: 130, width: 1500, height: 820, borderRadius: 32, background: "rgba(20,18,26,.98)", borderColor: "rgba(255,255,255,.12)", boxShadow: "0 38px 110px rgba(0,0,0,.55)" }, { at: 4, duration: 1.25, ease: EASE.material });
  timeline.to(world, { x: -1920, y: 0, scale: 1, duration: 1.25, ease: EASE.cameraRamp }, 4);
  timeline.to(hookFace, { autoAlpha: 0, duration: .36, ease: "power2.in" }, 4.02);
  timeline.to(productFace, { autoAlpha: 1, duration: .48, ease: "power2.out" }, 4.12);
  timeline.set(hookFace, { display: "none" }, 4.42);

  // Chrome, then navigation, then workspace, then headline, then the control.
  timeline.fromTo(sidebar, { x: -90, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .9, ease: EASE.arrive }, 4.2);
  timeline.fromTo(navItems, { x: -26, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .6, stagger: .09, ease: "power3.out" }, 4.38);
  timeline.fromTo(workspace, { y: 54, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: EASE.arrive }, 4.52);
  wordSlideRotate(timeline, productTitle, { at: 4.78, distance: 38, stagger: .07, rotation: 2, duration: .75, ease: "back.out(1.25)" });
  timeline.fromTo(promptShell, { y: 72, autoAlpha: 0, scale: .96 }, { y: 0, autoAlpha: 1, scale: 1, duration: 1.05, ease: "back.out(1.25)" }, 5.2);

  // Typing with a caret that only exists while the user types, and a camera
  // that pans with the advancing text instead of watching it from a distance.
  timeline.to(caret, { autoAlpha: 1, duration: .12 }, 6.1);
  typeText(promptCopy, "Draft the launch plan and surface the highest-impact next step", 6.2, 2.05);
  timeline.to(world, { x: -2050, y: -28, duration: 2.05, ease: "sine.inOut" }, 6.2);

  // Macro interaction shot: the camera frames the control and its result.
  timeline.to(world, { x: -3367, y: -595, scale: 1.42, duration: 1.05, ease: EASE.cameraRamp }, 8.35);
  timeline.fromTo(cursor, { x: 1340, y: 1040, autoAlpha: 0 }, { x: 1104, y: 700, autoAlpha: 1, duration: .85, ease: "power3.inOut" }, 8.5);
  timeline.to(cursor, { scale: .84, duration: .09, yoyo: true, repeat: 1, ease: "power2.inOut" }, 9.34);
  timeline.to(action, { scale: .89, duration: .1, yoyo: true, repeat: 1, ease: "back.out(1.45)" }, 9.36);
  timeline.to(caret, { autoAlpha: 0, duration: .12 }, 9.44);
  timeline.to(signal, { autoAlpha: .72, scaleX: .72, duration: .8, ease: "power3.out" }, 9.4);

  // --- scene-03 (10.0 - 15.5): the request becomes readable proof -----------
  timeline.set(proofFace, { display: "grid", autoAlpha: 0 }, 9.74);
  timeline.to([promptShell, productTitle], { y: -46, autoAlpha: 0, duration: .55, ease: "power3.in" }, 9.78);
  timeline.to(cursor, { y: 900, autoAlpha: 0, duration: .5, ease: "power2.in" }, 9.8);
  morph(timeline, carrier, { x: 4050, y: 130, width: 1500, height: 820, borderRadius: 32 }, { at: 10, duration: 1.2, ease: EASE.material });
  timeline.to(world, { x: -3840, y: 0, scale: 1, duration: 1.2, ease: EASE.cameraRamp }, 10);
  timeline.to(productFace, { autoAlpha: 0, duration: .36, ease: "power2.in" }, 9.94);
  timeline.to(proofFace, { autoAlpha: 1, duration: .46, ease: "power2.out" }, 10.04);
  timeline.set(productFace, { display: "none" }, 10.34);
  wordSlideRotate(timeline, response, { at: 10.25, distance: 46, stagger: .065, rotation: 1.5, duration: .8, ease: "back.out(1.3)" });
  timeline.fromTo(responseLines, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .13, ease: "power3.out" }, 10.95);
  perspectiveCardReveal(timeline, proofCard, { at: 11.4, duration: 1.05, rotateX: 12, rotateY: -10 });
  stepSurgeCounter(timeline, proofValue, { at: 11.8, start: 0, surgeTarget: 71, end: 94, suffix: "%", duration: 1.5 });
  timeline.to(world, { x: -3910, y: -20, scale: 1.05, duration: 2.4, ease: "sine.inOut" }, 12.2);
  // 13.6 - 15.2 is a readable hold: the frame settles and stays legible.

  // --- scene-04 (15.5 - 20.0): deconstruct in reverse hierarchy, resolve ----
  timeline.set(finalFace, { display: "flex", autoAlpha: 0 }, 15.24);
  timeline.to(responseLines, { y: -30, autoAlpha: 0, duration: .45, stagger: -.06, ease: "power3.in" }, 15.28);
  timeline.to([response, proofCard], { y: -36, autoAlpha: 0, duration: .5, ease: "power3.in" }, 15.34);
  morph(timeline, carrier, { x: 4450, y: 418, width: 700, height: 244, borderRadius: 122 }, { at: 15.5, duration: 1.25, ease: EASE.material });
  timeline.to(world, { x: -3840, y: 0, scale: 1, duration: 1.25, ease: EASE.cameraRamp }, 15.5);
  timeline.to(proofFace, { autoAlpha: 0, duration: .34, ease: "power2.in" }, 15.44);
  timeline.to(finalFace, { autoAlpha: 1, duration: .46, ease: "power2.out" }, 15.48);
  timeline.set(proofFace, { display: "none" }, 15.76);
  charSpringBounce(timeline, finalCopy, { at: 15.64, distance: 42, stagger: .035, duration: .65, ease: "back.out(1.4)" });
  timeline.to(signal, { scaleX: .16, autoAlpha: .8, duration: 1.1, ease: EASE.settle }, 16.2);
  timeline.to(carrier, { scale: 1.02, duration: 2.6, ease: "sine.inOut" }, 17.1);
  timeline.to({}, { duration: .2 }, 19.8);
}`;

export const foundationFiles = {
  compositionHtml: foundationHtml,
  timelineJs: foundationTimeline,
};

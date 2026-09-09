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
  const world = get("camera-world");
  const carrier = get("story-carrier");
  const hookFace = get("hook-face");
  const hookCopy = get("hook-copy");
  const chaosFace = get("chaos-face");
  const npCards = all(".np-card");
  const proofFace = get(
    "proof-face"
  );
  const bawAfterPanel = get("baw-after-panel");
  const bawDivider = get("baw-divider");
  const finalFace = get("final-face");
  const finalAction = get("final-action");
  const finalBtn = get("final-btn");
  const finalMicro = get("final-micro");

  // Initial State at Time 0
  timeline.set(stage, { autoAlpha: 1 }, 0);
  timeline.set(world, { x: 0, y: 0, scale: 1 }, 0);
  timeline.set(carrier, { x: 160, y: 120, width: 1600, height: 840, borderRadius: 32, background: "rgba(15,23,42,0.95)", borderColor: "rgba(255,255,255,0.12)" }, 0);
  timeline.set(hookFace, { display: "flex", autoAlpha: 1 }, 0);
  timeline.set(chaosFace, { display: "none", autoAlpha: 0 }, 0);
  timeline.set(proofFace, { display: "none", autoAlpha: 0 }, 0);
  timeline.set(finalFace, { display: "none", autoAlpha: 0 }, 0);

  // Scene 1: Hook (0.0 - 4.5)
  continuousTextGradient(hookCopy, "linear-gradient(90deg, #fff 0%, #38bdf8 55%, #a78bfa 100%)");
  giantKineticCrop(timeline, hookCopy, { at: 0.2, startScale: 2.0, endScale: 1, duration: 1.2, unit: "words", stagger: 0.06, settleEase: "back.out(1.35)" });

  // Scene 2: Chaos Pileup (4.5 - 9.5)
  timeline.set(chaosFace, { display: "flex", autoAlpha: 0 }, 4.3);
  morph(timeline, carrier, { x: 2160, y: 120, width: 1600, height: 840, borderRadius: 32 }, { at: 4.5, duration: 1.0, ease: "expo.inOut" });
  timeline.to(world, { x: -2000, y: 0, duration: 1.0, ease: "expo.inOut" }, 4.5);
  timeline.to(hookFace, { autoAlpha: 0, duration: 0.3 }, 4.5);
  timeline.to(chaosFace, { autoAlpha: 1, duration: 0.4 }, 4.6);
  
  timeline.fromTo(npCards, { y: 60, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.2, ease: "back.out(1.4)" }, 5.2);

  // Scene 3: Solution Wipe (9.5 - 14.0)
  timeline.set(proofFace, { display: "flex", autoAlpha: 0 }, 9.3);
  morph(timeline, carrier, { x: 4160, y: 120, width: 1600, height: 840, borderRadius: 32 }, { at: 9.5, duration: 1.0, ease: "expo.inOut" });
  timeline.to(world, { x: -4000, y: 0, duration: 1.0, ease: "expo.inOut" }, 9.5);
  timeline.to(chaosFace, { autoAlpha: 0, duration: 0.3 }, 9.5);
  timeline.to(proofFace, { autoAlpha: 1, duration: 0.4 }, 9.6);

  // Before-After Wipe animation
  timeline.fromTo(bawDivider, { left: "0%" }, { left: "100%", duration: 1.2, ease: "power2.inOut" }, 10.2);
  timeline.fromTo(bawAfterPanel, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 1.2, ease: "power2.inOut" }, 10.2);

  // Scene 4: Brand Resolution (14.0 - 18.0)
  timeline.set(finalFace, { display: "flex", autoAlpha: 0 }, 13.8);
  morph(timeline, carrier, { x: 4560, y: 320, width: 800, height: 440, borderRadius: 24 }, { at: 14.0, duration: 1.0, ease: "expo.inOut" });
  timeline.to(world, { x: -4400, y: 0, duration: 1.0, ease: "expo.inOut" }, 14.0);
  timeline.to(proofFace, { autoAlpha: 0, duration: 0.3 }, 14.0);
  timeline.to(finalFace, { autoAlpha: 1, duration: 0.4 }, 14.2);

  charSpringBounce(timeline, finalAction, { at: 14.5, distance: 30, stagger: 0.04, duration: 0.6, ease: "back.out(1.4)" });
  timeline.fromTo(finalBtn, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: "back.out(1.7)" }, 15.2);
  timeline.fromTo(finalMicro, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, 15.7);

  timeline.to(carrier, { scale: 1.02, duration: 2.0, ease: "sine.inOut", yoyo: true, repeat: 1 }, 16.0);
}
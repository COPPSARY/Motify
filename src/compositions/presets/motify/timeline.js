// Motify — launch film (dark). One caller-owned GSAP timeline, 49s.
// Layers: fixed ground and floods > camera (one smooth spline path) > accent layer > scenes.
// Captions, statements and the brand lock-up sit above the camera.

export function buildTimeline({ root, timeline: t, register }) {
  const doc = root.ownerDocument;
  const q = (id) => {
    const el = root.querySelector('[data-edit="' + id + '"]');
    if (!el) throw new Error("Missing element: " + id);
    return el;
  };
  const qa = (selector, scope) => Array.from((scope || root).querySelectorAll(selector));
  const IN = { immediateRender: false };
  // 2D matrices only: 3D-promoted layers get scaled as bitmaps and look soft.
  t.vars.defaults = Object.assign({}, t.vars.defaults, { force3D: false });
  const END = 40;
  const SHIFT = -1.1;

  // ---------- build-time DOM ----------
  // Editing-timeline tracks for the opening (seeded, so every build is identical).
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const palette = ["#8ab4ff", "#7cf7c5", "#b69cff", "#f5b76a", "#f08aa8", "#8ecbe8"];
  const tracksEl = q("edit-tracks");
  const rowsAbove = [], rowsBelow = [];
  [[rowsAbove, [412, 376, 340, 304, 268, 232, 196, 160]], [rowsBelow, Array.from({length:42}, (_, i) => 640 + i * 52)]].forEach(([list, ys]) => {
    ys.forEach((y) => {
      const row = doc.createElement("div");
      row.className = "trk";
      row.style.top = y + "px";
      let x = 80 + rnd() * 260;
      while (x < 2400) {
        const w = 140 + rnd() * 420;
        const clip = doc.createElement("span");
        clip.className = "clip";
        clip.style.cssText = "left:" + x + "px;width:" + w + "px;--c:" + palette[Math.floor(rnd() * palette.length)];
        row.appendChild(clip);
        const kfs = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < kfs; k++) {
          const kf = doc.createElement("span");
          kf.className = "kf";
          kf.style.left = x + 12 + rnd() * (w - 30) + "px";
          row.appendChild(kf);
        }
        x += w + 30 + rnd() * 160;
      }
      tracksEl.insertBefore(row, tracksEl.firstChild);
      list.push(row);
    });
  });

  root.querySelectorAll("[data-edit]").forEach((element) => register(element.dataset.edit, element));

  // ---------- text building blocks ----------
  function split(el) {
    const words = [];
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === 3) {
        const frag = doc.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(doc.createTextNode(part));
          else {
            const span = doc.createElement("span");
            span.className = "w";
            span.textContent = part;
            frag.appendChild(span);
            words.push(span);
          }
        });
        el.replaceChild(frag, node);
      } else if (node.nodeType === 1 && node.tagName !== "BR") {
        node.classList.add("w");
        words.push(node);
      }
    });
    return words;
  }
  function mask(els) {
    els.forEach((el) => {
      const m = doc.createElement("span");
      m.className = "mw";
      el.parentNode.insertBefore(m, el);
      m.appendChild(el);
    });
    return els;
  }
  function letters(words) {
    const out = [];
    words.forEach((w) => {
      if (w.classList.contains("grad") || w.children.length) { out.push(w); return; }
      const text = w.textContent;
      w.textContent = "";
      Array.from(text).forEach((ch) => {
        const s = doc.createElement("span");
        s.className = "w";
        s.textContent = ch;
        w.appendChild(s);
        out.push(s);
      });
    });
    return out;
  }

  const E_OUT = "power3.out", E_IO = "power2.inOut", E_IN = "power2.in";
  const rise = (els, at, o = {}) =>
    t.fromTo(els, { yPercent: 115, autoAlpha: 1 }, { yPercent: 0, autoAlpha: 1, duration: o.dur ?? 0.8, stagger: o.st ?? 0.05, ease: E_OUT, ...IN }, at);
  const sink = (els, at, o = {}) =>
    t.fromTo(els, { yPercent: 0 }, { yPercent: -115, duration: o.dur ?? 0.4, stagger: o.st ?? 0.02, ease: E_IN, ...IN }, at);
  // Soft focus: ghosted and out of focus, resolving while it settles.
  function focus(els, at, o = {}) {
    const d = o.dur ?? 0.8, st = o.st ?? 0.06;
    const list = [].concat(els);
    t.fromTo(list, { autoAlpha: 0, x: o.x ?? 0, y: o.y ?? 10, scale: o.scale ?? 1, filter: "blur(" + (o.blur ?? 12) + "px)" },
      { autoAlpha: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)", duration: d, stagger: st, ease: E_OUT, ...IN }, at);
    t.set(list, { filter: "none" }, at + (list.length - 1) * st + d + 0.02);
    return at + (list.length - 1) * st + d;
  }
  function defocus(els, at, o = {}) {
    const list = [].concat(els), st = o.st ?? 0.025, d = o.dur ?? 0.45;
    t.fromTo(list, { autoAlpha: 1, y: 0, filter: "blur(0px)" }, { autoAlpha: 0, y: o.y ?? -8, filter: "blur(12px)", duration: d, stagger: st, ease: E_IN, ...IN }, at);
    t.set(list, { filter: "none" }, at + (list.length - 1) * st + d + 0.02);
  }
  // Typing without callbacks: a stepped reveal mask, exact under scrubbing.
  function typeMask(el, at, dur) {
    const n = Math.max(1, el.textContent.length);
    t.set(el, { clipPath: "inset(-30% 100% -30% 0%)" }, 0);
    t.fromTo(el, { clipPath: "inset(-30% 100% -30% 0%)" }, { clipPath: "inset(-30% 0% -30% 0%)", duration: dur, ease: "steps(" + n + ")", ...IN }, at);
  }
  function count(el, from, to, at, dur, fmt, ease = "power2.out") {
    const p = { v: from };
    el.textContent = fmt(from);
    t.fromTo(p, { v: from }, { v: to, duration: dur, ease, ...IN, onUpdate() { el.textContent = fmt(p.v); } }, at);
  }
  // Grow and complete: the lead resolves centred, then the tail arrives and the line re-centres.
  function pullComplete(id, at, o = {}) {
    const line = q(id), lead = line.querySelector(".lead"), tailw = line.querySelector(".tailw"), tail = line.querySelector(".tail");
    t.set(line, { xPercent: -50, yPercent: -50, autoAlpha: 0 }, 0);
    const leadW = split(lead), tailW = split(tail);
    t.set([...leadW, ...tailW], { autoAlpha: 0 }, 0);
    t.set(line, { autoAlpha: 1 }, at);
    focus(leadW, at, { st: 0.07 });
    const comp = at + (o.gap ?? 0.45) + (leadW.length - 1) * 0.07;
    t.fromTo(tailw, { maxWidth: 0 }, { maxWidth: 1600, duration: 1.3, ease: E_IO, ...IN }, comp);
    focus(tailW, comp + 0.1, { st: 0.09, x: 16 });
    return { line, lead, tail, leadW, tailW };
  }

  // ---------- camera ----------
  // The base camera runs along one Catmull-Rom path through the whole film, so it never
  // stops dead between moves. Modifiers compute the pose during render (no callbacks).
  const cam = q("camera"), hand = q("camera-handheld");
  const path = [
    [0, 0, 0, 1.0], [4.2, 0, 0, 1.06], [6.6, 0, 26, 1.1], [8.6, 0, 0, 1.03], [12.4, -24, -16, 1.04],
    [17.0, -16, 0, 1.0], [22.0, 0, 0, 1.02], [25.6, 0, 0, 1.0], [30.9, 0, -6, 1.03], [34.0, 0, 0, 1.0], [40, 0, -10, 1.03],
  ];
  function sample(time, k) {
    let i = 0;
    while (i < path.length - 2 && time > path[i + 1][0]) i++;
    const p0 = path[Math.max(0, i - 1)], p1 = path[i], p2 = path[i + 1], p3 = path[Math.min(path.length - 1, i + 2)];
    const u = Math.min(1, Math.max(0, (time - p1[0]) / (p2[0] - p1[0])));
    const m1 = (p2[k] - p0[k]) / 2, m2 = (p3[k] - p1[k]) / 2;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1[k] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[k] + (u3 - u2) * m2;
  }
  t.fromTo(cam, { x: 0, y: 0, scaleX: 0, scaleY: 0 }, {
    x: END, y: END, scaleX: END, scaleY: END, duration: END, ease: "none", ...IN,
    modifiers: {
      x: (v) => sample(parseFloat(v), 1) + "px", y: (v) => sample(parseFloat(v), 2) + "px",
      scaleX: (v) => sample(parseFloat(v), 3), scaleY: (v) => sample(parseFloat(v), 3),
    },
  }, 0);
  // accent layer: deliberate pushes and follows that start and return to rest
  const rest = { x: 0, y: 0, scale: 1 };
  t.set(hand, rest, 0);
  function accent(at, dur, from, to, ease = E_IO) {
    t.fromTo(hand, { ...from }, { ...to, duration: dur, ease, ...IN }, at);
  }

  // living light
  const horizon = q("horizon"), lightV = q("light-violet"), lightM = q("light-mint");
  t.fromTo(lightV, { x: -80, y: -40 }, { x: 260, y: 120, duration: 10, yoyo: true, repeat: 3, ease: "sine.inOut", ...IN }, 0);
  t.fromTo(lightM, { x: 120, y: 60 }, { x: -220, y: -80, duration: 13, yoyo: true, repeat: 2, ease: "sine.inOut", ...IN }, 0);
  t.fromTo(horizon, { y: 120, autoAlpha: 0.4 }, { y: 0, autoAlpha: 1, duration: END, ease: "sine.inOut", ...IN }, 0);
  const a1 = qa("[data-a1]"), a2 = qa("[data-a2]"), grids = qa("[data-gridf]");
  t.fromTo(a1, { x: -120, y: -40 }, { x: 160, y: 60, duration: 6, yoyo: true, repeat: 5, ease: "sine.inOut", ...IN }, 0);
  t.fromTo(a2, { x: 100, y: 40 }, { x: -150, y: -50, duration: 8, yoyo: true, repeat: 4, ease: "sine.inOut", ...IN }, 0);
  t.fromTo(grids, { backgroundPosition: "0px 0px" }, { backgroundPosition: "0px 960px", duration: END, ease: "none", ...IN }, 0);
  const floodMint = q("flood-mint");
  t.set([floodMint, q("flood-violet")], { autoAlpha: 0, x: 0, y: 0, scale: 0.05 }, 0);

  // things from earlier cuts that stay out of this film
  t.set([...qa("[data-prop]"), q("cap-control"), q("selection-box"), q("cursor"), q("promise-line-2"), q("prompt-caret"), q("cap-idea"), q("cap-describe"), q("cap-look"), q("cap-style")], { autoAlpha: 0 }, 0);
  t.set(q("restyle-sweep"), { xPercent: -140 }, 0);

  // Panel framing: its centre on screen and its scale (always flat, so it stays crisp).
  const P = (cx, cy, p) => ({ cx, cy, p });
  const panelState = (s) => ({ x: s.cx - 960, y: s.cy - 540, scale: s.p });
  const artToScreen = (ax, ay, s) => ({ x: s.cx + (80 + (ax * 4) / 3 - 720) * s.p, y: s.cy + (68 + (ay * 4) / 3 - 474) * s.p });

  // ================= 1 · Hook (0 – 4.2) =================
  const hookA = pullComplete("hook-line-1", 0.2, { gap: 0.4 });
  t.fromTo(hookA.line, { x: 0, filter: "blur(0px)" }, { x: -120, autoAlpha: 0, filter: "blur(14px)", duration: 0.5, ease: E_IN, ...IN }, 2.2);
  t.set(hookA.line, { filter: "none" }, 2.75);

  const hook2 = q("hook-line-2");
  t.set(hook2, { xPercent: -50, yPercent: -50 }, 0);
  const hook2W = mask(split(hook2));
  const hookLead = hook2W.slice(0, -1), hookVideo = hook2W[hook2W.length - 1];
  t.set(hookLead, { yPercent: -115 }, 0);
  t.set(hookVideo, { autoAlpha: 0 }, 0);
  t.set(hookVideo.parentNode, { overflow: "visible" }, 0);
  t.fromTo(hookLead, { yPercent: -115 }, { yPercent: 0, duration: 0.7, stagger: 0.06, ease: E_OUT, ...IN }, 2.45);
  focus(hookVideo, 2.85, { scale: 1.04, x: 18 });

  // the editing timeline grows outward around the line
  const rulers = [q("ruler-top"), q("ruler-bottom")], tracksPlayhead = q("tracks-playhead");
  t.set([...rowsAbove, ...rowsBelow, ...rulers, tracksPlayhead], { autoAlpha: 0 }, 0);
  t.fromTo(rulers, { autoAlpha: 0, scaleX: 0 }, { autoAlpha: 1, scaleX: 1, duration: 0.8, ease: E_OUT, ...IN }, 2.8);
  [rowsAbove, rowsBelow].forEach((rows, side) => {
    rows.forEach((row, i) => {
      const at = 2.9 + i * 0.05;
      t.fromTo(row, { autoAlpha: 0, y: side ? -30 : 30 }, { autoAlpha: Math.max(0.4, 1 - i * 0.07), y: 0, duration: 0.6, ease: E_OUT, ...IN }, at);
      t.fromTo(qa(".clip", row), { scaleX: 0 }, { scaleX: 1, duration: 0.55, stagger: 0.02, ease: E_OUT, ...IN }, at + 0.04);
      t.fromTo(qa(".kf", row), { scale: 0, rotation: 45 }, { scale: 1, rotation: 45, duration: 0.3, stagger: 0.015, ease: E_OUT, ...IN }, at + 0.25);
    });
  });
  t.fromTo(tracksPlayhead, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ...IN }, 3.1);
  t.fromTo(tracksPlayhead, { x: 0 }, { x: 700, duration: 1.1, ease: "none", ...IN }, 3.1);
  t.to(tracksPlayhead, { autoAlpha: 0, duration: 0.3 }, 4.1);
  t.fromTo(tracksEl, { x: 0 }, { x: -320, duration: 1.75, ease: "sine.inOut", ...IN }, 2.8);

  // ================= 2 · Problem (4.2 – 8.6) =================
  t.fromTo(hookLead, { yPercent: 0 }, { yPercent: 115, duration: 0.35, stagger: 0.02, ease: E_IN, ...IN }, 4.0);
  t.fromTo(hookVideo, { scale: 1, autoAlpha: 1 }, { scale: 0.7, autoAlpha: 0, duration: 0.3, ease: E_IN, ...IN }, 4.05);
  t.fromTo(tracksEl, { autoAlpha: 1 }, { autoAlpha: 0.3, duration: 0.5, ease: "power2.out", ...IN }, 4.1);

  const tasks = qa("[data-task]");
  const ROW = 290;
  const scrollAt = 4.55, scrollDuration = 1.8, lastTask = tasks.length - 1;
  const problemWorld = q("problem-world");
  t.set(problemWorld, { y: 0 }, 0);
  accent(3.9, 0.85, rest, { x: 0, y: 0, scale: 1.22 });
  accent(6.9, 0.7, { x: 0, y: 0, scale: 1.22 }, rest);
  t.set(tasks, { xPercent: -50, yPercent: -50, autoAlpha: 0 }, 0);
  // One acceleration, one uninterrupted descent, one settle on Export.
  t.fromTo(problemWorld, { y: 0 }, { y: -lastTask * ROW, duration: scrollDuration, ease: "sine.inOut", ...IN }, scrollAt);
  tasks.forEach((task, k) => {
    t.set(task, { y: k * ROW }, 0);
    t.fromTo(task, { autoAlpha: 0 }, { autoAlpha: k ? 0.24 : 1, duration: 0.25, ease: E_OUT, ...IN }, 4.3);
    // Focus follows the same eased camera position, rather than stepping by row.
    t.fromTo(task, { opacity: 0 }, { opacity: 1, duration: scrollDuration, ease: "sine.inOut", ...IN,
      modifiers: { opacity: v => Math.max(0.24, 1 - Math.abs(k - Number(v) * lastTask) * 0.76) },
    }, scrollAt);
  });
  t.set(q("render-bar"), { scaleX: 0 }, 0);
  t.fromTo(q("render-bar"), { scaleX: 0 }, { scaleX: 0.14, duration: 0.5, ease: "power1.out", ...IN }, 6.3);
  count(q("render-pct"), 0, 14, 6.3, 0.5, (v) => Math.round(v) + "%");

  tasks.slice().reverse().forEach((task, i) => {
    const k = tasks.length - 1 - i;
    t.fromTo(task, { autoAlpha: k === tasks.length - 1 ? 1 : 0.24 }, { autoAlpha: 0, duration: 0.35, ease: E_IN, ...IN }, 6.95 + i * 0.02);
  });
  // Hold the final position, then clear the scene without another scroll.
  t.fromTo(problemWorld, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.6, ease: E_IO, ...IN }, 6.9);

  // the claim builds, then "video team." is struck out
  const problemLine = q("problem-line"), problemW = mask(split(problemLine));
  const pLine1 = problemW.slice(0, 5), pLine2 = problemW.slice(5);
  const strike = q("problem-strike");
  t.set(problemLine, { xPercent: -50, yPercent: -50 }, 0);
  t.set(pLine1, { yPercent: 115 }, 0);
  t.set(pLine2, { xPercent: -110 }, 0);
  t.set(strike, { scaleX: 0 }, 0);
  rise(pLine1, 7.05, { st: 0.05 });
  t.fromTo(pLine2, { xPercent: -110 }, { xPercent: 0, duration: 0.8, stagger: 0.07, ease: E_OUT, ...IN }, 7.35);
  t.fromTo(strike, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: E_IO, ...IN }, 7.95);

  // ================= 3 · Meet Motionly (8.6 – 12.4) =================
  sink(pLine1, 8.45, { st: 0.015, dur: 0.35 });
  sink(pLine2, 8.5, { st: 0.015, dur: 0.35 });

  const meetLine = q("meet-line"), mark = q("brand-mark"), shine = q("brand-mark-shine");
  t.set(mark, { x: 960, y: 540, scale: 0, autoAlpha: 0 }, 0);
  t.fromTo(mark, { autoAlpha: 0, scale: 0.6, filter: "blur(12px)" }, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.8, ease: E_OUT, ...IN }, 8.75);
  t.set(mark, { filter: "none" }, 9.6);
  t.set(shine, { xPercent: -160 }, 0);
  t.fromTo(shine, { xPercent: -160 }, { xPercent: 330, duration: 0.8, ease: E_IO, ...IN }, 9.15);

  const meetWidth = 545, gap = 36, markSmall = 0.62, markHalf = 90 * markSmall;
  const lockLeft = 960 - (markHalf * 2 + gap + meetWidth) / 2;
  const markLockX = lockLeft + markHalf;
  t.set(meetLine, { x: lockLeft + markHalf * 2 + gap, y: 540, yPercent: -50 }, 0);
  const meetL = letters(split(meetLine));
  t.set(meetL, { autoAlpha: 0 }, 0);
  t.fromTo(mark, { x: 960, scale: 1 }, { x: markLockX, scale: markSmall, duration: 0.7, ease: E_IO, ...IN }, 9.4);
  const mid = (meetL.length - 1) / 2;
  meetL.forEach((ch, i) => {
    t.fromTo(ch, { x: (i - mid) * 12, autoAlpha: 0, filter: "blur(10px)" }, { x: 0, autoAlpha: 1, filter: "blur(0px)", duration: 0.8, ease: E_OUT, ...IN }, 9.55 + Math.abs(i - mid) * 0.03);
  });
  t.set(meetL, { filter: "none" }, 10.6);

  // The complete lockup lifts away. The composer enters as its own surface.
  t.fromTo(meetL, { yPercent: 0, autoAlpha: 1, filter: "blur(0px)" }, { yPercent: -40, autoAlpha: 0, filter: "blur(8px)", duration: 0.4, stagger: 0.012, ease: E_IN, ...IN }, 10.4);
  t.set(meetL, { filter: "none" }, 11.2);
  const composer = q("prompt-composer"), send = q("prompt-send");
  const promptText = q("prompt-text"), placeholder = q("prompt-placeholder");
  const cursor = q("cursor");
  t.set([composer, send], { autoAlpha: 0 }, 0);
  // The composer rises into the room the lockup leaves, so the frame is never empty.
  t.fromTo(composer, { autoAlpha: 0, y: 140, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: E_OUT, ...IN }, 10.5);
  t.fromTo(mark, { x: markLockX, y: 540, scale: markSmall, autoAlpha: 1 }, { x: markLockX, y: 445, scale: markSmall, autoAlpha: 0, duration: 0.5, ease: E_IO, ...IN }, 10.4);
  t.set(send, { autoAlpha: 1 }, 10.5);

  // ================= 3b · The prompt (11.1 – 14.3) =================
  // the camera leans in on the sentence, follows the caret as it types, then pushes onto send
  t.set(placeholder, { autoAlpha: 0 }, 11.35);
  typeMask(promptText, 11.5, 1.5);
  const onPoint = (px, py, sc) => ({ x: -(px - 960) * sc, y: -(py - 540) * sc, scale: sc });
  const typeA = onPoint(640, 560, 1.7), typeB = onPoint(1240, 560, 1.7), atSend = onPoint(1459, 650, 2.6);
  accent(11.1, 0.75, rest, typeA);
  accent(11.85, 1.25, typeA, typeB, "sine.inOut");
  accent(13.05, 0.75, typeB, atSend);
  // The pointer slides in from off-frame left along a near-straight line and lands on send.
  // Its tilt follows its own velocity: it leans while travelling and straightens as it slows.
  const route = { x: [640, 980, 1300, 1458], y: [690, 684, 668, 655] };
  const cubic = (u, p) => { const m = 1 - u; return m * m * m * p[0] + 3 * m * m * u * p[1] + 3 * m * u * u * p[2] + u * u * u * p[3]; };
  const cubicD = (u, p) => { const m = 1 - u; return 3 * m * m * (p[1] - p[0]) + 6 * m * u * (p[2] - p[1]) + 3 * u * u * (p[3] - p[2]); };
  const easeIO = (s) => (s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s));
  const easeIOD = (s) => (s < 0.5 ? 4 * s : 4 * (1 - s));
  const lean = (s) => {
    const u = easeIO(s), vx = cubicD(u, route.x) * easeIOD(s), vy = cubicD(u, route.y) * easeIOD(s);
    return Math.max(-32, Math.min(32, vx / 2400 * 30 - vy / 2400 * 14));
  };
  t.set(cursor, { x: route.x[0], y: route.y[0], rotation: 0 }, 0);
  t.set(cursor, { autoAlpha: 1 }, 13.25);
  t.fromTo(cursor, { x: 0, y: 0, rotation: 0 }, { x: 1, y: 1, rotation: 1, duration: 0.75, ease: "none", ...IN, modifiers: {
    x: (v) => cubic(easeIO(parseFloat(v)), route.x) + "px",
    y: (v) => cubic(easeIO(parseFloat(v)), route.y) + "px",
    rotation: (v) => lean(parseFloat(v)) + "deg",
  } }, 13.25);
  t.fromTo(cursor, { scale: 1 }, { scale: 0.82, duration: 0.1, yoyo: true, repeat: 1, ...IN }, 14.0);
  t.fromTo(send, { scale: 1 }, { scale: 0.86, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out", ...IN }, 14.02);
  t.fromTo(cursor, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.15, ...IN }, 14.15);
  accent(14.25, 0.8, atSend, rest);
  t.fromTo(composer, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 0.96, duration: 0.3, ease: E_IN, ...IN }, 14.15);



  // Sections 7 (showcase) and 8 (brand close) are authored in final seconds at the end of this file.

  // ================= make room for the camera scroll =================
  // Everything from the formats beat on moves later; the ending was tightened to absorb it.
  t.getChildren(false, true, true).forEach((child) => {
    if (child.startTime() >= 25.5) child.startTime(child.startTime() + SHIFT);
  });


  // Reading time is budgeted by beat. Remap both ends of every tween so seeks,
  // repeated accents, playback and export all use exactly the same final clock.
  const clock = [[0, 0], [4.2, 4.2], [6.9, 8.5], [14.6, 16.2],
    [17, 20.6], [21.2, 26.2], [25.5, 34.5], [40, 49]];
  function filmTime(at) {
    let i = 0;
    while (i < clock.length - 2 && at > clock[i + 1][0]) i++;
    const [a, b] = [clock[i], clock[i + 1]];
    return a[1] + (at - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
  }
  t.getChildren(false, true, true).forEach((child) => {
    const start = child.startTime(), duration = child.totalDuration();
    if (duration) child.totalDuration(filmTime(start + duration) - filmTime(start));
    child.startTime(filmTime(start));
  });


  // Revised middle, authored directly in final playback seconds:
  // a brief becomes a storyboard and moving film; ask for a revision; adjust it yourself.
  // Scroll language shared with the task list: one world, one continuous descent, focus follows the camera.
  // From the pipeline claim to the question the camera makes one fast, smooth glide.
  const FLOW = [0, 860, 1720, 2580]; // claim, brief, direction, animation
  const FLOW_AT = 17.6, FLOW_DUR = 3.0;
  // one sine-shaped glide: passes brief 18.8, direction 19.4, and settles on the animation card at 20.6
  function flowPos(u) {
    u = Math.min(1, Math.max(0, u));
    const s = (1 - Math.cos(Math.PI * u)) / 2;
    const n = FLOW.length - 1, w = s * n;
    const i = Math.min(n - 1, Math.floor(w));
    return FLOW[i] + (FLOW[i + 1] - FLOW[i]) * (w - i);
  }
  const flowTween = (el, prop, fn) =>
    t.fromTo(el, { [prop]: 0 }, { [prop]: 1, duration: FLOW_DUR, ease: "none", ...IN, modifiers: { [prop]: (v) => fn(flowPos(parseFloat(v))) } }, FLOW_AT);
  const nearness = (target, spacing, pos) => Math.min(1, Math.abs(target - pos) / spacing);

  const pipe = q("pipeline"), productionStage = q("pipeline-stage");
  const heading = q("pipeline-heading"), brief = q("production-brief");
  const board = q("production-board"), motion = q("production-motion");
  const ready = q("production-ready");
  t.set([pipe, heading, ready, q("prompt-fly")], { autoAlpha: 0 }, 0);
  t.set(productionStage, { x: 0, y: 0, scale: 1 }, 0);
  t.set(q("board-two"), { x: 0, y: 0, rotation: 3 }, 0);
  t.set(pipe.querySelector(".production-routes"), { autoAlpha: 0 }, 0);
  // The pipeline lives outside the camera: the send push is still easing back as this beat opens.
  q("stage").insertBefore(pipe, q("cap-idea"));

  // The claim, then the brief, direction and animation stacked below it in one column.
  productionStage.appendChild(heading);
  const spine = doc.createElement("div");
  spine.className = "pipe-spine";
  productionStage.insertBefore(spine, productionStage.firstChild);
  register("pipeline-spine", spine);
  const headLine = heading.querySelector("h2");
  const headWords = mask(split(headLine));
  t.set(heading, { yPercent: -50, y: 0 }, 0);
  t.set(headWords, { yPercent: 115 }, 0);
  t.set(brief, { rotation: -1.5, scale: 1.2 }, 0);
  t.set([board, motion], { scale: 1.2 }, 0);
  t.set(spine, { scaleY: 0 }, 0);
  // the prompt has fully cleared before the claim arrives
  t.set(pipe, { autoAlpha: 1, y: 0 }, 16.2);
  t.set(heading, { autoAlpha: 1 }, 16.2);
  t.fromTo(headWords, { yPercent: 115 }, { yPercent: 0, duration: 0.7, stagger: 0.07, ease: E_OUT, ...IN }, 16.35);

  flowTween(productionStage, "y", (pos) => -pos + "px");
  flowTween(heading, "opacity", (pos) => 1 - nearness(0, 860, pos) * 0.82);
  flowTween(spine, "scaleY", (pos) => Math.min(1, pos / FLOW[3] + 0.08));
  // Surfaces stay opaque (the spine passes behind them) and dim with an inner shade;
  // the loose labels around them dim with opacity.
  const shaded = [[brief, 1], [q("board-one"), 2], [q("board-two"), 2], [motion.querySelector(".production-screen"), 3]];
  shaded.forEach(([surface, stop]) => {
    const shade = doc.createElement("i");
    shade.className = "pipe-shade";
    surface.appendChild(shade);
    t.set(shade, { opacity: 0.8 }, 0);
    flowTween(shade, "opacity", (pos) => nearness(FLOW[stop], 860, pos) * 0.8);
  });
  [[board, 2], [motion, 3]].forEach(([card, stop]) => {
    const loose = qa(":scope > .production-label, :scope > .board-notes, :scope > .production-keys", card);
    t.set(loose, { opacity: 0.2 }, 0);
    loose.forEach((el) => flowTween(el, "opacity", (pos) => 1 - nearness(FLOW[stop], 860, pos) * 0.8));
  });

  // 03: the storyboard comes alive as the camera passes. The hook rolls into the reveal,
  // the chart from frame 02 draws across the screen, and each keyframe fires as the playhead crosses it.
  const psOld = q("ps-old"), psNew = q("ps-new"), psCurve = q("ps-curve"), psArea = q("ps-area");
  const keyTrack = motion.querySelector(".production-keys"), keys = qa("[data-key]", keyTrack);
  const KEY_AT = 20.55, KEY_DUR = 1.3, KEY_SPAN = 926;
  t.set(psOld, { yPercent: 0 }, 0);
  t.set(psNew, { yPercent: 110 }, 0);
  t.set(psCurve, { attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 } }, 0);
  t.set(psArea, { autoAlpha: 0 }, 0);
  t.set(keys, { rotation: 45, scale: 1, backgroundColor: "rgba(42,52,50,1)", borderColor: "rgba(124,247,197,0.4)" }, 0);
  t.fromTo(psCurve, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 1.0, ease: "power2.inOut", ...IN }, 20.45);
  t.fromTo(psArea, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "power2.out", ...IN }, 21.25);
  t.fromTo(psOld, { yPercent: 0 }, { yPercent: -110, duration: 0.45, ease: E_IO, ...IN }, 20.8);
  t.fromTo(psNew, { yPercent: 110 }, { yPercent: 0, duration: 0.45, ease: E_IO, ...IN }, 20.8);
  t.fromTo(q("production-playhead"), { x: 0 }, { x: KEY_SPAN, duration: KEY_DUR, ease: "none", ...IN }, KEY_AT);
  keys.forEach((key) => {
    const at = KEY_AT + (parseFloat(key.style.left) / 100) * KEY_DUR;
    t.fromTo(key, { scale: 1, backgroundColor: "rgba(42,52,50,1)", borderColor: "rgba(124,247,197,0.4)" },
      { scale: 1.45, backgroundColor: "rgba(124,247,197,1)", borderColor: "rgba(124,247,197,1)", duration: 0.12, ease: "power2.out", ...IN }, at);
    t.fromTo(key, { scale: 1.45 }, { scale: 1, duration: 0.3, ease: "back.out(2)", ...IN }, at + 0.12);
  });
  t.fromTo(ready, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: E_OUT, ...IN }, 21.5);

  // The same descent carries on below it to the question.
  const capDont = q("cap-dontlike"), capAsk = q("cap-ask");
  const askBox = q("ask-bar"), askText = q("ask-text"), askSend = q("ask-send");
  const askViewport = doc.createElement("div");
  askViewport.className = "scroll-viewport";
  const askCamera = doc.createElement("div");
  askCamera.style.cssText = "position:absolute;inset:0;transform-origin:50% 50%";
  const askWorld = doc.createElement("div");
  askWorld.style.cssText = "position:absolute;inset:0";
  capDont.parentNode.insertBefore(askViewport, capDont);
  askViewport.appendChild(askCamera);
  askCamera.appendChild(askWorld);
  const askCursor = q("ask-cursor");
  [q("ask-space"), capDont, capAsk, askBox, askCursor].forEach(el => askWorld.appendChild(el));
  register("ask-world", askWorld);
  register("ask-camera", askCamera);
  t.set([askViewport, askBox, capDont, capAsk, askCursor, q("scroll-grid"), q("ask-placeholder")], { autoAlpha: 0 }, 0);
  t.set(askWorld, { y: -1000 }, 0);
  t.set(askCamera, { scale: 1 }, 0);
  // The composer and "Just ask" wait in the frame the question settles in (world offset 1000).
  const DONT = { x: 0, y: 1334, scale: 1, color: "#f4f1ea" };
  t.set(capDont, { ...DONT, zIndex: 4 }, 0);
  t.set(capAsk, { y: 1174 }, 0);
  t.set(askBox, { y: 985, scale: 1 }, 0);
  t.set(askCursor, { x: 1720, y: 1880, scale: 1 }, 0);
  // askWorld's origin sits exactly one stop below the animation card
  // Hold on the animation while it plays, then zoom out: the whole pipeline falls away into depth
  // and the question arrives from in front of the lens, settling to size.
  const OUT = 20.9, OUT_END = 22.7;
  t.set(pipe, { scale: 1, transformOrigin: "50% 50%" }, 0);
  t.fromTo(pipe, { scale: 1 }, { scale: 0.3, duration: OUT_END - OUT, ease: "power3.in", ...IN }, OUT);
  t.fromTo(pipe, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.4, ease: "power1.in", ...IN }, OUT_END - 0.75);
  t.set([askViewport, capDont], { autoAlpha: 1 }, OUT_END - 0.4);
  t.fromTo(capDont, { scale: 2.4 }, { scale: 1, duration: 0.95, ease: "power3.out", ...IN }, OUT_END - 0.4);
  t.fromTo(capDont, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out", ...IN }, OUT_END - 0.4);

  // Not another scroll: the question itself becomes the prompt. It shrinks into the composer's
  // text line while the composer opens around it, and "Just ask" rises above.
  const ASK = 23.65;
  t.fromTo(capDont, { ...DONT }, { x: -368, y: 1334 + 52, scale: 0.308, color: "#7c8292", duration: 0.75, ease: "power3.inOut", ...IN }, ASK);
  t.fromTo(askBox, { autoAlpha: 0, scale: 0.55 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: "power3.inOut", ...IN }, ASK + 0.08);
  const askWords = mask(split(capAsk));
  t.set(askWords, { yPercent: 115 }, 0);
  t.set(capAsk, { autoAlpha: 1 }, ASK + 0.3);
  t.fromTo(askWords, { yPercent: 115 }, { yPercent: 0, duration: 0.65, stagger: 0.09, ease: E_OUT, ...IN }, ASK + 0.35);

  // typing replaces the borrowed question
  t.fromTo(capDont, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.15, ...IN }, 24.65);
  typeMask(askText, 24.7, 1.9);
  t.fromTo(askCamera, { scale: 1 }, { scale: 1.1, duration: 2.6, ease: "sine.inOut", ...IN }, 24.5);

  // The pointer sends the request.
  t.fromTo(askCursor, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15, ...IN }, 26.85);
  t.fromTo(askCursor, { x: 1720, y: 1880 }, { x: 1462, y: 1644, duration: 0.45, ease: E_IO, ...IN }, 26.85);
  t.fromTo(askCursor, { scale: 1 }, { scale: 0.82, duration: 0.1, yoyo: true, repeat: 1, ...IN }, 27.35);
  t.fromTo(askSend, { scale: 1 }, { scale: 0.86, duration: 0.12, yoyo: true, repeat: 1, ease: E_IO, ...IN }, 27.37);
  t.fromTo(askCursor, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2, ...IN }, 27.55);

  // ================= Move to the editor =================
  // The camera travels down from the prompt to the editor UI, and the requested change lands on the button.
  const panel = q("motionly-panel"), artCam = q("art-camera"), artHeadline = q("art-headline");
  const editDetail = q("edit-detail"), tweakCaption = q("cap-tweak"), selection = q("selection-box");
  const editCursor = q("edit-cursor"), artCta = q("art-cta");
  const REVEAL = 27.6, REVEAL_DUR = 0.95;
  // Poses: the showcase is centred and tilted in perspective; editing happens flat.
  const flat = { rotationX: 0, rotationY: 0 };
  const showPose = { ...panelState(P(960, 640, 0.7)), rotationX: 14, rotationY: -12 };
  const showSettled = { ...showPose, rotationX: 9, rotationY: -5 };
  const editPose = { ...panelState(P(755, 650, 0.78)), ...flat };
  t.set([panel, editDetail, tweakCaption, editCursor], { autoAlpha: 0 }, 0);
  t.set(panel, { transformPerspective: 1800, ...flat }, 0);
  // One camera move down: the prompt rises out of frame and the claim rises into the centre, alone.
  const MOVE_Y = 1300, CAPTION_CENTRE = 380;
  t.fromTo(askWorld, { y: -1000 }, { y: -1000 - MOVE_Y, duration: REVEAL_DUR, ease: "power3.inOut", ...IN }, REVEAL);
  // the dotted ground behind the prompt dissolves over the move instead of switching off in one frame
  t.fromTo(q("ask-space"), { autoAlpha: 1 }, { autoAlpha: 0, duration: REVEAL_DUR, ease: "power1.inOut", ...IN }, REVEAL);
  t.set(askViewport, { autoAlpha: 0 }, REVEAL + REVEAL_DUR);
  t.set(tweakCaption, { scale: 1 }, 0);
  t.fromTo(tweakCaption, { autoAlpha: 1, y: CAPTION_CENTRE + MOVE_Y }, { autoAlpha: 1, y: CAPTION_CENTRE, duration: REVEAL_DUR, ease: "power3.inOut", ...IN }, REVEAL + 0.06);

  // The claim lifts to the top and the editor rises beneath it: centred, tilted, the subject.
  const SHOW = 29.0;
  t.set(panel, { autoAlpha: 1 }, SHOW + 0.05);


  // the requested change lands on the button
  t.set(q("cta-new"), { autoAlpha: 0 }, 0);
  t.set(q("cta-old"), { autoAlpha: 0 }, SHOW + 1.15);
  t.set(q("cta-new"), { autoAlpha: 1 }, SHOW + 1.15);
  t.fromTo(artCta, { scale: 1 }, { scale: 1.12, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.out", ...IN }, SHOW + 1.15);

  // ================= Tweak it yourself: edit the text directly on the canvas =================
  const ZOOM = 30.75;
  const zoomPose = { ...panelState(P(960, 1073, 1.5)), ...flat }; // the headline sits at the centre of frame
  t.set(artCam, { x: 0, y: 0, scale: 1 }, 0);
  t.set(artHeadline, { xPercent: -50, yPercent: -50, x: 0, y: -222, scale: 0.55, backgroundColor: "rgba(124,247,197,0)", borderRight: "3px solid rgba(124,247,197,0)" }, 0);
  t.set(selection, { left: 252, top: 20, width: 456, height: 64, autoAlpha: 0 }, 0);
  // Rise, tilt settle and push onto the headline are one move: a smooth spline through three poses
  // (below frame and steeply tilted -> centred showcase -> flat close-up) on a single eased clock.
  const entryPose = { ...showPose, y: showPose.y + 720, scale: 0.62, rotationX: 30, rotationY: -20 };
  const midPose = { ...showPose, scale: 0.72, rotationX: 11, rotationY: -8 };
  const poseKeys = [entryPose, midPose, zoomPose];
  const hermite = (a, b, ma, mb, s) => {
    const s2 = s * s, s3 = s2 * s;
    return a * (2 * s3 - 3 * s2 + 1) + ma * (s3 - 2 * s2 + s) + b * (-2 * s3 + 3 * s2) + mb * (s3 - s2);
  };
  const posePath = (u, prop) => {
    const v = poseKeys.map((k) => k[prop]);
    const mid = (v[2] - v[0]) / 2; // one shared tangent through the showcase, so it never stops there
    return u < 0.5 ? hermite(v[0], v[1], (v[1] - v[0]) / 2, mid, u * 2) : hermite(v[1], v[2], mid, (v[2] - v[1]) / 2, u * 2 - 1);
  };
  const MOVE_AT = SHOW + 0.05, MOVE_END = ZOOM + 0.95;
  const pathProps = ["x", "y", "scaleX", "scaleY", "rotationX", "rotationY"];
  t.fromTo(panel, Object.fromEntries(pathProps.map((k) => [k, 0])), {
    ...Object.fromEntries(pathProps.map((k) => [k, 1])), duration: MOVE_END - MOVE_AT, ease: "power1.inOut", ...IN,
    modifiers: Object.fromEntries(pathProps.map((k) => [k, (v) => posePath(parseFloat(v), k.startsWith("scale") ? "scale" : k) + (k === "x" || k === "y" ? "px" : k.startsWith("rotation") ? "deg" : "")])),
  }, MOVE_AT);
  // The claim rides the same tilt: it travels up by exactly the editor's rise, so the two slide
  // together like one camera move. Only the rise is shared; the push into the headline is the editor's own.
  t.fromTo(tweakCaption, { y: 0 }, { y: 1, duration: MOVE_END - MOVE_AT, ease: "power1.inOut", ...IN, modifiers: {
    y: (v) => CAPTION_CENTRE + (posePath(Math.min(0.5, parseFloat(v)), "y") - entryPose.y) + "px",
  } }, MOVE_AT);
  t.set(tweakCaption, { autoAlpha: 0 }, MOVE_AT + (MOVE_END - MOVE_AT) * 0.5);
  // the pointer arcs in from the left, tilted, and settles on the headline
  const arc = (u, a, b, c) => (1 - u) * (1 - u) * a + 2 * u * (1 - u) * b + u * u * c;
  const onWord = { x: 1300, y: 566 };
  const E0 = ZOOM + 0.5;
  t.set(editCursor, { x: 180, y: 900, rotation: -28 }, 0);
  t.fromTo(editCursor, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ...IN }, E0);
  t.fromTo(editCursor, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.75, ease: "power2.inOut", ...IN, modifiers: {
    x: (v) => arc(parseFloat(v), 180, 700, onWord.x) + "px", y: (v) => arc(parseFloat(v), 900, 420, onWord.y) + "px",
  } }, E0);
  t.fromTo(editCursor, { rotation: -28 }, { rotation: 0, duration: 0.75, ease: "power3.out", ...IN }, E0);
  // double-click selects the whole line
  [E0 + 0.8, E0 + 0.97].forEach((at) => t.fromTo(editCursor, { scale: 1 }, { scale: 0.82, duration: 0.07, yoyo: true, repeat: 1, ...IN }, at));
  t.fromTo(selection, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, ...IN }, E0 + 0.83);
  t.fromTo(artHeadline, { backgroundColor: "rgba(124,247,197,0)" }, { backgroundColor: "rgba(124,247,197,0.32)", duration: 0.1, ...IN }, E0 + 0.99);
  t.fromTo(editCursor, { x: onWord.x, y: onWord.y }, { x: onWord.x + 70, y: onWord.y + 90, duration: 0.4, ease: "power2.out", ...IN }, E0 + 1.15);
  // typing replaces it in place
  const TYPE = E0 + 1.25, TYPE_DUR = 0.95;
  const before = 'Introducing <span class="acc">Clarity AI</span>';
  const typed = "Start knowing.";
  const headlineText = { v: 0 };
  t.fromTo(headlineText, { v: 0 }, { v: 1, duration: TYPE_DUR, ease: "none", ...IN, onUpdate() {
    if (headlineText.v <= 0) { artHeadline.innerHTML = before; return; }
    const shown = typed.slice(0, Math.max(1, Math.ceil(headlineText.v * typed.length)));
    artHeadline.innerHTML = shown.slice(0, 6) + (shown.length > 6 ? '<span class="acc">' + shown.slice(6) + "</span>" : "");
  } }, TYPE);
  t.fromTo(artHeadline, { backgroundColor: "rgba(124,247,197,0.32)" }, { backgroundColor: "rgba(124,247,197,0)", duration: 0.05, ...IN }, TYPE);
  t.fromTo(artHeadline, { borderRight: "3px solid rgba(124,247,197,0)" }, { borderRight: "3px solid rgba(124,247,197,1)", duration: 0.05, ...IN }, TYPE);
  t.fromTo(artHeadline, { borderRight: "3px solid rgba(124,247,197,1)" }, { borderRight: "3px solid rgba(124,247,197,0)", duration: 0.05, ...IN }, TYPE + TYPE_DUR + 0.25);
  t.fromTo(selection, { left: 252, width: 456 }, { left: 318, width: 324, duration: TYPE_DUR, ease: "none", ...IN }, TYPE);

  // ================= Colour belongs in the properties panel =================
  const BACK = TYPE + TYPE_DUR + 0.15;
  t.fromTo(panel, { ...zoomPose }, { ...editPose, duration: 0.8, ease: "expo.inOut", ...IN }, BACK);
  t.fromTo(editDetail, { autoAlpha: 0, x: 140 }, { autoAlpha: 1, x: 0, duration: 0.55, ease: E_OUT, ...IN }, BACK + 0.35);
  const mintSwatch = { x: 1452, y: 518 };
  t.fromTo(editCursor, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.55, ease: "power2.inOut", ...IN, modifiers: {
    x: (v) => arc(parseFloat(v), onWord.x + 70, 1260, mintSwatch.x) + "px", y: (v) => arc(parseFloat(v), onWord.y + 90, 760, mintSwatch.y) + "px",
  } }, BACK + 0.55);
  t.fromTo(editCursor, { scale: 1 }, { scale: 0.82, duration: 0.08, yoyo: true, repeat: 1, ...IN }, BACK + 1.15);
  const ring = q("swatch-ring"), hex = q("swatch-hex");
  t.set(ring, { x: 0 }, 0);
  t.set(artHeadline, { "--hl": "#ff7a59" }, 0);
  t.fromTo(ring, { x: 0 }, { x: 64, duration: 0.25, ease: "back.out(1.8)", ...IN }, BACK + 1.18);
  t.fromTo(artHeadline, { "--hl": "#ff7a59" }, { "--hl": "#7cf7c5", duration: 0.35, ease: "power2.out", ...IN }, BACK + 1.2);
  const hexState = { v: 0 };
  t.fromTo(hexState, { v: 0 }, { v: 1, duration: 0.01, ...IN, onUpdate() { hex.textContent = hexState.v < 1 ? "#FF7A59" : "#7CF7C5"; } }, BACK + 1.2);
  t.fromTo(q("tl-playhead"), { x: 310 }, { x: 650, duration: 4.4, ease: "none", ...IN }, SHOW + 1.0);

  const TWEAK_OUT = BACK + 1.9;
  t.fromTo(editCursor, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2, ...IN }, TWEAK_OUT - 0.1);
  t.fromTo([panel, editDetail], { autoAlpha: 1, y: (_, el) => el === panel ? editPose.y : 0 }, { autoAlpha: 0, y: -650, duration: 0.7, ease: E_IO, ...IN }, TWEAK_OUT);

  // ================= 7a · Formats (35.95 – 37.1) =================
  const slot = q("promise-slot"), slotW = qa("[data-promise]", slot);
  t.set(slotW, { yPercent: 135 }, 0);
  [35.95, 36.25, 36.55].forEach((at, i) => {
    if (i > 0) t.fromTo(slotW[i - 1], { yPercent: 0 }, { yPercent: -135, duration: 0.25, ease: E_IN, ...IN }, at - 0.05);
    t.fromTo(slotW[i], { yPercent: 135 }, { yPercent: 0, duration: 0.35, ease: E_OUT, ...IN }, at);
  });
  t.fromTo(slotW[2], { yPercent: 0 }, { yPercent: -135, duration: 0.3, ease: E_IN, ...IN }, 36.8);

  // ================= 7 · Gallery: films made with Motify (35.1 – 42.5) =================
  // Part 1: a tilted wall of real films. Part 2: the claim lands, a light desk opens and the camera
  // zooms out from the word to the films floating around it. They leave to the left one by one.
  const F = 45.05;
  const gallery = q("gallery"), galleryCam = q("gallery-camera"), wall = q("gallery-wall");
  const galleryLight = q("gallery-light"), galleryDesk = q("gallery-desk"), galleryField = q("gallery-field"), galleryLine = q("gallery-line");
  const FILMS = {
    kiritts: { name: "KiriTTS", frames: 240 }, relay: { name: "Relay", frames: 204 }, recoup: { name: "Recoup", frames: 168 },
    tessera: { name: "Tessera", frames: 135 }, "notes-app": { name: "Notes", frames: 90 }, claude: { name: "Claude", frames: 90 },
  };
  Object.entries(FILMS).forEach(([clip, f]) => {
    f.urls = Array.from({ length: f.frames }, (_, k) => "assets/showcase/" + clip + "/" + String(k).padStart(3, "0") + ".webp");
    f.urls.forEach((u) => { const warm = new Image(); warm.src = u; });
  });
  const CLIP_ORDER = ["kiritts", "relay", "recoup", "tessera", "notes-app", "claude"];
  const players = [];
  function filmFrame(clip, i, parent, className) {
    const film = FILMS[clip];
    const img = doc.createElement("img");
    img.alt = "";
    const offset = (i * 37) % film.urls.length;
    img.src = film.urls[offset];
    const tag = doc.createElement("span");
    tag.className = "gtag";
    tag.innerHTML = "<i></i>" + film.name;
    parent.append(img, tag);
    players.push({ img, film, offset, shown: offset });
  }

  // --- part 1: the wall ---
  const G0 = 36.75, G_DESK = 40.05, G_EXIT = 43.85;
  const COLS = 5, ROWS = 7, TW = 480, TH = 270, GAP = 28;
  wall.style.width = COLS * (TW + GAP) - GAP + "px";
  wall.style.height = ROWS * (TH + GAP) - GAP + "px";
  const columns = [];
  for (let c = 0; c < COLS; c++) {
    const col = doc.createElement("div");
    col.className = "gcol";
    col.style.left = c * (TW + GAP) + "px";
    for (let r = 0; r < ROWS; r++) {
      const tile = doc.createElement("div");
      tile.className = "gtile";
      tile.style.top = r * (TH + GAP) + "px";
      filmFrame(CLIP_ORDER[(c * 2 + r * 3 + 1) % 6], c * 7 + r, tile);
      col.appendChild(tile);
    }
    wall.appendChild(col);
    columns.push(col);
  }
  columns.forEach((col, c) => {
    const base = c % 2 ? -(TH + GAP) / 2 : 0, dir = c % 2 ? 1 : -1;
    t.set(col, { y: base }, 0);
    t.fromTo(col, { y: base }, { y: base + dir * 220, duration: G_DESK + 1 - G0, ease: "none", ...IN }, G0);
  });
  t.set(gallery, { autoAlpha: 0 }, 0);
  t.set(galleryCam, { scale: 2.3, x: 0, y: 0 }, 0);
  t.fromTo(gallery, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: "power2.out", ...IN }, G0);
  t.fromTo(galleryCam, { scale: 2.3 }, { scale: 1, duration: 2.0, ease: "power3.inOut", ...IN }, G0);
  // the wall holds, then keeps zooming out and fades away into the light desk: one continuous move
  t.fromTo(galleryCam, { scale: 1 }, { scale: 0.4, duration: G_DESK + 0.5 - (G0 + 2.0), ease: "power2.in", ...IN }, G0 + 2.0);
  t.fromTo([galleryCam, galleryCam.nextElementSibling], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.7, ease: "power1.in", ...IN }, G_DESK - 0.1);

  // --- part 2: the desk ---
  // left, top, width, height and depth: near cards are large and sit in front, far cards are small,
  // slightly soft and behind. Depth sets how strongly each one reacts to the camera's zoom.
  const LAYOUT = [
    { clip: "tessera", x: 800, y: 96, w: 380, h: 214, d: 0.55 },
    { clip: "notes-app", x: 770, y: 760, w: 400, h: 225, d: 0.55 },
    { clip: "kiritts", x: 130, y: 104, w: 560, h: 315, d: 1 },
    { clip: "claude", x: 1300, y: 700, w: 590, h: 332, d: 1 },
    { clip: "recoup", x: 1330, y: 120, w: 640, h: 360, d: 1.45 },
    { clip: "relay", x: -70, y: 620, w: 660, h: 371, d: 1.45 },
  ];
  const cards = LAYOUT.map((l, i) => {
    const card = doc.createElement("div");
    card.className = "gcard" + (l.d < 0.8 ? " far" : l.d > 1.2 ? " near" : "");
    card.style.cssText = "left:" + l.x + "px;top:" + l.y + "px;width:" + l.w + "px;height:" + l.h + "px;z-index:" + Math.round(l.d * 10) +
      ";transform-origin:" + (960 - l.x) + "px " + (540 - l.y) + "px";
    const face = doc.createElement("div");
    face.className = "gfloat";
    filmFrame(l.clip, i * 5 + 3, face);
    card.appendChild(face);
    galleryField.appendChild(card);
    register("gallery-card-" + l.clip, card);
    return { ...l, card };
  });

  // every film plays at 30 fps from the moment the gallery opens
  const galleryClock = { v: 0 };
  t.fromTo(galleryClock, { v: 0 }, { v: 52, duration: 52, ease: "none", ...IN, onUpdate() {
    const step = Math.max(0, Math.floor((galleryClock.v - G0) * 30));
    players.forEach((p) => {
      const k = (p.offset + step) % p.film.urls.length;
      if (k !== p.shown) { p.shown = k; p.img.src = p.film.urls[k]; }
    });
  } }, 0);

  // the light desk fades in over the receding wall, already zoomed in on the claim
  t.set(galleryLight, { autoAlpha: 0 }, 0);

  t.fromTo(galleryLight, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.55, ease: "power1.inOut", ...IN }, G_DESK - 0.2);
  t.set(galleryField, { autoAlpha: 0 }, 0);
  t.fromTo(galleryField, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: "power1.out", ...IN }, G_DESK + 0.4);
  t.set(galleryLine, { xPercent: -50, yPercent: -50 }, 0);
  const galleryWords = mask(split(galleryLine));
  t.set(galleryWords, { yPercent: 115 }, 0);
  t.fromTo(galleryWords, { yPercent: 115 }, { yPercent: 0, duration: 0.7, stagger: 0.08, ease: E_OUT, ...IN }, G_DESK + 0.15);

  // One camera move that never stops: a quick pull back from the word, then an ever-slower zoom out
  // that carries on until the films slide away. Each depth layer scales by its own amount (parallax).
  const ZOOM_AT = G_DESK + 0.45, ZOOM_END = G_EXIT + 1.4;
  const zoomFor = (d) => ({ from: Math.pow(2.7, d), to: Math.pow(0.84, d) });
  t.set(galleryDesk, { scale: 1 }, 0);
  cards.forEach((c) => {
    const z = zoomFor(c.d);
    t.set(c.card, { scale: z.from }, 0);
    t.fromTo(c.card, { scale: z.from }, { scale: z.to, duration: ZOOM_END - ZOOM_AT, ease: "expo.out", ...IN }, ZOOM_AT);
  });
  const lineZoom = zoomFor(1);
  t.set(galleryLine, { scale: lineZoom.from }, 0);
  t.fromTo(galleryLine, { scale: lineZoom.from }, { scale: lineZoom.to, duration: ZOOM_END - ZOOM_AT, ease: "expo.out", ...IN }, ZOOM_AT);

  // exit: not all at once. Each card winds up and whips out to the left on its own beat; the claim goes last.
  [{ i: 4, at: 0 }, { i: 0, at: 0.08 }, { i: 2, at: 0.2 }, { i: 3, at: 0.3 }, { i: 1, at: 0.44 }, { i: 5, at: 0.52 }].forEach(({ i, at }) => {
    const c = cards[i];
    t.set(c.card, { x: 0, rotation: 0 }, 0);
    t.fromTo(c.card, { x: 0, rotation: 0 }, { x: -(c.x + c.w + 700), rotation: -5, duration: 0.9, ease: "back.in(1.5)", ...IN }, G_EXIT + at);
  });
  t.fromTo(galleryLine, { x: 0 }, { x: -1700, duration: 0.85, ease: "back.in(1.6)", ...IN }, G_EXIT + 0.66);

  // ================= 8 · Brand close on the same light ground (42.5 – 49) =================
  // Motify's own mark: the tile surfaces, then its two strokes draw the M
  const lockup = q("final-lockup"), finalLogo = q("final-logo"), wordmark = q("final-wordmark");
  const markBg = q("final-mark-bg"), markRim = q("final-mark-rim"), finalShine = q("final-shine");
  const markOuter = q("final-mark-outer"), markInner = q("final-mark-inner");
  const logoSize = 116, lockGap = 30, wmW = 353;
  const markShift = (logoSize + lockGap + wmW) / 2 - logoSize / 2;
  const outerLen = markOuter.getTotalLength ? markOuter.getTotalLength() : 420;
  const innerLen = markInner.getTotalLength ? markInner.getTotalLength() : 200;
  const textFirst = -(logoSize + lockGap) / 2; // the wordmark alone, centred
  t.set(lockup, { xPercent: -50, yPercent: -50, x: textFirst, y: 400 }, 0);
  t.set(finalLogo, { scale: 0.6, transformOrigin: "50% 50%" }, 0);
  t.set([markBg, markRim], { autoAlpha: 0 }, 0);
  t.set(finalShine, { xPercent: -160 }, 0);
  t.set(markOuter, { attr: { "stroke-dasharray": outerLen, "stroke-dashoffset": outerLen } }, 0);
  t.set(markInner, { attr: { "stroke-dasharray": innerLen, "stroke-dashoffset": innerLen } }, 0);
  t.fromTo(markBg, { autoAlpha: 0, scale: 0.7, filter: "blur(12px)", transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.7, ease: E_OUT, ...IN }, F + 1.0);
  t.set(markBg, { filter: "none" }, F + 1.75);
  t.fromTo(markRim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "power2.out", ...IN }, F + 1.2);
  t.fromTo(markOuter, { attr: { "stroke-dashoffset": outerLen } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.8, ease: E_IO, ...IN }, F + 1.15);
  t.fromTo(markInner, { attr: { "stroke-dashoffset": innerLen } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.6, ease: E_IO, ...IN }, F + 1.4);
  t.fromTo(finalShine, { xPercent: -160 }, { xPercent: 330, duration: 0.8, ease: E_IO, ...IN }, F + 1.95);

  // it settles to size and the name arrives beside it
  const wmL = letters(split(wordmark));
  mask(wmL);
  t.set(wmL, { yPercent: 115 }, 0);
  t.fromTo(finalLogo, { scale: 0.6 }, { scale: 1, duration: 0.7, ease: "back.out(1.6)", ...IN }, F + 1.0);
  t.fromTo(lockup, { x: textFirst }, { x: 0, duration: 0.8, ease: E_IO, ...IN }, F + 0.95);
  rise(wmL, F + 0.4, { st: 0.04, dur: 0.8 });

  // the lock-up lifts a touch and the site completes beneath it
  const tagline = q("final-tagline");
  t.fromTo(lockup, { y: 400 }, { y: 320, duration: 0.9, ease: E_IO, ...IN }, F + 2.2);
  t.set(tagline, { y: 372 }, 0);
  pullComplete("final-tagline", F + 2.45, { gap: 0.3 });
  const CREDIT = 49.9;
  t.fromTo([lockup, tagline], { scale: 1 }, { scale: 1.02, duration: CREDIT - (F + 3.0), ease: "sine.inOut", ...IN }, F + 3.0);

  // and one last card, on its own: who made this film
  t.fromTo(lockup, { y: 320, autoAlpha: 1 }, { y: 250, autoAlpha: 0, duration: 0.45, ease: E_IN, ...IN }, CREDIT);
  t.fromTo(tagline, { y: 372, autoAlpha: 1 }, { y: 302, autoAlpha: 0, duration: 0.45, ease: E_IN, ...IN }, CREDIT + 0.04);
  const credit = q("final-credit");
  t.set(credit, { xPercent: -50, yPercent: -50 }, 0);
  const creditWords = mask(split(credit));
  t.set(creditWords, { yPercent: 115 }, 0);
  t.fromTo(creditWords, { yPercent: 115 }, { yPercent: 0, duration: 0.7, stagger: 0.08, ease: E_OUT, ...IN }, CREDIT + 0.3);
  t.fromTo(credit, { scale: 1 }, { scale: 1.02, duration: 52 - (CREDIT + 0.3), ease: "sine.inOut", ...IN }, CREDIT + 0.3);
}

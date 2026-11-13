import {
  CAPTION_ARRIVALS,
  FORMAT_SIZE,
  STACK_TONES,
  captionKeywords,
  cleanCaptionDesign,
  cueWordTimes,
  stackBreaks,
  cutawayFrame,
  editDuration,
  placeCues,
  placeCutaways,
  placeSegments,
  sameBox,
  type FootageEdit,
  type FootageSpeakerBox,
  type FootageTitle,
} from "../footage/edit";
import { FILM_FONTS, filmFontFaceCss } from "./film-fonts";
import { cardFilmDocument } from "../footage/films";
import type { CompositionContext } from "./types";

/**
 * Moves a footage edit's elements (footage/render.ts wrote them) on the film's
 * own timeline: each shot shows for its span and arrives with its transition,
 * captions appear with their words and light the one being said, titles enter
 * and leave in their style. Clips and sound are placed by data attributes and
 * played by VideoSync and AudioSync, like any film's.
 *
 * It is handed to timeline.js with the presets, so a footage project is an
 * ordinary film to the runtime, preview and export.
 */

const KHMER = /[ក-៿᧠-᧿]/;

/**
 * The text as word pieces the timeline can move. Khmer is written without
 * spaces, so the platform's segmenter finds its words; each piece may then
 * wrap on its own, which is also where a Khmer line is allowed to break.
 */
export function splitIntoWords(
  element: HTMLElement,
  text: string,
): HTMLElement[] {
  const pieces: HTMLElement[] = [];
  const nodes: Node[] = [];
  const segments =
    typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter(KHMER.test(text) ? "km" : undefined, {
            granularity: "word",
          }).segment(text),
          (piece) => piece.segment,
        )
      : text.split(/(\s+)/);
  let pending = "";
  const flush = () => {
    if (!pending) return;
    const span = document.createElement("span");
    span.className = "motionly-split-item";
    span.textContent = pending;
    pieces.push(span);
    nodes.push(span);
    pending = "";
  };
  for (const segment of segments) {
    if (/^\s+$/.test(segment)) {
      flush();
      // A space of its own element: GSAP, measuring a word that is not laid
      // out, puts it back before its next element, which a bare text node
      // between words is not, and the space would slip away.
      const space = document.createElement("span");
      space.className = "fx-space";
      space.textContent = " ";
      nodes.push(space);
    } else if (/^[\p{P}\p{S}]+$/u.test(segment) && pending) {
      // Punctuation stays on its word, so a line never starts with it.
      pending += segment;
    } else {
      flush();
      pending = segment;
    }
  }
  flush();
  element.replaceChildren(...nodes);
  element.dataset["motionlySplitUnit"] = "words";
  return pieces;
}

function ensureFonts(root: HTMLElement): void {
  if (root.querySelector("style[data-motify-footage-fonts]")) return;
  const style = document.createElement("style");
  style.dataset["motifyFootageFonts"] = "";
  // Every bundled face: captions may be set in any of them.
  style.textContent = filmFontFaceCss(FILM_FONTS);
  root.prepend(style);
}

function byId(root: HTMLElement, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    `[id="${id.replace(/[\\"]/g, "\\$&")}"]`,
  );
}

export function footageTimeline(
  context: CompositionContext,
  edit: FootageEdit,
): void {
  const { root, timeline } = context;
  ensureFonts(root);
  const total = Math.max(0.5, editDuration(edit));
  const placed = placeSegments(edit);
  const flash = root.querySelector<HTMLElement>(".fx-flash");

  placed.forEach(({ segment, start, end }, index) => {
    const shot = byId(root, `fx-shot-${segment.id}`);
    if (!shot) return;
    if (segment.card) animateCard(timeline, shot, start, end);
    const film = shot.querySelector<HTMLElement>(".fx-card-film");
    if (film) mountCardFilm(timeline, film, start, end);
    const video =
      shot.querySelector<HTMLVideoElement>("video.fx-main") ??
      shot.querySelector("video");
    const last = index === placed.length - 1;
    // A slide pushes this shot out while the next one comes in, so it stays up until then.
    const next = placed[index + 1];
    const pushedOut =
      next && next.segment.transition === "slide"
        ? Math.min(0.4, (next.end - next.start) / 2)
        : 0;
    timeline.set(shot, { autoAlpha: 1 }, start);
    if (!last) timeline.set(shot, { autoAlpha: 0 }, end + pushedOut);
    // A punch-in holds a closer framing for the whole segment; a push-in moves from it.
    const punch = segment.punch && segment.punch > 1 ? segment.punch : 1;
    if (video && punch > 1 && segment.zoom <= 1.001)
      timeline.fromTo(
        video,
        { scale: punch },
        {
          scale: punch,
          duration: end - start,
          ease: "none",
          immediateRender: false,
        },
        start,
      );
    if (video && segment.zoom > 1.001)
      timeline.fromTo(
        video,
        { scale: punch },
        {
          scale: punch * segment.zoom,
          duration: end - start,
          ease: "none",
          immediateRender: false,
        },
        start,
      );

    // The incoming shot's transition, and what the outgoing one does into it.
    const previous = placed[index - 1];
    const outgoing = previous
      ? byId(root, `fx-shot-${previous.segment.id}`)
      : null;
    const into = Math.min(0.35, (end - start) / 2);
    const away = previous
      ? Math.min(0.2, (previous.end - previous.start) / 3)
      : 0;
    switch (index === 0 ? "cut" : segment.transition) {
      case "slide": {
        const slide = Math.min(0.4, (end - start) / 2);
        if (outgoing)
          timeline.fromTo(
            outgoing,
            { xPercent: 0 },
            {
              xPercent: -100,
              duration: slide,
              ease: "power3.inOut",
              immediateRender: false,
            },
            start,
          );
        timeline.fromTo(
          shot,
          { xPercent: 100 },
          {
            xPercent: 0,
            duration: slide,
            ease: "power3.inOut",
            immediateRender: false,
          },
          start,
        );
        break;
      }
      case "blur":
        if (outgoing)
          timeline.fromTo(
            outgoing,
            { filter: "blur(0px)" },
            {
              filter: "blur(18px)",
              duration: away,
              ease: "power2.in",
              immediateRender: false,
            },
            start - away,
          );
        timeline.fromTo(
          shot,
          { filter: "blur(18px)" },
          {
            filter: "blur(0px)",
            duration: into,
            ease: "power2.out",
            immediateRender: false,
          },
          start,
        );
        break;
      case "zoom":
        if (outgoing)
          timeline.fromTo(
            outgoing,
            { scale: 1 },
            {
              scale: 1.18,
              duration: away,
              ease: "power2.in",
              immediateRender: false,
            },
            start - away,
          );
        timeline.fromTo(
          shot,
          { scale: 1.28 },
          {
            scale: 1,
            duration: into,
            ease: "expo.out",
            immediateRender: false,
          },
          start,
        );
        break;
      case "whip":
        if (outgoing)
          timeline.fromTo(
            outgoing,
            { xPercent: 0, filter: "blur(0px)" },
            {
              xPercent: -35,
              filter: "blur(16px)",
              duration: away,
              ease: "power3.in",
              immediateRender: false,
            },
            start - away,
          );
        timeline.fromTo(
          shot,
          { xPercent: 35, filter: "blur(16px)" },
          {
            xPercent: 0,
            filter: "blur(0px)",
            duration: into,
            ease: "power3.out",
            immediateRender: false,
          },
          start,
        );
        break;
      case "flash":
        if (flash)
          timeline.fromTo(
            flash,
            { autoAlpha: 0 },
            {
              keyframes: [
                { autoAlpha: 0.9, duration: 0.06 },
                { autoAlpha: 0, duration: 0.28 },
              ],
              immediateRender: false,
            },
            start - 0.06,
          );
        break;
      default:
        break;
    }
  });

  // Overlays over talk: on for their moment. B-roll and pictures keep a slow
  // push so they are never still; a card plays its own motion.
  placeCutaways(edit).forEach((placed, index) => {
    const layer = byId(root, `fx-cut-${index}`);
    if (!layer) return;
    const { start, end } = placed;
    timeline.set(layer, { autoAlpha: 1 }, start);
    timeline.set(layer, { autoAlpha: 0 }, end);
    if (placed.cutaway.kind === "card") {
      animateCard(timeline, layer, start, end);
      const film = layer.querySelector<HTMLElement>(".fx-card-film");
      if (film) mountCardFilm(timeline, film, start, end);
      // It arrives with a quick rise and leaves with a fade, over the talk.
      timeline.fromTo(
        layer,
        { yPercent: 6, autoAlpha: 0 },
        {
          yPercent: 0,
          autoAlpha: 1,
          duration: Math.min(0.3, (end - start) / 3),
          ease: "power3.out",
          immediateRender: false,
        },
        start,
      );
      return;
    }
    const moving =
      placed.cutaway.kind === "image"
        ? (layer.querySelector<HTMLElement>(".fx-pic-main") ?? layer)
        : (layer.querySelector<HTMLElement>("video") ?? layer);
    const frame = cutawayFrame(placed.cutaway);
    if (frame.box) {
      // A window pops in over the speaker and shrinks away again.
      const pop = Math.min(0.25, (end - start) / 4);
      timeline.fromTo(
        layer,
        { autoAlpha: 0, scale: 0.9 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: pop,
          ease: "power3.out",
          immediateRender: false,
        },
        start,
      );
      timeline.fromTo(
        layer,
        { autoAlpha: 1, scale: 1 },
        {
          autoAlpha: 0,
          scale: 0.94,
          duration: pop,
          ease: "power2.in",
          immediateRender: false,
        },
        end - pop,
      );
    } else if (placed.cutaway.kind === "image" && !frame.top)
      timeline.fromTo(
        layer,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          duration: Math.min(0.2, (end - start) / 4),
          ease: "power1.out",
          immediateRender: false,
        },
        start,
      );
    timeline.fromTo(
      moving,
      { scale: placed.cutaway.kind === "image" ? 0.96 : 1.02 },
      {
        scale: placed.cutaway.kind === "image" ? 1.04 : 1.08,
        duration: end - start,
        ease: "none",
        immediateRender: false,
      },
      start,
    );
  });

  splitReveals(root, timeline, edit);
  speakerWindows(root, timeline, edit);

  animateCaptions(root, timeline, edit);

  for (const title of edit.titles) animateTitle(root, timeline, title, total);

  // The film lasts exactly as long as the cut.
  timeline.set({}, {}, total);
}

/**
 * Captions on the clock. Each line shows for as long as it is said and, by the
 * edit's animation, fades or pops in, or its words arrive (blurring into
 * focus, rising, typing on, slamming down), light up or bounce as each is
 * said. The stack style, and a design with key-word colours, mark each line's
 * key words; the stack style also breaks the line into stacked rows. Word
 * times come from the transcript (cueWordTimes); every tween is a fromTo on
 * the timeline, so any frame can be sought for export.
 */
function animateCaptions(
  root: HTMLElement,
  timeline: gsap.core.Timeline,
  edit: FootageEdit,
): void {
  const animation = edit.captions.animation ?? "none";
  const style = edit.captions.style;
  const design = cleanCaptionDesign(edit.captions.design);
  const stack = style === "stack";
  const tones = design?.keywords ?? (stack ? STACK_TONES : []);
  const lightsWords =
    animation === "karaoke" || animation === "bounce" || style === "highlight";
  const arrives = CAPTION_ARRIVALS.includes(animation);
  const byWord = lightsWords || arrives || stack || tones.length > 0;
  // Movement in percent of the text's own height, so it scales with the caption.
  const lift = 22;
  let keyCount = 0;
  placeCues(edit).forEach((placed, index) => {
    const cue = byId(root, `fx-cue-${index}`);
    if (!cue) return;
    const span = Math.max(0.05, placed.end - placed.start);
    timeline.set(cue, { autoAlpha: 1 }, placed.start);
    timeline.set(cue, { autoAlpha: 0 }, placed.end);
    // The cue itself may be centred with a transform, so its lines are what move.
    const lines = Array.from(
      cue.querySelectorAll<HTMLElement>(".fx-line, .fx-alt"),
    );
    const enter = Math.min(0.3, span / 3);
    if (animation === "fade")
      timeline.fromTo(
        lines,
        { autoAlpha: 0, yPercent: lift },
        {
          autoAlpha: 1,
          yPercent: 0,
          duration: enter,
          ease: "power2.out",
          immediateRender: false,
        },
        placed.start,
      );
    else if (animation === "pop")
      timeline.fromTo(
        lines,
        { autoAlpha: 0, scale: 0.6 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: enter,
          ease: "back.out(2.4)",
          immediateRender: false,
        },
        placed.start,
      );
    const line = cue.querySelector<HTMLElement>(".fx-line");
    if (!byWord || !line) return;
    const pieces = splitIntoWords(line, placed.cue.text);
    const texts = pieces.map((piece) => piece.textContent ?? "");
    const keys =
      stack || tones.length > 0
        ? captionKeywords(texts)
        : pieces.map(() => false);
    if (stack || tones.length > 0)
      pieces.forEach((piece, at) => {
        if (!keys[at]) {
          piece.classList.add("fx-small");
          return;
        }
        piece.classList.add("fx-key");
        piece.style.setProperty(
          "--fx-key",
          tones[keyCount % tones.length] ?? "inherit",
        );
        piece.style.setProperty(
          "--fx-len",
          String(Math.max(4, Array.from(texts[at]!.trim()).length)),
        );
        keyCount += 1;
      });
    if (stack)
      stackBreaks(keys).forEach((breaks, at) => {
        if (!breaks) return;
        const row = document.createElement("span");
        row.className = "fx-break";
        pieces[at]!.before(row);
      });
    const times = cueWordTimes(placed, texts);
    pieces.forEach((piece, at) => {
      const { start, end } = times[at]!;
      const said = Math.max(placed.start, start - 0.04);
      // Hidden from the moment the line shows until the word is said.
      if (arrives) timeline.set(piece, { autoAlpha: 0 }, placed.start);
      if (animation === "words")
        timeline.fromTo(
          piece,
          { autoAlpha: 0, yPercent: lift * 1.5, scale: 0.7 },
          {
            autoAlpha: 1,
            yPercent: 0,
            scale: 1,
            duration: Math.min(0.22, span / 2),
            ease: "back.out(2.6)",
            immediateRender: false,
          },
          said,
        );
      else if (animation === "blur")
        timeline.fromTo(
          piece,
          { autoAlpha: 0, yPercent: lift * 0.6, filter: "blur(14px)" },
          {
            autoAlpha: 1,
            yPercent: 0,
            filter: "blur(0px)",
            duration: Math.min(0.32, span / 2),
            ease: "power2.out",
            immediateRender: false,
          },
          said,
        );
      else if (animation === "rise")
        timeline.fromTo(
          piece,
          { autoAlpha: 0, yPercent: 80, rotation: 4 },
          {
            autoAlpha: 1,
            yPercent: 0,
            rotation: 0,
            duration: Math.min(0.36, span / 2),
            ease: "expo.out",
            immediateRender: false,
          },
          said,
        );
      else if (animation === "slam")
        timeline.fromTo(
          piece,
          { autoAlpha: 0, scale: 2.1 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: Math.min(0.16, span / 2),
            ease: "power4.in",
            immediateRender: false,
          },
          said,
        );
      else if (animation === "typewriter") {
        const letters = Math.max(1, Array.from(texts[at]!.trim()).length);
        timeline.fromTo(
          piece,
          { autoAlpha: 1, clipPath: "inset(-30% 100% -30% -10%)" },
          {
            autoAlpha: 1,
            clipPath: "inset(-30% -10% -30% -10%)",
            duration: Math.max(
              0.05,
              Math.min(letters * 0.045, end - start, span / 2),
            ),
            ease: `steps(${letters})`,
            immediateRender: false,
          },
          said,
        );
      }
      if (lightsWords) {
        timeline.set(piece, { attr: { "data-on": "1" } }, start);
        timeline.set(
          piece,
          { attr: { "data-on": "0" } },
          Math.max(start + 0.05, end),
        );
      }
      if (animation === "bounce") {
        const up = Math.min(0.12, (end - start) / 2);
        timeline.fromTo(
          piece,
          { yPercent: 0, scale: 1 },
          {
            yPercent: -lift,
            scale: 1.18,
            duration: up,
            ease: "power2.out",
            immediateRender: false,
          },
          start,
        );
        timeline.fromTo(
          piece,
          { yPercent: -lift, scale: 1.18 },
          {
            yPercent: 0,
            scale: 1,
            duration: Math.min(0.18, Math.max(0.06, end - start - up)),
            ease: "power2.inOut",
            immediateRender: false,
          },
          start + up,
        );
      }
    });
  });
}

/**
 * The talking-head split: while an overlay fills the top half (the left in a
 * wide video), the speaker's shots move down (right) by a quarter of the frame
 * so their face stays in view below, and back when it ends. The overlay slides
 * in from the top edge and out again; back-to-back ones share one reveal.
 */
function splitReveals(
  root: HTMLElement,
  timeline: gsap.core.Timeline,
  edit: FootageEdit,
): void {
  const shots = root.querySelector<HTMLElement>(".fx-shots");
  const tops = placeCutaways(edit)
    .map((placed, index) => ({ ...placed, index }))
    .filter(({ cutaway }) => cutawayFrame(cutaway).top);
  if (!shots || tops.length === 0) return;
  const axis = edit.format === "16:9" ? "xPercent" : "yPercent";
  const spans: Array<{
    start: number;
    end: number;
    first: number;
    last: number;
  }> = [];
  for (const top of tops) {
    const last = spans[spans.length - 1];
    if (last && top.start - last.end < 0.4) {
      last.end = Math.max(last.end, top.end);
      last.last = top.index;
    } else
      spans.push({
        start: top.start,
        end: top.end,
        first: top.index,
        last: top.index,
      });
  }
  for (const span of spans) {
    const move = Math.min(0.45, (span.end - span.start) / 3);
    timeline.fromTo(
      shots,
      { [axis]: 0 },
      {
        [axis]: 25,
        duration: move,
        ease: "power3.inOut",
        immediateRender: false,
      },
      span.start,
    );
    timeline.fromTo(
      shots,
      { [axis]: 25 },
      {
        [axis]: 0,
        duration: move,
        ease: "power3.inOut",
        immediateRender: false,
      },
      span.end - move,
    );
    const enter = byId(root, `fx-cut-${span.first}`);
    if (enter)
      timeline.fromTo(
        enter,
        { [axis]: -100 },
        {
          [axis]: 0,
          duration: move,
          ease: "power3.inOut",
          immediateRender: false,
        },
        span.start,
      );
    const leave = byId(root, `fx-cut-${span.last}`);
    if (leave)
      timeline.fromTo(
        leave,
        { [axis]: 0 },
        {
          [axis]: -100,
          duration: move,
          ease: "power3.inOut",
          immediateRender: false,
        },
        span.end - move,
      );
  }
}

/**
 * The speaker in a box of their own: while an overlay that asks for it is on,
 * the shots shrink into that box, cropped to its shape, and grow back to the
 * whole frame when it ends. An overlay they stand in front of was placed under
 * the shots, so shrinking them is what reveals it. Back-to-back overlays with
 * the same box share one move.
 */
function speakerWindows(
  root: HTMLElement,
  timeline: gsap.core.Timeline,
  edit: FootageEdit,
): void {
  const shots = root.querySelector<HTMLElement>(".fx-shots");
  if (!shots) return;
  const spans: Array<{ start: number; end: number; box: FootageSpeakerBox }> =
    [];
  for (const placed of placeCutaways(edit)) {
    const box = cutawayFrame(placed.cutaway).speaker;
    if (!box) continue;
    const last = spans[spans.length - 1];
    if (last && placed.start - last.end < 0.4 && sameBox(last.box, box))
      last.end = Math.max(last.end, placed.end);
    else spans.push({ start: placed.start, end: placed.end, box });
  }
  const frame = FORMAT_SIZE[edit.format];
  const short = Math.min(frame.width, frame.height);
  const whole = {
    left: "0%",
    top: "0%",
    width: "100%",
    height: "100%",
    borderRadius: "0px",
  };
  for (const span of spans) {
    const move = Math.min(0.45, (span.end - span.start) / 3);
    const boxed = {
      left: `${span.box.x * 100}%`,
      top: `${span.box.y * 100}%`,
      width: `${span.box.w * 100}%`,
      height: `${span.box.h * 100}%`,
      borderRadius: `${(span.box.radius ?? 0) * short}px`,
    };
    timeline.fromTo(
      shots,
      whole,
      {
        ...boxed,
        duration: move,
        ease: "power3.inOut",
        immediateRender: false,
      },
      span.start,
    );
    timeline.fromTo(
      shots,
      boxed,
      {
        ...whole,
        duration: move,
        ease: "power3.inOut",
        immediateRender: false,
      },
      span.end - move,
    );
  }
}

/**
 * A card's motion: the panel resolves from a blurred, smaller state, its words
 * rise in one after another, a number counts up to itself, and the whole card
 * keeps a slow push so it is never still.
 */
function animateCard(
  timeline: gsap.core.Timeline,
  shot: HTMLElement,
  start: number,
  end: number,
): void {
  const panel = shot.querySelector<HTMLElement>(".fx-k-panel");
  if (!panel) return;
  const span = Math.max(0.4, end - start);
  timeline.fromTo(
    panel,
    { scale: 0.9, autoAlpha: 0, filter: "blur(12px)" },
    {
      scale: 1,
      autoAlpha: 1,
      filter: "blur(0px)",
      duration: Math.min(0.55, span / 2),
      ease: "expo.out",
      immediateRender: false,
    },
    start,
  );
  const pieces = Array.from(shot.querySelectorAll<HTMLElement>(".fx-k-anim"));
  if (pieces.length > 0)
    timeline.fromTo(
      pieces,
      { autoAlpha: 0, y: 36 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.5,
        stagger: Math.min(0.1, span / 12),
        ease: "back.out(1.35)",
        immediateRender: false,
      },
      start + 0.12,
    );
  timeline.to(
    panel,
    { scale: 1.035, duration: span, ease: "none" },
    start + Math.min(0.55, span / 2),
  );
  // "5.5", "$2.50", "120+": the number counts up, keeping its decimals and signs.
  const big = shot.querySelector<HTMLElement>(".fx-k-big");
  const match = big?.textContent?.match(/^(\D*)(\d+(?:[.,]\d+)?)(\D*)$/);
  if (big && match) {
    const [, prefix = "", digits = "0", suffix = ""] = match;
    const value = Number(digits.replace(",", "."));
    const decimals = digits.split(/[.,]/)[1]?.length ?? 0;
    const counter = { value: 0 };
    timeline.fromTo(
      counter,
      { value: 0 },
      {
        value,
        duration: Math.min(0.8, span / 2),
        ease: "power3.out",
        immediateRender: false,
        onUpdate: () => {
          big.textContent = `${prefix}${counter.value.toFixed(decimals)}${suffix}`;
        },
      },
      start + 0.2,
    );
  }
}

interface SeekableWindow extends Window {
  seek?: (time: number) => void;
}

/**
 * A card Motify generated: its raw film in a frame of its own, drawn by its
 * `seek` at the card's own time while the card is on. Export captures the frame
 * (frame-render's snapshotCardFilms), so it renders like everything else.
 */
function mountCardFilm(
  timeline: gsap.core.Timeline,
  holder: HTMLElement,
  start: number,
  end: number,
): void {
  const source = cardFilmDocument(holder.dataset["cardFilm"] ?? "");
  if (!source) return;
  const frame = document.createElement("iframe");
  frame.dataset["motifyCardFilm"] = "";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.srcdoc = source;
  holder.replaceChildren(frame);
  let ready = false;
  let pending = 0;
  const draw = (time: number) => {
    pending = time;
    const view = frame.contentWindow as SeekableWindow | null;
    if (!ready || typeof view?.seek !== "function") return;
    try {
      view.seek(time);
    } catch (error) {
      console.error("[Footage] card film seek failed", error);
    }
  };
  frame.addEventListener("load", () => {
    ready = true;
    draw(pending);
  });
  const clock = { time: 0 };
  timeline.fromTo(
    clock,
    { time: 0 },
    {
      time: end - start,
      duration: end - start,
      ease: "none",
      immediateRender: false,
      onUpdate: () => draw(clock.time),
    },
    start,
  );
}

function animateTitle(
  root: HTMLElement,
  timeline: gsap.core.Timeline,
  title: FootageTitle,
  total: number,
): void {
  const element = byId(root, `fx-title-${title.id}`);
  const box = element?.querySelector<HTMLElement>(".fx-title-box");
  const text = element?.querySelector<HTMLElement>(".fx-title-text");
  if (!element || !box || !text) return;
  const start = Math.max(0, Math.min(title.start, total - 0.2));
  const end = Math.min(total, start + Math.max(0.4, title.duration));
  const words = splitIntoWords(text, title.text);
  const sub = element.querySelector<HTMLElement>(".fx-title-sub");
  const leave = Math.min(0.28, (end - start) / 4);

  timeline.set(element, { autoAlpha: 1 }, start);
  // The last title stays to the final frame.
  if (end < total - 0.01) timeline.set(element, { autoAlpha: 0 }, end);

  switch (title.style) {
    case "kinetic":
      // Giant-to-settle: enters huge and blurred, pulls back into focus word by word.
      timeline.fromTo(
        box,
        { scale: 2.1, filter: "blur(10px)" },
        {
          scale: 1,
          filter: "blur(0px)",
          duration: 0.7,
          ease: "expo.out",
          immediateRender: false,
        },
        start,
      );
      timeline.fromTo(
        words,
        { autoAlpha: 0, y: 40 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.06,
          ease: "back.out(1.35)",
          immediateRender: false,
        },
        start,
      );
      timeline.to(
        box,
        {
          scale: 1.04,
          duration: Math.max(0.1, end - start - 0.7 - leave),
          ease: "none",
        },
        start + 0.7,
      );
      break;
    case "badge":
      timeline.fromTo(
        box,
        { scale: 0, rotation: -28 },
        {
          scale: 1,
          rotation: -8,
          duration: 0.6,
          ease: "back.out(2.2)",
          immediateRender: false,
        },
        start,
      );
      timeline.fromTo(
        words,
        { autoAlpha: 0, scale: 0.6 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.35,
          stagger: 0.05,
          ease: "back.out(1.8)",
          immediateRender: false,
        },
        start + 0.18,
      );
      // Never static: the sticker keeps breathing while it is up.
      timeline.to(
        box,
        {
          scale: 1.06,
          duration: 0.5,
          ease: "sine.inOut",
          repeat: Math.max(0, Math.floor((end - start - 0.9) / 0.5)),
          yoyo: true,
        },
        start + 0.6,
      );
      break;
    case "lower-third":
      timeline.fromTo(
        box,
        { xPercent: -120 },
        {
          xPercent: 0,
          duration: 0.55,
          ease: "expo.out",
          immediateRender: false,
        },
        start,
      );
      timeline.fromTo(
        words,
        { autoAlpha: 0, x: -24 },
        {
          autoAlpha: 1,
          x: 0,
          duration: 0.4,
          stagger: 0.04,
          ease: "power3.out",
          immediateRender: false,
        },
        start + 0.15,
      );
      break;
    case "cta":
      timeline.fromTo(
        box,
        { yPercent: 140, scale: 0.9 },
        {
          yPercent: 0,
          scale: 1,
          duration: 0.6,
          ease: "back.out(1.4)",
          immediateRender: false,
        },
        start,
      );
      timeline.fromTo(
        words,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: "back.out(1.35)",
          immediateRender: false,
        },
        start + 0.2,
      );
      timeline.to(
        box,
        {
          scale: 1.05,
          duration: 0.45,
          ease: "sine.inOut",
          repeat: Math.max(0, Math.floor((end - start - 0.9) / 0.45)),
          yoyo: true,
        },
        start + 0.65,
      );
      break;
    default:
      timeline.fromTo(
        words,
        { autoAlpha: 0, yPercent: 110, rotation: 4 },
        {
          autoAlpha: 1,
          yPercent: 0,
          rotation: 0,
          duration: 0.5,
          stagger: 0.05,
          ease: "back.out(1.35)",
          immediateRender: false,
        },
        start,
      );
      timeline.to(
        box,
        {
          y: -10,
          duration: Math.max(0.1, end - start - 0.5 - leave),
          ease: "none",
        },
        start + 0.5,
      );
      break;
  }
  if (sub)
    timeline.fromTo(
      sub,
      { autoAlpha: 0, y: 16 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.4,
        ease: "power3.out",
        immediateRender: false,
      },
      start + 0.3,
    );
  if (end < total - 0.01)
    timeline.to(
      box,
      { autoAlpha: 0, y: "-=24", duration: leave, ease: "power2.in" },
      end - leave,
    );
}

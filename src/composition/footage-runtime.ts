import {
  editDuration,
  placeCues,
  placeCutaways,
  placeSegments,
  type FootageEdit,
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
      nodes.push(document.createTextNode(" "));
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
  style.textContent = filmFontFaceCss(
    // Kantumruy for Khmer and captions; Fraunces for cards' serif titles.
    FILM_FONTS.filter(
      (font) => font.family === "Kantumruy Pro" || font.family === "Fraunces",
    ),
  );
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

  // B-roll over talk: on for its moment, with a slow push so it is never still.
  placeCutaways(edit).forEach((placed, index) => {
    const video = byId(root, `fx-cut-${index}`);
    if (!video) return;
    timeline.set(video, { autoAlpha: 1 }, placed.start);
    timeline.set(video, { autoAlpha: 0 }, placed.end);
    timeline.fromTo(
      video,
      { scale: 1.02 },
      {
        scale: 1.08,
        duration: placed.end - placed.start,
        ease: "none",
        immediateRender: false,
      },
      placed.start,
    );
  });

  // Captions are plain text: each line simply appears for as long as it is said.
  placeCues(edit).forEach((placed, index) => {
    const cue = byId(root, `fx-cue-${index}`);
    if (!cue) return;
    timeline.set(cue, { autoAlpha: 1 }, placed.start);
    timeline.set(cue, { autoAlpha: 0 }, placed.end);
  });

  for (const title of edit.titles) animateTitle(root, timeline, title, total);

  // The film lasts exactly as long as the cut.
  timeline.set({}, {}, total);
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

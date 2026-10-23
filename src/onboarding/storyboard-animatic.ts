import type { StoryboardBeat } from "../cloud/projects-api";
import { canvasSize, type CanvasAspect } from "../composition/canvas-frame";
import type {
  CompositionContext,
  CompositionDefinition,
  SceneDefinition,
} from "../composition/types";

/**
 * A storyboard as a moving sketch: every beat at its real length, the
 * person's own pictures where the beat shows them, the on-screen words where
 * they will read, and a rough camera move. It is drawn from the beats alone,
 * with no model call, so it costs nothing and redraws as the beats are edited.
 *
 * It is an ordinary composition on the editor's runtime, so it plays, seeks
 * and scales exactly as a film does. Grey boxes stand in for everything the
 * film will design, so it never pretends to be the film.
 */

const ACCENT = "#1F45B0";
const FPS = 30;
const MORPH_SECONDS = 0.45;

export interface AnimaticInput {
  beats: readonly StoryboardBeat[];
  seconds: number;
  aspect: CanvasAspect;
  /** Each attached picture's loadable URL, by upload id. */
  pictures: ReadonlyMap<string, string>;
}

/** The camera move a beat's words describe, read loosely; a slow drift when none is named. */
export type AnimaticCamera = "push" | "pull" | "pan" | "drift";

export function cameraMove(camera: string): AnimaticCamera {
  const words = camera.toLowerCase();
  if (/pull|zoom(s|ing)? out|reveal|widen|back out/.test(words)) return "pull";
  if (/push|zoom|close|punch|dolly in|in on/.test(words)) return "push";
  if (/pan|slide|track|travel|lateral|sweep|across|glide/.test(words))
    return "pan";
  return "drift";
}

/** One scene per beat, so the player knows which beat is on screen. */
export function animaticScenes(
  beats: readonly StoryboardBeat[],
): SceneDefinition[] {
  return beats.map((beat, index) => ({
    id: `beat-${index + 1}`,
    label: `${index + 1} · ${beat.title || "Beat"}`,
    start: beat.start,
    duration: beat.duration,
    accent: ACCENT,
  }));
}

export function storyboardAnimatic(
  input: AnimaticInput,
): CompositionDefinition {
  const { width, height } = canvasSize(1920, 1080, input.aspect);
  const scenes = animaticScenes(input.beats);
  return {
    id: "storyboard-animatic",
    title: "Storyboard sketch",
    description: "The storyboard's beats as a moving sketch.",
    width,
    height,
    fps: FPS,
    duration: input.seconds,
    scenes,
    sourcePreview: "",
    build: (context) => buildAnimatic(context, input),
  };
}

function buildAnimatic(context: CompositionContext, input: AnimaticInput) {
  const { root, timeline, width, height } = context;
  const unit = Math.min(width, height) / 1080;
  const portrait = height > width;
  const px = (value: number) => `${Math.round(value * unit)}px`;

  root.style.cssText += [
    "position:relative",
    "overflow:hidden",
    "background:#0d0f14",
    `background-image:linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px)`,
    `background-size:${px(60)} ${px(60)}`,
    "font-family:Inter,'Noto Sans Khmer',system-ui,sans-serif",
    "color:#fff",
  ].join(";");

  const last = input.beats.length - 1;
  input.beats.forEach((beat, index) => {
    const start = beat.start;
    const end = beat.start + beat.duration;
    const morph = Math.min(MORPH_SECONDS, beat.duration * 0.3);

    const section = element("section", {
      position: "absolute",
      inset: "0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: px(36),
    });
    section.dataset["beat"] = String(index + 1);

    const shown = beat.shows.flatMap((id) => {
      const url = input.pictures.get(id);
      return url ? [url] : [];
    });
    const words = beat.text.trim();

    // The words sit above the stage; with nothing to show, they are the stage.
    const line = words ? wordLine(words, px(portrait ? 64 : 68)) : null;
    if (line && shown.length > 0) section.append(line.element);

    const stage = element("div", {
      position: "relative",
      width: portrait ? "84%" : "74%",
      height: shown.length > 0 ? (portrait ? "48%" : "58%") : "40%",
      overflow: "hidden",
      border: `${px(3)} dashed rgba(255,255,255,0.18)`,
      borderRadius: px(28),
      background: "rgba(255,255,255,0.04)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    const camera = element("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: px(24),
      width: "100%",
      height: "100%",
      padding: px(28),
      boxSizing: "border-box",
    });
    if (shown.length > 0) {
      for (const url of shown) {
        const picture = document.createElement("img");
        picture.src = url;
        picture.alt = "";
        Object.assign(picture.style, {
          flex: "1 1 0",
          minWidth: "0",
          maxHeight: "100%",
          objectFit: "contain",
          borderRadius: px(12),
        });
        camera.append(picture);
      }
    } else if (line) {
      camera.append(line.element);
    } else {
      const placeholder = element("p", {
        margin: "0",
        maxWidth: "80%",
        color: "rgba(255,255,255,0.45)",
        fontSize: px(34),
        lineHeight: "1.35",
        textAlign: "center",
      });
      placeholder.textContent = beat.action || "Designed in the film";
      camera.append(placeholder);
    }
    stage.append(camera);
    section.append(stage);

    const caption = element("p", {
      position: "absolute",
      left: px(48),
      right: px(48),
      bottom: px(56),
      margin: "0",
      color: "rgba(255,255,255,0.62)",
      fontSize: px(26),
      lineHeight: "1.4",
      textAlign: "center",
    });
    const label = element("strong", { color: "#fff", fontWeight: "600" });
    label.textContent = `${index + 1} · ${beat.title || "Beat"}`;
    caption.append(label);
    if (beat.action && (shown.length > 0 || line)) {
      caption.append(document.createTextNode(` — ${beat.action}`));
    }
    section.append(caption);
    root.append(section);

    // Each beat is only on screen for its own time, from any seek.
    timeline.set(section, { autoAlpha: 0 }, 0);
    timeline.set(section, { autoAlpha: 1 }, start);
    if (index < last) timeline.set(section, { autoAlpha: 0 }, end);

    // MORPH in: the stage grows out of a pill; MORPH out: it folds back into one.
    timeline.fromTo(
      stage,
      { width: "18%", height: "10%", borderRadius: px(200) },
      {
        width: portrait ? "84%" : "74%",
        height: shown.length > 0 ? (portrait ? "48%" : "58%") : "40%",
        borderRadius: px(28),
        duration: morph,
        ease: "expo.out",
        immediateRender: false,
      },
      start,
    );
    if (index < last) {
      timeline.to(
        stage,
        {
          width: "18%",
          height: "10%",
          borderRadius: px(200),
          duration: morph,
          ease: "expo.in",
        },
        end - morph,
      );
    }

    // The camera never holds still: it follows the beat's move, or drifts.
    const move = cameraMove(beat.camera);
    timeline.fromTo(
      camera,
      move === "push"
        ? { scale: 1, xPercent: 0 }
        : move === "pull"
          ? { scale: 1.14, xPercent: 0 }
          : move === "pan"
            ? { scale: 1.06, xPercent: -4 }
            : { scale: 1, xPercent: 0 },
      {
        scale:
          move === "push"
            ? 1.14
            : move === "pull"
              ? 1
              : move === "pan"
                ? 1.06
                : 1.04,
        xPercent: move === "pan" ? 4 : 0,
        duration: beat.duration,
        ease: "sine.inOut",
        immediateRender: false,
      },
      start,
    );

    if (line) {
      timeline.fromTo(
        line.words,
        { autoAlpha: 0, y: 40 * unit },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: "back.out(1.35)",
          stagger: Math.min(0.08, (beat.duration * 0.4) / line.words.length),
          immediateRender: false,
        },
        start + morph * 0.6,
      );
    }
    timeline.fromTo(
      caption,
      { autoAlpha: 0, y: 16 * unit },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.35,
        ease: "power2.out",
        immediateRender: false,
      },
      start + 0.1,
    );
  });

  // How far through the film, one segment per beat.
  const track = element("div", {
    position: "absolute",
    left: px(48),
    right: px(48),
    bottom: px(28),
    height: px(6),
    display: "flex",
    gap: px(6),
  });
  for (const beat of input.beats) {
    const segment = element("span", {
      position: "relative",
      flex: `${beat.duration} 1 0`,
      overflow: "hidden",
      borderRadius: px(3),
      background: "rgba(255,255,255,0.14)",
    });
    const fill = element("span", {
      position: "absolute",
      inset: "0",
      background: ACCENT,
      transformOrigin: "left center",
    });
    segment.append(fill);
    track.append(segment);
    // Set before its tween, so a seek past both leaves the tween's value.
    timeline.set(fill, { scaleX: 0 }, 0);
    timeline.fromTo(
      fill,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: beat.duration,
        ease: "none",
        immediateRender: false,
      },
      beat.start,
    );
  }
  root.append(track);

  // The timeline is as long as the film even when its last tween ends early.
  timeline.set({}, {}, input.seconds);
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  return node;
}

/** The on-screen words, one span each, so they can enter word by word. */
function wordLine(
  text: string,
  fontSize: string,
): { element: HTMLElement; words: HTMLElement[] } {
  const line = element("p", {
    margin: "0",
    maxWidth: "84%",
    fontSize,
    fontWeight: "700",
    lineHeight: "1.15",
    textAlign: "center",
    letterSpacing: "-0.01em",
  });
  const words = text.split(/\s+/).map((word) => {
    const span = element("span", { display: "inline-block" });
    span.textContent = word;
    return span;
  });
  words.forEach((span, index) => {
    if (index > 0) line.append(document.createTextNode(" "));
    line.append(span);
  });
  return { element: line, words };
}

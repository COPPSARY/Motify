import { filmFontFaceCss, filmFontsUsedIn } from "./film-fonts";
import type { CompositionContext } from "./types";

/**
 * A raw film is one self-contained HTML document that draws any moment of the
 * film with `window.seek(t)` (the backend's packages/ai/raw-film). Its
 * `timelineJs` is the raw-film marker. The document is mounted in an iframe, so
 * its styles and globals stay its own, and the runtime's timeline is only a
 * clock that calls `seek` on every frame: play, pause, scrubbing and export
 * drive it exactly as they drive any other film.
 */
export { isRawFilm, RAW_FILM_MARKER } from "./raw-film-marker";

/** The iframe a raw film is drawn in, inside the composition root. */
export const RAW_FILM_FRAME_SELECTOR = "iframe[data-motify-raw]";

interface RawFilmWindow extends Window {
  seek?: (time: number) => void;
}

/**
 * The document as the iframe receives it: its <audio> elements taken out (the
 * editor plays them, in step with the timeline) and the bundled faces it names
 * declared, so "Inter" means the same face in the frame as in the editor.
 */
export function prepareRawDocument(html: string): {
  document: string;
  audio: Array<{ src: string; start: string; volume: string }>;
} {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const audio = Array.from(parsed.querySelectorAll("audio")).flatMap(
    (element) => {
      const src = element.getAttribute("src") ?? "";
      element.remove();
      return src
        ? [
            {
              src,
              start: element.dataset["start"] ?? "0",
              volume: element.dataset["volume"] ?? "1",
            },
          ]
        : [];
    },
  );
  const fonts = filmFontsUsedIn(html);
  if (fonts.length > 0) {
    const style = parsed.createElement("style");
    style.dataset["motifyFonts"] = "";
    style.textContent = filmFontFaceCss(fonts);
    parsed.head.prepend(style);
  }
  return {
    document: `<!doctype html>\n${parsed.documentElement.outerHTML}`,
    audio,
  };
}

/**
 * Mounts a raw film into the composition root and hands its clock to the
 * runtime's timeline. The document is written into the frame synchronously
 * when the root is in the page, so `seek` exists before the first frame is
 * asked for; otherwise it loads, and the latest time asked for is drawn then.
 */
export function mountRawFilm(
  context: CompositionContext,
  html: string,
  film: { width: number; height: number; duration: number },
): void {
  const { document: source, audio } = prepareRawDocument(html);
  const frame = document.createElement("iframe");
  frame.dataset["motifyRaw"] = "";
  // No sandbox: the editor must reach into the frame to call seek and to
  // rasterize it, and a sandbox that allows that protects nothing. Template
  // films run their code in the editor's page already.
  frame.setAttribute("scrolling", "no");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = `position:absolute;left:0;top:0;width:${film.width}px;height:${film.height}px;border:0;margin:0;padding:0;overflow:hidden;pointer-events:none;background:transparent`;
  context.root.replaceChildren(frame);

  for (const track of audio) {
    const element = document.createElement("audio");
    element.dataset["motifyAudio"] = "";
    element.dataset["start"] = track.start;
    element.dataset["volume"] = track.volume;
    element.src = track.src;
    element.style.display = "none";
    context.root.append(element);
  }

  let pending = 0;
  let ready = false;
  const draw = (time: number) => {
    pending = time;
    const view = frame.contentWindow as RawFilmWindow | null;
    if (!ready || typeof view?.seek !== "function") return;
    try {
      view.seek(time);
    } catch (error) {
      console.error("Raw film seek failed:", error);
    }
  };
  const doc = frame.contentDocument;
  if (frame.isConnected && doc) {
    doc.open();
    doc.write(source);
    doc.close();
    ready = true;
  } else {
    frame.addEventListener(
      "load",
      () => {
        ready = true;
        draw(pending);
      },
      { once: true },
    );
    frame.srcdoc = source;
  }

  const clock = { t: 0 };
  draw(0);
  context.timeline.fromTo(
    clock,
    { t: 0 },
    {
      t: film.duration,
      duration: film.duration,
      ease: "none",
      immediateRender: false,
      onUpdate: () => draw(clock.t),
    },
    0,
  );
}

/** The raw film's live document inside a mounted composition root, if it is one. */
export function rawFilmDocument(root: ParentNode): Document | null {
  const frame = root.querySelector<HTMLIFrameElement>(RAW_FILM_FRAME_SELECTOR);
  return frame?.contentDocument ?? null;
}

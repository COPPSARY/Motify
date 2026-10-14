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
  motifySoundtrack?: (context: OfflineAudioContext) => void | Promise<void>;
}

const SOUNDTRACK_SAMPLE_RATE = 44_100;

function wavFromAudioBuffer(buffer: AudioBuffer): {
  blob: Blob;
  peak: number;
} {
  const frames = buffer.length;
  const bytes = new Uint8Array(44 + frames * 4);
  const view = new DataView(bytes.buffer);
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + frames * 4, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * 4, true);

  let peak = 0;
  let offset = 44;
  for (let index = 0; index < frames; index += 1) {
    for (const channel of [left, right]) {
      const sample = Math.max(-1, Math.min(1, channel[index] ?? 0));
      peak = Math.max(peak, Math.abs(sample));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += 2;
    }
  }
  return { blob: new Blob([bytes], { type: "audio/wav" }), peak };
}

async function renderSoundtrack(
  view: RawFilmWindow,
  duration: number,
  element: HTMLAudioElement,
): Promise<void> {
  if (
    typeof view.motifySoundtrack !== "function" ||
    typeof OfflineAudioContext === "undefined"
  )
    return;
  const frames = Math.max(1, Math.ceil(duration * SOUNDTRACK_SAMPLE_RATE));
  const context = new OfflineAudioContext(2, frames, SOUNDTRACK_SAMPLE_RATE);
  await view.motifySoundtrack(context);
  const buffer = await context.startRendering();
  const { blob, peak } = wavFromAudioBuffer(buffer);
  const objectUrl = URL.createObjectURL(blob);
  element.dataset["motifyOwnedObjectUrl"] = objectUrl;
  element.src = objectUrl;
  element.load();
  console.info(
    `[Audio] WAV rendered (${buffer.duration.toFixed(2)}s, peak amplitude ${peak.toFixed(4)})`,
  );
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
 * runtime's timeline. The document always loads from srcdoc, inheriting the
 * editor origin without ever navigating to the Railway API origin. Calls into
 * seek and motifySoundtrack wait for the iframe load event.
 */
export function mountRawFilm(
  context: CompositionContext,
  html: string,
  film: { width: number; height: number; duration: number },
): void {
  const { document: source, audio } = prepareRawDocument(html);
  const frame = document.createElement("iframe");
  frame.dataset["motifyRaw"] = "";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
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

  // Normally Railway has already rendered motifySoundtrack into a stored WAV.
  // If that server-side render failed, keep a local track in the same preview
  // and export pipeline rather than leaving the deployed film silent.
  const fallbackAudio =
    audio.length === 0 && /\bmotifySoundtrack\b/.test(source)
      ? document.createElement("audio")
      : null;
  if (fallbackAudio) {
    fallbackAudio.dataset["motifyAudio"] = "";
    fallbackAudio.dataset["start"] = "0";
    fallbackAudio.dataset["volume"] = "1";
    fallbackAudio.preload = "auto";
    fallbackAudio.style.display = "none";
    context.root.append(fallbackAudio);
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
  frame.addEventListener(
    "load",
    () => {
      ready = true;
      const view = frame.contentWindow as RawFilmWindow | null;
      if (typeof view?.motifySoundtrack === "function") {
        console.info("[Audio] motifySoundtrack found");
        if (fallbackAudio) {
          void renderSoundtrack(view, film.duration, fallbackAudio).catch(
            (error: unknown) => {
              console.error("[Audio] soundtrack render failed", error);
            },
          );
        }
      } else if (fallbackAudio) {
        console.warn("[Audio] motifySoundtrack missing after iframe load");
      }
      draw(pending);
    },
    { once: true },
  );
  frame.srcdoc = source;

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

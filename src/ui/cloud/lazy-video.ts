/**
 * A preview video that downloads and plays only near the screen.
 *
 * A gallery of autoplaying videos otherwise fetches every file at once and keeps
 * decoding the ones scrolled out of sight. Here a video gets its `src` the first
 * time it comes within a screen's reach, plays while it is there, and pauses when
 * it leaves. With reduced motion it shows its first frame and plays only while
 * its card is hovered or focused.
 */

/** How far outside the viewport a video starts loading, so it is ready on arrival. */
const NEAR = "400px 0px";

type Visibility = (visible: boolean) => void;

let observer: IntersectionObserver | null = null;
const watchers = new WeakMap<Element, Visibility>();

/** One observer for every preview, rather than one each. */
function watch(video: HTMLVideoElement, onChange: Visibility): () => void {
  if (typeof IntersectionObserver === "undefined") {
    // No observer (old browsers, tests): behave like a plain autoplaying video.
    onChange(true);
    return () => undefined;
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        watchers.get(entry.target)?.(entry.isIntersecting);
    },
    { rootMargin: NEAR },
  );
  watchers.set(video, onChange);
  observer.observe(video);
  return () => {
    observer?.unobserve(video);
    watchers.delete(video);
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

export function lazyVideo(video: HTMLVideoElement, src: string) {
  let source = src;
  let near = false;
  let hovered = false;
  const calm = prefersReducedMotion();

  const markReady = () => (video.dataset["ready"] = "true");
  video.addEventListener("loadeddata", markReady);

  function load() {
    if (video.getAttribute("src") === source) return;
    delete video.dataset["ready"];
    // Reduced motion still wants the first frame on screen, not a black box.
    video.preload = calm ? "metadata" : "auto";
    video.src = source;
  }

  function update() {
    if (near) load();
    const play = near && (!calm || hovered);
    if (play && video.paused) void video.play().catch(() => undefined);
    else if (!play && !video.paused) video.pause();
  }

  const stop = watch(video, (visible) => {
    near = visible;
    update();
  });

  const card = video.closest<HTMLElement>("button, a") ?? video;
  const enter = () => {
    hovered = true;
    update();
  };
  const leave = () => {
    hovered = false;
    update();
  };
  if (calm) {
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("focus", enter);
    card.addEventListener("blur", leave);
  }

  return {
    update(next: string) {
      if (next === source) return;
      source = next;
      if (near) update();
      else video.removeAttribute("src");
    },
    destroy() {
      stop();
      video.removeEventListener("loadeddata", markReady);
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("focus", enter);
      card.removeEventListener("blur", leave);
    },
  };
}

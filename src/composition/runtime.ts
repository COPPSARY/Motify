import gsap from "gsap";
import type {
  AnimationOverride,
  CompositionDefinition,
  ElementOverride,
  RuntimeEditorState,
  RuntimeSnapshot,
  TweenDescriptor,
  TweenOverride,
} from "./types";

export type RuntimeListener = (snapshot: RuntimeSnapshot) => void;

export class CompositionRuntime {
  readonly timeline: gsap.core.Timeline;
  readonly elements = new Map<string, HTMLElement>();
  private readonly context: gsap.Context;
  private readonly listeners = new Set<RuntimeListener>();
  private readonly overrides = new Map<string, ElementOverride>();
  private readonly animationOverrides = new Map<
    string,
    Pick<AnimationOverride, "speed" | "ease">
  >();
  private readonly tweenOverrides = new Map<string, TweenOverride>();
  private readonly tweenIds = new WeakMap<gsap.core.Tween, string>();
  private readonly tweenBaselines = new WeakMap<
    gsap.core.Tween,
    {
      timeScale: number;
      ease: gsap.EaseString | gsap.EaseFunction | undefined;
      start: number;
      duration: number;
    }
  >();
  private playing = false;
  /** Whether the mounted film sits on the scene kit's living ground. */
  private hasKitGround: boolean | undefined;
  private groundProgress = "";
  private lastPlaybackNotification = 0;

  constructor(
    readonly definition: CompositionDefinition,
    readonly root: HTMLElement,
  ) {
    // Editor playback follows wall-clock time. Deterministic export and scrubbing
    // use explicit seeks, so silently slowing the live timeline after a heavy
    // render frame only makes the preview feel disconnected from its playhead.
    gsap.ticker.lagSmoothing(0);
    root.replaceChildren();
    root.classList.add("composition-root");
    root.style.width = `${definition.width}px`;
    root.style.height = `${definition.height}px`;
    this.timeline = gsap.timeline({
      paused: true,
      smoothChildTiming: true,
      onUpdate: () => {
        this.applyOverrides();
        this.emitPlaybackFrame();
      },
      onComplete: () => {
        this.playing = false;
        this.emit();
      },
    });
    this.context = gsap.context(() => {
      definition.build({
        root,
        element: root,
        container: root,
        timeline: this.timeline,
        register: (first: unknown, second?: unknown) => {
          const targetId: string =
            typeof first === "string"
              ? first
              : typeof second === "string"
                ? second
                : "";
          const targetEl: HTMLElement | null =
            first && typeof first === "object" && "dataset" in first
              ? (first as HTMLElement)
              : second && typeof second === "object" && "dataset" in second
                ? (second as HTMLElement)
                : null;
          if (targetEl) {
            if (targetId) {
              targetEl.dataset["motionlyId"] = targetId;
              this.elements.set(targetId, targetEl);
            }
            return targetEl;
          }
          return (first as HTMLElement) || root;
        },
      });
      if (this.timeline.duration() < definition.duration) {
        this.timeline.to(
          {},
          { duration: definition.duration - this.timeline.duration() },
        );
      }
    }, root);
    this.seek(0);
    // `totalTime(t)` is a no-op when the playhead already sits at `t`, so
    // nothing renders. A timeline is built at 0 and seeked to 0, which means
    // every zero-duration `set()` authored at position 0 — the whole opening
    // state of a composition: centring, hidden layers, start transforms — was
    // never flushed, and the first frame showed unposed elements at their raw
    // CSS defaults until the playhead moved. Force that one render.
    //
    // Only the origin needs it, and only once. Seeking back to 0 from any
    // later time renders normally, and forcing on every seek would re-resolve
    // relative ("+=") tweens and make repeated seeks drift.
    this.timeline.render(0, false, true);
  }

  play(): void {
    if (this.time >= this.definition.duration - 1 / this.definition.fps)
      this.seek(0);
    // A range input can issue many forward and reverse seeks before Play.
    // Re-render the exact current frame before unpausing so GSAP flushes every
    // nested timeline/set from that scrub position instead of resuming from a
    // partially evaluated lazy render.
    const resumeTime = this.time;
    this.timeline.pause();
    this.timeline.totalTime(resumeTime, false);
    this.applyOverrides();
    this.playing = true;
    this.timeline.reversed(false).paused(false);
    this.emit();
  }

  pause(): void {
    this.playing = false;
    this.timeline.pause();
    this.emit();
  }

  restart(): void {
    this.playing = true;
    this.timeline.restart();
    this.emit();
  }

  seek(time: number): void {
    const frame = Math.round(
      Math.max(0, Math.min(this.definition.duration, time)) *
        this.definition.fps,
    );
    const frameTime = frame / this.definition.fps;
    this.timeline.pause();
    // GSAP set/from tweens can retain a later rendered value after a large
    // reverse jump. Re-render the origin first so every scene and child is
    // reconstructed from the authored timeline before applying the new frame.
    if (frameTime < this.timeline.totalTime()) {
      this.timeline.totalTime(0, false);
    }
    this.timeline.totalTime(frameTime, false);
    this.playing = false;
    this.applyOverrides();
    this.emit();
  }

  setOverride(id: string, patch: ElementOverride): void {
    this.overrides.set(id, { ...this.overrides.get(id), ...patch });
    this.applyOverrides();
    this.emit();
  }

  getOverride(id: string): ElementOverride {
    return { ...this.overrides.get(id) };
  }

  getAnimationOverride(id: string): AnimationOverride {
    const override = this.animationOverrides.get(id);
    return {
      speed: override?.speed ?? 1,
      ease: override?.ease ?? "power3.inOut",
      tweenCount: this.elementTweens(id).length,
    };
  }

  setAnimationOverride(
    id: string,
    patch: Partial<Pick<AnimationOverride, "speed" | "ease">>,
  ): void {
    const current = this.getAnimationOverride(id);
    const next = {
      speed: Math.max(0.25, Math.min(2, patch.speed ?? current.speed)),
      ease: patch.ease ?? current.ease,
    };
    this.animationOverrides.set(id, next);
    for (const tween of this.elementTweens(id)) {
      const baseline = this.tweenBaseline(tween);
      tween.timeScale(baseline.timeScale * next.speed);
      const tweenId = this.tweenId(
        id,
        tween,
        this.elementTweens(id).indexOf(tween),
      );
      tween.vars.ease = this.tweenOverrides.get(tweenId)?.ease ?? next.ease;
      tween.invalidate();
    }
    this.seek(this.time);
  }

  getTweenDescriptors(id: string): TweenDescriptor[] {
    return this.elementTweens(id).map((tween, index) => {
      const tweenId = this.tweenId(id, tween, index);
      const vars = tween.vars as Record<string, unknown>;
      const ignored = new Set([
        "duration",
        "ease",
        "delay",
        "overwrite",
        "stagger",
        "onStart",
        "onUpdate",
        "onComplete",
        "immediateRender",
        "id",
      ]);
      const properties = Object.keys(vars).filter((key) => !ignored.has(key));
      const start = this.globalTweenStart(tween);
      const duration = tween.duration();
      return {
        id: tweenId,
        targetId: id,
        properties,
        start,
        duration,
        end: start + duration,
        ease: String(vars["ease"] ?? "power3.inOut"),
      };
    });
  }

  setTweenOverride(id: string, tweenId: string, patch: TweenOverride): void {
    const tweens = this.elementTweens(id);
    const tween = tweens.find(
      (candidate, index) => this.tweenId(id, candidate, index) === tweenId,
    );
    if (!tween) return;
    const baseline = this.tweenBaseline(tween);
    const current = this.tweenOverrides.get(tweenId) ?? {};
    const next: TweenOverride = {
      ...current,
      ...patch,
    };
    if (next.start !== undefined) {
      next.start = Math.max(0, Math.min(this.definition.duration, next.start));
      tween.startTime(next.start);
    } else {
      tween.startTime(baseline.start);
    }
    if (next.duration !== undefined) {
      const maximum = Math.max(
        1 / this.definition.fps,
        this.definition.duration - (next.start ?? this.globalTweenStart(tween)),
      );
      next.duration = Math.max(
        1 / this.definition.fps,
        Math.min(maximum, next.duration),
      );
      tween.duration(next.duration);
    } else {
      tween.duration(baseline.duration);
    }
    if (next.ease !== undefined) tween.vars.ease = next.ease;
    tween.invalidate();
    this.tweenOverrides.set(tweenId, next);
    this.seek(this.time);
  }

  exportEditorState(): RuntimeEditorState {
    return {
      elements: Object.fromEntries(
        [...this.overrides].map(([id, value]) => [id, { ...value }]),
      ),
      animations: Object.fromEntries(
        [...this.animationOverrides].map(([id, value]) => [id, { ...value }]),
      ),
      tweens: Object.fromEntries(
        [...this.tweenOverrides].map(([id, value]) => [id, { ...value }]),
      ),
    };
  }

  importEditorState(state?: Partial<RuntimeEditorState>): void {
    if (!state) return;
    for (const [id, override] of Object.entries(state.elements ?? {})) {
      this.overrides.set(id, { ...override });
    }
    for (const [id, override] of Object.entries(state.animations ?? {})) {
      this.setAnimationOverride(id, override);
    }
    for (const [tweenId, override] of Object.entries(state.tweens ?? {})) {
      const targetId = tweenId.split(":tween")[0] ?? "";
      this.setTweenOverride(targetId, tweenId, override);
    }
    this.applyOverrides();
    this.seek(this.time);
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.timeline.kill();
    this.context.revert();
    this.listeners.clear();
    this.elements.clear();
    this.root.replaceChildren();
    this.root.classList.remove("composition-root");
  }

  get time(): number {
    return Math.min(this.definition.duration, this.timeline.time());
  }

  get snapshot(): RuntimeSnapshot {
    const scene = [...this.definition.scenes]
      .reverse()
      .find((candidate) => this.time >= candidate.start);
    return {
      time: this.time,
      playing: this.playing,
      sceneId: scene?.id ?? this.definition.scenes[0]?.id ?? "",
    };
  }

  private applyOverrides(): void {
    /**
     * Film progress, 0 to 1, for layers that are a function of time rather than
     * tweens — the scene kit's ground drifts, rises and sweeps on it. Written
     * here because this runs on every seek and every playback frame, so the
     * light scrubs and exports exactly like the timeline. It is deliberately not
     * a tween: a tween on the root would count as authored motion, extending the
     * film's measured end and masking a timeline that genuinely stops early.
     */
    // Only for films on the kit ground, and only when the value moves: a style
    // write on the root invalidates the whole subtree's computed styles, and
    // this runs several times per seek.
    if (this.hasKitGround === undefined && this.root.firstElementChild) {
      this.hasKitGround = this.root.querySelector(".mk-stage") !== null;
    }
    if (this.hasKitGround) {
      const duration = this.definition.duration;
      const progress = (
        duration > 0
          ? Math.min(1, Math.max(0, this.timeline.time() / duration))
          : 0
      ).toFixed(4);
      if (progress !== this.groundProgress) {
        this.groundProgress = progress;
        this.root.style.setProperty("--mk-t", progress);
      }
    }
    for (const [id, override] of this.overrides) {
      const element = this.elements.get(id);
      if (!element) continue;
      if (override.text !== undefined)
        this.applyTextOverride(element, override.text);
      this.applyVisualOverride(element, override);
    }
  }

  private applyVisualOverride(
    element: HTMLElement,
    override: ElementOverride,
  ): void {
    // Editor transforms intentionally use the independent CSS transform
    // properties. GSAP keeps ownership of `transform`, so authored entrances,
    // camera moves, and exits continue to render after a visual edit.
    if (override.x !== undefined || override.y !== undefined) {
      element.style.translate = `${override.x ?? 0}px ${override.y ?? 0}px`;
    }
    if (override.scale !== undefined)
      element.style.scale = String(override.scale);
    if (override.rotation !== undefined)
      element.style.rotate = `${override.rotation}deg`;
    if (override.opacity !== undefined)
      element.style.opacity = String(override.opacity);
    if (override.color !== undefined) element.style.color = override.color;
    if (override.backgroundColor !== undefined)
      element.style.backgroundColor = override.backgroundColor;
    if (override.fill !== undefined) element.style.fill = override.fill;
    if (override.stroke !== undefined) element.style.stroke = override.stroke;
    if (override.fontSize !== undefined)
      element.style.fontSize = `${override.fontSize}px`;
    if (override.borderRadius !== undefined)
      element.style.borderRadius = `${override.borderRadius}px`;
    if (override.hidden !== undefined)
      element.style.visibility = override.hidden ? "hidden" : "";
  }

  private elementTweens(id: string): gsap.core.Tween[] {
    const element = this.elements.get(id);
    if (!element) return [];
    const targets = [element, ...Array.from(element.querySelectorAll("*"))];
    return Array.from(new Set(this.timeline.getTweensOf(targets))).filter(
      (tween) => tween.duration() > 0,
    );
  }

  private tweenBaseline(tween: gsap.core.Tween) {
    let baseline = this.tweenBaselines.get(tween);
    if (!baseline) {
      baseline = {
        timeScale: tween.timeScale(),
        ease: tween.vars.ease,
        start: tween.startTime(),
        duration: tween.duration(),
      };
      this.tweenBaselines.set(tween, baseline);
    }
    return baseline;
  }

  private tweenId(id: string, tween: gsap.core.Tween, index: number): string {
    const authoredId =
      typeof tween.vars.id === "string" ? tween.vars.id.trim() : "";
    const existing = this.tweenIds.get(tween);
    const value =
      existing ||
      (authoredId ? `${id}:tween:${authoredId}` : `${id}:tween-${index + 1}`);
    this.tweenIds.set(tween, value);
    return value;
  }

  private globalTweenStart(tween: gsap.core.Tween): number {
    return Math.max(0, tween.startTime());
  }

  private applyTextOverride(element: HTMLElement, value: string): void {
    const unit = element.dataset["motionlySplitUnit"];
    if (unit !== "words" && unit !== "chars") {
      element.textContent = value;
      return;
    }

    const pieces = unit === "words" ? value.split(/(\s+)/) : Array.from(value);
    const spans = Array.from(element.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    if (!spans.length) {
      element.textContent = value;
      return;
    }

    spans.forEach((span, index) => {
      span.textContent = pieces[index] ?? "";
    });
    if (pieces.length > spans.length) {
      const tail = pieces.slice(spans.length).join("");
      const last = spans.at(-1);
      if (last) last.textContent = `${last.textContent ?? ""}${tail}`;
    }
  }

  private emit(): void {
    const snapshot = this.snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  private emitPlaybackFrame(): void {
    const now = globalThis.performance?.now() ?? Date.now();
    if (now - this.lastPlaybackNotification < 40) return;
    this.lastPlaybackNotification = now;
    this.emit();
  }
}

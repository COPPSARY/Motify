export type SceneTrackKind =
  "Text" | "Element" | "SVG" | "Background" | "Camera";

export interface SceneTrack {
  id: string;
  label: string;
  kind: SceneTrackKind;
  start: number;
  end: number;
}

export interface SceneDefinition {
  id: string;
  label: string;
  start: number;
  duration: number;
  accent: string;
  tracks?: readonly SceneTrack[];
}

export interface CompositionContext {
  root: HTMLElement;
  element: HTMLElement;
  container: HTMLElement;
  timeline: gsap.core.Timeline;
  /**
   * The size the film is mounted at. For a fixed film this is its authored
   * size; for an adaptive one it is the output canvas, so a timeline can
   * compute positions from it instead of assuming 1920x1080.
   */
  width: number;
  height: number;
  orientation: "landscape" | "square" | "portrait";
  register(id: string, element: HTMLElement): HTMLElement;
}

export interface CompositionDefinition {
  id: string;
  title: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  scenes: readonly SceneDefinition[];
  sourcePreview: string;
  /**
   * The film lays itself out for any canvas (relative units, container
   * queries, timeline positions from `context.width/height`). It is mounted
   * at the canvas size and rebuilt when the aspect changes, instead of being
   * scaled or cropped into it.
   */
  adaptive?: boolean;
  build(context: CompositionContext): void;
}

export interface ElementOverride {
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  text?: string;
  color?: string;
  backgroundColor?: string;
  fill?: string;
  stroke?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  letterSpacing?: number;
  lineHeight?: number;
  borderRadius?: number;
  hidden?: boolean;
}

export type EditorFieldType =
  "text" | "number" | "color" | "image" | "select" | "range" | "toggle";

export type EditorFieldBinding =
  "text" | "style" | "attribute" | "css-variable";

export interface EditorFieldDefinition {
  id: string;
  label: string;
  type: EditorFieldType;
  binding: EditorFieldBinding;
  target: HTMLElement;
  property?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: readonly string[];
}

export interface EditorGroupDefinition {
  id: string;
  label: string;
  element: HTMLElement;
  explicit: boolean;
  fields: readonly EditorFieldDefinition[];
  allowTransform: boolean;
  allowAppearance: boolean;
}

export interface TweenDescriptor {
  id: string;
  targetId: string;
  properties: readonly string[];
  start: number;
  duration: number;
  end: number;
  ease: string;
}

export interface TweenOverride {
  start?: number;
  duration?: number;
  ease?: string;
}

export interface RuntimeEditorState {
  /** Output canvas; omitted for the authored 16:9 canvas. */
  canvas?: { aspect: string; framing: string };
  elements: Record<string, ElementOverride>;
  animations: Record<string, Pick<AnimationOverride, "speed" | "ease">>;
  tweens: Record<string, TweenOverride>;
}

export interface AnimationOverride {
  speed: number;
  ease: string;
  tweenCount: number;
}

export interface RuntimeSnapshot {
  time: number;
  playing: boolean;
  sceneId: string;
}

export function defineComposition<const T extends CompositionDefinition>(
  definition: T,
): T {
  return definition;
}

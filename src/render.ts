import "@fontsource-variable/inter";
import { CompositionRuntime } from "./composition/runtime";
import { kiriTtsPreset as demoComposition } from "./compositions/presets";

interface MotionlyRenderBridge {
  metadata: {
    id: string;
    width: number;
    height: number;
    fps: number;
    duration: number;
  };
  seek(time: number): Promise<void>;
}

declare global {
  interface Window {
    motionlyRender?: MotionlyRenderBridge;
  }
}

const root = document.querySelector<HTMLElement>("#render-root");
if (!root) throw new Error("Motify render root was not found.");

Object.assign(document.documentElement.style, {
  width: `${demoComposition.width}px`,
  height: `${demoComposition.height}px`,
  overflow: "hidden",
  background: "#07070a",
});
Object.assign(document.body.style, {
  width: `${demoComposition.width}px`,
  height: `${demoComposition.height}px`,
  margin: "0",
  overflow: "hidden",
  background: "#07070a",
});

const runtime = new CompositionRuntime(demoComposition, root);

async function settleAssets(): Promise<void> {
  await document.fonts.ready;
  await Promise.all(
    Array.from(document.images, (image) =>
      image.complete
        ? Promise.resolve()
        : image.decode().catch(() => undefined),
    ),
  );
}

await settleAssets();
window.motionlyRender = {
  metadata: {
    id: demoComposition.id,
    width: demoComposition.width,
    height: demoComposition.height,
    fps: demoComposition.fps,
    duration: demoComposition.duration,
  },
  async seek(time): Promise<void> {
    runtime.seek(time);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  },
};

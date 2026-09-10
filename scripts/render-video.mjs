import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import puppeteer from "puppeteer-core";
import { createServer } from "vite";

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function firstExecutable(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known browser location.
    }
  }
  return undefined;
}

function browserCandidates() {
  if (process.platform === "win32") {
    return [
      process.env.MOTIONLY_CHROME,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
  }
  if (process.platform === "darwin") {
    return [
      process.env.MOTIONLY_CHROME,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  }
  return [
    process.env.MOTIONLY_CHROME,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
}

function waitForProcess(child) {
  return new Promise((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`FFmpeg exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function writeFrame(stream, frame) {
  if (stream.write(frame)) return;
  await new Promise((resolvePromise) => stream.once("drain", resolvePromise));
}

const output = resolve(argument("output", "motionly-product-promo.mp4"));
const requestedFps = Number(argument("fps", "0"));
const requestedDuration = Number(argument("duration", "0"));
const scale = Number(argument("scale", "1"));
const ffmpeg = argument("ffmpeg", process.env.MOTIONLY_FFMPEG ?? "ffmpeg");
const executablePath = await firstExecutable(browserCandidates());

if (!executablePath) {
  throw new Error(
    "Chrome or Edge was not found. Set MOTIONLY_CHROME to the browser executable.",
  );
}
if (!Number.isFinite(scale) || scale <= 0)
  throw new Error("--scale must be a positive number.");

await mkdir(dirname(output), { recursive: true });
const server = await createServer({
  logLevel: "error",
  // An export must keep its mounted scene for the entire frame sequence.
  // Editor saves or registry builds must not trigger a mid-export navigation.
  server: {
    host: "127.0.0.1",
    port: 0,
    strictPort: false,
    hmr: false,
    watch: null,
  },
});
let browser;
let encoder;

try {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string")
    throw new Error("The Motionly render server did not expose a port.");

  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--hide-scrollbars", "--disable-background-timer-throttling"],
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/render.html`, {
    waitUntil: "networkidle0",
  });
  await page.waitForFunction(() => window.motionlyRender !== undefined);

  const metadata = await page.evaluate(() => window.motionlyRender?.metadata);
  if (!metadata)
    throw new Error("The composition render bridge did not start.");
  const fps = requestedFps > 0 ? requestedFps : metadata.fps;
  const duration =
    requestedDuration > 0
      ? Math.min(requestedDuration, metadata.duration)
      : metadata.duration;
  const frameCount = Math.ceil(duration * fps);
  await page.setViewport({
    width: metadata.width,
    height: metadata.height,
    deviceScaleFactor: scale,
  });

  encoder = spawn(
    ffmpeg,
    [
      "-y",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "-framerate",
      String(fps),
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      output,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const encoded = waitForProcess(encoder);

  for (let frame = 0; frame < frameCount; frame += 1) {
    await page.evaluate(async ({ time }) => window.motionlyRender?.seek(time), {
      time: frame / fps,
    });
    const png = await page.screenshot({
      type: "png",
      captureBeyondViewport: false,
    });
    await writeFrame(encoder.stdin, png);
    if (frame % Math.max(1, Math.round(fps)) === 0)
      process.stdout.write(`Rendered ${frame + 1}/${frameCount} frames\r`);
  }

  encoder.stdin.end();
  await encoded;
  process.stdout.write(
    `Rendered ${frameCount}/${frameCount} frames\n${output}\n`,
  );
} finally {
  if (encoder && encoder.exitCode === null) encoder.kill();
  await browser?.close();
  await server.close();
}

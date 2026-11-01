// Renders and checks a raw film: one HTML document drawn by window.seek(t).
//
//   npm run raw-film -- <film.html> <mode> [--fps 60] [--out dir]
//
// Modes:
//   audio   render window.motifySoundtrack to <out>/film.wav and report peak, clipping and RMS
//   export  draw frames through the export path (the document serialized into an SVG
//           foreignObject, fonts inlined) beside live frames, into <out>/export/
//   cost    time every frame at 30fps the way real-time playback sees it
//   video   render <out>/film.mp4 at --fps (default 60), with film.wav when it exists
//   still   on film.mp4, find frames that barely change from the one before
//
// The film is served with the bundled faces it names declared, as the editor declares them.
// Needs Chrome or Edge (or MOTIONLY_CHROME) and ffmpeg on PATH for video and still.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer-core";

const FONTS = {
  "Inter": "inter/files/inter-latin-wght-normal.woff2",
  "Plus Jakarta Sans": "plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  "Space Grotesk": "space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
  "Fraunces": "fraunces/files/fraunces-latin-wght-normal.woff2",
  "JetBrains Mono": "jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  "Oswald": "oswald/files/oswald-latin-wght-normal.woff2",
};
const CHROME = [
  process.env.MOTIONLY_CHROME,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const [filmArg, mode] = process.argv.slice(2).filter((arg, i, all) => !arg.startsWith("--") && !(all[i - 1] ?? "").startsWith("--"));
if (!filmArg || !["audio", "export", "cost", "video", "still"].includes(mode)) {
  console.error("Usage: npm run raw-film -- <film.html> <audio|export|cost|video|still> [--fps 60] [--out dir]");
  process.exit(1);
}
const film = path.resolve(filmArg);
const out = path.resolve(option("out", path.dirname(film)));
const fps = Number(option("fps", "60"));
mkdirSync(out, { recursive: true });
const mp4 = path.join(out, "film.mp4"), wav = path.join(out, "film.wav");

if (mode === "still") {
  stillReport();
  process.exit(0);
}

const resolveModule = createRequire(import.meta.url).resolve;
const source = readFileSync(film, "utf8");
const used = Object.keys(FONTS).filter((family) => new RegExp(`(?<![A-Za-z])${family.replace(/ /g, "\\s+")}(?![A-Za-z])`, "i").test(source));
const faces = used.map((family) => `@font-face{font-family:"${family}";font-display:block;font-weight:100 900;src:url(/__fonts/${FONTS[family]}) format("woff2")}`).join("");
const document_html = faces ? source.replace(/<head[^>]*>/i, (head) => `${head}<style data-motify-fonts>${faces}</style>`) : source;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (url === "/film.html") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(document_html); return; }
  const file = url.startsWith("/__fonts/") ? resolveModule(`@fontsource-variable/${url.slice(9)}`) : path.join(path.dirname(film), url);
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": file.endsWith(".woff2") ? "font/woff2" : "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const executablePath = CHROME.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error("Chrome or Edge was not found. Set MOTIONLY_CHROME to the browser executable.");
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/film.html`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const size = await page.evaluate(() => ({ width: document.body.offsetWidth || 1920, height: document.body.offsetHeight || 1080 }));
  await page.setViewport({ ...size, deviceScaleFactor: 1 });
  const duration = await page.evaluate(() => window.DURATION);
  if (typeof duration !== "number") throw new Error("window.DURATION is not set.");

  if (mode === "audio") await audio(page, duration);
  if (mode === "export") await exportParity(page, duration, size);
  if (mode === "cost") await cost(page, duration);
  if (mode === "video") await video(page, duration);
} finally {
  await browser.close();
  server.close();
  if (errors.length) console.log("Page errors:", errors.slice(0, 5).join(" | "));
}

async function audio(page, duration) {
  const result = await page.evaluate(async (duration) => {
    if (typeof window.motifySoundtrack !== "function") return null;
    const SR = 44100, context = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
    await window.motifySoundtrack(context);
    const buffer = await context.startRendering();
    const L = buffer.getChannelData(0), R = buffer.getChannelData(1);
    let peak = 0, clipped = 0; const rms = [], win = Math.floor(SR / 2);
    for (let i = 0; i < L.length; i += win) {
      let sum = 0; const end = Math.min(L.length, i + win);
      for (let j = i; j < end; j++) { const v = Math.max(Math.abs(L[j]), Math.abs(R[j])); peak = Math.max(peak, v); if (v >= 0.999) clipped++; sum += (L[j] * L[j] + R[j] * R[j]) / 2; }
      rms.push(+(10 * Math.log10(sum / (end - i) + 1e-12)).toFixed(1));
    }
    const bytes = new Uint8Array(44 + L.length * 4), view = new DataView(bytes.buffer);
    const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    text(0, "RIFF"); view.setUint32(4, 36 + L.length * 4, true); text(8, "WAVE"); text(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, SR, true);
    view.setUint32(28, SR * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, L.length * 4, true);
    let offset = 44;
    for (let i = 0; i < L.length; i++) for (const channel of [L, R]) { const v = Math.max(-1, Math.min(1, channel[i])); view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true); offset += 2; }
    let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { wav: btoa(binary), peak, clipped, rms };
  }, duration);
  if (!result) { console.log("The film declares no window.motifySoundtrack."); return; }
  writeFileSync(wav, Buffer.from(result.wav, "base64"));
  console.log(`peak ${(20 * Math.log10(result.peak)).toFixed(1)} dBFS, ${result.clipped} clipped samples`);
  console.log(`RMS per half second (dB): ${result.rms.join(" ")}`);
  const loudness = spawnSync("ffmpeg", ["-hide_banner", "-i", wav, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8" });
  const integrated = /I:\s+(-?[\d.]+) LUFS/.exec(loudness.stderr ?? "");
  if (integrated) console.log(`integrated loudness ${integrated[1]} LUFS (aim for about -16)`);
  console.log(`wrote ${wav}`);
}

async function exportParity(page, duration, size) {
  const dir = path.join(out, "export"); mkdirSync(dir, { recursive: true });
  const times = Array.from({ length: 12 }, (_, i) => +((duration * (i + 0.5)) / 12).toFixed(2));
  for (const time of times) {
    await page.evaluate((t) => window.seek(t), time);
    await page.screenshot({ path: path.join(dir, `live_${time}.png`) });
    const png = await page.evaluate(async ({ width, height }) => {
      const inline = async (css) => {
        for (const match of [...css.matchAll(/url\((\/__fonts\/[^)]+)\)/g)]) {
          const blob = await (await fetch(match[1])).blob();
          const data = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
          css = css.replace(match[1], data);
        }
        return css;
      };
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll("script, audio, noscript").forEach((node) => node.remove());
      for (const style of clone.querySelectorAll("style[data-motify-fonts]")) style.textContent = await inline(style.textContent);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`;
      const image = new Image(); image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.toDataURL("image/png").split(",")[1];
    }, size);
    writeFileSync(path.join(dir, `export_${time}.png`), Buffer.from(png, "base64"));
  }
  console.log(`wrote ${times.length} live/export pairs to ${dir}: compare each pair`);
}

async function cost(page, duration) {
  const pass = () => page.evaluate(async (duration) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const slow = [];
    for (let i = 0; i <= duration * 30; i++) { const start = performance.now(); window.seek(i / 30); await frame(); await frame(); const ms = performance.now() - start; if (ms > 40) slow.push(`${(i / 30).toFixed(2)}s ${ms.toFixed(0)}ms`); }
    return slow;
  }, duration);
  const first = await pass(), second = await pass();
  console.log(`first pass: ${first.length} slow frames ${first.slice(0, 12).join(", ")}`);
  console.log(`second pass: ${second.length} slow frames ${second.slice(0, 12).join(", ")}`);
  console.log("Headless Chrome draws on the CPU, so these run slower than a GPU browser; look at where the spikes are.");
}

async function video(page, duration) {
  const args = ["-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "pipe:0"];
  if (existsSync(wav)) args.push("-i", wav);
  args.push("-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-r", String(fps));
  if (existsSync(wav)) args.push("-c:a", "aac", "-b:a", "192k", "-shortest");
  args.push("-movflags", "+faststart", mp4);
  const encoder = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  let log = ""; encoder.stderr.on("data", (chunk) => { log = (log + chunk).slice(-3000); });
  const done = new Promise((resolve, reject) => encoder.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${log}`)))));
  const frames = Math.round(duration * fps);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.seek(t), i / fps);
    const jpeg = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!encoder.stdin.write(jpeg)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
    if (i % (fps * 2) === 0) console.log(`frame ${i}/${frames}`);
  }
  encoder.stdin.end();
  await done;
  console.log(`wrote ${mp4}${existsSync(wav) ? " with film.wav" : " (no sound: run the audio mode first)"}`);
}

function stillReport() {
  if (!existsSync(mp4)) { console.error(`No ${mp4}: run the video mode first.`); process.exit(1); }
  const metrics = path.join(out, "frame-diff.txt");
  const run = spawnSync("ffmpeg", ["-v", "error", "-i", mp4, "-vf", "tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=frame-diff.txt", "-an", "-f", "null", "-"], { encoding: "utf8", cwd: out });
  if (run.status !== 0) { console.error(run.stderr); process.exit(1); }
  const frames = []; let time = 0;
  for (const line of readFileSync(metrics, "utf8").split(/\r?\n/)) {
    const pts = /pts_time:([\d.]+)/.exec(line); if (pts) time = +pts[1];
    const value = /YAVG=([\d.]+)/.exec(line); if (value) frames.push([time, +value[1]]);
  }
  const still = frames.filter(([, v]) => v < 0.05);
  const runs = []; let current = null;
  for (const [t, v] of frames) { if (v < 0.15) { current = current ? [current[0], t] : [t, t]; } else if (current) { runs.push(current); current = null; } }
  if (current) runs.push(current);
  const slow = runs.filter(([a, b]) => b - a >= 0.05).map(([a, b]) => `${a.toFixed(2)}-${b.toFixed(2)}s`);
  const sorted = frames.map(([, v]) => v).sort((a, b) => a - b);
  console.log(`${frames.length} frame pairs; smallest change ${sorted[0]?.toFixed(3)}, median ${sorted[Math.floor(sorted.length / 2)]?.toFixed(2)}`);
  console.log(`still frames (change under 0.05): ${still.length}${still.length ? " at " + still.slice(0, 10).map(([t]) => `${t.toFixed(2)}s`).join(", ") : ""}`);
  console.log(`very slow stretches (under 0.15): ${slow.length ? slow.join(", ") : "none"}`);
}

// Checks that each motion primitive exports exactly as it previews: every fixture
// film is mounted in headless Chromium, and at several moments the live DOM
// (a page screenshot, which is the preview) is compared with the export
// rasterizer's frame. Anything that differs must not be offered to the model.
//
//   node scripts/build-render-kit.mjs && node scripts/check-export-parity.mjs [chromePath]
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kit = await readFile(join(root, "dist-render-kit/motify-render-kit.js"), "utf8");

/** Share of pixels allowed to differ by more than the anti-aliasing tolerance. */
const MAX_DIFF = 0.005;
const CHANNEL_TOLERANCE = 48;

const stage = (body, style = "") => `<template><style>.t{position:absolute;margin:0;font-family:Inter;font-weight:700;color:#111}${style}</style><main class="mk-stage" style="background:#f3efe6;color:#111" data-edit="stage"><section data-scene="s1" data-edit="s1">${body}</section></main></template>`;
const fixtures = [
  {
    name: "baseline type and transforms",
    html: stage(`<h1 class="t" data-edit="a" style="left:160px;top:380px;font-size:150px">Pick your seat.</h1>`),
    js: `export function buildTimeline({ root, timeline }) { const a = root.querySelector('[data-edit="a"]'); timeline.fromTo(a, { x: 0, rotation: 0 }, { x: 300, rotation: 6, duration: 2, ease: 'none' }, 0); }`,
  },
  {
    name: "DrawSVGPlugin",
    html: stage(`<svg width="1920" height="1080" style="position:absolute;inset:0"><path data-edit="p" d="M160 900 C600 700 900 980 1400 600 S1800 300 1760 200" fill="none" stroke="#d4421e" stroke-width="12"/></svg>`),
    js: `export function buildTimeline({ root, timeline }) { const p = root.querySelector('[data-edit="p"]'); timeline.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: 2, ease: 'none' }, 0); }`,
  },
  {
    name: "MorphSVGPlugin",
    html: stage(`<svg width="1920" height="1080" style="position:absolute;inset:0"><path data-edit="m" d="M760 340 L1160 340 L1160 740 L760 740 Z" fill="#d4421e"/><path data-edit="target" d="M960 300 C1100 300 1200 400 1200 540 C1200 680 1100 780 960 780 C820 780 720 680 720 540 C720 400 820 300 960 300 Z" fill="none"/></svg>`),
    js: `export function buildTimeline({ root, timeline }) { const m = root.querySelector('[data-edit="m"]'); timeline.to(m, { morphSVG: root.querySelector('[data-edit="target"]'), duration: 2, ease: 'none' }, 0); }`,
  },
  {
    name: "MotionPathPlugin",
    html: stage(`<svg width="1920" height="1080" style="position:absolute;inset:0"><path data-edit="route" d="M160 900 C600 700 900 980 1400 600 S1800 300 1760 200" fill="none" stroke="#999" stroke-width="4"/></svg><div class="t" data-edit="bus" style="left:0;top:0;width:80px;height:40px;background:#1d6fe0;border-radius:8px"></div>`),
    js: `export function buildTimeline({ root, timeline }) { const bus = root.querySelector('[data-edit="bus"]'); timeline.to(bus, { motionPath: { path: root.querySelector('[data-edit="route"]'), align: root.querySelector('[data-edit="route"]'), alignOrigin: [0.5, 0.5], autoRotate: true }, duration: 2, ease: 'none' }, 0); }`,
  },
  {
    name: "SplitText (masked lines)",
    html: stage(`<h1 class="t" data-edit="h" style="left:160px;top:300px;width:1200px;font-size:120px;line-height:1.05">Every ticket booked becomes a stop on one line.</h1>`),
    js: `export function buildTimeline({ root, timeline }) { const h = root.querySelector('[data-edit="h"]'); const s = SplitText.create(h, { type: 'lines', mask: 'lines' }); timeline.fromTo(s.lines, { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.25, ease: 'none' }, 0); }`,
  },
  {
    name: "splitReveal",
    html: stage(`<h1 class="t" data-edit="h" style="left:160px;top:380px;font-size:150px">You take the seat.</h1>`),
    js: `export function buildTimeline({ root, timeline }) { splitReveal(timeline, root.querySelector('[data-edit="h"]'), { at: 0, by: 'words', duration: 1, stagger: 0.2, ease: 'none' }); }`,
  },
  {
    name: "sharedElementHandoff",
    html: stage(`<h1 class="t" data-edit="h" style="left:1500px;top:160px;width:300px;font-size:60px">One inbox.</h1>`),
    js: `export function buildTimeline({ root, timeline }) { sharedElementHandoff(timeline, root.querySelector('[data-edit="h"]'), { from: { left: 1500, top: 160, width: 300 }, to: { left: 160, top: 420, width: 1200 }, at: 0, duration: 2, ease: 'none' }); }`,
  },
  {
    name: "Flip.fit",
    html: stage(`<div class="t" data-edit="a" style="left:200px;top:200px;width:200px;height:200px;background:#d4421e"></div><div class="t" data-edit="b" style="left:1100px;top:500px;width:600px;height:400px;border:2px dashed #999"></div>`),
    js: `export function buildTimeline({ root, timeline }) { const a = root.querySelector('[data-edit="a"]'); timeline.add(Flip.fit(a, root.querySelector('[data-edit="b"]'), { duration: 2, ease: 'none' }), 0); }`,
  },
];

const chromePath = process.argv[2] ?? findChrome();
const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ["--force-device-scale-factor=1", "--font-render-hinting=none"] });
let failures = 0;
try {
  for (const fixture of fixtures) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.setContent("<!doctype html><html><body style='margin:0;background:#000'></body></html>");
    await page.addScriptTag({ content: kit });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.evaluate(async (film) => {
      window.film = window.MotifyRenderKit.mountFilm({ compositionHtml: film.html, timelineJs: film.js, duration: 2, scenes: [{ id: "s1", label: "s1", start: 0, duration: 2, accent: "#000" }] });
      await document.fonts.ready;
    }, fixture);
    const results = [];
    for (const time of [0.25, 1, 1.75]) {
      await page.evaluate((t) => window.film.seek(t), time);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const preview = (await page.screenshot({ clip: { x: 0, y: 0, width: 1920, height: 1080 }, encoding: "base64" }));
      const { diff, content } = await page.evaluate(async (png, tolerance) => {
        const exported = await window.film.exportFrame(1);
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = exported.width;
        canvas.height = exported.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const a = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const b = exported.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        let differing = 0;
        let content = 0;
        for (let index = 0; index < a.length; index += 4) {
          if (Math.abs(a[index] - b[index]) > tolerance || Math.abs(a[index + 1] - b[index + 1]) > tolerance || Math.abs(a[index + 2] - b[index + 2]) > tolerance) differing += 1;
          // Anything that is not the paper ground is content the frame drew.
          if (Math.abs(b[index] - 243) + Math.abs(b[index + 1] - 239) + Math.abs(b[index + 2] - 230) > 60) content += 1;
        }
        return { diff: differing / (a.length / 4), content: content / (a.length / 4) };
      }, preview, CHANNEL_TOLERANCE);
      results.push({ time, diff, content });
    }
    const worst = Math.max(...results.map((result) => result.diff));
    // A blank frame would match trivially, so each fixture must draw something.
    const drawn = Math.max(...results.map((result) => result.content));
    const ok = worst <= MAX_DIFF && drawn > 0.001 && errors.length === 0;
    if (!ok) failures += 1;
    process.stdout.write(`${ok ? "ok  " : "FAIL"} ${fixture.name}: worst ${(worst * 100).toFixed(3)}% of pixels differ, content up to ${(drawn * 100).toFixed(2)}% of frame${errors.length ? `; errors: ${errors.join(" | ")}` : ""}\n`);
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures > 0) process.exitCode = 1;

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    join(homedir(), "AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe"),
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No Chromium found; pass its path as the first argument or set CHROME_PATH.");
  return found;
}

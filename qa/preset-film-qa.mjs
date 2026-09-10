import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import puppeteer from "puppeteer-core";

const out = resolve(process.argv[2] || "artifacts/preset-film-qa");
await mkdir(out, { recursive: true });
let executablePath = process.env.MOTIONLY_CHROME;
for (const path of [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
]) {
  if (executablePath) break;
  try {
    await access(path);
    executablePath = path;
  } catch {}
}
const server = await createServer({
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
});
let browser;
const report = {};
try {
  await server.listen();
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--hide-scrollbars"],
  });
  for (const preset of ["KiriTTS", "tessera", "relay"]) {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 0.5,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/qa/preset-film.html`,
    );
    await page.evaluate(async (preset) => {
      const module = await import(
        `/src/compositions/presets/${preset}/index.ts`
      );
      const { CompositionRuntime } =
        await import("/src/composition/runtime.ts");
      window.runtime = new CompositionRuntime(
        module.kiriTtsPreset || module.tesseraPreset || module.relayPreset,
        document.querySelector("#root"),
      );
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode()));
    }, preset);
    const times =
      preset === "KiriTTS"
        ? [
            8.5, 9.85, 10.25, 10.7, 11.2, 12.6, 16.6, 19.8, 20.2, 20.6, 21.2,
            22.5, 25.5, 30.5, 32.8, 36.6, 38.6, 39.8, 40.5, 41.8, 42.8, 46.5,
          ]
        : preset === "tessera" ? [5, 8.6, 9.6, 10.2, 10.8, 11.5, 12.2, 13.2, 14.8, 16, 18.8] : [2.5,4.8,7.6,10.6,12.5,14.8,16.2,17.6,19.6,21.6,24.5];
    const seek = (time) =>
      page.evaluate(async (time) => {
        window.runtime.seek(time);
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      }, time);
    const state = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-edit]")].map((el) => {
          const r = el.getBoundingClientRect(),
            cs = getComputedStyle(el);
          return {
            id: el.dataset.edit,
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            opacity: Number(cs.opacity),
            visibility: cs.visibility,
            text: el.textContent.replace(/\s+/g, " ").trim(),
          };
        }),
      );
    const frames = [];
    for (const time of times) {
      await seek(time);
      const before = await state();
      if (preset === "KiriTTS" && time === 19.8) {
        const actor = id => before.find(a => a.id === id);
        const player = actor("kiriVoiceCarrier"), controls = actor("kiriComposerTools"), footer = actor("kiriGenerateButton");
        assert.ok(player.y - controls.y - controls.h >= 24, "Generated player overlaps Paragraph/Pause controls");
        assert.ok(footer.y - player.y - player.h >= 24, "Generated player overlaps footer");
      }

      const contained = (actor) => {
        assert.ok(actor.x >= 0 && actor.y >= 0 && actor.x + actor.w <= 1920 && actor.y + actor.h <= 1080, `${preset}@${time}: ${actor.id} is cropped`);
      };
      if (preset === "KiriTTS" && time >= 39) {
        const mark = before.find(a => a.id === "kiriBrandMark");
        contained(mark);
        assert.ok(mark.w < 320 && mark.h < 320, "Reused logo returned as a large panel");
      }
      if (preset === "tessera" && time >= 14.8 && time <= 16) {
        const records = before.filter(a => /^tessRecord(One|Two|Three|Four|Five)$/.test(a.id));
        records.forEach(contained);
        records.forEach((a, i) => records.slice(i + 1).forEach(b => {
          assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} overlaps ${b.id} in the final comparison`);
        }));
      }
      await page.screenshot({
        path: `${out}/${preset}-${time}.jpg`,
        type: "jpeg",
        quality: 88,
      });
      await seek(preset === "KiriTTS" ? 47.99 : preset === "tessera" ? 19.99 : 25.99);
      await seek(0);
      await seek(time);
      const after = await state();
      for (let i = 0; i < before.length; i++) {
        for (const key of ["x", "y", "w", "h", "opacity"])
          assert.ok(
            Math.abs(before[i][key] - after[i][key]) < 0.1,
            `${preset}@${time} ${before[i].id}.${key} changed after seeking: ${before[i][key]} -> ${after[i][key]}`,
          );
        assert.equal(
          before[i].text,
          after[i].text,
          `${preset}@${time} ${before[i].id} text did not restore`,
        );
      }
      frames.push({ time, actors: before });
    }
    report[preset] = { errors, frames };
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(
    `All three presets passed forward/reverse geometry and text checks. Frames: ${out}`,
  );
} finally {
  await browser?.close();
  await server.close();
}

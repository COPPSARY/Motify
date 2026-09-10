import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const outDir = resolve(process.argv[2]);
const times = process.argv.slice(3).map(Number);

async function firstExecutable(candidates) {
  for (const c of candidates) {
    if (!c) continue;
    try {
      await access(c);
      return c;
    } catch {
      /* next */
    }
  }
}

const executablePath = await firstExecutable([
  process.env.MOTIONLY_CHROME,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
]);
if (!executablePath) throw new Error("No Chrome/Edge found.");

await mkdir(outDir, { recursive: true });
const server = await createServer({
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
});
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--hide-scrollbars", "--force-device-scale-factor=1"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  await page.goto(`http://127.0.0.1:${port}/render.html`, {
    waitUntil: "networkidle0",
  });
  await page.waitForFunction(() => window.motionlyRender !== undefined, {
    timeout: 60000,
  });
  const meta = await page.evaluate(() => window.motionlyRender.metadata);
  await page.setViewport({
    width: meta.width,
    height: meta.height,
    deviceScaleFactor: 0.5,
  });
  for (const t of times) {
    await page.evaluate((time) => window.motionlyRender.seek(time), t);
    const png = await page.screenshot({
      type: "png",
      captureBeyondViewport: false,
    });
    const name = `t${String(t).replace(".", "_")}.png`;
    await writeFile(resolve(outDir, name), png);
    console.log("wrote", name);
  }
  if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
} finally {
  await browser?.close();
  await server.close();
}

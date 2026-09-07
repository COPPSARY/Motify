import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = resolve(process.cwd(), "artifacts/notes_debug_frames");
await mkdir(outputDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-first-run", "--disable-extensions", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  page.on("pageerror", err => console.error("PAGE_ERROR:", err.message));
  page.on("console", msg => console.log("PAGE_LOG:", msg.type(), msg.text()));
  await page.setViewport({ width: 1450, height: 900 });
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("motionly_early_notice_dismissed", "true");
  });
  await page.reload({ waitUntil: "networkidle0" });

  console.log("Loading Apple Notes preset...");
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button.me-preset-card"));
    const texts = buttons.map(b => b.innerText.replace(/\s+/g, " ").trim());
    const appleBtn = buttons.find(b => b.innerText.includes("Apple Notes"));
    if (appleBtn) {
      appleBtn.click();
      return { found: true, texts };
    }
    return { found: false, texts };
  });
  console.log("Preset search:", clicked);
  await new Promise(r => setTimeout(r, 1500));

  const compInfo = await page.evaluate(() => {
    const meta = document.querySelector(".storyboard-strip__meta")?.textContent;
    const title = document.querySelector(".storyboard-strip__title")?.textContent;
    return { meta, title };
  });
  console.log("Composition after click:", compInfo);

  // Switch to project timeline mode
  await page.evaluate(() => {
    const backBtn = document.querySelector(".storyboard-strip__back, .me-timeline-back");
    if (backBtn) backBtn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  const times = [6.1, 7.4, 8.4, 10.5, 13.6, 15.5, 20.0, 26.5];

  for (const t of times) {
    const info = await page.evaluate((time) => {
      const input = document.querySelector('input[aria-label="Timeline scrubber"]');
      if (input) {
        input.max = "31.2";
        input.value = String(time);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        const cam = document.querySelector("[data-edit='notesCameraWorld']");
        const shell = document.querySelector("[data-edit='notesAppShell']");
        return {
          time,
          camTransform: cam?.style.transform,
          shellTransform: shell?.style.transform,
        };
      }
      return null;
    }, t);
    console.log(`Seek ${t}s ->`, info);
    await new Promise(r => setTimeout(r, 200));

    const stage = await page.$('.me-canvas-shell');
    if (stage) {
      await stage.screenshot({ path: `${outputDir}/frame_${t}s.png` });
      console.log(`Saved frame_${t}s.png`);
    } else {
      console.log(`Could not find stage at ${t}s`);
    }
  }
} catch (err) {
  console.error(err);
} finally {
  await browser.close();
}

import { spawn } from "node:child_process";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const wait = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));
const workspace = process.cwd();
const output = resolve(workspace, "artifacts/code-first-qa");
if (!output.startsWith(`${resolve(workspace)}${sep}`))
  throw new Error("Invalid QA output path.");

/** The left panel's tabs are addressed by label, the way a user reaches them. */
function clickPanelTab(browser, label) {
  return browser.evaluate(
    `[...document.querySelectorAll('.me-panel-tab')].find((tab) => tab.textContent.trim() === ${JSON.stringify(label)})?.click()`,
  );
}

/** Presets are opened from the gallery, the way a user reaches them. */
function openPreset(browser, name) {
  return browser.evaluate(
    `[...document.querySelectorAll('.me-preset-card')].find((card) => card.textContent.includes(${JSON.stringify(name)}))?.click()`,
  );
}

async function chromePath() {
  const candidates = [
    process.env["MOTIONLY_CHROME"],
    `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"}\\Google\\Chrome\\Application\\chrome.exe`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next standard location.
    }
  }
  throw new Error("Chrome not found; set MOTIONLY_CHROME.");
}

async function startPreview(port) {
  const vite = join(workspace, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(
    process.execPath,
    [vite, "preview", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: workspace,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let diagnostics = "";
  child.stdout?.on("data", (chunk) => (diagnostics += String(chunk)));
  child.stderr?.on("data", (chunk) => (diagnostics += String(chunk)));
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return { child, url };
    } catch {
      // Vite is starting.
    }
    if (child.exitCode !== null) break;
    await wait(100);
  }
  child.kill();
  throw new Error(`Preview did not start. ${diagnostics.trim()}`);
}

async function launchBrowser(url) {
  const executable = await chromePath();
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = join(tmpdir(), `motionly-code-first-${Date.now()}`);
  const child = spawn(
    executable,
    [
      "--headless=new",
      "--no-first-run",
      "--disable-extensions",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--window-size=1920,1080",
      url,
    ],
    { stdio: "ignore", windowsHide: true },
  );
  let target;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
        (response) => response.json(),
      );
      target = targets.find((candidate) => candidate.type === "page");
      if (target) break;
    } catch {
      // Chrome is starting.
    }
    await wait(100);
  }
  if (!target) throw new Error("Chrome DevTools target unavailable.");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  const warnings = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === "Runtime.exceptionThrown") {
      errors.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text,
      );
    }
    if (message.method === "Log.entryAdded") {
      if (message.params.entry.level === "error")
        errors.push(message.params.entry.text);
      if (message.params.entry.level === "warning")
        warnings.push(message.params.entry.text);
    }
  });
  const command = (method, params = {}) => {
    const id = ++nextId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((done) => pending.set(id, done));
  };
  const evaluate = async (expression) => {
    const response = await command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.result?.exceptionDetails)
      throw new Error(response.result.exceptionDetails.text);
    return response.result?.result?.value;
  };
  await command("Runtime.enable");
  await command("Log.enable");
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return {
    command,
    evaluate,
    errors,
    warnings,
    async close() {
      await command("Browser.close").catch(() => undefined);
      socket.close();
      child.kill();
      await rm(profile, { recursive: true, force: true }).catch(
        () => undefined,
      );
    },
  };
}

let preview;
let browser;
try {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  preview = await startPreview(5191);
  browser = await launchBrowser(preview.url);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (
      await browser.evaluate(
        "Boolean(document.querySelector('.composition-root') && document.querySelector('.me-timeline-panel'))",
      )
    )
      break;
    if (attempt === 99) throw new Error("Editor did not become ready.");
    await wait(100);
  }

  // The editor must open on nothing. A preset mounted at startup was read by
  // the generator as the user's own project, so a first prompt came back as
  // that preset re-themed instead of as the film that was asked for.
  const freshEditor = await browser.evaluate(`(() => ({
    editIds: [...document.querySelectorAll('.composition-root [data-edit]')].map((element) => element.dataset.edit),
    scenes: document.querySelectorAll('.me-project-scene-clip').length,
  }))()`);
  if (freshEditor.scenes !== 1 || freshEditor.editIds.join(",") !== "stage")
    throw new Error(
      `A fresh editor was not blank: ${JSON.stringify(freshEditor)}`,
    );

  // Everything below inspects the Claude preset's choreography, which the
  // editor used to mount at startup. It is now opened the way a user opens it.
  await clickPanelTab(browser, "Presets");
  await wait(60);
  await openPreset(browser, "Claude");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const mounted = await browser.evaluate(
      "document.querySelectorAll('.composition-root [data-edit]').length",
    );
    if (mounted > 1) break;
    if (attempt === 99)
      throw new Error("The preset did not mount from the gallery.");
    await wait(100);
  }
  await clickPanelTab(browser, "Chat");
  await wait(60);

  const masterTimeline = await browser.evaluate(`(() => ({
    ruler: document.querySelector('.me-ruler-label')?.textContent?.trim(),
    scenes: [...document.querySelectorAll('.me-project-scene-clip')].map((clip) => ({
      text: clip.textContent?.replace(/\\s+/g, ' ').trim(),
      left: getComputedStyle(clip).left,
      width: getComputedStyle(clip).width,
    })),
    handoffs: document.querySelectorAll('.me-project-handoff').length,
  }))()`);
  if (
    masterTimeline.ruler !== "MASTER" ||
    masterTimeline.scenes.length < 2 ||
    masterTimeline.handoffs !== masterTimeline.scenes.length - 1
  )
    throw new Error(
      `Master timeline did not show the whole film: ${JSON.stringify(masterTimeline)}`,
    );
  const masterScreenshot = await browser.command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    join(output, "master-timeline.png"),
    Buffer.from(masterScreenshot.result.data, "base64"),
  );
  await clickPanelTab(browser, "Presets");
  await wait(60);
  const presetPanel = await browser.evaluate(`(() => ({
    category: document.querySelector('.me-panel-content .me-category-title')?.textContent?.trim(),
    cards: document.querySelectorAll('.me-preset-card').length,
    sourceVisible: Boolean(document.querySelector('.source-code')),
  }))()`);
  if (
    presetPanel.category !== "Presets" ||
    presetPanel.cards < 1 ||
    presetPanel.sourceVisible
  )
    throw new Error(
      `Presets tab did not render its gallery: ${JSON.stringify(presetPanel)}`,
    );
  await clickPanelTab(browser, "Chat");
  await wait(60);
  await browser.evaluate("document.querySelector('[data-scene-id]')?.click()");
  await wait(80);
  const localTimeline = await browser.evaluate(`(() => ({
    ruler: document.querySelector('.me-ruler-label')?.textContent?.trim(),
    hasExit: Boolean(document.querySelector('.me-timeline-back')),
    widths: [...document.querySelectorAll('.scene-timeline-clip')].map((clip) => getComputedStyle(clip).width),
  }))()`);
  if (
    !localTimeline.ruler ||
    localTimeline.ruler === "MASTER" ||
    !localTimeline.hasExit ||
    new Set(localTimeline.widths).size < 2
  )
    throw new Error(
      `Local timeline clips did not reflect authored timing: ${JSON.stringify(localTimeline)}`,
    );
  await browser.evaluate(
    "document.querySelector('.me-timeline-back')?.click()",
  );
  await wait(80);
  const returnedToMaster = await browser.evaluate(
    "document.querySelector('.me-ruler-label')?.textContent?.trim()",
  );
  if (returnedToMaster !== "MASTER")
    throw new Error("Scene timeline did not return to the master timeline.");

  await browser.evaluate(`(() => {
    const scrubber = document.querySelector('input[aria-label="Timeline scrubber"]');
    scrubber.value = '2.5';
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await wait(80);
  const introCentering = await browser.evaluate(`(() => {
    const canvas = document.querySelector('.composition-canvas')?.getBoundingClientRect();
    const line = document.querySelector('.giant-line')?.getBoundingClientRect();
    return {
      delta: Math.abs((line.left + line.width / 2) - (canvas.left + canvas.width / 2)),
      lineLeft: line.left,
      canvasLeft: canvas.left,
      lineRight: line.right,
      canvasRight: canvas.right,
    };
  })()`);
  if (
    introCentering.delta > 90 ||
    introCentering.lineLeft < introCentering.canvasLeft - 10 ||
    introCentering.lineRight > introCentering.canvasRight + 10
  )
    throw new Error(
      `Intro kinetic text is not centered/readable: ${JSON.stringify(introCentering)}`,
    );

  await browser.evaluate(`(() => {
    const scrubber = document.querySelector('input[aria-label="Timeline scrubber"]');
    scrubber.value = '13.6';
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await browser.evaluate(
    "document.querySelector('[data-scene-id=code]')?.click()",
  );
  await wait(80);
  await browser.evaluate(`(() => {
    const scrubber = document.querySelector('input[aria-label="Timeline scrubber"]');
    scrubber.value = '13.6';
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await wait(100);
  const productProof = await browser.evaluate(`(() => {
    const shell = document.querySelector('.motionly-ui');
    const track = document.querySelector('.timeline-count-track');
    const artboard = document.querySelector('.output-artboard');
    if (!shell || !track || !artboard) return {
      missing: {
        shell: !shell,
        track: !track,
        artboard: !artboard,
      },
      hasFakeScreenshotUi: Boolean(document.querySelector('.reference-ui, .frozen-window')),
    };
    const shellStyle = getComputedStyle(shell);
    const count = document.querySelector('.count-number')?.textContent?.trim();
    const prompt = document.querySelector('.prompt-typed')?.textContent?.replace(/\\s+/g, ' ').trim();
    const trackWidth = Number.parseFloat(getComputedStyle(track).width);
    const artboardStyle = getComputedStyle(artboard);
    return {
      shell: { opacity: Number(shellStyle.opacity), visibility: shellStyle.visibility },
      prompt,
      count,
      trackWidth,
      artboard: { opacity: Number(artboardStyle.opacity), visibility: artboardStyle.visibility },
      hasFakeScreenshotUi: Boolean(document.querySelector('.reference-ui, .frozen-window')),
    };
  })()`);
  if (
    productProof.missing ||
    productProof.shell.visibility === "hidden" ||
    productProof.shell.opacity < 0.5 ||
    productProof.prompt !== "Can you make a text that counts to 150?" ||
    productProof.count !== "150" ||
    productProof.trackWidth < 100 ||
    productProof.artboard.visibility === "hidden" ||
    productProof.artboard.opacity < 0.5 ||
    productProof.hasFakeScreenshotUi
  )
    throw new Error(
      `Product demo did not show real Motionly usage: ${JSON.stringify({ productProof, errors: browser.errors, warnings: browser.warnings })}`,
    );
  await browser.evaluate(
    "document.querySelector('.me-timeline-back')?.click()",
  );
  await wait(80);
  await browser.evaluate(`(() => {
    const scrubber = document.querySelector('input[aria-label="Timeline scrubber"]');
    scrubber.value = '0';
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);

  const sceneForTime = (time) =>
    [
      { id: "cta", start: 26.5 },
      { id: "lab", start: 20.4 },
      { id: "studio", start: 15.6 },
      { id: "code", start: 10.8 },
      { id: "build", start: 5 },
      { id: "problem", start: 3.4 },
      { id: "brand", start: 0 },
    ].find((scene) => time >= scene.start)?.id ?? "brand";
  const seekTo = async (time) => {
    const sceneId = sceneForTime(time);
    await browser.evaluate(
      `document.querySelector('[data-scene-id="${sceneId}"]')?.click()`,
    );
    await wait(80);
    await browser.evaluate(`(() => {
      const scrubber = document.querySelector('input[aria-label="Timeline scrubber"]');
      scrubber.value = '${time}';
      scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  };

  const motionBeforePlay = await browser.evaluate(`(() => {
    const target = document.querySelector('.hook-one');
    const style = getComputedStyle(target);
    return { transform: style.transform, opacity: style.opacity };
  })()`);
  const playheadBeforePlay = await browser.evaluate(`(() => {
    const marker = document.querySelector('.me-playhead-marker');
    const lane = document.querySelector('.me-track-lane');
    return {
      marker: Number.parseFloat(getComputedStyle(marker).left),
      line: Number.parseFloat(getComputedStyle(lane, '::after').left),
    };
  })()`);
  await browser.evaluate(
    "document.querySelector('button[aria-label=Play]')?.click()",
  );
  await wait(1400);
  const playback = await browser.evaluate(`(() => {
    const target = document.querySelector('.hook-one');
    const style = getComputedStyle(target);
    return {
      time: Number(document.querySelector('input[aria-label="Timeline scrubber"]')?.value ?? 0),
      pauseVisible: Boolean(document.querySelector('button[aria-label="Pause"]')),
      target: { transform: style.transform, opacity: style.opacity },
      playhead: {
        marker: Number.parseFloat(getComputedStyle(document.querySelector('.me-playhead-marker')).left),
        line: Number.parseFloat(getComputedStyle(document.querySelector('.me-track-lane'), '::after').left),
      },
    };
  })()`);
  const targetChanged =
    motionBeforePlay.transform !== playback.target.transform ||
    motionBeforePlay.opacity !== playback.target.opacity;
  if (!playback.pauseVisible || playback.time < 1.1 || !targetChanged)
    throw new Error(
      `Playback failed: ${JSON.stringify({ playback, errors: browser.errors, warnings: browser.warnings })}`,
    );
  if (
    playback.playhead.line <= playheadBeforePlay.line + 20 ||
    Math.abs(playback.playhead.line - playback.playhead.marker) > 1.5
  )
    throw new Error(
      `Playhead line did not follow its marker: ${JSON.stringify({ playheadBeforePlay, current: playback.playhead })}`,
    );
  await browser.evaluate(
    "document.querySelector('button[aria-label=Pause]')?.click()",
  );

  for (const time of [27.2, 5.1, 23.7, 22.4]) await seekTo(time);
  await browser.evaluate(
    "document.querySelector('button[aria-label=Play]')?.click()",
  );
  await wait(760);
  const rapidScrubPlayback = await browser.evaluate(`(() => {
    const target = document.querySelector('[data-motionly-id="output-artboard"]');
    const headline = document.querySelector('[data-motionly-id="visual-title"]');
    const targetStyle = getComputedStyle(target);
    const headlineStyle = getComputedStyle(headline);
    return {
      time: Number(document.querySelector('input[aria-label="Timeline scrubber"]')?.value ?? 0),
      target: { opacity: Number(targetStyle.opacity), visibility: targetStyle.visibility },
      headline: { opacity: Number(headlineStyle.opacity), visibility: headlineStyle.visibility },
    };
  })()`);
  if (
    rapidScrubPlayback.time < 23 ||
    rapidScrubPlayback.target.visibility === "hidden" ||
    rapidScrubPlayback.target.opacity < 0.1 ||
    rapidScrubPlayback.headline.visibility === "hidden" ||
    rapidScrubPlayback.headline.opacity < 0.1
  )
    throw new Error(
      `Rapid reverse scrubbing lost composition elements: ${JSON.stringify(rapidScrubPlayback)}`,
    );
  await browser.evaluate(
    "document.querySelector('button[aria-label=Pause]')?.click()",
  );

  await seekTo(22.4);
  const scrubbedBeforePlay = await browser.evaluate(`(() => {
    const ids = ['output-artboard', 'visual-title', 'timeline-count-track', 'export-panel'];
    return Object.fromEntries(ids.map((id) => {
      const element = document.querySelector('[data-motionly-id="' + id + '"]');
      const style = getComputedStyle(element);
      return [id, { opacity: Number(style.opacity), visibility: style.visibility, transform: style.transform }];
    }));
  })()`);
  await browser.evaluate(
    "document.querySelector('button[aria-label=Play]')?.click()",
  );
  await wait(900);
  const scrubbedAfterPlay = await browser.evaluate(`(() => {
    const ids = ['output-artboard', 'visual-title', 'timeline-count-track', 'export-panel'];
    return {
      time: Number(document.querySelector('input[aria-label="Timeline scrubber"]')?.value ?? 0),
      elements: Object.fromEntries(ids.map((id) => {
        const element = document.querySelector('[data-motionly-id="' + id + '"]');
        const style = getComputedStyle(element);
        return [id, { opacity: Number(style.opacity), visibility: style.visibility, transform: style.transform }];
      })),
    };
  })()`);
  if (
    scrubbedAfterPlay.time < 23 ||
    Object.values(scrubbedAfterPlay.elements).some(
      (element) => element.visibility === "hidden" || element.opacity < 0.1,
    )
  )
    throw new Error(
      `Scrub then Play lost composition elements: ${JSON.stringify({ scrubbedBeforePlay, scrubbedAfterPlay })}`,
    );
  await browser.evaluate(
    "document.querySelector('button[aria-label=Pause]')?.click()",
  );

  const hasTimelineDebugButton = await browser.evaluate(
    "Boolean(document.querySelector('button[aria-controls=\"gsap-timeline-details\"]'))",
  );
  if (hasTimelineDebugButton)
    throw new Error(
      "The removed GSAP timeline debug control is still visible.",
    );
  await clickPanelTab(browser, "Chat");
  await wait(80);
  await browser.evaluate(
    "document.querySelector('button[aria-label=\"Open composition HTML source\"]')?.click()",
  );
  await wait(80);
  const sourcePanel = await browser.evaluate(`(() => ({
    heading: document.querySelector('.source-heading')?.textContent?.replace(/\\s+/g, ' ').trim(),
    sourceVisible: Boolean(document.querySelector('.source-code')),
    closeVisible: Boolean(document.querySelector('button[aria-label="Close composition source"]')),
  }))()`);
  if (
    !sourcePanel.heading?.includes("composition.html") ||
    !sourcePanel.sourceVisible ||
    !sourcePanel.closeVisible
  )
    throw new Error(
      `Explicit source action did not open the source panel: ${JSON.stringify(sourcePanel)}`,
    );
  await browser.evaluate(
    "document.querySelector('button[aria-label=\"Close composition source\"]')?.click()",
  );

  await clickPanelTab(browser, "Chat");
  await wait(100);
  const assistantOpened = await browser.evaluate(`(() => ({
    panel: Boolean(document.querySelector('.me-left-panel .ai-chat-panel')),
    prompt: Boolean(document.querySelector('textarea[aria-label="Assistant prompt"]')),
    attach: Boolean(document.querySelector('.ai-composer-add')),
  }))()`);
  if (
    !assistantOpened.panel ||
    !assistantOpened.prompt ||
    !assistantOpened.attach
  )
    throw new Error(
      `Assistant did not occupy the left panel: ${JSON.stringify(assistantOpened)}`,
    );
  await browser.evaluate(`(() => {
    const prompt = document.querySelector('textarea[aria-label="Assistant prompt"]');
    prompt.value = 'Tighten the CTA camera move';
    prompt.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await wait(50);
  await browser.evaluate(
    "document.querySelector('button[aria-label=\"Send message to Tiffy\"]')?.click()",
  );
  await wait(80);
  const assistantMessages = await browser.evaluate(
    "[...document.querySelectorAll('.ai-chat-message')].map((message) => message.textContent.trim())",
  );
  if (!assistantMessages.some((message) => message.includes("CTA camera")))
    throw new Error("Assistant message composer did not submit.");
  const assistantScreenshot = await browser.command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    join(output, "assistant-drawer.png"),
    Buffer.from(assistantScreenshot.result.data, "base64"),
  );
  await browser.evaluate(
    "document.querySelector('button[aria-label=\"Close assistant\"]')?.click()",
  );

  const frames = [];
  for (const time of [
    0.75, 2.4, 4.2, 5.7, 8.2, 9.8, 12.6, 14.6, 17.2, 21.8, 27.2, 29.4,
  ]) {
    await seekTo(time);
    await wait(250);
    const state = await browser.evaluate(`(() => {
      const shell = document.querySelector('.me-stage');
      const rect = shell.getBoundingClientRect();
      const canvas = document.querySelector('.composition-canvas');
      const canvasRect = canvas.getBoundingClientRect();
      const visibleScenes = [...document.querySelectorAll('.scene')].filter((scene) => {
        const style = getComputedStyle(scene);
        return style.visibility !== 'hidden' && Number(style.opacity) > .01;
      });
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        canvasRect: { x: canvasRect.x, y: canvasRect.y, width: canvasRect.width, height: canvasRect.height },
        canvasTransform: getComputedStyle(canvas).transform,
        visibleScenes: visibleScenes.map((scene) => scene.dataset['motionlyId']),
        visibleText: visibleScenes[0]?.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 180) ?? '',
        registered: document.querySelectorAll('[data-motionly-id]').length,
      };
    })()`);
    if (state.visibleScenes.length !== 1 || state.registered < 20)
      throw new Error(`Invalid frame ${time}: ${JSON.stringify(state)}`);
    const screenshot = await browser.command("Page.captureScreenshot", {
      format: "png",
      clip: { ...state.rect, scale: 1 },
      captureBeyondViewport: false,
    });
    const filename = `frame-${String(time).replace(".", "-")}.png`;
    await writeFile(
      join(output, filename),
      Buffer.from(screenshot.result.data, "base64"),
    );
    if (time === 21.8) {
      const editorScreenshot = await browser.command("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(
        join(output, "editor-shell.png"),
        Buffer.from(editorScreenshot.result.data, "base64"),
      );
    }
    frames.push({ time, ...state, screenshot: filename });
  }

  const handoffs = [];
  const handoffChecks = [
    {
      time: 9.18,
      selectors: [
        ".product-stage",
        ".demo-composer",
        ".preview-container",
        ".timeline-ui",
      ],
      expectedVisible: 4,
    },
    {
      time: 16.92,
      selectors: [
        ".product-stage",
        ".timeline-ui",
        ".timeline-playhead",
        ".timeline-count-track",
      ],
      expectedVisible: 4,
    },
    {
      time: 21.72,
      selectors: [
        ".product-stage",
        ".export-panel",
        ".export-format",
        ".export-progress",
      ],
      expectedVisible: 3,
    },
    {
      time: 26.72,
      selectors: [".product-stage", ".cta-scene", ".final-wrap"],
      expectedVisible: 2,
    },
  ];
  for (const { time, selectors, expectedVisible } of handoffChecks) {
    await seekTo(time);
    await wait(180);
    const state = await browser.evaluate(`(() => {
      const shell = document.querySelector('.me-stage');
      const rect = shell.getBoundingClientRect();
      const targets = ${JSON.stringify(selectors)}
        .map((selector) => document.querySelector(selector))
        .filter(Boolean)
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.visibility !== 'hidden' && Number(style.opacity) > .01;
        })
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            id: element.dataset['motionlyId'] || element.className,
            transform: style.transform,
            clipPath: style.clipPath,
            opacity: Number(style.opacity),
          };
        });
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        targets,
      };
    })()`);
    if (state.targets.length < expectedVisible)
      throw new Error(
        `Static continuity handoff ${time}: ${JSON.stringify(state)}`,
      );
    const screenshot = await browser.command("Page.captureScreenshot", {
      format: "png",
      clip: { ...state.rect, scale: 1 },
      captureBeyondViewport: false,
    });
    const filename = `handoff-${String(time).replace(".", "-")}.png`;
    await writeFile(
      join(output, filename),
      Buffer.from(screenshot.result.data, "base64"),
    );
    handoffs.push({ time, ...state, screenshot: filename });
  }

  const cameraMotion = [];
  for (const time of [9.8, 12.4, 16.9, 21.8]) {
    await seekTo(time);
    await wait(120);
    const selector = ".product-window";
    cameraMotion.push(
      await browser.evaluate(`(() => {
        const target = document.querySelector(${JSON.stringify(selector)});
        return { time: ${time}, transform: getComputedStyle(target).transform };
      })()`),
    );
  }
  if (
    cameraMotion[0].transform === cameraMotion[1].transform ||
    cameraMotion[2].transform === cameraMotion[3].transform
  )
    throw new Error(
      `Camera route stayed static: ${JSON.stringify(cameraMotion)}`,
    );

  const ambientMotion = [];
  for (const time of [1, 15, 30]) {
    await seekTo(time);
    await wait(80);
    ambientMotion.push(
      await browser.evaluate(`(() => ({
        time: ${time},
        field: getComputedStyle(document.querySelector('[data-motionly-id=ambient-gradient]')).transform,
        primary: getComputedStyle(document.querySelector('.aurora-a')).transform,
        secondary: getComputedStyle(document.querySelector('.aurora-b')).transform,
      }))()`),
    );
  }
  if (
    ambientMotion[0].field === ambientMotion[2].field ||
    ambientMotion[0].primary === ambientMotion[2].primary ||
    ambientMotion[0].secondary === ambientMotion[2].secondary
  )
    throw new Error(
      `Ambient gradient stayed static: ${JSON.stringify(ambientMotion)}`,
    );

  const studioTimelineMotion = [];
  for (const time of [16.8, 18.0]) {
    await seekTo(time);
    await wait(80);
    studioTimelineMotion.push(
      await browser.evaluate(`(() => ({
        time: ${time},
        left: getComputedStyle(document.querySelector('.timeline-playhead')).left,
        transform: getComputedStyle(document.querySelector('.timeline-playhead')).transform,
      }))()`),
    );
  }
  if (studioTimelineMotion[0].left === studioTimelineMotion[1].left)
    throw new Error(
      `Editable product proof stayed static: ${JSON.stringify(studioTimelineMotion)}`,
    );

  await browser.evaluate(
    "document.querySelector('[data-scene-id=cta]')?.click()",
  );
  await wait(100);
  const sceneNavigation = await browser.evaluate(`(() => ({
    selected: document.querySelector('[data-scene-id=cta]')?.getAttribute('aria-current'),
    ruler: document.querySelector('.me-ruler-label')?.textContent?.trim(),
    tracks: [...document.querySelectorAll('[data-track-id]')].map((track) => track.dataset.trackId),
  }))()`);
  if (
    sceneNavigation.selected !== "true" ||
    sceneNavigation.ruler !== "Type generate edit" ||
    !sceneNavigation.tracks.includes("final-line-one")
  )
    throw new Error(
      `Scene did not open its local timeline: ${JSON.stringify(sceneNavigation)}`,
    );

  await browser.evaluate(
    "document.querySelector('[data-track-id=final-line-one] .me-track-label')?.click()",
  );
  await wait(60);
  const propertySelection = await browser.evaluate(`(() => {
    const text = document.querySelector('#property-text');
    const x = document.querySelector('input[aria-label="X position"]');
    const fontSize = document.querySelector('input[aria-label="Font size"]');
    const textColor = document.querySelector('input[aria-label="Text color"]');
    const background = document.querySelector('input[aria-label="Background color"]');
    const radius = document.querySelector('input[aria-label="Corner radius"]');
    text.value = 'SHIP IT';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    x.value = '24';
    x.dispatchEvent(new Event('input', { bubbles: true }));
    fontSize.value = '118';
    fontSize.dispatchEvent(new Event('input', { bubbles: true }));
    textColor.value = '#ff705e';
    textColor.dispatchEvent(new Event('input', { bubbles: true }));
    background.value = '#17191c';
    background.dispatchEvent(new Event('input', { bubbles: true }));
    radius.value = '8';
    radius.dispatchEvent(new Event('input', { bubbles: true }));
    const element = document.querySelector('[data-motionly-id=final-line-one]');
    const style = getComputedStyle(element);
    return {
      selected: document.querySelector('.me-selection-summary strong')?.textContent,
      text: element?.textContent,
      pieces: element?.children.length ?? 0,
      transform: style.transform,
      translate: style.translate,
      color: style.color,
      backgroundColor: style.backgroundColor,
      fontSize: style.fontSize,
      borderRadius: style.borderRadius,
    };
  })()`);
  if (
    propertySelection.selected !== "final-line-one" ||
    propertySelection.text !== "SHIP IT" ||
    propertySelection.pieces < 2 ||
    !propertySelection.translate.includes("24px") ||
    propertySelection.color !== "rgb(255, 112, 94)" ||
    propertySelection.backgroundColor !== "rgb(23, 25, 28)" ||
    propertySelection.fontSize !== "118px" ||
    propertySelection.borderRadius !== "8px"
  )
    throw new Error(
      `Property editing failed: ${JSON.stringify(propertySelection)}`,
    );
  const propertiesScreenshot = await browser.command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    join(output, "properties-editor.png"),
    Buffer.from(propertiesScreenshot.result.data, "base64"),
  );
  await browser.evaluate(
    "document.querySelector('.me-properties-panel')?.scrollTo(0, document.querySelector('.me-properties-panel')?.scrollHeight ?? 0)",
  );
  const appearanceScreenshot = await browser.command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    join(output, "properties-appearance.png"),
    Buffer.from(appearanceScreenshot.result.data, "base64"),
  );

  await browser.evaluate(
    "document.querySelector('[data-motionly-id=final-cta]')?.click()",
  );
  const selected = await browser.evaluate(
    "document.querySelector('.me-selection-summary strong')?.textContent",
  );
  if (selected !== "final-cta")
    throw new Error("Canvas selection did not reach the inspector.");

  await browser.evaluate(
    "document.querySelector('button[aria-label=Restart]')?.click()",
  );
  await wait(120);
  const restarted = Number(
    await browser.evaluate(
      "document.querySelector('input[aria-label=\"Timeline scrubber\"]')?.value ?? -1",
    ),
  );
  if (restarted > 0.35) throw new Error(`Restart failed at ${restarted}.`);

  await browser.evaluate(
    "document.querySelector('button[aria-label=Pause]')?.click()",
  );
  await wait(50);
  await browser.evaluate(
    "document.querySelector('[data-track-id=manifesto-design] .me-track-label')?.click()",
  );
  await wait(50);
  const editedBeforePlay = await browser.evaluate(`(() => {
    const x = document.querySelector('input[aria-label="X position"]');
    x.value = '32';
    x.dispatchEvent(new Event('input', { bubbles: true }));
    const target = document.querySelector('[data-motionly-id=manifesto-design]');
    const style = getComputedStyle(target);
    return {
      motionTransform: getComputedStyle(document.querySelector('.hook-one')).transform,
      translate: style.translate,
    };
  })()`);
  await browser.evaluate(
    "document.querySelector('button[aria-label=Play]')?.click()",
  );
  await wait(520);
  const playedAfterEdit = await browser.evaluate(`(() => {
    const target = document.querySelector('[data-motionly-id=manifesto-design]');
    const style = getComputedStyle(target);
    const visibleScenes = [...document.querySelectorAll('.scene')].filter((scene) => {
      const sceneStyle = getComputedStyle(scene);
      return sceneStyle.visibility !== 'hidden' && Number(sceneStyle.opacity) > .01;
    });
    return {
      motionTransform: getComputedStyle(document.querySelector('.hook-one')).transform,
      translate: style.translate,
      opacity: Number(style.opacity),
      visibility: style.visibility,
      visibleScenes: visibleScenes.map((scene) => scene.dataset.motionlyId),
    };
  })()`);
  if (
    playedAfterEdit.visibility === "hidden" ||
    playedAfterEdit.opacity < 0.1 ||
    !playedAfterEdit.visibleScenes.includes("brand") ||
    !playedAfterEdit.translate.includes("32px") ||
    playedAfterEdit.motionTransform === editedBeforePlay.motionTransform
  )
    throw new Error(
      `Editing before Play erased the composition: ${JSON.stringify({ editedBeforePlay, playedAfterEdit })}`,
    );
  await browser.evaluate(
    "document.querySelector('button[aria-label=Pause]')?.click()",
  );

  const skipExport = process.env["MOTIONLY_QA_SKIP_EXPORT"] === "1";
  const exportButton = skipExport
    ? { found: true, disabled: false, text: "Skipped for motion QA" }
    : await browser.evaluate(`(() => {
        const button = document.querySelector('.export-action');
        const state = { found: Boolean(button), disabled: Boolean(button?.disabled), text: button?.textContent?.trim() ?? '' };
        button?.click();
        return state;
      })()`);
  const exportMessages = [];
  for (let attempt = 0; !skipExport && attempt < 240; attempt += 1) {
    const message = await browser.evaluate(
      "document.querySelector('.notice')?.textContent ?? ''",
    );
    if (message && exportMessages.at(-1) !== message)
      exportMessages.push(message);
    if (message.includes("Export successful")) break;
    if (attempt === 239)
      throw new Error(
        `Frame export did not complete: ${JSON.stringify({ exportButton, exportMessages, errors: browser.errors })}`,
      );
    await wait(100);
  }

  const result = {
    masterTimeline,
    localTimeline,
    introCentering,
    productProof,
    textPanel,
    sourcePanel,
    playback: {
      before: motionBeforePlay,
      ...playback,
      targetChanged,
      scrubbedBeforePlay,
      scrubbedAfterPlay,
      rapidScrubPlayback,
    },
    frames,
    handoffs,
    cameraMotion,
    ambientMotion,
    studioTimelineMotion,
    errors: browser.errors,
    warnings: browser.warnings,
  };
  if (result.errors.length || result.warnings.length)
    throw new Error(JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  if (preview?.child.exitCode === null) preview.child.kill();
}

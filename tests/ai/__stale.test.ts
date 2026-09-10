/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { repairGeneratedMarkup } from "../../src/ai/auto-repair";
import { parseAiResponseText } from "../../src/ai/direct-ai";
import {
  analyzeMotionQuality,
  buildMotionlyUserMessage,
} from "../../src/ai/generation-guidance";
import { resolveGenerationBasis } from "../../src/ai/generation-basis";
import { blankProjectFiles } from "../../src/ui/blank-project";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import { validateGeneratedComposition } from "../../src/ai/validate-generation";

const LIVE = process.env["MOTIONLY_REPRO"] === "1";
function env(n: string): string {
  // These specs are gated behind MOTIONLY_REPRO, but this runs at module scope
  // to build the describe title, so it executes even when they will be skipped.
  // A machine without a local .env - CI, or a fresh clone - must not fail the
  // whole file on a value only the live run uses.
  let file: string;
  try {
    file = readFileSync(".env", "utf8");
  } catch {
    return "";
  }
  const m = new RegExp(`^${n}=(.*)$`, "m").exec(file);
  return (m?.[1] ?? "").trim();
}
const MODEL = process.env["EVAL_MODEL"] || env("VITE_GEMINI_MODEL");
const PROMPTS = [
  "Create a cinematic product launch video for Motionly highlighting AI generated motion graphics",
  "Make a 20 second ad for Sentinel, an AI security scanner for websites.",
  "make an ad for my project management app",
];

describe.skipIf(!LIVE)(`stale-layer check on ${MODEL}`, () => {
  for (const [i, prompt] of PROMPTS.entries()) {
    it(`run ${i + 1}`, { timeout: 400000 }, async () => {
      const basis = resolveGenerationBasis(blankProjectFiles, {
        id: "blank-composition",
        duration: 5,
        scenes: [
          {
            id: "main",
            label: "Main",
            start: 0,
            duration: 5,
            accent: "#7657ff",
          },
        ],
      });
      const msg = await buildMotionlyUserMessage(prompt, {
        compositionHtml: basis.files["composition.html"],
        timelineJs: basis.files["timeline.js"],
        generationProfile: basis.generationProfile,
      });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env("VITE_GEMINI_API_KEY")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: MOTIONLY_SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: msg }] }],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0.65,
              maxOutputTokens: 65536,
            },
          }),
        },
      );
      if (!res.ok) {
        console.log(`  run ${i + 1}: HTTP ${res.status}`);
        return;
      }
      const body = await res.json();
      const text = body.candidates?.[0]?.content?.parts?.find(
        (x: { text?: string }) => typeof x.text === "string",
      )?.text;
      const out = repairGeneratedMarkup(parseAiResponseText(text)).result;
      const r = analyzeMotionQuality(out, { prompt });
      let verdict: string;
      try {
        const v = validateGeneratedComposition(out, {
          prompt,
          previousHtml: basis.files["composition.html"],
          previousDuration: basis.duration,
          previousScenes: basis.scenes,
          generationProfile: basis.generationProfile,
        });
        verdict = `RENDERS OK (${v.duration}s, ${v.warnings.length} warnings)`;
      } catch (e) {
        verdict = `THREW: ${(e as Error).message.slice(0, 110)}`;
      }
      const clears = (
        out.timelineJs.match(
          /autoAlpha\s*:\s*0|visibility\s*:\s*["']hidden|display\s*:\s*["']none/g,
        ) ?? []
      ).length;
      console.log(
        `\n  run ${i + 1} | score ${r.score} blocking ${r.blockingIssues.length} | scene-clearing calls: ${clears}`,
      );
      console.log(`  ${verdict}`);
    });
  }
});

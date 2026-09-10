// This harness reports to the console on purpose: its whole output is the
// read on what the live model produces.
/* eslint-disable no-console */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repairGeneratedMarkup } from "../../src/ai/auto-repair";
import {
  DEFAULT_GEMINI_MODEL,
  isImprovement,
  parseAiResponseText,
} from "../../src/ai/direct-ai";
import {
  analyzeMotionQuality,
  buildMotionlyUserMessage,
  buildQualityRepairPrompt,
  editIdsIn,
  type GeneratedComposition,
  type MotionQualityReport,
} from "../../src/ai/generation-guidance";
import {
  foundationHtml,
  foundationScenes,
  foundationTimeline,
} from "../../src/ai/generation-foundation";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import { validateGeneratedComposition } from "../../src/ai/validate-generation";

/**
 * A live read on what the shipping model actually produces for the request
 * Motionly is sold on: a SaaS product ad. It costs real API calls, so it runs
 * only when asked:
 *
 *   MOTIONLY_LIVE_EVAL=1 npx vitest run tests/ai/live-generation.test.ts
 *
 * Set MOTIONLY_EVAL_MODEL to compare models and MOTIONLY_EVAL_RUNS to change
 * how many prompts are exercised. Each run writes its composition to
 * tests/.eval-output so the film can be opened and watched, because a score is
 * not a substitute for looking at the thing.
 */

const LIVE = process.env["MOTIONLY_LIVE_EVAL"] === "1";
const OUTPUT_DIR = "tests/.eval-output";

function envValue(name: string): string {
  const inherited = process.env[name];
  if (inherited?.trim()) return inherited.trim();
  try {
    const match = new RegExp(`^${name}=(.*)$`, "m").exec(
      readFileSync(".env", "utf8"),
    );
    return (match?.[1] ?? "").trim();
  } catch {
    return "";
  }
}

const MODEL = envValue("MOTIONLY_EVAL_MODEL") || DEFAULT_GEMINI_MODEL;

interface GeminiBody {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

async function callGemini(
  userMessage: string,
  temperature: number,
): Promise<GeneratedComposition> {
  const key = envValue("VITE_GEMINI_API_KEY");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: MOTIONLY_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature,
          maxOutputTokens: 65536,
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(`${response.status}: ${await response.text()}`);
  const body = (await response.json()) as GeminiBody;
  const text = body.candidates?.[0]?.content?.parts?.find(
    (part) => typeof part.text === "string",
  )?.text;
  if (!text) throw new Error("Gemini returned no text part.");
  return parseAiResponseText(text);
}

/** Reads like a real ad for a real product, or like filler? */
function slopSignals(result: GeneratedComposition): Record<string, unknown> {
  const html = result.compositionHtml;
  const text = Array.from(html.matchAll(/>([^<>{}]{3,})</g))
    .map((match) => (match[1] ?? "").trim())
    .filter((value) => /[a-z]/i.test(value) && !value.includes(":"));
  const count = (pattern: RegExp): number => (html.match(pattern) ?? []).length;
  const presets =
    result.timelineJs.match(
      /\b(?:giantKineticCrop|waterfallTextReveal|wordSlideRotate|charSpringBounce|textReveal|morph|matchCut|cutTheCurve|zoomThrough|inverseZoomThrough|cameraPush|cameraPull|cameraZoomPan|stepSurgeCounter|perspectiveCardReveal|ambientWaves|motionArc|squashAndStretch)\s*\(/g,
    ) ?? [];
  return {
    htmlBytes: html.length,
    timelineBytes: result.timelineJs.length,
    sceneCount: result.scenes?.length ?? 0,
    copyLines: text.length,
    longestCopy:
      text.sort((a, b) => b.length - a.length)[0]?.slice(0, 70) ?? "",
    cards: count(/class=["'][^"']*\bcard\b/gi),
    editableIds: count(/data-edit=["']/g),
    hasCameraWorld: /data-camera-world/i.test(html),
    presetCalls: presets.length,
    distinctPresets: [...new Set(presets.map((call) => call.replace("(", "")))],
    genericBuzzwords: [
      "seamlessly",
      "unlock",
      "supercharge",
      "revolutionize",
      "next-generation",
      "cutting-edge",
      "empower",
      "elevate your",
    ].filter((word) => new RegExp(word, "i").test(html)),
  };
}

function summarize(label: string, report: MotionQualityReport): void {
  console.log(`\n  ${label}`);
  console.log(`    score ${report.score}  repair? ${report.requiresRepair}`);
  if (report.blockingIssues.length) {
    console.log(`    BLOCKING (${report.blockingIssues.length}):`);
    for (const issue of report.blockingIssues) console.log(`      ! ${issue}`);
  }
  const advisory = report.issues.filter(
    (issue) => !report.blockingIssues.includes(issue),
  );
  console.log(`    advisory (${advisory.length}):`);
  for (const issue of advisory) console.log(`      - ${issue.slice(0, 110)}`);
  console.log(`    strengths (${report.strengths.length}):`);
  for (const strength of report.strengths) console.log(`      + ${strength}`);
}

/**
 * The shipped pipeline, run against the live model: generate, score, repair up
 * to the cap, keep only passes that improve the report. Mirrors
 * generateWithDirectAi so the harness measures what users actually get.
 */
async function generateLikeProduction(
  label: string,
  prompt: string,
  files: Parameters<typeof buildMotionlyUserMessage>[1],
  context: Parameters<typeof analyzeMotionQuality>[1],
): Promise<GeneratedComposition> {
  // Opt-in replay of a captured failure lets a direction change be evaluated
  // against the same bad film instead of buying another unrelated first draw.
  const replayPath = process.env["MOTIONLY_EVAL_REPLAY"];
  const replay = replayPath
    ? (JSON.parse(readFileSync(replayPath, "utf8")) as {
        prompt: string;
        best: GeneratedComposition;
      })
    : undefined;
  if (replay && replay.prompt !== prompt)
    throw new Error("Replay brief does not match this evaluation request");
  let best = repairGeneratedMarkup(
    replay?.best ??
      (await callGemini(await buildMotionlyUserMessage(prompt, files), 0.65)),
  ).result;
  let report = analyzeMotionQuality(best, context);
  summarize(`${label} — pass 1`, report);

  for (let pass = 1; pass <= 2 && report.requiresRepair; pass += 1) {
    const candidate = repairGeneratedMarkup(
      await callGemini(
        await buildMotionlyUserMessage(
          buildQualityRepairPrompt(prompt, best, report),
          {
            ...files,
            generationProfile: "existing",
            directionPrompt: prompt,
            compositionHtml: best.compositionHtml,
            timelineJs: best.timelineJs,
          },
        ),
        0.35,
      ),
    ).result;
    const candidateReport = analyzeMotionQuality(candidate, context);
    summarize(`${label} — pass ${pass + 1} (repair)`, candidateReport);
    // The shipping rule, not a copy of it: a harness that accepts passes
    // production would reject measures a pipeline nobody runs.
    if (!isImprovement(candidateReport, report)) break;
    best = candidate;
    report = candidateReport;
  }
  return best;
}

const PROMPTS: readonly { readonly id: string; readonly text: string }[] = [
  {
    id: "linear-sprint",
    text: "Make a 20 second SaaS product ad for Linear, the issue tracker for software teams. Show someone filing a bug from Slack, the issue landing in the sprint board, and the team shipping it. End on the Linear wordmark.",
  },
  {
    id: "stripe-billing",
    text: "Make a 20 second SaaS ad for a billing platform called Meterly. Show a founder switching a plan from seat-based to usage-based pricing, the invoice preview updating live, and revenue climbing. Close on the Meterly logo and 'Billing that keeps up'.",
  },
  {
    id: "notion-docs",
    text: "Make a 20 second product film for Vault, a team knowledge base. Show someone asking a question in the search bar, the answer assembling from three real documents, and the team reading it together. Finish on the Vault mark.",
  },
  {
    // The prompt shape most users actually type: no beats, no brand, no
    // direction. If anything produces generic slop, it is this.
    id: "terse-brief",
    text: "make an ad for my project management app",
  },
];

describe.skipIf(!LIVE)(`live SaaS ad generation on ${MODEL}`, () => {
  const runCount = Number(process.env["MOTIONLY_EVAL_RUNS"] ?? PROMPTS.length);

  for (const prompt of PROMPTS.slice(0, runCount)) {
    it(
      `produces a usable film for ${prompt.id}`,
      { timeout: 300000 },
      async () => {
        const files = {
          compositionHtml: foundationHtml,
          timelineJs: foundationTimeline,
          generationProfile: "claude-foundation-v1" as const,
        };
        const best = await generateLikeProduction(
          prompt.id,
          prompt.text,
          files,
          {
            prompt: prompt.text,
          },
        );
        const report = analyzeMotionQuality(best, { prompt: prompt.text });

        console.log(
          `\n  ${prompt.id} — content signals`,
          JSON.stringify(slopSignals(best), null, 2).split("\n").join("\n  "),
        );

        let renderError = "";
        try {
          validateGeneratedComposition(best, {
            prompt: prompt.text,
            previousHtml: foundationHtml,
            previousDuration: 20,
            previousScenes: foundationScenes,
            generationProfile: "claude-foundation-v1",
          });
        } catch (error: unknown) {
          renderError = error instanceof Error ? error.message : String(error);
        }
        console.log(`\n  ${prompt.id} — render: ${renderError || "OK"}`);

        mkdirSync(OUTPUT_DIR, { recursive: true });
        writeFileSync(
          `${OUTPUT_DIR}/${prompt.id}.json`,
          JSON.stringify(
            { model: MODEL, prompt: prompt.text, report, renderError, best },
            null,
            2,
          ),
        );

        // The floor this whole pipeline exists to guarantee: the user gets a
        // film that runs. Everything softer is read from the log above.
        expect(renderError).toBe("");
      },
    );
  }

  it(
    "keeps a follow-up edit runnable without losing the user's layers",
    { timeout: 300000 },
    async () => {
      const firstPrompt = PROMPTS[0]?.text ?? "";
      const first = await generateLikeProduction(
        "follow-up setup",
        firstPrompt,
        {
          compositionHtml: foundationHtml,
          timelineJs: foundationTimeline,
          generationProfile: "claude-foundation-v1",
        },
        { prompt: firstPrompt },
      );
      const firstScenes = validateGeneratedComposition(first, {
        prompt: firstPrompt,
        previousHtml: foundationHtml,
        previousDuration: 20,
        previousScenes: foundationScenes,
        generationProfile: "claude-foundation-v1",
      });

      // The second turn is an edit, so the film on screen is now the user's
      // work and every one of its layers must survive. Dropping one is a
      // blocking failure, so this exercises the repair loop that ships.
      const followUp = "make the closing brand moment hold longer";
      const editFiles = {
        compositionHtml: first.compositionHtml,
        timelineJs: first.timelineJs,
        generationProfile: "existing" as const,
      };
      // Pretend the user nudged two layers in the editor: exactly those are
      // unrecoverable, and the rest is the model's own footage to re-cut.
      const handEdited = editIdsIn(first.compositionHtml).slice(0, 2);
      const editContext = {
        prompt: followUp,
        protectedEditIds: handEdited,
        previousEditIds: editIdsIn(first.compositionHtml),
      };

      const second = await generateLikeProduction(
        "follow-up edit",
        followUp,
        editFiles,
        editContext,
      );

      let editError = "";
      try {
        validateGeneratedComposition(second, {
          prompt: followUp,
          previousHtml: first.compositionHtml,
          previousDuration: firstScenes.duration,
          previousScenes: firstScenes.scenes,
          generationProfile: "existing",
          userEditedIds: handEdited,
        });
      } catch (error: unknown) {
        editError = error instanceof Error ? error.message : String(error);
      }
      console.log(`\n  follow-up edit — render: ${editError || "OK"}`);
      mkdirSync(OUTPUT_DIR, { recursive: true });
      writeFileSync(
        `${OUTPUT_DIR}/follow-up-edit.json`,
        JSON.stringify({ model: MODEL, followUp, editError, second }, null, 2),
      );
      expect(editError).toBe("");
    },
  );
});

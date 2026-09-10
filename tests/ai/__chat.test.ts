/* eslint-disable no-console */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { describe, it } from "vitest";
import { repairGeneratedMarkup } from "../../src/ai/auto-repair";
import { parseAiResponseText } from "../../src/ai/direct-ai";
import {
  analyzeMotionQuality,
  buildMotionlyUserMessage,
  buildFilmShapeBrief,
} from "../../src/ai/generation-guidance";
import { resolveGenerationBasis } from "../../src/ai/generation-basis";
import { blankProjectFiles } from "../../src/ui/blank-project";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import { validateGeneratedComposition } from "../../src/ai/validate-generation";
import { splitCompositionSource } from "../../src/cloud/project-source";
import { createGeneratedAdapterSource } from "../../src/composition/generated-adapter";

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
const PROMPT = "Make a motion graphic of user chatting to claude";

describe.skipIf(!LIVE)(`chat request on ${MODEL}`, () => {
  it("generates", { timeout: 400000 }, async () => {
    console.log(
      "\n" + buildFilmShapeBrief(PROMPT).split("\n").slice(0, 2).join("\n"),
    );
    const basis = resolveGenerationBasis(blankProjectFiles, {
      id: "blank-composition",
      duration: 5,
      scenes: [
        { id: "main", label: "Main", start: 0, duration: 5, accent: "#7657ff" },
      ],
    });
    const msg = await buildMotionlyUserMessage(PROMPT, {
      compositionHtml: basis.files["composition.html"],
      timelineJs: basis.files["timeline.js"],
      generationProfile: basis.generationProfile,
    });
    for (let attempt = 1; attempt <= 4; attempt++) {
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
        console.log(`  attempt ${attempt}: HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 8000));
        continue;
      }
      const body = await res.json();
      const text = body.candidates?.[0]?.content?.parts?.find(
        (x: { text?: string }) => typeof x.text === "string",
      )?.text;
      const out = repairGeneratedMarkup(parseAiResponseText(text)).result;
      const r = analyzeMotionQuality(out, { prompt: PROMPT });
      console.log(
        `  score ${r.score} | blocking ${r.blockingIssues.length} | advisory ${r.issues.length - r.blockingIssues.length}`,
      );
      for (const i of r.blockingIssues) console.log("    ! " + i.slice(0, 95));
      console.log(`  title: ${out.title} | ${out.duration}s`);
      console.log(
        `  scenes: ${(out.scenes ?? []).map((s) => s.label).join(" | ")}`,
      );
      console.log(
        `  html ${out.compositionHtml.length}b | timeline ${out.timelineJs.length}b | hyperframe ${(out.compositionHtml.match(/data-hyperframe-component/g) ?? []).length}`,
      );
      const v = validateGeneratedComposition(out, {
        prompt: PROMPT,
        previousHtml: basis.files["composition.html"],
        previousDuration: basis.duration,
        previousScenes: basis.scenes,
        generationProfile: basis.generationProfile,
      });
      console.log(
        `  RENDERS OK ${v.duration}s warnings: ${JSON.stringify(v.warnings)}`,
      );
      const adapter = createGeneratedAdapterSource({
        id: "dynamic-comp-chat",
        title: out.title || "Chat",
        duration: v.duration,
        scenes: v.scenes,
        width: 1920,
        height: 1080,
        fps: 60,
      });
      const files = splitCompositionSource(
        out.compositionHtml,
        out.timelineJs,
        adapter,
      );
      mkdirSync("tests/.render", { recursive: true });
      writeFileSync(
        "tests/.render/draft.json",
        JSON.stringify({
          version: 1,
          updatedAt: Date.now(),
          files,
          messages: [],
          assets: [],
          editorState: {},
          metadata: {
            title: out.title,
            duration: v.duration,
            scenes: v.scenes,
          },
        }),
      );
      writeFileSync(
        "tests/.render/meta.json",
        JSON.stringify({
          title: out.title,
          duration: v.duration,
          warnings: v.warnings,
        }),
      );
      return;
    }
    console.log("  all attempts rate-limited");
  });
});

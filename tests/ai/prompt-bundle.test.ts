// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  buildPrompt,
  compilePrompt,
  PROMPT_SOURCES,
  PROMPT_OUTPUT,
} from "../../scripts/build-ai-prompt.mjs";
import {
  MOTIONLY_PROMPT_HASH,
  MOTIONLY_PROMPT_SOURCES,
  MOTIONLY_SYSTEM_PROMPT,
} from "../../src/ai/prompt";
import { MOTIONLY_SYSTEM_PROMPT as generated } from "../../src/ai/generated/prompt";

const fixtures: string[] = [];
afterEach(async () => {
  await Promise.all(
    fixtures
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "motionly-prompt-test-"));
  fixtures.push(root);
  for (const path of PROMPT_SOURCES) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(
      join(root, path),
      path.endsWith("SKILL.md")
        ? "---\nname: write-motionly\ndescription: Fixture\n---\nSkill with `ticks`, ${expressions}, and \\slashes.\n"
        : "Runtime law.\n",
    );
  }
  return root;
}

describe("build-time skill bundle", () => {
  it("ships the complete current skill through the stable import boundary", async () => {
    expect(generated).toBe(MOTIONLY_SYSTEM_PROMPT);
    expect(MOTIONLY_PROMPT_SOURCES).toEqual(PROMPT_SOURCES);
    expect(MOTIONLY_PROMPT_HASH).toMatch(/^[a-f0-9]{64}$/);
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(MOTIONLY_PROMPT_HASH);
    const skill = (await readFile(resolve(PROMPT_SOURCES[1]!), "utf8"))
      .replace(/\r\n?/g, "\n")
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .trim();
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(skill);
    await expect(buildPrompt({ check: true })).resolves.toMatchObject({
      changed: false,
    });
  });

  it("normalizes platform line endings and safely serializes executable-looking text", async () => {
    const root = await fixture();
    const sources = await Promise.all(
      PROMPT_SOURCES.map(async (path) => ({
        path,
        content: await readFile(join(root, path), "utf8"),
      })),
    );
    const lf = compilePrompt(sources);
    const crlf = compilePrompt(
      sources.map((source) => ({
        ...source,
        content: "\uFEFF" + source.content.replace(/\n/g, "\r\n"),
      })),
    );
    expect(crlf).toBe(lf);
    const literal = lf.match(
      /export const MOTIONLY_SYSTEM_PROMPT = (.*);/,
    )![1]!;
    expect(JSON.parse(literal)).toContain(
      "`ticks`, ${expressions}, and \\slashes.",
    );
    expect(JSON.parse(literal)).not.toContain("description: Fixture");
  });

  it("detects changed source without rewriting, then regenerates a new version", async () => {
    const root = await fixture();
    await buildPrompt({ root });
    const before = await readFile(join(root, PROMPT_OUTPUT), "utf8");
    await writeFile(
      join(root, PROMPT_SOURCES[1]!),
      "Changed creative skill.\n",
    );
    await expect(buildPrompt({ root, check: true })).rejects.toThrow("stale");
    expect(await readFile(join(root, PROMPT_OUTPUT), "utf8")).toBe(before);
    await buildPrompt({ root });
    const after = await readFile(join(root, PROMPT_OUTPUT), "utf8");
    expect(after.match(/MOTIONLY_PROMPT_HASH = (.*);/)![1]).not.toBe(
      before.match(/MOTIONLY_PROMPT_HASH = (.*);/)![1],
    );
    await expect(buildPrompt({ root, check: true })).resolves.toMatchObject({
      changed: false,
    });
  });

  it("fails on missing output or missing authoritative source", async () => {
    const root = await fixture();
    await expect(buildPrompt({ root, check: true })).rejects.toThrow(
      "missing or stale",
    );
    await rm(join(root, PROMPT_SOURCES[1]!));
    await expect(buildPrompt({ root })).rejects.toThrow("ENOENT");
  });

  it("includes a strict JSON contract with skills and existing editor fields", () => {
    const schema = JSON.parse(
      MOTIONLY_SYSTEM_PROMPT.match(/```json\n([\s\S]*?)\n```/)![1]!,
    );
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual([
      "title",
      "duration",
      "skills",
      "scenes",
      "direction",
      "seams",
      "techniques",
      "compositionHtml",
      "timelineJs",
      "reply",
    ]);
    expect(schema.properties.skills.items.const).toBe("write-motionly");
    expect(schema.properties.direction.items.required).toContain(
      "cameraTarget",
    );
    expect(schema.properties.techniques.items.properties.handoff.enum).toEqual([
      "morph",
      "match-cut",
      "particle-reassemble",
      "final-hold",
    ]);
  });
});

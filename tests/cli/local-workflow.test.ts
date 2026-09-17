import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cli = resolve("bin/motionly.js");

function run(args: string[], cwd: string) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
}

async function freePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("No test port."));
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function waitForProject(port: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/local-project`,
      );
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((done) => setTimeout(done, 50));
  }
  throw lastError ?? new Error("Local Motify server did not start.");
}

describe("Motify local CLI", () => {
  let workspace = "";

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "motionly-cli-test-"));
  });

  afterEach(async () => {
    await rm(workspace, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  });

  it("creates a v2 project and installs the selected agent skills", async () => {
    const result = run(
      ["init", "demo", "--provider", "codex", "--no-open"],
      workspace,
    );
    expect(result.status, result.stderr).toBe(0);
    await expect(
      readFile(join(workspace, "demo", "composition.html"), "utf8"),
    ).resolves.toContain("<template");
    await expect(
      readFile(join(workspace, "demo", "styles.css"), "utf8"),
    ).resolves.toContain("Optional");
    await expect(
      readFile(join(workspace, "demo", "timeline.js"), "utf8"),
    ).resolves.toContain("buildTimeline");
    await expect(
      readFile(join(workspace, "demo", "index.ts"), "utf8"),
    ).resolves.toContain("motionlyMetadata");
    await expect(
      readFile(
        join(
          workspace,
          "demo",
          ".agents",
          "skills",
          "write-motionly",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).resolves.toContain("name: write-motionly");
    await expect(
      readFile(
        join(
          workspace,
          "demo",
          ".agents",
          "skills",
          "scene-design",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).resolves.toContain("name: scene-design");
  });

  it("updates an existing skill without replacing it during add", async () => {
    const project = join(workspace, "project");
    const target = join(
      project,
      ".agents",
      "skills",
      "write-motionly",
      "SKILL.md",
    );
    expect(
      run(["init", project, "--skip-skills", "--no-open"], workspace).status,
    ).toBe(0);
    expect(run(["skills", "add", "--provider", "codex"], project).status).toBe(
      0,
    );
    await writeFile(target, "user copy", "utf8");
    expect(run(["skills", "add", "--provider", "codex"], project).status).toBe(
      0,
    );
    await expect(readFile(target, "utf8")).resolves.toBe("user copy");
    expect(
      run(["skills", "update", "--provider", "codex"], project).status,
    ).toBe(0);
    await expect(readFile(target, "utf8")).resolves.toContain(
      "name: write-motionly",
    );
  });

  it("serves and saves the same four authored project files", async () => {
    const project = join(workspace, "project");
    expect(
      run(["init", project, "--skip-skills", "--no-open"], workspace).status,
    ).toBe(0);
    await writeFile(join(project, "assets", "logo.svg"), "<svg></svg>", "utf8");
    const port = await freePort();
    let child: ChildProcess | undefined;
    try {
      child = spawn(
        process.execPath,
        [cli, "dev", project, "--port", String(port), "--no-open"],
        {
          cwd: workspace,
          stdio: "ignore",
          windowsHide: true,
        },
      );
      const response = await waitForProject(port);
      const payload = (await response.json()) as {
        name: string;
        files: Record<string, string>;
        metadata: { title: string; duration: number; scenes: unknown[] };
      };
      expect(payload.name).toBe("project");
      expect(payload.metadata.title).toBe("project");
      expect(payload.metadata.duration).toBe(6);
      expect(payload.metadata.scenes).toHaveLength(2);
      expect(
        (payload as typeof payload & { assets: string[] }).assets,
      ).toContain("logo.svg");

      payload.files["composition.html"] =
        payload.files["composition.html"]?.replace(
          "Build the moment.",
          "Saved locally.",
        ) ?? "";
      const save = await fetch(`http://127.0.0.1:${port}/api/local-project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: payload.files }),
      });
      expect(save.status).toBe(204);
      await expect(
        readFile(join(project, "composition.html"), "utf8"),
      ).resolves.toContain("Saved locally.");

      const editor = await fetch(`http://127.0.0.1:${port}/`);
      expect(editor.status).toBe(200);
      expect(await editor.text()).toContain("Motify");
      const localEditor = await fetch(`http://127.0.0.1:${port}/index.html`);
      expect(await localEditor.text()).toContain(
        'name="motify-mode" content="local"',
      );

      const ai = await fetch(`http://127.0.0.1:${port}/api/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localProviderRequest: {
            systemPrompt: "test",
            userMessage: "test",
            temperature: 0,
          },
        }),
      });
      expect(ai.status).toBe(500);
      await expect(ai.json()).resolves.toEqual({
        error: "Missing GEMINI_API_KEY in the local project's .env file.",
      });
    } finally {
      if (child && child.exitCode === null) {
        const closed = new Promise<void>((done) =>
          child?.once("close", () => done()),
        );
        child.kill();
        await closed;
      }
    }
  });
});

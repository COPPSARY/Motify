import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithDirectAi } from "../../src/ai/direct-ai";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import generateHandler from "../../api/ai/generate";
import {
  foundationHtml,
  foundationTimeline,
} from "../../src/ai/generation-foundation";

/** A film that clears every blocking check: the shape a good pass returns. */
function soundComposition(reply: string) {
  return {
    title: "Launch film",
    duration: 20,
    skills: ["write-motionly"],
    compositionHtml: foundationHtml,
    timelineJs: foundationTimeline,
    reply,
  };
}

/**
 * A sound film that also places the supplied logo. A film that leaves an
 * attached image unused is repaired again, however good the rest of it is, so
 * a test about repair passes has to satisfy that rule to settle.
 */
function soundCompositionWithAsset(reply: string) {
  const composition = soundComposition(reply);
  return {
    ...composition,
    compositionHtml: composition.compositionHtml.replace(
      "</template>",
      '<img data-edit="logo" src="__ASSET_1__" alt="logo" /></template>',
    ),
  };
}

/** Fails "nothing moves" and drops both markup markers. */
function brokenComposition(reply: string) {
  return {
    title: "Launch film",
    duration: 8,
    compositionHtml: `<template><main data-edit="stage"><h1 data-edit="headline">Ship faster</h1></main></template>`,
    timelineJs: `export function buildTimeline({ timeline }) {
      timeline.set(headline, { autoAlpha: 0 }, 0);
      timeline.to(headline, { autoAlpha: 1, duration: 1 }, 0.4);
    }`,
    reply,
  };
}

/** What the direction turn returns: a plan, and not one line of code. */
function filmDirection() {
  return {
    shape: "transformation",
    subject: "A tracker that turns scattered reports into filed work",
    ground: "warm off-white, one accent, generous negative space",
    typeTreatment: "one full-size sentence per beat, entering cropped",
    chain: ["reports scattered", "one is captured", "the work is filed"],
    beats: [
      {
        id: "scene-01",
        label: "01 - scattered",
        start: 0,
        duration: 10,
        shot: "reports crowding the frame",
        camera: "wide, drifting in",
        primary: "the pile converges",
      },
      {
        id: "scene-02",
        label: "02 - filed",
        start: 10,
        duration: 10,
        shot: "one filed issue at reading size",
        camera: "close, pulling back",
        primary: "the issue resolves",
      },
    ],
    seams: [
      {
        from: "scene-01",
        to: "scene-02",
        at: 9.4,
        duration: 1.2,
        carrier: "story-carrier",
        mechanism: "morph",
        becomes: "the pile becomes the filed issue",
      },
    ],
    close: "the mark on open ground",
    avoid: "a dashboard with feature cards",
  };
}

function geminiResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  } as unknown as Response;
}

function openAiResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => ({
      choices: [
        { message: { role: "assistant", content: JSON.stringify(payload) } },
      ],
    }),
  } as unknown as Response;
}

describe("directed generation with self-repair", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("VITE_AI_PROVIDER", "gemini");
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    // These cover provider routing, not the account gate: with no session
    // service configured the route is ungated, as in a self-hosted editor.
    vi.stubEnv("MOTIFY_API_URL", "");
    vi.stubEnv("VITE_MOTIFY_API_URL", "");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    localStorage.removeItem("motionly_gemini_api_key");
    localStorage.removeItem("motionly_ai_provider");
    localStorage.removeItem("motionly_openai_api_key");
    localStorage.removeItem("motionly_openai_model");
    localStorage.removeItem("motionly_openai_base_url");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("switches direct generation to a CodeCraft OpenAI-compatible request", async () => {
    vi.stubEnv("VITE_AI_PROVIDER", "openai-compatible");
    vi.stubEnv("VITE_OPENAI_COMPATIBLE_API_KEY", "cc_test-key");
    vi.stubEnv("VITE_OPENAI_COMPATIBLE_MODEL", "claude-opus-4.8");
    vi.stubEnv(
      "VITE_OPENAI_COMPATIBLE_BASE_URL",
      "https://codecraftapi.com/v1",
    );
    fetchMock.mockResolvedValue(openAiResponse(soundComposition("Built.")));

    await generateWithDirectAi("make a product tour", {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://codecraftapi.com/v1/chat/completions",
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      Authorization: "Bearer cc_test-key",
    });
    const payload = JSON.parse(String(init.body));
    expect(payload.model).toBe("claude-opus-4.8");
    expect(payload.messages[0]).toEqual({
      role: "system",
      content: MOTIONLY_SYSTEM_PROMPT,
    });
    expect(payload.messages[1].role).toBe("user");
    expect(payload.messages[1].content).toContain("make a product tour");
    expect(payload.response_format).toEqual({ type: "json_object" });
  });

  it("sends an existing cloud project to the backend and reads its saved source", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { user: { id: "user" }, csrfToken: "csrf-token" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              type: "generation",
              response: "Built the launch film.",
              projectId: "project-1",
              revision: 2,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              "composition.html": foundationHtml,
              "timeline.js": foundationTimeline,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { duration: 12 } }), {
          status: 200,
        }),
      );

    const result = await generateWithDirectAi("make a product tour", {
      backendProjectId: "project-1",
      assets: [
        {
          id: "local-logo",
          uploadId: "11111111-1111-4111-8111-111111111111",
          name: "logo.png",
          mimeType: "image/png",
          dataBase64: "aGVsbG8=",
          token: "motionly-asset://local-logo",
          intent: "asset",
        },
      ],
    });

    expect(result.reply).toContain("Built the launch film.");
    expect(result.duration).toBe(12);
    expect((fetchMock.mock.calls[1]?.[0] as URL).pathname).toBe(
      "/v1/projects/project-1/messages",
    );
    expect(
      JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)),
    ).toMatchObject({
      message: "make a product tour",
      assets: [
        { assetId: "11111111-1111-4111-8111-111111111111", role: "asset" },
      ],
    });
    expect((fetchMock.mock.calls[2]?.[0] as URL).pathname).toBe(
      "/v1/projects/project-1/source",
    );
    expect((fetchMock.mock.calls[3]?.[0] as URL).pathname).toBe(
      "/v1/projects/project-1",
    );
  });

  it("repairs a backend project once from what the frames show", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { user: { id: "user" }, csrfToken: "csrf-token" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              type: "generation",
              response: "Built the launch film.",
              projectId: "project-1",
              revision: 2,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              "composition.html": foundationHtml,
              "timeline.js": foundationTimeline,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { duration: 12 } }), {
          status: 200,
        }),
      );

    // Every later call resolves, so nothing but the pass limit stops the loop.
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            type: "generation",
            response: "Repaired the launch film.",
            projectId: "project-1",
            revision: 3,
            "composition.html": foundationHtml,
            "timeline.js": foundationTimeline,
            duration: 12,
          },
        }),
        { status: 200 },
      ),
    );

    await generateWithDirectAi(
      "make a product tour",
      { backendProjectId: "project-1" },
      undefined,
      () => ({
        ok: false as const,
        message: "A non-fatal visual note.",
        fatal: false,
      }),
    );

    /**
     * The backend already repairs what it can read in the source. Only the
     * browser can say what the frames show, so a visual note buys exactly one
     * more backend generation - not none, and not the three a local project
     * would spend.
     */
    const messagePosts = fetchMock.mock.calls.filter(
      (call) =>
        String((call[0] as URL).pathname) === "/v1/projects/project-1/messages",
    );
    expect(messagePosts).toHaveLength(2);
    expect(
      JSON.parse(String((messagePosts[1]?.[1] as RequestInit).body)).message,
    ).toContain("A non-fatal visual note.");
  });

  it("sends attached images in the OpenAI-compatible vision format", async () => {
    vi.stubEnv("VITE_AI_PROVIDER", "openai-compatible");
    vi.stubEnv("VITE_OPENAI_COMPATIBLE_API_KEY", "cc_test-key");
    vi.stubEnv(
      "VITE_OPENAI_COMPATIBLE_BASE_URL",
      "https://codecraftapi.com/v1",
    );
    fetchMock.mockResolvedValue(openAiResponse(soundComposition("Built.")));

    await generateWithDirectAi("use this logo", {
      assets: [
        {
          id: "asset-1",
          name: "logo.png",
          mimeType: "image/png",
          dataBase64: "aGVsbG8=",
          token: "__ASSET_1__",
        },
      ],
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    expect(payload.messages[1].content).toEqual(
      expect.arrayContaining([
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,aGVsbG8=" },
        },
      ]),
    );
  });

  it("uses the selected OpenAI-compatible provider in the Vercel route", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("OPENAI_COMPATIBLE_API_KEY", "cc_server-key");
    vi.stubEnv("OPENAI_COMPATIBLE_MODEL", "claude-opus-4.8");
    vi.stubEnv("OPENAI_COMPATIBLE_BASE_URL", "https://codecraftapi.com/v1");
    fetchMock.mockResolvedValue(
      openAiResponse(soundComposition("Server result.")),
    );

    const response = await generateHandler(
      new Request("http://localhost/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          provider: "gemini",
          model: "user-chosen-model",
          userPrompt: "A launch film",
          currentFiles: {},
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://codecraftapi.com/v1/chat/completions",
    );
    expect((await response.json()).skills).toEqual(["write-motionly"]);
  });

  it("leaves provider selection to the backend when no deployment browser key exists", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    localStorage.setItem("motionly_ai_provider", "openai-compatible");
    localStorage.setItem("motionly_openai_model", "custom-codecraft-model");
    fetchMock.mockResolvedValue(
      Response.json(soundComposition("Server result.")),
    );

    await generateWithDirectAi("make a product tour", {});

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/ai/generate");
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    expect(payload.provider).toBeUndefined();
    expect(payload.model).toBeUndefined();
  });

  it("ships a sound first pass without spending a repair round trip", async () => {
    fetchMock.mockResolvedValue(geminiResponse(soundComposition("All set.")));

    const result = await generateWithDirectAi("make a product tour", {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.quality?.blockingIssues).toEqual([]);
    expect(result.reply).toContain("All set.");
    expect(result.skills).toEqual(["write-motionly"]);
  });

  it("sends the bundled skill as system context and project assets as user context", async () => {
    fetchMock.mockResolvedValue(geminiResponse(soundComposition("All set.")));
    await generateWithDirectAi("Keep my accepted product identity", {
      conversation: [{ role: "user", text: "Use our paper-white palette" }],
    });
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.system_instruction.parts).toEqual([
      { text: MOTIONLY_SYSTEM_PROMPT },
    ]);
    expect(payload.contents[0].parts[0].text).toContain(
      "Use our paper-white palette",
    );
    expect(payload.contents[0].parts[0].text).not.toContain(
      "## Creative direction",
    );
    expect(payload.system_instruction.parts[0].text).not.toContain(
      "Use our paper-white palette",
    );
  });

  it("uses the same bundled system prompt in the deployed Vercel route", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    fetchMock.mockResolvedValue(
      geminiResponse(soundComposition("Server result.")),
    );
    const response = await generateHandler(
      new Request("http://localhost/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({ userPrompt: "A launch film", currentFiles: {} }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.system_instruction.parts).toEqual([
      { text: MOTIONLY_SYSTEM_PROMPT },
    ]);
    expect((await response.json()).skills).toEqual(["write-motionly"]);
  });

  it("repairs a foundation-generated result as existing work without replacing the system skill", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(filmDirection()))
      .mockResolvedValueOnce(geminiResponse(brokenComposition("First try.")))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Fixed.")));
    await generateWithDirectAi("Make a product tour", {
      generationProfile: "claude-foundation-v1",
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
    });
    const first = JSON.parse(fetchMock.mock.calls[1]![1].body);
    const repair = JSON.parse(fetchMock.mock.calls[2]![1].body);
    expect(repair.system_instruction).toEqual(first.system_instruction);
    const message = repair.contents[0].parts[0].text;
    expect(message).toContain("REPAIR REQUEST");
    expect(message).toContain("nothing moves");
    expect(message).toContain("EDIT the existing composition");
    expect(message).not.toContain("CREATE a new composition from scratch");
  });

  it("directs the film before building it, and builds what it directed", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(filmDirection()))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Built.")));

    await generateWithDirectAi("Make an ad for my issue tracker", {
      generationProfile: "claude-foundation-v1",
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
    });

    const direction = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(direction.system_instruction.parts[0].text).toContain(
      "You do not write code on this turn",
    );
    expect(direction.contents[0].parts[0].text).not.toContain("<template");

    const build = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(build.system_instruction.parts[0].text).toBe(MOTIONLY_SYSTEM_PROMPT);
    const message = build.contents[0].parts[0].text;
    expect(message).toContain("ACCEPTED CREATIVE DIRECTION");
    expect(message).toContain("warm off-white, one accent");
    expect(message).toContain("scene-01 to scene-02 at 9.4s for 1.2s: morph");
  });

  /** A failed plan costs the film its direction, never the film itself. */
  it("builds anyway when the direction turn fails", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("Gemini API error (503)"))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Built.")));

    const result = await generateWithDirectAi("Make an ad", {
      generationProfile: "claude-foundation-v1",
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
    });

    expect(result.reply).toContain("Built.");
    const build = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(build.contents[0].parts[0].text).not.toContain(
      "ACCEPTED CREATIVE DIRECTION",
    );
  });

  it("does not re-direct a follow-up edit", async () => {
    fetchMock.mockResolvedValue(geminiResponse(soundComposition("Edited.")));

    await generateWithDirectAi("make the ending longer", {
      generationProfile: "existing",
      compositionHtml: foundationHtml,
      timelineJs: foundationTimeline,
    });

    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(call[1].body);
      expect(body.system_instruction.parts[0].text).toBe(
        MOTIONLY_SYSTEM_PROMPT,
      );
    }
  });

  /**
   * The render checks watch real frames, so they are the strongest signal this
   * pipeline has. They used to run after generation returned, which meant the
   * user got a raw error and a Fix button instead of a repair pass.
   */
  it("repairs what the frames show instead of surfacing it as an error", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(soundComposition("First try.")))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Recomposed.")));
    let seen = 0;

    const result = await generateWithDirectAi(
      "make a product tour",
      {},
      undefined,
      () => {
        seen += 1;
        return seen === 1
          ? {
              ok: false as const,
              message: "Scene scene-01 is small cards floating in empty space.",
              fatal: false,
            }
          : { ok: true as const };
      },
    );

    expect(seen).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repair = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(repair.contents[0].parts[0].text).toContain(
      "small cards floating in empty space",
    );
    expect(result.reply).toContain("Recomposed.");
    expect(result.quality?.blockingIssues).toEqual([]);
  });

  it("ships the film with the complaint when repairs cannot clear it", async () => {
    fetchMock.mockResolvedValue(
      geminiResponse(soundComposition("Best I had.")),
    );
    const complaint = "Nothing survives the cut from scene-01 to scene-02.";

    const result = await generateWithDirectAi(
      "make a product tour",
      {},
      undefined,
      () => ({
        ok: false as const,
        message: complaint,
        fatal: false,
      }),
    );

    // Every repair pass was spent on it rather than one manual Fix click.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(2);
    expect(result.compositionHtml).toBeTruthy();
    expect(result.reply).toContain(complaint);
  });

  it("refuses only a film that cannot render at all", async () => {
    fetchMock.mockResolvedValue(geminiResponse(soundComposition("Blank.")));

    await expect(
      generateWithDirectAi("make a product tour", {}, undefined, () => ({
        ok: false as const,
        message: "Scene scene-01 renders no visible foreground around 1.25s.",
        fatal: true,
      })),
    ).rejects.toThrow(/renders no visible foreground/);
  });

  it("keeps a repair pass that clears the blocking failures", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(brokenComposition("First try.")))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Repaired.")));

    const result = await generateWithDirectAi("make a product tour", {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.quality?.blockingIssues).toEqual([]);
    expect(result.reply).toContain("Repaired.");
  });

  it("ships the best pass with a note instead of throwing when repairs fail", async () => {
    fetchMock.mockResolvedValue(geminiResponse(brokenComposition("Best I go")));

    const result = await generateWithDirectAi("make a product tour", {});

    // The user gets a film they can watch and edit, never an empty canvas.
    expect(result.compositionHtml).toContain("data-edit=");
    expect(result.quality?.blockingIssues.join(" ")).toContain("nothing moves");
    expect(result.reply).toContain("Still worth a look");
  });

  it("ships the first pass when the repair round trip itself fails", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(brokenComposition("First try.")))
      .mockRejectedValueOnce(new Error("network down"));

    const result = await generateWithDirectAi("make a product tour", {});

    expect(result.reply).toContain("First try.");
  });

  it("applies the deterministic markup repairs to whatever ships", async () => {
    fetchMock.mockResolvedValue(geminiResponse(brokenComposition("Best I go")));

    const result = await generateWithDirectAi("make a product tour", {});

    expect(result.compositionHtml).toContain("data-transition-carrier");
    expect(result.compositionHtml).toContain(
      'data-motionly-generation-profile="claude-foundation-v1"',
    );
  });

  it("stops paying for repairs once a pass stops improving the report", async () => {
    fetchMock.mockResolvedValue(geminiResponse(brokenComposition("Weak.")));

    await generateWithDirectAi("make a product tour", {});

    // One generation, one repair that changed nothing, then no more spending.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("shows the repair pass frames of the film it is fixing", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(brokenComposition("First try.")))
      .mockResolvedValue(
        geminiResponse(soundCompositionWithAsset("Repaired.")),
      );
    const captured: string[][] = [];

    await generateWithDirectAi(
      "use this logo",
      {
        assets: [
          {
            id: "asset-1",
            name: "logo.png",
            mimeType: "image/png",
            dataBase64: "aGVsbG8=",
            token: "__ASSET_1__",
          },
        ],
      },
      undefined,
      undefined,
      async (_candidate, complaints) => {
        captured.push([...complaints]);
        return {
          account: ["2.40s: card 38x44% centred 90,50%, 340px past the right."],
          frames: [
            { time: 2.4, mimeType: "image/jpeg", dataBase64: "ZnJhbWUtb25l" },
            { time: 9.4, mimeType: "image/jpeg", dataBase64: "ZnJhbWUtdHdv" },
          ],
        };
      },
    );

    // The film is photographed for the pass that is about to rewrite it, and
    // against the very complaints that pass carries.
    expect(captured[0]?.join(" ")).toContain("nothing moves");

    const first = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    const repair = JSON.parse(String(fetchMock.mock.calls[1]?.[1].body));
    // Nothing is attached to the first pass: there is no film to look at yet.
    expect(first.contents[0].parts).toHaveLength(2);
    const parts = repair.contents[0].parts;
    expect(parts).toHaveLength(4);
    // The user's own image keeps its place; the frames follow it, in order.
    expect(parts[1].inline_data.data).toBe("aGVsbG8=");
    expect(parts[2].inline_data).toEqual({
      mime_type: "image/jpeg",
      data: "ZnJhbWUtb25l",
    });
    expect(parts[3].inline_data.data).toBe("ZnJhbWUtdHdv");
    // And the prompt tells the model what those trailing images are.
    expect(parts[0].text).toContain("WHAT YOUR FILM ACTUALLY SHOWS");
    expect(parts[0].text).toContain("340px past the right");
    expect(parts[0].text).toContain("2.40s, 9.40s");
  });

  it("carries rendered frames on a cloud project message", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { user: { id: "user" }, csrfToken: "csrf-token" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              type: "generation",
              response: "Built the launch film.",
              projectId: "project-1",
              revision: 2,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              "composition.html": foundationHtml,
              "timeline.js": foundationTimeline,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { duration: 12 } }), {
          status: 200,
        }),
      );
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            type: "generation",
            response: "Repaired the launch film.",
            projectId: "project-1",
            revision: 3,
            "composition.html": foundationHtml,
            "timeline.js": foundationTimeline,
            duration: 12,
          },
        }),
        { status: 200 },
      ),
    );

    await generateWithDirectAi(
      "make a product tour",
      { backendProjectId: "project-1" },
      undefined,
      () => ({
        ok: false as const,
        message:
          'Scene scene-01 leaves "card" 34% outside the frame around 2.40s.',
        fatal: false,
      }),
      async () => ({
        account: ["2.40s: card 38x44% centred 90,50%, 340px past the right."],
        frames: [
          { time: 2.4, mimeType: "image/jpeg", dataBase64: "ZnJhbWUtb25l" },
        ],
      }),
    );

    const messagePosts = fetchMock.mock.calls.filter(
      (call) =>
        String((call[0] as URL).pathname) === "/v1/projects/project-1/messages",
    );
    const first = JSON.parse(
      String((messagePosts[0]?.[1] as RequestInit).body),
    );
    const repair = JSON.parse(
      String((messagePosts[1]?.[1] as RequestInit).body),
    );

    // The first turn has no film to look at yet. The repair turn does, and the
    // backend never executes the source it validates, so this message is the
    // only route by which what the frames show reaches the model.
    expect(first.frames).toBeUndefined();
    expect(repair.frames).toEqual([
      {
        capturedAtSeconds: 2.4,
        mediaType: "image/jpeg",
        dataBase64: "ZnJhbWUtb25l",
      },
    ]);
    // The measurements ride the message text beside them.
    expect(repair.message).toContain("340px past the right");
  });

  it("repairs with its sentences when the film cannot be photographed", async () => {
    fetchMock
      .mockResolvedValueOnce(geminiResponse(brokenComposition("First try.")))
      .mockResolvedValueOnce(geminiResponse(soundComposition("Repaired.")));

    const result = await generateWithDirectAi(
      "make a product tour",
      {},
      undefined,
      undefined,
      async () => {
        throw new Error("canvas is unavailable");
      },
    );

    // Evidence improves a repair prompt; it is never a precondition for one.
    expect(result.reply).toContain("Repaired.");
    const repair = JSON.parse(String(fetchMock.mock.calls[1]?.[1].body));
    expect(repair.contents[0].parts).toHaveLength(1);
    expect(repair.contents[0].parts[0].text).not.toContain(
      "WHAT YOUR FILM ACTUALLY SHOWS",
    );
  });

  it("photographs nothing when the first pass already holds up", async () => {
    fetchMock.mockResolvedValue(
      geminiResponse(soundComposition("Built it clean.")),
    );
    const observe = vi.fn(async () => ({ account: [], frames: [] }));

    await generateWithDirectAi(
      "make a product tour",
      {},
      undefined,
      undefined,
      observe,
    );

    expect(observe).not.toHaveBeenCalled();
  });
});

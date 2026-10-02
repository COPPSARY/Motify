import { afterEach, describe, expect, it, vi } from "vitest";
import {
  brandCompleteness,
  brandGenerationBrief,
  displayUrl,
  emptyBrandDna,
  normalizeHex,
  normalizeUrl,
  sameBrandDna,
  type BrandAsset,
} from "./brand-dna";
import { CloudApiError, ProjectsApi } from "./projects-api";
import { isBrandRoute } from "../app/routes";

function response(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Brand DNA helpers", () => {
  it("normalises colours and URLs the way the backend stores them", () => {
    expect(normalizeHex("#0A84FF")).toBe("#0a84ff");
    expect(normalizeHex("fa0")).toBe("#ffaa00");
    expect(normalizeHex("blue")).toBeNull();
    expect(normalizeUrl(" acme.com ")).toBe("https://acme.com");
    expect(normalizeUrl("http://acme.com")).toBe("http://acme.com");
    expect(normalizeUrl("")).toBe("");
    expect(displayUrl("https://acme.com/")).toBe("acme.com");
  });

  it("counts the essentials a film draws on", () => {
    const empty = emptyBrandDna();
    expect(brandCompleteness(empty, [])).toEqual({ filled: 0, total: 11 });

    const dna = emptyBrandDna();
    dna.identity.name = "Acme";
    dna.voice.tone = ["Warm"];
    const logo = { role: "logo" } as BrandAsset;
    expect(brandCompleteness(dna, [logo]).filled).toBe(3);
  });

  it("detects unsaved edits", () => {
    const saved = emptyBrandDna();
    const draft = emptyBrandDna();
    expect(sameBrandDna(saved, draft)).toBe(true);
    draft.story.proof = "4,000 teams";
    expect(sameBrandDna(saved, draft)).toBe(false);
  });

  it("turns saved Brand DNA into reusable Tiffy context", () => {
    const dna = emptyBrandDna();
    dna.identity = {
      name: "Acme",
      websiteUrl: "https://acme.test",
      tagline: "Ship brighter",
    };
    dna.visual.colors = [
      { id: "mint", name: "Mint", hex: "#7cf7c5", role: "primary" },
    ];
    dna.voice.tone = ["Confident", "Warm"];
    const brief = brandGenerationBrief({
      workspaceId: "ws",
      revision: 2,
      schemaVersion: 1,
      dna,
      provenance: {},
      assets: [
        {
          assetId: "logo",
          role: "logo",
          label: "Primary mark",
          source: "manual",
          sourceUrl: null,
          fileName: "logo.svg",
          contentType: "image/svg+xml",
          byteSize: 100,
          width: 100,
          height: 100,
          token: "motify-asset://logo",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      updatedAt: "2026-10-01T00:00:00.000Z",
    });

    expect(brief).toContain("Brand: Acme");
    expect(brief).toContain("Mint #7cf7c5 (primary)");
    expect(brief).toContain("Tone: Confident, Warm");
    expect(brief).toContain("motify-asset://logo");
    expect(brief).toContain("Do not ask the user to re-enter them");
  });

  it("routes only /brand to the Brand DNA page", () => {
    expect(isBrandRoute("/brand")).toBe(true);
    expect(isBrandRoute("/brand/")).toBe(true);
    expect(isBrandRoute("/p/brand")).toBe(false);
    expect(isBrandRoute("/")).toBe(false);
  });
});

describe("ProjectsApi Brand DNA", () => {
  it("saves the document against its revision with the CSRF token", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, { data: { user: { id: "u" }, csrfToken: "csrf" } }),
      )
      .mockResolvedValueOnce(response(200, { data: { revision: 4 } }));
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");
    const dna = emptyBrandDna();

    await expect(api.saveBrand(3, dna)).resolves.toEqual({
      revision: 4,
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL("http://localhost:4000/v1/brand"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf" }),
        body: JSON.stringify({ revision: 3, dna }),
      }),
    );
  });

  it("links and removes brand images", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, { data: { user: { id: "u" }, csrfToken: "csrf" } }),
      )
      .mockResolvedValueOnce(response(201, { data: { assets: [] } }))
      .mockResolvedValueOnce(response(204));
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await api.addBrandAsset({ assetId: "a1", role: "logo" });
    await api.removeBrandAsset("a1");

    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      new URL("http://localhost:4000/v1/brand/assets"),
    );
    expect(fetchMock.mock.calls[2]?.[0]).toEqual(
      new URL("http://localhost:4000/v1/brand/assets/a1"),
    );
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: "DELETE" });
  });

  it("surfaces a revision conflict by code", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          response(200, { data: { user: { id: "u" }, csrfToken: "csrf" } }),
        )
        .mockResolvedValueOnce(
          response(409, {
            error: {
              code: "BRAND_REVISION_CONFLICT",
              message: "Changed.",
              details: { currentRevision: 5 },
            },
          }),
        ),
    );
    const error = await new ProjectsApi("http://localhost:4000")
      .saveBrand(3, emptyBrandDna())
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CloudApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "BRAND_REVISION_CONFLICT",
    });
  });
});

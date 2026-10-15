import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyBrandDna, type BrandResource } from "../cloud/brand-dna";

const api = vi.hoisted(() => ({
  listBrands: vi.fn(),
  getBrand: vi.fn(),
  saveBrand: vi.fn(),
  getCapabilities: vi.fn(),
  extractBrand: vi.fn(),
}));

vi.mock("../auth", () => ({
  currentMotionlyUser: vi.fn(async () => ({ id: "u", email: "a@b.co" })),
}));
vi.mock("../api/onboarding", () => ({
  fetchOnboarding: vi.fn(async () => ({ step: null, completedAt: null })),
  updateOnboarding: vi.fn(),
}));
vi.mock("../cloud/projects-api", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../cloud/projects-api")>();
  return {
    ...original,
    ProjectsApi: class {
      constructor() {
        return api;
      }
    },
  };
});

import { CloudApiError } from "../cloud/projects-api";
import BrandDnaPage from "./BrandDnaPage.svelte";

function resource(
  revision = 0,
  patch: (dna: BrandResource["dna"]) => void = () => undefined,
): BrandResource {
  const dna = emptyBrandDna();
  patch(dna);
  return {
    id: null,
    workspaceId: "w",
    revision,
    schemaVersion: 1,
    dna,
    provenance: {},
    assets: [],
    updatedAt: null,
  };
}

const wait = async (ms = 0) => {
  await tick();
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, ms));
  flushSync();
};

describe("Brand DNA website step", () => {
  let component: ReturnType<typeof mount> | undefined;

  const input = () =>
    document.querySelector<HTMLInputElement>(".bd-input--big")!;
  const buttons = () => [
    ...document.querySelectorAll<HTMLButtonElement>(
      ".bd-answer__buttons .bd-btn",
    ),
  ];
  const button = (label: string) =>
    buttons().find((item) => item.textContent?.includes(label));
  const type = async (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event("input", { bubbles: true }));
    await wait();
  };
  const tiffy = () =>
    [...document.querySelectorAll(".bd-msg--tiffy .bd-bubble")]
      .map((node) => node.textContent?.trim())
      .join(" | ");

  /** Opens the chat and answers the name, so Tiffy is asking for the website. */
  async function atWebsiteQuestion() {
    component = mount(BrandDnaPage, { target: document.body });
    await wait(900);
    await type("Acme");
    button("Send")!.click();
    await wait(900);
    expect(tiffy()).toContain("live online");
  }

  beforeEach(() => {
    api.listBrands.mockResolvedValue({ maxProfiles: 1, profiles: [] });
    api.getBrand.mockResolvedValue(resource());
    api.saveBrand.mockImplementation(
      async (revision: number, dna: BrandResource["dna"]) => ({
        ...resource(revision + 1),
        dna,
      }),
    );
    api.getCapabilities.mockResolvedValue({
      storyboardGeneration: true,
      brandExtraction: true,
    });
    api.extractBrand.mockResolvedValue({
      brand: resource(2, (dna) => {
        dna.identity.name = "Acme";
        dna.identity.websiteUrl = "https://acme.com";
        dna.product.description = "Anvils.";
      }),
      applied: ["product.description"],
    });
    HTMLElement.prototype.scrollIntoView = () => undefined;
  });

  afterEach(() => {
    if (component) unmount(component);
    component = undefined;
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("swaps Send for Fill from my website once a site is typed", async () => {
    await atWebsiteQuestion();
    expect(button("Send")).toBeDefined();
    expect(button("Fill from my website")).toBeUndefined();
    expect(button("No website")).toBeDefined();
    await type("acme.com");
    expect(button("Fill from my website")).toBeDefined();
    expect(button("Send")).toBeUndefined();
  });

  it("reads the site and moves on to what is still missing", async () => {
    await atWebsiteQuestion();
    await type("acme.com");
    button("Fill from my website")!.click();
    await wait(900);
    expect(api.extractBrand).toHaveBeenCalledWith("https://acme.com");
    expect(tiffy()).toContain("I filled in what I could from your site.");
    // The description is filled, so Tiffy skips ahead to the next gap.
    expect(tiffy()).not.toContain("describe");
  });

  it("says so in the chat when the site cannot be opened, and offers a retry or the manual way", async () => {
    api.extractBrand.mockRejectedValue(
      new CloudApiError(422, "SITE_UNREADABLE", "x", { reason: "NETWORK" }),
    );
    await atWebsiteQuestion();
    await type("nope.example");
    button("Fill from my website")!.click();
    await wait();
    expect(tiffy()).toContain(
      "I can't open that website. Try again, or fill it in by hand.",
    );
    expect(button("Try again")).toBeDefined();
    expect(button("Continue")).toBeDefined();
    expect(button("Fill from my website")).toBeUndefined();
    // Editing the address starts over.
    await type("nope.example/about");
    expect(tiffy()).not.toContain("I can't open");
    expect(button("Fill from my website")).toBeDefined();
  });

  it("continues by hand after a failure, keeping the website", async () => {
    api.extractBrand.mockRejectedValue(
      new CloudApiError(502, "SITE_EXTRACTION_FAILED", "x"),
    );
    await atWebsiteQuestion();
    await type("acme.com");
    button("Fill from my website")!.click();
    await wait();
    button("Continue")!.click();
    await wait(900);
    expect(tiffy()).toContain("one-liner");
    expect(api.saveBrand.mock.calls.at(-1)?.[1].identity.websiteUrl).toBe(
      "https://acme.com",
    );
  });

  it("explains an invalid address and the daily limit", async () => {
    api.extractBrand.mockRejectedValueOnce(
      new CloudApiError(422, "SITE_UNREADABLE", "x", { reason: "INVALID_URL" }),
    );
    await atWebsiteQuestion();
    await type("acme.com");
    button("Fill from my website")!.click();
    await wait();
    expect(tiffy()).toContain("doesn't look like a website address");

    api.extractBrand.mockRejectedValueOnce(
      new CloudApiError(429, "BRAND_EXTRACT_LIMIT", "x"),
    );
    button("Try again")!.click();
    await wait();
    expect(tiffy()).toContain("I've read a lot of sites today");
  });

  it("falls back to filling it in by hand when the site has nothing to read", async () => {
    api.extractBrand.mockResolvedValue({
      brand: resource(2, (dna) => {
        dna.identity.name = "Acme";
        dna.identity.websiteUrl = "https://acme.com";
      }),
      applied: [],
    });
    await atWebsiteQuestion();
    await type("acme.com");
    button("Fill from my website")!.click();
    await wait(900);
    expect(tiffy()).toContain(
      "I couldn't find anything on that site, so let's fill it in by hand.",
    );
  });

  it("never offers the fill when this deployment cannot read websites", async () => {
    api.getCapabilities.mockResolvedValue({ storyboardGeneration: true });
    await atWebsiteQuestion();
    await type("acme.com");
    expect(button("Fill from my website")).toBeUndefined();
    expect(button("Send")).toBeDefined();
  });
});

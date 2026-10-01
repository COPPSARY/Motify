import { describe, expect, it } from "vitest";
import { emptyBrandDna, type BrandAsset } from "../cloud/brand-dna";
import { QUESTIONS, SECTIONS, firstUnanswered } from "./brand-questions";

const logo = { role: "logo" } as BrandAsset;

describe("Tiffy's Brand DNA questions", () => {
  it("asks for the name first, and only the name is required", () => {
    expect(QUESTIONS[0]?.id).toBe("name");
    expect(
      QUESTIONS.filter((question) => !question.optional).map((q) => q.id),
    ).toEqual(["name"]);
  });

  it("covers every section and never repeats a field", () => {
    expect(new Set(QUESTIONS.map((question) => question.section))).toEqual(
      new Set(Object.keys(SECTIONS)),
    );
    expect(new Set(QUESTIONS.map((question) => question.id)).size).toBe(
      QUESTIONS.length,
    );
  });

  it("speaks to the brand by name once it knows it", () => {
    const website = QUESTIONS.find((question) => question.id === "website")!;
    expect(website.ask("Acme")).toBe("Where does Acme live online?");
    expect(website.ask("")).toBe("Where does your brand live online?");
    const dna = emptyBrandDna();
    dna.identity.name = "Acme";
    expect(QUESTIONS[0]!.react(dna)).toBe("Nice to meet you, Acme.");
  });

  it("picks up where a brand left off", () => {
    const dna = emptyBrandDna();
    expect(firstUnanswered(dna, [])).toBe(0);
    dna.identity.name = "Acme";
    dna.identity.websiteUrl = "https://acme.com";
    expect(QUESTIONS[firstUnanswered(dna, [])]?.id).toBe("tagline");
    dna.identity.tagline = "Ship faster";
    expect(QUESTIONS[firstUnanswered(dna, [logo])]?.id).toBe("colors");
  });
});

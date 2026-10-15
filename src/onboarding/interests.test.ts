import { beforeEach, describe, expect, it } from "vitest";

import { categoriesOf, saveInterests, takeInterests } from "./interests";

describe("template interests", () => {
  beforeEach(() => localStorage.clear());

  it("counts categories, most templates first", () => {
    expect(
      categoriesOf([
        { categories: ["UI", "Product"] },
        { categories: ["Product", "Product"] },
        { categories: ["Design"] },
      ]),
    ).toEqual([
      { name: "Product", count: 2 },
      { name: "Design", count: 1 },
      { name: "UI", count: 1 },
    ]);
  });

  it("hands the picks over once", () => {
    saveInterests(localStorage, ["Product", "UI"]);
    expect(takeInterests(localStorage)).toEqual(["Product", "UI"]);
    expect(takeInterests(localStorage)).toEqual([]);
  });

  it("saves nothing for no picks and ignores corrupt storage", () => {
    saveInterests(localStorage, []);
    expect(takeInterests(localStorage)).toEqual([]);
    localStorage.setItem("motify_template_interests", "{not json");
    expect(takeInterests(localStorage)).toEqual([]);
    localStorage.setItem("motify_template_interests", '[1,"UI"]');
    expect(takeInterests(localStorage)).toEqual(["UI"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  applyEditorField,
  editorFieldValue,
  readEditorGroup,
} from "../../src/composition/editor-schema";

describe("editor schema", () => {
  it("exposes only explicitly declared component fields", () => {
    const group = document.createElement("article");
    group.dataset.edit = "product-1";
    group.dataset.editLabel = "Product 1";
    group.innerHTML = `
      <h2 data-field="content" data-field-label="Content" data-field-type="text">EcoSmart Bottle</h2>
      <img data-field="image" data-field-label="Product image" data-field-type="image" src="motionly-asset://bottle" />
      <span class="decoration">Not editable</span>
    `;

    const schema = readEditorGroup("product-1", group);
    expect(schema.explicit).toBe(true);
    expect(schema.label).toBe("Product 1");
    expect(schema.fields.map((field) => field.id)).toEqual([
      "content",
      "image",
    ]);
    expect(schema.allowTransform).toBe(true);
  });

  it("updates the declared binding without touching sibling content", () => {
    const group = document.createElement("article");
    group.dataset.edit = "product-1";
    group.innerHTML = `
      <span data-field="price" data-field-type="text">$49.99</span>
      <span class="feature">100% recycled</span>
    `;
    const field = readEditorGroup("product-1", group).fields[0];
    expect(field).toBeDefined();
    if (!field) throw new Error("Price field was not parsed.");
    applyEditorField(field, "$59.99");
    expect(editorFieldValue(field)).toBe("$59.99");
    expect(group.querySelector(".feature")?.textContent).toBe("100% recycled");
  });

  it("falls back conservatively for legacy image elements", () => {
    const image = document.createElement("img");
    const schema = readEditorGroup("hero-image", image);
    expect(schema.explicit).toBe(false);
    expect(schema.fields.map((field) => field.type)).toEqual(["image"]);
  });

  it("exposes one image nested inside a legacy editable wrapper", () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = '<img src="product.png" alt="Product image" />';
    const schema = readEditorGroup("product", wrapper);

    expect(schema.explicit).toBe(false);
    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0]?.type).toBe("image");
    expect(schema.fields[0]?.label).toBe("Product image");
    expect(schema.fields[0]?.target).toBe(wrapper.querySelector("img"));
  });
});

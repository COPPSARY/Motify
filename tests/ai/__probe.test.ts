import { describe, it } from "vitest";
import {
  selectFilmShape,
  selectReferenceRoles,
} from "../../src/ai/generation-guidance";

describe("probe", () => {
  it("shows retrieval before vs after", () => {
    const prompts = [
      "Make a 20-second brand teaser for Ledger, a personal finance app for freelancers. Light, calm and confident. End on the Ledger logo.",
      "Create a short promo video for Pulse, an AI tool that helps companies understand what their customers are saying. Show how overwhelming customer feedback can be, then show Pulse making sense of it.",
      "A pure kinetic typography film about shipping fast. No interface at all.",
      "Logo sting for an energy drink brand",
      "Walk through the settings screen of our mobile app",
    ];
    for (const prompt of prompts) {
      console.log(
        `\n[${selectFilmShape(prompt).toUpperCase()}] ${prompt.slice(0, 56)}`,
      );
      for (const entry of selectReferenceRoles(prompt)) {
        console.log(`     ${entry.role.padEnd(24)} ${entry.item.name}`);
      }
    }
  });
});

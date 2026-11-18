import { describe, expect, it } from "vitest";

import { requestedFilmSeconds } from "./film-length";

describe("requestedFilmSeconds", () => {
  it.each([
    ["Make a 30-second ad for my bakery", 30],
    ["make a 5 minute video about our clinic", 300],
    ["I want a video of 4 minutes for the launch", 240],
    ["explainer, 2 minutes 30 seconds long", 150],
    ["make it 3 mins", 180],
    ["a 1.5 min promo", 90],
    ["an hour long film of the event", 3600],
    ["ធ្វើវីដេអូ ៥ នាទី សម្រាប់ហាងកាហ្វេ", 300],
    ["វីដេអូរយៈពេល ៣០ វិនាទី", 30],
    ["Hook in the first 3 seconds, the whole video 45 seconds", 45],
    ["a 20s reel", 20],
  ])("reads %j as %d seconds", (message, seconds) => {
    expect(requestedFilmSeconds(message)).toBe(seconds);
  });

  it.each([
    "Make a promo for my shop. We deliver in 30 minutes!",
    "Open 24 hours, 7 days a week",
    "A logo reveal with 5 scenes",
    "Make a launch film for Acme",
  ])("finds no film length in %j", (message) => {
    expect(requestedFilmSeconds(message)).toBeUndefined();
  });
});

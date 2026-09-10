import { describe, expect, it } from "vitest";
import gsap from "gsap";
import { editorialTextReveal } from "../../src/composition/presets";

describe("editorial text reveal", () => {
  it("preserves accented markup and layout, resolves focus early, and never bounces past the baseline", () => {
    const line = document.createElement("h1");
    line.innerHTML = "Your words <em>matter.</em>";
    line.style.transform = "translate(-50%, -50%)";
    document.body.append(line);
    const timeline = gsap.timeline({ paused: true });
    timeline.addLabel("read", 1);
    const words = editorialTextReveal(timeline, line, {
      at: "read",
      duration: 0.5,
      stagger: 0.1,
    });
    expect(words.map((w) => w.textContent)).toEqual([
      "Your",
      "words",
      "matter.",
    ]);
    expect(line.querySelector("em")?.textContent).toBe("matter.");
    expect(line.style.transform).toBe("translate(-50%, -50%)");
    for (const time of [1.05, 1.2, 1.35, 1.5, 1.7]) {
      timeline.seek(time);
      for (const word of words)
        expect(Number(gsap.getProperty(word, "y"))).toBeGreaterThanOrEqual(0);
    }
    timeline.seek(1.3);
    expect(gsap.getProperty(words[0]!, "filter")).toBe("blur(0px)");
    expect(Number(gsap.getProperty(words[0]!, "y"))).toBeGreaterThan(0);
    const state = words.map((w) => w.getAttribute("style"));
    timeline.seek(1.7);
    timeline.seek(0);
    timeline.seek(1.3);
    expect(words.map((w) => w.getAttribute("style"))).toEqual(state);
    timeline.kill();
    line.remove();
  });
});

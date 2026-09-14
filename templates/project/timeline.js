import { maskWipe, slide } from "@motionly/runtime";

function required(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing starter element: ${selector}`);
  return element;
}

export function buildTimeline({ root, timeline, register }) {
  root
    .querySelectorAll("[data-edit]")
    .forEach((element) => register(element.dataset.edit, element));

  const lockup = required(root, ".starter-lockup");
  const title = required(root, ".starter-lockup h1");
  const subtitle = required(root, ".starter-lockup p");
  const product = required(root, ".starter-product");

  timeline.set(lockup, { autoAlpha: 1 }, 0);
  timeline.fromTo(
    title,
    { scale: 0.85, autoAlpha: 0 },
    { scale: 1.05, autoAlpha: 1, duration: 0.7, ease: "power4.out" },
    0.08,
  );
  timeline.to(title, { scale: 1, duration: 0.22, ease: "power2.out" }, 0.7);
  slide(timeline, subtitle, { direction: "up", distance: 34, at: 0.58 });
  timeline.to(
    title,
    { scale: 11, autoAlpha: 0, duration: 0.9, ease: "expo.in" },
    2.15,
  );
  timeline.to(
    subtitle,
    { y: -30, autoAlpha: 0, duration: 0.35, ease: "power3.in" },
    2.2,
  );
  timeline.set(product, { autoAlpha: 1 }, 2.48);
  maskWipe(timeline, product, { direction: "up", duration: 0.9, at: 2.48 });
  slide(timeline, required(root, ".starter-source"), {
    direction: "right",
    distance: 50,
    at: 2.72,
  });
  timeline.fromTo(
    required(root, ".starter-route"),
    { scaleX: 0 },
    { scaleX: 1, duration: 0.58, ease: "expo.inOut" },
    3.05,
  );
  slide(timeline, required(root, ".starter-output"), {
    direction: "left",
    distance: 54,
    at: 3.18,
  });
  timeline.to(
    product,
    { scale: 1.06, duration: 1.1, ease: "power3.inOut" },
    4.35,
  );
}

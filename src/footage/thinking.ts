import type { FootageStatus } from "./api";

/**
 * What the editor shows while the AI works: its reading of the person's own
 * clips (what each shows, what is said, the strongest moment, what it leaves
 * out), then the decisions it is making. Every clip line comes from the
 * clip's real log, so the person sees the AI understand their video.
 */
export function thinkingLines(
  statuses: ReadonlyArray<FootageStatus | undefined>,
  mode: "cut" | "edit",
  instruction = "",
): string[] {
  if (mode === "edit") {
    const asked = instruction.trim().replace(/\s+/g, " ");
    return [
      asked
        ? `Reading your request: “${clip(asked, 70)}”`
        : "Reading your request",
      "Looking over the current cut",
      ...clipLines(statuses).slice(0, 2),
      "Planning the change, keeping everything else as it is",
      "Checking the timing against what is said",
    ];
  }
  return [
    ...clipLines(statuses),
    "Working out what kind of video this is",
    "Choosing a style: clean, studio explainer or paper documentary",
    "Finding the moments a motion graphic should carry",
    "Placing your pictures and B-roll where they are said",
    "Cutting the pauses, false starts and repeats",
    "Timing the captions to every word",
  ];
}

function clipLines(
  statuses: ReadonlyArray<FootageStatus | undefined>,
): string[] {
  const many = statuses.length > 1;
  return statuses.flatMap((status, index) => {
    if (!status) return [];
    const name = many ? `Clip ${index + 1}` : "Your clip";
    const lines: string[] = [];
    const analysis = status.analysis;
    if (analysis?.summary)
      lines.push(`${name}: ${clip(analysis.summary.replace(/\.$/, ""), 90)}`);
    const said = status.transcript?.text.trim();
    if (said) lines.push(`Hearing: “${clip(said, 80)}”`);
    const best = analysis?.moments[0];
    if (best?.label)
      lines.push(
        `Strongest moment: ${clip(best.label, 50)} at ${best.start.toFixed(1)}s`,
      );
    const avoid = analysis?.avoid.find((part) => part.reason !== "silence");
    if (avoid?.reason) lines.push(`Leaving out: ${clip(avoid.reason, 60)}`);
    return lines;
  });
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * How far along the work looks after `seconds`, 0 to 1: it races to about
 * 90% in the first ten seconds, then creeps on (never reaching 100%) while
 * the model really works, so a long cut never looks stuck.
 */
export function workProgress(seconds: number): number {
  const t = Math.max(0, seconds);
  return Math.min(
    0.97,
    0.9 * (1 - Math.exp(-t / 3.2)) + 0.07 * (1 - Math.exp(-t / 45)),
  );
}

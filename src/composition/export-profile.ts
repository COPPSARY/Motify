/**
 * Where an export's time goes. Each stage of a frame adds the time it took;
 * the export prints the totals once it ends, so a slow export says which part
 * of it was slow instead of leaving it to be guessed.
 */

export interface ExportStageTime {
  /** Milliseconds spent in the stage over the whole export. */
  ms: number;
  /** Times the stage ran. */
  count: number;
  /** The longest single run, in milliseconds. */
  max: number;
}

let stages: Map<string, ExportStageTime> | undefined;

export function startExportProfile(): void {
  stages = new Map();
}

/** Now, for a later `profileStage`; 0 when no export is being timed. */
export function profileNow(): number {
  return stages ? performance.now() : 0;
}

/** Adds the time since `since` to `stage`, and returns now for the next one. */
export function profileStage(stage: string, since: number): number {
  if (!stages) return 0;
  const now = performance.now();
  const entry = stages.get(stage) ?? { ms: 0, count: 0, max: 0 };
  entry.ms += now - since;
  entry.count += 1;
  entry.max = Math.max(entry.max, now - since);
  stages.set(stage, entry);
  return now;
}

/** Counts something that happened, with no time of its own. */
export function profileCount(stage: string): void {
  if (!stages) return;
  const entry = stages.get(stage) ?? { ms: 0, count: 0, max: 0 };
  entry.count += 1;
  stages.set(stage, entry);
}

/** Ends the profile and hands back each stage's total, slowest first. */
export function finishExportProfile(): Record<string, ExportStageTime> {
  const result: Record<string, ExportStageTime> = {};
  for (const [stage, time] of [...(stages ?? [])].sort(
    (a, b) => b[1].ms - a[1].ms,
  ))
    result[stage] = {
      ms: Math.round(time.ms),
      count: time.count,
      max: Math.round(time.max),
    };
  stages = undefined;
  return result;
}

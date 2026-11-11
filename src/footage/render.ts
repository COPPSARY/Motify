import { createGeneratedAdapterSource } from "../composition/generated-adapter";
import { formatEnvelope } from "../composition/audio-envelope";
import type { ProjectSourceFiles } from "../cloud/projects-api";
import type { SceneDefinition } from "../composition/types";
import {
  FORMAT_SIZE,
  editDuration,
  placeCues,
  placeCutaways,
  placeSegments,
  placeSounds,
  type FootageCard,
  type FootageEdit,
} from "./edit";

/**
 * A footage edit as project files. composition.html places every clip,
 * caption and title as an element; timeline.js carries the edit itself and
 * hands it to `footageTimeline` (composition/footage-runtime.ts), which moves
 * them. The editor reads the edit back out of timeline.js with `readFootageEdit`.
 *
 * Clips are named by `motify-footage://<asset>/<file>` tokens, which the
 * editor swaps for local copies of the files the backend made from each clip.
 */

export const FOOTAGE_MARKER = "// motify:footage-edit v1";
const EDIT_LINE = /^const FOOTAGE_EDIT = (.*);$/m;

export function isFootageTimeline(timelineJs: string): boolean {
  return timelineJs.trimStart().startsWith(FOOTAGE_MARKER);
}

export function readFootageEdit(timelineJs: string): FootageEdit | null {
  if (!isFootageTimeline(timelineJs)) return null;
  const line = EDIT_LINE.exec(timelineJs)?.[1];
  if (!line) return null;
  try {
    const edit = JSON.parse(line) as FootageEdit;
    return edit?.kind === "motify-footage-edit" ? edit : null;
  } catch {
    return null;
  }
}

export function footageToken(assetId: string, file: string): string {
  return `motify-footage://${assetId}/${file}`;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const n = (value: number) => String(Math.round(value * 1000) / 1000);

/** Where speech plays, on the video's clock, for music to dip under it. */
function speechSpans(edit: FootageEdit): Array<{ start: number; end: number }> {
  const spans = placeCues({
    ...edit,
    captions: { ...edit.captions, enabled: true },
  })
    .map(({ start, end }) => ({ start, end }))
    .sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.start - last.end < 0.6)
      last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

function musicEnvelope(edit: FootageEdit, total: number): string {
  const duck = edit.music?.duck ? 0.35 : 1;
  const points = [
    { time: 0, gain: 0 },
    { time: Math.min(0.4, total / 4), gain: 1 },
  ];
  if (duck < 1) {
    for (const span of speechSpans(edit)) {
      const from = Math.max(
        points[points.length - 1]!.time + 0.01,
        span.start - 0.25,
      );
      if (from >= total - 1.5) break;
      points.push({ time: from, gain: 1 });
      points.push({ time: from + 0.25, gain: duck });
      const to = Math.min(total - 1.5, span.end + 0.1);
      points.push({ time: Math.max(from + 0.26, to), gain: duck });
      points.push({ time: Math.max(from + 0.27, to + 0.35), gain: 1 });
    }
  }
  const fade = Math.max(points[points.length - 1]!.time + 0.01, total - 1.5);
  points.push({ time: fade, gain: points[points.length - 1]!.gain });
  points.push({ time: total, gain: 0 });
  return formatEnvelope(points);
}

/** A card: a panel with its words, on a backdrop with a few marks so it is never flat. */
function cardMarkup(id: string, card: FootageCard): string {
  // Letter-spacing pulls Khmer clusters apart (a subscript lands beside its consonant),
  // so a line with Khmer in it is set without it.
  const khmer = (text: string) => (/[ក-៿᧠-᧿]/.test(text) ? " fx-k-km" : "");
  const line = (cls: string, text: string | undefined) =>
    text
      ? `<div class="fx-k-anim ${cls}${khmer(text)}">${escapeHtml(text)}</div>`
      : "";
  const items = (card.items ?? []).filter(Boolean);
  return `<div class="fx-shot fx-cardshot fx-k--${card.template} fx-kt--${card.theme}" id="fx-shot-${id}"><span class="fx-k-plus" style="left:7%;top:9%">+</span><span class="fx-k-plus" style="right:8%;top:30%">+</span><span class="fx-k-plus" style="left:5%;bottom:22%">+</span><span class="fx-k-plus" style="right:6%;bottom:8%">+</span><div class="fx-k-panel"><div class="fx-k-dots"><i></i><i></i><i></i></div><div class="fx-k-rule"></div>${line("fx-k-eyebrow", card.eyebrow)}${line("fx-k-title", card.title)}${line("fx-k-label", card.label)}${line("fx-k-big", card.big)}${items.length > 0 ? `<ol class="fx-k-items">${items.map((item) => `<li class="fx-k-anim">${escapeHtml(item)}</li>`).join("")}</ol>` : ""}<div class="fx-k-rule fx-k-rule--end"><span></span></div><div class="fx-k-pager"><i></i><i class="fx-on"></i><i></i></div></div></div>`;
}

/**
 * Light sound design: a whoosh under moving transitions and a pop as a card
 * lands, quiet enough to sit under speech. The sounds are made in the browser
 * (footage/api.ts), so there is no sound library to license.
 */
function soundEffects(edit: FootageEdit): string {
  const cues: string[] = [];
  for (const { segment, start, index } of placeSegments(edit)) {
    if (
      index > 0 &&
      ["slide", "whip", "zoom", "blur"].includes(segment.transition)
    )
      cues.push(
        `<audio data-motify-audio src="motify-sfx://whoosh" data-start="${n(Math.max(0, start - 0.18))}" data-volume="0.32"></audio>`,
      );
    if (segment.card)
      cues.push(
        `<audio data-motify-audio src="motify-sfx://pop" data-start="${n(start + 0.1)}" data-volume="0.4"></audio>`,
      );
  }
  return cues.join("\n  ");
}

function titleMarkup(edit: FootageEdit): string {
  return edit.titles
    .map(
      (title) =>
        `<div class="fx-title fx-title--${title.style} fx-at-${title.position}" id="fx-title-${escapeHtml(title.id)}"><div class="fx-title-box"><span class="fx-title-text"${title.color ? ` style="color:${escapeHtml(title.color)}"` : ""}>${escapeHtml(title.text)}</span>${title.sub ? `<span class="fx-title-sub">${escapeHtml(title.sub)}</span>` : ""}</div></div>`,
    )
    .join("\n    ");
}

function captionMarkup(edit: FootageEdit): string {
  return placeCues(edit)
    .map(
      (placed, index) =>
        `<div class="fx-cue" id="fx-cue-${index}"><span class="fx-line">${escapeHtml(placed.cue.text)}</span>${placed.cue.alt ? `<span class="fx-alt">${escapeHtml(placed.cue.alt)}</span>` : ""}</div>`,
    )
    .join("\n    ");
}

export const FOOTAGE_CSS = `
.fx { position: absolute; inset: 0; overflow: hidden; background: #000; font-family: var(--fx-font), "Kantumruy Pro", "Inter", sans-serif; --fx-unit: calc(var(--fx-short) / 1080); }
.fx-shot { position: absolute; inset: 0; overflow: hidden; visibility: hidden; opacity: 0; will-change: transform, filter; }
.fx-shot video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform-origin: 50% 45%; }
.fx-filmshot { background: #000; }
.fx-card-film { position: absolute; inset: 0; }
.fx-card-film iframe { position: absolute; left: 0; top: 0; width: 100%; height: 100%; border: 0; pointer-events: none; }
.fx-cutaways { position: absolute; inset: 0; pointer-events: none; }
.fx-cutaway { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; visibility: hidden; opacity: 0; transform-origin: 50% 50%; }
.fx-flash { position: absolute; inset: 0; background: #fff; opacity: 0; visibility: hidden; pointer-events: none; }
.fx-titles, .fx-captions { position: absolute; inset: 0; pointer-events: none; }
.fx-title { position: absolute; left: 0; right: 0; display: flex; justify-content: center; padding: 0 calc(70px * var(--fx-unit)); visibility: hidden; }
.fx-title.fx-at-top { top: 9%; }
.fx-title.fx-at-center { top: 50%; transform: translateY(-50%); }
.fx-title.fx-at-bottom { bottom: 11%; }
.fx-title-box { display: flex; flex-direction: column; align-items: center; gap: calc(14px * var(--fx-unit)); text-align: center; max-width: 100%; }
.fx-title-text { font-weight: 800; line-height: 1.45; color: #fff; text-wrap: balance; }
.fx-title-sub { font-weight: 800; line-height: 1.35; color: var(--fx-accent); font-size: calc(60px * var(--fx-unit)); text-shadow: 0 calc(3px * var(--fx-unit)) calc(14px * var(--fx-unit)) rgba(0,0,0,.6); }
.fx-title--headline { top: auto !important; bottom: 30% !important; transform: none !important; }
.fx-title--headline .fx-title-box { gap: 0; }
.fx-title--headline .fx-title-text { font-size: calc(104px * var(--fx-unit)); line-height: 1.25; color: var(--fx-accent); text-shadow: 0 calc(3px * var(--fx-unit)) calc(6px * var(--fx-unit)) rgba(0,0,0,.5), 0 0 calc(22px * var(--fx-unit)) rgba(0,0,0,.35); }
.fx-title--headline .fx-title-sub { color: var(--fx-accent); font-size: calc(96px * var(--fx-unit)); font-weight: 800; line-height: 1.2; opacity: 1; text-shadow: 0 calc(3px * var(--fx-unit)) calc(6px * var(--fx-unit)) rgba(0,0,0,.5), 0 0 calc(22px * var(--fx-unit)) rgba(0,0,0,.35); }
.fx-title--kinetic .fx-title-text { font-size: calc(118px * var(--fx-unit)); line-height: 1.35; text-shadow: 0 calc(6px * var(--fx-unit)) calc(28px * var(--fx-unit)) rgba(0,0,0,.5); }
.fx-title--badge .fx-title-box { background: var(--fx-accent); color: var(--fx-ink); border-radius: 999px; min-width: calc(330px * var(--fx-unit)); min-height: calc(330px * var(--fx-unit)); justify-content: center; padding: calc(40px * var(--fx-unit)); box-shadow: 0 calc(14px * var(--fx-unit)) calc(40px * var(--fx-unit)) rgba(0,0,0,.35); }
.fx-title--badge .fx-title-text { color: var(--fx-ink); font-size: calc(92px * var(--fx-unit)); line-height: 1.2; }
.fx-title--badge .fx-title-sub { color: var(--fx-ink); font-size: calc(34px * var(--fx-unit)); text-shadow: none; }
.fx-title--lower-third { justify-content: flex-start; }
.fx-title--lower-third .fx-title-box { align-items: flex-start; text-align: left; background: rgba(12,12,14,.86); border-left: calc(14px * var(--fx-unit)) solid var(--fx-accent); border-radius: calc(10px * var(--fx-unit)); padding: calc(20px * var(--fx-unit)) calc(34px * var(--fx-unit)); }
.fx-title--lower-third .fx-title-text { font-size: calc(54px * var(--fx-unit)); line-height: 1.4; }
.fx-title--cta .fx-title-box { background: var(--fx-accent); border-radius: calc(26px * var(--fx-unit)); padding: calc(26px * var(--fx-unit)) calc(52px * var(--fx-unit)); box-shadow: 0 calc(12px * var(--fx-unit)) calc(36px * var(--fx-unit)) rgba(0,0,0,.35); }
.fx-title--cta .fx-title-text { color: var(--fx-ink); font-size: calc(66px * var(--fx-unit)); line-height: 1.35; }
.fx-title--cta .fx-title-sub { color: var(--fx-ink); font-size: calc(44px * var(--fx-unit)); text-shadow: none; }
.fx-cue { position: absolute; left: calc(60px * var(--fx-unit)); right: calc(60px * var(--fx-unit)); display: flex; flex-direction: column; align-items: center; gap: calc(6px * var(--fx-unit)); text-align: center; visibility: hidden; }
.fx-captions--bottom .fx-cue { bottom: 22%; }
.fx-shot--split { display: flex; flex-direction: column; }
.fx--wide .fx-shot--split { flex-direction: row; }
.fx-half { position: relative; flex: 1 1 50%; overflow: hidden; }
.fx-half video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.fx-half--a { border-bottom: calc(4px * var(--fx-unit)) solid #000; }
.fx--wide .fx-half--a { border-bottom: 0; border-right: calc(4px * var(--fx-unit)) solid #000; }
.fx-captions--center .fx-cue { top: 50%; transform: translateY(-50%); }
.fx-line { font-weight: 700; color: var(--fx-caption-color, #fff); line-height: 1.5; font-size: calc(60px * var(--fx-unit)); text-wrap: balance; text-shadow: 0 calc(2px * var(--fx-unit)) calc(4px * var(--fx-unit)) rgba(0,0,0,.55), 0 0 calc(18px * var(--fx-unit)) rgba(0,0,0,.45); }
.fx-alt { font-weight: 700; color: var(--fx-caption-color, #fff); line-height: 1.4; font-size: calc(56px * var(--fx-unit)); text-shadow: 0 calc(2px * var(--fx-unit)) calc(4px * var(--fx-unit)) rgba(0,0,0,.55), 0 0 calc(18px * var(--fx-unit)) rgba(0,0,0,.45); }
.fx-captions--pop .fx-line, .fx-captions--pop .fx-alt { color: var(--fx-caption-color, var(--fx-accent)); }
.fx-captions--pop .fx-line .fx-on { color: #fff; }
.fx-captions--box .fx-line { background: var(--fx-accent); color: var(--fx-ink); padding: calc(4px * var(--fx-unit)) calc(24px * var(--fx-unit)); border-radius: calc(16px * var(--fx-unit)); -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.fx-captions--clean .fx-line .fx-on { color: var(--fx-accent); }
.fx .motionly-split-item { display: inline-block; }
.fx-cardshot { display: flex; align-items: center; justify-content: center; background: var(--k-bg); --k-bg: #ebe4d6; --k-panel: #f8f4ec; --k-ink: #26221d; --k-soft: rgba(38,34,29,.38); --k-accent: #c96442; }
.fx-kt--white { --k-bg: #ffffff; --k-panel: transparent; --k-ink: #15130f; --k-soft: rgba(21,19,15,.18); --k-accent: #e8322b; }
.fx-kt--white .fx-k-panel { box-shadow: none; }
.fx-kt--white .fx-k-label { padding: calc(8px * var(--fx-unit)) calc(28px * var(--fx-unit)); border-radius: calc(10px * var(--fx-unit)); background: var(--k-accent); color: #fff; letter-spacing: .12em; }
.fx-kt--dark { --k-bg: #0d0d0f; --k-panel: #17171a; --k-ink: #f4f1ea; --k-soft: rgba(244,241,234,.3); --k-accent: var(--fx-accent); }
.fx-kt--accent { --k-bg: var(--fx-accent); --k-panel: #fffdf6; --k-ink: #15130f; --k-soft: rgba(21,19,15,.3); --k-accent: #15130f; }
.fx-k-km { font-family: "Kantumruy Pro", "Inter", sans-serif !important; letter-spacing: 0 !important; text-transform: none !important; }
.fx-k-plus { position: absolute; color: var(--k-soft); font: 300 calc(46px * var(--fx-unit)) "Inter", sans-serif; }
.fx-k-panel { position: relative; display: flex; flex-direction: column; align-items: center; gap: calc(30px * var(--fx-unit)); width: 82%; box-sizing: border-box; padding: calc(64px * var(--fx-unit)) calc(56px * var(--fx-unit)) calc(54px * var(--fx-unit)); border-radius: calc(56px * var(--fx-unit)); background: var(--k-panel); color: var(--k-ink); text-align: center; box-shadow: 0 calc(30px * var(--fx-unit)) calc(80px * var(--fx-unit)) rgba(40,30,20,.18); }
.fx--wide .fx-k-panel { width: 46%; }
.fx-k-dots { align-self: flex-start; display: flex; gap: calc(10px * var(--fx-unit)); }
.fx-k-dots i { width: calc(13px * var(--fx-unit)); height: calc(13px * var(--fx-unit)); border-radius: 50%; background: var(--k-accent); opacity: .85; }
.fx-k-dots i + i { opacity: .35; }
.fx-k-rule { width: 100%; height: 1px; background: var(--k-soft); position: relative; }
.fx-k-rule--end { width: 72%; margin-top: calc(20px * var(--fx-unit)); }
.fx-k-rule--end span { position: absolute; left: 22%; top: 50%; width: calc(12px * var(--fx-unit)); height: calc(12px * var(--fx-unit)); border-radius: 50%; background: var(--k-accent); transform: translate(-50%, -50%); }
.fx-k-pager { display: flex; gap: calc(12px * var(--fx-unit)); }
.fx-k-pager i { width: calc(12px * var(--fx-unit)); height: calc(12px * var(--fx-unit)); border-radius: 50%; background: var(--k-soft); }
.fx-k-pager i.fx-on { background: var(--k-accent); }
.fx-k-eyebrow { font: 600 calc(64px * var(--fx-unit)) / 1.4 "Kantumruy Pro", "Inter", sans-serif; }
.fx-k-title { font-family: "Fraunces", "Kantumruy Pro", serif; font-weight: 500; font-size: calc(150px * var(--fx-unit)); line-height: 1.12; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.fx-k--statement .fx-k-title, .fx-k--list .fx-k-title { font-family: "Kantumruy Pro", "Inter", sans-serif; font-weight: 700; font-size: calc(96px * var(--fx-unit)); line-height: 1.35; }
.fx-k-label { font: 600 calc(42px * var(--fx-unit)) / 1.4 "Inter", "Kantumruy Pro", sans-serif; letter-spacing: .3em; text-transform: uppercase; color: var(--k-accent); }
.fx-k--end .fx-k-label { letter-spacing: .04em; text-transform: none; font-size: calc(58px * var(--fx-unit)); padding: calc(14px * var(--fx-unit)) calc(40px * var(--fx-unit)); border-radius: 999px; background: var(--k-accent); color: var(--k-panel); }
.fx-k-big { font: 400 calc(300px * var(--fx-unit)) / 1 "Inter", sans-serif; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.fx-k-items { display: flex; flex-direction: column; gap: calc(22px * var(--fx-unit)); width: 100%; margin: 0; padding: 0; list-style: none; counter-reset: fx-k; text-align: left; }
.fx-k-items li { counter-increment: fx-k; display: flex; align-items: baseline; gap: calc(24px * var(--fx-unit)); font: 600 calc(56px * var(--fx-unit)) / 1.4 "Kantumruy Pro", "Inter", sans-serif; }
.fx-k-items li::before { content: counter(fx-k, decimal-leading-zero); color: var(--k-accent); font: 600 calc(36px * var(--fx-unit)) "Inter", sans-serif; letter-spacing: .1em; }
`;

export interface FootageFiles {
  files: ProjectSourceFiles;
  width: number;
  height: number;
  fps: number;
  duration: number;
}

/** The project files for an edit; `duration` is never 0, so an empty edit still mounts. */
export function footageFiles(
  edit: FootageEdit,
  projectId = "footage",
): FootageFiles {
  const { width, height } = FORMAT_SIZE[edit.format];
  const total = Math.max(0.5, editDuration(edit));
  const clipVideo = (
    assetId: string,
    start: number,
    trim: number,
    end: number,
    main: boolean,
  ) =>
    `<video${main ? ' class="fx-main"' : ""} data-motify-video src="${footageToken(assetId, "video.mp4")}" data-start="${n(start)}" data-trim="${n(trim)}" data-end="${n(end)}" muted playsinline preload="auto"></video>`;
  const shots = placeSegments(edit)
    .map(({ segment, start, end }) => {
      const id = escapeHtml(segment.id);
      if (segment.card?.film?.state === "ready")
        // Motify's generated card, mounted by the runtime in this holder.
        return `<div class="fx-shot fx-cardshot fx-filmshot" id="fx-shot-${id}"><div class="fx-card-film" data-card-film="${escapeHtml(segment.card.film.projectId)}"></div></div>`;
      if (segment.card) return cardMarkup(id, segment.card);
      const main = clipVideo(segment.assetId, start, segment.in, end, true);
      const overlay = segment.layout === "split" ? segment.overlay : undefined;
      if (
        !overlay ||
        !edit.clips.some((clip) => clip.assetId === overlay.assetId)
      )
        return `<div class="fx-shot" id="fx-shot-${id}">${main}</div>`;
      // The other clip takes the top half (left in landscape); the speaker stays below.
      return `<div class="fx-shot fx-shot--split" id="fx-shot-${id}"><div class="fx-half fx-half--a">${clipVideo(overlay.assetId, start, overlay.in, end, false)}</div><div class="fx-half fx-half--b">${main}</div></div>`;
    })
    .join("\n    ");
  // B-roll over talk: its own layer above the shots; the talk's sound plays on below.
  const cutaways = placeCutaways(edit)
    .map(
      (placed, index) =>
        `<video class="fx-cutaway" id="fx-cut-${index}" data-motify-video src="${footageToken(placed.cutaway.assetId, "video.mp4")}" data-start="${n(placed.start)}" data-trim="${n(placed.trim)}" data-end="${n(placed.end)}" muted playsinline preload="auto"></video>`,
    )
    .join("\n    ");
  const effects = edit.sfx === false ? "" : soundEffects(edit);
  const sounds = placeSounds(edit)
    .map(
      (sound) =>
        `<audio data-motify-audio src="${footageToken(sound.assetId, "audio.m4a")}" data-start="${n(sound.start)}" data-trim="${n(sound.trim)}" data-duration="${n(sound.duration)}" data-volume="${n(Math.min(1, sound.volume))}" data-envelope="${formatEnvelope(
          [
            { time: 0, gain: 0 },
            { time: Math.min(0.04, sound.duration / 3), gain: 1 },
            {
              time: Math.max(sound.duration - 0.04, (sound.duration * 2) / 3),
              gain: 1,
            },
            { time: sound.duration, gain: 0 },
          ],
        )}"></audio>`,
    )
    .join("\n  ");
  const music = edit.music
    ? `<audio data-motify-audio src="motify-audio://${edit.music.trackId}" data-start="0" data-duration="${n(total)}" data-volume="${n(edit.music.volume)}" data-envelope="${musicEnvelope(edit, total)}"></audio>`
    : "";
  const html = `<template data-footage>
<div class="fx fx--${edit.format === "16:9" ? "wide" : "tall"}" style="--fx-accent:${escapeHtml(edit.theme.accent)};--fx-ink:${escapeHtml(edit.theme.ink)};--fx-font:'${escapeHtml(edit.theme.font)}';--fx-short:${Math.min(width, height)}">
  <div class="fx-shots">
    ${shots}
  </div>
  <div class="fx-cutaways">
    ${cutaways}
  </div>
  <div class="fx-flash"></div>
  <div class="fx-captions fx-captions--${edit.captions.style} fx-captions--${edit.captions.position}"${edit.captions.color ? ` style="--fx-caption-color:${escapeHtml(edit.captions.color)}"` : ""}>
    ${captionMarkup(edit)}
  </div>
  <div class="fx-titles">
    ${titleMarkup(edit)}
  </div>
  ${sounds}
  ${effects}
  ${music}
</div>
</template>`;
  const timeline = `${FOOTAGE_MARKER}
// A video cut from the person's own clips. The editor writes this file from the edit below;
// footageTimeline (composition/footage-runtime.ts) places every clip, caption and title on the clock.
const FOOTAGE_EDIT = ${JSON.stringify(edit)};

function buildTimeline(context) {
  footageTimeline(context, FOOTAGE_EDIT);
}
`;
  const scenes: SceneDefinition[] = placeSegments(edit).map(
    ({ segment, start, end }, index) => ({
      id: `scene-${index + 1}`,
      label: `${String(index + 1).padStart(2, "0")} · ${edit.clips.find((clip) => clip.assetId === segment.assetId)?.name ?? "Clip"}`,
      start,
      duration: Math.max(0.01, end - start),
      accent: "#FFD400",
    }),
  );
  return {
    files: {
      "composition.html": html,
      "styles.css": FOOTAGE_CSS.trim(),
      "timeline.js": timeline,
      "index.ts": createGeneratedAdapterSource({
        id: projectId,
        title: edit.title ?? "Footage edit",
        duration: total,
        scenes,
        width,
        height,
        fps: edit.fps,
      }),
    },
    width,
    height,
    fps: edit.fps,
    duration: total,
  };
}

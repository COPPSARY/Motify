/** The music-library tokens a composition's <audio> elements point at. */
export function audioTrackIdsIn(html: string): string[] {
  const ids = new Set<string>();
  for (const match of html.matchAll(
    /motify-audio:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi,
  )) {
    if (match[1]) ids.add(match[1].toLowerCase());
  }
  return [...ids];
}

/**
 * Removes the <audio> element that plays a track, leaving the rest of the
 * source untouched. Returns the input unchanged when the track is not used, so
 * callers can compare and skip a save.
 */
export function removeAudioTrackFromComposition(
  html: string,
  trackId: string,
): string {
  const token = `motify-audio://${trackId}`;
  if (!html.toLowerCase().includes(token.toLowerCase())) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const template = doc.querySelector("template");
  const scope: ParentNode = template?.content ?? doc;
  let removed = 0;
  for (const element of scope.querySelectorAll("audio")) {
    if (
      element.getAttribute("src")?.trim().toLowerCase() === token.toLowerCase()
    ) {
      element.remove();
      removed += 1;
    }
  }
  if (removed === 0) return html;
  return template?.outerHTML ?? doc.body.innerHTML.trim();
}

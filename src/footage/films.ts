import { prepareRawDocument } from "../composition/raw-film";

/**
 * Cards made by Motify's motion-graphics generator, ready to mount: each is a
 * raw film (one HTML document drawn by `window.seek`) kept for the session by
 * its project id. The footage runtime plays it in the card's place.
 */
const documents = new Map<string, string>();

export function cardFilmDocument(projectId: string): string | undefined {
  return documents.get(projectId);
}

/** Keeps a generated card's film; its own sound is dropped, the video has its own. */
export function setCardFilm(projectId: string, html: string): void {
  documents.set(projectId, prepareRawDocument(html).document);
}

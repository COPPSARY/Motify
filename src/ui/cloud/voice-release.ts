/**
 * Voice over generation is not released yet. Production builds (VITE_DD_ENV
 * prod/production) never request it, whatever the toggle state says.
 */
export function isVoiceOverReleased(): boolean {
  const env = String(import.meta.env["VITE_DD_ENV"] ?? "").toLowerCase();
  return env !== "prod" && env !== "production";
}

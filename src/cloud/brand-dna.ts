/**
 * Brand DNA as the editor sees it. The backend owns the schema
 * (`packages/brand/brand-dna.ts` in Motionly-Backend) and validates every
 * save; this mirrors its shape so the page can edit it offline between saves.
 */

export const BRAND_COLOR_ROLES = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "other",
] as const;
export const BRAND_FONT_ROLES = ["heading", "body", "accent", "mono"] as const;
export const BRAND_FONT_WEIGHTS = [
  100, 200, 300, 400, 500, 600, 700, 800, 900,
] as const;
export const BRAND_ASSET_ROLES = [
  "logo",
  "favicon",
  "logo_variant",
  "screenshot",
  "image",
  "icon",
  "font",
] as const;

export type BrandColorRole = (typeof BRAND_COLOR_ROLES)[number];
export type BrandFontRole = (typeof BRAND_FONT_ROLES)[number];
export type BrandAssetRole = (typeof BRAND_ASSET_ROLES)[number];
export type BrandFieldSource = "manual" | "site_intelligence";

export interface BrandColor {
  id: string;
  name: string;
  hex: string;
  role: BrandColorRole;
}

export interface BrandFontFile {
  assetId: string;
  weight: number;
  style: "normal" | "italic";
}

export interface BrandFont {
  id: string;
  family: string;
  role: BrandFontRole;
  /** `preset`: ships with Motionly or every system. `upload`: the brand's own files. */
  source: "preset" | "upload";
  files: BrandFontFile[];
}

export interface BrandFeature {
  id: string;
  title: string;
  description: string;
}

export interface BrandDna {
  identity: { name: string; websiteUrl: string; tagline: string };
  visual: { colors: BrandColor[]; fonts: BrandFont[] };
  product: {
    description: string;
    features: BrandFeature[];
    targetAudience: string;
  };
  story: {
    problem: string;
    solution: string;
    differentiators: string;
    proof: string;
  };
  voice: { tone: string[]; writingStyle: string };
}

export interface BrandFieldProvenance {
  source: BrandFieldSource;
  updatedAt: string;
  sourceUrl?: string;
  confidence?: number;
}

export interface BrandAsset {
  assetId: string;
  role: BrandAssetRole;
  label: string | null;
  source: BrandFieldSource;
  sourceUrl: string | null;
  fileName: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  token: string;
  createdAt: string;
}

export interface BrandResource {
  workspaceId: string;
  revision: number;
  schemaVersion: number;
  dna: BrandDna;
  provenance: Record<string, BrandFieldProvenance>;
  assets: BrandAsset[];
  updatedAt: string | null;
}

/**
 * Typefaces a brand can pick without uploading anything. Each one is either
 * bundled with Motionly or installed on every desktop system, so a film set
 * in it renders the same in the preview and in the export.
 */
export const PRESET_FONTS: ReadonlyArray<{
  family: string;
  stack: string;
  kind: "Sans" | "Serif" | "Display" | "Mono";
}> = [
  {
    family: "Inter",
    stack: '"Inter Variable", Inter, sans-serif',
    kind: "Sans",
  },
  {
    family: "Space Grotesk",
    stack: '"Space Grotesk", sans-serif',
    kind: "Display",
  },
  { family: "Helvetica", stack: "Helvetica, Arial, sans-serif", kind: "Sans" },
  { family: "Verdana", stack: "Verdana, sans-serif", kind: "Sans" },
  { family: "Trebuchet MS", stack: '"Trebuchet MS", sans-serif', kind: "Sans" },
  { family: "Georgia", stack: "Georgia, serif", kind: "Serif" },
  {
    family: "Times New Roman",
    stack: '"Times New Roman", serif',
    kind: "Serif",
  },
  { family: "Courier New", stack: '"Courier New", monospace', kind: "Mono" },
];

/** Image types the asset pipeline accepts. */
export const BRAND_IMAGE_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";

export const BRAND_LIMITS = {
  colors: 12,
  fonts: 6,
  fontFiles: 18,
  features: 12,
  tone: 8,
} as const;

export function emptyBrandDna(): BrandDna {
  return {
    identity: { name: "", websiteUrl: "", tagline: "" },
    visual: { colors: [], fonts: [] },
    product: { description: "", features: [], targetAudience: "" },
    story: { problem: "", solution: "", differentiators: "", proof: "" },
    voice: { tone: [], writingStyle: "" },
  };
}

export function cloneBrandDna(dna: BrandDna): BrandDna {
  return structuredClone(dna);
}

export function sameBrandDna(left: BrandDna, right: BrandDna): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Gives Tiffy the saved brand context without making the user repeat it in
 * every prompt. The workspace remains the source of truth; this is only the
 * generation brief derived from that source.
 */
export function brandGenerationBrief(resource: BrandResource): string {
  const { dna, assets } = resource;
  const lines = [
    "BRAND DNA (saved by the user; apply it throughout this film):",
    `Brand: ${dna.identity.name || "Not specified"}`,
    dna.identity.websiteUrl ? `Website: ${dna.identity.websiteUrl}` : "",
    dna.identity.tagline ? `Tagline: ${dna.identity.tagline}` : "",
    dna.visual.colors.length
      ? `Colors: ${dna.visual.colors.map((color) => `${color.name} ${color.hex} (${color.role})`).join(", ")}`
      : "",
    dna.visual.fonts.length
      ? `Typography: ${dna.visual.fonts.map((font) => `${font.family} (${font.role})`).join(", ")}`
      : "",
    dna.product.description ? `Product: ${dna.product.description}` : "",
    dna.product.features.length
      ? `Features: ${dna.product.features.map((feature) => `${feature.title}: ${feature.description}`).join("; ")}`
      : "",
    dna.product.targetAudience ? `Audience: ${dna.product.targetAudience}` : "",
    dna.story.problem ? `Problem: ${dna.story.problem}` : "",
    dna.story.solution ? `Solution: ${dna.story.solution}` : "",
    dna.story.differentiators
      ? `Differentiators: ${dna.story.differentiators}`
      : "",
    dna.story.proof ? `Proof: ${dna.story.proof}` : "",
    dna.voice.tone.length ? `Tone: ${dna.voice.tone.join(", ")}` : "",
    dna.voice.writingStyle ? `Writing style: ${dna.voice.writingStyle}` : "",
    assets.length
      ? `Brand assets: ${assets.map((asset) => `${asset.role} ${asset.label || asset.fileName} (${asset.token})`).join("; ")}`
      : "",
    "Use these facts as established context. Do not ask the user to re-enter them, and do not invent replacements for specified brand details.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function newItemId(): string {
  return crypto.randomUUID().slice(0, 12);
}

/**
 * What the page counts toward "complete": the fields a film actually draws on.
 * Kept small on purpose so the number means something.
 */
export function brandCompleteness(
  dna: BrandDna,
  assets: readonly BrandAsset[],
): { filled: number; total: number } {
  const checks = [
    dna.identity.name,
    dna.identity.websiteUrl,
    assets.some((asset) => asset.role === "logo"),
    dna.visual.colors.length > 0,
    dna.visual.fonts.length > 0,
    dna.product.description,
    dna.product.features.length > 0,
    dna.product.targetAudience,
    dna.story.problem || dna.story.solution,
    dna.voice.tone.length > 0 || dna.voice.writingStyle,
    assets.some((asset) => asset.role === "screenshot"),
  ];
  return { filled: checks.filter(Boolean).length, total: checks.length };
}

/** Normalises a typed colour to `#rrggbb`, or null when it is not one. */
export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(raw)) {
    return `#${[...raw].map((char) => char + char).join("")}`;
  }
  return /^[0-9a-f]{6}$/.test(raw) ? `#${raw}` : null;
}

/** Accepts `acme.com` the way the backend does. */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
}

export function displayUrl(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

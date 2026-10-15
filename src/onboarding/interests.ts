/**
 * The template categories a new account picked before Prompt Templates, so the
 * tab opens on a short, relevant list instead of every template. Kept in
 * localStorage only until the tab reads it once: a convenience, not an account
 * setting.
 */
const STORAGE_KEY = "motify_template_interests";

export interface CategoryCount {
  readonly name: string;
  readonly count: number;
}

/** Every category the templates use, most templates first, ties alphabetical. */
export function categoriesOf(
  templates: readonly { readonly categories: readonly string[] }[],
): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const template of templates) {
    for (const name of new Set(template.categories)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function saveInterests(
  storage: Storage,
  categories: readonly string[],
): void {
  try {
    if (categories.length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify([...categories]));
  } catch {
    // Without storage the tab simply opens on every template.
  }
}

/** The saved picks, once: reading them forgets them. */
export function takeInterests(storage: Storage): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    storage.removeItem(STORAGE_KEY);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

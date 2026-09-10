import type { GenerationAsset } from "../ai/generation-guidance";

/**
 * What a pasted or uploaded image is *for*. An image can inform how the film
 * should look without ever being placed in it, and the two cases produce
 * opposite instructions, so the intent is asked for once and then carried
 * with the reference everywhere it goes.
 *
 * - `reference`: a screenshot, storyboard or style reference. The model must
 *   read it and match what it shows; it must never appear in the composition.
 * - `asset`: a logo, product shot or texture that belongs on screen. Its
 *   token must appear in the authored HTML.
 *
 * `undefined` means the user has not answered yet, and the prompt is held.
 */
export type AssetIntent = "reference" | "asset";

export interface LocalAssetReference {
  id: string;
  name: string;
  mimeType: string;
  token: string;
  uploadId?: string;
  intent?: AssetIntent;
}

const DATABASE = "motionly-local-assets-v1";
const STORE = "assets";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local asset storage."));
  });
}

export async function storeLocalAsset(
  file: Blob,
  name: string,
): Promise<LocalAssetReference> {
  const id = crypto.randomUUID();
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not store image."));
  });
  database.close();
  return {
    id,
    name,
    mimeType: file.type || "image/png",
    token: `motionly-asset://${id}`,
  };
}

export async function readLocalAsset(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const request = database
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .get(id);
    request.onsuccess = () =>
      resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read image."));
  });
  database.close();
  return result;
}

export async function clearLocalAssets(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not clear local assets."));
  });
  database.close();
}

function blobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not encode image."));
    reader.readAsDataURL(blob);
  });
}

async function createAiRendition(blob: Blob): Promise<Blob> {
  if (
    blob.size <= 4 * 1024 * 1024 ||
    !blob.type.startsWith("image/") ||
    blob.type === "image/svg+xml" ||
    typeof createImageBitmap !== "function"
  ) {
    return blob;
  }
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value ?? blob), "image/webp", 0.88),
    );
  } catch {
    return blob;
  }
}

export async function generationAsset(
  reference: LocalAssetReference,
): Promise<GenerationAsset> {
  const blob = await readLocalAsset(reference.id);
  if (!blob)
    throw new Error(`${reference.name} is missing from browser storage.`);
  const rendition = await createAiRendition(blob);
  return {
    ...reference,
    mimeType: rendition.type || reference.mimeType || blob.type || "image/png",
    dataBase64: await blobAsBase64(rendition),
  };
}

export async function hydrateAssetTokens(
  source: string,
  references: readonly LocalAssetReference[],
): Promise<{ source: string; objectUrls: string[] }> {
  let hydrated = source;
  const objectUrls: string[] = [];
  for (const reference of references) {
    if (!hydrated.includes(reference.token)) continue;
    const blob = await readLocalAsset(reference.id);
    if (!blob) continue;
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    hydrated = hydrated.replaceAll(reference.token, url);
  }
  return { source: hydrated, objectUrls };
}

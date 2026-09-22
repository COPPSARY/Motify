import { hydrateAudioTokens } from "./audio-tokens";
import { fetchApi } from "./client";

const MOTIFY_ASSET_TOKEN =
  /motify-asset:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

export async function hydrateCloudAssetTokens(
  source: string,
): Promise<{ source: string; objectUrls: string[] }> {
  const assetIds = [...source.matchAll(MOTIFY_ASSET_TOKEN)].map(
    (match) => match[1],
  );
  let hydrated = source;
  const objectUrls: string[] = [];

  for (const assetId of new Set(assetIds)) {
    const accessResponse = await fetchApi(`/v1/assets/${assetId}/access`);
    const { data } = (await accessResponse.json()) as {
      data: { url: string };
    };
    const imageResponse = /^https?:\/\//i.test(data.url)
      ? await fetch(data.url)
      : await fetchApi(data.url);
    if (!imageResponse.ok) {
      throw new Error(`Asset download failed: ${imageResponse.status}`);
    }
    const objectUrl = URL.createObjectURL(await imageResponse.blob());
    objectUrls.push(objectUrl);
    hydrated = hydrated.replaceAll(`motify-asset://${assetId}`, objectUrl);
  }

  const audio = await hydrateAudioTokens(hydrated);
  return {
    source: audio.source,
    objectUrls: [...objectUrls, ...audio.objectUrls],
  };
}

export async function uploadAsset(
  workspaceId: string,
  file: File,
  onProgress?: (percentage: number) => void,
): Promise<string> {
  // 1. Calculate SHA-256
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const checksum = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 2. Create Upload
  const createResponse = await fetchApi(
    `/v1/workspaces/${workspaceId}/assets/uploads`,
    {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        byteSize: file.size,
        checksum,
      }),
    },
  );
  const { data: uploadInfo } = await createResponse.json();

  // 3. Put Bytes. Supabase signed-upload endpoints expect multipart form data
  // and must be called directly rather than through the Motify API base URL.
  if (/^https?:\/\//i.test(uploadInfo.uploadUrl)) {
    await uploadSignedAsset(uploadInfo.uploadUrl, file, onProgress);
  } else {
    await fetchApi(uploadInfo.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: arrayBuffer,
    });
    onProgress?.(100);
  }

  // 4. Complete Upload
  const completeResponse = await fetchApi(
    `/v1/workspaces/${workspaceId}/assets/uploads/${uploadInfo.uploadId}/complete`,
    {
      method: "POST",
    },
  );
  const { data: assetInfo } = await completeResponse.json();

  return assetInfo.id;
}

function uploadSignedAsset(
  uploadUrl: string,
  file: File,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error(`Asset storage upload failed: ${request.status}`));
    });
    request.addEventListener("error", () =>
      reject(new Error("Asset storage upload failed.")),
    );
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    request.open("PUT", uploadUrl);
    request.setRequestHeader("x-upsert", "false");
    request.send(body);
  });
}

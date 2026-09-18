import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));

vi.mock("../src/api/client", () => ({ fetchApi }));

import { hydrateCloudAssetTokens, uploadAsset } from "../src/api/assets";
class SignedUploadRequest {
  static latest: SignedUploadRequest | null = null;

  readonly upload = new EventTarget();
  readonly headers = new Headers();
  status = 0;
  private readonly listeners = new Map<string, EventListener>();

  constructor() {
    SignedUploadRequest.latest = this;
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener);
  }

  open(_method: string, _url: string): void {}

  setRequestHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  send(_body: XMLHttpRequestBodyInit | Document | null): void {
    this.upload.dispatchEvent(
      new ProgressEvent("progress", {
        lengthComputable: true,
        loaded: 1,
        total: 2,
      }),
    );
    this.status = 200;
    this.listeners.get("load")?.(new Event("load"));
  }
}

describe("uploadAsset", () => {
  beforeEach(() => {
    fetchApi.mockReset();
    vi.unstubAllGlobals();
    SignedUploadRequest.latest = null;
    vi.stubGlobal("XMLHttpRequest", SignedUploadRequest);
  });

  it("uploads bytes directly to a Supabase signed URL before completing the asset", async () => {
    fetchApi
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              uploadId: "11111111-1111-4111-8111-111111111111",
              assetId: "11111111-1111-4111-8111-111111111111",
              uploadUrl:
                "https://example.supabase.co/storage/v1/object/upload/sign/motify-assets/object?token=signed",
              uploadToken: "signed",
            },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { id: "11111111-1111-4111-8111-111111111111" },
          }),
          { status: 200 },
        ),
      );
    const directFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", directFetch);

    const id = await uploadAsset(
      "22222222-2222-4222-8222-222222222222",
      new File(["image bytes"], "logo.png", { type: "image/png" }),
    );

    expect(id).toBe("11111111-1111-4111-8111-111111111111");
    expect(directFetch).not.toHaveBeenCalled();
    expect(SignedUploadRequest.latest?.headers.get("x-upsert")).toBe("false");
    expect(fetchApi).toHaveBeenCalledTimes(2);
  });

  it("reports the real signed-upload percentage while bytes are sent", async () => {
    fetchApi
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              uploadId: "11111111-1111-4111-8111-111111111111",
              uploadUrl:
                "https://example.supabase.co/storage/v1/object/upload/sign/motify-assets/object?token=signed",
            },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { id: "11111111-1111-4111-8111-111111111111" },
          }),
          { status: 200 },
        ),
      );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
    const progress: number[] = [];
    await uploadAsset(
      "22222222-2222-4222-8222-222222222222",
      new File(["image bytes"], "logo.png", { type: "image/png" }),
      (percentage) => progress.push(percentage),
    );

    expect(progress).toEqual([50, 100]);
  });

  it("hydrates persisted Motify asset tokens through short-lived read URLs", async () => {
    const assetId = "11111111-1111-4111-8111-111111111111";
    fetchApi.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { url: "https://storage/read-signed" } }),
        { status: 200 },
      ),
    );
    const directFetch = vi.fn().mockResolvedValue(
      new Response(new Blob(["image bytes"], { type: "image/png" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", directFetch);
    const createObjectURL = vi.fn().mockReturnValue("blob:persisted-asset");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });

    const hydrated = await hydrateCloudAssetTokens(
      `<img src="motify-asset://${assetId}">`,
    );

    expect(hydrated).toEqual({
      source: '<img src="blob:persisted-asset">',
      objectUrls: ["blob:persisted-asset"],
    });
    expect(fetchApi).toHaveBeenCalledWith(`/v1/assets/${assetId}/access`);
    expect(directFetch).toHaveBeenCalledWith("https://storage/read-signed");
  });
});

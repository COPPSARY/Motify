import packageMetadata from "../package.json";

let rumEnabled = false;
let client: Promise<
  (typeof import("@datadog/browser-rum"))["datadogRum"]
> | null = null;

export interface DatadogUser {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
}

function withClient(
  use: (
    datadogRum: (typeof import("@datadog/browser-rum"))["datadogRum"],
  ) => void,
): void {
  void client?.then(use);
}

function shouldCaptureInThisEnvironment(): boolean {
  if (typeof window === "undefined" || import.meta.env.MODE === "test") {
    return false;
  }
  return (
    !import.meta.env.DEV ||
    import.meta.env["VITE_PUBLIC_DATADOG_CAPTURE_DEV"] === "true"
  );
}

export function initDatadogRum(): boolean {
  if (rumEnabled) return true;

  const applicationId = import.meta.env[
    "VITE_PUBLIC_DATADOG_APPLICATION_ID"
  ] as string | undefined;
  const clientToken = import.meta.env["VITE_PUBLIC_DATADOG_CLIENT_TOKEN"] as
    string | undefined;
  if (!applicationId || !clientToken || !shouldCaptureInThisEnvironment()) {
    return false;
  }

  const site =
    (import.meta.env["VITE_PUBLIC_DATADOG_SITE"] as string | undefined) ??
    "ap1.datadoghq.com";
  const service =
    (import.meta.env["VITE_PUBLIC_DATADOG_SERVICE"] as string | undefined) ??
    "motify-web";
  const env =
    (import.meta.env["VITE_DD_ENV"] as string | undefined) ??
    import.meta.env.MODE;
  const version =
    (import.meta.env["VITE_DD_VERSION"] as string | undefined) ||
    packageMetadata.version;

  client = import("@datadog/browser-rum").then(({ datadogRum }) => {
    datadogRum.init({
      applicationId,
      clientToken,
      site,
      service,
      env,
      version,
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackResources: true,
      trackUserInteractions: true,
      trackLongTasks: true,
      defaultPrivacyLevel: "mask-user-input",
    });
    return datadogRum;
  });
  rumEnabled = true;
  return true;
}

export function isDatadogRumEnabled(): boolean {
  return rumEnabled;
}

export function identifyDatadogUser(user: DatadogUser): void {
  if (!rumEnabled) return;
  withClient((datadogRum) =>
    datadogRum.setUser({
      id: user.id,
      name: user.displayName,
      email: user.email,
    }),
  );
}

export function clearDatadogUser(): void {
  if (!rumEnabled) return;
  withClient((datadogRum) => datadogRum.clearUser());
}

import "@fontsource-variable/inter";
import { mount } from "svelte";
import App from "./ui/App.svelte";
import BrandDnaPage from "./brand/BrandDnaPage.svelte";
import "./styles.css";
import { initPostHog } from "./posthog";
import { readAppMode } from "./app/mode";
import { isBrandRoute } from "./app/routes";

const mode = readAppMode(document);
if (mode === "cloud") initPostHog();
// Brand DNA is its own page, not a panel of the editor: it needs the cloud
// workspace, so the local editor never routes to it.
if (mode === "cloud" && isBrandRoute(window.location.pathname)) {
  mount(BrandDnaPage, { target: document.body });
} else {
  mount(App, { target: document.body, props: { mode } });
}

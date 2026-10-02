import "@fontsource-variable/inter";
import { mount } from "svelte";
import "./styles.css";
import { initPostHog } from "./posthog";
import { readAppMode } from "./app/mode";
import { isBrandRoute } from "./app/routes";

const mode = readAppMode(document);
const removeBootScreen = () => document.getElementById("boot-screen")?.remove();
if (mode === "cloud") initPostHog();
// Brand DNA is its own page, not a panel of the editor: it needs the cloud
// workspace, so the local editor never routes to it. Each page is its own
// chunk, so opening one never downloads the other.
if (mode === "cloud" && isBrandRoute(window.location.pathname)) {
  void import("./brand/BrandDnaPage.svelte").then(
    ({ default: BrandDnaPage }) => {
      mount(BrandDnaPage, { target: document.body });
      removeBootScreen();
    },
  );
} else {
  void import("./ui/App.svelte").then(({ default: App }) => {
    mount(App, { target: document.body, props: { mode } });
    removeBootScreen();
  });
}

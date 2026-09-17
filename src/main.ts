import "@fontsource-variable/inter";
import { mount } from "svelte";
import App from "./ui/App.svelte";
import "./styles.css";
import { initPostHog } from "./posthog";
import { readAppMode } from "./app/mode";

const mode = readAppMode(document);
if (mode === "cloud") initPostHog();
mount(App, { target: document.body, props: { mode } });

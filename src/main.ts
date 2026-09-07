import "@fontsource-variable/inter";
import { mount } from "svelte";
import App from "./ui/App.svelte";
import "./styles.css";
import { initPostHog } from "./posthog";

initPostHog();
mount(App, { target: document.body });

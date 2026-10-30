// Node 25 ships its own global localStorage/sessionStorage. Without --localstorage-file they are
// empty objects with no methods, and they shadow the working ones jsdom provides, so any test
// that touches storage fails with "localStorage.clear is not a function". Put jsdom's back.
// On Node 20 and 22 the globals already work and this does nothing.
import type { JSDOM } from "jsdom";

const dom = (globalThis as { jsdom?: JSDOM }).jsdom;

for (const name of ["localStorage", "sessionStorage"] as const) {
  if (!dom || typeof globalThis[name]?.clear === "function") continue;
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: dom.window[name],
  });
}

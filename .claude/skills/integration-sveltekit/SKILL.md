---
name: integration-sveltekit
description: PostHog integration for SvelteKit applications
metadata:
  author: PostHog
  version: 1.51.0
---

# PostHog integration for SvelteKit

This skill helps you add PostHog analytics to SvelteKit applications.

## Workflow

Follow these steps in order to complete the integration:

1. `references/1-begin.md` - PostHog Setup - Begin ← **Start here**
2. `references/2-edit.md` - PostHog Setup - Edit
3. `references/3-revise.md` - PostHog Setup - Revise
4. `references/4-conclude.md` - PostHog Setup - Conclusion

## Reference files

- `references/EXAMPLE.md` - SvelteKit example project code
- `references/1-begin.md` - Start the event tracking setup process by analyzing the project and creating an event tracking plan
- `references/2-edit.md` - Implement PostHog event tracking in the identified files, following best practices and the example project
- `references/3-revise.md` - Review and fix any errors in the PostHog integration implementation
- `references/4-conclude.md` - Review and fix any errors in the PostHog integration implementation
- `references/svelte.md` - Svelte - docs
- `references/identify-users.md` - Identify users - docs
- `references/COMMANDMENTS.md` - Framework-specific rules the integration must follow

The example project shows the target implementation pattern. Consult the documentation for API details.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys. Never hardcode them.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
- **Match the example**: Your implementation should follow the example project's patterns as closely as possible.

## Framework guidelines

- A missing PostHog configuration must never break the app — read keys optionally (never a required setting), guard init and capture behind their presence, and keep build and boot working with no PostHog environment set — but never silently: in development or debug builds fail loudly, using the language's idiomatic error, with the message "<VAR> variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once <VAR> is configured" (substituting the actual variable name); production stays a no-op
- For server-side capture (+server.ts endpoints, actions, hooks like handleError), the handler is short-lived per request. Configure the posthog-node singleton with flushAt 1 and flushInterval 0, and `await posthog.flush()` after capturing and before returning, or the batched event is silently dropped when the request ends
- Set paths.relative to false in svelte.config.js — this is required for PostHog session replay to work correctly with SSR and is easy to miss
- Use the Svelte MCP server tools to check Svelte documentation (list-sections, get-documentation) and validate components (svelte-autofixer) — always run svelte-autofixer on new or modified .svelte files before finishing
- Remember that source code is available in the node_modules directory
- Check package.json for type checking or build scripts to validate changes
- When identity comes from framework-bridged state (Inertia or SSR shared props, a serialized session), confirm the backend actually shares that field — add the share server-side if missing — before identifying from it
- When a reverse proxy is configured, both /static/* AND /array/* must route to the assets origin (us-assets.i.posthog.com or eu-assets.i.posthog.com).
- posthog-js is the JavaScript SDK package name
- posthog.init() MUST be called before any other PostHog methods (capture, identify, etc.)
- posthog-js is browser-only — do NOT import it in Node.js or server-side contexts (use posthog-node instead)
- Autocapture is ON by default with posthog-js (tracks clicks, form submissions, pageviews). Keep autocapture enabled unless the user explicitly asks to turn it off.
- NEVER send PII in posthog.capture() event properties — no emails, full names, phone numbers, physical addresses, IP addresses, or user-generated content
- PII belongs in posthog.identify() person properties (email, name, role), NOT in capture() event properties
- Call posthog.identify(userId, { email, name, role }) on login AND on page refresh if the user is already logged in
- Call posthog.reset() on logout — the transition out of an identified session, never an initially anonymous page load (that discards the anonymous id and its history) — and before identify() when switching directly between accounts
- For SPAs without a framework router, capture pageviews with posthog.capture($pageview) or use the capture_pageview history_change option in init for History API routing
- When verifying with an automated browser (Playwright, Puppeteer, Selenium), posthog-js's bot filter silently drops every capture while flags and asset loads still succeed. Override navigator.webdriver, the user agent, AND navigator.userAgentData before concluding events do not send. Diagnose with ?__posthog_debug=true ("likely bot" in the console).
- posthog-node is the Node.js server-side SDK package name; posthog-js is browser-only, so use posthog-node on the server instead
- Include enableExceptionAutocapture: true in the PostHog constructor options
- Add posthog.capture() calls in route handlers for meaningful user actions – every route that creates, updates, or deletes data should track an event with contextual properties
- Add posthog.captureException(err, distinctId) in the application's error handler (e.g., Express error middleware, Fastify setErrorHandler, Koa app.on('error'))
- The SDK batches events and flushes asynchronously. await flush() or await shutdown() before letting that process exit. If unsure, set flushAt 1 and flushInterval 0.
- `posthog.capture()` enqueues synchronously and returns; the batched HTTP send happens afterwards. Treat every per-request handler as short-lived even when the framework feels like a server: Next.js / Nuxt / SvelteKit / Remix route handlers, serverless and edge functions, and Lambda are torn down per invocation before the send runs. Create the client with flushAt 1 and flushInterval 0, then await the send before returning. Always use `await posthog.flush()` for a shared/singleton client, `await posthog.shutdown()` for a per-request client. Never skip the awaited flush or risk the enqueued event being silently dropped.
- Reverse proxy is NOT needed for server-side Node.js – only client-side JavaScript needs a proxy to avoid ad blockers

## Identifying users

Identify users during login and signup events. Refer to the example code and documentation for the correct identify pattern for this framework. If both frontend and backend code exist, pass the client-side session and distinct ID using `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` headers to maintain correlation.

## Error tracking

Add PostHog error tracking to relevant files, particularly around critical user flows and API boundaries.

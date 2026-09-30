---
name: security-privacy
description: Security and privacy rules for Skimap.eu (static Next.js export, Cloudflare Pages Functions with D1, localStorage-only personal data), mapped to OWASP Top 10:2025. Use when a change touches user input, file import, HTML strings, localStorage, location, cookies, headers, CSP, a new external host, auth, WebAuthn, admin or portal, webhooks (Ko-fi), rate limits, D1 queries, secrets, dependencies, or error handling in functions/.
---

# Security and privacy

Threat model in one paragraph: the public site is static HTML and JS, so the attack surface is (1) what the browser runs and stores, and (2) the Pages Functions in `functions/` with their D1 databases, admin and portal logins, Ko-fi webhook, contact form, and stats. The visitor's personal data (favourites, plan, birth year, location) never leaves `localStorage`; keeping it that way is a security property, not a feature detail.

Read `docs/security-review.md` first. It lists what is already fixed and what is accepted. Do not re-open an accepted item without new evidence, and do not undo a fix.

## Checklist by OWASP Top 10:2025

Walk the rows your change touches. Each names the helper that already solves it.

| OWASP 2025 | What it means here | Use | Never |
| --- | --- | --- | --- |
| A01 Broken access control (includes SSRF) | Admin and portal routes, object ids in requests, the source checker's outbound fetch | `src/lib/admin/auth.ts`, `portal/auth.ts`, `portal/session.ts`; `assertSafeHttpUrl` / `safeFetchText` in `ssrf.ts` | Trust an id from the body without checking it belongs to the session. `fetch()` a URL a user supplied |
| A02 Security misconfiguration | CSP, headers, dev bypasses, CORS | `security.ts` + `public/_headers` (kept equal by `html.test.ts`); `dev-bypass.ts` (flag **and** localhost) | Loosen CSP to silence an error. Gate anything on `NODE_ENV` alone: previews are not production |
| A03 Supply chain | npm packages, lockfile, map workers copied into `public/vendor` | `npm ci`, `npm run check:lockfile`, `npm audit --omit=dev` | Add a package for what 30 lines do. Load a script from a CDN |
| A04 Cryptographic failures | Token and code comparison, IP hashing, session cookies | `timingSafeEqualString`, `hashIp` with a salt from env, `jose`, `portal/crypto.ts` | Compare secrets with `===`. Invent a hash scheme. Store a raw IP |
| A05 Injection | D1 SQL, HTML on map markers, URLs built from input | `.prepare("… ?").bind(value)` (all 14 queries do); `escapeHtml` for any `innerHTML`; `URL` and `URLSearchParams` | Template strings inside `prepare()`. `dangerouslySetInnerHTML` outside the theme script in `DocumentShell.tsx` |
| A06 Insecure design | Rate limits, abuse of free endpoints, privacy by design | Per-IP hashed bucket plus global cap (`contact/rate-limit.ts`, `support/redeem-rate.ts`, `stats/handler.ts`) | An endpoint without a limit. Sending personal data to a function "to sync" |
| A07 Authentication failures | WebAuthn portal, admin via Cloudflare Access | `@simplewebauthn/server` via `portal/webauthn.ts`, RP id from `webAuthnConfigFromRequest`; `login-rate.ts` | Accept a login without challenge and origin verification. Log in by email link without expiry |
| A08 Integrity failures | Webhooks, imported user data, overrides | Ko-fi token check with `timingSafeEqualString`, replay blocked by transaction id; Zod `safeParse` on bodies (admin, portal, and contact handlers already do) | Trust a webhook body before verifying it. Apply imported JSON without validating each field |
| A09 Logging and alerting | Function errors | Log an event name and a hashed IP | Log bodies, emails, tokens, or raw IPs |
| A10 Exceptional conditions | Errors in functions, missing bindings, failed parses | Fail **closed**: return 4xx/5xx JSON via `jsonResponse`, `503` when `DB` is missing (as `functions/api/contact.ts` does) | Return a stack trace. Treat a failed auth or parse as "allow". Swallow an error and continue with defaults that grant access |

## Input handling

- **Every request body**: `readJsonBody(request, maxBytes)` (size cap, returns `null` on bad JSON), then a Zod schema with `safeParse`. Reject unknown shapes with 400. Pick the smallest `maxBytes` that fits (redeem uses 512).
- **Origin on state-changing requests**: `originAllowed` / `assertAdminPostOrigin`. POST only; never change state on GET.
- **Client IP**: `clientIpFromRequest` reads `CF-Connecting-IP` only. Never `X-Forwarded-For`: anyone can send it.
- **Imported files and `localStorage` are untrusted input too.** Another script, an old version, or a hand-edited export can put anything there. Validate type, range, and length for every field, and ignore keys like `__proto__`. Worked example of the gap: `importSavedData` in `AppState.tsx` accepts any object as `resortDays` and any number as `birthYear`. The fix is a Zod schema in `src/lib/` (integer days 0–365 keyed by known resort ids, birth year in a sane range, ISO date string), with a test for each rejected case.

## Browser side

- React escapes text. The risks are `innerHTML` (map popups and markers: always `escapeHtml`), `href` from data (allow only `https:` and relative), and `target="_blank"` (add `rel="noopener noreferrer"`).
- **CSP.** `'unsafe-inline'` in `script-src` is accepted: a static export cannot use nonces (Next.js docs: nonces need dynamic rendering). The only route to removing it is a post-build step that hashes every inline script into both CSP copies. That is a project, not a side fix. A new external host needs both `security.ts` and `public/_headers`, and it should be the narrowest directive (`img-src` before `connect-src`, never `default-src`).
- **Mapbox token.** It ships in the bundle by design. Protect it with URL restrictions on the Mapbox account, never by hiding it. Any other token in `NEXT_PUBLIC_*` is a leak. `secrets-bundle.test.ts` searches `out/` for four secret names, and passes silently when `out/` does not exist: run `npm run build` before `npm test` to make it count, and add every new secret name to its `SECRET_NAMES` list.
- **Location.** One point, never sent anywhere, never in the URL (`places` is kept out of `url-state.ts`). Stop the watch before deleting it (Lessons).

## Secrets

- Production secrets live as Cloudflare Pages secrets; local ones in `.dev.vars` / `.env.local` (git-ignored). Never in `wrangler.toml` `vars`, never in `config/*.json`, never in a test fixture that looks real.
- If a secret was committed, rotating it is the fix: removing the line is not. Tell the owner; do not rewrite history yourself.

## Dependencies

- Before adding a package, check its weekly downloads, last release, maintainers, and install scripts. Prefer the platform (Web Crypto, `URL`, `Intl`) and existing deps (`zod`, `jose`).
- After any dependency change: `npm ci`, `npm run check:lockfile`, `npm audit --omit=dev`. Report high or critical findings to the owner; do not run `npm audit fix --force`.

## Verify

1. A test for each rejected input: wrong type, too big, missing field, wrong origin, over the rate limit, bad signature. Handlers in `src/lib/**/handler.ts` are testable with `db/test-sqlite.ts`.
2. `npm run build`, then `npm test` (includes `html.test.ts` CSP sync and `secrets-bundle.test.ts`, which needs `out/`).
3. A new external host: load the page with the browser tools and confirm no CSP errors in the console on both map providers.
4. Add any new finding, fixed or accepted, to `docs/security-review.md` with its severity.

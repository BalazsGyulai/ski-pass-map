# Security review — Part 9 (Skimap.eu)

Review date: 2026-09-26. Scope: Cloudflare Pages Functions (`functions/`), shared libs (`src/lib/`), static export headers, and client storage.

| Severity | File / area | Issue | Fix | Status |
| --- | --- | --- | --- | --- |
| High | `src/lib/admin/auth.ts`, `src/lib/portal/auth.ts` | Admin/portal dev bypass used `NODE_ENV !== "production"`, which is unreliable on Cloudflare Pages previews. | Bypass now requires `ADMIN_DEV_BYPASS=1` / `PORTAL_DEV_BYPASS=1` **and** request host `localhost` / `127.0.0.1` only (`src/lib/dev-bypass.ts`). Blocked on `*.pages.dev` / `*.workers.dev`. | Fixed |
| High | `src/lib/portal/login-rate.ts` | Portal login rate limit trusted `X-Forwarded-For`, allowing bucket bypass off Cloudflare. | Use `CF-Connecting-IP` via `clientIpFromRequest()` only. | Fixed |
| Medium | `src/lib/ssrf.ts` | Source checker did not resolve DNS before fetch (rebinding risk); metadata / IPv4-mapped private hosts incomplete. | `assertResolvablePublicHost()` via Cloudflare DNS JSON; expanded blocked host list; re-check on redirects. Dev fixtures only with `SOURCE_CHECKER_DEV_FIXTURE=1` on localhost. | Fixed |
| Medium | `functions/api/kofi.ts` | Webhook token compared with `!==` (timing leak); no rate limit. | `timingSafeEqualString()`; `checkKofiWebhookRate()` per IP + global. Replay still blocked by `kofi_transaction_id` PK. | Fixed |
| Medium | `functions/api/support/redeem.ts` | No rate limit on code guessing; unbounded JSON body. | `checkRedeemRate()`; `readJsonBody` 512-byte cap. | Fixed |
| Medium | `src/lib/stats/handler.ts` | `/api/stat` had only a loose global bucket (spoofable if extended). | Per-IP hashed bucket + global cap using `CF-Connecting-IP`. | Fixed |
| Medium | `public/_headers` | Missing HSTS, Permissions-Policy, Cloudflare beacon in CSP. | Aligned CSP with `src/lib/security.ts`; added HSTS, Permissions-Policy, `frame-ancestors 'none'`. | Fixed |
| Medium | `src/lib/portal/handler.ts` | Portal logout accepted GET without CSRF; register had no rate limit. | Logout requires `POST` + `requirePortalPost`; register options uses login rate limit. | Fixed |
| Low | `functions/api/kofi.ts` | `code_plain` stored in D1 for admin handoff (not donor PII). | Documented; owner may rotate codes; hashes used for redeem. | Accepted |
| Low | CSP `script-src 'unsafe-inline'` | Required by Next static export theme/hydration inline scripts. | No change; MapLibre `worker-src blob:` retained. | Accepted |
| Low | `@simplewebauthn/server` | npm audit: low severity advisory. | No high/critical production issues; monitor upstream. | Open |
| Info | Secrets in git | `secrets-bundle.test.ts` + grep: no Mapbox token or live secrets in tree; Turnstile test keys only in dev paths. | — | OK |
| Info | SQL | D1 access uses bound parameters only in `src/lib/db/*`. | — | OK |
| Info | XSS | User/resort text in React trees escaped by default; map markers use `escapeHtml`. | — | OK |

## Owner follow-ups (not in this PR)

- Set production `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`, `ADMIN_EMAILS`, Turnstile production keys, `KOFI_VERIFICATION_TOKEN`, and `MAP_LOAD_HASH_SALT` in Cloudflare (never in git).
- Restrict `NEXT_PUBLIC_MAPBOX_TOKEN` to production URLs at build time.
- Legal: set `config/legal.json` `"draft": false` after review.
- Consider removing `code_plain` from D1 if admin UI can show codes only from webhook response logs.

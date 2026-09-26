# Skimap.eu

Static map of season passes for ski areas. The working name is **Skimap.eu**. It is not final: change it in [`config/site.json`](config/site.json) and the header, document title, and web app manifest follow that value.

The first launch covers Austria for 2026/27, plus a few neighbouring areas already in the file. Later work can add countries without renaming the data files.

The site is a Next.js static export. It is currently published on GitHub Pages at [https://balazsgyulai.github.io/ski-pass-map](https://balazsgyulai.github.io/ski-pass-map). The same export can be served from the site root on Cloudflare Pages.

## One-time GitHub setting

The workflow cannot turn Pages on by itself. In the repository:

**Settings → Pages → Build and deployment → Source: GitHub Actions**

After that, a push to `main` runs `.github/workflows/pages.yml`, which lints, tests, validates the data, builds, and deploys the `out` folder.

## Cloudflare Pages

Do not create a Cloudflare project from this repository's scripts. When you connect the repo in the Cloudflare dashboard, use:

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npm run build` |
| Output directory | `out` |
| Environment variable | `NEXT_PUBLIC_BASE_PATH` |

`NEXT_PUBLIC_BASE_PATH` sets the path prefix:

- Leave it **unset** for the current GitHub Pages site. The build then uses `basePath` from `config/site.json` (`/ski-pass-map`).
- Set it to an **empty string** to serve the site at the domain root on Cloudflare Pages.
- Set it to a path such as `/ski-pass-map` only if the site should stay under a prefix.

The map draws with MapLibre and [OpenFreeMap](https://openfreemap.org) unless a public Mapbox token, storage consent, and the monthly load budget all allow Mapbox. OpenFreeMap needs no key. See [Mapbox load budget](#mapbox-load-budget) before turning Mapbox on. Do not commit a token.

`npm run build` validates the data, runs `next build`, then stamps `out/sw.js` and `out/manifest.webmanifest` with the resolved base path and the site name. `public/sw.js` keeps the GitHub Pages prefix so local `next dev` matches that deployment. The build also copies the MapLibre worker into `public/vendor` (gitignored) so the static export can start it from this origin.

## Mapbox load budget

Mapbox is used only when all three are true at map start: `NEXT_PUBLIC_MAPBOX_TOKEN` was set for that build, the visitor has consented to map storage, and `POST /api/map-load` returns `{ "provider": "mapbox" }`. Anything else, including a missing function, a network error, or a short timeout, uses OpenFreeMap for that page load. The choice is not changed mid-session.

The counter is a Cloudflare Pages Function in [`functions/api/map-load.ts`](functions/api/map-load.ts). It is not part of the static `out/` export, so GitHub Pages and `npx serve` stay on OpenFreeMap. The browser posts to it only in a production build. `next dev` does not, so React strict mode cannot count the same map twice. Do not create the Cloudflare database from this repository, and do not put a token in git or in the GitHub Pages build.

The function stores one row per UTC month (`YYYY-MM`) in D1 and increments it only while the count is under the budget. The default budget is 45,000 of Mapbox's 50,000 free monthly web map loads. One increment is one Mapbox `Map` construction, which is the billing unit, not a tile. At the budget it returns `{ "provider": "openfreemap" }` and stops incrementing. A new month starts at zero.

Abuse limits, applied before the increment: only `POST`, the `Origin` must be this site (or `MAP_LOAD_ALLOWED_ORIGINS`), and each visitor gets 8 requests per 10 minutes. The address is hashed with `MAP_LOAD_HASH_SALT` into a bucket that expires with the window. The raw address is not stored and not returned. Requests over the limit get `429` and do not move the monthly count, so they cannot force the whole site onto OpenFreeMap.

Consent lives in `localStorage` under `skimap-map-consent` and defaults to off. Part 8's banner should call `setMapConsent` from [`src/lib/map-consent.ts`](src/lib/map-consent.ts). Until that ships, visitors get OpenFreeMap. For local `next dev` only, `?mapConsent=1` or `NEXT_PUBLIC_MAP_CONSENT=1` simulates consent. Production builds ignore both.

### Owner setup

1. In the Cloudflare dashboard, create a D1 database named `skimap-map-loads`. Copy its id into [`wrangler.toml`](wrangler.toml), replacing `database_id`. The committed id is a placeholder.
2. On the Pages project, bind that database as `MAP_LOADS`. The function creates the tables on first use. You can also apply [`functions/schema.sql`](functions/schema.sql) yourself with `npx wrangler d1 execute skimap-map-loads --file=functions/schema.sql` when you are ready. Do not run that from CI.
3. Set `MAP_LOAD_HASH_SALT` in the Pages environment to a long random string. It is not a personal identifier and it does not belong in git.
4. Optionally set `MAPBOX_MONTHLY_LIMIT` (default `45000`) and `MAP_LOAD_ALLOWED_ORIGINS` (comma-separated extra origins; the site's own origin is always allowed).
5. Create a Mapbox **public** token. Before launch, restrict it by URL to the production site. Set `NEXT_PUBLIC_MAPBOX_TOKEN` on the Cloudflare Pages build only. Leave it unset for GitHub Pages. `.env.example` stays empty.
6. Build command and output directory stay `npm ci && npm run build` and `out`.

Styles: OpenFreeMap [Positron](https://tiles.openfreemap.org/styles/positron) (light, with Natural Earth shaded relief at low zoom) and Mapbox `light-v11`. Dark mode uses OpenFreeMap Dark and Mapbox `dark-v11`. Attribution for OpenStreetMap (ODbL), OpenSkiMap, OpenFreeMap, OpenMapTiles, and Mapbox stays on the map. The OpenSnowMap piste overlay is unchanged.

## Import Austria

`npm run import:austria` reads the research drop and writes `data/passes.json`, `data/resorts.json`, and `data/osm.json`. Run it again when a newer drop arrives in the same shape.

| Input | Role |
| --- | --- |
| `imports/austria/passes.json` | Multi-resort season passes, with provenance on every non-OSM value |
| `imports/austria/resorts.json` | OpenSkiData areas for Austria, plus official-site facts where researched |
| `imports/austria/legacy-resorts.json` | Part 1 resort file. Official values are copied only when the new drop has no value and the old one has `sourceUrl` and `checkedAt` |
| `config/publish.json` | `includeRestrictedPasses` defaults to `false` |

The script validates the result with the catalog schema and exits if a value is missing its source, a price is not a number, birth-year brackets overlap in a way that would require a guess, or any URL contains an aggregator domain (skiresort.info, bergfex, snow-forecast, skiinfo, OnTheSnow, Snow-Online).

Visibility rules, applied in this order:

- **Unnamed** areas stay in the file and off the map.
- **Horsefeathers Superpark Planai** is a park inside Planai, not its own resort. The Planai sheet says so.
- **Schizentrum Rettenbach** is a grass-ski centre and stays off the winter map.
- **Lift-less duplicates** (a second OpenSkiData row with the same name and no lifts, including Skimap.org-only copies) are hidden. Pass coverage is moved onto the row that has lifts.
- **Mostly outside Austria:** a cross-border area with no `.at` or `.tirol` website is hidden when OpenSkiData flags it as having no Austrian locality, or when it has no Austrian locality at all. Balderschwang and Fellhorn/Kanzelwand are hidden as well: the README for the drop lists them as mainly in Germany, and the locality counts do not catch them. Areas with an Austrian site stay, including Ischgl, Nassfeld, Kaunertal, and Tannheim.
- **Permanently closed** Unterberg (official notice) stays searchable and is hidden like an abandoned area until “Show areas marked abandoned in OpenStreetMap” is on.
- **Empty shells** with no lifts and no downhill piste, and that do not contain sub-areas, stay off the map.
- **Tiny point-only** areas (one lift or none, under 1 km, no pass, no official site) stay off the map. Named point areas with a pass, a site, or more skiing stay on it.

Umbrella areas that contain sub-areas stay on the map. Their piste kilometres and lift counts are kept for the sheet and marked as including sub-areas. Filters and the about-page total use only the nested areas, so the same lifts are not counted twice.

Other published flags:

- **networkPrice** — a day ticket whose note describes a joint or network ticket. The sheet shows the price and the note.
- **needsRecheck** — a preliminary, ambiguous, or unlabelled season. The sheet shows a badge.
- **viaTourismSite** — the source note mentions a tourism site.
- **restricted** — Steiermark Joker and WildPass, whose imprints restrict storing the content. They are left out of `data/passes.json` while `includeRestrictedPasses` is false. Set it to true and run the import again to publish them.
- **provisional** — Ski Arlberg, whose operator marks the tariff as provisional. The compare view, planner, and resort sheet show a badge.
- **dynamic pricing** — no fixed adult day price, and the official page says the price is dynamic. The sheet and list say “dynamic pricing, see official site” instead of leaving the row blank. A published cash price is still shown when the page also mentions a dynamic online price.

Age brackets are matched on birth year and purchase date. A proof-only tariff (student card, disability card, family package, AHA-Card) is not applied just because the year falls inside it. A year with no published bracket stays unavailable.

## Update the data

Resort facts, pass prices, and OpenStreetMap geometry are separate files:

- [`data/resorts.json`](data/resorts.json) — names, regions, verification, official websites, season dates, public-transport notes, and any day-ticket price that comes from the resort's own site. Each factual value can carry `sourceUrl`, `checkedAt`, and an optional short `snippet`.
- [`data/passes.json`](data/passes.json) — pass names, age brackets, prices, and the official page those prices were taken from.
- [`data/osm.json`](data/osm.json) — coordinates and any statistics derived from OpenStreetMap or OpenSkiMap. This file is ODbL. See [`DATA_LICENSE.md`](DATA_LICENSE.md).

A resort with `"verification": "unverified"` stays in the file and off the map. The app does not hard-code the resort list.

```bash
npm install
npm run validate   # schema, site name, base path, and a ban on portal URLs
npm test           # pricing, filters, and the data-rights check
npm run lint
npm run dev        # http://localhost:3000/ski-pass-map
npm run build      # static site in out/
```

Missing numbers are `null`. The UI omits them. It does not invent a price, elevation, or day ticket, and it does not print a blank or `NaN`. `snowpark` and `nightSkiing` are `true` or `null`, never `false`. Pass coverage is a list of pass ids, each with the official page it was checked against. Each pass has `pricing.brackets` (birth-year bounds, both null when the pass uses age at purchase or publishes no Jahrgang) and `pricing.periods` (`price_eur` valid through `valid_until`, each with a source). A later season is a data edit, not a code change.

Areas OpenStreetMap marks as abandoned stay off the map until “Show areas marked abandoned in OpenStreetMap” is on. A name search still finds them.

`npm run validate` also checks that `public/sw.js` and `public/manifest.webmanifest` still contain `config/site.json`'s `basePath`, and that the manifest contains the site name. It fails if any JSON or GeoJSON file under `data/` or `public/` contains a skiresort.info, bergfex, snow-forecast, OnTheSnow, Skiinfo, or Snow-Online URL.

Piste lines are OpenStreetMap ways, fetched once with `npm run fetch-pistes` (Overpass at `lz4.overpass-api.de`, then a second public instance, with a user-agent, a delay between requests, and raw responses cached in `data/pistes/raw/`). `--missing` queries only resorts that do not yet have a file and reuses that cache. That script is not part of `npm run build` or CI. It writes `public/pistes/<resort-id>.geojson`, which the map loads when a resort is opened, and lists resorts with no lines in `public/pistes/none.json`. An optional overlay uses the OpenSnowMap pistes-only tiles (`https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png`). Their terms allow that layer on a website if the browser sends a referer, the app does not bulk-download tiles, and the map credits OpenStreetMap (ODbL) and OpenSnowMap (CC BY-SA).

## What the pages do

- **Map / list:** clustered markers, pass-coloured pie markers, grey if no pass covers the resort, dashed if OpenStreetMap marks the area abandoned, filters, search, and straight-line distance from Vienna, Innsbruck, or this device. The device location stays in `localStorage` and is never written into the address bar or a copied link.
- **Planner:** birth year, purchase date, days per resort, two-pass combinations, and a day-ticket comparison when every used resort has a day-ticket price.
- **Compare:** tariffs for the saved birth year and date, plus a deadline countdown.
- **About:** sources, the disclaimer, credits, and how the data files are updated.

Favourites and the trip plan stay in `localStorage` on the device. Filters and the open resort are in the URL. English and Hungarian UI; resort names stay German. Light and dark follow the system until you change Appearance.

## Cloudflare setup for part 6

Backend features use Pages Functions in [`functions/`](functions/), a second D1 database, Turnstile, Cloudflare Access, and Workers AI. The static export in `out/` does not read D1 at runtime yet.

1. **D1 `skimap-app` (Western Europe):** In the dashboard, create D1 database `skimap-app` in Western Europe. Copy its id into [`wrangler.toml`](wrangler.toml) for the `DB` binding (replace the `REPLACE_ME` placeholder). Run `npx wrangler d1 migrations apply skimap-app --remote` for production, or `npm run db:migrate:local` before `wrangler pages dev`.
2. **Pages bindings:** On project `skimap`, bind `DB` → `skimap-app`, keep existing `MAP_LOADS`, and add Workers AI binding `AI` (free tier).
3. **Secrets / vars:** Set `MAP_LOAD_HASH_SALT` (reused for contact IP hashing), `TURNSTILE_SECRET_KEY`, `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`, and comma-separated `ADMIN_EMAILS`. Optional: `CONTACT_HOURLY_MAX`, `CONTACT_GLOBAL_DAILY_MAX`. See [`.env.example`](.env.example) and [`.dev.vars.example`](.dev.vars.example). Set build var `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for the contact widget.
4. **Turnstile:** Create a widget for the production site domain. Use the site key in the build; store the secret in Pages (not git).
5. **Cloudflare Access:** Protect `/admin*` and `/api/admin/*` with a self-hosted Access application (free plan). Use the application audience tag as `ACCESS_AUD` and your team domain as `ACCESS_TEAM_DOMAIN`.
6. **Local admin:** Only for development: `ADMIN_DEV_BYPASS=1` with `NODE_ENV` not `production`, plus `ADMIN_EMAILS`. Never enable bypass in production.

Contact form: `POST /api/contact`. Admin UI: static [`/admin/`](src/app/admin/page.tsx) (English, `noindex`). Approved edits export as JSON patches; apply with `npm run apply:edits <patch.json>` (re-runs `npm run validate`).

## Resort portal (part 7)

The resort self-service portal ships **disabled by default**. Configuration lives in [`config/portal.json`](config/portal.json) (`{ "enabled": false }`). You can override with the Pages environment variable `PORTAL_ENABLED=1` when you are ready.

**Before enabling**, complete the legal checklist in the portal outreach memo (section 0.3): Resort Terms (DE/EN) and owner-content licence, DSA contact points and notice form, ranking-parameters page, checker tiers with limits/attribution/rollback/audit, updated privacy notice, outreach list rules, and reply templates.

**Database:** apply the portal migration on `skimap-app`:

```bash
npm run db:migrate:local          # local D1 for wrangler pages dev
npx wrangler d1 migrations apply skimap-app --remote   # production (owner only)
```

**Owner workflow (when enabled):**

1. Create a one-time invite from the admin **Portal** tab (7-day expiry, hashed token). Copy the invite URL and send it yourself (no email service yet). Admin warns if the invite email domain does not match the resort’s official website domain.
2. The resort accepts the draft Resort Terms on `/portal/invite/`, then registers a **passkey** (WebAuthn). Optional TOTP can be added later.
3. Tier **A** edits auto-publish when the source checker passes and limits are met; they appear via `GET /api/overrides` (cached) and in the daily post-moderation queue (one-click rollback with a statement of reasons). Tier **B/C** and promos go to review queues.
4. Set per-resort **listing** modes (`full`, `link_only`, `unlisted`) from admin; changes are audited.

**Public pages:** [`/[lang]/for-resorts/`](src/app/[lang]/for-resorts/page.tsx) (EN/DE; other languages fall back to EN content via routing), draft [`/[lang]/resort-terms/`](src/app/[lang]/resort-terms/page.tsx), and `/portal/` (login/dashboard; `noindex` while disabled).

**Local dev:** `PORTAL_ENABLED=1`, `PORTAL_DEV_BYPASS=1`, and `PORTAL_DEV_EMAIL=portal-dev@skimap.test` in `.dev.vars` (never in production). Use `POST /api/portal/dev-login` for e2e without WebAuthn.

**Tests:** `npm test` (tier limits, invites, sessions, promos, listing), `npm run test:part7-e2e` (Playwright against `wrangler pages dev`).

## Part 8 — legal, consent, support, affiliates, stats, backups

**Legal pages** (HU + EN full text; other languages show English with a short localized note): imprint (DSA contact points + notice form link), privacy notice (processors, retention table, portal accounts), terms, [how resorts are ordered](src/app/[lang]/resort-ranking/page.tsx), and data sources on `/credits`. Pages show **DRAFT – pending owner review** while `config/legal.json` has `"draft": true`.

**Consent:** bottom banner (Accept / Reject equal prominence, Settings). Optional category: Mapbox map storage. Calls `setMapConsent` from [`src/lib/map-consent.ts`](src/lib/map-consent.ts). Cookie settings in the footer and menu.

**Support prompt:** Ko-fi URL from [`config/support.json`](config/support.json) (`kofiUrl` empty hides the button). Rewarded-ad path behind `rewardedAdsEnabled: false`. Ko-fi webhook `POST /api/kofi` with `KOFI_VERIFICATION_TOKEN`; D1 migration [`migrations/0003_support.sql`](migrations/0003_support.sql). Admin **Stats & support** tab shows generated perk codes for manual email.

**Affiliates:** [`config/affiliates.json`](config/affiliates.json) (empty by default). Partner block on resort **Links** tab and planner when entries exist.

**Stats:** optional Cloudflare Web Analytics when `NEXT_PUBLIC_CF_BEACON_TOKEN` is set; first-party `/api/stat` when `STATS_ENABLED=1` and `NEXT_PUBLIC_STATS_ENABLED=1` on the build.

**Backups:** [`.github/workflows/backup.yml`](.github/workflows/backup.yml) (weekly + manual, runs only when repo variable `BACKUP_ENABLED=true`). Needs secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BACKUP_REPO_TOKEN`, and variable `BACKUP_REPO`. Local: `npm run backup:local`.

### Owner actions (part 8)

1. Fill imprint placeholders in [`src/lib/legal/imprint.tsx`](src/lib/legal/imprint.tsx): `[SEAT]`, `[REG NO]`, `[TAX NO]`, `[EMAIL]`.
2. Set `kofiUrl` in `config/support.json`; on Pages set `KOFI_VERIFICATION_TOKEN` and `SUPPORT_CODE_SALT`.
3. Optional: `NEXT_PUBLIC_CF_BEACON_TOKEN` (build) and `STATS_ENABLED=1` + `NEXT_PUBLIC_STATS_ENABLED=1`.
4. Legal review: set `"draft": false` in `config/legal.json` when satisfied.
5. Backups: private repo, `BACKUP_ENABLED=true`, GitHub secrets/vars as above.
6. Apply `npm run db:migrate:local` / remote `0003_support.sql` before using Ko-fi or stats.

**Tests:** `npm test`, `npm run test:part8-e2e` (Playwright screenshots under `/opt/cursor/artifacts/screenshots/part8/`).

## Licences

Application code is “all rights reserved” until the owner chooses a licence. See [`LICENSE`](LICENSE). OpenStreetMap-derived files are ODbL 1.0. See [`DATA_LICENSE.md`](DATA_LICENSE.md).

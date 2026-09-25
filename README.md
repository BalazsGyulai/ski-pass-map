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

No API keys or secrets are required. The map uses keyless OpenStreetMap tiles. Mapbox is not part of this build.

`npm run build` validates the data, runs `next build`, then stamps `out/sw.js` and `out/manifest.webmanifest` with the resolved base path and the site name. `public/sw.js` keeps the GitHub Pages prefix so local `next dev` matches that deployment.

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

`npm run validate` also checks that `public/sw.js` and `public/manifest.webmanifest` still contain `config/site.json`'s `basePath`, and that the manifest contains the site name. It fails if any JSON or GeoJSON file under `data/` or `public/` contains a skiresort.info, bergfex, OnTheSnow, Skiinfo, or Snow-Online URL.

Piste lines are OpenStreetMap ways, fetched once with `npm run fetch-pistes` (Overpass at `lz4.overpass-api.de`, with a delay between requests, raw responses cached in `data/pistes/raw/`). That script is not part of `npm run build` or CI. It writes `public/pistes/<resort-id>.geojson`, which the map loads when a resort is opened. An optional overlay uses the OpenSnowMap pistes-only tiles (`https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png`). Their terms allow that layer on a website if the browser sends a referer, the app does not bulk-download tiles, and the map credits OpenStreetMap (ODbL) and OpenSnowMap (CC BY-SA).

## What the pages do

- **Map / list:** clustered markers, pass-coloured pie markers, grey if no pass covers the resort, dashed if OpenStreetMap marks the area abandoned, filters, search, and straight-line distance from Vienna, Innsbruck, or this device. The device location stays in `localStorage` and is never written into the address bar or a copied link.
- **Planner:** birth year, purchase date, days per resort, two-pass combinations, and a day-ticket comparison when every used resort has a day-ticket price.
- **Compare:** tariffs for the saved birth year and date, plus a deadline countdown.
- **About:** sources, the disclaimer, credits, and how the data files are updated.

Favourites and the trip plan stay in `localStorage` on the device. Filters and the open resort are in the URL. English and Hungarian UI; resort names stay German. Light and dark follow the system until you change Appearance.

## Licences

Application code is “all rights reserved” until the owner chooses a licence. See [`LICENSE`](LICENSE). OpenStreetMap-derived files are ODbL 1.0. See [`DATA_LICENSE.md`](DATA_LICENSE.md).

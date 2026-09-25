# Ski pass map

Static map of eastern Austrian ski resorts and the 2026/27 season passes that cover them. Built for someone based near Sopron, studying in Wiener Neustadt, riding around Graz, and planning one week in Tirol.

The site is a Next.js static export for GitHub Pages: [https://balazsgyulai.github.io/ski-pass-map](https://balazsgyulai.github.io/ski-pass-map).

## One-time GitHub setting

The workflow cannot turn Pages on by itself. In the repository:

**Settings → Pages → Build and deployment → Source: GitHub Actions**

After that, a push to `main` runs `.github/workflows/pages.yml`, which lints, tests, validates the data, builds, and deploys the `out` folder.

## Update the resorts

All resort, city, and pass data lives in [`data/resorts.json`](data/resorts.json). Replacing that file is enough — the app does not hard-code the resort list.

```bash
npm install
npm run validate   # fails if the JSON does not match the schema
npm test           # pricing rules
npm run dev        # http://localhost:3000/ski-pass-map
npm run build      # static site in out/
```

Missing numbers must be `null`. The UI shows those as unknown and does not invent a price, elevation, or day ticket. `snowpark` and `night_skiing` are `true` or `null`, never `false`. Pass coverage is a list of pass ids. Each pass has `pricing.brackets` (birth-year bounds, both null when the pass uses age at purchase or publishes no Jahrgang) and `pricing.periods` (`price_eur` valid through `valid_until`). A later season is a data edit, not a code change.

Closed or uncertain resorts (`status: "closed?"`) stay off the map until “Show closed or uncertain” is on. Day tickets other than the checked 2025/26 prices for Semmering, Stuhleck, and Präbichl are estimates.

`config/site.json` holds `basePath` (`/ski-pass-map`). The same path is in `public/sw.js` and `public/manifest.webmanifest`. `npm run validate` checks that they still match.

Piste lines are OpenStreetMap ways, fetched once with `npm run fetch-pistes` (Overpass at `lz4.overpass-api.de`, with a delay between requests, raw responses cached in `data/pistes/raw/`). That script is not part of `npm run build` or CI. It writes `public/pistes/<resort-id>.geojson`, which the map loads when a resort is opened. An optional overlay uses the OpenSnowMap pistes-only tiles (`https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png`). Their terms allow that layer on a website if the browser sends a referer, the app does not bulk-download tiles, and the map credits OpenStreetMap (ODbL) and OpenSnowMap (CC BY-SA). Official piste-map images are not copied; `piste_map_url` is only a link, shown when the data has one.

## What the pages do

- **Map / list:** clustered markers, pass-coloured pie markers, grey if no pass covers the resort, dashed if closed, filters, search, straight-line distance from Sopron, Wiener Neustadt, Graz, Vienna, Innsbruck, or your location.
- **Planner:** birth year, purchase date, days per resort, two-pass combinations, day-ticket comparison, and break-even where a day-ticket price exists.
- **Compare:** tariffs for the saved birth year and date, plus a deadline countdown.
- **About:** sources, the disclaimer, and how this file is updated.

Favourites and the trip plan stay in `localStorage` on the device. Filters and the open resort are in the URL. English and Hungarian UI; resort names stay German. Light and dark follow the system until you change Appearance.

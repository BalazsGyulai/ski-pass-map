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

Missing numbers must be `null`. The UI shows those as unknown and does not invent a price, elevation, or day ticket. Pass coverage is a list of pass ids. Age brackets and price periods live on each pass under `pricing`, so a later season is a data edit, not a code change.

Age cutoffs in the seed file are assumptions for 2026/27 (U25 = birth years 2002–2010, U28 = 1999–2010, child = 2011 or later). Change `min_birth_year` / `max_birth_year` if a pass uses a different Jahrgang. Prices that were not in the source notes are `null`.

`config/site.json` holds `basePath` (`/ski-pass-map`). The same path is in `public/sw.js` and `public/manifest.webmanifest`. `npm run validate` checks that they still match.

## What the pages do

- **Map / list:** clustered markers, pass-coloured pie markers, grey if no pass covers the resort, filters, search, straight-line distance from Sopron, Wiener Neustadt, Graz, Vienna, or your location.
- **Planner:** birth year, purchase date, days per resort, two-pass combinations, day-ticket comparison, and break-even where a day-ticket price exists.
- **Compare:** tariffs for the saved birth year and date, plus a deadline countdown.
- **About:** sources, the disclaimer, and how this file is updated.

Favourites and the trip plan stay in `localStorage` on the device. Filters and the open resort are in the URL. English and Hungarian UI; resort names stay German. Light and dark follow the system until you change Appearance.

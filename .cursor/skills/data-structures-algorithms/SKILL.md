---
name: data-structures-algorithms
description: Chooses data structures and algorithms for Skimap.eu by the real size of its data (396 resorts, 19 passes, 291 per-resort piste files). Use when a change searches, filters, sorts, groups, caches, indexes, deduplicates, measures distance, or reshapes resort, pass, price, or piste data, or when someone proposes an index, cache, memo, tree, or new data library.
---

# Data structures and algorithms

The decision rule: **pick the simplest structure that is correct for the data this site actually has, and measure before you make it faster.** Senior judgement here is mostly saying no to an index nobody needs, and yes to correctness details (ties, nulls, accents, locale) that juniors miss.

## Know the sizes

| Data | Size | Where | Loaded |
| --- | --- | --- | --- |
| Resorts | 396 records, 420 KB JSON | `data/resorts.json` | In the bundle, at start |
| Passes | 19 records | `data/passes.json` | In the bundle |
| OSM places | 396 | `data/osm.json` | In the bundle |
| Piste and lift lines | 291 simplified files, 5.5 MB total (raw OSM input: 30 MB in `data/pistes/raw`) | `public/pistes/<resort>.geojson` | One file, when a resort opens |

Re-check with `node -e 'console.log(require("./data/resorts.json").resorts.length)'` when it matters; the number grows when new countries arrive.

Measured on this machine (Node 25, all 396 resorts): `filterResorts` with a text query 0.16 ms, `sortResorts` by name 0.05 ms, by elevation 0.07 ms. A frame is 16 ms. **Any scan over resorts is free**; the cost is in rendering, not in the array work. See the performance skill.

## Defaults

- **Filter and sort with plain arrays.** `src/lib/filter.ts` scans every resort on every change, and that is correct. Do not add an index, a trie, a search library, or a worker for resort search.
- **Membership tests.** A `Set` or `Map` built once is right for lookups inside a loop over resorts (`favourites`, `passNames`). Build it with `useMemo` or at module level, never inside the loop. For the handful of selected pass ids, `Array.includes` is fine: V8 is faster on tiny arrays, and a `Set` only wins in the thousands.
- **Copy before sorting.** `sort()` mutates. Use `[...list].sort()` (current style) or `toSorted()` (Baseline since 2023). Never sort an array that React state or imported JSON owns.
- **Sort is stable** (guaranteed since ES2019). Still break ties explicitly, as `sortResorts` does with the name, so equal prices come out the same on every browser and in tests.
- **A comparator must be consistent**: `cmp(a, a) === 0`, `cmp(a, b)` and `cmp(b, a)` have opposite signs, and it is transitive. Returning `a > b ? 1 : 0` is broken and sorts differently per engine.
- **Nulls go last in both directions.** A missing elevation is not zero. `compareSort` handles this; keep it that way in any new sort key.
- **Deduplicate by id with a `Map`**, keeping the first or the newest on purpose, and say which in a comment.

## Text

- **Search folds accents and case**: `fold()` in `filter.ts` (NFD, strip marks, lowercase) so "obergurgl" finds "Obergurgl" and "hochfugen" finds "Hochfügen". Use `fold` for any new search; do not write a second folding function.
- **Display sort uses the locale**: `localeCompare(..., "de")` today, because resort names are German. For language-dependent sorting of UI text (pass names, countries), sort in the visitor's language.
- **Do not replace `localeCompare` with a shared `Intl.Collator` "for speed".** MDN recommends a collator for large arrays, but on 396 names in current V8 `localeCompare` measured 0.05 ms against 0.17 ms for a shared collator. Measure first.
- Never compare user-facing strings with `<` or `>`: "Ötztal" would sort after "Zell".

## Geography

- **Distance**: `distanceKm` in `src/lib/distance.ts` is haversine, about 0.5% error. That is right for "within N km" and "sort by distance". Do not replace it with Vincenty or a library. Never use `Math.hypot` on degrees: a degree of longitude in Austria is about 76 km, not 111 km.
- **Bounding boxes**: `inBounds` and `boundsMoved` in `src/lib/bounds.ts`. The visible area also depends on camera padding (`map-camera.ts`).
- **Spatial index** (kdbush, rbush, geohash): only for thousands of points queried many times per second. At 396 resorts a scan wins. MapLibre and Mapbox already index their GeoJSON sources internally for rendering and hit tests; use `queryRenderedFeatures` instead of building your own.
- **Line simplification**: `simplifyLine` (Douglas–Peucker) runs at build time in `scripts/fetch-pistes.ts`. Simplify at build, never in the browser.

## Money and dates

- Prices are euros from the data. Never round in the middle of a calculation; round once, for display, through `src/lib/format.ts`.
- Pricing by age and date lives in `src/lib/pricing.ts`. Most passes price by birth-year bracket (`yearInBracket`); some price by age on the purchase date, and `resolveForViewer` handles both. Call those helpers. Never compute age as `currentYear - birthYear`.
- Today's date comes from `todayISO()` in `format.ts`. Compare ISO dates (`YYYY-MM-DD`) as strings only when both are exactly that format. Otherwise parse, and mind time zones: `new Date("2026-12-01")` is UTC midnight, which is still 30 November in the Americas.

## When a structure really is needed

Write it down in the plan with numbers: the input size today, the size in a year, the measured time, and the frame budget it breaks. Then:

1. Put the structure in `src/lib/` as a pure function with a test beside it.
2. Test the edges: empty input, one item, all items equal, nulls in the sort key, accents in text.
3. Benchmark before and after on the real `data/*.json`. A throwaway script run with `node --import tsx` works (plain `npx tsx` fails in the Cursor sandbox). Delete it afterwards.
4. No new dependency for something 30 lines of tested code can do.

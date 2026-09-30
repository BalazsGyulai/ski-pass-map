---
name: web-performance
description: Performance rules for Skimap.eu: Core Web Vitals (LCP, INP, CLS) on a static Next.js export, MapLibre and Mapbox GL rendering, React re-renders, bundle size, and work that runs on every map move or location fix. Use when a change touches the map, GeoJSON sources or layers, markers, first load, imports or dependencies, list rendering, animations, event handlers on move/zoom/render, geolocation, or the service worker, or when something feels slow or janky.
---

# Web performance

The rule: **name what gets slower, measure it, and keep the page inside the budgets below.** Most "optimisations" here are unnecessary (the data is small; see the data-structures skill). The real costs are the map, the bundle, and work that runs on every frame.

## Budgets

Core Web Vitals, "good" at the 75th percentile of real visits (web.dev), on a mid-range phone:

| Metric | Good | What moves it on this site |
| --- | --- | --- |
| LCP | ≤ 2.5 s | Size of the first JS the page needs, fonts, the first map style and tiles |
| INP | ≤ 200 ms | Any click or key handler that filters, re-renders the list, and calls `setData` in one task |
| CLS | ≤ 0.1 | Sheets, banners, and the consent card appearing without reserved space; late web fonts |

A long task is anything over 50 ms on the main thread. A frame is 16 ms; a map drag handler gets a fraction of it.

## Map (both libraries)

What the site already does right; keep it that way:

- **One clustered GeoJSON source for all resorts** (`RESORT_SOURCE`), updated with `setData` only when the filtered list changes (`MapView.tsx`).
- **A separate small focus source** for the selected and hovered resort, so hover and selection never re-send 396 features.
- **Style layers, not HTML markers.** The only DOM marker is "My location". The libraries' docs say style layers are the efficient way to show many features; a DOM marker per resort costs layout on every frame.
- **Piste lines load per resort**, as pre-simplified files from `public/pistes/`.
- **The map component is lazy** (`dynamic(() => import("../MapView"))` in `SkiMap.tsx`), and so is the chosen library (`import("maplibre-gl")` / `import("mapbox-gl")` in `vector-map.ts`).
- **No `move` or `render` handlers**: React hears about the camera on `moveend` only.

Rules for new work:

- **Restyle with data-driven expressions or `setFeatureState`**, not by rebuilding the collection. Feature state needs a feature id (`promoteId` or `id`), and is lost when the source is replaced.
- **`setData` re-parses and re-tiles the whole source in a worker.** Call it when the set of features changes, never on hover, never inside `move` or `render` handlers. MapLibre's `updateData(diff)` is faster for big sources with stable ids; Mapbox's API differs, so check the map-libraries skill before using it.
- **No work in `move`, `zoom`, or `render` handlers** beyond reading state. Anything that updates React (list "in this area", URL) goes on `moveend`, as the existing handlers do, or through `requestAnimationFrame` at most once per frame. The "search as I move" setting exists because re-filtering on every move is expensive for the list, not for the array.
- **New layers cost.** Each layer is a draw pass. Reuse a layer with a filter or expression before adding one; delete layers you no longer show. Symbol (text) layers are the most expensive: they need glyphs and collision detection.
- **Terrain and 3D** (`terrain.ts`) are the heaviest thing on the map: DEM tiles plus extra draw work. Keep them optional and off where they do not help (the setting already exists).
- **`map.resize()`** after the container size changes, once per frame at most (existing code wraps it in `requestAnimationFrame`).

## React

- Derived lists are memoised in `useResorts.ts` (`filtered`, `sorted`, `inArea`). Add a new derived value there with `useMemo` and a correct dependency list; do not recompute in each component.
- A `useMemo` whose dependencies change every render does nothing. Objects and functions passed as dependencies must themselves be stable (`useMemo` / `useCallback`, or module level).
- **Typing in search**: keep the input responsive by updating the field immediately and the list with `useDeferredValue` or `startTransition` if profiling shows a long task. Do not debounce with timers first; React's scheduling is the house tool.
- **Long lists**: the resort list is a few hundred rows. Prefer `content-visibility: auto` on rows before reaching for a virtualisation library.
- **Context**: `AppState` is one big context. A value that changes often (map centre during a drag, location every fix) must not go into it, or every consumer re-renders. Keep it in a ref or a small dedicated state.

## Bundle and first load

- `maplibre-gl` and `mapbox-gl` are each hundreds of KB. They must stay behind the dynamic import; never import either from a component that renders on every page.
- `data/resorts.json` (420 KB raw) ships in the bundle. Do not add fields to the generated data that the browser does not use; add them to the importer's output only when a screen needs them.
- A new dependency needs its size (minified + gzip) in the plan. Check it on bundlephobia or by building. Prefer the platform (`Intl`, `URL`, CSS) over a package.
- Measure with `npm run build`; Next prints the first-load JS per route. Compare before and after. Stop `npm run dev` first: `next build` empties `.next`, which a running dev server still uses.
- Fonts: Inter comes from `next/font` (self-hosted, no layout shift). Do not add a second font family.

## Motion and CSS

- Animate `transform` and `opacity` only (the sheet moves with a transform; see `DESIGN.md`). Animating `height`, `top`, or `box-shadow` over the map forces layout or repaint on every frame.
- `backdrop-filter` (the glass panels, used about 30 times) is expensive on low-end phones. Do not stack glass on glass, and do not animate a blurred element's size.
- Reduced motion also saves work. The map is created with `fadeDuration: 0` under reduced motion (`vector-map.ts`), but camera moves are not covered by that: a new `flyTo` or `easeTo` must pass `duration: 0` when the visitor asked for less motion. Lift cars follow `storedLiftMotionChoice`.

## Geolocation and timers

- One `watchPosition` at a time, stopped on clear (Lessons). Every fix updates one point; do not trigger `fitBounds` or a list re-sort on each fix unless the visitor asked to follow.
- No `setInterval` polling. Use events (`moveend`, `visibilitychange`, `online`). Stop any timer on unmount and when the tab is hidden.

## How to measure

1. **Lab**: Chrome DevTools Performance panel on the phone preset (4× CPU slowdown). Record the interaction, look for tasks over 50 ms and what they call. With the browser tools, use `browser_cdp` `Profiler.start` / `Profiler.stop` around the interaction.
2. **Map**: `map.showTileBoundaries` and `map.showCollisionBoxes` for debugging; FPS by counting `render` events in a short `Runtime.evaluate` loop. Test both providers.
3. **Bundle**: the route table from `npm run build`.
4. Write the before and after numbers in the report. A change that makes something faster without a number is a guess.

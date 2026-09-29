---
name: map-libraries
description: API differences between MapLibre GL 6 (default, OpenFreeMap) and Mapbox GL 3 (optional) as used by Skimap.eu through the VectorMap adapter in src/lib/vector-map.ts. Use when calling any map method, adding a source, layer, image, marker, or event handler, changing the camera, padding, fitBounds, terrain, fonts or glyphs, styles or theme swaps, clusters, the map worker, or map-related e2e stubs, or when upgrading either library.
---

# Map libraries

The site runs on **two map libraries** with one code path. MapLibre GL (`maplibre-gl` 6.11, checked against its `.d.ts`) is the default, with OpenFreeMap styles. Mapbox GL (`mapbox-gl` 3.31) is used only with a token, storage consent, and budget. The code talks to both through the `VectorMap` interface in `src/lib/vector-map.ts`. **A method that works in one library is not proof it works in the other.**

## Before calling a map API

1. Is it on `VectorMap`? Use it. If not, add it to the interface with the signature **both** libraries accept, and a comment where they differ.
2. Look it up for the installed version with Context7: `/maplibre/maplibre-gl-js` and `/websites/mapbox_mapbox-gl-js` (query both). Or read `node_modules/maplibre-gl/dist/maplibre-gl.d.ts` and `node_modules/mapbox-gl/dist/mapbox-gl.d.ts`. Do not trust memory or a blog: both APIs changed in their last two majors.
3. If the two differ, put the difference in one helper in `src/lib/` with a test (the pattern: `clusterExpansionZoom`, `map-camera.ts`).

## Known differences

| Area | MapLibre 6 | Mapbox 3 | Where handled |
| --- | --- | --- | --- |
| `fitBounds` padding | Adds the map's own padding and keeps it | Replaces the map's padding | `map-camera.ts`, `map-padding.ts` (`AGENTS.md`, Map) |
| `flyTo` / `easeTo` padding | Stores the padding on the map, so the next `fitBounds` adds it again | Stores it too (`retainPadding` defaults to true) and the next `fitBounds` replaces it | `fitResortBounds` clears MapLibre's stored padding down to the desktop panel before fitting |
| `getClusterExpansionZoom` | Returns a Promise | Takes a callback | `clusterExpansionZoom` in `vector-map.ts` |
| `GeoJSONSource.setData` | Returns `Promise<void>` (v6); no chaining; `waitForCompletion` removed | Returns the source | Never chain; `await` only if you need the data applied |
| `updateData` | `updateData(diff: GeoJSONSourceDiff): Promise<void>` with `{ add, remove, update, removeAll }`; needs a unique id on every feature | `updateData(data: GeoJSON): this` takes features and merges them by id. **Same name, different argument**: code written for one silently misbehaves on the other | Not used yet. Wrap it in one helper with a test per provider before using it |
| `map.on()` return | A `Subscription` with `unsubscribe()` (since v5); no chaining | Returns the map | `VectorMap.on` returns `void`; remove with `off` |
| WebGL options | Under `canvasContextAttributes`; WebGL2 only | Top-level options | `createVectorMap` |
| Worker | `setWorkerUrl` to `public/vendor/maplibre-gl-worker.js` (copied by `scripts/copy-map-workers.mjs`, because Next's webpack breaks the default URL) | Blob worker; needs `worker-src blob:` in the CSP | `vector-map.ts`, `security.ts` |
| Glyphs | OpenFreeMap font stacks | A missing font on Mapbox's font server drops the whole GeoJSON tile, dots included | `labelFonts(provider)` in `resort-layers.ts`; e2e stubs answer fonts with 200 |
| Styles | `positron` / `dark` from OpenFreeMap | Classic `light-v11` / `dark-v11` | `map-styles.ts`. Layer `slot`s exist only in Mapbox Standard: do not add them unless the style changes to Standard |
| Terrain, sky, fog | `setTerrain`, `setSky` | `setTerrain`, `setFog` | Optional methods on `VectorMap`; `terrain.ts` |

When you find a new difference, add a row here in the same change.

## Rules that hold for both

- **Style swap drops everything custom.** A theme change calls `setStyle`; sources, layers, and images are gone until `style.load`, and `MapView.tsx` adds them back there. Any new source or layer must be created in that same path, not only on first `load`. Adding one before the style is ready throws: the existing code catches it and waits for `style.load`.
- **Check before adding**: `getSource(id)` / `getLayer(id)` / `hasImage(id)` first; adding twice throws.
- **Layer ids, source ids, and CSS classes are part of the e2e suite.** Renaming one means updating `e2e/` in the same change (`AGENTS.md`, Map).
- **Camera padding** is shared state: the side panel, the sheet snap, and the consent card all change it. Use `mapFitPadding` and `map-camera.ts`; never hard-code pixels in a `flyTo`.
- **Reduced motion**: pass `duration: 0` to camera moves when the visitor asked for less motion (see the web-performance skill).
- **Events**: React state updates happen on `moveend`, never on `move` or `render`.
- **HTML in popups and markers** goes through `escapeHtml` (see the security-privacy skill).
- **Clean up**: every `on` has an `off` in the effect's cleanup, and the map is `remove()`d on unmount.

## Testing both

- Unit-test any provider branch in `src/lib` with both `"openfreemap"` and `"mapbox"`.
- The e2e suite stubs map requests (`e2e/map-stub.ts`). A new external request (tiles, glyphs, sprites, DEM) needs a stub, or the test waits on the network.
- In the browser: check the change with the default provider, then with Mapbox if a token is set locally. Say in the report if Mapbox could not be checked.

## Upgrading either library

1. Read the changelog for every major between the versions (Context7 or GitHub releases). The v5 and v6 notes above came from there.
2. Search the code for each changed method.
3. `npm ci` after the version bump, then `npm run check:lockfile`, `npm run build`, and `npm run test:e2e` to the end.
4. Update the table above.

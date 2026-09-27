# Data licence

OpenStreetMap-derived files in this repository are made available under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/)
(ODbL). © OpenStreetMap contributors.

You are free to copy, distribute, transmit, and adapt those files as long as
you credit OpenStreetMap and its contributors, share adapted databases under
the same licence, and keep the ODbL text available. The full licence is at
https://opendatacommons.org/licenses/odbl/1-0/.

## Files this licence covers

- `data/osm.json` — resort coordinates, OpenStreetMap place points, and any
  elevation, piste-length, lift-count, snow-park, night-skiing, or abandoned
  flags that came from OpenStreetMap or OpenSkiMap. The file itself is marked
  `"licence": "ODbL-1.0"`.
- `public/pistes/*.geojson` — piste and lift lines served with the map.
- `public/pistes/none.json` — resort ids that have no piste or lift line inside their search radius.
- `data/pistes/raw/*.json` — cached Overpass responses. Geometry is unchanged
  from OpenStreetMap. A few `website` tags that pointed at commercial ski
  portals were blanked so those URLs are not stored here.
- `data/pistes/summary.json` — counts produced from those Overpass extracts.

OpenSkiMap publishes ski-area locations derived from OpenStreetMap, also under
ODbL. Some coordinates in `data/osm.json` use an OpenSkiMap centroid. Earlier
notes credited Skimap.org for a handful of abandoned-lift points; those notes
now name OpenSkiMap, and this file does not store a Skimap.org URL.

The optional piste overlay uses tiles from www.opensnowmap.org (CC BY-SA).
Those tiles are not copied into this repository.

The on-screen base map is not stored here. It is requested live from
OpenFreeMap (OpenMapTiles schema, © OpenMapTiles, data © OpenStreetMap
contributors) or, when a token, storage consent, and the monthly load budget
allow it, from Mapbox. Positron, the OpenFreeMap style used here, includes
Natural Earth shaded relief at low zoom.

## Files this licence does not cover

- `data/resorts.json` and `data/passes.json` are our own notes: names, pass
  coverage, official websites, season dates, public-transport notes, and the
  few day-ticket prices taken from a resort's own site. They are not an
  OpenStreetMap database and are not under the ODbL.
- Application code is covered by the placeholder in `LICENSE`.

Produced works such as the rendered map must still credit OpenStreetMap. The
map shows “© OpenStreetMap contributors” and an OpenSkiMap credit.

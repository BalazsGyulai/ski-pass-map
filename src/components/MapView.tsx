"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { passById, passes, resorts } from "@/lib/data";
import { passShortName } from "@/lib/pass-label";
import { clusterPoints } from "@/lib/cluster";
import { filterResorts } from "@/lib/filter";
import { formatEur } from "@/lib/format";
import { clusterRingHtml, passShares, pricePillHtml } from "@/lib/marker";
import { BASE_PATH } from "@/lib/site";
import { OSM_TILE_ATTRIBUTION, OSM_TILE_URL } from "@/lib/basemap";
import { escapeHtml } from "@/lib/html";
import { mapFitPadding } from "@/lib/map-padding";
import { pisteStyle, type PisteProperties } from "@/lib/pistes";
import { useApp } from "./AppState";

const AUSTRIA: L.LatLngExpression = [47.5, 13.35];

export default function MapView() {
  return (
    <MapContainer center={AUSTRIA} zoom={7} minZoom={4} maxZoom={16} className="map-canvas" scrollWheelZoom zoomControl={false}>
      <BaseTiles />
      <MapLayers />
    </MapContainer>
  );
}

function BaseTiles() {
  return <TileLayer url={OSM_TILE_URL} attribution={OSM_TILE_ATTRIBUTION} maxZoom={19} />;
}

function mapPadding(map: L.Map): { paddingTopLeft: [number, number]; paddingBottomRight: [number, number] } {
  return mapFitPadding({
    narrow: window.matchMedia("(max-width: 899px)").matches,
    sheet: document.documentElement.dataset.sheet ?? null,
    height: map.getSize().y,
  });
}

function darkPisteColor(color: string, difficulty: string | null, theme: "system" | "light" | "dark"): string {
  if (difficulty !== "advanced" && difficulty !== "expert") return color;
  const mediaDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme !== "light" && mediaDark);
  return dark ? "#f4f4f5" : color;
}

function mapHasSize(map: L.Map): boolean {
  const size = map.getSize();
  return size.x >= 1 && size.y >= 1;
}

function MapLayers() {
  const map = useMap();
  const { share, home, favourites, highlightId, selectResort, t, theme, resortDays, reportMapBounds, mapApi, lang } = useApp();
  const [pisteNote, setPisteNote] = useState<"idle" | "loading" | "empty" | "ready">("idle");
  const passNames = useMemo(() => new Map(passes.map((pass) => [pass.id, pass.name])), []);
  const colors = useMemo(() => new Map(passes.map((pass) => [pass.id, pass.color])), []);

  const filtered = useMemo(
    () =>
      filterResorts(resorts, share, {
        home,
        favourites: new Set(favourites),
        passNames,
      }),
    [share, home, favourites, passNames],
  );

  useEffect(() => {
    const resortsLayer = L.layerGroup().addTo(map);
    const draw = () => {
      if (!mapHasSize(map)) return;
      resortsLayer.clearLayers();
      const zoom = map.getZoom();
      const pool = filtered.filter((resort) => resort.id !== share.resort);
      const clusters = clusterPoints(pool, zoom, { unclusterZoom: 9 });
      const resortMarker = (resort: (typeof filtered)[number], selected: boolean) => {
        const price = resort.day_ticket_eur != null ? formatEur(lang, resort.day_ticket_eur) : t("dash");
        const covered = resort.passes.map((id) => passById.get(id)).filter((pass) => pass != null);
        const shorts = covered.map((pass) => passShortName(pass));
        const fullNames = covered.map((pass) => pass.name);
        const label = shorts.length === 0 ? t("dash") : shorts.length === 1 ? shorts[0] : `${shorts[0]} +${shorts.length - 1}`;
        const accessible = [resort.name, fullNames.length > 0 ? fullNames.join(", ") : t("noPass"), price].join(", ");
        const width = selected
          ? Math.min(240, 96 + resort.name.length * 7)
          : Math.min(180, 36 + label.length * 8 + Math.min(3, resort.passes.length) * 10);
        const height = selected ? 46 : 30;
        const icon = L.divIcon({
          className: `resort-marker${highlightId === resort.id && !selected ? " is-hot" : ""}`,
          html: pricePillHtml({
            label,
            accessibleName: accessible,
            colors: resort.passes.map((id) => colors.get(id) ?? "#94A3B8"),
            selected,
            name: resort.name,
            plannedDays: resortDays[resort.id] ?? 0,
            closed: resort.abandoned,
            noPass: resort.passes.length === 0,
          }),
          iconSize: [width, height],
          iconAnchor: [width / 2, selected ? height : height / 2],
        });
        const marker = L.marker([resort.lat, resort.lon], {
          icon,
          keyboard: true,
          title: accessible,
          zIndexOffset: selected ? 1200 : highlightId === resort.id ? 800 : 0,
        });
        marker.on("click", () => selectResort(resort.id));
        return marker;
      };
      clusters.forEach((cluster) => {
        if (cluster.items.length === 1) {
          resortsLayer.addLayer(resortMarker(cluster.items[0], false));
        } else {
          const shares = passShares(cluster.items, (id) => colors.get(id) ?? "#94A3B8");
          const icon = L.divIcon({
            className: "resort-marker",
            html: clusterRingHtml(cluster.items.length, shares),
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
          const marker = L.marker([cluster.lat, cluster.lon], {
            icon,
            keyboard: true,
            title: t("clusterLabel", { n: cluster.items.length }),
          });
          marker.on("click", () => {
            if (!mapHasSize(map)) return;
            const bounds = L.latLngBounds(cluster.items.map((item) => [item.lat, item.lon] as [number, number]));
            map.fitBounds(bounds.pad(0.2), { padding: [32, 32], maxZoom: 12 });
          });
          resortsLayer.addLayer(marker);
        }
      });
      const selected = filtered.find((resort) => resort.id === share.resort);
      if (selected) resortsLayer.addLayer(resortMarker(selected, true));
    };
    draw();
    map.on("zoomend", draw);
    map.on("resize", draw);
    return () => {
      map.off("zoomend", draw);
      map.off("resize", draw);
      map.removeLayer(resortsLayer);
    };
  }, [map, filtered, share.resort, highlightId, colors, selectResort, t, lang, resortDays]);

  useEffect(() => {
    if (!share.resort || share.hideRuns) {
      setPisteNote("idle");
      return;
    }
    const resort = resorts.find((item) => item.id === share.resort);
    if (!resort) return;
    let cancelled = false;
    const layer = L.geoJSON(undefined, {
      style: (feature) => {
        const props = feature?.properties as PisteProperties | undefined;
        const style = pisteStyle(props?.difficulty ?? null, props?.kind === "lift" ? "lift" : "piste");
        const color = darkPisteColor(style.color, props?.difficulty ?? null, theme);
        return { color, weight: style.weight, dashArray: style.dashArray, opacity: 0.95, lineCap: "round", lineJoin: "round" };
      },
      onEachFeature: (feature, marker) => {
        const props = feature.properties as PisteProperties | null;
        if (!props) return;
        const difficulty =
          props.kind === "lift"
            ? t("pisteLift")
            : props.difficulty === "novice"
              ? t("pisteNovice")
              : props.difficulty === "easy"
                ? t("pisteEasy")
                : props.difficulty === "intermediate"
                  ? t("pisteIntermediate")
                  : props.difficulty === "advanced" || props.difficulty === "expert"
                    ? t("pisteAdvanced")
                    : props.difficulty === "freeride"
                      ? t("pisteFreeride")
                      : t("pisteOther");
        const lift = props.aerialway?.replaceAll("_", " ");
        const text = [props.name, props.kind === "lift" ? lift ?? difficulty : difficulty].filter(Boolean).join(" · ");
        marker.bindTooltip(escapeHtml(text), { sticky: true, opacity: 1 });
      },
    }).addTo(map);
    setPisteNote("loading");
    const frame = requestAnimationFrame(() => {
      if (cancelled || !mapHasSize(map)) return;
      void fetch(`${BASE_PATH}/pistes/${resort.id}.geojson`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { features?: unknown[] } | null) => {
          if (cancelled || !mapHasSize(map)) return;
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const count = data?.features?.length ?? 0;
          if (data && count > 0) {
            layer.addData(data as GeoJSON.GeoJSON);
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds.pad(0.2), { ...mapPadding(map), maxZoom: 14, animate: !reduced });
            }
            setPisteNote("ready");
            return;
          }
          const zoom = map.getZoom();
          if (Number.isFinite(zoom)) {
            map.flyTo([resort.lat, resort.lon], Math.max(zoom, 12), { animate: !reduced, duration: reduced ? 0 : 0.6 });
          }
          setPisteNote("empty");
        })
        .catch(() => {
          if (!cancelled) setPisteNote("empty");
        });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      map.removeLayer(layer);
    };
  }, [map, share.resort, share.hideRuns, t, theme]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [map, share.view]);

  useEffect(() => {
    let zoom: L.Control.Zoom | null = null;
    const sync = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const narrow = window.matchMedia("(max-width: 899px)").matches;
      const show = !coarse && !narrow && mapHasSize(map);
      if (!show) {
        zoom?.remove();
        zoom = null;
        return;
      }
      if (zoom) return;
      zoom = L.control.zoom({ position: "topright" });
      zoom.addTo(map);
    };
    sync();
    map.on("resize", sync);
    return () => {
      map.off("resize", sync);
      zoom?.remove();
    };
  }, [map]);

  useEffect(() => {
    const report = () => {
      if (!mapHasSize(map)) return;
      const bounds = map.getBounds();
      reportMapBounds({ south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() });
    };
    const frame = requestAnimationFrame(report);
    map.on("moveend", report);
    map.on("resize", report);
    return () => {
      cancelAnimationFrame(frame);
      map.off("moveend", report);
      map.off("resize", report);
    };
  }, [map, reportMapBounds]);

  useEffect(() => {
    mapApi.current = {
      zoomOut() {
        if (mapHasSize(map)) map.zoomOut();
      },
      fitAll() {
        if (!mapHasSize(map) || filtered.length === 0) {
          if (mapHasSize(map)) map.zoomOut();
          return;
        }
        const bounds = L.latLngBounds(filtered.map((resort) => [resort.lat, resort.lon] as [number, number]));
        map.fitBounds(bounds.pad(0.2), { ...mapPadding(map), maxZoom: 8 });
      },
    };
  }, [map, mapApi, filtered]);

  useEffect(() => {
    function onClick(event: L.LeafletMouseEvent) {
      const target = event.originalEvent?.target;
      if (target instanceof Element && target.closest(".leaflet-control, .leaflet-marker-icon, .leaflet-tooltip, .leaflet-overlay-pane, .layers")) return;
      selectResort(null);
    }
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map, selectResort]);

  return (
    <>
      {share.showPistes ? (
        <TileLayer
          url="https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.opensnowmap.org/" rel="noopener noreferrer">OpenSnowMap.org</a> (CC BY-SA)'
          opacity={0.9}
        />
      ) : null}
      {share.resort && !share.hideRuns && pisteNote !== "idle" && pisteNote !== "ready" ? (
        <p className="piste-float" role="status">
          {pisteNote === "loading" ? t("pisteLoading") : t("pisteEmpty")}
        </p>
      ) : null}
    </>
  );
}

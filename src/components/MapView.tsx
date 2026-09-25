"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import site from "../../config/site.json";
import { cities, passes, resorts } from "@/lib/data";
import { clusterPoints } from "@/lib/cluster";
import { filterResorts } from "@/lib/filter";
import { cityNoteLabel } from "@/lib/i18n";
import { pieSvg } from "@/lib/marker";
import { pisteStyle, type PisteProperties } from "@/lib/pistes";
import { useApp } from "./AppState";

const EAST: L.LatLngExpression = [47.55, 15.55];
const TIROL: L.LatLngExpression = [47.2, 11.65];

export default function MapView() {
  return (
    <MapContainer center={EAST} zoom={8} minZoom={6} maxZoom={16} className="map-canvas" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapLayers />
    </MapContainer>
  );
}

function mapHasSize(map: L.Map): boolean {
  const size = map.getSize();
  return size.x >= 1 && size.y >= 1;
}

function MapLayers() {
  const map = useMap();
  const { share, updateShare, home, favourites, highlightId, selectResort, t, lang } = useApp();
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
      const clusters = clusterPoints(filtered, zoom);
      clusters.forEach((cluster) => {
        if (cluster.items.length === 1) {
          const resort = cluster.items[0];
          const marked = share.resort === resort.id || highlightId === resort.id;
          const icon = L.divIcon({
            className: "resort-marker",
            html: pieSvg(
              resort.passes.map((id) => colors.get(id) ?? "#8b938e"),
              { selected: marked, klima: resort.klimaticket, closed: resort.status === "closed?" },
            ),
            iconSize: [28, 32],
            iconAnchor: [14, 14],
          });
          const marker = L.marker([resort.lat, resort.lon], { icon, keyboard: true, title: resort.name });
          if (zoom >= 11) {
            marker.bindTooltip(resort.name, {
              permanent: true,
              direction: "right",
              offset: [12, 0],
              className: "resort-label",
              opacity: 1,
            });
          }
          marker.on("click", () => selectResort(resort.id));
          resortsLayer.addLayer(marker);
        } else {
          const icon = L.divIcon({
            className: "resort-marker",
            html: `<span class="cluster-bubble">${cluster.items.length}</span>`,
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
    };
    draw();
    map.on("zoomend", draw);
    map.on("resize", draw);
    return () => {
      map.off("zoomend", draw);
      map.off("resize", draw);
      map.removeLayer(resortsLayer);
    };
  }, [map, filtered, share.resort, highlightId, colors, selectResort, t]);

  useEffect(() => {
    const layer = L.layerGroup().addTo(map);
    cities.forEach((city) => {
      const note = cityNoteLabel(lang, city.id);
      const label = note ? `${city.name} (${note})` : city.name;
      const homeCity = share.home === city.id;
      const icon = L.divIcon({
        className: "city-marker",
        html: `<span class="city-star${homeCity ? " is-home" : ""}">★</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([city.lat, city.lon], { icon, keyboard: true, title: label, zIndexOffset: 400 });
      marker.bindTooltip(label, { permanent: true, direction: "right", offset: [10, 0], className: "city-label", opacity: 1 });
      layer.addLayer(marker);
    });
    return () => {
      map.removeLayer(layer);
    };
  }, [map, lang, share.home]);

  useEffect(() => {
    if (!share.resort) {
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
        return { color: style.color, weight: style.weight, dashArray: style.dashArray, opacity: 0.95, lineCap: "round", lineJoin: "round" };
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
        marker.bindTooltip(text, { sticky: true, opacity: 1 });
      },
    }).addTo(map);
    setPisteNote("loading");
    const frame = requestAnimationFrame(() => {
      if (cancelled || !mapHasSize(map)) return;
      void fetch(`${site.basePath}/pistes/${resort.id}.geojson`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { features?: unknown[] } | null) => {
          if (cancelled || !mapHasSize(map)) return;
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const count = data?.features?.length ?? 0;
          if (data && count > 0) {
            layer.addData(data as GeoJSON.GeoJSON);
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds.pad(0.2), { padding: [36, 36], maxZoom: 14, animate: !reduced });
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
  }, [map, share.resort, t]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [map, share.view]);

  function jump(target: L.LatLngExpression, zoom: number) {
    if (!mapHasSize(map)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo(target, zoom, { animate: !reduced, duration: reduced ? 0 : 0.7 });
  }

  return (
    <>
      {share.showPistes ? (
        <TileLayer
          url="https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.opensnowmap.org/">OpenSnowMap.org</a> (CC BY-SA)'
          opacity={0.9}
        />
      ) : null}
      {share.resort || share.showPistes ? (
        <div className="piste-legend" aria-label={t("pisteLegend")}>
          <p>{t("pisteLegend")}</p>
          <ul>
            <li><span className="piste-swatch" style={{ background: "#1f9d55" }} />{t("pisteNovice")}</li>
            <li><span className="piste-swatch" style={{ background: "#1d6fd8" }} />{t("pisteEasy")}</li>
            <li><span className="piste-swatch" style={{ background: "#d62728" }} />{t("pisteIntermediate")}</li>
            <li><span className="piste-swatch" style={{ background: "#161616" }} />{t("pisteAdvanced")}</li>
            <li><span className="piste-swatch dashed" />{t("pisteFreeride")}</li>
            <li><span className="piste-swatch" style={{ background: "#1c2430" }} />{t("pisteLift")}</li>
          </ul>
          {pisteNote === "loading" ? <p className="piste-note">{t("pisteLoading")}</p> : null}
          {pisteNote === "empty" ? <p className="piste-note">{t("pisteEmpty")}</p> : null}
        </div>
      ) : null}
    <div className="map-actions">
      <button type="button" aria-pressed={share.showPistes} onClick={() => updateShare({ showPistes: !share.showPistes })}>
        {t("showAllPistes")}
      </button>
      <button type="button" onClick={() => jump(EAST, 8)}>
        {t("jumpEast")}
      </button>
      <button type="button" onClick={() => jump(TIROL, 8)}>
        {t("jumpTirol")}
      </button>
      <button
        type="button"
        onClick={() => {
          if (filtered.length === 0 || !mapHasSize(map)) return;
          const bounds = L.latLngBounds(filtered.map((resort) => [resort.lat, resort.lon] as [number, number]));
          map.fitBounds(bounds.pad(0.15), { padding: [28, 28], maxZoom: 11 });
        }}
      >
        {t("fitResorts")}
      </button>
    </div>
    </>
  );
}

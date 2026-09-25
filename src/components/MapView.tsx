"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cities, passes, resorts } from "@/lib/data";
import { clusterPoints } from "@/lib/cluster";
import { filterResorts } from "@/lib/filter";
import { cityNoteLabel } from "@/lib/i18n";
import { pieSvg } from "@/lib/marker";
import { useApp } from "./AppState";

const EAST: L.LatLngExpression = [47.55, 15.55];
const TIROL: L.LatLngExpression = [47.2, 11.65];

export default function MapView() {
  return (
    <MapContainer center={EAST} zoom={8} minZoom={6} maxZoom={16} className="map-canvas" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapLayers />
    </MapContainer>
  );
}

function MapLayers() {
  const map = useMap();
  const { share, home, favourites, highlightId, selectResort, t, lang } = useApp();
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
            const bounds = L.latLngBounds(cluster.items.map((item) => [item.lat, item.lon] as [number, number]));
            map.fitBounds(bounds.pad(0.2), { padding: [32, 32], maxZoom: 12 });
          });
          resortsLayer.addLayer(marker);
        }
      });
    };
    draw();
    map.on("zoomend", draw);
    return () => {
      map.off("zoomend", draw);
      map.removeLayer(resortsLayer);
    };
  }, [map, filtered, share.resort, highlightId, colors, selectResort, t]);

  useEffect(() => {
    const layer = L.layerGroup().addTo(map);
    cities.forEach((city) => {
      const note = cityNoteLabel(lang, city.note);
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
    if (!share.resort) return;
    const resort = resorts.find((item) => item.id === share.resort);
    if (!resort) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo([resort.lat, resort.lon], Math.max(map.getZoom(), 12), { animate: !reduced, duration: reduced ? 0 : 0.6 });
  }, [map, share.resort]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [map, share.view]);

  function jump(target: L.LatLngExpression, zoom: number) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo(target, zoom, { animate: !reduced, duration: reduced ? 0 : 0.7 });
  }

  return (
    <div className="map-actions">
      <button type="button" onClick={() => jump(EAST, 8)}>
        {t("jumpEast")}
      </button>
      <button type="button" onClick={() => jump(TIROL, 8)}>
        {t("jumpTirol")}
      </button>
      <button
        type="button"
        onClick={() => {
          if (filtered.length === 0) return;
          const bounds = L.latLngBounds(filtered.map((resort) => [resort.lat, resort.lon] as [number, number]));
          map.fitBounds(bounds.pad(0.15), { padding: [28, 28], maxZoom: 11 });
        }}
      >
        {t("fitResorts")}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { passById, passes, resorts } from "@/lib/data";
import { passShortName } from "@/lib/pass-label";
import { clusterPoints } from "@/lib/cluster";
import { filterResorts } from "@/lib/filter";
import { formatEur } from "@/lib/format";
import { clusterRingHtml, passShares, pricePillHtml } from "@/lib/marker";
import { BASE_PATH } from "@/lib/site";
import { OPENSNOWMAP_ATTRIBUTION, OPENSNOWMAP_TILES, mapAppearance, styleFor } from "@/lib/map-styles";
import { providerAfterFailure, resolveMapProvider } from "@/lib/map-provider";
import type { MapProviderId } from "@/lib/map-styles";
import {
  PISTE_SOURCE_ID,
  boundsOfGeoJson,
  createVectorMap,
  firstLabelLayer,
  glFitPadding,
  hasMapSize,
  loadMapLibrary,
  motionDuration,
  padLngLatBounds,
  pisteLayerIds,
  pisteLayerSpecs,
  pisteTip,
  type MapLib,
  type VectorMap,
  type VectorMarker,
} from "@/lib/vector-map";
import { useApp } from "./AppState";

const SNOW_SOURCE = "opensnow-pistes";
const SNOW_LAYER = "opensnow-pistes";

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<VectorMap | null>(null);
  const libRef = useRef<MapLib | null>(null);
  const appliedStyle = useRef<string | null>(null);
  const pisteData = useRef<unknown>(null);
  const { share, home, favourites, highlightId, selectResort, t, theme, resortDays, reportMapBounds, mapApi, lang, offline } = useApp();
  const [choice, setChoice] = useState<MapProviderId | null>(null);
  const [override, setOverride] = useState<MapProviderId | null>(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [pisteNote, setPisteNote] = useState<"idle" | "loading" | "empty" | "ready">("idle");
  const [systemDark, setSystemDark] = useState(false);
  const provider = override ?? choice;
  const appearance = mapAppearance(theme, systemDark);
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const darkRef = useRef(appearance === "dark");
  darkRef.current = appearance === "dark";

  const passNames = useMemo(() => new Map(passes.map((pass) => [pass.id, pass.name])), []);
  const colors = useMemo(() => new Map(passes.map((pass) => [pass.id, pass.color])), []);
  const filtered = useMemo(
    () => filterResorts(resorts, share, { home, favourites: new Set(favourites), passNames }),
    [share, home, favourites, passNames],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (choice || offline) return;
    let cancelled = false;
    void resolveMapProvider().then((next) => {
      if (!cancelled) setChoice(next);
    });
    return () => {
      cancelled = true;
    };
  }, [choice, offline]);

  useEffect(() => {
    const container = containerRef.current;
    if (!provider || !container) return;
    let cancelled = false;
    let map: VectorMap | null = null;
    const fail = () => {
      if (cancelled) return;
      const next = providerAfterFailure(provider);
      if (next === "openfreemap") setOverride("openfreemap");
      else setBootError(true);
    };
    void (async () => {
      try {
        const loaded = await loadMapLibrary(provider);
        if (cancelled) return;
        const themeNow = appearanceRef.current;
        map = createVectorMap(loaded.lib, {
          container,
          provider,
          token: loaded.token,
          theme: themeNow,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          onFatal: fail,
        });
        libRef.current = loaded.lib;
        mapRef.current = map;
        appliedStyle.current = styleFor(provider, themeNow);
        map.on("load", () => {
          if (!cancelled) setReady(true);
        });
      } catch (error) {
        console.error("Map failed to start", error);
        fail();
      }
    })();
    return () => {
      cancelled = true;
      setReady(false);
      map?.remove();
      if (mapRef.current === map) mapRef.current = null;
      libRef.current = null;
      appliedStyle.current = null;
    };
  }, [provider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !provider || !ready) return;
    const next = styleFor(provider, appearance);
    if (appliedStyle.current === next) return;
    appliedStyle.current = next;
    map.setStyle(next);
  }, [appearance, provider, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !ready) return;
    let markers: VectorMarker[] = [];
    const draw = () => {
      for (const marker of markers) marker.remove();
      markers = [];
      if (!hasMapSize(map)) return;
      const zoom = map.getZoom();
      const pool = filtered.filter((resort) => resort.id !== share.resort);
      const clusters = clusterPoints(pool, zoom, { unclusterZoom: 9 });
      const addResort = (resort: (typeof filtered)[number], selected: boolean) => {
        const price = resort.day_ticket_eur != null ? formatEur(lang, resort.day_ticket_eur) : t("dash");
        const covered = resort.passes.map((id) => passById.get(id)).filter((pass) => pass != null);
        const shorts = covered.map((pass) => passShortName(pass));
        const fullNames = covered.map((pass) => pass.name);
        const label = shorts.length === 0 ? t("dash") : shorts.length === 1 ? shorts[0] : `${shorts[0]} +${shorts.length - 1}`;
        const accessible = [resort.name, fullNames.length > 0 ? fullNames.join(", ") : t("noPass"), price].join(", ");
        const button = document.createElement("button");
        button.type = "button";
        button.className = `resort-marker${highlightId === resort.id && !selected ? " is-hot" : ""}${selected ? " is-selected" : ""}`;
        button.innerHTML = pricePillHtml({
          label,
          accessibleName: accessible,
          colors: resort.passes.map((id) => colors.get(id) ?? "#94A3B8"),
          selected,
          name: resort.name,
          plannedDays: resortDays[resort.id] ?? 0,
          closed: resort.abandoned,
          noPass: resort.passes.length === 0,
        });
        button.setAttribute("aria-label", accessible);
        button.title = accessible;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          selectResort(resort.id);
        });
        const marker = new lib.Marker({ element: button, anchor: selected ? "bottom" : "center" }).setLngLat([resort.lon, resort.lat]).addTo(map);
        marker.getElement().style.zIndex = selected ? "4" : highlightId === resort.id ? "3" : "1";
        markers.push(marker);
      };
      clusters.forEach((cluster) => {
        if (cluster.items.length === 1) {
          addResort(cluster.items[0], false);
          return;
        }
        const shares = passShares(cluster.items, (id) => colors.get(id) ?? "#94A3B8");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "resort-marker";
        button.innerHTML = clusterRingHtml(cluster.items.length, shares);
        const accessible = t("clusterLabel", { n: cluster.items.length });
        button.setAttribute("aria-label", accessible);
        button.title = accessible;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          if (!hasMapSize(map)) return;
          const bounds = padLngLatBounds(
            cluster.items.map((item) => [item.lon, item.lat]),
            0.2,
          );
          if (!bounds) return;
          map.fitBounds(bounds, { padding: 32, maxZoom: 12, duration: motionDuration(500) });
        });
        const marker = new lib.Marker({ element: button, anchor: "center" }).setLngLat([cluster.lon, cluster.lat]).addTo(map);
        markers.push(marker);
      });
      const selected = filtered.find((resort) => resort.id === share.resort);
      if (selected) addResort(selected, true);
    };
    draw();
    map.on("zoomend", draw);
    map.on("resize", draw);
    return () => {
      map.off("zoomend", draw);
      map.off("resize", draw);
      for (const marker of markers) marker.remove();
    };
  }, [ready, filtered, share.resort, highlightId, colors, selectResort, t, lang, resortDays]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    const apply = (data: unknown) => {
      if (!map.isStyleLoaded()) return;
      clearPistes(map);
      if (!data) return;
      map.addSource(PISTE_SOURCE_ID, { type: "geojson", data });
      const before = firstLabelLayer(map);
      for (const spec of pisteLayerSpecs(darkRef.current)) {
        const layer = {
          id: spec.id,
          type: "line",
          source: PISTE_SOURCE_ID,
          filter: spec.filter,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": spec.color,
            "line-width": spec.width,
            "line-opacity": 0.95,
            ...(spec.dash ? { "line-dasharray": spec.dash } : {}),
          },
        };
        if (before) map.addLayer(layer, before);
        else map.addLayer(layer);
      }
    };
    pisteData.current = null;
    if (map.isStyleLoaded()) clearPistes(map);
    const load = () => {
      if (!share.resort || share.hideRuns) {
        setPisteNote("idle");
        return;
      }
      const resort = resorts.find((item) => item.id === share.resort);
      if (!resort) return;
      setPisteNote("loading");
      void fetch(`${BASE_PATH}/pistes/${resort.id}.geojson`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { features?: unknown[] } | null) => {
          if (cancelled) return;
          const count = data?.features?.length ?? 0;
          if (data && count > 0) {
            pisteData.current = data;
            apply(data);
            const bounds = boundsOfGeoJson(data);
            if (bounds && hasMapSize(map)) {
              map.fitBounds(bounds, {
                padding: glFitPadding(map.getContainer().clientHeight),
                maxZoom: 14,
                duration: motionDuration(600),
              });
            }
            setPisteNote("ready");
            return;
          }
          pisteData.current = null;
          if (hasMapSize(map)) {
            map.flyTo({
              center: [resort.lon, resort.lat],
              zoom: Math.max(map.getZoom(), 12),
              duration: motionDuration(600),
              padding: glFitPadding(map.getContainer().clientHeight),
            });
          }
          setPisteNote("empty");
        })
        .catch(() => {
          if (!cancelled) setPisteNote("empty");
        });
    };
    const onStyle = () => {
      if (pisteData.current) apply(pisteData.current);
    };
    load();
    map.on("style.load", onStyle);
    return () => {
      cancelled = true;
      map.off("style.load", onStyle);
    };
  }, [ready, share.resort, share.hideRuns]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      if (!map.isStyleLoaded()) return;
      syncSnow(map, share.showPistes);
    };
    apply();
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
  }, [ready, share.showPistes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const frame = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(frame);
  }, [ready, share.view]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !ready) return;
    let control: unknown = null;
    const sync = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const narrow = window.matchMedia("(max-width: 899px)").matches;
      const show = !coarse && !narrow && hasMapSize(map);
      if (!show) {
        if (control) {
          map.removeControl(control);
          control = null;
        }
        return;
      }
      if (control) return;
      control = new lib.NavigationControl({ showCompass: false, showZoom: true, visualizePitch: false });
      map.addControl(control, "top-right");
    };
    sync();
    map.on("resize", sync);
    const coarseMedia = window.matchMedia("(pointer: coarse)");
    const narrowMedia = window.matchMedia("(max-width: 899px)");
    coarseMedia.addEventListener("change", sync);
    narrowMedia.addEventListener("change", sync);
    return () => {
      map.off("resize", sync);
      coarseMedia.removeEventListener("change", sync);
      narrowMedia.removeEventListener("change", sync);
      if (control) map.removeControl(control);
    };
  }, [ready, provider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const report = () => {
      if (!hasMapSize(map) || !map.isStyleLoaded()) return;
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
  }, [ready, reportMapBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    mapApi.current = {
      zoomOut() {
        if (hasMapSize(map)) map.zoomOut({ duration: motionDuration(300) });
      },
      fitAll() {
        if (!hasMapSize(map) || filtered.length === 0) {
          if (hasMapSize(map)) map.zoomOut({ duration: motionDuration(300) });
          return;
        }
        const bounds = padLngLatBounds(
          filtered.map((resort) => [resort.lon, resort.lat]),
          0.2,
        );
        if (!bounds) return;
        map.fitBounds(bounds, {
          padding: glFitPadding(map.getContainer().clientHeight),
          maxZoom: 8,
          duration: motionDuration(600),
        });
      },
    };
  }, [ready, mapApi, filtered]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !ready) return;
    const popup = new lib.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "piste-tip" });
    const labels = {
      lift: t("pisteLift"),
      novice: t("pisteNovice"),
      easy: t("pisteEasy"),
      intermediate: t("pisteIntermediate"),
      advanced: t("pisteAdvanced"),
      freeride: t("pisteFreeride"),
      other: t("pisteOther"),
    };
    const showTip = (properties: Record<string, unknown> | null | undefined, lngLat: { lng: number; lat: number }) => {
      const text = pisteTip(properties, labels);
      if (!text) {
        popup.remove();
        return;
      }
      popup.setLngLat(lngLat).setText(text).addTo(map);
    };
    const onMove = (event: { point?: { x: number; y: number }; lngLat?: { lng: number; lat: number } }) => {
      if (!event.point || !event.lngLat || !map.isStyleLoaded()) return;
      const layers = pisteLayerIds().filter((id) => map.getLayer(id));
      if (layers.length === 0) {
        popup.remove();
        map.getCanvas().style.cursor = "";
        return;
      }
      let features: Array<{ properties?: Record<string, unknown> | null }> = [];
      try {
        features = map.queryRenderedFeatures([event.point.x, event.point.y], { layers });
      } catch {
        features = [];
      }
      if (features.length === 0) {
        popup.remove();
        map.getCanvas().style.cursor = "";
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      showTip(features[0].properties ?? null, event.lngLat);
    };
    const onClick = (event: { point?: { x: number; y: number }; lngLat?: { lng: number; lat: number }; originalEvent?: Event }) => {
      const target = event.originalEvent?.target;
      if (target instanceof Element && target.closest(".resort-marker, .maplibregl-ctrl, .mapboxgl-ctrl, .maplibregl-popup, .mapboxgl-popup, .layers")) return;
      if (event.point && map.isStyleLoaded()) {
        const layers = pisteLayerIds().filter((id) => map.getLayer(id));
        if (layers.length > 0 && event.lngLat) {
          try {
            const features = map.queryRenderedFeatures([event.point.x, event.point.y], { layers });
            if (features.length > 0) {
              showTip(features[0].properties ?? null, event.lngLat);
              return;
            }
          } catch {
            // A missing layer should not close the resort card.
          }
        }
      }
      popup.remove();
      selectResort(null);
    };
    map.on("mousemove", onMove);
    map.on("click", onClick);
    return () => {
      map.off("mousemove", onMove);
      map.off("click", onClick);
      popup.remove();
    };
  }, [ready, selectResort, t]);

  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el || !ready) return;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div className="map-root" data-map-provider={provider ?? "pending"}>
      <div ref={containerRef} className="map-canvas" />
      {!ready && !bootError ? <div className="map-skeleton" role="status" aria-label={t("loadingMap")} /> : null}
      {bootError ? (
        <div className="map-skeleton" role="alert">
          {t("mapError")}
        </div>
      ) : null}
      {share.resort && !share.hideRuns && pisteNote !== "idle" && pisteNote !== "ready" ? (
        <p className="piste-float" role="status">
          {pisteNote === "loading" ? t("pisteLoading") : t("pisteEmpty")}
        </p>
      ) : null}
    </div>
  );
}

function clearPistes(map: VectorMap) {
  if (!map.isStyleLoaded()) return;
  for (const id of pisteLayerIds()) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(PISTE_SOURCE_ID)) map.removeSource(PISTE_SOURCE_ID);
}

function syncSnow(map: VectorMap, show: boolean) {
  if (!map.isStyleLoaded()) return;
  const exists = Boolean(map.getLayer(SNOW_LAYER));
  if (!show) {
    if (exists) map.removeLayer(SNOW_LAYER);
    if (map.getSource(SNOW_SOURCE)) map.removeSource(SNOW_SOURCE);
    return;
  }
  if (exists) return;
  map.addSource(SNOW_SOURCE, {
    type: "raster",
    tiles: [OPENSNOWMAP_TILES],
    tileSize: 256,
    attribution: OPENSNOWMAP_ATTRIBUTION,
  });
  const layer = { id: SNOW_LAYER, type: "raster", source: SNOW_SOURCE, paint: { "raster-opacity": 0.9 } };
  const before = firstLabelLayer(map);
  if (before) map.addLayer(layer, before);
  else map.addLayer(layer);
}

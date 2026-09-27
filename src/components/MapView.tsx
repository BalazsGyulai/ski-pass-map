"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { passes, resortById, resorts } from "@/lib/data";
import { passShortName } from "@/lib/pass-label";
import {
  FOCUS_SOURCE,
  RESORT_HIT_LAYERS,
  RESORT_LAYERS,
  RESORT_SOURCE,
  CLUSTER_RADIUS,
  UNCLUSTER_ZOOM,
  resortFeature,
  resortFeatureCollection,
  resortLayerSpecs,
  type ResortFeature,
  type ResortFeatureCollection,
  type ResortFeatureContext,
} from "@/lib/resort-layers";
import { BASE_PATH } from "@/lib/site";
import { OPENSNOWMAP_ATTRIBUTION, OPENSNOWMAP_TILES, mapAppearance, styleFor } from "@/lib/map-styles";
import { providerAfterFailure, resolveMapProvider } from "@/lib/map-provider";
import type { MapAppearance, MapProviderId } from "@/lib/map-styles";
import {
  PISTE_SOURCE_ID,
  clusterExpansionZoom,
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
  type RenderedFeature,
  type VectorMap,
} from "@/lib/vector-map";
import { attachMapProbe } from "@/lib/map-canvas-probe";
import { flyToResort, readSheetSnap, resortCameraPadding, whenMapIdle } from "@/lib/map-camera";
import { useApp } from "./AppState";
import { useResortLists } from "./useResorts";

const SNOW_SOURCE = "opensnow-pistes";
const SNOW_LAYER = "opensnow-pistes";

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<VectorMap | null>(null);
  const libRef = useRef<MapLib | null>(null);
  const appliedStyle = useRef<string | null>(null);
  const pisteData = useRef<unknown>(null);
  const { share, highlightId, selectResort, t, theme, resortDays, reportMapBounds, mapApi, offline } = useApp();
  const { filtered } = useResortLists();
  const [choice, setChoice] = useState<MapProviderId | null>(null);
  const [override, setOverride] = useState<MapProviderId | null>(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [pisteNote, setPisteNote] = useState<"idle" | "loading" | "empty" | "ready">("idle");
  // Read the system theme up front so the map starts in the right style instead of swapping on boot.
  const [systemDark, setSystemDark] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const provider = override ?? choice;
  const appearance = mapAppearance(theme, systemDark);
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const darkRef = useRef(appearance === "dark");
  darkRef.current = appearance === "dark";

  const colors = useMemo(() => new Map(passes.map((pass) => [pass.id, pass.color])), []);
  const shortNames = useMemo(() => new Map(passes.map((pass) => [pass.id, passShortName(pass)])), []);
  const featureContext = useMemo<ResortFeatureContext>(
    () => ({ colorOf: (id) => colors.get(id), shortNameOf: (id) => shortNames.get(id), plannedDays: resortDays }),
    [colors, shortNames, resortDays],
  );
  const resortData = useMemo(
    () => resortFeatureCollection(filtered.filter((resort) => resort.id !== share.resort), featureContext),
    [filtered, share.resort, featureContext],
  );
  const focusData = useMemo<ResortFeatureCollection>(() => {
    const features: ResortFeature[] = [];
    const selected = share.resort ? resortById.get(share.resort) : undefined;
    const picked = selected ? resortFeature(selected, featureContext, "selected") : null;
    if (picked) features.push(picked);
    const hot = highlightId && highlightId !== share.resort ? resortById.get(highlightId) : undefined;
    const lit = hot ? resortFeature(hot, featureContext, "hot") : null;
    if (lit) features.push(lit);
    return { type: "FeatureCollection", features };
  }, [share.resort, highlightId, featureContext]);
  const dataRef = useRef({ resorts: resortData, focus: focusData });
  dataRef.current = { resorts: resortData, focus: focusData };

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
          if (!cancelled && map) {
            attachMapProbe(map);
            compactMapAttribution(map.getContainer());
            setReady(true);
          }
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
    // A diffed style swap keeps the map but silently drops our own sources and layers without
    // firing style.load. Rebuild instead, so resorts and pistes are added back.
    map.setStyle(next, { diff: false });
    map.once("idle", () => {
      map.resize();
      compactMapAttribution(map.getContainer());
    });
  }, [appearance, provider, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !provider) return;
    const install = () => installResortLayers(map, provider, appearanceRef.current, dataRef.current);
    install();
    map.on("style.load", install);
    return () => {
      map.off("style.load", install);
    };
  }, [ready, provider]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current?.getSource(RESORT_SOURCE)?.setData?.(resortData);
  }, [ready, resortData]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current?.getSource(FOCUS_SOURCE)?.setData?.(focusData);
  }, [ready, focusData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    /** False while a style swap is in flight. style.load then applies the data again. */
    const apply = (data: unknown): boolean => {
      try {
        clearPistes(map);
        if (!data) return true;
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
        return true;
      } catch {
        return false;
      }
    };
    pisteData.current = null;
    apply(null);
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
            if (apply(data)) setPisteNote("ready");
            return;
          }
          pisteData.current = null;
          setPisteNote("empty");
        })
        .catch(() => {
          if (!cancelled) setPisteNote("empty");
        });
    };
    const onStyle = () => {
      if (pisteData.current && apply(pisteData.current) && !cancelled) setPisteNote("ready");
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
      try {
        syncSnow(map, share.showPistes);
      } catch {
        // Mid style swap. style.load runs this again.
      }
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
      if (!hasMapSize(map)) return;
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
    const pisteAt = (point: { x: number; y: number }): RenderedFeature | null => {
      const layers = pisteLayerIds().filter((id) => map.getLayer(id));
      if (layers.length === 0) return null;
      try {
        return map.queryRenderedFeatures([point.x, point.y], { layers })[0] ?? null;
      } catch {
        return null;
      }
    };
    const onMove = (event: { point?: { x: number; y: number }; lngLat?: { lng: number; lat: number } }) => {
      if (!event.point || !event.lngLat) return;
      const hit = resortAt(map, event.point, 8);
      if (hit) {
        map.getCanvas().style.cursor = "pointer";
        if (hit.kind === "resort") popup.setLngLat(hit.lngLat).setText(hit.pass ? `${hit.name} · ${hit.pass}` : hit.name).addTo(map);
        else popup.remove();
        return;
      }
      const piste = pisteAt(event.point);
      if (!piste) {
        popup.remove();
        map.getCanvas().style.cursor = "";
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      showTip(piste.properties ?? null, event.lngLat);
    };
    const onClick = (event: { point?: { x: number; y: number }; lngLat?: { lng: number; lat: number }; originalEvent?: Event }) => {
      const target = event.originalEvent?.target;
      if (target instanceof Element && target.closest(".maplibregl-ctrl, .mapboxgl-ctrl, .maplibregl-popup, .mapboxgl-popup, .layers")) return;
      if (event.point) {
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        const hit = resortAt(map, event.point, coarse ? 18 : 10);
        if (hit?.kind === "resort") {
          popup.remove();
          selectResort(hit.id);
          return;
        }
        if (hit?.kind === "cluster") {
          popup.remove();
          void expandCluster(map, hit);
          return;
        }
        const piste = pisteAt(event.point);
        if (piste && event.lngLat) {
          showTip(piste.properties ?? null, event.lngLat);
          return;
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const resize = () => {
      requestAnimationFrame(() => map.resize());
    };
    resize();
    const observer = new MutationObserver(resize);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sheet", "data-panel"] });
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [ready, share.resort]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !share.resort) return;
    const resort = resorts.find((item) => item.id === share.resort);
    if (!resort) return;
    let cancelled = false;
    const fly = (duration: number) => {
      if (cancelled || !hasMapSize(map)) return;
      const narrow = window.matchMedia("(max-width: 899px)").matches;
      const height = map.getContainer().clientHeight;
      const padding = resortCameraPadding({ narrow, sheet: readSheetSnap(), height });
      flyToResort(map, resort.lon, resort.lat, { duration, padding });
      map.once("idle", () => map.resize());
    };
    const schedule = (duration: number) => {
      void whenMapIdle(map).then(() => fly(duration));
    };
    schedule(motionDuration(500));
    const observer = new MutationObserver(() => schedule(motionDuration(200)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sheet"] });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [ready, share.resort]);

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

function compactMapAttribution(container: HTMLElement): void {
  container.querySelectorAll(".maplibregl-ctrl-attrib, .mapboxgl-ctrl-attrib").forEach((el) => {
    el.classList.add("maplibregl-compact", "mapboxgl-compact");
  });
}

function clearPistes(map: VectorMap) {
  for (const id of pisteLayerIds()) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(PISTE_SOURCE_ID)) map.removeSource(PISTE_SOURCE_ID);
}

function syncSnow(map: VectorMap, show: boolean) {
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

type ResortHit =
  | { kind: "resort"; id: string; name: string; pass: string; lngLat: [number, number] }
  | { kind: "cluster"; clusterId: number; lngLat: [number, number] };

/** Nearest resort dot or cluster within `pad` pixels of the pointer. */
function resortAt(map: VectorMap, point: { x: number; y: number }, pad: number): ResortHit | null {
  const layers = RESORT_HIT_LAYERS.filter((id) => map.getLayer(id));
  if (layers.length === 0) return null;
  let features: RenderedFeature[] = [];
  try {
    features = map.queryRenderedFeatures(
      [
        [point.x - pad, point.y - pad],
        [point.x + pad, point.y + pad],
      ],
      { layers: [...layers] },
    );
  } catch {
    return null;
  }
  let best: ResortHit | null = null;
  let bestScore = Infinity;
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number") continue;
    const lngLat: [number, number] = [coords[0], coords[1]];
    const at = map.project(lngLat);
    // The selected resort sits on top, so it wins a near tie.
    const score = Math.hypot(at.x - point.x, at.y - point.y) - (feature.layer?.id === RESORT_LAYERS.focusDot ? 4 : 0);
    if (score >= bestScore) continue;
    const props = feature.properties ?? {};
    if (typeof props.cluster_id === "number") best = { kind: "cluster", clusterId: props.cluster_id, lngLat };
    else if (typeof props.id === "string") best = { kind: "resort", id: props.id, name: String(props.name ?? ""), pass: String(props.pass ?? ""), lngLat };
    else continue;
    bestScore = score;
  }
  return best;
}

async function expandCluster(map: VectorMap, hit: Extract<ResortHit, { kind: "cluster" }>): Promise<void> {
  const current = map.getZoom();
  const zoom = await clusterExpansionZoom(map.getSource(RESORT_SOURCE), hit.clusterId);
  const target = Math.min(14, Math.max(current + 1, (zoom ?? current + 2) + 0.25));
  map.easeTo({ center: hit.lngLat, zoom: target, duration: motionDuration(550) });
}

/** Adds the resort sources and layers once per style. Later updates only swap the data. */
function installResortLayers(
  map: VectorMap,
  provider: MapProviderId,
  appearance: MapAppearance,
  data: { resorts: ResortFeatureCollection; focus: ResortFeatureCollection },
): void {
  try {
    if (map.getSource(RESORT_SOURCE)) {
      map.getSource(RESORT_SOURCE)?.setData?.(data.resorts);
      map.getSource(FOCUS_SOURCE)?.setData?.(data.focus);
      return;
    }
    map.addSource(RESORT_SOURCE, {
      type: "geojson",
      data: data.resorts,
      cluster: true,
      clusterRadius: CLUSTER_RADIUS,
      clusterMaxZoom: UNCLUSTER_ZOOM - 1,
    });
    map.addSource(FOCUS_SOURCE, { type: "geojson", data: data.focus });
    for (const layer of resortLayerSpecs({ provider, appearance })) map.addLayer(layer);
  } catch (error) {
    // The style is still swapping. style.load calls this again.
    console.warn("Resort layers not ready yet", error);
  }
}


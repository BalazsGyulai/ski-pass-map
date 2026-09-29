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
import { mapboxAccess, recordMapboxUse, touchMapboxVisit } from "@/lib/map-access";
import { onMapConsentChange } from "@/lib/map-consent";
import type { MapAppearance, MapProviderId } from "@/lib/map-styles";
import {
  PISTE_SOURCE_ID,
  addLiftImages,
  boundsOfGeoJson,
  clusterExpansionZoom,
  createVectorMap,
  firstLabelLayer,
  glFitPadding,
  hasMapSize,
  loadMapLibrary,
  motionDuration,
  padLngLatBounds,
  liftCarLayers,
  liftSignLayer,
  pisteLayer,
  pisteLayerIds,
  pisteLayerSpecs,
  pisteTip,
  resortRunLayerIds,
  type MapLib,
  type RenderedFeature,
  type VectorMap,
  type VectorMarker,
} from "@/lib/vector-map";
import { attachMapProbe } from "@/lib/map-canvas-probe";
import { accuracyCircle, type GeoFix } from "@/lib/geolocate";
import { clampMapPadding, fitResortBounds, flyToResort, flyToUser, readPanelInset, readSheetVisible, resortCameraPadding, visibleBounds } from "@/lib/map-camera";
import { RESORT_PITCH, applyTerrain } from "@/lib/terrain";
import { SHEET_EVENT } from "@/lib/sheet";
import { LIFT_CARS_SOURCE, liftPaths, startLiftMotion } from "@/lib/lift-motion";
import { LIFT_KINDS, LIFT_KIND_LABEL, liftKind, type LiftKind } from "@/lib/lift-icons";
import { useApp } from "./AppState";
import { useResortLists } from "./useResorts";

const SNOW_SOURCE = "opensnow-pistes";
const SNOW_LAYER = "opensnow-pistes";
const ACCURACY_SOURCE = "user-accuracy";
const ACCURACY_LAYER = "user-accuracy";

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<VectorMap | null>(null);
  const libRef = useRef<MapLib | null>(null);
  const appliedStyle = useRef<string | null>(null);
  const pisteData = useRef<unknown>(null);
  const { share, highlightId, selectResort, t, theme, resortDays, reportMapBounds, mapApi, offline, searchThisArea, terrain3d, liftMotion, setLiftKinds, home, locationSeq, deviceFix, following, stopFollowing } =
    useApp();
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
    void resolveMapProvider({ allowed: mapboxAllowedNow() }).then((next) => {
      if (!cancelled) setChoice(next);
    });
    return () => {
      cancelled = true;
    };
  }, [choice, offline]);

  // Saying yes (or no) to Mapbox applies right away, not on the next visit.
  useEffect(
    () =>
      onMapConsentChange(() => {
        void resolveMapProvider({ allowed: mapboxAllowedNow() }).then((next) => {
          setOverride(null);
          setChoice(next);
        });
      }),
    [],
  );

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
            if (provider === "mapbox") withStorage((storage) => recordMapboxUse(storage));
            setReady(true);
          }
        });
        if (provider === "mapbox") {
          // Using the map keeps the visit open, so a long session is one visit.
          let touched = 0;
          map.on("moveend", () => {
            const now = Date.now();
            if (now - touched < 60_000) return;
            touched = now;
            withStorage((storage) => touchMapboxVisit(storage, now));
          });
        }
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

  // Relief shading always; the 3D surface and horizon when 3D is on. Style swaps drop both.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !provider) return;
    const apply = () => {
      try {
        applyTerrain(map, { provider, appearance: appearanceRef.current, threeD: terrain3d });
      } catch (error) {
        // Mid style swap. style.load runs this again.
        console.warn("Terrain not ready yet", error);
      }
    };
    apply();
    map.on("style.load", apply);
    if (!terrain3d && hasMapSize(map) && map.getPitch() > 0) map.easeTo({ pitch: 0, bearing: 0, duration: motionDuration(400) });
    return () => {
      map.off("style.load", apply);
    };
  }, [ready, provider, terrain3d]);

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
        addLiftImages(map, darkRef.current);
        map.addSource(PISTE_SOURCE_ID, { type: "geojson", data });
        map.addSource(LIFT_CARS_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        const before = firstLabelLayer(map);
        for (const layer of [...pisteLayerSpecs(darkRef.current).map(pisteLayer), ...liftCarLayers()]) {
          if (before) map.addLayer(layer, before);
          else map.addLayer(layer);
        }
        // Signs go on top, so a place name gives way to a lift sign rather than the other way round.
        map.addLayer(liftSignLayer());
        return true;
      } catch {
        return false;
      }
    };
    pisteData.current = null;
    apply(null);
    setLiftKinds([]);
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
            setLiftKinds(liftKindsIn(data));
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
  }, [ready, share.resort, share.hideRuns, setLiftKinds]);

  // Cars run along the lifts while a resort's runs are on the map and moving lifts are on.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || pisteNote !== "ready" || !liftMotion) return;
    const paths = liftPaths(pisteData.current);
    if (paths.length === 0) return;
    return startLiftMotion(map, paths);
  }, [ready, pisteNote, liftMotion]);

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
      // The compass shows tilt and turns, and a click levels the map again.
      control = new lib.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true });
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
      // Leaving the page removes the map first (the map effect cleans up before this one), and a
      // removed map has already dropped its controls. Removing again throws and takes the page down.
      if (control && mapRef.current === map) {
        try {
          map.removeControl(control);
        } catch {
          // The map is already gone.
        }
      }
    };
  }, [ready, provider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const report = () => {
      if (!hasMapSize(map)) return;
      reportMapBounds(visibleBounds(map, readPanelInset(map.getContainer())));
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

  // Picking a pass (chips or filters) frames the resorts it covers.
  const passKey = share.passes.join(",");
  // Starts empty so a link that arrives with ?passes= is framed too.
  const lastPassKey = useRef("");
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (lastPassKey.current === passKey) return;
    lastPassKey.current = passKey;
    if (share.resort || !passKey) return;
    // We moved the camera, not the visitor, so the list follows without a "Search this area" step.
    map.once("moveend", () => searchThisArea());
    mapApi.current.fitAll();
  }, [ready, passKey, share.resort, mapApi, searchThisArea]);

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
      lifts: Object.fromEntries(LIFT_KINDS.map((kind) => [kind, t(LIFT_KIND_LABEL[kind])])) as Record<LiftKind, string>,
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

  // On desktop the side panel floats over the map's left edge. The map keeps it as padding, so
  // centring, fitting and cluster zooms aim at the part you can see.
  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el || !ready) return;
    let applied = -1;
    const sync = () => {
      const inset = readPanelInset(el);
      if (inset === applied) return;
      applied = inset;
      map.setPadding({ ...map.getPadding(), left: inset });
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    const host = document.querySelector(".sheet-host");
    if (host) observer.observe(host);
    return () => observer.disconnect();
  }, [ready]);

  const terrainRef = useRef(terrain3d);
  terrainRef.current = terrain3d;
  const markerRef = useRef<VectorMarker | null>(null);
  const shownFix = useMemo<GeoFix | null>(() => {
    if (deviceFix) return deviceFix;
    if (home?.kind === "geo") return { lat: home.lat, lon: home.lon, accuracy: null, heading: null };
    return null;
  }, [deviceFix, home]);
  const shownRef = useRef(shownFix);
  shownRef.current = shownFix;
  const followedSeq = useRef(0);

  useEffect(() => {
    if (ready && shownFix) return;
    try {
      markerRef.current?.remove();
    } catch {
      // The map is already gone.
    }
    markerRef.current = null;
  }, [ready, shownFix]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !ready || !shownFix) return;
    let marker = markerRef.current;
    if (!marker) {
      const element = document.createElement("div");
      element.className = "user-location";
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", home?.label ?? "");
      const cone = document.createElement("div");
      cone.className = "user-location-heading";
      cone.hidden = true;
      const dot = document.createElement("div");
      dot.className = "user-location-dot";
      element.append(cone, dot);
      try {
        marker = new lib.Marker({ element, anchor: "center" }).setLngLat([shownFix.lon, shownFix.lat]).addTo(map);
      } catch {
        return;
      }
      markerRef.current = marker;
    }
    marker.setLngLat([shownFix.lon, shownFix.lat]);
    const cone = marker.getElement().querySelector(".user-location-heading");
    if (cone instanceof HTMLElement) {
      if (shownFix.heading == null) cone.hidden = true;
      else {
        cone.hidden = false;
        cone.style.transform = `translateX(-50%) rotate(${shownFix.heading}deg)`;
      }
    }
  }, [ready, shownFix, home?.label]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      try {
        syncAccuracy(map, shownRef.current);
      } catch {
        // The style is still swapping. style.load calls this again.
      }
    };
    apply();
    map.on("style.load", apply);
    return () => map.off("style.load", apply);
  }, [ready, shownFix]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const onDrag = () => stopFollowing();
    map.on("dragstart", onDrag);
    return () => map.off("dragstart", onDrag);
  }, [ready, stopFollowing]);

  useEffect(() => {
    const map = mapRef.current;
    const fix = shownRef.current;
    if (!map || !ready || locationSeq === 0 || !fix) return;
    const fly = () => {
      if (!hasMapSize(map)) return;
      const narrow = window.matchMedia("(max-width: 899px)").matches;
      const height = map.getContainer().clientHeight;
      const padding = resortCameraPadding({ narrow, sheetPx: readSheetVisible(), height });
      const panelPx = readPanelInset(map.getContainer());
      flyToUser(map, fix.lon, fix.lat, { duration: motionDuration(700), padding, panelPx });
    };
    const frame = requestAnimationFrame(fly);
    return () => cancelAnimationFrame(frame);
  }, [ready, locationSeq]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !following || !deviceFix || locationSeq === 0) return;
    if (followedSeq.current !== locationSeq) {
      followedSeq.current = locationSeq;
      return;
    }
    if (!hasMapSize(map)) return;
    map.easeTo({ center: [deviceFix.lon, deviceFix.lat], duration: motionDuration(450) });
  }, [ready, following, deviceFix, locationSeq]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !share.resort) return;
    const resort = resortById.get(share.resort);
    if (!resort) return;
    let cancelled = false;
    let bounds: [[number, number], [number, number]] | null = null;
    const frameCamera = (duration: number) => {
      if (cancelled || !hasMapSize(map)) return;
      const narrow = window.matchMedia("(max-width: 899px)").matches;
      const height = map.getContainer().clientHeight;
      const padding = resortCameraPadding({ narrow, sheetPx: readSheetVisible(), height });
      const panelPx = readPanelInset(map.getContainer());
      const pitch = terrainRef.current ? RESORT_PITCH : undefined;
      if (bounds) fitResortBounds(map, bounds, { duration, padding, panelPx, pitch, replacePadding: provider === "mapbox" });
      else flyToResort(map, resort.lon, resort.lat, { duration, padding, panelPx, pitch });
    };
    // Move at once. If the runs arrive, they replace this with a frame of this resort.
    const frame = requestAnimationFrame(() => {
      if (!bounds) frameCamera(motionDuration(700));
    });
    void fetch(`${BASE_PATH}/pistes/${resort.id}.geojson`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        // A 0.02° pad is about 2 km, so a small hill never reached the close zoom.
        const next = boundsOfGeoJson(data, { ratio: 0.08, minPad: 0.0012 });
        if (!next) return;
        bounds = next;
        frameCamera(motionDuration(700));
      })
      .catch(() => {});
    // When the sheet settles at another height, keep the resort in the visible part of the map.
    const onSheet = () => frameCamera(motionDuration(320));
    window.addEventListener(SHEET_EVENT, onSheet);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener(SHEET_EVENT, onSheet);
    };
  }, [ready, share.resort, provider]);

  // Closing a resort levels the camera again for the overview.
  const hadResort = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    const open = Boolean(share.resort);
    const closed = hadResort.current && !open;
    hadResort.current = open;
    if (!map || !ready || !closed || !hasMapSize(map)) return;
    if (map.getPitch() > 0 || map.getBearing() !== 0) map.easeTo({ pitch: 0, bearing: 0, duration: motionDuration(500) });
  }, [ready, share.resort]);

  return (
    <div className="map-root" data-map-provider={provider ?? "pending"} data-terrain={terrain3d ? "3d" : "flat"}>
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

function withStorage(run: (storage: Storage) => void): void {
  try {
    run(window.localStorage);
  } catch {
    // Storage blocked (private mode): the visit just is not remembered.
  }
}

/** Free visits left or a supporter period running. Blocked storage counts as a first visit. */
function mapboxAllowedNow(): boolean {
  try {
    return mapboxAccess(window.localStorage).allowed;
  } catch {
    return true;
  }
}

function compactMapAttribution(container: HTMLElement): void {
  container.querySelectorAll(".maplibregl-ctrl-attrib, .mapboxgl-ctrl-attrib").forEach((el) => {
    el.classList.add("maplibregl-compact", "mapboxgl-compact");
  });
}

function clearPistes(map: VectorMap) {
  for (const id of resortRunLayerIds()) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(LIFT_CARS_SOURCE)) map.removeSource(LIFT_CARS_SOURCE);
  if (map.getSource(PISTE_SOURCE_ID)) map.removeSource(PISTE_SOURCE_ID);
}

/** Lift types in a resort's piste data, in legend order. */
function liftKindsIn(data: { features?: unknown[] }): LiftKind[] {
  const found = new Set<LiftKind>();
  for (const feature of data.features ?? []) {
    const properties = (feature as { properties?: Record<string, unknown> | null }).properties;
    if (properties?.kind !== "lift") continue;
    found.add(liftKind(typeof properties.aerialway === "string" ? properties.aerialway : null));
  }
  return LIFT_KINDS.filter((kind) => found.has(kind));
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
  const narrow = window.matchMedia("(max-width: 899px)").matches;
  const height = map.getContainer().clientHeight;
  const panelPx = readPanelInset(map.getContainer());
  const padding = clampMapPadding(map, resortCameraPadding({ narrow, sheetPx: readSheetVisible(), height }), panelPx);
  map.easeTo({ center: hit.lngLat, zoom: target, padding, duration: motionDuration(550) });
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

function syncAccuracy(map: VectorMap, fix: GeoFix | null): void {
  const ring = fix?.accuracy != null && fix.accuracy > 0 ? accuracyCircle(fix.lon, fix.lat, fix.accuracy) : null;
  const data = ring
    ? { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} }
    : { type: "FeatureCollection", features: [] };
  const existing = map.getSource(ACCURACY_SOURCE);
  if (existing?.setData) {
    existing.setData(data);
    return;
  }
  if (!ring) return;
  map.addSource(ACCURACY_SOURCE, { type: "geojson", data });
  const layer = {
    id: ACCURACY_LAYER,
    type: "fill",
    source: ACCURACY_SOURCE,
    paint: { "fill-color": "#2563eb", "fill-opacity": 0.18 },
  };
  const before = map.getLayer(RESORT_LAYERS.dot) ? RESORT_LAYERS.dot : undefined;
  if (before) map.addLayer(layer, before);
  else map.addLayer(layer);
}


"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { boundsMoved, type MapBounds } from "@/lib/bounds";
import { countActiveFilters } from "@/lib/filter";
import type { Lang } from "@/i18n/languages";
import { isLang, persistLangChoice } from "@/i18n/languages";
import { isMapPath } from "@/i18n/routing";
import { translate, type MessageKey, type Messages } from "@/lib/i18n";
import { GEO_PLACE_ID, dropDevicePlaces, followDeviceLocation, isDevicePlaceId, shouldStoreFix, upsertDevicePlace, watchGeoPermission, type GeoFailure, type GeoFix } from "@/lib/geolocate";
import { cityPlaceId, sanitizeActivePlaceId, sanitizePlaces, type ReferenceCity, type SavedPlace } from "@/lib/places";
import type { DistanceUnits, ExportedUserData } from "@/lib/storage";
import { readStorage, writeStorage } from "@/lib/storage";
import { todayISO } from "@/lib/format";
import { shareHistoryStep } from "@/lib/history-step";
import { bareResortUrl, defaultShareState, parsePlan, parseShareState, serializePlan, serializeShareState, shareableSearch, type ShareState } from "@/lib/url-state";
import { markFirstVisitDone, resetSupportReminders as clearSupportReminders } from "@/lib/support/storage";
import { defaultTerrain3d } from "@/lib/terrain";
import type { LiftKind } from "@/lib/lift-icons";

type ThemeChoice = "system" | "light" | "dark";

interface HomePoint {
  lat: number;
  lon: number;
  label: string;
  kind: SavedPlace["kind"];
}

interface AppContextValue {
  share: ShareState;
  updateShare: (patch: Partial<ShareState>) => void;
  resetFilters: () => void;
  selectResort: (id: string | null) => void;
  activeFilterCount: number;
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
  favourites: string[];
  toggleFavourite: (id: string) => void;
  birthYear: number | null;
  setBirthYear: (year: number | null) => void;
  places: SavedPlace[];
  activePlaceId: string | null;
  saveCity: (city: ReferenceCity) => void;
  activatePlace: (id: string) => void;
  removePlace: (id: string) => void;
  purchaseDate: string | null;
  setPurchaseDate: (date: string | null) => void;
  today: string | null;
  effectiveDate: string | null;
  resortDays: Record<string, number>;
  setResortDaysCount: (id: string, days: number) => void;
  replaceResortDays: (days: Record<string, number>) => void;
  clearResortDays: () => void;
  highlightId: string | null;
  setHighlightId: (id: string | null) => void;
  geoError: GeoFailure | null;
  locating: boolean;
  locate: () => void;
  /** Increments each time the visitor asks for a device fix, so the map flies only then. */
  locationSeq: number;
  /** Live reading while the watch is open. The saved place stays a single point. */
  deviceFix: GeoFix | null;
  /** The camera eases with the dot until a drag or an open resort. */
  following: boolean;
  stopFollowing: () => void;
  home: HomePoint | null;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  messages: Messages;
  lang: Lang;
  pathname: string;
  search: string;
  ready: boolean;
  offline: boolean;
  copyMessage: string | null;
  copyLink: () => void;
  areaBounds: MapBounds | null;
  areaStale: boolean;
  reportMapBounds: (bounds: MapBounds) => void;
  searchThisArea: () => void;
  searchAsMove: boolean;
  setSearchAsMove: (on: boolean) => void;
  mapApi: React.MutableRefObject<SkiMapApi>;
  supportPromptSignal: number;
  bumpSupportPrompt: () => void;
  resetSupportReminders: () => void;
  openCookieSettings: () => void;
  distanceUnits: DistanceUnits;
  setDistanceUnits: (units: DistanceUnits) => void;
  pisteOverlayDefault: boolean;
  setPisteOverlayDefault: (on: boolean) => void;
  terrain3d: boolean;
  setTerrain3d: (on: boolean) => void;
  /** Cars run along the lifts. The lift signs show either way. */
  liftMotion: boolean;
  setLiftMotion: (on: boolean) => void;
  /** Lift types on the map for the open resort, for its legend. */
  liftKinds: LiftKind[];
  setLiftKinds: (kinds: LiftKind[]) => void;
  exportSavedData: () => boolean;
  importSavedData: (json: string) => boolean;
  clearAllSavedData: () => void;
  toast: string | null;
  showToast: (message: string) => void;
}

export interface SkiMapApi {
  zoomOut: () => void;
  fitAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ lang, messages, children }: { lang: Lang; messages: Messages; children: React.ReactNode }) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [share, setShare] = useState<ShareState>(defaultShareState);
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [birthYear, setBirthYearState] = useState<number | null>(null);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [resortDays, setResortDays] = useState<Record<string, number>>({});
  const [today, setToday] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<GeoFailure | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationSeq, setLocationSeq] = useState(0);
  const [deviceFix, setDeviceFix] = useState<GeoFix | null>(null);
  const [following, setFollowing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [areaBounds, setAreaBounds] = useState<MapBounds | null>(null);
  const [areaStale, setAreaStale] = useState(false);
  const [searchAsMove, setSearchAsMoveState] = useState(false);
  const [distanceUnits, setDistanceUnitsState] = useState<DistanceUnits>("km");
  const [pisteOverlayDefault, setPisteOverlayDefaultState] = useState(false);
  const [terrain3d, setTerrain3d] = useState(true);
  const [liftMotion, setLiftMotion] = useState(true);
  const [liftKinds, setLiftKinds] = useState<LiftKind[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const areaRef = useRef<MapBounds | null>(null);
  const liveRef = useRef<MapBounds | null>(null);
  const moveRef = useRef(false);
  const mapApi = useRef<SkiMapApi>({
    zoomOut() {},
    fitAll() {},
  });
  const watchStop = useRef<(() => void) | null>(null);
  const storedFix = useRef<{ lat: number; lon: number; at: number } | null>(null);
  const [supportPromptSignal, setSupportPromptSignal] = useState(0);
  const resortForPrompt = useRef<string | null>(null);

  const bumpSupportPrompt = useCallback(() => {
    setSupportPromptSignal((n) => n + 1);
  }, []);

  const resetSupportReminders = useCallback(() => {
    if (typeof window !== "undefined") clearSupportReminders(window.localStorage);
  }, []);

  function openCookieSettings() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("skimap-open-cookie-settings"));
    }
  }

  useEffect(() => {
    if (!ready) return;
    const id = share.resort;
    if (resortForPrompt.current && !id) {
      markFirstVisitDone(window.localStorage);
      bumpSupportPrompt();
    }
    resortForPrompt.current = id;
  }, [share.resort, ready, bumpSupportPrompt]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsed = parseShareState(params);
    const stored = readStorage();
    if (stored) {
      if (stored.lang && isLang(stored.lang)) {
        persistLangChoice(stored.lang);
      }
      const savedPlaces = sanitizePlaces(stored.places);
      setPlaces(savedPlaces);
      setActivePlaceId(sanitizeActivePlaceId(stored.activePlaceId, savedPlaces));
      if (stored.theme === "light" || stored.theme === "dark" || stored.theme === "system") setTheme(stored.theme);
      if (Array.isArray(stored.favourites)) setFavourites(stored.favourites.filter((id) => typeof id === "string"));
      if (typeof stored.birthYear === "number") setBirthYearState(stored.birthYear);
      if (typeof stored.purchaseDate === "string") setPurchaseDate(stored.purchaseDate);
      if (stored.resortDays && typeof stored.resortDays === "object") {
        const days: Record<string, number> = {};
        for (const [id, value] of Object.entries(stored.resortDays)) {
          if (typeof value === "number" && value > 0) days[id] = Math.min(80, Math.round(value));
        }
        setResortDays(days);
      }
      if (stored.distanceUnits === "km" || stored.distanceUnits === "mi") setDistanceUnitsState(stored.distanceUnits);
      if (stored.pisteOverlayDefault) setPisteOverlayDefaultState(true);
      if (stored.terrain3d === false) setTerrain3d(false);
      if (stored.liftMotion === false) setLiftMotion(false);
    }
    if (stored?.terrain3d == null && !defaultTerrain3d(deviceHints())) setTerrain3d(false);
    // Moving lifts start off for visitors who ask for less motion, until they turn them on.
    if (stored?.liftMotion == null && window.matchMedia("(prefers-reduced-motion: reduce)").matches) setLiftMotion(false);
    const fromUrl = parsePlan(params.get("plan"));
    if (Object.keys(fromUrl).length > 0) setResortDays(fromUrl);
    const bought = params.get("on");
    if (bought && /^\d{4}-\d{2}-\d{2}$/.test(bought)) setPurchaseDate(bought);
    setToday(todayISO());
    const initialShare =
      stored?.pisteOverlayDefault && !params.get("pistes") ? { ...parsed, showPistes: true } : parsed;
    setShare(initialShare);
    setReady(true);
  }, []);

  // Transitions switch on only after the stored settings have been painted, so a switch or a
  // theme that differs from the default does not animate into place on every page load.
  useEffect(() => {
    if (!ready) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        document.documentElement.dataset.ready = "true";
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = lang;
    persistLangChoice(lang);
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [ready, lang, theme]);

  useEffect(() => {
    if (!ready) return;
    writeStorage({
      theme,
      favourites,
      birthYear,
      purchaseDate,
      resortDays,
      places,
      activePlaceId,
      distanceUnits,
      pisteOverlayDefault,
      terrain3d,
      liftMotion,
      version: 4,
    });
  }, [ready, theme, favourites, birthYear, purchaseDate, resortDays, places, activePlaceId, distanceUnits, pisteOverlayDefault, terrain3d, liftMotion]);

  const onMap = isMapPath(pathname, lang);
  const pushedResort = useRef(false);
  const prevResort = useRef<string | null | undefined>(undefined);
  const rememberedBare = useRef<string | null>(null);
  const rewinding = useRef(false);
  const pendingBare = useRef<string | null>(null);
  const pendingResortUrl = useRef<string | null>(null);

  useEffect(() => {
    function onPop() {
      if (!onMap) return;
      if (rewinding.current) {
        rewinding.current = false;
        const bare = pendingBare.current ?? `${window.location.pathname}${window.location.search}`;
        const resortUrl = pendingResortUrl.current;
        pendingBare.current = null;
        pendingResortUrl.current = null;
        window.history.replaceState(null, "", bare);
        rememberedBare.current = bare;
        if (resortUrl) {
          window.history.pushState({ skiResort: true }, "", resortUrl);
          pushedResort.current = true;
          return;
        }
        pushedResort.current = false;
        prevResort.current = null;
        setShare((current) => ({ ...current, resort: null }));
        return;
      }
      const parsed = parseShareState(new URLSearchParams(window.location.search));
      prevResort.current = parsed.resort;
      pushedResort.current = Boolean(window.history.state && (window.history.state as { skiResort?: boolean }).skiResort);
      if (!parsed.resort) rememberedBare.current = `${window.location.pathname}${window.location.search}`;
      setShare(parsed);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onMap]);

  const wasOnMap = useRef(onMap);
  useEffect(() => {
    if (!ready) return;
    // Links from other pages (Open on map, a saved resort) arrive with their own query. The state
    // lives in the layout and outlives the page, so read that query instead of overwriting it.
    const entering = onMap && !wasOnMap.current;
    wasOnMap.current = onMap;
    if (entering && window.location.search.length > 1) {
      const incoming = parseShareState(new URLSearchParams(window.location.search));
      if (serializeShareState(incoming) !== serializeShareState(share)) {
        setShare(incoming);
        return;
      }
    }
    const path = window.location.pathname;
    let next = path;
    if (onMap) {
      const qs = serializeShareState(share);
      next = qs ? `${path}?${qs}` : path;
    } else {
      const params = shareableSearch(new URLSearchParams(window.location.search));
      const plan = serializePlan(resortDays);
      if (plan) params.set("plan", plan);
      else params.delete("plan");
      if (purchaseDate) params.set("on", purchaseDate);
      else params.delete("on");
      const qs = params.toString();
      next = qs ? `${path}?${qs}` : path;
    }
    const current = `${path}${window.location.search}`;
    const previous = prevResort.current;
    prevResort.current = onMap ? share.resort : previous;
    const bare = bareResortUrl(path, share);
    const step = shareHistoryStep({
      onMap,
      next,
      current,
      previousResort: previous,
      resort: share.resort,
      pushed: pushedResort.current,
      historyFlag: Boolean((window.history.state as { skiResort?: boolean } | null)?.skiResort),
      bare,
      rememberedBare: rememberedBare.current,
    });

    if (step.type === "noop") {
      if (!share.resort) rememberedBare.current = next;
      return;
    }
    if (step.type === "seed" || step.type === "push") {
      rememberedBare.current = step.bare;
      if (step.bare !== current) window.history.replaceState(null, "", step.bare);
      window.history.pushState({ skiResort: true }, "", step.resortUrl);
      pushedResort.current = true;
      return;
    }
    if (step.type === "sync-under") {
      rememberedBare.current = step.bare;
      pendingBare.current = step.bare;
      pendingResortUrl.current = step.resortUrl;
      if (!rewinding.current) {
        rewinding.current = true;
        window.history.back();
      }
      return;
    }
    window.history.replaceState(null, "", step.url);
    if (!share.resort) rememberedBare.current = step.url;
    setSearch(window.location.search.replace(/^\?/, ""));
  }, [ready, onMap, share, resortDays, purchaseDate]);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(messages, key, vars),
    [messages],
  );
  const home = useMemo(() => homePoint(places, activePlaceId), [places, activePlaceId]);
  const effectiveDate = purchaseDate ?? today;
  const activeFilterCount = countActiveFilters(share);

  const updateShare = useCallback((patch: Partial<ShareState>) => {
    setShare((current) => ({ ...current, ...patch }));
  }, []);

  function resetFilters() {
    updateShare({
      q: "",
      passes: [],
      passMatch: "any",
      noPass: false,
      regions: [],
      transit: false,
      park: false,
      night: false,
      minElev: null,
      minSlope: null,
      maxKm: null,
      favouritesOnly: false,
      showAbandoned: false,
      maxPassPrice: null,
    });
  }

  const selectResort = useCallback((id: string | null) => {
    if (id == null && pushedResort.current) {
      pushedResort.current = false;
      if (rewinding.current) {
        pendingResortUrl.current = null;
        return;
      }
      window.history.back();
      return;
    }
    const narrow = window.matchMedia("(max-width: 899px)").matches;
    setShare((current) => ({ ...current, resort: id, ...(id && narrow ? { view: "map" as const } : {}) }));
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  function toggleFavourite(id: string) {
    setFavourites((current) => {
      const adding = !current.includes(id);
      const next = adding ? [...current, id] : current.filter((item) => item !== id);
      if (adding) showToast(translate(messages, "toastSaved"));
      return next;
    });
  }

  function setDistanceUnits(units: DistanceUnits) {
    setDistanceUnitsState(units);
  }

  function setPisteOverlayDefault(on: boolean) {
    setPisteOverlayDefaultState(on);
  }

  function exportSavedData(): boolean {
    if (typeof window === "undefined") return false;
    const payload: ExportedUserData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      favourites,
      resortDays,
      places,
      activePlaceId,
      birthYear,
      purchaseDate,
      theme,
      distanceUnits,
      pisteOverlayDefault,
      terrain3d,
      liftMotion,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "skimap-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  }

  function importSavedData(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as Partial<ExportedUserData>;
      if (!parsed || parsed.version !== 1) return false;
      if (Array.isArray(parsed.favourites)) setFavourites(parsed.favourites.filter((id) => typeof id === "string"));
      if (parsed.resortDays && typeof parsed.resortDays === "object") setResortDays(parsed.resortDays);
      if (Array.isArray(parsed.places)) {
        // A running watch would put the device place back over the imported ones within seconds.
        clearDeviceLocation();
        const savedPlaces = sanitizePlaces(parsed.places);
        setPlaces(savedPlaces);
        setActivePlaceId(sanitizeActivePlaceId(parsed.activePlaceId ?? null, savedPlaces));
      }
      if (typeof parsed.birthYear === "number" || parsed.birthYear === null) setBirthYearState(parsed.birthYear ?? null);
      if (typeof parsed.purchaseDate === "string" || parsed.purchaseDate === null) setPurchaseDate(parsed.purchaseDate ?? null);
      if (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system") setTheme(parsed.theme);
      if (parsed.distanceUnits === "km" || parsed.distanceUnits === "mi") setDistanceUnitsState(parsed.distanceUnits);
      if (typeof parsed.pisteOverlayDefault === "boolean") {
        setPisteOverlayDefaultState(parsed.pisteOverlayDefault);
        if (parsed.pisteOverlayDefault) setShare((current) => ({ ...current, showPistes: true }));
      }
      if (typeof parsed.terrain3d === "boolean") setTerrain3d(parsed.terrain3d);
      if (typeof parsed.liftMotion === "boolean") setLiftMotion(parsed.liftMotion);
      return true;
    } catch {
      return false;
    }
  }

  function clearAllSavedData() {
    // Stop the watch first, or the next fix saves the location again.
    clearDeviceLocation();
    setFavourites([]);
    setResortDays({});
    setPlaces([]);
    setActivePlaceId(null);
    setBirthYearState(null);
    setPurchaseDate(null);
  }

  function setResortDaysCount(id: string, days: number) {
    setResortDays((current) => {
      const next = { ...current };
      const clamped = Math.max(0, Math.min(80, Math.round(days)));
      if (clamped <= 0) delete next[id];
      else next[id] = clamped;
      return next;
    });
  }

  function setBirthYear(year: number | null) {
    if (year == null || !Number.isInteger(year)) {
      setBirthYearState(null);
      return;
    }
    setBirthYearState(Math.min(2026, Math.max(1920, year)));
  }

  function saveCity(city: ReferenceCity) {
    const id = cityPlaceId(city.id);
    setPlaces((current) => {
      const next = current.filter((place) => place.id !== id);
      next.push({ id, label: city.name, lat: city.lat, lon: city.lon, kind: "city" });
      return next.slice(-12);
    });
    setActivePlaceId(id);
  }

  function activatePlace(id: string) {
    setActivePlaceId(id);
  }

  function removePlace(id: string) {
    // Removing the device place turns location off. A running watch would save it again.
    if (isDevicePlaceId(id)) {
      clearDeviceLocation();
      return;
    }
    setPlaces((current) => current.filter((place) => place.id !== id));
    setActivePlaceId((current) => (current === id ? null : current));
  }

  const clearDeviceLocation = useCallback(() => {
    watchStop.current?.();
    watchStop.current = null;
    storedFix.current = null;
    // A stopped watch never reports back, so a pending request must not stay "Locating…".
    setLocating(false);
    setFollowing(false);
    setDeviceFix(null);
    setPlaces((current) => dropDevicePlaces(current));
    setActivePlaceId((current) => (isDevicePlaceId(current) ? null : current));
  }, []);

  const stopFollowing = useCallback(() => setFollowing(false), []);

  useEffect(() => () => watchStop.current?.(), []);

  useEffect(() => {
    if (share.resort) setFollowing(false);
  }, [share.resort]);

  // The first reading is whatever the browser already decided. A later Block removes the dot.
  useEffect(() => {
    let saw = false;
    return watchGeoPermission(navigator.permissions, (state) => {
      const first = !saw;
      saw = true;
      if (state !== "denied") return;
      clearDeviceLocation();
      if (!first) setGeoError("denied");
    });
  }, [clearDeviceLocation]);

  useEffect(() => {
    if (!geoError) return;
    const timer = window.setTimeout(() => setGeoError(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [geoError]);

  function locate() {
    if (!navigator.geolocation) {
      setGeoError("unsupported");
      return;
    }
    watchStop.current?.();
    setLocating(true);
    setGeoError(null);
    let jumped = false;
    const label = translate(messages, "myLocation");
    watchStop.current = followDeviceLocation(navigator.geolocation, { permissions: navigator.permissions }, {
      onFix(fix) {
        const jump = !jumped;
        jumped = true;
        setLocating(false);
        setGeoError(null);
        setDeviceFix(fix);
        const now = Date.now();
        if (shouldStoreFix(storedFix.current, fix, now)) {
          storedFix.current = { lat: fix.lat, lon: fix.lon, at: now };
          const place: SavedPlace = { id: GEO_PLACE_ID, label, lat: fix.lat, lon: fix.lon, kind: "geo" };
          setPlaces((current) => upsertDevicePlace(current, place));
          setActivePlaceId(GEO_PLACE_ID);
        }
        if (jump) {
          setFollowing(true);
          setLocationSeq((current) => current + 1);
        }
      },
      onError(error) {
        setLocating(false);
        setGeoError(error.reason);
        if (error.reason === "denied") clearDeviceLocation();
      },
    });
  }

  const reportMapBounds = useCallback((bounds: MapBounds) => {
    liveRef.current = bounds;
    if (!areaRef.current || moveRef.current || !boundsMoved(areaRef.current, bounds)) {
      if (!areaRef.current || moveRef.current) {
        areaRef.current = bounds;
        setAreaBounds(bounds);
        setAreaStale(false);
      }
      return;
    }
    setAreaStale(true);
  }, []);

  const searchThisArea = useCallback(() => {
    if (!liveRef.current) return;
    areaRef.current = liveRef.current;
    setAreaBounds(liveRef.current);
    setAreaStale(false);
  }, []);

  const setSearchAsMove = useCallback((on: boolean) => {
    moveRef.current = on;
    setSearchAsMoveState(on);
    if (on && liveRef.current) {
      areaRef.current = liveRef.current;
      setAreaBounds(liveRef.current);
      setAreaStale(false);
    }
  }, []);

  function copyLink() {
    const url = shareableHref(window.location.href);
    const done = (ok: boolean) => {
      setCopyMessage(translate(messages, ok ? "copied" : "copyFailed"));
      window.setTimeout(() => setCopyMessage(null), 2200);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => done(true)).catch(() => done(false));
      return;
    }
    done(false);
  }

  const value: AppContextValue = {
    share,
    updateShare,
    resetFilters,
    selectResort,
    activeFilterCount,
    theme,
    setTheme,
    favourites,
    toggleFavourite,
    birthYear,
    setBirthYear,
    places,
    activePlaceId,
    saveCity,
    activatePlace,
    removePlace,
    purchaseDate,
    setPurchaseDate,
    today,
    effectiveDate,
    resortDays,
    setResortDaysCount,
    replaceResortDays: setResortDays,
    clearResortDays: () => setResortDays({}),
    highlightId,
    setHighlightId,
    geoError,
    locating,
    locate,
    locationSeq,
    deviceFix,
    following,
    stopFollowing,
    home,
    t,
    messages,
    lang,
    pathname,
    search,
    ready,
    offline,
    copyMessage,
    copyLink,
    areaBounds,
    areaStale,
    reportMapBounds,
    searchThisArea,
    searchAsMove,
    setSearchAsMove,
    mapApi,
    supportPromptSignal,
    bumpSupportPrompt,
    resetSupportReminders,
    openCookieSettings,
    distanceUnits,
    setDistanceUnits,
    pisteOverlayDefault,
    setPisteOverlayDefault,
    terrain3d,
    setTerrain3d,
    liftMotion,
    setLiftMotion,
    liftKinds,
    setLiftKinds,
    exportSavedData,
    importSavedData,
    clearAllSavedData,
    toast,
    showToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

function homePoint(places: SavedPlace[], activePlaceId: string | null): HomePoint | null {
  const place = places.find((item) => item.id === activePlaceId);
  if (!place) return null;
  return { lat: place.lat, lon: place.lon, label: place.label, kind: place.kind };
}

function shareableHref(href: string): string {
  const url = new URL(href);
  const params = shareableSearch(url.searchParams);
  const qs = params.toString();
  return `${url.origin}${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
}

/** What the browser says about memory and data saving, for the 3D default. */
function deviceHints(): { deviceMemory?: number; saveData?: boolean; reducedData?: boolean } {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData === true,
    reducedData: window.matchMedia("(prefers-reduced-data: reduce)").matches,
  };
}

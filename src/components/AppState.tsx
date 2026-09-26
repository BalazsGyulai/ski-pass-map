"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { boundsMoved, type MapBounds } from "@/lib/bounds";
import { countActiveFilters } from "@/lib/filter";
import type { Lang } from "@/i18n/languages";
import { isLang, persistLangChoice } from "@/i18n/languages";
import { isMapPath } from "@/i18n/routing";
import { translate, type MessageKey, type Messages } from "@/lib/i18n";
import { cityPlaceId, sanitizeActivePlaceId, sanitizePlaces, type ReferenceCity, type SavedPlace } from "@/lib/places";
import { readStorage, writeStorage } from "@/lib/storage";
import { todayISO } from "@/lib/format";
import { shareHistoryStep } from "@/lib/history-step";
import { bareResortUrl, defaultShareState, parsePlan, parseShareState, serializePlan, serializeShareState, shareableSearch, type ShareState } from "@/lib/url-state";

type ThemeChoice = "system" | "light" | "dark";

interface HomePoint {
  lat: number;
  lon: number;
  label: string;
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
  geoError: "denied" | "unsupported" | null;
  locating: boolean;
  locate: () => void;
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
  const [geoError, setGeoError] = useState<"denied" | "unsupported" | null>(null);
  const [locating, setLocating] = useState(false);
  const [offline, setOffline] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [areaBounds, setAreaBounds] = useState<MapBounds | null>(null);
  const [areaStale, setAreaStale] = useState(false);
  const [searchAsMove, setSearchAsMoveState] = useState(false);
  const areaRef = useRef<MapBounds | null>(null);
  const liveRef = useRef<MapBounds | null>(null);
  const moveRef = useRef(false);
  const mapApi = useRef<SkiMapApi>({
    zoomOut() {},
    fitAll() {},
  });

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
    }
    const fromUrl = parsePlan(params.get("plan"));
    if (Object.keys(fromUrl).length > 0) setResortDays(fromUrl);
    const bought = params.get("on");
    if (bought && /^\d{4}-\d{2}-\d{2}$/.test(bought)) setPurchaseDate(bought);
    setToday(todayISO());
    setShare(parsed);
    setReady(true);
  }, []);

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
      version: 3,
    });
  }, [ready, theme, favourites, birthYear, purchaseDate, resortDays, places, activePlaceId]);

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

  useEffect(() => {
    if (!ready) return;
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

  function toggleFavourite(id: string) {
    setFavourites((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
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
    setPlaces((current) => current.filter((place) => place.id !== id));
    setActivePlaceId((current) => (current === id ? null : current));
  }

  function locate() {
    if (!navigator.geolocation) {
      setGeoError("unsupported");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setGeoError(null);
        const id = `geo-${Date.now().toString(36)}`;
        const place: SavedPlace = {
          id,
          label: translate(messages, "myLocation"),
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          kind: "geo",
        };
        setPlaces((current) => [...current, place].slice(-12));
        setActivePlaceId(id);
      },
      () => {
        setLocating(false);
        setGeoError("denied");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
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
  return { lat: place.lat, lon: place.lon, label: place.label };
}

function shareableHref(href: string): string {
  const url = new URL(href);
  const params = shareableSearch(url.searchParams);
  const qs = params.toString();
  return `${url.origin}${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
}

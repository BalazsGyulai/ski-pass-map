"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cities } from "@/lib/data";
import { countActiveFilters } from "@/lib/filter";
import { translate, type MessageKey } from "@/lib/i18n";
import { readStorage, writeStorage } from "@/lib/storage";
import { todayISO } from "@/lib/format";
import { defaultShareState, parseShareState, serializeShareState, type Lang, type ShareState } from "@/lib/url-state";

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
  lang: Lang;
  ready: boolean;
  offline: boolean;
  copyMessage: string | null;
  copyLink: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [share, setShare] = useState<ShareState>(defaultShareState);
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [resortDays, setResortDays] = useState<Record<string, number>>({});
  const [today, setToday] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<"denied" | "unsupported" | null>(null);
  const [locating, setLocating] = useState(false);
  const [offline, setOffline] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsed = parseShareState(params);
    const stored = readStorage();
    if (stored) {
      if (!params.has("lang") && (stored.lang === "en" || stored.lang === "hu")) parsed.lang = stored.lang;
      if (!params.has("home") && stored.home) {
        parsed.home = stored.home;
        parsed.geoLat = stored.geoLat ?? null;
        parsed.geoLon = stored.geoLon ?? null;
      }
      if (stored.theme === "light" || stored.theme === "dark" || stored.theme === "system") setTheme(stored.theme);
      if (Array.isArray(stored.favourites)) setFavourites(stored.favourites.filter((id) => typeof id === "string"));
      if (typeof stored.birthYear === "number") setBirthYear(stored.birthYear);
      if (typeof stored.purchaseDate === "string") setPurchaseDate(stored.purchaseDate);
      if (stored.resortDays && typeof stored.resortDays === "object") {
        const days: Record<string, number> = {};
        for (const [id, value] of Object.entries(stored.resortDays)) {
          if (typeof value === "number" && value > 0) days[id] = Math.min(80, Math.round(value));
        }
        setResortDays(days);
      }
    }
    setToday(todayISO());
    setShare(parsed);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = share.lang;
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [ready, share.lang, theme]);

  useEffect(() => {
    if (!ready) return;
    writeStorage({
      theme,
      favourites,
      birthYear,
      purchaseDate,
      resortDays,
      home: share.home,
      geoLat: share.geoLat,
      geoLon: share.geoLon,
      lang: share.lang,
    });
  }, [ready, theme, favourites, birthYear, purchaseDate, resortDays, share.home, share.geoLat, share.geoLon, share.lang]);

  const onMap = pathname === "/";

  useEffect(() => {
    if (!ready) return;
    const path = window.location.pathname;
    let next = path;
    if (onMap) {
      const qs = serializeShareState(share);
      next = qs ? `${path}?${qs}` : path;
    } else {
      const params = new URLSearchParams(window.location.search);
      if (share.lang === "en") params.delete("lang");
      else params.set("lang", share.lang);
      params.delete("lat");
      params.delete("lon");
      if (share.home === "geo" && share.geoLat != null && share.geoLon != null) {
        params.set("home", "geo");
        params.set("lat", share.geoLat.toFixed(5));
        params.set("lon", share.geoLon.toFixed(5));
      } else if (share.home !== "sopron") {
        params.set("home", share.home);
      } else {
        params.delete("home");
      }
      const qs = params.toString();
      next = qs ? `${path}?${qs}` : path;
    }
    const current = `${path}${window.location.search}`;
    if (next !== current) window.history.replaceState(null, "", next);
  }, [ready, onMap, share]);

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
    (key: MessageKey, vars?: Record<string, string | number>) => translate(share.lang, key, vars),
    [share.lang],
  );
  const home = useMemo(() => homePoint(share), [share]);
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
      klima: false,
      park: false,
      night: false,
      minElev: null,
      minSlope: null,
      maxKm: null,
      favouritesOnly: false,
      showClosed: false,
    });
  }

  const selectResort = useCallback((id: string | null) => {
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
        updateShare({
          home: "geo",
          geoLat: position.coords.latitude,
          geoLon: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setGeoError("denied");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  function copyLink() {
    const url = window.location.href;
    const done = (ok: boolean) => {
      setCopyMessage(translate(share.lang, ok ? "copied" : "copyFailed"));
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
    lang: share.lang,
    ready,
    offline,
    copyMessage,
    copyLink,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

function homePoint(share: ShareState): HomePoint | null {
  if (share.home === "geo") {
    if (share.geoLat == null || share.geoLon == null) return null;
    return { lat: share.geoLat, lon: share.geoLon, label: "geo" };
  }
  const city = cities.find((item) => item.id === share.home) ?? cities[0];
  if (!city) return null;
  return { lat: city.lat, lon: city.lon, label: city.name };
}

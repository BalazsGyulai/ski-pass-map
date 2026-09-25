"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cities } from "@/lib/data";
import { countActiveFilters } from "@/lib/filter";
import { translate, type MessageKey } from "@/lib/i18n";
import { readStorage, writeStorage } from "@/lib/storage";
import { todayISO } from "@/lib/format";
import { shareHistoryStep } from "@/lib/history-step";
import { bareResortUrl, defaultShareState, parseShareState, serializeShareState, shareableSearch, type Lang, type ShareState } from "@/lib/url-state";

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
      if (!params.has("home") && stored.home && !removedHome(stored.home)) {
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
      const params = shareableSearch(new URLSearchParams(window.location.search), share);
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
    const url = shareableHref(window.location.href);
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
  const city = cities.find((item) => item.id === share.home);
  if (!city) return null;
  return { lat: city.lat, lon: city.lon, label: city.name };
}

const retiredHomes = new Set(["sopron", "graz", "wiener-neustadt"]);

function removedHome(id: string): boolean {
  return retiredHomes.has(id);
}

function shareableHref(href: string): string {
  const url = new URL(href);
  const params = shareableSearch(url.searchParams);
  const qs = params.toString();
  return `${url.origin}${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
}

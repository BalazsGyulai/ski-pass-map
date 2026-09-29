"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LANGS, LANG_NATIVE } from "@/i18n/languages";
import { langPath, switchLangHref } from "@/i18n/routing";
import { placeLanguageMenu, type MenuPlace } from "@/lib/language-menu";
import { useApp } from "./AppState";

function readMenuPlace(trigger: HTMLElement): MenuPlace {
  const rect = trigger.getBoundingClientRect();
  const tab = document.querySelector(".bottom-tab-bar");
  const tabBox = tab?.getBoundingClientRect();
  const tabVisible = Boolean(tab && tabBox && tabBox.height > 0 && getComputedStyle(tab).display !== "none");
  return placeLanguageMenu(
    { top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width },
    {
      width: window.innerWidth,
      height: window.innerHeight,
      limitBottom: tabVisible && tabBox ? tabBox.top : window.innerHeight,
    },
  );
}

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { t, lang, pathname, search } = useApp();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<MenuPlace | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const shown = open && place !== null;

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const update = () => setPlace(readMenuPlace(trigger));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // The list lives at the end of the page, so Tab from the trigger would never reach it.
  // Opening moves focus to the current language, once: scrolling the list moves `place` too.
  useEffect(() => {
    if (!shown) return;
    const list = listRef.current;
    const target = list?.querySelector<HTMLElement>('[aria-current="true"]') ?? list?.querySelector<HTMLElement>("a");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }, [shown]);

  const currentLabel = LANG_NATIVE[lang];
  const menu =
    shown && typeof document !== "undefined"
      ? createPortal(
          <>
            {/* For pointers. Keyboards close with Escape or by leaving the list. */}
            <button type="button" className="lang-switch-scrim" tabIndex={-1} aria-label={t("close")} onClick={() => setOpen(false)} />
            <ul
              ref={listRef}
              id={listId}
              className="lang-switch-list"
              aria-label={t("langLabel")}
              style={{
                left: place.left,
                width: place.width,
                maxHeight: place.maxHeight,
                top: place.top,
                bottom: place.bottom,
              }}
              onBlur={(event) => {
                const next = event.relatedTarget;
                if (!(next instanceof Node)) return;
                if (listRef.current?.contains(next) || triggerRef.current?.contains(next)) return;
                setOpen(false);
              }}
            >
              {LANGS.map((code) => {
                const href = switchLangHref(pathname, search, code);
                const selected = code === lang;
                return (
                  <li key={code}>
                    <a
                      className={selected ? "lang-switch-item is-active" : "lang-switch-item"}
                      href={href}
                      hrefLang={code}
                      lang={code}
                      aria-current={selected ? "true" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {LANG_NATIVE[code]}
                    </a>
                  </li>
                );
              })}
            </ul>
          </>,
          document.body,
        )
      : null;

  return (
    <div className={`lang-switch${open ? " lang-switch-open" : ""}${compact ? " lang-switch-compact" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="lang-switch-trigger"
        aria-expanded={open}
        aria-controls={shown ? listId : undefined}
        aria-label={t("langLabel")}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="lang-switch-current">{currentLabel}</span>
        <span className="lang-switch-caret" aria-hidden>
          ▾
        </span>
      </button>
      {menu}
    </div>
  );
}

/** Paths for next/link and the router. Plain anchors need pathWithLang, which adds the base path. */
export function useLocalizedPath() {
  const { lang } = useApp();
  return useCallback((rest: string) => langPath(lang, rest), [lang]);
}

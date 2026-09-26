"use client";

import { useCallback, useState } from "react";
import { LANGS, LANG_NATIVE } from "@/i18n/languages";
import { pathWithLang, switchLangHref } from "@/i18n/routing";
import { useApp } from "./AppState";

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { t, lang, pathname, search } = useApp();
  const [open, setOpen] = useState(false);

  const currentLabel = LANG_NATIVE[lang];

  return (
    <div className={`lang-switch${open ? " lang-switch-open" : ""}${compact ? " lang-switch-compact" : ""}`}>
      <button
        type="button"
        className="lang-switch-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("langLabel")}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="lang-switch-current">{currentLabel}</span>
        <span className="lang-switch-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <>
          <button type="button" className="lang-switch-scrim" aria-label={t("close")} onClick={() => setOpen(false)} />
          <ul className="lang-switch-list" role="listbox" aria-label={t("langLabel")}>
            {LANGS.map((code) => {
              const href = switchLangHref(pathname, search, code);
              const selected = code === lang;
              return (
                <li key={code} role="option" aria-selected={selected}>
                  <a
                    className={selected ? "lang-switch-item is-active" : "lang-switch-item"}
                    href={href}
                    hrefLang={code}
                    lang={code}
                    onClick={() => setOpen(false)}
                  >
                    {LANG_NATIVE[code]}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function useLocalizedPath() {
  const { lang } = useApp();
  return useCallback((rest: string) => pathWithLang(lang, rest), [lang]);
}

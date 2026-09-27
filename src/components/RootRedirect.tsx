"use client";

import { LANGS, LANG_NATIVE, detectClientLang, persistLangChoice } from "@/i18n/languages";
import { pathWithLang } from "@/i18n/routing";
import { useEffect } from "react";

export function RootRedirect() {
  useEffect(() => {
    const lang = detectClientLang();
    persistLangChoice(lang);
    const search = window.location.search;
    const target = `${pathWithLang(lang, "/")}${search}`;
    window.location.replace(target);
  }, []);

  return (
    <div className="page page-narrow root-redirect">
      <p>Redirecting…</p>
      <noscript>
        <p>Choose a language:</p>
        <ul className="lang-noscript">
          {LANGS.map((code) => (
            <li key={code}>
              <a href={pathWithLang(code, "/")} hrefLang={code} lang={code}>
                {LANG_NATIVE[code]}
              </a>
            </li>
          ))}
        </ul>
      </noscript>
    </div>
  );
}

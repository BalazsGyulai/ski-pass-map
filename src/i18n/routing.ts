import { BASE_PATH } from "@/lib/site";
import { DEFAULT_LANG, LANGS, type Lang } from "./languages";
import { isLang } from "./languages";

const PAGE_SUFFIXES = [
  "",
  "plan",
  "compare",
  "about",
  "credits",
  "contact",
  "imprint",
  "privacy",
  "terms",
  "support",
] as const;

/** Strip configured basePath and return `/en/plan` style paths. */
export function stripBasePath(pathname: string): string {
  if (!BASE_PATH) return pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (pathname === BASE_PATH) return "/";
  if (pathname.startsWith(`${BASE_PATH}/`)) return pathname.slice(BASE_PATH.length);
  return pathname;
}

export function parseLangPath(pathname: string): { lang: Lang | null; rest: string } {
  const bare = stripBasePath(pathname).replace(/\/+$/, "") || "/";
  const parts = bare.split("/").filter(Boolean);
  if (parts.length === 0) return { lang: null, rest: "/" };
  const first = parts[0];
  if (!isLang(first)) return { lang: null, rest: bare };
  const restParts = parts.slice(1);
  const rest = restParts.length === 0 ? "/" : `/${restParts.join("/")}`;
  return { lang: first, rest };
}

export function pathWithLang(lang: Lang, rest: string): string {
  const normalized = rest === "/" || rest === "" ? "" : rest.startsWith("/") ? rest : `/${rest}`;
  const core = normalized === "" ? `/${lang}/` : `/${lang}${normalized.endsWith("/") ? normalized : `${normalized}/`}`;
  if (!BASE_PATH) return core;
  return `${BASE_PATH}${core}`;
}

export function isMapPath(pathname: string, lang: Lang): boolean {
  const { lang: parsed, rest } = parseLangPath(pathname);
  return parsed === lang && (rest === "/" || rest === "");
}

export function switchLangHref(pathname: string, search: string, nextLang: Lang): string {
  const { rest } = parseLangPath(pathname);
  const href = pathWithLang(nextLang, rest);
  return search ? `${href}?${search.replace(/^\?/, "")}` : href;
}

export function allLocalizedPaths(rest: string): { lang: Lang; path: string }[] {
  return LANGS.map((lang) => ({ lang, path: pathWithLang(lang, rest) }));
}

export function sitePagePaths(): string[] {
  const paths: string[] = [];
  for (const lang of LANGS) {
    for (const suffix of PAGE_SUFFIXES) {
      paths.push(pathWithLang(lang, suffix ? `/${suffix}` : "/"));
    }
  }
  return paths;
}

export function defaultLangHome(): string {
  return pathWithLang(DEFAULT_LANG, "/");
}

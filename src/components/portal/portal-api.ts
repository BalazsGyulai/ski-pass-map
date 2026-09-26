import { BASE_PATH } from "@/lib/site";

export async function portalFetch(path: string, init?: RequestInit, csrf?: string) {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && init?.body) headers.set("content-type", "application/json");
  if (csrf) headers.set("x-csrf-token", csrf);
  if (process.env.NEXT_PUBLIC_PORTAL_DEV_EMAIL) {
    headers.set("x-portal-dev-email", process.env.NEXT_PUBLIC_PORTAL_DEV_EMAIL);
  }
  const url = new URL(`${BASE_PATH}${path}`, window.location.origin).href;
  return fetch(url, { ...init, headers, credentials: "include" });
}

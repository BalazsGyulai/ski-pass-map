"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/site";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV === "development") return;
    const hadWorker = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("message", (event) => {
      const cache = event.data?.cache;
      if (event.data?.type !== "sw-reload" || !hadWorker || typeof cache !== "string") return;
      if (sessionStorage.getItem("sw-reloaded") === cache) return;
      sessionStorage.setItem("sw-reloaded", cache);
      window.location.reload();
    });
    navigator.serviceWorker
      .register(`${BASE_PATH}/sw.js`, { scope: BASE_PATH ? `${BASE_PATH}/` : "/", updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {
        // The site still works online if the worker cannot be installed.
      });
  }, []);
  return null;
}

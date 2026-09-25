"use client";

import { useEffect } from "react";
import site from "../../config/site.json";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
    navigator.serviceWorker.register(`${site.basePath}/sw.js`, { scope: `${site.basePath}/` }).catch(() => {
      // Install still works without the worker; tiles were never cached.
    });
  }, []);
  return null;
}

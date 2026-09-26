"use client";

import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/site";
import type { OverridesPayload } from "@/lib/portal/overrides";
import { emptyOverrides } from "@/lib/portal/overrides";

export function useRuntimeOverrides(): OverridesPayload | null {
  const [payload, setPayload] = useState<OverridesPayload | null>(null);
  useEffect(() => {
    const url = new URL(`${BASE_PATH}/api/overrides`, window.location.origin).href;
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && typeof json === "object") setPayload(json as OverridesPayload);
      })
      .catch(() => {
        /* silent fallback to static data */
      });
  }, []);
  return payload;
}

export function staticOverridesFallback(): OverridesPayload {
  return emptyOverrides();
}

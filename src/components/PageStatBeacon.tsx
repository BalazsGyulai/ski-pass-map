"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BASE_PATH } from "@/lib/site";

export function PageStatBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STATS_ENABLED !== "1") return;
    const path = pathname || "/";
    const url = new URL(`${BASE_PATH}/api/stat`, window.location.origin).href;
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}

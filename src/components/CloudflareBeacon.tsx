"use client";

import Script from "next/script";

const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN?.trim();

export function CloudflareBeacon() {
  if (!token) return null;
  return (
    <Script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={`{"token":"${token}"}`}
      strategy="afterInteractive"
    />
  );
}

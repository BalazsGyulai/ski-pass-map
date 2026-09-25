"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map-skeleton" role="status" aria-label="Loading map" />,
});

export function MapSlot() {
  return <MapView />;
}

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useApp } from "../AppState";

/**
 * Map boundary. Part 4 swaps the Leaflet implementation imported here
 * for Mapbox, with an OpenFreeMap or MapLibre fallback. Callers should
 * depend on this component, not on Leaflet.
 */
const LeafletMap = dynamic(() => import("../MapView"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

class MapErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Map failed to render", error, info.componentStack);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function MapSkeleton() {
  return <div className="map-skeleton" role="status" />;
}

export function SkiMap() {
  const { t } = useApp();
  return (
    <MapErrorBoundary fallback={<div className="map-skeleton" role="alert">{t("mapError")}</div>}>
      <LeafletMap />
    </MapErrorBoundary>
  );
}

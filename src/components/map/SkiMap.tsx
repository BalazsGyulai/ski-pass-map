"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useApp } from "../AppState";

/**
 * Map boundary. The canvas is Mapbox GL when the token, consent, and load
 * budget allow it, and MapLibre with OpenFreeMap otherwise. Callers should
 * depend on this component, not on a map library.
 */
const VectorMap = dynamic(() => import("../MapView"), {
  ssr: false,
  loading: () => <MapLoading />,
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

function MapLoading() {
  const { t } = useApp();
  return <div className="map-skeleton" role="status" aria-label={t("loadingMap")} />;
}

export function SkiMap() {
  const { t } = useApp();
  return (
    <MapErrorBoundary fallback={<div className="map-skeleton" role="alert">{t("mapError")}</div>}>
      <VectorMap />
    </MapErrorBoundary>
  );
}

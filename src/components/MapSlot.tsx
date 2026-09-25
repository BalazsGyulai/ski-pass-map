"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useApp } from "./AppState";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map-skeleton" role="status" aria-label="Loading map" />,
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

export function MapSlot() {
  const { t } = useApp();
  return (
    <MapErrorBoundary fallback={<div className="map-skeleton" role="alert">{t("mapError")}</div>}>
      <MapView />
    </MapErrorBoundary>
  );
}

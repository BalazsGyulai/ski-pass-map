import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const query = window.matchMedia("(max-width: 899px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(max-width: 899px)").matches,
    () => true,
  );
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

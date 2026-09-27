"use client";

import { useApp } from "./AppState";

export function ToastHost() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      <p className="toast">{toast}</p>
    </div>
  );
}

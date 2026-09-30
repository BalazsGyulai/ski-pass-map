# Shared UI primitives

Framework: React 19, Next.js 15 App Router, static export. There is no component library (no Tailwind, shadcn, Radix, or MUI). Shared controls live in `src/components/ui/SettingsControls.tsx`. Everything else is a CSS class in `src/app/globals.css` (buttons are `button` elements with a 44px minimum height, not a Button component).

## SettingsGroup, SettingsRow, ToggleSwitch, SegmentedControl, StyledSelect

- Path: `src/components/ui/SettingsControls.tsx`
- Props: see each export (title/children, label/hint/children, checked/onChange/label, value/options/onChange/ariaLabel)

### `src/components/ui/SettingsControls.tsx`

```tsx
"use client";

import type { ReactNode } from "react";

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group" aria-labelledby={title.replace(/\s/g, "-")}>
      <h2 id={title.replace(/\s/g, "-")} className="settings-group-title">{title}</h2>
      <div className="settings-group-body">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <span className="settings-row-label">{label}</span>
        {hint ? <span className="settings-row-hint">{hint}</span> : null}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle-switch${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="seg-control" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={value === opt.value ? "is-on" : ""}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function StyledSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="styled-select">
      <select value={value} aria-label={ariaLabel} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="styled-select-caret" aria-hidden="true">▾</span>
    </div>
  );
}
```


## ToastHost

- Path: `src/components/Toast.tsx`
- A status line. No props; reads `toast` from app state.

### `src/components/Toast.tsx`

```tsx
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
```


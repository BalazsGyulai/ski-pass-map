"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { SHEET_EVENT, rubberBand, settleDuration, settleSnap, sheetMetrics, type SheetMetrics, type SheetSnap } from "@/lib/sheet";
import { useNarrow } from "./useNarrow";

/**
 * Mobile bottom sheet that follows the finger. The sheet keeps one height (its "full" size) and
 * moves with a transform, so dragging never triggers layout. Releasing projects the throw forward
 * and settles on a snap with the native sheet curve.
 *
 * Drag zones: elements marked `data-sheet-handle` always drag. Content drags the sheet until the
 * sheet is full; after that it scrolls, and a pull down from the top of the scroll moves the sheet.
 * Horizontal swipes are left to the content.
 */
export function useBottomSheet(options: {
  kind: "list" | "resort";
  snap: SheetSnap;
  setSnap: (snap: SheetSnap) => void;
  onClose?: () => void;
}) {
  const { kind, snap, setSnap, onClose } = options;
  const ref = useRef<HTMLElement | null>(null);
  const narrow = useNarrow();
  const [available, setAvailable] = useState<number | null>(null);
  const metrics = narrow && available ? sheetMetrics(kind, available) : null;
  const visible = metrics ? metrics[snap] : null;

  useLayoutEffect(() => {
    if (!narrow) return;
    const el = ref.current;
    if (!el) return;
    const host = el.parentElement;
    const explorer = el.closest(".explorer");
    const measure = () => {
      if (!host || !explorer) return;
      const space = host.getBoundingClientRect().bottom - explorer.getBoundingClientRect().top;
      if (space > 0) setAvailable(Math.round(space));
    };
    measure();
    // Layout can settle after the first paint (fonts, a reload from the service worker, the
    // browser bar). Watching the frame keeps the snap heights right without polling.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (explorer) observer?.observe(explorer);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [narrow]);

  // Other parts of the page (the map camera, the plan pill) follow the settled height.
  useEffect(() => {
    const root = document.documentElement;
    if (!narrow || visible == null) {
      root.style.removeProperty("--sheet-visible");
      delete root.dataset.sheetPx;
      return;
    }
    root.style.setProperty("--sheet-visible", `${visible}px`);
    root.dataset.sheetPx = String(visible);
    window.dispatchEvent(new CustomEvent(SHEET_EVENT, { detail: { visible } }));
  }, [narrow, visible]);

  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("--sheet-visible");
      delete document.documentElement.dataset.sheetPx;
    },
    [],
  );

  const latest = useRef({ metrics, snap, setSnap, onClose, kind });
  latest.current = { metrics, snap, setSnap, onClose, kind };

  const place = useCallback((shown: number, transition: string | null) => {
    const el = ref.current;
    const m = latest.current.metrics;
    if (!el || !m) return;
    const offset = Math.round(m.full - shown);
    el.style.transition = transition ?? "none";
    // Pinned children (the action bar) ride the same curve, so they stay on the visible edge.
    el.style.setProperty("--sheet-transition", transition ?? "none");
    el.style.transform = `translate3d(0, ${offset}px, 0)`;
    el.style.setProperty("--sheet-offset", `${Math.max(0, offset)}px`);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!narrow || !el) return;
    type Drag = {
      startX: number;
      startY: number;
      startShown: number;
      shown: number;
      mode: "pending" | "sheet" | "ignore";
      fromHandle: boolean;
      scroller: HTMLElement | null;
      samples: Array<{ t: number; y: number }>;
    };
    let drag: Drag | null = null;
    let settleTimer = 0;

    const shownNow = () => {
      const m = latest.current.metrics;
      if (!m) return 0;
      return m[latest.current.snap];
    };

    const scrollerFor = (target: EventTarget | null): HTMLElement | null => {
      let node = target instanceof HTMLElement ? target : null;
      while (node && node !== el) {
        const style = window.getComputedStyle(node);
        if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 1) return node;
        node = node.parentElement;
      }
      return null;
    };

    const begin = (x: number, y: number, target: EventTarget | null) => {
      window.clearTimeout(settleTimer);
      const fromHandle = target instanceof Element && Boolean(target.closest("[data-sheet-handle]"));
      const shown = shownNow();
      drag = { startX: x, startY: y, startShown: shown, shown, mode: "pending", fromHandle, scroller: scrollerFor(target), samples: [{ t: performance.now(), y }] };
    };

    /** True when the sheet took this move, so the caller should stop native scrolling. */
    const move = (x: number, y: number): boolean => {
      const m = latest.current.metrics;
      if (!drag || !m || drag.mode === "ignore") return false;
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      if (drag.mode === "pending") {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return false;
        if (Math.abs(dx) > Math.abs(dy)) {
          drag.mode = "ignore";
          return false;
        }
        const full = latest.current.snap === "full";
        const atTop = !drag.scroller || drag.scroller.scrollTop <= 0;
        if (!drag.fromHandle && full && !(dy > 0 && atTop)) {
          drag.mode = "ignore";
          return false;
        }
        drag.mode = "sheet";
        el.dataset.dragging = "true";
      }
      const raw = drag.startShown - dy;
      const closable = latest.current.kind === "resort";
      let shown = raw;
      if (raw > m.full) shown = m.full + rubberBand(raw - m.full, 60);
      else if (raw < m.peek && !closable) shown = m.peek - rubberBand(m.peek - raw, 80);
      else if (raw < 0) shown = 0;
      drag.shown = shown;
      place(shown, null);
      const now = performance.now();
      drag.samples.push({ t: now, y });
      while (drag.samples.length > 2 && now - drag.samples[0].t > 90) drag.samples.shift();
      return true;
    };

    const end = () => {
      const m = latest.current.metrics;
      const current = drag;
      drag = null;
      delete el.dataset.dragging;
      if (!current || current.mode !== "sheet" || !m) return;
      const first = current.samples[0];
      const last = current.samples[current.samples.length - 1];
      const elapsed = last.t - first.t;
      const velocity = elapsed > 8 ? (last.y - first.y) / elapsed : 0;
      const closable = latest.current.kind === "resort";
      const target = settleSnap({ visible: current.shown, velocity, metrics: m, closable });
      const goal = target === "close" ? 0 : m[target];
      const duration = settleDuration(goal - current.shown, velocity);
      place(goal, `transform ${duration}ms var(--ease-sheet)`);
      settleTimer = window.setTimeout(() => {
        el.style.transition = "";
        el.style.removeProperty("--sheet-transition");
        if (target === "close") latest.current.onClose?.();
      }, duration);
      if (target !== "close" && target !== latest.current.snap) latest.current.setSnap(target);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      if (!(event.target instanceof Element) || !event.target.closest("[data-sheet-handle]")) return;
      if (event.target.closest("button, a, input, select, textarea, label")) return;
      begin(event.clientX, event.clientY, event.target);
      const onMove = (ev: PointerEvent) => {
        if (move(ev.clientX, ev.clientY)) ev.preventDefault();
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        end();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        drag = null;
        return;
      }
      const touch = event.touches[0];
      begin(touch.clientX, touch.clientY, event.target);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      if (move(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
    };
    const onTouchEnd = () => end();

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.clearTimeout(settleTimer);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [narrow, place]);

  const style: CSSProperties | undefined =
    metrics && visible != null
      ? ({
          height: metrics.full,
          transform: `translate3d(0, ${metrics.full - visible}px, 0)`,
          "--sheet-offset": `${metrics.full - visible}px`,
        } as CSSProperties)
      : undefined;

  return { ref, style, metrics: metrics as SheetMetrics | null };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIFT_CLASSES,
  LIFT_MOTION,
  LIFT_MOTION_MINZOOM,
  LIFT_TICK_MS,
  dashCycle,
  liftClass,
  liftLayerId,
  shiftedDash,
  startLiftMotion,
} from "./lift-motion";
import { pisteLayer, pisteLayerSpecs } from "./vector-map";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const dashTotal = (pattern: number[]) => sum(pattern.filter((_, index) => index % 2 === 0));
/** Where the leading full dash starts: after the wrapped tail and the gap before it. */
const dashStart = (pattern: number[]) => (pattern.length === 2 ? 0 : pattern[0] + pattern[1]);

describe("lift classes", () => {
  it("groups the OSM lift types the data uses", () => {
    expect(liftClass("gondola")).toBe("cabin");
    expect(liftClass("cable_car")).toBe("cabin");
    expect(liftClass("mixed_lift")).toBe("cabin");
    expect(liftClass("chair_lift")).toBe("chair");
    for (const type of ["t-bar", "j-bar", "platter", "drag_lift", "rope_tow"]) expect(liftClass(type), type).toBe("surface");
    expect(liftClass("magic_carpet")).toBe("carpet");
    expect(liftClass("zip_line")).toBeNull();
    expect(liftClass("yes")).toBeNull();
    expect(liftClass(null)).toBeNull();
  });
});

describe("dash patterns", () => {
  it("keeps the period and the dash length at every step, and only moves the dash forward", () => {
    for (const cls of LIFT_CLASSES) {
      const style = LIFT_MOTION[cls];
      const period = style.dash + style.gap;
      const cycle = dashCycle(style);
      expect(cycle, cls).toHaveLength(style.steps);
      expect(cycle[0], cls).toEqual([style.dash, style.gap]);
      cycle.forEach((pattern, step) => {
        expect(pattern.length % 2, `${cls} ${step}`).toBe(0);
        expect(sum(pattern), `${cls} ${step}`).toBeCloseTo(period, 2);
        expect(dashTotal(pattern), `${cls} ${step}`).toBeCloseTo(style.dash, 2);
        expect(dashStart(pattern), `${cls} ${step}`).toBeCloseTo((period * step) / style.steps, 2);
      });
    }
  });

  it("wraps a dash that runs past the end of the period", () => {
    expect(shiftedDash(1, 3, 0)).toEqual([1, 3]);
    expect(shiftedDash(1, 3, 2)).toEqual([0, 2, 1, 1]);
    expect(shiftedDash(1, 3, 3.5)).toEqual([0.5, 3, 0.5, 0]);
    expect(shiftedDash(1, 3, 4)).toEqual([1, 3]);
  });
});

describe("lift layers", () => {
  it("draws the cable for every lift and a moving layer per lift type, crisp and only when close", () => {
    const specs = pisteLayerSpecs(false);
    expect(specs.find((spec) => spec.id === "piste-lift")?.dash).toBeUndefined();
    for (const cls of LIFT_CLASSES) {
      const spec = specs.find((item) => item.id === liftLayerId(cls));
      expect(spec, cls).toBeTruthy();
      const layer = pisteLayer(spec!) as { minzoom: number; layout: Record<string, string>; paint: Record<string, unknown> };
      expect(layer.minzoom).toBe(LIFT_MOTION_MINZOOM);
      expect(layer.layout["line-cap"]).toBe("butt");
      expect(layer.paint["line-dasharray"]).toEqual(dashCycle(LIFT_MOTION[cls])[0]);
    }
    expect(JSON.stringify(specs.find((spec) => spec.id === "lift-cabin")?.filter)).toContain("gondola");
  });
});

describe("startLiftMotion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeMap(layers: string[]) {
    let zoom = 13;
    const setPaintProperty = vi.fn();
    return {
      map: { getLayer: (id: string) => (layers.includes(id) ? { id } : undefined), getZoom: () => zoom, setPaintProperty },
      setPaintProperty,
      zoomTo: (value: number) => {
        zoom = value;
      },
    };
  }

  it("steps each lift type at its own pace and stops cleanly", () => {
    const { map, setPaintProperty } = fakeMap([liftLayerId("cabin"), liftLayerId("carpet")]);
    const stop = startLiftMotion(map, { hidden: () => false });
    vi.advanceTimersByTime(LIFT_TICK_MS);
    expect(setPaintProperty).toHaveBeenCalledTimes(1);
    expect(setPaintProperty).toHaveBeenLastCalledWith("lift-cabin", "line-dasharray", dashCycle(LIFT_MOTION.cabin)[1]);
    vi.advanceTimersByTime(LIFT_TICK_MS);
    // The magic carpet moves every other tick; missing layers (chair, surface) are skipped.
    expect(setPaintProperty.mock.calls.map((call) => call[0])).toEqual(["lift-cabin", "lift-cabin", "lift-carpet"]);
    stop();
    vi.advanceTimersByTime(LIFT_TICK_MS * 10);
    expect(setPaintProperty).toHaveBeenCalledTimes(3);
  });

  it("rests in a background tab and when zoomed out", () => {
    let hidden = true;
    const { map, setPaintProperty, zoomTo } = fakeMap([liftLayerId("chair")]);
    const stop = startLiftMotion(map, { hidden: () => hidden });
    vi.advanceTimersByTime(LIFT_TICK_MS * 5);
    expect(setPaintProperty).not.toHaveBeenCalled();
    hidden = false;
    zoomTo(LIFT_MOTION_MINZOOM - 1);
    vi.advanceTimersByTime(LIFT_TICK_MS * 5);
    expect(setPaintProperty).not.toHaveBeenCalled();
    zoomTo(LIFT_MOTION_MINZOOM);
    vi.advanceTimersByTime(LIFT_TICK_MS);
    expect(setPaintProperty).toHaveBeenCalledWith("lift-chair", "line-dasharray", dashCycle(LIFT_MOTION.chair)[1]);
    stop();
  });
});

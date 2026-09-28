import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAR_KINDS, LIFT_GLYPHS, LIFT_KINDS, liftKind, liftKindExpression } from "./lift-icons";
import {
  LIFT_CARS_SOURCE,
  LIFT_FLOW,
  LIFT_MOTION_MINZOOM,
  LIFT_TICK_MS,
  SHUTTLE_SECONDS,
  liftCars,
  liftPaths,
  metresPerPixel,
  startLiftMotion,
  type LiftPath,
} from "./lift-motion";
import { LIFT_BELT_LAYER, LIFT_CAR_LAYER, LIFT_SIGN_LAYER, liftCarLayers, liftSignLayer, pisteLayerIds, pisteLayerSpecs } from "./vector-map";

/** A straight lift due north from the equator: 0.009° of latitude is about 1 km. */
function lift(aerialway: string, coordinates: number[][] = [[0, 0], [0, 0.009]]) {
  return { type: "Feature", properties: { kind: "lift", aerialway, name: null, difficulty: null, osm: "way/1" }, geometry: { type: "LineString", coordinates } };
}

describe("lift kinds", () => {
  it("groups the OSM lift types the data uses", () => {
    expect(liftKind("cable_car")).toBe("cable_car");
    expect(liftKind("gondola")).toBe("gondola");
    expect(liftKind("mixed_lift")).toBe("mixed");
    expect(liftKind("chair_lift")).toBe("chair");
    for (const type of ["t-bar", "j-bar", "drag_lift"]) expect(liftKind(type), type).toBe("drag");
    expect(liftKind("platter")).toBe("platter");
    expect(liftKind("rope_tow")).toBe("rope_tow");
    expect(liftKind("magic_carpet")).toBe("carpet");
    expect(liftKind("zip_line")).toBe("other");
    expect(liftKind("yes")).toBe("other");
    expect(liftKind(null)).toBe("other");
  });

  it("makes the same choice on the map as in the app", () => {
    const [op, input, ...rest] = liftKindExpression() as [string, unknown, ...string[]];
    expect(op).toBe("match");
    expect(JSON.stringify(input)).toContain("aerialway");
    const fallback = rest[rest.length - 1];
    const pairs = new Map<string, string>();
    for (let i = 0; i < rest.length - 1; i += 2) pairs.set(rest[i], rest[i + 1]);
    for (const type of ["cable_car", "gondola", "mixed_lift", "chair_lift", "t-bar", "j-bar", "drag_lift", "platter", "rope_tow", "magic_carpet", "zip_line", "yes"]) {
      expect(pairs.get(type) ?? fallback, type).toBe(liftKind(type));
    }
  });

  it("has a pictogram for every kind, and a car for every moving lift", () => {
    for (const kind of LIFT_KINDS) expect(LIFT_GLYPHS[kind].length, kind).toBeGreaterThan(0);
    for (const flow of Object.values(LIFT_FLOW)) for (const car of flow?.cars ?? []) expect(CAR_KINDS).toContain(car);
  });
});

describe("liftPaths", () => {
  it("keeps lifts with something to move and measures them from the valley station", () => {
    const paths = liftPaths({
      type: "FeatureCollection",
      features: [
        lift("chair_lift"),
        lift("zip_line"),
        { type: "Feature", properties: { kind: "piste", difficulty: "easy" }, geometry: { type: "LineString", coordinates: [[0, 0], [0, 1]] } },
        { ...lift("gondola"), geometry: { type: "MultiLineString", coordinates: [[[0, 0], [0, 0.009]], [[1, 0], [1, 0.0045]]] } },
      ],
    });
    expect(paths.map((path) => path.kind)).toEqual(["chair", "gondola", "gondola"]);
    expect(paths[0].length).toBeGreaterThan(990);
    expect(paths[0].length).toBeLessThan(1010);
    expect(paths[2].length).toBeCloseTo(paths[1].length / 2, 0);
    expect(liftPaths(null)).toEqual([]);
  });
});

describe("liftCars", () => {
  const [chair] = liftPaths({ features: [lift("chair_lift")] });
  const mpp = 2;

  it("spaces cars evenly along the whole lift, in screen pixels", () => {
    const cars = liftCars([chair], 0, mpp);
    const spacing = LIFT_FLOW.chair!.spacingPx * mpp;
    expect(cars).toHaveLength(Math.floor(chair.length / spacing) + 1);
    const lats = cars.map((car) => car.geometry.coordinates[1]);
    expect(lats[0]).toBe(0);
    expect((lats[1] - lats[0]) / 0.009).toBeCloseTo(spacing / chair.length, 3);
    expect(cars.every((car) => car.properties.car === "chair")).toBe(true);
  });

  it("moves the cars uphill at the lift's own pace", () => {
    const flow = LIFT_FLOW.chair!;
    const quarter = (0.25 * flow.spacingPx) / flow.speedPx;
    const first = liftCars([chair], quarter, mpp)[0].geometry.coordinates[1];
    expect(first / 0.009).toBeCloseTo((0.25 * flow.spacingPx * mpp) / chair.length, 3);
  });

  it("alternates cabins and chairs on a mixed lift, and each keeps its type as it moves", () => {
    const [mixed] = liftPaths({ features: [lift("mixed_lift")] });
    const flow = LIFT_FLOW.mixed!;
    const before = liftCars([mixed], 0, mpp);
    expect(before.slice(0, 4).map((car) => car.properties.car)).toEqual(["cabin", "chair", "cabin", "chair"]);
    // One full spacing later every car stands where the next one stood.
    const after = liftCars([mixed], flow.spacingPx / flow.speedPx, mpp);
    expect(after[1].properties.car).toBe(before[0].properties.car);
    expect(after[1].geometry.coordinates[1]).toBeCloseTo(before[1].geometry.coordinates[1], 9);
  });

  it("shuttles a cable car's two cabins past each other", () => {
    const [tram] = liftPaths({ features: [lift("cable_car")] });
    const atStations = liftCars([tram], 0, mpp).map((car) => car.geometry.coordinates[1]);
    expect(atStations[0]).toBeCloseTo(0, 9);
    expect(atStations[1]).toBeCloseTo(0.009, 9);
    const passing = liftCars([tram], SHUTTLE_SECONDS / 4, mpp).map((car) => car.geometry.coordinates[1]);
    expect(passing[0]).toBeCloseTo(0.0045, 9);
    expect(passing[1]).toBeCloseTo(0.0045, 9);
  });

  it("points magic carpet chevrons along the belt", () => {
    const [east] = liftPaths({ features: [lift("magic_carpet", [[0, 0], [0.001, 0]])] });
    const [north] = liftPaths({ features: [lift("magic_carpet", [[0, 0], [0, 0.001]])] });
    expect(liftCars([east], 0, 0.5)[0].properties).toEqual({ car: "chevron", rotate: 0 });
    expect(liftCars([north], 0, 0.5)[0].properties.rotate).toBeCloseTo(-90);
  });

  it("scales with zoom and latitude like the map does", () => {
    expect(metresPerPixel(0, 0)).toBeCloseTo(78271.5, 0);
    expect(metresPerPixel(14, 60)).toBeCloseTo(metresPerPixel(14, 0) / 2, 6);
  });
});

describe("lift layers", () => {
  it("keeps the cable a plain line under upright signs and moving cars", () => {
    expect(pisteLayerSpecs(false).find((spec) => spec.id === "piste-lift")?.dash).toBeUndefined();
    const sign = liftSignLayer() as { layout: Record<string, unknown>; minzoom: number };
    expect(sign.layout["symbol-placement"]).toBe("line");
    expect(sign.layout["icon-rotation-alignment"]).toBe("viewport");
    const [cars, belts] = liftCarLayers() as Array<{ id: string; source: string; minzoom: number; layout: Record<string, unknown> }>;
    expect([cars.id, belts.id]).toEqual([LIFT_CAR_LAYER, LIFT_BELT_LAYER]);
    for (const layer of [cars, belts]) {
      expect(layer.source).toBe(LIFT_CARS_SOURCE);
      expect(layer.minzoom).toBe(LIFT_MOTION_MINZOOM);
      expect(layer.layout["icon-allow-overlap"]).toBe(true);
    }
    expect(cars.layout["icon-anchor"]).toBe("top");
    expect(belts.layout["icon-rotation-alignment"]).toBe("map");
    // Hovering a sign shows the lift's name like hovering its line does.
    expect(pisteLayerIds()).toContain(LIFT_SIGN_LAYER);
  });
});

describe("startLiftMotion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeMap() {
    let zoom = 14;
    const setData = vi.fn();
    return {
      map: { getZoom: () => zoom, getCenter: () => ({ lat: 47 }), getSource: (id: string) => (id === LIFT_CARS_SOURCE ? { setData } : undefined) },
      setData,
      zoomTo: (value: number) => {
        zoom = value;
      },
    };
  }

  const paths: LiftPath[] = liftPaths({ features: [lift("gondola")] });

  it("moves the cars every tick and clears them when stopped", () => {
    const { map, setData } = fakeMap();
    let now = 0;
    const stop = startLiftMotion(map, paths, { hidden: () => false, now: () => now });
    expect(setData).toHaveBeenCalledTimes(1);
    now += LIFT_TICK_MS;
    vi.advanceTimersByTime(LIFT_TICK_MS);
    expect(setData).toHaveBeenCalledTimes(2);
    const [first, second] = setData.mock.calls.map((call) => call[0].features[0].geometry.coordinates[1]);
    expect(second).toBeGreaterThan(first);
    stop();
    expect(setData).toHaveBeenLastCalledWith({ type: "FeatureCollection", features: [] });
    vi.advanceTimersByTime(LIFT_TICK_MS * 10);
    expect(setData).toHaveBeenCalledTimes(3);
  });

  it("rests in a background tab and when zoomed out", () => {
    let hidden = true;
    const { map, setData, zoomTo } = fakeMap();
    const stop = startLiftMotion(map, paths, { hidden: () => hidden, now: () => 0 });
    vi.advanceTimersByTime(LIFT_TICK_MS * 5);
    expect(setData).not.toHaveBeenCalled();
    hidden = false;
    zoomTo(LIFT_MOTION_MINZOOM - 1);
    vi.advanceTimersByTime(LIFT_TICK_MS * 5);
    expect(setData).not.toHaveBeenCalled();
    zoomTo(LIFT_MOTION_MINZOOM);
    vi.advanceTimersByTime(LIFT_TICK_MS);
    expect(setData).toHaveBeenCalledTimes(1);
    stop();
  });
});

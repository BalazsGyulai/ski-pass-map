import { describe, expect, it, vi } from "vitest";
import { MAPBOX_STYLE_LIGHT, OPENFREEMAP_STYLE_LIGHT, OPENSKIMAP_ATTRIBUTION } from "./map-styles";
import { createVectorMap, loadMapLibrary, maplibreWorkerUrl, pisteLayerSpecs, pisteTip, type MapEvent, type MapLib } from "./vector-map";

const { setWorkerUrl } = vi.hoisted(() => ({ setWorkerUrl: vi.fn() }));

vi.mock("maplibre-gl", () => ({ setWorkerUrl, Map: class {} }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("mapbox-gl", () => ({ default: { Map: class {}, accessToken: "" } }));
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

class FakeMap {
  options: Record<string, unknown>;
  listeners: Record<string, Array<(event: MapEvent) => void>> = {};
  constructor(options: Record<string, unknown>) {
    this.options = options;
  }
  on(type: string, listener: (event: MapEvent) => void) {
    (this.listeners[type] ??= []).push(listener);
    return this;
  }
  off() {
    return this;
  }
  remove() {}
  addControl() {
    return this;
  }
}

function libWith(maps: FakeMap[]): MapLib & { accessToken?: string } {
  return {
    accessToken: "",
    Map: class extends FakeMap {
      constructor(options: Record<string, unknown>) {
        super(options);
        maps.push(this);
      }
    },
  } as unknown as MapLib & { accessToken?: string };
}

describe("vector map init", () => {
  it("initialises Mapbox with a dummy token and the light style", () => {
    const maps: FakeMap[] = [];
    const lib = libWith(maps);
    const onFatal = vi.fn();
    createVectorMap(lib, {
      container: {} as HTMLElement,
      provider: "mapbox",
      token: "pk.dummy",
      theme: "light",
      onFatal,
    });
    expect(lib.accessToken).toBe("pk.dummy");
    expect(maps[0].options.accessToken).toBe("pk.dummy");
    expect(maps[0].options.style).toBe(MAPBOX_STYLE_LIGHT);
    expect(maps[0].options.logoPosition).toBe("bottom-left");
    expect(maps[0].options.attributionControl).toBe(true);
    expect(String(maps[0].options.customAttribution)).toContain("openskimap.org");
    expect(String(maps[0].options.customAttribution)).toContain("openstreetmap.org/copyright");
    expect(JSON.stringify(maps[0].options)).not.toMatch(/pk\.ey/);
    expect(maps[0].options.center).toEqual([13.35, 47.5]);

    maps[0].listeners.error[0]({ error: { message: "Image sprite could not be loaded" } });
    expect(onFatal).not.toHaveBeenCalled();
    maps[0].listeners.error[0]({ error: { status: 404, message: "tile missing" }, tile: { z: 1 } });
    expect(onFatal).not.toHaveBeenCalled();
    maps[0].listeners.load[0]({});
    maps[0].listeners.error[0]({ error: { status: 401, message: "Unauthorized" }, tile: { z: 1 } });
    expect(onFatal).toHaveBeenCalledTimes(1);
  });

  it("falls back when Mapbox rejects the token or the style before load", () => {
    const maps: FakeMap[] = [];
    const lib = libWith(maps);
    const onFatal = vi.fn();
    createVectorMap(lib, { container: {} as HTMLElement, provider: "mapbox", token: "pk.dummy", theme: "dark", onFatal });
    maps[0].listeners.error[0]({ error: { message: "Failed to fetch style" } });
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect(maps[0].options.style).toBe("mapbox://styles/mapbox/dark-v11");
  });

  it("initialises OpenFreeMap without a token and does not treat its errors as fatal", () => {
    const maps: FakeMap[] = [];
    const lib = libWith(maps);
    const onFatal = vi.fn();
    createVectorMap(lib, { container: {} as HTMLElement, provider: "openfreemap", token: null, theme: "light", onFatal });
    expect(lib.accessToken).toBe("");
    expect(maps[0].options.style).toBe(OPENFREEMAP_STYLE_LIGHT);
    expect(maps[0].options.accessToken).toBeUndefined();
    expect(JSON.stringify(maps[0].options.attributionControl)).toContain("maplibre.org");
    expect(JSON.stringify(maps[0].options.attributionControl)).toContain("openskimap.org");
    maps[0].listeners.error[0]({ error: { status: 401, message: "Unauthorized" } });
    expect(onFatal).not.toHaveBeenCalled();
    expect(() => createVectorMap(lib, { container: {} as HTMLElement, provider: "mapbox", token: "  ", theme: "light" })).toThrow(/token/i);
  });

  it("keeps piste colours readable and names a line without injecting markup", () => {
    const light = pisteLayerSpecs(false);
    const dark = pisteLayerSpecs(true);
    expect(light.find((layer) => layer.id === "piste-easy")?.color).toBe("#2563EB");
    expect(dark.find((layer) => layer.id === "piste-advanced")?.color).toBe("#f4f4f5");
    expect(dark.find((layer) => layer.id === "piste-lift")?.color).toBe("#e5e7eb");
    const tip = pisteTip(
      { kind: "piste", name: "<b>Ötztal</b>", difficulty: "easy" },
      { lift: "Lift", novice: "Novice", easy: "Easy", intermediate: "Intermediate", advanced: "Advanced", freeride: "Freeride", other: "Other" },
    );
    expect(tip).toBe("<b>Ötztal</b> · Easy");
    expect(OPENSKIMAP_ATTRIBUTION).toMatch(/ODbL/);
  });
});

describe("maplibre worker", () => {
  it("uses a same-origin worker path for the static export", () => {
    expect(maplibreWorkerUrl("/ski-pass-map")).toBe("/ski-pass-map/vendor/maplibre-gl-worker.js");
    expect(maplibreWorkerUrl("")).toBe("/vendor/maplibre-gl-worker.js");
    expect(maplibreWorkerUrl("/ski-pass-map/")).toBe("/ski-pass-map/vendor/maplibre-gl-worker.js");
  });

  it("sets that worker before a map is constructed and does not touch Mapbox", async () => {
    setWorkerUrl.mockClear();
    const open = await loadMapLibrary("openfreemap");
    expect(setWorkerUrl).toHaveBeenCalledWith("/ski-pass-map/vendor/maplibre-gl-worker.js");
    expect(open.token).toBeNull();
    setWorkerUrl.mockClear();
    const boxed = await loadMapLibrary("mapbox");
    expect(setWorkerUrl).not.toHaveBeenCalled();
    expect(boxed.token).toBeNull();
    expect(JSON.stringify(boxed)).not.toMatch(/pk\./);
  });
});

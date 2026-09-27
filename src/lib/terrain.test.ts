import { describe, expect, it, vi } from "vitest";
import {
  HILLSHADE_LAYER,
  HILLSHADE_SOURCE,
  TERRAIN_EXAGGERATION,
  TERRAIN_SOURCE,
  TERRAIN_TILES,
  applyTerrain,
  defaultTerrain3d,
  demSource,
  hillshadeBefore,
  type TerrainMap,
} from "./terrain";

function fakeMap(layers: Array<{ id: string; type: string; "source-layer"?: string }>) {
  const sources = new Map<string, unknown>();
  const added: Array<{ layer: { id: string }; before?: string }> = [];
  const map = {
    addSource: vi.fn((id: string, source: unknown) => void sources.set(id, source)),
    getSource: (id: string) => sources.get(id),
    addLayer: vi.fn((layer: { id: string }, before?: string) => {
      added.push({ layer, before });
      layers.push({ id: layer.id, type: "hillshade" });
    }),
    getLayer: (id: string) => layers.find((layer) => layer.id === id),
    getStyle: () => ({ layers }),
    setTerrain: vi.fn(),
    setSky: vi.fn(),
    setFog: vi.fn(),
  };
  return { map: map as TerrainMap & typeof map, sources, added };
}

const POSITRON = [
  { id: "background", type: "background" },
  { id: "water", type: "fill", "source-layer": "water" },
  { id: "landcover_wood", type: "fill", "source-layer": "landcover" },
  { id: "highway_minor", type: "line", "source-layer": "transportation" },
  { id: "boundary_country", type: "line", "source-layer": "boundary" },
  { id: "place_city", type: "symbol", "source-layer": "place" },
];

describe("terrain", () => {
  it("uses the free terrarium tiles, the same ones for shading and 3D", () => {
    expect(TERRAIN_TILES).toMatch(/^https:\/\/elevation-tiles-prod\.s3\.amazonaws\.com\/terrarium\//);
    expect(demSource("terrain")).toMatchObject({ type: "raster-dem", encoding: "terrarium", maxzoom: 12 });
    expect(demSource("hillshade")).toMatchObject({ tiles: demSource("terrain").tiles, maxzoom: 12 });
    expect(demSource("hillshade").attribution).toContain("Terrain Tiles");
  });

  it("puts the shading under roads, borders and labels", () => {
    expect(hillshadeBefore(POSITRON)).toBe("highway_minor");
    expect(hillshadeBefore([{ id: "background", type: "background" }, { id: "label", type: "symbol" }])).toBe("label");
    expect(hillshadeBefore([{ id: "background", type: "background" }])).toBeUndefined();
    expect(hillshadeBefore([{ id: "road-minor", type: "line", "source-layer": "road" }])).toBe("road-minor");
  });

  it("adds relief once and turns the 3D surface on and off", () => {
    const { map, added } = fakeMap([...POSITRON]);
    applyTerrain(map, { provider: "openfreemap", appearance: "light", threeD: true });
    applyTerrain(map, { provider: "openfreemap", appearance: "light", threeD: true });
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ layer: { id: HILLSHADE_LAYER }, before: "highway_minor" });
    expect(map.getSource(HILLSHADE_SOURCE)).toBeTruthy();
    expect(map.getSource(TERRAIN_SOURCE)).toBeTruthy();
    expect(map.setTerrain).toHaveBeenLastCalledWith({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION });
    expect(map.setSky).toHaveBeenCalled();
    expect(map.setFog).not.toHaveBeenCalled();

    applyTerrain(map, { provider: "openfreemap", appearance: "light", threeD: false });
    expect(map.setTerrain).toHaveBeenLastCalledWith(null);
    expect(added).toHaveLength(1);
  });

  it("starts 3D on unless the device is short on memory or saving data", () => {
    expect(defaultTerrain3d({})).toBe(true);
    expect(defaultTerrain3d({ deviceMemory: 8 })).toBe(true);
    expect(defaultTerrain3d({ deviceMemory: 2 })).toBe(false);
    expect(defaultTerrain3d({ deviceMemory: 4, saveData: true })).toBe(false);
    expect(defaultTerrain3d({ reducedData: true })).toBe(false);
  });

  it("uses fog for the Mapbox horizon", () => {
    const { map } = fakeMap([{ id: "background", type: "background" }]);
    applyTerrain(map, { provider: "mapbox", appearance: "dark", threeD: true });
    expect(map.setFog).toHaveBeenCalledWith(expect.objectContaining({ color: expect.any(String) }));
    expect(map.setSky).not.toHaveBeenCalled();
    applyTerrain(map, { provider: "mapbox", appearance: "dark", threeD: false });
    expect(map.setFog).toHaveBeenLastCalledWith(null);
  });
});

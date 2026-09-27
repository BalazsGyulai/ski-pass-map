import { describe, expect, it } from "vitest";
import { passes, resorts } from "./data";
import {
  FOCUS_SOURCE,
  NO_PASS_COLOR,
  RESORT_HIT_LAYERS,
  RESORT_LAYERS,
  RESORT_SOURCE,
  labelFonts,
  passLabel,
  resortFeature,
  resortFeatureCollection,
  resortLayerSpecs,
  safeColor,
  type ResortFeatureContext,
} from "./resort-layers";

const colors = new Map(passes.map((pass) => [pass.id, pass.color]));
const context: ResortFeatureContext = {
  colorOf: (id) => colors.get(id),
  shortNameOf: (id) => `short-${id}`,
  plannedDays: {},
};

describe("resort features", () => {
  it("colours a resort by its first pass and rings it with the second", () => {
    const multi = resorts.find((resort) => resort.passes.filter((id) => colors.has(id)).length >= 2);
    if (!multi) throw new Error("expected a multi-pass resort");
    const feature = resortFeature(multi, context);
    const known = multi.passes.filter((id) => colors.has(id));
    expect(feature?.properties.c1).toBe(colors.get(known[0]));
    expect(feature?.properties.c2).toBe(colors.get(known[1]));
    expect(feature?.properties.multi).toBe(true);
    expect(feature?.properties.pass).toBe(`short-${known[0]} +${known.length - 1}`);
    expect(feature?.geometry.coordinates).toEqual([multi.lon, multi.lat]);
  });

  it("draws resorts without a pass in grey, with no pass label", () => {
    const bare = { id: "x", name: "Nowhere", lat: 47, lon: 13, passes: ["unknown-pass"] };
    const feature = resortFeature(bare, context);
    expect(feature?.properties).toMatchObject({ c1: NO_PASS_COLOR, c2: NO_PASS_COLOR, noPass: true, multi: false, pass: "", rank: 2 });
  });

  it("puts planned resorts first and never emits invalid colours or coordinates", () => {
    const planned = resortFeature({ id: "p", name: "P", lat: 47, lon: 13, passes: [] }, { ...context, plannedDays: { p: 2.6 } });
    expect(planned?.properties.days).toBe(3);
    expect(planned?.properties.rank).toBe(0);
    expect(resortFeature({ id: "n", name: "N", lat: Number.NaN, lon: 13, passes: [] }, context)).toBeNull();
    expect(safeColor("red")).toBe(NO_PASS_COLOR);
    expect(safeColor("#1f5fd1")).toBe("#1f5fd1");
    expect(safeColor('#fff" onload="x')).toBe(NO_PASS_COLOR);
  });

  it("marks the selected resort for the focus layers", () => {
    const feature = resortFeature(resorts[0], context, "selected");
    expect(feature?.properties.kind).toBe("selected");
    expect(resortFeatureCollection(resorts, context).features.length).toBe(resorts.length);
  });

  it("labels passes briefly", () => {
    expect(passLabel([])).toBe("");
    expect(passLabel(["Ski amadé"])).toBe("Ski amadé");
    expect(passLabel(["Ski amadé", "SuperSkiCard", "Snow Card"])).toBe("Ski amadé +2");
  });
});

describe("resort layers", () => {
  it("builds clusters, dots, labels and focus layers on the right sources", () => {
    const specs = resortLayerSpecs({ provider: "openfreemap", appearance: "light" });
    const ids = specs.map((spec) => spec.id);
    expect(ids).toEqual(Object.values(RESORT_LAYERS));
    for (const spec of specs) {
      const source = String(spec.id).startsWith("resort-focus") ? FOCUS_SOURCE : RESORT_SOURCE;
      expect(spec.source, String(spec.id)).toBe(source);
    }
    for (const id of RESORT_HIT_LAYERS) expect(ids).toContain(id);
    // The focus layers sit on top of everything else.
    expect(ids.indexOf(RESORT_LAYERS.focusDot)).toBeGreaterThan(ids.indexOf(RESORT_LAYERS.label));
  });

  it("uses fonts that exist on each provider's glyph server", () => {
    const openfree = JSON.stringify(resortLayerSpecs({ provider: "openfreemap", appearance: "dark" }));
    expect(openfree).toContain("Noto Sans Bold");
    expect(openfree).not.toContain("DIN Pro");
    const mapbox = JSON.stringify(resortLayerSpecs({ provider: "mapbox", appearance: "light" }));
    expect(mapbox).toContain("DIN Pro Bold");
    expect(mapbox).not.toContain("Noto Sans");
    expect(labelFonts("mapbox").regular[0]).toBe("DIN Pro Medium");
  });

  it("switches label and cluster colours with the theme", () => {
    const light = JSON.stringify(resortLayerSpecs({ provider: "openfreemap", appearance: "light" }));
    const dark = JSON.stringify(resortLayerSpecs({ provider: "openfreemap", appearance: "dark" }));
    expect(light).toContain("#0d1321");
    expect(dark).toContain("#f2f4f8");
    expect(dark).not.toBe(light);
  });
});

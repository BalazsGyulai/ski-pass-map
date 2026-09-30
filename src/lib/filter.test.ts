import { describe, expect, it } from "vitest";
import { cities, passes, resorts } from "./data";
import { distanceKm } from "./distance";
import { filterResorts, measureFromField, snapPassPrice, sortResorts, PASS_PRICE_MAX, PASS_PRICE_MIN } from "./filter";
import { parseShareState, serializeShareState } from "./url-state";

const names = new Map(passes.map((pass) => [pass.id, pass.name]));
const vienna = cities.find((city) => city.id === "vienna");
if (!vienna) throw new Error("missing vienna");

describe("filterResorts", () => {
  it("filters by pass any/all, uncovered resorts, and public-transport notes", () => {
    const base = { home: vienna, favourites: new Set<string>(), passNames: names };
    const empty = {
      q: "",
      passes: [] as string[],
      passMatch: "any" as const,
      noPass: false,
      regions: [] as string[],
      transit: false,
      park: false,
      night: false,
      minElev: null,
      minSlope: null,
      maxKm: null,
      favouritesOnly: false,
      showAbandoned: false,
      minPassPrice: null,
      maxPassPrice: null,
    };
    const uncovered = filterResorts(resorts, { ...empty, noPass: true }, base);
    expect(uncovered.length).toBeGreaterThan(0);
    expect(uncovered.every((resort) => resort.passes.length === 0)).toBe(true);
    const closed = resorts.find((resort) => resort.abandoned);
    if (!closed) throw new Error("expected a permanently closed area");
    expect(filterResorts(resorts, { ...empty, showAbandoned: true }, base).some((resort) => resort.id === closed.id)).toBe(true);
    expect(filterResorts(resorts, empty, base).some((resort) => resort.id === closed.id)).toBe(false);
    expect(filterResorts(resorts, { ...empty, q: closed.name }, base).some((resort) => resort.id === closed.id)).toBe(true);
    const passId = passes.find((pass) => resorts.some((resort) => resort.passes.includes(pass.id)))?.id;
    if (!passId) throw new Error("expected a pass with coverage");
    const covered = filterResorts(resorts, { ...empty, passes: [passId] }, base);
    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every((resort) => resort.passes.includes(passId))).toBe(true);
    const second = passes.find((pass) => pass.id !== passId && resorts.some((resort) => resort.passes.includes(pass.id) && resort.passes.includes(passId)));
    if (second) {
      const both = filterResorts(resorts, { ...empty, passes: [passId, second.id], passMatch: "all" }, base);
      expect(both.every((resort) => resort.passes.includes(passId) && resort.passes.includes(second.id))).toBe(true);
    }
    const transit = filterResorts(resorts, { ...empty, transit: true }, base);
    expect(transit.every((resort) => Boolean(resort.public_transport))).toBe(true);
    const named = resorts.find((resort) => /Semmering/i.test(resort.name));
    expect(filterResorts(resorts, { ...empty, q: "Semmering" }, base).some((resort) => resort.id === named?.id)).toBe(true);
    const parks = filterResorts(resorts, { ...empty, park: true }, base);
    expect(parks.length).toBeGreaterThan(0);
    expect(parks.every((resort) => resort.snowpark === true)).toBe(true);
    const high = filterResorts(resorts, { ...empty, minElev: 2000 }, base);
    expect(high.length).toBeGreaterThan(0);
    expect(high.every((resort) => (resort.top_elevation_m ?? 0) >= 2000)).toBe(true);
    const umbrella = resorts.find((resort) => resort.stats_aggregate && (resort.slope_km_display ?? 0) >= 20);
    if (!umbrella) throw new Error("expected an umbrella area");
    expect(umbrella.slope_km).toBeNull();
    expect(umbrella.lifts).toBeNull();
    const long = filterResorts(resorts, { ...empty, minSlope: 20 }, base);
    expect(long.every((resort) => (resort.slope_km ?? 0) >= 20)).toBe(true);
    expect(long.some((resort) => resort.id === umbrella.id)).toBe(false);
    expect(resorts.some((resort) => resort.name === "Horsefeathers Superpark Planai")).toBe(false);
    expect(resorts.some((resort) => resort.name === "Schizentrum Rettenbach")).toBe(false);
  });

  it("limits distance from Vienna and sorts unknown values last", () => {
    const near = filterResorts(
      resorts,
      {
        q: "",
        passes: [],
        passMatch: "any",
        noPass: false,
        regions: [],
        transit: false,
        park: false,
        night: false,
        minElev: null,
        minSlope: null,
        maxKm: 30,
        favouritesOnly: false,
        showAbandoned: false,
        minPassPrice: null,
        maxPassPrice: null,
      },
      { home: vienna, favourites: new Set(), passNames: names },
    );
    expect(near.some((resort) => resort.region === "Tirol" && resort.lon < 12)).toBe(false);
    expect(near.every((resort) => distanceKm(vienna, resort) <= 30)).toBe(true);
    const sorted = sortResorts(resorts, "elevation", "desc", () => null);
    expect(sorted[0].top_elevation_m).not.toBeNull();
    expect((sorted[0].top_elevation_m ?? 0) >= (sorted[1].top_elevation_m ?? 0)).toBe(true);
    const firstMissing = sorted.findIndex((resort) => resort.top_elevation_m == null);
    if (firstMissing === -1) {
      expect(sorted.at(-1)?.top_elevation_m).toEqual(expect.any(Number));
    } else {
      expect(sorted.slice(firstMissing).every((resort) => resort.top_elevation_m == null)).toBe(true);
    }
  });
});

describe("share url", () => {
  it("round-trips the fields that should be shareable", () => {
    const state = parseShareState(new URLSearchParams("passes=bergerlebnispass,ostalpen&match=all&transit=1&home=vienna&resort=stuhleck&view=list&lang=hu&sort=name&maxKm=80&regions=Styria|Tirol&abandoned=1"));
    expect(state).toMatchObject({
      passes: ["bergerlebnispass", "ostalpen"],
      showAbandoned: true,
      passMatch: "all",
      transit: true,
      home: "",
      resort: "stuhleck",
      view: "list",
      sort: "name",
      maxKm: 80,
      regions: ["Styria", "Tirol"],
      geoLat: null,
      geoLon: null,
    });
    const again = parseShareState(new URLSearchParams(serializeShareState(state)));
    expect(again).toEqual(state);
  });
});

describe("pass price filter", () => {
  const base = parseShareState(new URLSearchParams());
  const context = { home: null, favourites: new Set<string>(), passNames: names };
  const cheapPass = passes[0].id;
  const priceOf = (id: string) => (id === cheapPass ? 300 : 900);

  it("keeps resorts that a pass within the price covers", () => {
    const kept = filterResorts(resorts, { ...base, maxPassPrice: 400 }, { ...context, passPriceOf: priceOf });
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.every((resort) => resort.passes.includes(cheapPass))).toBe(true);
    expect(filterResorts(resorts, { ...base, maxPassPrice: 1000 }, { ...context, passPriceOf: priceOf }).every((resort) => resort.passes.length > 0)).toBe(true);
  });

  it("drops everything when prices are unknown, and round-trips in the URL", () => {
    expect(filterResorts(resorts, { ...base, maxPassPrice: 400 }, context)).toEqual([]);
    const state = parseShareState(new URLSearchParams("maxPrice=650"));
    expect(state.maxPassPrice).toBe(650);
    expect(serializeShareState(state)).toBe("maxPrice=650");
  });

  it("keeps a resort only when a pass sits between the minimum and the maximum", () => {
    const inBand = filterResorts(resorts, { ...base, minPassPrice: 500, maxPassPrice: 700 }, { ...context, passPriceOf: priceOf });
    expect(inBand).toEqual([]);
    const wide = filterResorts(resorts, { ...base, minPassPrice: 250, maxPassPrice: 400 }, { ...context, passPriceOf: priceOf });
    expect(wide.length).toBeGreaterThan(0);
    expect(wide.every((resort) => resort.passes.includes(cheapPass))).toBe(true);
    const state = parseShareState(new URLSearchParams("minPrice=500&maxPrice=800"));
    expect(state.minPassPrice).toBe(500);
    expect(state.maxPassPrice).toBe(800);
    expect(serializeShareState(state)).toBe("minPrice=500&maxPrice=800");
  });
});

describe("measureFromField", () => {
  it("clears an empty field and refuses a negative elevation or slope", () => {
    expect(measureFromField("", true)).toBeNull();
    expect(measureFromField("-1", true)).toBeUndefined();
    expect(measureFromField("-0.5", false)).toBeUndefined();
    expect(measureFromField("1800", true)).toBe(1800);
    expect(measureFromField("12.5", false)).toBe(12.5);
    expect(measureFromField("12.", false)).toBeUndefined();
  });
});

describe("snapPassPrice", () => {
  it("snaps a typed price onto the slider and turns an end of the scale off", () => {
    expect(snapPassPrice(475, PASS_PRICE_MAX, "min")).toBe(500);
    expect(snapPassPrice(100, PASS_PRICE_MAX, "min")).toBeNull();
    expect(snapPassPrice(2000, PASS_PRICE_MIN, "max")).toBeNull();
    expect(snapPassPrice(900, 600, "min")).toBe(600);
    expect(snapPassPrice(400, 700, "max")).toBe(700);
  });
});


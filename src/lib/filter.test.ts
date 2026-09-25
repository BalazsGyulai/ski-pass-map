import { describe, expect, it } from "vitest";
import { clusterPoints } from "./cluster";
import { cities, passes, resorts } from "./data";
import { distanceKm } from "./distance";
import { filterResorts, sortResorts } from "./filter";
import { pieSvg } from "./marker";
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
    };
    const uncovered = filterResorts(resorts, { ...empty, noPass: true }, base);
    expect(uncovered.some((resort) => resort.id === "unterberg")).toBe(true);
    expect(uncovered.every((resort) => resort.passes.length === 0)).toBe(true);
    expect(filterResorts(resorts, { ...empty, showAbandoned: true }, base).some((resort) => resort.id === "defunct-alpl")).toBe(true);
    expect(filterResorts(resorts, empty, base).some((resort) => resort.id === "defunct-alpl")).toBe(false);
    expect(filterResorts(resorts, { ...empty, q: "Alpl" }, base).some((resort) => resort.id === "defunct-alpl")).toBe(true);
    const bep = filterResorts(resorts, { ...empty, passes: ["bergerlebnispass"] }, base);
    expect(bep.some((resort) => resort.id === "semmering-hirschenkogel")).toBe(true);
    expect(bep.some((resort) => resort.id === "stuhleck")).toBe(false);
    const both = filterResorts(resorts, { ...empty, passes: ["bergerlebnispass", "ostalpen"], passMatch: "all" }, base);
    expect(both.some((resort) => resort.id === "semmering-hirschenkogel")).toBe(true);
    expect(both.every((resort) => resort.passes.includes("bergerlebnispass") && resort.passes.includes("ostalpen"))).toBe(true);
    const transit = filterResorts(resorts, { ...empty, transit: true }, base);
    expect(transit.every((resort) => Boolean(resort.public_transport))).toBe(true);
    expect(transit.some((resort) => resort.id === "semmering-hirschenkogel")).toBe(true);
    expect(transit.some((resort) => resort.id === "stubaier-gletscher")).toBe(false);
    expect(filterResorts(resorts, { ...empty, q: "Otscher" }, base).map((resort) => resort.id)).toEqual(["oetscher-lackenhof"]);
    const parks = filterResorts(resorts, { ...empty, park: true }, base);
    expect(parks.length).toBeGreaterThan(0);
    expect(parks.every((resort) => resort.snowpark === true)).toBe(true);
    const high = filterResorts(resorts, { ...empty, minElev: 2000 }, base);
    expect(high.length).toBeGreaterThan(0);
    expect(high.every((resort) => (resort.top_elevation_m ?? 0) >= 2000)).toBe(true);
    expect(resorts.some((resort) => resort.id === "riedbach-neustadtl")).toBe(false);
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
      },
      { home: vienna, favourites: new Set(), passNames: names },
    );
    expect(near.some((resort) => resort.id === "stubaier-gletscher")).toBe(false);
    expect(near.every((resort) => distanceKm(vienna, resort) <= 30)).toBe(true);
    const sorted = sortResorts(resorts, "elevation", "desc", () => null);
    expect(sorted[0].top_elevation_m).not.toBeNull();
    expect((sorted[0].top_elevation_m ?? 0) >= (sorted[1].top_elevation_m ?? 0)).toBe(true);
    expect(sorted.at(-1)?.top_elevation_m).toBeNull();
  });
});

describe("clusterPoints", () => {
  it("groups nearby resorts at low zoom and separates them when labels would show", () => {
    const pair = resorts.filter((resort) => resort.id === "semmering-hirschenkogel" || resort.id === "stuhleck");
    const low = clusterPoints(pair, 8);
    expect(low).toHaveLength(1);
    expect(low[0].items).toHaveLength(2);
    expect(clusterPoints(pair, 11)).toHaveLength(2);
    const far = clusterPoints(
      resorts.filter((resort) => resort.id === "semmering-hirschenkogel" || resort.id === "stubaier-gletscher"),
      8,
    );
    expect(far).toHaveLength(2);
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
      home: "vienna",
      resort: "stuhleck",
      view: "list",
      lang: "hu",
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

describe("pieSvg", () => {
  it("draws one wedge per pass and a grey dot when nothing covers the resort", () => {
    expect(pieSvg([], { selected: false, closed: false })).toContain('fill="#8b938e"');
    const pie = pieSvg(["#1f5fd1", "#1a9a3a"], { selected: true, closed: false });
    expect(pie.match(/<path /g)).toHaveLength(2);
    expect(pie).toContain("#ffbf47");
  });
});

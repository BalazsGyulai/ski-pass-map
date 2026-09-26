import { describe, expect, it } from "vitest";
import { clusterPoints } from "./cluster";
import { cities, passes, resorts } from "./data";
import { distanceKm } from "./distance";
import { filterResorts, sortResorts } from "./filter";
import { pieSvg } from "./marker";
import type { Resort } from "./schema";
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

describe("clusterPoints", () => {
  it("groups nearby resorts at low zoom and separates them when labels would show", () => {
    const grouped = clusterPoints(
      resorts.filter((resort) => !resort.abandoned),
      8,
    ).find((cluster) => cluster.items.length >= 2);
    if (!grouped) throw new Error("expected a cluster");
    const pair = grouped.items.slice(0, 2);
    expect(clusterPoints(pair, 8)).toHaveLength(1);
    expect(clusterPoints(pair, 11)).toHaveLength(2);
    const east = resorts.find((resort) => resort.region === "Lower Austria");
    const west = resorts.find((resort) => resort.region === "Vorarlberg");
    expect(east && west).toBeTruthy();
    expect(clusterPoints([east as Resort, west as Resort], 8)).toHaveLength(2);
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

describe("pieSvg", () => {
  it("draws one wedge per pass and a grey dot when nothing covers the resort", () => {
    expect(pieSvg([], { selected: false, closed: false })).toContain('fill="#8b938e"');
    const pie = pieSvg(["#1f5fd1", "#1a9a3a"], { selected: true, closed: false });
    expect(pie.match(/<path /g)).toHaveLength(2);
    expect(pie).toContain("#ffbf47");
  });
});

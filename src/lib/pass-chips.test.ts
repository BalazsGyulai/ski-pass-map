import { describe, expect, it } from "vitest";
import { orderPassChips } from "./pass-chips";

const passes = [
  { id: "far", name: "Far" },
  { id: "near", name: "Near" },
  { id: "none", name: "None" },
  { id: "alpha", name: "Alpha" },
];
const resorts = [
  { lat: 47, lon: 13, passes: ["far"] },
  { lat: 48, lon: 16, passes: ["near", "alpha"] },
  { lat: 48.1, lon: 16.1, passes: ["near"] },
  { lat: 48.2, lon: 16.2, abandoned: true, passes: ["far"] },
];
const name = (pass: { name: string }) => pass.name;
const area = { south: 47.9, west: 15.5, north: 48.5, east: 16.5 };

describe("orderPassChips", () => {
  it("sorts by name when nothing else is set", () => {
    expect(orderPassChips(passes, resorts, { searchAsMove: false, area: null, home: null, name }).map((pass) => pass.id)).toEqual([
      "alpha",
      "far",
      "near",
      "none",
    ]);
  });

  it("puts passes covering the map first when search-as-move is on", () => {
    const ids = orderPassChips(passes, resorts, { searchAsMove: true, area, home: { lat: 47, lon: 13 }, name }).map((pass) => pass.id);
    expect(ids.slice(0, 2)).toEqual(["near", "alpha"]);
    expect(ids.slice(2).sort()).toEqual(["far", "none"]);
  });

  it("orders by the nearest resort when a place is set and the map is not following", () => {
    const ids = orderPassChips(passes, resorts, { searchAsMove: false, area, home: { lat: 48, lon: 16 }, name }).map((pass) => pass.id);
    expect(ids).toEqual(["alpha", "near", "far", "none"]);
  });
});

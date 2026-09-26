import { describe, expect, it } from "vitest";
import { cityPlaceId, matchReferenceCities, sanitizeActivePlaceId, sanitizePlaces } from "./places";

describe("matchReferenceCities", () => {
  it("matches a city name or alias inside typed text and ignores unknown addresses", () => {
    expect(matchReferenceCities("Wien").map((city) => city.id)).toContain("vienna");
    expect(matchReferenceCities("Hauptplatz, Graz").map((city) => city.id)).toEqual(["graz"]);
    expect(matchReferenceCities("Innsbruck")).toHaveLength(1);
    expect(matchReferenceCities("nowhere street 12")).toEqual([]);
    expect(matchReferenceCities("a")).toEqual([]);
  });
});

describe("sanitizePlaces", () => {
  it("keeps saved places and drops a stored home city that was never chosen", () => {
    const graz = { id: cityPlaceId("graz"), label: "Graz", lat: 47.07, lon: 15.44, kind: "city" as const };
    expect(sanitizePlaces([graz, { home: "vienna" }, { id: "bad place", label: "x", lat: 999, lon: 0 }])).toEqual([graz]);
    expect(sanitizeActivePlaceId(graz.id, [graz])).toBe(graz.id);
    expect(sanitizeActivePlaceId("vienna", [graz])).toBeNull();
    expect(sanitizePlaces("vienna")).toEqual([]);
  });
});

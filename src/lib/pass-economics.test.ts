import { describe, expect, it } from "vitest";
import { averageDayTicket, breakEvenDays, passSavings, sortPasses } from "./pass-economics";

const resorts = [
  { passes: ["a"], abandoned: false, day_ticket_eur: 60 },
  { passes: ["a", "b"], abandoned: false, day_ticket_eur: 70 },
  { passes: ["a"], abandoned: false, day_ticket_eur: null },
  { passes: ["a"], abandoned: true, day_ticket_eur: 10 },
  { passes: ["b"], abandoned: false, day_ticket_eur: null },
];

describe("pass economics", () => {
  it("averages known adult day tickets over open resorts only", () => {
    expect(averageDayTicket({ id: "a" }, resorts)).toEqual({ eur: 65, resorts: 2 });
    expect(averageDayTicket({ id: "b" }, resorts)).toEqual({ eur: 70, resorts: 1 });
    expect(averageDayTicket({ id: "c" }, resorts)).toBeNull();
  });

  it("finds the break-even and the savings for a number of days", () => {
    expect(breakEvenDays(650, 65)).toBe(10);
    expect(breakEvenDays(null, 65)).toBeNull();
    expect(breakEvenDays(650, 0)).toBeNull();
    expect(passSavings(650, 65, 12)).toBe(130);
    expect(passSavings(650, 65, 8)).toBe(-130);
  });

  it("sorts by price with unknown prices last, by resort count, or by name", () => {
    const items = [
      { name: "B", price: 500, resorts: 3 },
      { name: "A", price: null, resorts: 9 },
      { name: "C", price: 300, resorts: 3 },
    ];
    const by = (sort: "price" | "resorts" | "name") => sortPasses(items, sort, (item) => item).map((item) => item.name);
    expect(by("price")).toEqual(["C", "B", "A"]);
    expect(by("resorts")).toEqual(["A", "B", "C"]);
    expect(by("name")).toEqual(["A", "B", "C"]);
  });
});

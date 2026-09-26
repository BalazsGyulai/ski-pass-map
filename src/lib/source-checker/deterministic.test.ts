import { describe, expect, it } from "vitest";
import { deterministicFieldCheck } from "./deterministic";

const page = "<html><body>Adult day ticket 59.00 EUR until 2027-04-15</body></html>";

describe("deterministic source checker", () => {
  it("matches prices and dates", () => {
    const price = deterministicFieldCheck({ path: "dayTicket.value.eur", before: 50, after: 59, kind: "price" }, page);
    expect(price.verdict).toBe("supported");
    const date = deterministicFieldCheck({ path: "season.end", before: "2027-04-01", after: "2027-04-15", kind: "date" }, page);
    expect(date.verdict).toBe("supported");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeDifficulty, pisteStyle, simplifyLine } from "./pistes";

describe("piste styles", () => {
  it("colours downhill difficulties and dashes freeride", () => {
    expect(pisteStyle("novice", "piste").color).toBe("#1f9d55");
    expect(pisteStyle("easy", "piste").color).toBe("#2563EB");
    expect(pisteStyle("intermediate", "piste").color).toBe("#DC2626");
    expect(pisteStyle("advanced", "piste").color).toBe("#111827");
    expect(pisteStyle("expert", "piste").color).toBe("#111827");
    expect(pisteStyle("freeride", "piste").color).toBe("#EA7A1A");
    expect(pisteStyle("freeride", "piste").dashArray).toBe("8 6");
    expect(pisteStyle(normalizeDifficulty("nope"), "piste").color).toBe("#6b7280");
    expect(pisteStyle("easy", "lift").color).toBe("#1F2937");
    expect(pisteStyle("easy", "lift").dashArray).toBe("1.5 3");
  });
});

describe("simplifyLine", () => {
  it("keeps endpoints and drops a point on a straight line", () => {
    const line = [
      [0, 0],
      [1, 0.00001],
      [2, 0],
    ];
    expect(simplifyLine(line, 0.001)).toEqual([
      [0, 0],
      [2, 0],
    ]);
    expect(simplifyLine(line, 0)).toEqual(line);
  });
});

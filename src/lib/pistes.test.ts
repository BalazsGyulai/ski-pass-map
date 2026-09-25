import { describe, expect, it } from "vitest";
import { normalizeDifficulty, pisteStyle, simplifyLine } from "./pistes";

describe("piste styles", () => {
  it("colours downhill difficulties and dashes freeride", () => {
    expect(pisteStyle("novice", "piste").color).toBe("#1f9d55");
    expect(pisteStyle("easy", "piste").color).toBe("#1d6fd8");
    expect(pisteStyle("intermediate", "piste").color).toBe("#d62728");
    expect(pisteStyle("advanced", "piste").color).toBe("#161616");
    expect(pisteStyle("expert", "piste").color).toBe("#161616");
    expect(pisteStyle("freeride", "piste").dashArray).toBe("8 6");
    expect(pisteStyle(normalizeDifficulty("nope"), "piste").color).toBe("#6b7280");
    expect(pisteStyle("easy", "lift").color).toBe("#1c2430");
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

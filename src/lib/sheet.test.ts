import { describe, expect, it } from "vitest";
import { nextSheetSnap } from "./sheet";

describe("nextSheetSnap", () => {
  it("expands peek to half to full", () => {
    expect(nextSheetSnap("peek", "up")).toBe("half");
    expect(nextSheetSnap("half", "up")).toBe("full");
    expect(nextSheetSnap("full", "up")).toBe("full");
  });

  it("collapses full to half to peek, then closes", () => {
    expect(nextSheetSnap("full", "down")).toBe("half");
    expect(nextSheetSnap("half", "down")).toBe("peek");
    expect(nextSheetSnap("peek", "down")).toBe("close");
  });
});

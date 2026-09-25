import { describe, expect, it } from "vitest";
import { nextSheetSnap, snapFromKey } from "./sheet";

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

describe("snapFromKey", () => {
  it("maps arrows, Home, and End onto the same snaps", () => {
    expect(snapFromKey("peek", "ArrowUp")).toBe("half");
    expect(snapFromKey("half", "ArrowDown")).toBe("peek");
    expect(snapFromKey("peek", "ArrowDown")).toBe("close");
    expect(snapFromKey("full", "Home")).toBe("peek");
    expect(snapFromKey("peek", "End")).toBe("full");
    expect(snapFromKey("half", "Enter")).toBeNull();
  });
});

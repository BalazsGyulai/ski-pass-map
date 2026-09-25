import { describe, expect, it } from "vitest";
import { shareHistoryStep } from "./history-step";

const base = {
  onMap: true,
  next: "/ski-pass-map/?q=semmering&resort=stuhleck",
  current: "/ski-pass-map/?resort=stuhleck",
  previousResort: "stuhleck" as string | null | undefined,
  resort: "stuhleck",
  pushed: true,
  historyFlag: true,
  bare: "/ski-pass-map/?q=semmering",
  rememberedBare: "/ski-pass-map/",
};

describe("shareHistoryStep", () => {
  it("rewrites the entry under an open resort when filters change", () => {
    expect(shareHistoryStep(base)).toEqual({
      type: "sync-under",
      bare: "/ski-pass-map/?q=semmering",
      resortUrl: "/ski-pass-map/?q=semmering&resort=stuhleck",
    });
  });

  it("only replaces the current entry when the under-entry already matches", () => {
    expect(
      shareHistoryStep({
        ...base,
        next: "/ski-pass-map/?q=semmering&resort=rax",
        current: "/ski-pass-map/?q=semmering&resort=stuhleck",
        rememberedBare: "/ski-pass-map/?q=semmering",
        bare: "/ski-pass-map/?q=semmering",
      }).type,
    ).toBe("replace");
  });

  it("pushes a resort entry on top of the current map url", () => {
    expect(
      shareHistoryStep({
        ...base,
        previousResort: null,
        pushed: false,
        historyFlag: false,
        current: "/ski-pass-map/",
        rememberedBare: "/ski-pass-map/",
      }).type,
    ).toBe("push");
  });

  it("seeds a deep link so Back returns to the map without that resort", () => {
    expect(
      shareHistoryStep({
        ...base,
        previousResort: undefined,
        pushed: false,
        historyFlag: false,
      }).type,
    ).toBe("seed");
  });

  it("does nothing when the url already matches", () => {
    expect(shareHistoryStep({ ...base, next: base.current, bare: base.rememberedBare }).type).toBe("noop");
  });
});

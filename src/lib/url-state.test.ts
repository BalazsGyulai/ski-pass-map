import { describe, expect, it } from "vitest";
import { bareResortUrl, defaultShareState, parseShareState, serializeShareState } from "./url-state";

describe("parseShareState", () => {
  it("drops markup and unknown tokens from the query", () => {
    const state = parseShareState(
      new URLSearchParams(
        "q=%3Cimg%20src=x%20onerror=alert(1)%3E&passes=ok,<script>,ok&regions=Lower%20Austria|<b>x</b>&home=javascript:alert(1)&resort=%3Csvg%3E&view=filters&lat=999&minElev=-5",
      ),
    );
    expect(state.q).toBe("<img src=x onerror=alert(1)>");
    expect(state.q).not.toMatch(/[\u0000-\u001F]/);
    expect(state.passes).toEqual(["ok"]);
    expect(state.regions).toEqual(["Lower Austria"]);
    expect(state.home).toBe("");
    expect(state.resort).toBeNull();
    expect(state.view).toBe("filters");
    expect(state.geoLat).toBeNull();
    expect(state.geoLon).toBeNull();
    expect(state.minElev).toBeNull();
  });

  it("caps a very long search string", () => {
    const state = parseShareState(new URLSearchParams({ q: "a".repeat(500) }));
    expect(state.q).toHaveLength(200);
  });

  it("keeps ordinary shared filters", () => {
    const state = parseShareState(new URLSearchParams("q=Stuhleck&passes=ostalpen&regions=Lower%20Austria|Styria&home=vienna&resort=stuhleck"));
    expect(state.q).toBe("Stuhleck");
    expect(state.passes).toEqual(["ostalpen"]);
    expect(state.regions).toEqual(["Lower Austria", "Styria"]);
    expect(state.home).toBe("vienna");
    expect(state.resort).toBe("stuhleck");
  });
});

describe("serializeShareState", () => {
  it("never writes device coordinates into a shareable query", () => {
    const state = {
      ...defaultShareState(),
      home: "geo",
      geoLat: 47.12345,
      geoLon: 16.54321,
      resort: "stuhleck",
    };
    const query = serializeShareState(state);
    expect(query).not.toMatch(/lat|lon|geo|47\.|16\./);
    expect(parseShareState(new URLSearchParams("home=geo&lat=47.12345&lon=16.54321")).geoLat).toBeNull();
    expect(parseShareState(new URLSearchParams("home=geo&lat=47.12345&lon=16.54321")).home).toBe("");
    expect(parseShareState(new URLSearchParams("klima=1&closed=1"))).toMatchObject({ transit: true, showAbandoned: true });
  });
});

describe("bareResortUrl", () => {
  it("removes the resort and returns to the map view", () => {
    const share = { ...defaultShareState(), q: "rax", resort: "stuhleck", view: "filters" as const };
    expect(bareResortUrl("/ski-pass-map/", share)).toBe("/ski-pass-map/?q=rax");
  });
});
